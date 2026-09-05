// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/main — the composition root. The only module that knows PixiJS and the DOM concretely.
//
// Wired: the engine's accessibility stack, real chess rules, the state machine, the Zdog board and
// pieces, the frame clock, the camera, picking, and move animation.
// Not yet, by plan: the opponent (step 6), the DOM grid mirror (step 7), the HUD (step 8).
//
// Everything a player does goes through `game.activate(square)` — pointer and keyboard alike — and
// everything the game says goes through `announce()`. Keeping those two funnels narrow is what will
// let the grid mirror behave identically to a click when it arrives.

import { createGame } from '@the-inclusionist/engine';
import { srAlert, srSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import { VIZ_FILTER } from '@the-inclusionist/engine/render/viz-modes.js';
import { createChessDeclaration } from '../declaration/chess-declaration.ts';
import { createCoordinates } from '../ui/coordinates.ts';
import { createGridMirror } from '../ui/grid-mirror.ts';
import { createReviewer, type ReviewedMove } from '../chess/reviewer.ts';
import { isBlunder } from '../chess/review.ts';
import { createScoreboard } from '../ui/scoreboard.ts';
import { STUMBLES_BEFORE_HELP } from '../chess/protection.ts';
import { createBlunderBar } from '../ui/blunder-bar.ts';
import type { Suggestion } from '../chess/engine/client.ts';
import type { HintMove } from '../render/hint-arrows.ts';
import { createSplash } from '../ui/splash.ts';
import { createHud, type GameMode } from '../ui/hud.ts';
import { applyLayout } from '../ui/layout.ts';
import { createStockfishClient } from '../chess/engine/stockfish-client.ts';
import { DEFAULT_ELO, STRENGTH_LADDER } from '../chess/engine/strength.ts';
import { createThinkingPanel } from '../ui/thinking.ts';
import { type MoveResult } from '../chess/rules.ts';
import {
  clear as clearGame, loadSettings, resume, save as saveGame, saveSettings,
} from '../chess/session.ts';
import { createGameState, type Activation, type HistoryStep } from '../chess/state.ts';
import { sameSquare, type Piece, type Side, type Square, toAlgebraic } from '../chess/types.ts';
import { createI18n, preferredLocale, type I18n } from '../i18n/index.ts';
import { createMoveAnimation, type MoveAnimation } from '../render/animation.ts';
import { createBoard, type Marker } from '../render/board.ts';
import { squareFromIndex, squareIndex } from '../render/board-geometry.ts';
import { createCamera, ROTATE_HOLD_MS } from '../render/camera.ts';
import { buildPiece, createPiecesLayer } from '../render/pieces/index.ts';
import { PIECE_SPECS } from '../render/pieces/geometry.ts';
import { DARK_PIECES, LIGHT_PIECES } from '../render/palette.ts';
import { pickTopmost, toIllustrationSpace } from '../render/picking.ts';
import { projectedPalette } from '../render/palette.ts';
import { BOARD_THEMES, boardTheme, DEFAULT_THEME } from '../ui/board-themes.ts';
import { createFrameTicker } from '../render/frame-ticker.ts';
import { LOGICAL_W } from '../render/resolution.ts';
import { CAMERA, createZdogStage } from '../render/zdog-stage.ts';

/** What the move sounds like. The notation is exact; this is what a person actually hears. */
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

export function boot(host: Document = document): void {
  const region = host.getElementById('game-region');
  if (!region) throw new Error('#game-region is required (engine MARCACAO_EXIGIDA)');
  /** The same element, narrowed once, for the hoisted functions below. */
  const area: HTMLElement = region;

  const i18n = createI18n(preferredLocale(navigator.language));
  host.documentElement.lang = i18n.bcp47();

  // Seeded from the system preference, then the person's own switch wins. The engine's
  // ui/settings-motion is per ELEMENT — parallax, walk, breath — which is the right shape for a
  // platformer and has nothing to map onto here: this game moves exactly one thing, a piece
  // crossing the board.
  let motionReduced =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const reducedMotion = (): boolean => motionReduced;

  // ========================= THE GAME SURVIVES A CHANGE OF VIEW =========================
  // The three views are three pages, so a navigation throws away every object in memory. The score
  // sheet is written to the tab's own storage after anything that changes it and read back here,
  // which is why switching from 2D to 2.5D continues the game rather than starting one.
  const rules = resume();
  const mode: GameMode = loadSettings().mode ?? 'w';
  const playerSide: Side = mode === 'b' ? 'b' : 'w';
  const game = createGameState({ rules, playerSide, opponent: mode !== 'two' });
  let searching = false;

  // The keyboard cursor. It lives here rather than inside the grid mirror because the DECLARATION
  // needs it (field 4, focus) and the mirror needs the declaration's game — a cycle broken by
  // keeping the value in the composition root, where cycles are allowed to be resolved.
  let cursor: Square = { x: 4, y: 6 };

  // Under the board, because that is what it is about — and outside the panel, which has no room
  // for four numbers that change several times a second.
  const thinking = createThinkingPanel({ doc: host, i18n });
  /**
   * Under the board rather than over it: a player being told their move gave the game away has to
   * be able to LOOK at the position while they decide. See `ui/blunder-bar.ts`.
   */
  const blunderBar = createBlunderBar({
    doc: host,
    i18n,
    onAnswer: (takeBack) => { answerBlunder(takeBack); },
  });




  const declaration = createChessDeclaration({ rules, state: game, i18n, cursor: () => cursor });

  const engine = createGame({
    declaration,
    host: { doc: host, win: window, cvdHost: host.getElementById('cvd') },
    declines: { semMenuDePausa: true, semAssistenteDePad: true, semAtorDePausa: true },
    // The sonar needs to know WHERE the listener is standing. On a grid that is simply the
    // cursor's square, so the engine can measure to the targets the declaration hands it — in
    // king's steps, which is the unit the player already counts in.
    sonarPlayers: () => [{ i: 0, x: cursor.x, y: cursor.y, viz: 'normal' }],
  });

  /* ---------- render ---------- */

  // The system asks first. `prefers-contrast: more` is a real preference a person has already
  // expressed to their OS; making them find a checkbox to repeat it would be the wrong default.
  // ========================= THE SAME NAMED PALETTES AS THE FLAT BOARD =========================
  // Six themes, shared between the views, so a player who picks one keeps it when they switch.
  // Each carries its own shading for this view — derived by one rule from the flat fill, except
  // for the three that were solved numerically, which carry their measured answers. See
  // `projectedPalette` in `render/palette.ts`.
  //
  // ⚠️ High contrast selects `contrast-solid` HERE and `contrast-flat` on the flat board, and that
  // is the whole reason a theme carries piece inks: the two have the same squares and different
  // pieces, because a solid whose ink is mostly STROKE needs a different answer from a glyph.
  const CONTRAST_HERE = 'contrast-solid';
  const remembered = loadSettings();

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
   * One search per ply, feeding three things at once: the advantage readout, the marks on the
   * score sheet, and protected mode. See `chess/reviewer.ts` for why one is enough.
   */
  const reviewer = createReviewer({
    rules,
    engine: opponent,
    onChange: () => {
      scoreboard.refresh();
      hud.refresh();
      // The reviewer is also a clock: protected mode holds the opponent until a verdict lands,
      // and this is the tick that lets it go again.
      askOpponent();
    },
    onVerdict: (entry) => { onVerdict(entry); },
  });

  const scoreboard = createScoreboard({
    doc: host,
    i18n,
    rules,
    evaluation: () => reviewer.evaluation(),
    blunders: (side) => reviewer.blunders(side),
  });


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
  const systemContrast = window.matchMedia?.('(prefers-contrast: more)').matches ?? false;
  let themeKey = remembered.theme ?? (systemContrast ? CONTRAST_HERE : DEFAULT_THEME);
  let vision = 'normal';
  let outlined = true;
  let showCoordinates = loadSettings().coordinates ?? true;

  // Real DOM text over the board: Zdog has no text primitive, and `ui/coordinates` explains why
  // that turns out to be a gain. Created before the HUD so the panel stacks above it.
  const coordinates = createCoordinates({ doc: host, visible: showCoordinates });

  const stage = createZdogStage();
  const boardView = createBoard(stage.root, projectedPalette(boardTheme(themeKey)));
  const pieces = createPiecesLayer(stage.root, projectedPalette(boardTheme(themeKey)), outlined);
  // Half a turn when you are black, so your own men are nearest you. Zdog projects the whole graph
  // through the illustration's rotation, so this is the entire flip — no second board, no mirrored
  // geometry, and picking keeps reading the same projected corners it always did.
  const camera = createCamera(playerSide === 'b'
    ? { pitch: CAMERA.pitch, yaw: Math.PI }
    : { pitch: CAMERA.pitch, yaw: CAMERA.yaw });

  // ========================= NO COMPOSITOR =========================
  // Zdog's canvas goes straight into the document. It used to be uploaded to a PixiJS texture and
  // drawn as a sprite, which cost 465 KB raw and 138 KB gzipped — measured — to draw one canvas
  // into another. See `render/frame-ticker.ts` for the whole reckoning.
  const canvas = stage.canvas;
  const ticker = createFrameTicker();

  canvas.id = 'board-canvas';
  // Hidden from the screen reader ON PURPOSE — the same pillar the engine applies to its own
  // canvas: the game speaks through the DOM. The grid mirror at step 7 carries the board.
  canvas.setAttribute('aria-hidden', 'true');
  region.appendChild(canvas);

  // The board as the screen reader sees it. Inside #game-region so the engine's keyboard rules
  // and focus styling apply, and BEFORE the canvas in the DOM so it is what a reader meets first.
  const mirror = createGridMirror({
    doc: host,
    i18n,
    rules,
    state: game,
    onActivate: (square) => onActivate(square),
    onCursor: (square) => { cursor = square; syncMarkers(); },
    // Intent, not keycode — the engine's own rule (ADR-0033). The default solo scheme already
    // carries the arrows AND WASD, and a player who remaps them in the engine's settings gets
    // the board walked with the keys they can actually reach.
    resolveAction: (code) => engine.keyboard.actionOf(code, 0),
  });
  region.insertBefore(mirror.root, canvas);

  /**
   * One leg of a walk through the score sheet, in SCREEN terms rather than chess terms: which
   * piece travels, between which two squares, and which squares must stay empty while it does.
   *
   * `hide` is a list rather than a square because taking a capture back restores TWO pieces at
   * once — the one coming home and the one it had taken. Both are already on the board as far as
   * the rules are concerned, so both have to be held back until the traveller lands, or the
   * captured piece would appear underneath the piece that is still flying away from it.
   */
  interface Walk {
    readonly piece: Piece;
    readonly from: Square;
    readonly to: Square;
    readonly hide: readonly Square[];
  }

  let walking: Walk | null = null;
  /** Which way the walk is going, and whether the unit has another ply to move after this leg. */
  let walkDirection: 'back' | 'forward' = 'back';
  let walkMore = false;
  /** A hint is in flight, and the squares it last pointed at. */
  let hinting = false;
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
  /**
   * ========================= PROTECTED MODE =========================
   * The engine watches the player's own moves and stops the game when one throws it away. Not a
   * difficulty setting — it changes nothing about how the opponent plays — but a teaching aid:
   * the moment a blunder is worth talking about is while the position it ruined is still on the
   * board and the reason is still in the player's head.
   *
   * ⚠️ THE OPPONENT WAITS. A warning that arrived after the reply had been played would be about
   * a position two plies old, and taking the move back would mean unpicking someone else's move
   * as well. So `askOpponent` holds while a verdict on the player's last move is outstanding —
   * which costs one review, and only in this mode.
   */
  let protectedOn = remembered.protect ?? false;
  /** A blunder is on the board and the player has not yet said what to do about it. */
  let blunderHeld: ReviewedMove | null = null;
  /**
   * Blunders played from THIS position, one after another. Three is the point at which being told
   * "that was a mistake" has plainly stopped working, and the game starts showing the answer
   * instead of asking for it again.
   */
  let stumbles = 0;
  /**
   * ⚠️ The PLY, not the position. Keying on the resulting FEN looked equivalent and was exactly
   * backwards: two different blunders from the same position produce two different positions, so
   * the counter reset on every attempt and never reached three. The ply is what stays the same
   * when a move is taken back and another one tried.
   */
  let stumbleAt = -1;


  let hinted: readonly HintMove[] = [];

  // ⚠️ Both declared ABOVE `createHud` on purpose. `createHud` calls its own `refresh()` while it
  // is still being built, `refresh` asks `canTakeBack`, and that reads `walking` — a `let` below
  // this point would be in its temporal dead zone at exactly that moment. The boot throws, in the
  // bundle only, under a minified name, with every test still green, because no test builds the
  // composition root. It cost a browser reload to find and would have cost a release.

  // The panel lives in the 88x180 column the board leaves clear — measured in spike 0 by drawing
  // it, and honoured here by the board's camera offset rather than by hope.
  const hud = createHud({
    doc: host,
    view: '2.5d',
    i18n,
    rules,
    state: game,
    reducedMotion,
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
        saveSettings({ ...currentSettings(), protect: on });
        hud.refresh();
        askOpponent();
      },
    }),
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

    canTakeBack: () => !walking && game.canTakeBack(),
    canReplay: () => !walking && game.canReplay(),
    onTakeBack: () => walkHistory('back'),
    onReplay: () => walkHistory('forward'),
    outline: () => outlined,
    onOutline: (on) => { outlined = on; pieces.setOutline(on); hud.refresh(); invalidate(); },
    coordinates: () => showCoordinates,
    onCoordinates: (on) => {
      showCoordinates = on;
      coordinates.setVisible(on);
      saveSettings({ ...currentSettings(), coordinates: on });
      hud.refresh();
      invalidate();
    },
    vision: () => vision,
    onVision: (key) => {
      vision = key;
      // The filter goes on the whole REGION, so the board and the panel are corrected together.
      // Correcting only the board would leave the move list in the colours the child cannot read.
      region.style.filter = VIZ_FILTER[key] ?? '';
      hud.refresh();
    },

    themes: BOARD_THEMES.map((t) => ({ key: t.key, name: t.name })),
    theme: () => themeKey,
    onTheme: (key) => { applyTheme(key); },
  });
  /**
   * Repaints the board and the panel from a named palette, and remembers the choice.
   *
   * `area` rather than `region` because this is a hoisted declaration: TypeScript will not carry
   * the null check into a function that could, as far as it knows, have been called before it.
   * The narrowed constant is captured once, above, where the check has already happened.
   */
  const currentSettings = () => ({
    theme: themeKey, coordinates: showCoordinates, mode, elo, hints: hintsOn, protect: protectedOn,
  });

  /**
   * ========================= CHANGING SIDES IS A NEW GAME =========================
   * There is no honest way to swap sides in the middle of one: the position, the score sheet and
   * the captured tally all belong to whoever played them. So the control starts a fresh game — the
   * choice is written down first, the saved game is thrown away, and the page reloads into it.
   *
   * A reload rather than a rebuild because the composition root wires one game into a dozen
   * closures, and tearing that down by hand would be a second, quieter way of starting over.
   */
  function chooseMode(next: GameMode): void {
    if (next === mode) return;
    saveSettings({ ...currentSettings(), mode: next });
    clearGame();
    window.location.reload();
  }


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
    // learning; three in a row from the same position is somebody stuck, and the answer to being
    // stuck is not a fourth chance to guess.
    if (stumbleAt !== entry.ply) { stumbleAt = entry.ply; stumbles = 0; }
    stumbles++;

    blunderBar.show({ mark: entry.mark ?? '', lost: entry.lost });
    if (stumbles >= STUMBLES_BEFORE_HELP && !hintsOn) {
      hintsOn = true;
      saveSettings({ ...currentSettings(), hints: hintsOn });
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

  /** Takes the advice off the board. Its own function because three paths need exactly this. */
  function clearHints(): void {
    hintFen = null;
    hinted = [];
    syncMarkers();
  }

  /** Draws the suggested moves as arrows and says them aloud. */
  function showHint(moves: readonly Suggestion[]): void {
    hinted = moves.map((m) => ({ from: m.move.from, to: m.move.to, behind: m.behind }));
    syncMarkers();
    const say = (m: Suggestion): string =>
      `${toAlgebraic(m.move.from)} ${toAlgebraic(m.move.to)}`;
    srSay(moves.length > 1
      ? i18n.t('a11y.hintMany', { move: say(moves[0]), others: moves.slice(1).map(say).join(', ') })
      : i18n.t('a11y.hintOne', { move: say(moves[0]) }));
  }

  /**
   * ========================= A HINT IS THE SAME ENGINE, ASKED DIFFERENTLY =========================
   * Same client, same id matching as the opponent's own search — which is what stops a hint asked
   * for and then abandoned from arriving later and marking squares in a position that has moved on.
   *
   * ⚠️ What it says is carefully limited. "The engine would play this, and rates these the same" is
   * a fact about a three-ply negamax with a material-and-placement evaluator, not about chess.
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
      showHint(hint.ties.length ? hint.ties : [{ move: hint.move, behind: 0 }]);
    } catch {
      srSay(i18n.t('status.engineFailed'));
    } finally {
      hinting = false;
      thinking.setBusy(false);
      hud.refresh();
    }
  }

  function applyTheme(key: string): void {
    themeKey = key;
    const palette = projectedPalette(boardTheme(key));
    boardView.setPalette(palette);
    pieces.setPalette(palette);
    // The DOM panel follows the same switch: it is over the same board and read by the same eye.
    area.dataset.contrast = key.startsWith('contrast-') ? 'high' : '';
    saveSettings({ ...currentSettings(), theme: key });
    hud.refresh();
    invalidate();
  }

  region.appendChild(coordinates.root);
  region.appendChild(hud.root);
  // Outside the panel, over the board: see `.theme-report` in the stylesheet.
  region.appendChild(hud.report);
  // ⚠️ After `#stage-wrap`, not inside it. That element is a centring FLEX ROW, so a child lands
  // beside the board and squeezes it — which is exactly what happened. The panel belongs under the
  // board, and under the board is the next sibling.
  const wrap = host.getElementById('stage-wrap');
  wrap?.parentElement?.insertBefore(thinking.root, wrap.nextSibling);
  // Above the thinking panel: it is the thing being waited on, not commentary.
  wrap?.parentElement?.insertBefore(blunderBar.root, thinking.root);
  region.dataset.contrast = themeKey.startsWith('contrast-') ? 'high' : '';

  /**
   * CSS pixels per canvas pixel, kept from the last layout instead of measured per frame.
   * `getBoundingClientRect` inside a render loop forces a synchronous layout on every frame, which
   * is the classic way to make a smooth animation stutter on the machine that can least afford it.
   */
  let cssPerPixel = 1;

  // ⚠️ Declared ABOVE `relayout`, which calls `invalidate()` on its first run. This is the SECOND
  // temporal-dead-zone fault in this file: the first was the walk state read by `createHud`'s own
  // constructor. Both were invisible to tsc, to 375 tests and to the build, and both broke the
  // whole boot in the bundle only. `tests/boot.browser.test.ts` exists because of this one.
  let dirty = true;
  const invalidate = (): void => { dirty = true; };

  const relayout = (): void => {
    const result = applyLayout({ doc: host, win: window });
    if (result) cssPerPixel = result.width / LOGICAL_W;
    // The labels are positioned in CSS pixels, so a resize moves them even though the canvas
    // itself is only rescaled. Nothing else here needs a redraw on resize; they do.
    invalidate();
  };
  relayout();
  window.addEventListener('resize', relayout);

  let animation: MoveAnimation | null = null;

  function syncPieces(): void {
    const flying = game.animating();
    // The rules have ALREADY applied the move — forwards or backwards — so the travelling piece is
    // standing on the square it is flying TO. It is left out of the static set and drawn
    // separately, in flight.
    const hidden: readonly Square[] = walking ? walking.hide : flying ? [flying.to] : [];
    const placements = rules.placements()
      .filter((p) => !hidden.some((square) => sameSquare(p.square, square)));
    pieces.setPosition(placements);
    pieces.setTravelling(walking ? walking.piece : flying ? flying.piece : null);
    invalidate();
    // Every path that changes the position comes through here — a move, a leg of a walk, the
    // opponent's reply — which makes it the one place the score sheet has to be written down.
    saveGame(rules);
    // ⚠️ And the one place advice is retired, by comparing positions rather than by assuming any
    // redraw invalidates it. Selecting a piece redraws and does NOT change the position, which is
    // why a suggestion now survives being acted on.
    // And the one place the engine is told the game has moved: one search per ply feeds the
    // readout, the marks on the score sheet and protected mode all three.
    reviewer.observe();
    refreshHints();
  }

  function syncMarkers(): void {
    // A hint is drawn over the game's own state rather than competing with it for squares.
    boardView.setHintArrows(hinted);
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
    // The keyboard cursor last, and only where nothing else already speaks for the square:
    // a selection or a legal-move marker is more informative than "you are looking here".
    const at = squareIndex(cursor);
    if (!markers.has(at)) markers.set(at, 'cursor');
    boardView.setMarkers(markers);
    invalidate();
  }

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

    if (result.kind === 'deselected') {
      srSay(i18n.t('a11y.noSelection'));
      return;
    }

    if (result.kind === 'moved') {
      srSay(moveSentence(i18n, result.move));
      // Check is an EVENT, and an urgent one: assertive, not polite.
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

  /** Plays a move the game has already accepted: animate it, redraw it, say it. */
  function beginMove(move: MoveResult): void {
    animation = createMoveAnimation(move.from, move.to, { reducedMotion: reducedMotion() });
    syncPieces();
    syncMarkers();
  }

  function askOpponent(): void {
    if (game.phase() !== 'thinking' || searching) return;
    // ⚠️ HELD. Protected mode's whole value is that the warning arrives while the position it
    // ruined is still on the board — a reply played first would make the take-back unpick
    // someone else's move as well, and would put the warning two plies in the past.
    //
    // So the opponent waits for TWO things: an unanswered warning, and a verdict that has not
    // landed yet. The second is the one that actually bites: the review is queued before this
    // search and still resolves after it starts, so without the wait the reply is on the board
    // before the warning exists. `reviewer.onChange` is what tries again.
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
        const move = game.applyOpponentMove(
          reply.move.from, reply.move.to, reply.move.promotion,
        );
        if (!move) return;
        beginMove(move);
        mirror.refresh();
        hud.refresh();
        srSay(moveSentence(i18n, move));
        if (!move.checkmate && move.check) srAlert(i18n.t('status.check'));
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

  /**
   * ========================= WALKING THE SCORE SHEET =========================
   * Both buttons come through here because both need the same four things afterwards: the pieces
   * put back where the rules now say they stand, the markers redrawn, the DOM mirror relabelled,
   * and the panel told what it may now offer.
   *
   * The search is cancelled first. A take-back during `thinking` is exactly when a player wants
   * one — they have seen their blunder and the computer has not answered yet — and letting the
   * worker finish would answer a position that no longer exists. The client is id-matched and
   * would drop the reply anyway; cancelling makes it prompt instead of merely harmless.
   *
   * There is no animation. A take-back is not a move being played, and pretending otherwise would
   * mean animating a piece backwards along a path it never took.
   */
  /** Where a move's capture actually stood. En passant is the one case it is not `to`. */
  const capturedSquare = (move: MoveResult): Square =>
    (move.enPassant ? { x: move.to.x, y: move.from.y } : move.to);

  /**
   * ========================= ONE PLY PER LEG, NOT ALL OF THEM AT ONCE =========================
   * This applied the whole take-back to the rules and then animated the plies one by one, and the
   * bug that produced was visible from across the room: the SECOND piece stood on its destination
   * from the moment the button was pressed, waited for the first to land, and only then flew there
   * from where it had already left. It teleported, then travelled.
   *
   * The position now moves exactly one ply per leg, so what is drawn is always the position the
   * rules are actually in. The state machine keeps the policy — two plies against an opponent, one
   * in a hot seat — and hands it over a ply at a time through `more`.
   */
  function walkHistory(direction: 'back' | 'forward'): void {
    // One walk at a time, and never on top of a move already in flight.
    if (walking || animation) return;
    opponent.cancel();
    searching = false;
    thinking.setBusy(false);
    walkDirection = direction;

    const step = direction === 'back' ? game.takeBackStep() : game.replayStep();
    if (!step) {
      srSay(i18n.t(direction === 'back' ? 'a11y.nothingToTakeBack' : 'a11y.nothingToReplay'));
      hud.refresh();
      return;
    }
    mirror.refresh();
    hud.refresh();
    beginWalkLeg(step);
  }

  /** Draws one ply travelling, in whichever direction the walk is going. */
  function beginWalkLeg(step: HistoryStep): void {
    const move = step.move;
    walkMore = step.more;
    walking = walkDirection === 'back'
      ? {
        piece: move.piece,
        from: move.to,
        to: move.from,
        // Where the mover now stands, and where a piece it took has just come back to. Both are
        // on the board as far as the rules are concerned; both wait for the traveller to land.
        hide: move.captured ? [move.from, capturedSquare(move)] : [move.from],
      }
      : { piece: move.piece, from: move.from, to: move.to, hide: [move.to] };

    animation = createMoveAnimation(walking.from, walking.to, { reducedMotion: reducedMotion() });
    syncPieces();
    syncMarkers();
  }

  /** The leg has landed: take the next ply, or end the walk. */
  function continueWalk(): void {
    if (walkMore) {
      const next = walkDirection === 'back' ? game.takeBackStep() : game.replayStep();
      if (next) {
        mirror.refresh();
        hud.refresh();
        beginWalkLeg(next);
        return;
      }
    }

    walking = null;
    animation = null;
    walkMore = false;
    syncPieces();
    syncMarkers();
    mirror.refresh();
    hud.refresh();
    // Said here rather than at the button press: mid-walk the board belongs to whoever has just
    // been rewound past, and announcing THAT as the turn would be false for the whole animation.
    srSay(i18n.t(walkDirection === 'back' ? 'a11y.tookBack' : 'a11y.replayed', {
      side: i18n.t(`turn.${rules.turn()}`),
    }));
    // Advancing your own move alone leaves the opponent to answer, and nothing else would ask.
    askOpponent();
  }

  function onActivate(square: Square): void {
    // The state machine has already settled while a walk is in flight — its phase is `idle` — so
    // it would accept a move played on top of pieces that are still travelling. This is the only
    // guard against that.
    if (walking) return;
    cursor = square;
    const result = game.activate(square);
    if (result.kind === 'moved') beginMove(result.move);
    syncMarkers();
    mirror.refresh();
    hud.refresh();
    announce(result);
  }

  /* ---------- pointer: drag turns the camera, a click activates a square ---------- */

  /** CSS pixels per canvas pixel. The engine scales the region by a whole number. */
  const upscale = (): number =>
    Math.max(1, canvas.getBoundingClientRect().width / LOGICAL_W);

  let dragging: number | null = null;
  let last = { x: 0, y: 0 };
  let travelled = 0;
  /** Set when the press has been held long enough that moving now turns the board. */
  let turning = false;
  let holdTimer: number | null = null;

  const cancelHold = (): void => {
    if (holdTimer !== null) window.clearTimeout(holdTimer);
    holdTimer = null;
  };

  canvas.addEventListener('pointerdown', (e) => {
    dragging = e.pointerId;
    last = { x: e.clientX, y: e.clientY };
    travelled = 0;
    turning = false;

    // ⚠️ Capture is attempted and its failure is survivable, in that order. `setPointerCapture`
    // THROWS for a pointer the browser does not currently have — a synthetic event, a pointer
    // already released, a device that vanished mid-press — and it used to be the last statement
    // before the hold was armed, so a throw here silently left the board unable to turn for the
    // rest of that press. The timer is set first, and the capture is allowed to fail.
    // ========================= TURNING IS A DELIBERATE ACT =========================
    // The board used to start turning on the first pixel of movement, which meant it turned while
    // a teacher was pointing at a square in front of a class: the gesture for "look here" and the
    // gesture for "spin the board" were the same one.
    //
    // ⚠️ Movement does NOT cancel the hold, and that is deliberate. A hand resting on a trackpad
    // is never perfectly still, and cancelling on the first tremor would make the board turnable
    // only by the steady-handed. What movement does is move the ORIGIN: when the hold finally
    // fires it starts from wherever the pointer is, so nothing jumps.
    holdTimer = window.setTimeout(() => {
      holdTimer = null;
      if (dragging === null) return;
      turning = true;
      canvas.dataset.turning = 'true';
    }, ROTATE_HOLD_MS);

    // ⚠️ Capture is attempted AFTER the timer, and its failure is survivable.
    // `setPointerCapture` THROWS for a pointer the browser does not currently have — a synthetic
    // event, a pointer already released, a device that vanished mid-press — and it used to be the
    // last statement before the hold was armed, so a throw here silently left the board unable to
    // turn for the rest of that press.
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // No capture: a pointer leaving the canvas mid-turn will simply stop turning it.
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (dragging !== e.pointerId) return;
    const k = upscale();
    const dx = (e.clientX - last.x) / k;
    const dy = (e.clientY - last.y) / k;
    travelled += Math.abs(dx) + Math.abs(dy);
    last = { x: e.clientX, y: e.clientY };
    // Before the hold fires this loop does nothing but keep the origin current.
    if (!turning) return;
    camera.drag(dx, dy);
    invalidate();
  });

  canvas.addEventListener('pointerup', (e) => {
    if (dragging !== e.pointerId) return;
    dragging = null;
    cancelHold();
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Never captured, or already gone. Releasing is not what this handler is FOR — the click
      // below is — and letting a throw here swallow that was the same fault twice.
    }

    // A press that became a turn is not a click, however little it moved in the end.
    if (turning) {
      turning = false;
      delete canvas.dataset.turning;
      return;
    }
    // A drag that barely moved was a click. Three canvas pixels of slop is about a finger's worth
    // of tremor at k=2, and well under one square.
    if (travelled >= 3) return;

    const rect = canvas.getBoundingClientRect();
    const k = upscale();
    const point = toIllustrationSpace(
      { x: (e.clientX - rect.left) / k, y: (e.clientY - rect.top) / k },
      stage.viewport(),
    );
    stage.update();
    const hit = pickTopmost(boardView.quads(), point);
    if (hit !== null) onActivate(squareFromIndex(hit));
  });

  /* ---------- keyboard: everything the pointer can do, without a pointer ---------- */

  // Listened on #game-region, never on window — the engine's rule, and what keeps the camera from
  // swallowing keys meant for a dialog. Plain arrows are reserved for the grid cursor at step 7.
  region.addEventListener('keydown', (e) => {
    // The sonar, on the `especial` intent rather than on a key.
    //
    // A bare `s` was the first attempt and it was wrong: `KeyS` is `down` in the engine's default
    // scheme, so it fought the board navigation — precisely the collision the intent layer exists
    // to prevent, created by taking a shortcut past it. The engine's vocabulary is eight fixed
    // actions and `especial` is the open slot: the engine reports that the player pressed it, and
    // THIS GAME decides it means sonar. That is the whole idea, and it makes the key remappable.
    if (engine.keyboard.actionOf(e.code, 0) === 'especial') {
      engine.sonar.sonar({ i: 0, x: cursor.x, y: cursor.y, viz: 'normal' });
      e.preventDefault();
      return;
    }

    if (!e.shiftKey) return;
    const direction = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    }[e.key];
    if (!direction) return;
    camera.nudge(direction as 'left' | 'right' | 'up' | 'down');
    invalidate();
    e.preventDefault();
  });

  /* ---------- frame loop ---------- */

  /**
   * One frame. Named and passed to `startLoop` rather than written inline, so it can also be
   * driven by hand: a browser pane that is hidden never fires requestAnimationFrame, and an
   * animation that only advances when someone takes a screenshot cannot be verified at all.
   */
  function frame(dt: number): void {
    if (animation) {
      const running = animation.advance(dt);
      const at = animation.position();
      pieces.moveTravelling(at.x, at.lift, at.z);
      dirty = true;
      if (!running) {
        // A walk through the score sheet has its own ending: the next ply, or the settling that
        // `continueWalk` does when there is none. The state machine settles itself on the LAST
        // ply of the unit, so telling it the animation is done here would be a second, false one.
        if (walking) {
          continueWalk();
        } else {
          animation = null;
          game.animationDone();
          syncPieces();
          syncMarkers();
          mirror.refresh();
          hud.refresh();
          announceOutcome();
          askOpponent();
        }
      }
    }

    if (!dirty) return;
    dirty = false;
    const view = camera.snapshot();
    stage.setCamera(view.pitch, view.yaw);
    stage.render();
    // After the render, because the projected corners the labels extrapolate from are only valid
    // once the graph has been updated — the same precondition `quads()` carries for picking.
    coordinates.place(boardView.quads(), stage.viewport(), cssPerPixel);
  }

  startLoop(ticker, frame, 2, {
    // The engine ships this and its own game never wires it: the loop stops on error and NOTHING
    // announces it. A blind child cannot see a frozen screen.
    aoFalhar: (erro: unknown) => {
      srAlert(i18n.t('status.thinking'));
      console.error('[chess] frame loop stopped', erro);
    },
  });

  syncPieces();
  syncMarkers();
  askOpponent();   // in case the opponent has the first move

  // Diagnostics behind ?debug=true, the same switch the engine's own ui/layout uses. Off by
  // default, so nothing is exposed to a page that did not ask for it — and available when a
  // question needs measuring instead of estimating from a screenshot.
  if (/[?&]debug=true/.test(location.search)) {
    (window as unknown as Record<string, unknown>).__chess = {
      game,
      rules,
      camera,
      /** Whether a press has been held long enough to turn the board. */
      turning: () => turning,
      /** Client coordinates of a square's centre, for driving the board from the console. */
      screenOf(square: Square): { x: number; y: number } | null {
        stage.update();
        const quad = boardView.quads()[squareIndex(square)];
        if (!quad) return null;
        const cx = (quad.corners[0].x + quad.corners[1].x + quad.corners[2].x + quad.corners[3].x) / 4;
        const cy = (quad.corners[0].y + quad.corners[1].y + quad.corners[2].y + quad.corners[3].y) / 4;
        const view = stage.viewport();
        const rect = canvas.getBoundingClientRect();
        const k = upscale();
        return {
          x: rect.left + (cx * view.zoom + view.width / 2) * k,
          y: rect.top + (cy * view.zoom + view.height / 2) * k,
        };
      },
      activate: onActivate,
      takeBack: () => walkHistory('back'),
      replay: () => walkHistory('forward'),
      opponent,
      askOpponent,
      mirror,
      hud,
      coordinates,
      stage,
      boardView,
      pieces,
      // fabricas, para montar um palco de teste em qualquer resolucao e medir o custo
      make: { createZdogStage, createBoard, createPiecesLayer, buildPiece, PIECE_SPECS, LIGHT_PIECES, DARK_PIECES },
      engine,
      declaration,
      /** Advances the loop by hand — see `frame`. */
      step: frame,
    };
  }

  if (engine.problems.length) console.warn('[chess] engine problems:', engine.problems);
  srSay(i18n.t('a11y.boardLabel'));
}

if (typeof document !== 'undefined' && document.getElementById('game-region')) boot();
