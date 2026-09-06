// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/view-zdog — the projected board: a Zdog stage, a camera you can turn, and a frame loop.
//
// ========================= THE ONLY VIEW WITH A CLOCK =========================
// The flat board draws a position and stops. This one runs `startLoop` because it has a camera
// that moves and pieces that fly, and the loop lives HERE rather than in the shell for a reason
// that is easy to get backwards: `dt` is in FRAMES, a convention `render/animation.ts` inherited
// from PixiJS, and it means nothing on a page with no loop. `boot/main-2d.ts` has neither, by
// measurement — 104 KB against 146.
//
// ========================= ⚠️ HOW A FRAME LOOP BECOMES A PROMISE =========================
// The shell awaits `travel(from, to)` and walks the score sheet one ply at a time. There is no
// promise anywhere in a frame loop, so this file makes one: `travel` starts an animation and hands
// back a promise whose resolver is held until `frame` sees the animation finish.
//
// Two things about that are load-bearing and neither is obvious:
//
//   · THE RESOLVER IS CAPTURED, CLEARED, AND ONLY THEN CALLED. The shell answers a resolve by
//     starting the next leg, which calls `travel` again and stores a NEW resolver. Clearing after
//     the call would null that new one, and the walk would stop halfway with no error at all.
//   · AN OUTSTANDING RESOLVER IS SETTLED BEFORE A NEW LEG BEGINS. A promise abandoned mid-flight
//     strands the shell inside its own `finally`, and the only symptom is that take-back and
//     replay quietly stop working for the rest of the game.

import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import type { Square } from '../chess/types.ts';
import { squareFromIndex, squareIndex } from '../render/board-geometry.ts';
import { createMoveAnimation, type MoveAnimation } from '../render/animation.ts';
import { createBoard } from '../render/board.ts';
import { CAMERA, createZdogStage } from '../render/zdog-stage.ts';
import { createCamera, ROTATE_HOLD_MS } from '../render/camera.ts';
import { createFrameTicker } from '../render/frame-ticker.ts';
import { createPiecesLayer } from '../render/pieces/index.ts';
import { DEFAULT_DESIGN, PIECE_DESIGNS, pieceDesign } from '../render/pieces/sets.ts';
import { projectedPalette } from '../render/palette.ts';
import { pickTopmost, toIllustrationSpace } from '../render/picking.ts';
import { LOGICAL_W } from '../render/resolution.ts';
import { boardTheme } from '../ui/board-themes.ts';
import { createCoordinates } from '../ui/coordinates.ts';
import type { BoardView, ViewContext, ViewFactory } from './view.ts';

/** A drag that moved less than this was a click. About a finger's tremor, and well under a square. */
const CLICK_SLOP = 3;

