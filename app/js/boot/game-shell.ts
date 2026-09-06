// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/game-shell — everything the three views do the same way, done once.
//
// ========================= WHAT THIS REPLACES =========================
// Three composition roots, 2,510 lines, and about three fifths of it the same wiring written out
// three times: the score sheet restored from storage, the state machine, the engine client, the
// reviewer, the hint switch, protected mode, the title screen, the panel's ninety-line dependency
// object, the region assembly, the announcements, the opponent, the history walk, the debug global.
//
// Duplication of that size is not a tidiness problem, and this repository has the receipts. The
// solid board answered the engine through the wrong door and dropped every reply, silently, for as
// long as it existed. Changing a palette on one page erased a choice made on another, because each
// root spread a settings object listing only the keys IT knew about. The solid board announced
// moves as raw SAN while the other two spoke sentences. Every one of those is one copy drifting
// from the others, and none of them could have happened to a single copy.
//
// ========================= ⚠️ WHAT THIS FILE MAY IMPORT =========================
// `chess/**`, `ui/**`, `i18n/**`, `declaration/**`, the engine, and the three RENDER LEAVES —
// `render/board-geometry.ts`, `render/hint-arrows.ts`, `render/palette.ts`. Those three are already
// in the flat bundle through `ui/grid-mirror.ts`, so they cost it nothing.
//
// It may NOT import a value from `render/board.ts`, `render/zdog-stage.ts`, `render/pieces/**`,
// `render/animation.ts` or `render3d/**`. Doing so puts a renderer into the flat entry, which is
// 104 KB against the projected board's 146 precisely because it never loads one — a decision made
// by measurement in `spike/2d-weight/` and stated in `vite.config.ts`. `tsc` is blind to this and
// `vitest` never bundles: nothing will tell you. The size of `dist/` will.

