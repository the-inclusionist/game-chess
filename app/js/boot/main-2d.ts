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
import { createStockfishClient } from '../chess/engine/stockfish-client.ts';
import { DEFAULT_ELO, STRENGTH_LADDER } from '../chess/engine/strength.ts';
import { createThinkingPanel } from '../ui/thinking.ts';
import { type MoveResult } from '../chess/rules.ts';
import {
  clear as clearGame, loadSettings, resume, save as saveGame, saveSettings,
} from '../chess/session.ts';
import { createGameState, type Activation } from '../chess/state.ts';
import { type Side, type Square, toAlgebraic } from '../chess/types.ts';
import { createI18n, preferredLocale, type I18n } from '../i18n/index.ts';
import { createGridMirror } from '../ui/grid-mirror.ts';
import { createSplash } from '../ui/splash.ts';
import { createHud, type GameMode } from '../ui/hud.ts';
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
  // Three modes rather than two sides: one player as white, one as black, or two people sharing
  // the board — which is the case the state machine already had and nothing in the panel could
  // reach.
  const mode: GameMode = loadSettings().mode ?? 'w';
  const playerSide: Side = mode === 'b' ? 'b' : 'w';
  const game = createGameState({ rules, playerSide, opponent: mode !== 'two' });
  let searching = false;
  /** A walk is in flight: the board must not accept a move played on top of it. */
  let walking = false;
  /** A hint is in flight: the button says so and a second press is refused. */
  let hinting = false;

  let cursor: Square = { x: 4, y: 6 };

  // There is no animation to reduce — a flat board places a piece where the rules put it — but the
  // switch stays in the panel because the person's preference is about the whole product, and a
  // control that vanishes between two views of one game reads as a bug.
  let motionReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let paletteHigh = window.matchMedia?.('(prefers-contrast: more)').matches ?? false;
  let vision = 'normal';
  const remembered = loadSettings();
  /**
   * ========================= A SUGGESTION IS A SETTING, NOT A QUESTION =========================
   * It was a question — press, get an answer, watch it vanish on the next redraw. Which meant it
   * vanished exactly when it was about to be used, because touching a piece redraws the board.
   *
   * So it is a switch, and `hintFen` is what makes a switch honest: the arrows describe ONE
   * position, and the moment the position is not that one any more they are retired and a fresh
   * search is asked for. Selecting a piece does not change the position, so the advice survives
   * being acted on — which was the whole complaint.
   */
  let hintsOn = remembered.hints ?? false;
  let hintFen: string | null = null;
  let showCoordinates = remembered.coordinates ?? true;
  let setKey = remembered.set ?? DEFAULT_SET;
  let themeKey = remembered.theme ?? (paletteHigh ? CONTRAST_THEME : DEFAULT_THEME);

  /**
   * ========================= CHANGING SIDES IS A NEW GAME =========================
   * There is no honest way to swap sides in the middle of one: the position, the score sheet and
   * the captured tally all belong to whoever played them. So the control starts a fresh game — the
   * choice is written down first, the saved game is thrown away, and the page reloads into it.
   *
   * A reload rather than a rebuild because the composition root wires one game into a dozen
   * closures, and tearing that down by hand would be a second, quieter way of starting over.
   */
  /** Takes the advice off the board. Its own function because three paths need exactly this. */
  function clearHints(): void {
    hintFen = null;
    board.setHints([]);
  }

  /** Draws the suggested moves as arrows and says them. Retired when the position moves on. */
  function showHint(moves: readonly { from: Square; to: Square }[]): void {
    board.setHints(moves.map((m) => ({ from: m.from, to: m.to })));
    const say = (m: { from: Square; to: Square }): string =>
      `${toAlgebraic(m.from)} ${toAlgebraic(m.to)}`;
    srSay(moves.length > 1
      ? i18n.t('a11y.hintMany', { move: say(moves[0]), others: moves.slice(1).map(say).join(', ') })
      : i18n.t('a11y.hintOne', { move: say(moves[0]) }));
  }

  /**
   * ========================= A HINT IS THE SAME ENGINE, ASKED DIFFERENTLY =========================
   * It goes through the same client and the same id matching as the opponent's own search, which
   * is what stops a hint asked for and then abandoned from arriving later and marking squares in a
   * position that has moved on.
   *
   * ⚠️ And what it says is carefully limited. "The engine would play this, and rates these the
   * same" is a fact about a three-ply negamax with a material-and-placement evaluator — not about
   * chess. The wording says "for it", because a child told "these are equal" would have been told
   * something nobody knows.
   */
  /**
   * Retires advice that no longer describes the position, and asks for more when the switch is on.
   * Called from every path that redraws, which is cheap: the `hintFen` guard means a selection,
   * a theme change or a window resize all fall straight through.
   */
  function refreshHints(): void {
    const fen = rules.fen();
    if (hintFen !== null && hintFen !== fen) clearHints();
    if (!hintsOn || hinting || game.phase() !== 'idle' || hintFen === fen) return;
    void askHint();
  }

  async function askHint(): Promise<void> {
    if (hinting || game.phase() !== 'idle') return;
    hinting = true;
    thinking.setBusy(true);
    hud.refresh();
    srSay(i18n.t('a11y.hintAsked'));
    try {
      const hint = await opponent.requestHint(rules.fen());
      if (!hint) { srSay(i18n.t('a11y.hintNone')); return; }
      hintFen = rules.fen();
      showHint(hint.ties.length ? hint.ties : [hint.move]);
    } catch {
      srSay(i18n.t('status.engineFailed'));
    } finally {
      hinting = false;
      thinking.setBusy(false);
      hud.refresh();
    }
  }

  function chooseMode(next: GameMode): void {
    if (next === mode) return;
    saveSettings({ ...currentSettings(), mode: next });
    clearGame();
    window.location.reload();
  }

  const currentSettings = () => ({
    theme: themeKey, set: setKey, coordinates: showCoordinates, mode, elo,
  });

  const applyTheme = (key: string): void => {
    themeKey = key;
    board.setTheme(key);
    saveSettings({ ...currentSettings(), theme: key });
  };

  // Under the board, because that is what it is about — and outside the panel, which has no room
  // for four numbers that change several times a second.
  const thinking = createThinkingPanel({ doc: host, i18n });

  /**
   * ========================= ONE ENGINE, AND A RATING RATHER THAN A WORD =========================
   * There were two: a two-kilobyte negamax with one dial, depth, and Stockfish 18 lite, 6.98 MB,
   * which can be told a RATING. Only one of those can answer the question a player actually has.
   * "1400" means something to a child who has a rating; "medium" means nothing to anybody, and
   * two engines meant two ladders that could not be compared with each other.
   *
   * ⚠️ WHAT IT COST, written down rather than discovered later: there is no opponent at all until
   * 6.98 MB of WebAssembly has arrived. No offline play, no first move during the download. On a
   * school connection that is a real wait, and it is the price of the rating dial and of a hint
   * that is genuinely full strength.
   */
  let elo = remembered.elo ?? DEFAULT_ELO;

  const opponent = createStockfishClient({
    onThought: (thought) => thinking.update(thought),
  });
  opponent.setStrength(elo);

  /**
   * ========================= THE WAIT IS SHOWN, NOT HIDDEN =========================
   * The opponent is a 6.98 MB WebAssembly download now that there is only one engine. `ready()`
   * is what starts it — asking early means the download runs while the title is on screen rather
   * than when the first move is played.
   *
   * The fonts are in the race because the pieces ARE the fonts on the flat board: a board that
   * paints with fallback glyphs and reflows a second later is a board that looked wrong first.
   * `allSettled`, so a font that never arrives delays the button rather than replacing it with an
   * error about the wrong thing.
   */
  createSplash({
    doc: host,
    i18n,
    region,
    ready: Promise.allSettled([
      opponent.ready(),
      host.fonts?.ready ?? Promise.resolve(),
    ]).then((results) => {
      // The ENGINE is what START promises. A rejected font is a cosmetic problem; a rejected
      // engine means the button should say so rather than open onto a board with no opponent.
      if (results[0].status === 'rejected') throw results[0].reason;
    }),
  });

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
    mode: () => mode,
    onMode: chooseMode,

    strengths: STRENGTH_LADDER.map((rung) => ({ elo: rung.elo, name: rung.name })),
    strength: () => elo,
    onStrength: (next) => {
      elo = next;
      opponent.setStrength(next);
      saveSettings({ ...currentSettings(), elo: next });
      hud.refresh();
      // A change mid-search would otherwise be answered at the OLD rating. The client drops the
      // stale reply either way; cancelling makes the new one prompt rather than merely correct.
      if (game.phase() === 'thinking') {
        opponent.cancel();
        searching = false;
        askOpponent();
      }
    },

    // No engine in a two-player game, so nobody to ask.
    ...(mode === 'two' ? {} : {
      onHint: () => {
        hintsOn = !hintsOn;
        saveSettings({ ...currentSettings(), hints: hintsOn });
        if (!hintsOn) clearHints();
        hud.refresh();
        refreshHints();
      },
      hintsOn: () => hintsOn,
      hintBusy: () => hinting,
    }),

    // The face's own name, not an i18n key: a typeface is a proper noun.
    pieceSets: AVAILABLE_SETS.map((set) => ({ key: set.key, label: set.label })),
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
  // ⚠️ After `#stage-wrap`, not inside it. That element is a centring FLEX ROW, so a child lands
  // beside the board and squeezes it — which is exactly what happened. The panel belongs under the
  // board, and under the board is the next sibling.
  const wrap = host.getElementById('stage-wrap');
  wrap?.parentElement?.insertBefore(thinking.root, wrap.nextSibling);
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
    // ⚠️ AFTER the redraw, not instead of it. Advice that no longer describes the position is
    // retired here — and only here, by comparing positions — which is why selecting a piece no
    // longer throws it away. Selecting a piece does not change the position.
    refreshHints();
  }

  function askOpponent(): void {
    if (game.phase() !== 'thinking' || searching) return;
    searching = true;
    thinking.setBusy(true);
    srSay(i18n.t('status.thinking'));

    opponent.requestMove(rules.fen())
      .then((reply) => {
        searching = false;
        thinking.setBusy(false);
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
        searching = false;
        thinking.setBusy(false);
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
    searching = false;
    thinking.setBusy(false);

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