export const createZdogView: ViewFactory = (ctx: ViewContext): BoardView => {
  const { doc, region, mirror, prefs, rules } = ctx;

  let outlined = true;
  let designKey = prefs.remembered.design ?? DEFAULT_DESIGN;
  let showCoordinates = prefs.remembered.coordinates ?? true;
  let themeKey = prefs.remembered.theme ?? '';

  // Real DOM text over the board: Zdog has no text primitive, and `ui/coordinates` explains why
  // that turns out to be a gain. Created before the panel so the panel stacks above it.
  const coordinates = createCoordinates({ doc, visible: showCoordinates });

  const stage = createZdogStage();
  const palette = () => projectedPalette(boardTheme(themeKey));
  const boardView = createBoard(stage.root, palette());
  /**
   * ⚠️ HARTWIG IS THE DEFAULT AND STAYS IT. It is the set this game is a reimplementation OF, and
   * the only one whose shapes are the MOVEMENT of the pieces rather than a decoration on them.
   */
  const pieces = createPiecesLayer(stage.root, palette(), outlined, designKey);
  // Half a turn when you are black, so your own men are nearest you. Zdog projects the whole graph
  // through the illustration's rotation, so this is the entire flip — no second board, no mirrored
  // geometry, and picking keeps reading the same projected corners it always did.
  const camera = createCamera(ctx.playerSide === 'b'
    ? { pitch: CAMERA.pitch, yaw: Math.PI }
    : { pitch: CAMERA.pitch, yaw: CAMERA.yaw });

  // ========================= NO COMPOSITOR =========================
  // Zdog's canvas goes straight into the document. It used to be uploaded to a PixiJS texture and
  // drawn as a sprite, which cost 465 KB raw and 138 KB gzipped — measured — to draw one canvas
  // into another. `render/frame-ticker.ts` replaces the only part that was load-bearing: the clock.
  const canvas = stage.canvas;
  canvas.id = 'board-canvas';
  // Hidden from the screen reader ON PURPOSE — the same pillar the engine applies to its own
  // canvas: the game speaks through the DOM, and the grid carries the board.
  canvas.setAttribute('aria-hidden', 'true');
  region.appendChild(canvas);
  // BEFORE the canvas in the DOM, so it is what a reader meets first.
  region.insertBefore(mirror.root, canvas);
  // After both, so the labels paint over the board. They are `aria-hidden`: the mirror already
  // names every square in the player's own language, and sixteen bare letters in front of that
  // would be noise.
  region.appendChild(coordinates.root);

  const ticker = createFrameTicker();

  /**
   * CSS pixels per canvas pixel, kept from the last layout instead of measured per frame.
   * `getBoundingClientRect` inside a render loop forces a synchronous layout on every frame, which
   * is the classic way to make a smooth animation stutter on the machine that can least afford it.
   */
  let cssPerPixel = 1;
  let dirty = true;
  const invalidate = (): void => { dirty = true; };

  let animation: MoveAnimation | null = null;
  let landed: (() => void) | null = null;

  /** CSS pixels per canvas pixel. The engine scales the region by a whole number. */
  const upscale = (): number =>
    Math.max(1, canvas.getBoundingClientRect().width / LOGICAL_W);

  function frame(dt: number): void {
    if (animation) {
      const running = animation.advance(dt);
      const at = animation.position();
      pieces.moveTravelling(at.x, at.lift, at.z);
      dirty = true;
      if (!running) {
        animation = null;
        /*
         * ⚠️ CAPTURED AND CLEARED BEFORE IT IS CALLED. The shell answers this resolve by starting
         * the next leg, which calls `travel` again and stores a new resolver here. Clearing
         * afterwards would null that new one, and the walk would stop halfway with nothing thrown
         * and nothing logged — the exact shape of fault `tests/boot.browser.test.ts` exists for,
         * one layer deeper.
         */
        const done = landed;
        landed = null;
        done?.();
      }
    }

    if (!dirty) return;
    dirty = false;
    const at = camera.snapshot();
    stage.setCamera(at.pitch, at.yaw);
    stage.setZoomFactor(at.zoom);
    stage.render();
    // After the render, because the projected corners the labels extrapolate from are only valid
    // once the graph has been updated — the same precondition `quads()` carries for picking.
    coordinates.place(boardView.quads(), stage.viewport(), cssPerPixel);
  }

  startLoop(ticker, frame, 2, {
    // The engine ships this and its own game never wires it: the loop stops on error and NOTHING
    // announces it. A blind child cannot see a frozen screen.
    aoFalhar: (erro: unknown) => { console.error('[chess] frame loop stopped', erro); },
  });

  /* ---------- pointer: a press selects, a HOLD turns the board ---------- */

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

    /*
     * ========================= TURNING IS A DELIBERATE ACT =========================
     * The board used to start turning on the first pixel of movement, which meant it turned while
     * a teacher was pointing at a square in front of a class: the gesture for "look here" and the
     * gesture for "spin the board" were the same one.
     *
     * ⚠️ Movement does NOT cancel the hold, and that is deliberate. A hand resting on a trackpad is
     * never perfectly still, and cancelling on the first tremor would make the board turnable only
     * by the steady-handed. What movement does is move the ORIGIN: when the hold finally fires it
     * starts from wherever the pointer is, so nothing jumps.
     */
    holdTimer = window.setTimeout(() => {
      holdTimer = null;
      if (dragging === null) return;
      turning = true;
      canvas.dataset.turning = 'true';
    }, ROTATE_HOLD_MS);

    // ⚠️ Capture is attempted AFTER the timer, and its failure is survivable. `setPointerCapture`
    // THROWS for a pointer the browser does not currently have, and it used to be the last
    // statement before the hold was armed — so a throw here silently left the board unable to turn
    // for the rest of that press.
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

  /*
   * ========================= THE WHEEL ZOOMS, BUT ONLY WHILE PRESSED =========================
   * A bare wheel over the canvas has to keep scrolling the PAGE: on a small screen the board fills
   * the viewport, and a page you cannot scroll past is worse than a board you cannot zoom.
   *
   * ⚠️ IT DOES NOT WAIT FOR THE ONE-SECOND HOLD. Wheeling while pressed is already an unambiguous
   * camera gesture — nobody rests a finger on a wheel by accident — so it hands the rest of the
   * press to the camera, which also stops the release from being read as a click on a square the
   * pointer never left.
   */
  canvas.addEventListener('wheel', (e) => {
    if (dragging === null) return;
    e.preventDefault();
    cancelHold();
    turning = true;
    canvas.dataset.turning = 'true';
    camera.dolly(Math.sign(e.deltaY));
    invalidate();
  }, { passive: false });

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
    if (travelled >= CLICK_SLOP) return;

    const rect = canvas.getBoundingClientRect();
    const k = upscale();
    const point = toIllustrationSpace(
      { x: (e.clientX - rect.left) / k, y: (e.clientY - rect.top) / k },
      stage.viewport(),
    );
    stage.update();
    const hit = pickTopmost(boardView.quads(), point);
    if (hit !== null) ctx.activate(squareFromIndex(hit));
  });

  return {
    hudControls: {
      pieceSets: PIECE_DESIGNS.map((d) => ({ key: d.key, label: ctx.i18n.t(d.name) })),
      pieceSet: () => designKey,
      onPieceSet: (key) => {
        designKey = key;
        pieces.setDesign(key);
        prefs.save({ design: key });
        invalidate();
      },
      outline: () => outlined,
      onOutline: (on) => {
        outlined = on;
        pieces.setOutline(on);
        prefs.save({});
        invalidate();
      },
      coordinates: () => showCoordinates,
      onCoordinates: (on) => {
        showCoordinates = on;
        coordinates.setVisible(on);
        prefs.save({ coordinates: on });
        invalidate();
      },
    },

    applyTheme: (key) => {
      themeKey = key;
      boardView.setPalette(palette());
      pieces.setPalette(palette());
      invalidate();
    },

    drawPosition: (hidden, travelling) => {
      // The rules have ALREADY applied the move — forwards or backwards — so a travelling piece is
      // standing on the square it is flying TO. It is left out of the static set and drawn
      // separately, in flight.
      const placements = rules.placements()
        .filter((p) => !hidden.some((s) => s.x === p.square.x && s.y === p.square.y));
      pieces.setPosition(placements);
      pieces.setTravelling(travelling);
      invalidate();
    },

    drawMarks: (markers, hints) => {
      // A hint is drawn over the game's own state rather than competing with it for squares.
      boardView.setHintArrows(hints);
      boardView.setMarkers(markers);
      invalidate();
    },

    travel: (from: Square, to: Square) => {
      // ⚠️ An outstanding leg is settled before a new one starts. A promise abandoned here strands
      // the shell inside its own `finally`, and the panel's two buttons die with nothing to say.
      landed?.();
      landed = null;

      const move = createMoveAnimation(from, to, { reducedMotion: ctx.reducedMotion() });
      // Reduced motion is NO animation. There is no frame to wait for, and waiting for one would
      // hang forever on a pane the browser has stopped ticking.
      if (move.done()) { animation = null; invalidate(); return Promise.resolve(); }

      animation = move;
      return new Promise<void>((resolve) => { landed = resolve; });
    },

    relayout: () => {
      cssPerPixel = canvas.getBoundingClientRect().width / LOGICAL_W;
      // The labels are positioned in CSS pixels, so a resize moves them even though the canvas
      // itself is only rescaled. Nothing else here needs a redraw on resize; they do.
      invalidate();
    },

    onKey: (event) => {
      if (!event.shiftKey) return false;

      /*
       * ⚠️ THE ZOOM NEEDS A KEY FOR THE SAME REASON THE TURN DOES. WCAG 2.5.7 and the rule this
       * repository set itself: nothing may require a drag. A wheel is no more reachable than a
       * drag — less, for anyone driving this by keyboard alone.
       */
      const zoomed = { '+': -1, '=': -1, '-': +1, _: +1 }[event.key];
      if (zoomed !== undefined) { camera.dolly(zoomed); invalidate(); return true; }

      const direction = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      }[event.key];
      if (!direction) return false;
      camera.nudge(direction as 'left' | 'right' | 'up' | 'down');
      invalidate();
      return true;
    },

    debug: () => ({
      camera,
      coordinates,
      stage,
      boardView,
      pieces,
      /** Whether a press has been held long enough to turn the board. */
      turning: () => turning,
      /** Client coordinates of a square's centre, for driving the board from the console. */
      screenOf(square: Square): { x: number; y: number } | null {
        stage.update();
        const quad = boardView.quads()[squareIndex(square)];
        if (!quad) return null;
        const cx = (quad.corners[0].x + quad.corners[1].x + quad.corners[2].x + quad.corners[3].x) / 4;
        const cy = (quad.corners[0].y + quad.corners[1].y + quad.corners[2].y + quad.corners[3].y) / 4;
        const port = stage.viewport();
        const rect = canvas.getBoundingClientRect();
        const k = upscale();
        return {
          x: rect.left + (cx * port.zoom + port.width / 2) * k,
          y: rect.top + (cy * port.zoom + port.height / 2) * k,
        };
      },
      /** Advances the loop by hand — a hidden pane never fires requestAnimationFrame. */
      step: frame,
      design: () => pieceDesign(designKey),
    }),

    destroy: () => {
      ticker.destroy();
      stage.destroy();
      coordinates.destroy();
    },
  };
};
