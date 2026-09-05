// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/main-2d — the composition root of the flat board. The one that never imports a renderer.
//
// ========================= WHY THIS IS A SECOND ENTRY AND NOT A MODE =========================
// Measured, not assumed (`spike/2d-weight/`, and the note in docs/design-2d-board-and-piece-sets):
//
//   2D only, no renderer     104.17 KB raw    36.70 KB gzip
//   Zdog board and pieces    146.44 KB        49.20 KB
//
// A flat board offered as a MODE inside the Zdog bundle would ask a school's connection for
// everything the 3D board needs and then not use it. As its own entry it asks for what it draws.
// The engine makes that possible on purpose: `createGame` is an ACCESSIBILITY contract and imports
// no renderer at all, which its own consumer test asserts in as many words.
//
// ========================= WHAT IT SHARES, WHICH IS EVERYTHING HARD =========================
// The rules, the state machine, the negamax search in its worker, the seven declaration fields,
// the HUD, i18n, the layout — all the same modules the 3D board composes. What differs is fifty
// lines: there is no stage, no camera, no picking, and the board is the grid mirror with its
// `sr-only` taken off.
//
// So the two views cannot drift on anything that matters. A rule fixed here is fixed there.

import { createGame } from '@the-inclusionist/engine';
import { srAlert, srSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import { VIZ_FILTER } from '@the-inclusionist/engine/render/viz-modes.js';
import { createChessDeclaration } from '../declaration/chess-declaration.ts';
import { createEngineClient } from '../chess/engine/client.ts';
import { DEFAULT_DIFFICULTY, DIFFICULTY_DEPTH, type Difficulty } from '../chess/engine/difficulty.ts';
import { type MoveResult } from '../chess/rules.ts';
import { clear as clearGame, loadSettings, resume, save as saveGame, saveSettings }
  from '../chess/session.ts';
import { createGameState, type Activation } from '../chess/state.ts';
import { type Side, type Square, toAlgebraic } from '../chess/types.ts';
import { createI18n, preferredLocale, type I18n } from '../i18n/index.ts';
import { createGridMirror } from '../ui/grid-mirror.ts';
import { createHud } from '../ui/hud.ts';
import { applyLayout } from '../ui/layout.ts';
import { BOARD_THEMES, CONTRAST_THEME, DEFAULT_THEME } from '../ui/board-themes.ts';
import { AVAILABLE_SETS, DEFAULT_SET } from '../ui/piece-sets.ts';

/** What the move sounds like. Shared word for word with the 3D root, and worth keeping in step. */
function moveSentence(i18n: I18n, move: MoveResult): string {
  if (move.castle === 'king') return i18n.t('move.castleShort');
  if (move.castle === 'queen') return i18n.t('move.castleLong');

  const piece = i18n.describePiece(move.piece).text;
  const from = toAlgebraic(move.from);
  const to = toAlgebraic(move.to);

  if (move.captured) {
    return i18n.t('move.capture', {
      piece, from, to, target: i18n.describePiece(move.captured).text,
    });
  }
  if (move.promotion) {
    return i18n.t('move.promotion', {
      to, piece: i18n.describePiece({ type: move.promotion, side: move.piece.side }).text,
    });
  }
  return i18n.t('move.plain', { piece, from, to });
}

export function boot2d(host: Document = document): void {
  const region = host.getElementById('game-region');
  if (!region) throw new Error('#game-region is required (engine MARCACAO_EXIGIDA)');

  const i18n = createI18n(preferredLocale(navigator.language));
  host.documentElement.lang = i18n.bcp47();

  // ========================= THE GAME SURVIVES A CHANGE OF VIEW =========================
  // The three views are three pages, so a navigation throws away every object in memory. The score
  // sheet is written to the tab's own storage after anything that changes it and read back here,
  // which is why switching from 2D to 2.5D continues the game rather than starting one.
  const rules = resume();
  const playerSide: Side = loadSettings().side ?? 'w';
  const game = createGameState({ rules, playerSide, opponent: true });
  const opponent = createEngineClient();
  let difficulty: Difficulty = DEFAULT_DIFFICULTY;
  let thinking = false;
  /** A walk is in flight: the board must not accept a move played on top of it. */
  let walking = false;
  let cursor: Square = { x: 4, y: 6 };

  // There is no animation to reduce — a flat board places a piece where the rules put it — but the
  // switch stays in the panel because the person's preference is about the whole product, and a
  // control that vanishes between two views of one game reads as a bug.
  let motionReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let paletteHigh = window.matchMedia?.('(prefers-contrast: more)').matches ?? false;
  let vision = 'normal';
  const remembered = loadSettings();
  let showCoordinates = remembered.coordinates ?? true;
  let setKey = remembered.set ?? DEFAULT_SET;
  let themeKey = remembered.theme ?? (paletteHigh ? CONTRAST_THEME : DEFAULT_THEME);
  /** What to go back to when high contrast is switched off again. */
  let previousTheme = DEFAULT_THEME;

  /**
   * ========================= CHANGING SIDES IS A NEW GAME =========================
   * There is no honest way to swap sides in the middle of one: the position, the score sheet and
   * the captured tally all belong to whoever played them. So the control starts a fresh game — the
   * choice is written down first, the saved game is thrown away, and the page reloads into it.
   *
   * A reload rather than a rebuild because the composition root wires one game into a dozen
   * closures, and tearing that down by hand would be a second, quieter way of starting over.
   */
  function choosePlayerSide(side: Side): void {
    if (side === playerSide) return;
    saveSettings({ ...currentSettings(), side });
    clearGame();
    window.location.reload();
  }

  const currentSettings = () => ({
    theme: themeKey, set: setKey, coordinates: showCoordinates, side: playerSide,
  });

  const applyTheme = (key: string): void => {
    themeKey = key;
    board.setTheme(key);
    saveSettings({ ...currentSettings(), theme: key });
  };

  const declaration = createChessDeclaration({ rules, state: game, i18n, cursor: () => cursor });
  const engine = createGame({
    declaration,
    host: { doc: host, win: window, cvdHost: host.getElementById('cvd') },
    declines: { semMenuDePausa: true, semAssistenteDePad: true, semAtorDePausa: true },
    sonarPlayers: () => [{ i: 0, x: cursor.x, y: cursor.y, viz: 'normal' }],
  });

  const board = createGridMirror({
    doc: host,
    i18n,
    rules,
    state: game,
    visible: true,
    set: setKey,
    theme: themeKey,
    onActivate: (square) => onActivate(square),
    onCursor: (square) => { cursor = square; },
    resolveAction: (code) => engine.keyboard.actionOf(code, 0),
  });
  region.appendChild(board.root);
  board.setTheme(themeKey);
  // Turned round when you are black, so your own men are the ones nearest you. The rotation is on
  // the ELEMENT, not on the DOM order: the grid keeps its rows and columns, so arrow keys, the
  // reading order and every label go on meaning what they meant.
  board.root.dataset.flipped = playerSide === 'b' ? 'true' : '';

  const hud = createHud({
    doc: host,
    view: '2d',
    i18n,
    rules,
    state: game,
    difficulty: () => difficulty,
    onDifficulty: (level) => {
      difficulty = level;
      hud.refresh();
      if (game.phase() === 'thinking') { opponent.cancel(); thinking = false; askOpponent(); }
    },
    highContrast: () => paletteHigh,
    onHighContrast: (on) => {
      paletteHigh = on;
      region.dataset.contrast = on ? 'high' : '';
      // ONE state, two doors. High contrast picks the high-contrast palette and remembers what was
      // there before, so turning it off returns the board a player had chosen rather than the
      // factory one. Picking a palette by hand is the other door, below.
      if (on) {
        if (themeKey !== CONTRAST_THEME) previousTheme = themeKey;
        applyTheme(CONTRAST_THEME);
      } else {
        applyTheme(previousTheme);
      }
      hud.refresh();
    },

    themes: BOARD_THEMES.map((t) => ({ key: t.key, name: t.name })),
    theme: () => themeKey,
    onTheme: (key) => {
      applyTheme(key);
      // Choosing a palette by hand is a statement about the board, and leaving the panel in a
      // high-contrast skin while the board is not would be a lie the checkbox told.
      const contrast = key.startsWith('contrast-');
      if (paletteHigh !== contrast) {
        paletteHigh = contrast;
        region.dataset.contrast = contrast ? 'high' : '';
      }
      if (!contrast) previousTheme = key;
      hud.refresh();
    },
    vision: () => vision,
    onVision: (key) => {
      vision = key;
      region.style.filter = VIZ_FILTER[key] ?? '';
      hud.refresh();
    },
    reducedMotion: () => motionReduced,
    onReducedMotion: (on) => { motionReduced = on; hud.refresh(); },
    coordinates: () => showCoordinates,
    onCoordinates: (on) => {
      showCoordinates = on;
      region.dataset.coords = on ? 'on' : '';
      saveSettings({ ...currentSettings(), coordinates: on });
      hud.refresh();
    },
    playerSide: () => playerSide,
    onPlayerSide: choosePlayerSide,

    pieceSets: AVAILABLE_SETS.map((set) => ({ key: set.key, name: set.description })),
    pieceSet: () => setKey,
    onPieceSet: (key) => {
      setKey = key;
      board.setPieceSet(key);
      saveSettings({ ...currentSettings(), set: key });
      hud.refresh();
    },

    canTakeBack: () => !walking && game.canTakeBack(),
    canReplay: () => !walking && game.canReplay(),
    onTakeBack: () => { void walkHistory('back'); },
    onReplay: () => { void walkHistory('forward'); },
  });
  region.appendChild(hud.root);
  // Outside the panel, over the board: see `.theme-report` in the stylesheet.
  region.appendChild(hud.report);
  paletteHigh = themeKey.startsWith('contrast-');
  region.dataset.contrast = paletteHigh ? 'high' : '';
  region.dataset.coords = showCoordinates ? 'on' : '';

  const relayout = (): void => { applyLayout({ doc: host, win: window }); };
  relayout();
  window.addEventListener('resize', relayout);

  function announce(result: Activation): void {
    if (result.kind === 'selected') {
      const piece = rules.pieceAt(result.square);
      const where = toAlgebraic(result.square);
      srSay(piece
        ? `${i18n.t('a11y.selected', { piece: i18n.describePiece(piece).text, square: where })}. `
          + i18n.t('a11y.legalMoves', { count: result.targets.length })
        : i18n.t('square.empty', { square: where }));
      return;
    }
    if (result.kind === 'deselected') { srSay(i18n.t('a11y.noSelection')); return; }
    if (result.kind === 'moved') {
      srSay(moveSentence(i18n, result.move));
      if (!result.move.checkmate && result.move.check) srAlert(i18n.t('status.check'));
      return;
    }
    if (result.kind === 'illegal') {
      const piece = rules.pieceAt(result.square);
      const square = toAlgebraic(result.square);
      srSay(piece
        ? i18n.t('square.occupied', { square, piece: i18n.describePiece(piece).text })
        : i18n.t('square.empty', { square }));
    }
  }

  function announceOutcome(): void {
    const outcome = game.outcome();
    if (!outcome) return;
    if (outcome.kind === 'checkmate') {
      srAlert(i18n.t('status.checkmate', { side: i18n.t(`turn.${outcome.winner}`) }));
    } else if (outcome.kind === 'stalemate') {
      srAlert(i18n.t('status.stalemate'));
    } else {
      srAlert(i18n.t('status.draw'));
    }
  }

  function redraw(): void {
    board.refresh();
    hud.refresh();
    saveGame(rules);
  }

  function askOpponent(): void {
    if (game.phase() !== 'thinking' || thinking) return;
    thinking = true;
    srSay(i18n.t('status.thinking'));

    opponent.requestMove(rules.fen(), DIFFICULTY_DEPTH[difficulty])
      .then((reply) => {
        thinking = false;
        if (!reply || game.phase() !== 'thinking') return;
        const move = game.applyOpponentMove(reply.move.from, reply.move.to, reply.move.promotion);
        if (!move) return;
        game.animationDone();
        redraw();
        srSay(moveSentence(i18n, move));
        if (!move.checkmate && move.check) srAlert(i18n.t('status.check'));
        announceOutcome();
        // The reply is the move nobody was watching for, so it is the one that most needs to be
        // seen travelling rather than to have simply appeared somewhere else.
        void board.animate(move.from, move.to, { reducedMotion: motionReduced });
      })
      .catch((error: unknown) => {
        thinking = false;
        srAlert(i18n.t('status.engineFailed'));
        console.error('[chess] engine failed', error);
      });
  }

  function onActivate(square: Square): void {
    if (walking) return;
    cursor = square;
    const result = game.activate(square);
    if (result.kind !== 'moved') {
      redraw();
      announce(result);
      return;
    }

    const move = result.move;
    // The rules have already applied it, so the phase settles now and the travel is only the
    // picture catching up. Said before the flight, not after: a player who cannot see it should
    // not wait a third of a second to be told what happened.
    game.animationDone();
    redraw();
    announce(result);
    announceOutcome();
    void board.animate(move.from, move.to, { reducedMotion: motionReduced })
      .then(() => askOpponent());
  }

  /**
   * ========================= ONE PLY PER LEG HERE TOO =========================
   * The same shape as the projected board's walk, and for the same reason: applying both plies
   * before drawing either puts the second piece on its destination from the moment the button is
   * pressed, so it teleports and then travels. `takeBackStep` and `replayStep` exist precisely so
   * a caller can hold the clock.
   *
   * Travelling BACKWARDS is the move run in reverse — from where it landed to where it began —
   * which is the only difference between the two directions.
   */
  async function walkHistory(direction: 'back' | 'forward'): Promise<void> {
    if (walking) return;
    opponent.cancel();
    thinking = false;

    let step = direction === 'back' ? game.takeBackStep() : game.replayStep();
    if (!step) {
      srSay(i18n.t(direction === 'back' ? 'a11y.nothingToTakeBack' : 'a11y.nothingToReplay'));
      hud.refresh();
      return;
    }

    walking = true;
    try {
      while (step) {
        redraw();
        const { from, to } = step.move;
        await board.animate(
          direction === 'back' ? to : from,
          direction === 'back' ? from : to,
          { reducedMotion: motionReduced },
        );
        if (!step.more) break;
        step = direction === 'back' ? game.takeBackStep() : game.replayStep();
      }
    } finally {
      walking = false;
    }

    redraw();
    // Said at the end, because mid-walk the board belongs to whoever has just been rewound past.
    srSay(i18n.t(direction === 'back' ? 'a11y.tookBack' : 'a11y.replayed', {
      side: i18n.t(`turn.${rules.turn()}`),
    }));
    askOpponent();
  }

  askOpponent();

  if (engine.problems.length) console.warn('[chess] engine problems:', engine.problems);
  srSay(i18n.t('a11y.boardLabel'));

  if (/[?&]debug=true/.test(location.search)) {
    (window as unknown as Record<string, unknown>).__chess2d = {
      game, rules, board, hud, activate: onActivate, opponent, engine, declaration,
      setPieceSet: (key: string) => { setKey = key; board.setPieceSet(key); },
      setTheme: (key: string) => { themeKey = key; board.setTheme(key); },
    };
  }
}

// Same self-start as the 3D root: the page names this module and the module starts the game. The
// guard is what lets a test import `boot2d` and call it against a fixture instead.
if (typeof document !== 'undefined' && document.getElementById('game-region')) boot2d();