import { createGame } from '@the-inclusionist/engine';
import { srAlert, srSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import { VIZ_FILTER } from '@the-inclusionist/engine/render/viz-modes.js';
import { createChessDeclaration } from '../declaration/chess-declaration.ts';
import type { Suggestion } from '../chess/engine/client.ts';
import { createStockfishClient, type StockfishClient } from '../chess/engine/stockfish-client.ts';
import { DEFAULT_ELO, STRENGTH_LADDER } from '../chess/engine/strength.ts';
import type { Thought } from '../chess/engine/uci.ts';
import { STUMBLES_BEFORE_HELP } from '../chess/protection.ts';
import { isBlunder } from '../chess/review.ts';
import { createReviewer, type ReviewedMove } from '../chess/reviewer.ts';
import { loadSettings, patchSettings, resume, save as saveGame } from '../chess/session.ts';
import { createGameState } from '../chess/state.ts';
import type { MoveResult } from '../chess/rules.ts';
import { type Side, type Square, toAlgebraic } from '../chess/types.ts';
import { createI18n, preferredLocale } from '../i18n/index.ts';
import { squareIndex, type Marker } from '../render/board-geometry.ts';
import type { HintMove } from '../render/hint-arrows.ts';
import { BOARD_THEMES, CONTRAST_THEME, DEFAULT_THEME } from '../ui/board-themes.ts';
import { createBlunderBar } from '../ui/blunder-bar.ts';
import { createGridMirror } from '../ui/grid-mirror.ts';
import { createHud, type GameMode, type Hud, type ViewKind } from '../ui/hud.ts';
import { applyLayout } from '../ui/layout.ts';
import { createPlayerStrips } from '../ui/player-strip.ts';
import { createScoreboard } from '../ui/scoreboard.ts';
import { createSplash } from '../ui/splash.ts';
import { createThinkingPanel } from '../ui/thinking.ts';
import { announceActivation, announceMove, announceOutcome } from './narration.ts';
import type { BoardView, ViewFactory } from './view.ts';

export interface GameShellDeps {
  readonly host: Document;
  /** Which page this is. Drives the panel's view switcher and the debug global's name. */
  readonly kind: ViewKind;
  readonly view: ViewFactory;
  /** True on the flat page, where the accessible grid IS the board rather than a mirror of it. */
  readonly visibleMirror?: boolean;
  /** `__chess` | `__chess2d` | `__chess3d`, kept distinct because console habits are real. */
  readonly debugName: string;
  /**
   * ⚠️ THE SEAM THAT SHOULD HAVE EXISTED ALL ALONG. There is no way to reach the opponent's reply
   * path without downloading 6.98 MB of WebAssembly, which is exactly why the solid board's reply
   * path was dead for its whole life and no test noticed. Injecting the client lets a test drive
   * `askOpponent` with an answer of its own choosing.
   */
  readonly makeOpponent?: (options: { onThought(t: Thought): void }) => StockfishClient;
}

export interface GameShell {
  readonly region: HTMLElement;
  readonly i18n: ReturnType<typeof createI18n>;
  readonly rules: ReturnType<typeof resume>;
  readonly game: ReturnType<typeof createGameState>;
  readonly mirror: ReturnType<typeof createGridMirror>;
  readonly hud: Hud;
  readonly view: BoardView;
  readonly opponent: StockfishClient;
  activate(square: Square): void;
  walkHistory(direction: 'back' | 'forward'): Promise<void>;
  askOpponent(): void;
}

export function createGameShell(deps: GameShellDeps): GameShell {
  const host = deps.host;
  const region = host.getElementById('game-region');
  if (!region) throw new Error('#game-region is required (engine MARCACAO_EXIGIDA)');

  const i18n = createI18n(preferredLocale(navigator.language));
  host.documentElement.lang = i18n.bcp47();

  // ========================= THE GAME SURVIVES A CHANGE OF VIEW =========================
  // The three views are three pages, so a navigation throws away every object in memory. The score
  // sheet is written to the tab's own storage after anything that changes it and read back here,
  // which is why switching from 2D to 2.5D continues the game rather than starting one.
  const rules = resume();
  const remembered = loadSettings();
  // Three modes rather than two sides: one player as white, one as black, or two people sharing
  // the board — the case the state machine already had and nothing in the panel could reach.
  const mode: GameMode = remembered.mode ?? 'w';
  const playerSide: Side = mode === 'b' ? 'b' : 'w';
  const game = createGameState({ rules, playerSide, opponent: mode !== 'two' });

  let searching = false;
  /** A walk is in flight: the board must not accept a move played on top of it. */
  let walking = false;
  /** A hint is in flight: the button says so and a second press is refused. */
  let hinting = false;
  let cursor: Square = { x: 4, y: 6 };

  let motionReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let paletteHigh = window.matchMedia?.('(prefers-contrast: more)').matches ?? false;
  let vision = 'normal';
  let themeKey = remembered.theme ?? (paletteHigh ? CONTRAST_THEME : DEFAULT_THEME);

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
  let hinted: readonly HintMove[] = [];

  /**
   * ========================= PROTECTED MODE =========================
   * The engine watches the player's own moves and stops the game when one throws it away. Not a
   * difficulty setting — it changes nothing about how the opponent plays — but a teaching aid: the
   * moment a blunder is worth talking about is while the position it ruined is still on the board
   * and the reason is still in the player's head.
   *
   * ⚠️ THE OPPONENT WAITS. A warning that arrived after the reply had been played would be about a
   * position two plies old, and taking the move back would mean unpicking someone else's move as
   * well. So `askOpponent` holds while a verdict on the player's last move is outstanding.
   */
  let protectedOn = remembered.protect ?? false;
  let blunderHeld: ReviewedMove | null = null;
  let stumbles = 0;
  /**
   * ⚠️ The PLY, not the position. Keying on the resulting FEN looked equivalent and was exactly
   * backwards: two different blunders from the same position produce two different positions, so
   * the counter reset on every attempt and never reached three.
   */
  let stumbleAt = -1;

  const prefs = {
    remembered,
    save: (patch: Parameters<typeof patchSettings>[0]) => { patchSettings(patch); },
  };

  // Under the board, because that is what it is about — and outside the panel, which has no room
  // for four numbers that change several times a second.
  const thinking = createThinkingPanel({ doc: host, i18n });
  /**
   * Under the board rather than over it: a player being told their move gave the game away has to
   * be able to LOOK at the position while they decide. See `ui/blunder-bar.ts`.
   */
  const blunderBar = createBlunderBar({
    doc: host, i18n, onAnswer: (takeBack) => { answerBlunder(takeBack); },
  });

  /**
   * ========================= ONE ENGINE, AND A RATING RATHER THAN A WORD =========================
   * "1400" means something to a child who has a rating; "medium" means nothing to anybody.
   *
   * ⚠️ WHAT IT COST: there is no opponent at all until 6.98 MB of WebAssembly has arrived. No
   * offline play, no first move during the download. On a school connection that is a real wait,
   * and it is the price of the rating dial and of a hint that is genuinely full strength.
   */
  let elo = remembered.elo ?? DEFAULT_ELO;
  const opponent = (deps.makeOpponent ?? createStockfishClient)({
    onThought: (thought: Thought) => thinking.update(thought),
  });
  opponent.setStrength(elo);

  createSplash({
    doc: host,
    i18n,
    region,
    ready: Promise.allSettled([
      opponent.ready(),
      host.fonts?.ready ?? Promise.resolve(),
    ]).then((results) => {
      // The ENGINE is what START promises. A rejected font is cosmetic; a rejected engine means
      // the button should say so rather than open onto a board with no opponent.
      if (results[0].status === 'rejected') throw results[0].reason;
    }),
  });

  /**
   * One search per ply, feeding three things at once: the advantage readout, the marks on the
   * score sheet, and protected mode. See `chess/reviewer.ts` for why one is enough.
   */
  const reviewer = createReviewer({
    rules,
    engine: opponent,
    onChange: () => {
      scoreboard.refresh();
      players.refresh();
      hud.refresh();
      // The reviewer is also a clock: protected mode holds the opponent until a verdict lands,
      // and this is the tick that lets it go again.
      askOpponent();
    },
    onVerdict: (entry) => { onVerdict(entry); },
  });

  const players = createPlayerStrips({
    doc: host, i18n, rules,
    evaluation: () => reviewer.evaluation(),
    mistakes: (side) => reviewer.mistakes(side),
  });

  const scoreboard = createScoreboard({
    doc: host, i18n, rules,
    evaluation: () => reviewer.evaluation(),
    blunders: (side) => reviewer.blunders(side),
  });

  const declaration = createChessDeclaration({ rules, state: game, i18n, cursor: () => cursor });
  const engine = createGame({
    declaration,
    host: { doc: host, win: window, cvdHost: host.getElementById('cvd') },
    declines: { semMenuDePausa: true, semAssistenteDePad: true, semAtorDePausa: true },
    sonarPlayers: () => [{ i: 0, x: cursor.x, y: cursor.y, viz: 'normal' }],
  });

  /**
   * ⚠️ THE SHELL BUILDS THE MIRROR, not the view, because all three pages have one. On the flat
   * page it IS the board with its `sr-only` taken off; on the other two it is the accessible board
   * behind an `aria-hidden` canvas. One object, two jobs, and the difference is a boolean.
   */
  const mirror = createGridMirror({
    doc: host,
    i18n,
    rules,
    state: game,
    ...(deps.visibleMirror ? { visible: true, set: remembered.set, theme: themeKey } : {}),
    onActivate: (square) => onActivate(square),
    onCursor: (square) => { cursor = square; },
    resolveAction: (code) => engine.keyboard.actionOf(code, 0),
  });

  const view = deps.view({
    doc: host,
    region,
    i18n,
    rules,
    state: game,
    mirror,
    playerSide,
    prefs,
    reducedMotion: () => motionReduced,
    activate: (square) => onActivate(square),
    keyIntent: (code) => engine.keyboard.actionOf(code, 0),
  });

  const hud = createHud({
    doc: host,
    view: deps.kind,
    i18n,
    rules,
    state: game,

    // ⚠️ A maintainer's instrument, behind `?debug=true`.
    debug: /[?&]debug=true/.test(location.search),
    themes: BOARD_THEMES.map((t) => ({ key: t.key, name: t.name })),
    theme: () => themeKey,
    onTheme: (key) => {
      themeKey = key;
      view.applyTheme(key);
      prefs.save({ theme: key });
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
    mode: () => mode,
    onMode: chooseMode,

    markAt: (ply) => reviewer.markAt(ply),
    scoreboard: scoreboard.root,
    ...(mode === 'two' ? {} : {
      protectedOn: () => protectedOn,
      onProtected: (on) => {
        protectedOn = on;
        if (!on) { blunderHeld = null; blunderBar.show(null); }
        prefs.save({ protect: on });
        hud.refresh();
        askOpponent();
      },
    }),
    strengths: STRENGTH_LADDER.map((rung) => ({ elo: rung.elo, name: rung.name })),
    strength: () => elo,
    onStrength: (next) => {
      elo = next;
      opponent.setStrength(next);
      prefs.save({ elo: next });
      hud.refresh();
      // A change mid-search would otherwise be answered at the OLD rating.
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
        prefs.save({ hints: hintsOn });
        if (!hintsOn) clearHints();
        hud.refresh();
        refreshHints();
      },
      hintsOn: () => hintsOn,
      hintBusy: () => hinting,
    }),

    ...view.hudControls,

    canTakeBack: () => !walking && game.canTakeBack(),
    canReplay: () => !walking && game.canReplay(),
    onTakeBack: () => { void walkHistory('back'); },
    onReplay: () => { void walkHistory('forward'); },
  });

  region.appendChild(players.root);
  // Outside the panel, over the board: see `.theme-report` in the stylesheet.
  region.appendChild(hud.report);
  region.appendChild(hud.root);
  // ⚠️ After `#stage-wrap`, not inside it. That element is a centring FLEX ROW, so a child lands
  // beside the board and squeezes it. The panel belongs under the board, and under the board is
  // the next sibling.
  const wrap = host.getElementById('stage-wrap');
  if (!wrap?.parentElement) {
    // Not fatal, but the thinking panel and the blunder bar would never enter the document, and
    // nothing else would say so. The engine keeps a `problems` list for exactly this shape of gap.
    console.warn('[chess] #stage-wrap has no parent: the thinking panel has nowhere to go');
  }
  wrap?.parentElement?.insertBefore(thinking.root, wrap.nextSibling);
  // Above the thinking panel: it is the thing being waited on, not commentary.
  wrap?.parentElement?.insertBefore(blunderBar.root, thinking.root);
  paletteHigh = themeKey.startsWith('contrast-');
  region.dataset.contrast = paletteHigh ? 'high' : '';

  const relayout = (): void => { applyLayout({ doc: host, win: window }); view.relayout(); };
  relayout();
  window.addEventListener('resize', relayout);

  /* ---------- the loops everything else hangs off ---------- */

  /**
   * A move has been judged. Almost always this does nothing visible — most moves are ordinary —
   * and the whole of protected mode is the exception.
   */
  function onVerdict(entry: ReviewedMove): void {
    if (!protectedOn || !isBlunder(entry.mark) || mode === 'two') return;
    if (entry.side !== playerSide) return;
    if (entry.ply !== rules.history().length - 1) return;   // already answered for, or replayed

    blunderHeld = entry;
    // ⚠️ Counted per POSITION, not per game. Three blunders spread over forty moves is somebody
    // learning; three in a row from the same position is somebody stuck.
    if (stumbleAt !== entry.ply) { stumbleAt = entry.ply; stumbles = 0; }
    stumbles++;

    blunderBar.show({ mark: entry.mark ?? '', lost: entry.lost });
    if (stumbles >= STUMBLES_BEFORE_HELP && !hintsOn) {
      hintsOn = true;
      prefs.save({ hints: hintsOn });
      srSay(i18n.t('protected.teaching'));
      // Turning the switch on is not enough: the arrows are drawn when a suggestion arrives, and
      // nothing else is going to ask for one — the position has not changed and will not until
      // the player answers the warning that is on screen because of it.
      refreshHints();
    }
    hud.refresh();
  }

  /** The player chose. Either way the game moves on — this mode never leaves anybody stuck. */
  function answerBlunder(takeBack: boolean): void {
    if (!blunderHeld) return;
    blunderHeld = null;
    blunderBar.show(null);
    if (takeBack) {
      srSay(i18n.t('protected.tookBack'));
      void walkHistory('back');
    } else {
      srSay(i18n.t('protected.kept'));
      hud.refresh();
      askOpponent();
    }
  }

  function clearHints(): void {
    hintFen = null;
    hinted = [];
    syncMarks();
  }

  /** Draws the suggested moves as arrows and says them. Retired when the position moves on. */
  function showHint(moves: readonly Suggestion[]): void {
    hinted = moves.map((m) => ({ from: m.move.from, to: m.move.to, behind: m.behind }));
    syncMarks();
    const say = (m: Suggestion): string => `${toAlgebraic(m.move.from)} ${toAlgebraic(m.move.to)}`;
    srSay(moves.length > 1
      ? i18n.t('a11y.hintMany', { move: say(moves[0]), others: moves.slice(1).map(say).join(', ') })
      : i18n.t('a11y.hintOne', { move: say(moves[0]) }));
  }

  /**
   * Retires advice that no longer describes the position, and asks for more when the switch is on.
   * Called from every path that redraws, which is cheap: the `hintFen` guard means a selection, a
   * theme change or a window resize all fall straight through.
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
      showHint(hint.ties.length ? hint.ties : [{ move: hint.move, behind: 0 }]);
    } catch {
      srSay(i18n.t('status.engineFailed'));
    } finally {
      hinting = false;
      thinking.setBusy(false);
      hud.refresh();
    }
  }

  /**
   * ========================= CHANGING SIDES KEEPS THE GAME =========================
   * ⚠️ IT USED TO THROW THE GAME AWAY, on the argument that the position and the score sheet
   * belong to whoever played them. That argument is about who gets CREDIT for a game, and nobody
   * pressing this button is asking about credit — they are asking to swap seats.
   *
   * The reload remains, because the composition root wires one game into a dozen closures and
   * rebuilding those by hand would be a second, quieter way of getting it wrong. And it flags
   * itself as an in-app move, so the title screen — which exists to cover the engine's download
   * and nothing else — stays out of the way.
   */
  function chooseMode(next: GameMode): void {
    if (next === mode) return;
    prefs.save({ mode: next });
    try { sessionStorage.setItem('incl_chess_switching', '1'); } catch { /* private mode */ }
    window.location.reload();
  }

  /** The markers the game itself asks for, rebuilt from the position every time. */
  function syncMarks(): void {
    const markers = new Map<number, Marker>();
    const selected = game.selection();
    if (selected) {
      markers.set(squareIndex(selected), 'selected');
      for (const target of game.legalTargets()) {
        // Shape carries the meaning, not colour: a dot on an empty square, a ring on a capture.
        markers.set(squareIndex(target), rules.pieceAt(target) ? 'capture' : 'move');
      }
    }
    const check = game.kingInCheck();
    if (check) markers.set(squareIndex(check), 'check');
    // The keyboard cursor last, and only where nothing else already speaks for the square.
    const at = squareIndex(cursor);
    if (!markers.has(at)) markers.set(at, 'cursor');
    view.drawMarks(markers, hinted);
  }

  /**
   * Everything that has to happen when the position has changed.
   *
   * ⚠️ THE MIRROR IS REFRESHED FIRST, and even mid-flight. A screen reader wants the landed
   * position NOW, not a third of a second after everyone else got it. The picture is what lags.
   */
  function syncPosition(hidden: readonly Square[] = [], travelling: MoveResult['piece'] | null = null): void {
    mirror.refresh();
    view.drawPosition(hidden, travelling);
    syncMarks();
    hud.refresh();
    // The one place the score sheet is written down, and the one place the engine is told the
    // game has moved: one search per ply feeds the readout, the marks and protected mode.
    saveGame(rules);
    players.refresh();
    reviewer.observe();
    refreshHints();
  }

  /**
   * Flies a piece and makes sure the board is whole again afterwards, whatever happened.
   *
   * ⚠️ A FLIGHT THAT FAILS MUST STILL LAND. `travel` is the VIEW's promise, and a view can be
   * torn down, disposed or cancelled while a piece is in the air. `syncPosition` has already told
   * it to withhold that piece from the static drawing — so without this the piece stays withheld
   * for the rest of the game, and all anyone gets is an unhandled rejection in the console with
   * nothing on screen to connect it to the hole in the board.
   */
  function fly(from: Square, to: Square): Promise<void> {
    return view.travel(from, to)
      .catch((error: unknown) => { console.error('[chess] a move could not be animated', error); })
      .then(() => { syncPosition(); });
  }

  function askOpponent(): void {
    if (game.phase() !== 'thinking' || searching) return;
    // ⚠️ HELD. Protected mode's whole value is that the warning arrives while the position it
    // ruined is still on the board. So the opponent waits for TWO things: an unanswered warning,
    // and a verdict that has not landed yet. `reviewer.onChange` is what tries again.
    if (blunderHeld) return;
    if (protectedOn && mode !== 'two' && !reviewer.judged(rules.history().length - 1)) return;

    searching = true;
    thinking.setBusy(true);
    srSay(i18n.t('status.thinking'));

    opponent.requestMove(rules.fen())
      .then((reply) => {
        searching = false;
        thinking.setBusy(false);
        // The position may have moved on while the worker was busy — a restart, a difficulty
        // change. The state machine refuses the move in that case, and so does this guard.
        if (!reply || game.phase() !== 'thinking') return;
        // ⚠️ `applyOpponentMove`, NOT two `activate` calls. `activate` answers every call in the
        // `thinking` phase with `ignored/busy`, which is the whole point of the phase — the solid
        // board used to pick the piece up and put it down like a player, and dropped every reply.
        const move = game.applyOpponentMove(reply.move.from, reply.move.to, reply.move.promotion);
        if (!move) return;
        game.animationDone();
        syncPosition([move.to], move.piece);
        announceMove(i18n, move);
        announceOutcome(i18n, game.outcome());
        // The reply is the move nobody was watching for, so it is the one that most needs to be
        // seen travelling rather than to have simply appeared somewhere else.
        void fly(move.from, move.to);
      })
      .catch((error: unknown) => {
        searching = false;
        thinking.setBusy(false);
        // Saying nothing would leave the game on "thinking" for good, and a child waiting for a
        // reply cannot tell that apart from a game that is broken.
        srAlert(i18n.t('status.engineFailed'));
        console.error('[chess] engine failed', error);
      });
  }

  function onActivate(square: Square): void {
    if (walking) return;
    cursor = square;
    const result = game.activate(square);
    if (result.kind !== 'moved') {
      syncPosition();
      announceActivation(i18n, rules, result);
      return;
    }

    const move = result.move;
    // The rules have already applied it, so the phase settles now and the travel is only the
    // picture catching up. Said before the flight, not after: a player who cannot see it should
    // not wait a third of a second to be told what happened.
    game.animationDone();
    syncPosition([move.to], move.piece);
    announceActivation(i18n, rules, result);
    announceOutcome(i18n, game.outcome());
    void fly(move.from, move.to).then(() => { askOpponent(); });
  }

  /**
   * ========================= ONE PLY PER LEG =========================
   * Applying both plies before drawing either puts the second piece on its destination from the
   * moment the button is pressed, so it teleports and then travels. `takeBackStep` and
   * `replayStep` exist precisely so a caller can hold the clock.
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
        const move = step.move;
        /*
         * ⚠️ `hidden` IS A LIST, NOT A SQUARE. Taking a capture back restores TWO pieces at once —
         * the mover coming home and the piece it took — and both are already on the board as far
         * as the rules are concerned. Withholding only one draws the captured piece underneath a
         * piece that is still flying away from it.
         */
        const leg = direction === 'back'
          ? {
            from: move.to,
            to: move.from,
            hidden: move.captured ? [move.from, capturedSquare(move)] : [move.from],
          }
          : { from: move.from, to: move.to, hidden: [move.to] };

        syncPosition(leg.hidden, move.piece);
        /*
         * MARK CAUGHT, NOT PROPAGATED. A rejected leg ends the walk — there is no sense flying the
         * next ply through a view that has just said it cannot draw — but it must not escape this
         * function: the caller is a button handler that discards the promise, so a throw here
         * would be an unhandled rejection AND would skip the announcement below.
         */
        let flew = true;
        await view.travel(leg.from, leg.to)
          .catch((error: unknown) => {
            flew = false;
            console.error('[chess] the walk could not be animated', error);
          });
        if (!flew || !step.more) break;
        step = direction === 'back' ? game.takeBackStep() : game.replayStep();
      }
    } finally {
      // ⚠️ IN A `finally`. A `travel` that rejects — a disposed scene, a cancelled animation —
      // would otherwise leave this true for the rest of the game, and take-back and replay would
      // stay dead with nothing on screen or in the console to say why.
      walking = false;
    }

    syncPosition();
    // Said at the end, because mid-walk the board belongs to whoever has just been rewound past.
    srSay(i18n.t(direction === 'back' ? 'a11y.tookBack' : 'a11y.replayed', {
      side: i18n.t(`turn.${rules.turn()}`),
    }));
    askOpponent();
  }

  /** Where the piece a move captured was standing. Not `move.to` when it was taken en passant. */
  function capturedSquare(move: MoveResult): Square {
    if (!move.enPassant) return move.to;
    return { x: move.to.x, y: move.from.y };
  }

  // ⚠️ ONCE, BEFORE ANYTHING HAPPENS. This used to be reached only from an event handler in the
  // flat root, so on a board that had not been touched yet — every restored game, and every
  // switch between views — the reviewer was never told to look. The advantage readout sat at a
  // dash and the score sheet carried no marks until the player happened to move.
  syncPosition();
  askOpponent();

  if (engine.problems.length) console.warn('[chess] engine problems:', engine.problems);
  srSay(i18n.t('a11y.boardLabel'));

  if (/[?&]debug=true/.test(location.search)) {
    (window as unknown as Record<string, unknown>)[deps.debugName] = {
      game, rules, mirror, hud, opponent, engine, declaration,
      activate: onActivate, takeBack: () => walkHistory('back'),
      replay: () => walkHistory('forward'), askOpponent,
      ...(view.debug?.() ?? {}),
    };
  }

  return {
    region, i18n, rules, game, mirror, hud, view, opponent,
    activate: onActivate, walkHistory, askOpponent,
  };
}
