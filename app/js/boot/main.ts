// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/main — the composition root. The only module that knows PixiJS and the DOM concretely.
//
// Wired: the engine's accessibility stack, real chess rules, the state machine, the Zdog board and
// pieces, the PixiJS surface, the camera, picking, and move animation.
// Not yet, by plan: the opponent (step 6), the DOM grid mirror (step 7), the HUD (step 8).
//
// Everything a player does goes through `game.activate(square)` — pointer and keyboard alike — and
// everything the game says goes through `announce()`. Keeping those two funnels narrow is what will
// let the grid mirror behave identically to a click when it arrives.

import { createGame } from '@pm-monte/inclusionist-engine';
import { srAlert, srSay } from '@pm-monte/inclusionist-engine/core/a11y-sr.ts';
import { startLoop } from '@pm-monte/inclusionist-engine/core/loop.ts';
import { VIZ_FILTER } from '@pm-monte/inclusionist-engine/render/viz-modes.ts';
import { createChessDeclaration } from '../declaration/chess-declaration.ts';
import { createGridMirror } from '../ui/grid-mirror.ts';
import { createHud } from '../ui/hud.ts';
import { applyLayout } from '../ui/layout.ts';
import { createEngineClient } from '../chess/engine/client.ts';
import { DEFAULT_DIFFICULTY, DIFFICULTY_DEPTH, type Difficulty } from '../chess/engine/difficulty.ts';
import { createRules, type MoveResult } from '../chess/rules.ts';
import { createGameState, type Activation } from '../chess/state.ts';
import { sameSquare, type Square, toAlgebraic } from '../chess/types.ts';
import { createI18n, preferredLocale, type I18n } from '../i18n/index.ts';
import { createMoveAnimation, type MoveAnimation } from '../render/animation.ts';
import { createBoard, type Marker } from '../render/board.ts';
import { squareFromIndex, squareIndex } from '../render/board-geometry.ts';
import { createCamera } from '../render/camera.ts';
import { buildPiece, createPiecesLayer } from '../render/pieces/index.ts';
import { PIECE_SPECS } from '../render/pieces/geometry.ts';
import { DARK_PIECES, LIGHT_PIECES } from '../render/palette.ts';
import { pickTopmost, toIllustrationSpace } from '../render/picking.ts';
import { createPalette, type PaletteMode } from '../render/palette.ts';
import { createPixiSurface } from '../render/pixi-surface.ts';
import { LOGICAL_W } from '../render/resolution.ts';
import { createZdogStage } from '../render/zdog-stage.ts';

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

  const i18n = createI18n(preferredLocale(navigator.language));
  host.documentElement.lang = i18n.bcp47();

  // Seeded from the system preference, then the person's own switch wins. The engine's
  // ui/settings-motion is per ELEMENT — parallax, walk, breath — which is the right shape for a
  // platformer and has nothing to map onto here: this game moves exactly one thing, a piece
  // crossing the board.
  let motionReduced =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const reducedMotion = (): boolean => motionReduced;

  const rules = createRules();
  const game = createGameState({ rules, opponent: true });
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
  let paletteMode: PaletteMode =
    window.matchMedia?.('(prefers-contrast: more)').matches ? 'high-contrast' : 'default';
  let vision = 'normal';
  let outlined = true;

  const stage = createZdogStage();
  const boardView = createBoard(stage.root, createPalette(paletteMode));
  const pieces = createPiecesLayer(stage.root, createPalette(paletteMode), outlined);
  const surface = createPixiSurface(stage.canvas);
  const camera = createCamera();

  surface.view.id = 'board-canvas';
  // Hidden from the screen reader ON PURPOSE — the same pillar the engine applies to its own
  // canvas: the game speaks through the DOM. The grid mirror at step 7 carries the board.
  surface.view.setAttribute('aria-hidden', 'true');
  region.appendChild(surface.view);

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
  region.insertBefore(mirror.root, surface.view);

  // The panel lives in the 88x180 column the board leaves clear — measured in spike 0 by drawing
  // it, and honoured here by the board's camera offset rather than by hope.
  const hud = createHud({
    doc: host,
    i18n,
    rules,
    state: game,
    difficulty: () => difficulty,
    reducedMotion,
    onReducedMotion: (on) => { motionReduced = on; hud.refresh(); },
    outline: () => outlined,
    onOutline: (on) => { outlined = on; pieces.setOutline(on); hud.refresh(); invalidate(); },
    vision: () => vision,
    onVision: (key) => {
      vision = key;
      // The filter goes on the whole REGION, so the board and the panel are corrected together.
      // Correcting only the board would leave the move list in the colours the child cannot read.
      region.style.filter = VIZ_FILTER[key] ?? '';
      hud.refresh();
    },
    highContrast: () => paletteMode === 'high-contrast',
    onHighContrast: (on) => {
      paletteMode = on ? 'high-contrast' : 'default';
      const palette = createPalette(paletteMode);
      boardView.setPalette(palette);
      pieces.setPalette(palette);
      // The DOM panel follows the same switch: it is over the same board and read by the same eye.
      region.dataset.contrast = on ? 'high' : '';
      invalidate();
    },
    onDifficulty: (level) => {
      difficulty = level;
      hud.refresh();
      // A change mid-search would otherwise be answered by the OLD depth: cancel, then ask again
      // at the new one. The client drops the stale reply either way, but this makes it prompt.
      if (game.phase() === 'thinking') { opponent.cancel(); thinking = false; askOpponent(); }
    },
  });
  region.appendChild(hud.root);
  region.dataset.contrast = paletteMode === 'high-contrast' ? 'high' : '';

  const relayout = (): void => { applyLayout({ doc: host, win: window }); };
  relayout();
  window.addEventListener('resize', relayout);

  let dirty = true;
  let animation: MoveAnimation | null = null;
  const invalidate = (): void => { dirty = true; };

  function syncPieces(): void {
    const flying = game.animating();
    // The rules have ALREADY applied the move, so the travelling piece is standing on its
    // destination. It is left out of the static set and drawn separately, in flight.
    const placements = rules.placements()
      .filter((p) => !(flying && sameSquare(p.square, flying.to)));
    pieces.setPosition(placements);
    pieces.setTravelling(flying ? flying.piece : null);
    invalidate();
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

  function onActivate(square: Square): void {
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
    Math.max(1, surface.view.getBoundingClientRect().width / LOGICAL_W);

  let dragging: number | null = null;
  let last = { x: 0, y: 0 };
  let travelled = 0;

  surface.view.addEventListener('pointerdown', (e) => {
    dragging = e.pointerId;
    last = { x: e.clientX, y: e.clientY };
    travelled = 0;
    surface.view.setPointerCapture(e.pointerId);
  });

  surface.view.addEventListener('pointermove', (e) => {
    if (dragging !== e.pointerId) return;
    const k = upscale();
    const dx = (e.clientX - last.x) / k;
    const dy = (e.clientY - last.y) / k;
    travelled += Math.abs(dx) + Math.abs(dy);
    last = { x: e.clientX, y: e.clientY };
    camera.drag(dx, dy);
    invalidate();
  });

  surface.view.addEventListener('pointerup', (e) => {
    if (dragging !== e.pointerId) return;
    dragging = null;
    surface.view.releasePointerCapture(e.pointerId);
    // A drag that barely moved was a click. Three canvas pixels of slop is about a finger's worth
    // of tremor at k=2, and well under one square.
    if (travelled >= 3) return;

    const rect = surface.view.getBoundingClientRect();
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

    if (!dirty) return;
    dirty = false;
    const view = camera.snapshot();
    stage.setCamera(view.pitch, view.yaw);
    stage.render();
    surface.present();
    surface.render();
  }

  startLoop(surface.ticker, frame, 2, {
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
        const rect = surface.view.getBoundingClientRect();
        const k = upscale();
        return {
          x: rect.left + (cx * view.zoom + view.width / 2) * k,
          y: rect.top + (cy * view.zoom + view.height / 2) * k,
        };
      },
      activate: onActivate,
      opponent,
      setDifficulty(level: Difficulty) { difficulty = level; },
      askOpponent,
      mirror,
      hud,
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
