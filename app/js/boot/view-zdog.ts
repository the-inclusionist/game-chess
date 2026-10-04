// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/view-zdog — the projected board: a Zdog stage, a camera you can turn, and work to do per frame.
//
// ========================= IT HAS A FRAME, AND NOT A CLOCK =========================
// The flat board draws a position and stops. This one has a camera that moves and pieces that fly,
// so it exports `frame(dt)` — and `dt` is in FRAMES, a convention `render/animation.ts` inherited
// from PixiJS, which is why nothing here is expressed in seconds.
//
// ⚠️ IT USED TO OWN THE CLOCK TOO, building a ticker and calling `startLoop` itself, and ADR-0139 §3
// is what took that away: a cartridge never starts a loop, because inside a platform the loop is the
// page's. The shell drives this now. Two consequences that were not free:
//
//   · ONE TICKER FOR THE PAGE instead of one per view. Switching view used to destroy a clock and
//     build another; there is now nothing to leak and nothing to forget.
//   · THE ANNOUNCEMENT IS REAL. This file passed `console.error` to `aoFalhar`, which reaches
//     whoever has a console open. The shell passes the engine's own, which reaches the screen
//     reader — and a child who cannot see the screen cannot tell a frozen board from a thinking one.
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

import type { Piece, Square } from '../chess/types.ts';
import { squareCenter, squareFromIndex, squareIndex } from '../render/board-geometry.ts';
import { createMoveAnimation, type MoveAnimation } from '../render/animation.ts';
import { createBoard } from '../render/board.ts';
import { CAMERA, createZdogStage } from '../render/zdog-stage.ts';
import { createCamera, ROTATE_HOLD_MS } from '../render/camera.ts';
import { createPiecesLayer } from '../render/pieces/index.ts';
import { DEFAULT_DESIGN, PIECE_DESIGNS, pieceDesign } from '../render/pieces/sets.ts';
import { projectedPalette } from '../render/palette.ts';
import { pickTopmost, toIllustrationSpace } from '../render/picking.ts';
import { LOGICAL_W, TILE } from '../render/resolution.ts';
import { boardTheme } from '../ui/board-themes.ts';
import { createCoordinates } from '../ui/coordinates.ts';
import { createHintOverlay } from '../ui/hint-overlay.ts';
import { createDragToMove } from './drag-to-move.ts';
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
  /*
   * ⚠️ THE TEACHER'S ARROWS ARE AN OVERLAY, NOT ZDOG SHAPES (2026-10-04). They came out halved:
   * a painter orders WHOLE shapes, so a shaft crossing several squares is entirely in front of
   * or behind each one, and the nearer squares paint over its tail. See `ui/hint-overlay.ts`.
   */
  const hintOverlay = createHintOverlay({ doc });

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
  region.appendChild(hintOverlay.root);

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

  /**
   * CSS pixels per canvas pixel, measured now.
   *
   * ========================= ⚠️ `Math.max(1, ...)` IS WHAT BROKE THE MOUSE =========================
   * This line used to floor the ratio at 1, on the premise in its old comment — "the engine scales
   * the region by a whole number" — which was true while the board was a pixel image upscaled by
   * whole pixels and stopped being true the moment the Dev asked for a SMALLER board on
   * 2026-10-03. The canvas raster stayed 360 and its CSS box became 280, so the real ratio is
   * 0.78 and this answered 1.
   *
   * Every pointer coordinate was then divided by 1 instead of by 0.78 — treated as if the click
   * had landed 28% nearer the canvas's top-left corner than it had. Measured with a real mouse on
   * 2026-10-04: clicking the pawn on e2 selected nothing and moved the cursor to d4.
   *
   * That is the whole of two reports. "O tabuleiro 2,5D nao funciona com mouse clicando na peca":
   * the click resolves to an empty square somewhere up and to the left. "Ainda nao consigo
   * arrastar e soltar": the carry asks the same question to decide whether a press is on a piece
   * with somewhere to go, gets an empty square, and correctly refuses — so the gesture does
   * nothing at all.
   *
   * ⚠️ AND THE SAME RATIO WAS ALREADY WRITTEN CORRECTLY TWENTY LINES AWAY. `cssPerPixel`, which
   * positions the coordinate labels, has always been the unfloored `width / LOGICAL_W` — which is
   * exactly why the letters sat in the right place while the pointer did not, and why nothing
   * looked wrong until someone tried to play. One fact, two expressions, and they drifted. They
   * are one expression now, and `relayout` caches it rather than restating it.
   *
   * The guard that remains is against a DEGENERATE box — detached, or `display: none` — because
   * dividing by zero is a different problem from dividing by a small number.
   */
  const upscale = (): number => {
    const width = canvas.getBoundingClientRect().width;
    return width > 0 ? width / LOGICAL_W : 1;
  };

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
    // Same quads, same frame: the arrows and the labels are both read off the projection the
    // renderer has just finished, so neither can lag a turn behind the board.
    hintOverlay.place(boardView.quads(), stage.viewport(), cssPerPixel);
  }

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

  /**
   * The square under a client point, or null off the board.
   *
   * ⚠️ `stage.update()` FIRST, because `quads()` reads what the renderer last flattened and a
   * carry asks this on every pointer move — including moves that arrive between two frames.
   */
  const squareAt = (point: { clientX: number; clientY: number }): Square | null => {
    const rect = canvas.getBoundingClientRect();
    const k = upscale();
    const at = toIllustrationSpace(
      { x: (point.clientX - rect.left) / k, y: (point.clientY - rect.top) / k },
      stage.viewport(),
    );
    stage.update();
    const hit = pickTopmost(boardView.quads(), at);
    return hit === null ? null : squareFromIndex(hit);
  };

  /** How far a carried piece is lifted off the board, in board units. Negative is up. */
  const CARRY_LIFT = -TILE * 0.55;

  let carriedFrom: Square | null = null;
  let carriedAt: { x: number; z: number } | null = null;
  let shellHidden: readonly Square[] = [];
  let shellTravelling: Piece | null = null;

  /**
   * Draws the position, with whatever the shell has hidden AND whatever the pointer is holding.
   *
   * ⚠️ ONE PAINTER FOR TWO CALLERS. The shell hides a square while a move flies; the pointer hides
   * one while a hand holds it. Two functions each doing half would mean a shell redraw mid-drag
   * put the carried piece back on the board underneath the one in the air.
   */
  function paint(): void {
    const hidden = carriedFrom ? [...shellHidden, carriedFrom] : shellHidden;
    const placements = rules().placements()
      .filter((p) => !hidden.some((sq) => sq.x === p.square.x && sq.y === p.square.y));
    pieces.setPosition(placements);
    // The rules have ALREADY applied a travelling move — forwards or backwards — so that piece is
    // standing on the square it is flying TO. The carried one is standing where it still is.
    pieces.setTravelling(carriedFrom ? rules().pieceAt(carriedFrom) : shellTravelling);
    // ⚠️ `setTravelling` resets the traveller to the origin, so a repaint mid-carry has to put it
    // back under the pointer or the piece jumps to the centre of the board for a frame.
    if (carriedFrom && carriedAt) pieces.moveTravelling(carriedAt.x, CARRY_LIFT, carriedAt.z);
    invalidate();
  }

  /**
   * A client point as a point on the BOARD, between squares rather than on one.
   *
   * ========================= ⚠️ WHY THIS CAN BE DONE AT ALL =========================
   * It is the argument `ui/coordinates.ts` makes, used backwards. Zdog's projection is
   * ORTHOGRAPHIC — it rotates and scales and never divides by depth — so its image of the board
   * plane is AFFINE, and an affine map is invertible from three point pairs. The three used here
   * are a1's projected centre and its two neighbours, which give one tile along each board axis as
   * vectors in illustration space; solving for the point in that basis gives the board position
   * exactly, at any camera angle, with no second copy of the camera's maths.
   *
   * `squareAt` above answers WHICH SQUARE and is what the move needs. This answers WHERE, which is
   * what the hand needs: a piece that snapped from square to square would not be carried, it would
   * be teleported eight times.
   */
  const boardPointAt = (point: { clientX: number; clientY: number }): { x: number; z: number } => {
    const rect = canvas.getBoundingClientRect();
    const k = upscale();
    const at = toIllustrationSpace(
      { x: (point.clientX - rect.left) / k, y: (point.clientY - rect.top) / k },
      stage.viewport(),
    );
    stage.update();
    const quads = boardView.quads();
    const centre = (sx: number, sy: number) => {
      const c = quads[squareIndex({ x: sx, y: sy } as Square)]!.corners;
      return {
        x: (c[0].x + c[1].x + c[2].x + c[3].x) / 4,
        y: (c[0].y + c[1].y + c[2].y + c[3].y) / 4,
      };
    };
    const o = centre(0, 7);                       // a1
    const along = centre(1, 7);                   // b1: one tile along +x
    const back = centre(0, 6);                    // a2: one tile along -z
    const ex = { x: along.x - o.x, y: along.y - o.y };
    const ez = { x: back.x - o.x, y: back.y - o.y };
    const det = ex.x * ez.y - ex.y * ez.x;
    const home = squareCenter({ x: 0, y: 7 } as Square, TILE);
    // A degenerate basis means the board is edge-on and there is no point to find; the piece stays
    // where it was rather than flying to the origin.
    if (Math.abs(det) < 1e-9) return carriedAt ?? { x: home.x, z: home.z };
    const dx = at.x - o.x;
    const dy = at.y - o.y;
    const u = (dx * ez.y - dy * ez.x) / det;      // tiles along +x
    const v = (ex.x * dy - ex.y * dx) / det;      // tiles along -z, because a2 is z - TILE
    return { x: home.x + u * TILE, z: home.z - v * TILE };
  };

  /*
   * ⚠️ PRESS, MOVE, LET GO — the gesture this board did not have. See `boot/drag-to-move.ts` for
   * why it is a module and for how it shares the pointer with the hold-to-turn gesture.
   */
  const carry = createDragToMove({
    squareAt,
    rules: () => ctx.rules(),
    selection: () => ctx.state().selection(),
    activate: (square) => ctx.activate(square),
    focus: (square) => ctx.mirror.focusSquare(square),
    carry: (from, at) => self.carry(from, at),
    cancelHold,
  });

  canvas.addEventListener('pointerdown', (e) => {
    dragging = e.pointerId;
    last = { x: e.clientX, y: e.clientY };
    travelled = 0;
    turning = false;
    carry.down(e);

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
    /*
     * ⚠️ NOT ARMED ON A PIECE. A press that landed on something it can pick up belongs to that
     * piece for its whole life — see `grabbable()` in `boot/drag-to-move.ts`. Off a piece the hold
     * is exactly as it was, which is what keeps a teacher pointing at a square from spinning the
     * board (`render/camera.ts` argues that at length).
     */
    if (!carry.grabbable()) {
      holdTimer = window.setTimeout(() => {
        holdTimer = null;
        if (dragging === null) return;
        turning = true;
        canvas.dataset.turning = 'true';
      }, ROTATE_HOLD_MS);
    }

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
    /*
     * ⚠️ THE CARRY IS OFFERED THE MOVE BEFORE THE CAMERA, AND ONLY WHILE THE BOARD IS NOT TURNING.
     * Once the hold has fired the press belongs to the camera for good, which is what keeps a
     * teacher who has been resting a finger on the board from flinging a piece when they finally
     * move it.
     */
    if (!turning && carry.move(e)) { invalidate(); return; }
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
    // The press is the camera's now, so whatever was in hand is put back down untouched.
    carry.abandon();
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
      carry.abandon();
      return;
    }
    // ⚠️ BEFORE THE SLOP CHECK. A carry has travelled further than a click by definition, so the
    // line below would drop it on the floor — the piece would be picked up and never put down.
    if (carry.up(e)) { invalidate(); return; }
    if (travelled >= CLICK_SLOP) return;

    const hit = squareAt(e);
    if (hit) {
      /*
       * ⚠️ THE KEYBOARD CURSOR FOLLOWS THE MOUSE, and this line was missing while the solid view
       * had it. Clicking a square here acted on it but left the cursor wherever the arrows had
       * last been, so picking a piece up with the mouse and then reaching for the keyboard
       * resumed somewhere else entirely — the two input methods disagreed about where "here" was.
       */
      ctx.mirror.focusSquare(hit);
      ctx.activate(hit);
    }
  });

  const self: BoardView = {
    hudControls: {
      pieceSets: () => PIECE_DESIGNS.map((d) => ({ key: d.key, label: ctx.i18n.t(d.name) })),
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
      shellHidden = hidden;
      shellTravelling = travelling;
      paint();
    },

    carry(from, at) {
      if (!from || !at) {
        if (carriedFrom === null) return;
        // ⚠️ THIS IS ALSO HOW A REFUSED DROP PUTS THE PIECE BACK. The board never changed, so
        // simply painting without the carry restores exactly the position that was there.
        carriedFrom = null;
        paint();
        return;
      }
      if (carriedFrom === null || carriedFrom.x !== from.x || carriedFrom.y !== from.y) {
        carriedFrom = from;
        paint();
      }
      carriedAt = boardPointAt(at);
      pieces.moveTravelling(carriedAt.x, CARRY_LIFT, carriedAt.z);
      invalidate();
    },

    drawMarks: (markers, hints, cursor) => {
      // A hint is drawn over the game's own state rather than competing with it for squares — and
      // since 2026-10-04 it is drawn OVER THE CANVAS rather than in it, so it cannot lose half of
      // itself to a square that happens to sort nearer the camera.
      hintOverlay.setMoves(hints);
      boardView.setMarkers(markers, cursor);
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

    /**
     * The clock is the shell's; this is what it drives.
     *
     * ⚠️ THE ANIMATION HALF CANNOT BE SKIPPED WHEN NOTHING IS DIRTY, which is why `frame` is one
     * function and not two: the resolver that lets the shell walk the score sheet is released from
     * inside it. A `frame` that returned early on a clean board would leave the walk hanging with
     * nothing thrown and nothing logged.
     */
    frame,

    relayout: () => {
      cssPerPixel = upscale();
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

      /*
       * ⚠️ WASD AS WELL AS THE ARROWS, because that is what movement means everywhere else in this
       * game — the engine's solo scheme binds both to the same four intents, and the hint line
       * under the board names WASD. Arrows only was a camera that answered half the promise.
       *
       * Matched on `event.key` and upper-cased: with shift held the browser reports "A", not "a".
       */
      const direction = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        A: 'left', D: 'right', W: 'up', S: 'down',
      }[event.key.length === 1 ? event.key.toUpperCase() : event.key];
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
      stage.destroy();
      coordinates.destroy();
      /*
       * ⚠️ TAKE THE CANVAS AND COORDINATE LABELS OFF THE REGION, 2026-10-03. `stage.destroy()`
       * clears the Zdog children but leaves the canvas element in the DOM; `coordinates.destroy()`
       * does the same for the labels. Nothing in the shell was pulling them, so a `switchView`
       * stacked each old view's canvas on top of the new one — the user's report of 2026-10-03 is
       * that the view buttons were clickable but the board did not change, because the dead 2.5D
       * canvas was still painting over the fresh renderer's output.
       */
      canvas.remove();
      coordinates.root.remove();
      hintOverlay.destroy();
    },
  };
  return self;
};
