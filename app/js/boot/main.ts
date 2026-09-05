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
import { createHud } from '../ui/hud.ts';
import { applyLayout } from '../ui/layout.ts';
import { createEngineClient } from '../chess/engine/client.ts';
import { DEFAULT_DIFFICULTY, DIFFICULTY_DEPTH, type Difficulty } from '../chess/engine/difficulty.ts';
import { type MoveResult } from '../chess/rules.ts';
import { clear as clearGame, loadSettings, resume, save as saveGame, saveSettings }
  from '../chess/session.ts';
import { createGameState, type Activation, type HistoryStep } from '../chess/state.ts';
import { sameSquare, type Piece, type Side, type Square, toAlgebraic } from '../chess/types.ts';
import { createI18n, preferredLocale, type I18n } from '../i18n/index.ts';
import { createMoveAnimation, type MoveAnimation } from '../render/animation.ts';
import { createBoard, type Marker } from '../render/board.ts';
import { squareFromIndex, squareIndex } from '../render/board-geometry.ts';
import { createCamera } from '../render/camera.ts';
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
  const playerSide: Side = loadSettings().side ?? 'w';
  const game = createGameState({ rules, playerSide, opponent: true });
  const opponent = createEngineClient();
  let difficulty: Difficulty = DEFAULT_DIFFICULTY;
  let thinking = false;

  // The keyboard cursor. It lives here rather than inside the grid mirror because the DECLARATION
  // needs it (field 4, focus) and the mirror needs the declaration's game — a cycle broken by
  // keeping the value in the composition root, where cycles are allowed to be resolved.
  let cursor: Square = { x: 4, y: 6 };

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
  const systemContrast = window.matchMedia?.('(prefers-contrast: more)').matches ?? false;
  let themeKey = remembered.theme ?? (systemContrast ? CONTRAST_HERE : DEFAULT_THEME);
  let previousTheme = themeKey.startsWith('contrast-') ? DEFAULT_THEME : themeKey;
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
    difficulty: () => difficulty,
    reducedMotion,
    onReducedMotion: (on) => { motionReduced = on; hud.refresh(); },
    playerSide: () => playerSide,
    onPlayerSide: choosePlayerSide,

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
    highContrast: () => themeKey.startsWith('contrast-'),
    onHighContrast: (on) => {
      // One state, two doors — the same arrangement the flat board uses. Turning high contrast off
      // returns the palette the player had chosen, not the factory one.
      if (on) {
        if (!themeKey.startsWith('contrast-')) previousTheme = themeKey;
        applyTheme(CONTRAST_HERE);
      } else {
        applyTheme(previousTheme);
      }
    },

    themes: BOARD_THEMES.map((t) => ({ key: t.key, name: t.name })),
    theme: () => themeKey,
    onTheme: (key) => { applyTheme(key); },
    onDifficulty: (level) => {
      difficulty = level;
      hud.refresh();
      // A change mid-search would otherwise be answered by the OLD depth: cancel, then ask again
      // at the new one. The client drops the stale reply either way, but this makes it prompt.
      if (game.phase() === 'thinking') { opponent.cancel(); thinking = false; askOpponent(); }
    },
  });
  /**
   * Repaints the board and the panel from a named palette, and remembers the choice.
   *
   * `area` rather than `region` because this is a hoisted declaration: TypeScript will not carry
   * the null check into a function that could, as far as it knows, have been called before it.
   * The narrowed constant is captured once, above, where the check has already happened.
   */
  const currentSettings = () => ({
    theme: themeKey, coordinates: showCoordinates, side: playerSide,
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
  function choosePlayerSide(side: Side): void {
    if (side === playerSide) return;
    saveSettings({ ...currentSettings(), side });
    clearGame();
    window.location.reload();
  }

  function applyTheme(key: string): void {
    themeKey = key;
    if (!key.startsWith('contrast-')) previousTheme = key;
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
  }

  function syncMarkers(): void {
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
    if (game.phase() !== 'thinking' || thinking) return;
    thinking = true;
    srSay(i18n.t('status.thinking'));

    opponent.requestMove(rules.fen(), DIFFICULTY_DEPTH[difficulty])
      .then((reply) => {
        thinking = false;
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
        thinking = false;
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
    thinking = false;
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

  canvas.addEventListener('pointerdown', (e) => {
    dragging = e.pointerId;
    last = { x: e.clientX, y: e.clientY };
    travelled = 0;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (dragging !== e.pointerId) return;
    const k = upscale();
    const dx = (e.clientX - last.x) / k;
    const dy = (e.clientY - last.y) / k;
    travelled += Math.abs(dx) + Math.abs(dy);
    last = { x: e.clientX, y: e.clientY };
    camera.drag(dx, dy);
    invalidate();
  });

  canvas.addEventListener('pointerup', (e) => {
    if (dragging !== e.pointerId) return;
    dragging = null;
    canvas.releasePointerCapture(e.pointerId);
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
      setDifficulty(level: Difficulty) { difficulty = level; },
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
