// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/view-solid — the WebGL board: real solids, real lights, a camera you orbit.
//
// ========================= WHAT THIS VIEW IS FOR =========================
// `render/pieces/geometry.ts` is a TABLE rather than a set of drawing calls, and this is what that
// decision bought: Three reads the same table Zdog reads, and `tests/pieces3d.node.test.ts`
// measures the solids against the flat renderer's own arithmetic. Two renderers, one set of shapes,
// nothing to drift.
//
// ⚠️ THE BOARD HERE DOES NOT USE THE ENGINE'S 320×180. A pseudo-3D drawing of flat shapes is a
// PIXEL image and must be upscaled whole; a WebGL scene is resolution-independent by construction,
// and rendering it small to blow it up would throw away the one thing this view is for. The region
// is a LAYOUT box here, not a pixel grid — both statements are true at once, and conflating them
// is what cost a working first frame.

import * as THREE from 'three';
import { SAME_LEVEL_CP } from '../chess/engine/same-level.ts';
import type { Square } from '../chess/types.ts';
import { hintHue, projectedPalette } from '../render/palette.ts';
import { DEFAULT_DESIGN, PIECE_DESIGNS } from '../render/pieces/sets.ts';
import { TILE } from '../render/resolution.ts';
import { specs3dFor } from '../render3d/geometry3d.ts';
import { buildPiece3d, disposePiece3d } from '../render3d/pieces.ts';
import { createScene3d, sceneCenter } from '../render3d/scene.ts';
import { projectBoardQuads } from '../render3d/project-quads.ts';
import { createDragToMove } from './drag-to-move.ts';
import type { Quad } from '../render/picking.ts';
import { createCoordinates } from '../ui/coordinates.ts';
import { boardTheme } from '../ui/board-themes.ts';
import type { BoardView, ViewContext, ViewFactory } from './view.ts';

/** How far a pointer may wander during the hold before it counts as a drag rather than a press. */
const SLOP = 6;
/*
 * One key press of camera. The pointer moves 0.008 rad per pixel of drag and reports dozens of
 * events per gesture; a key reports one, so the same number per event would be invisible. These
 * are roughly a comfortable drag's worth: about 5.7 degrees of yaw, 4.3 of pitch.
 */
const YAW_STEP = 0.1;
const PITCH_STEP = 0.075;
/*
 * ========================= ⚠️ THE DEAD HUD COLUMN, FOR THE FOURTH TIME =========================
 * This was 0.725 — "the share of the region the board gets; the panel has the rest" — and it is
 * the complement of the 27.5% that `render/resolution.ts` reserved for a HUD drawn INSIDE the
 * canvas. The teaching mode moved that HUD out to a DOM sibling in `#side-column`, and the same
 * fraction went on holding back a quarter of the board in four independent places: those
 * constants, `render/camera.ts`'s framing, `.board-players`' `right: 27.5%`, and here.
 *
 * The region IS the board now — nine of the stage's sixteen units, a perfect square — so the scene
 * gets all of it. Measured before this line changed: a 360x360 region with a 261x360 canvas in it
 * and 99 pixels of nothing to the right of the board.
 */

export const createSolidView: ViewFactory = (ctx: ViewContext): BoardView => {
  const { doc, region, mirror, prefs, rules } = ctx;

  let designKey = prefs.remembered.design ?? DEFAULT_DESIGN;
  let themeKey = prefs.remembered.theme ?? '';
  /**
   * ⚠️ UNLIT IN HIGH CONTRAST, and this is not a style. Those palettes were solved numerically —
   * every pair that touches clears 3:1 — and a light source moves every one of those numbers by an
   * amount nobody measured. Lighting a high-contrast board undoes the only thing it is for.
   */
  const unlit = (): boolean => themeKey.startsWith('contrast-');

  const canvas = doc.createElement('canvas');
  canvas.className = 'stage-3d';
  // Hidden from the screen reader ON PURPOSE — the game speaks through the DOM, and the grid
  // carries the board. ⚠️ This view went without it for its whole life, so a reader met an
  // unlabelled canvas before the board it could actually use.
  canvas.setAttribute('aria-hidden', 'true');
  region.appendChild(canvas);
  // BEFORE the canvas in the DOM, for the same reason. Also new here.
  region.insertBefore(mirror.root, canvas);

  /*
   * ⚠️ FILE AND RANK LABELS THAT TURN WITH THE BOARD (2026-10-03). This view carried STATIC
   * labels for a few hours — a CSS column and row pinned to the canvas's edges — on the reasoning
   * that Three's perspective would make projected labels jump. The Dev's screenshots settled it
   * the other way: a label that does not follow the board when the board is dragged is a label
   * pointing at the wrong rank. So the 3D view uses the SAME `ui/coordinates` module the 2.5D one
   * does, fed by quads this file projects through Three's own camera.
   */
  const coordinates = createCoordinates({ doc, visible: prefs.remembered.coordinates ?? true });
  region.appendChild(coordinates.root);

  /*
   * The 64 squares' corners, projected to canvas pixels measured FROM THE CANVAS CENTRE — which
   * is the space `ui/coordinates` works in (it was written against Zdog's illustration space, and
   * that is what `viewport.zoom = 1` below declares this to be).
   *
   * ⚠️ THE CORNER ORDER IS A CONTRACT AND IT LIVES IN `render3d/project-quads.ts`, with the
   * reason it is not the obvious one and the record of it being got wrong twice. It is a module
   * rather than four lines here precisely so that a test can reach it.
   */
  const projected = new THREE.Vector3();
  const projectQuads = (): Quad[] =>
    projectBoardQuads(scene.camera, projected, canvas.width, canvas.height);

  /**
   * Repositions the labels against the camera as it stands now.
   *
   * ⚠️ `zoom: 1` IS NOT A PLACEHOLDER. `coordinates.put()` computes
   * `(point.x * zoom + width / 2) * upscale`; `projectQuads` has already applied the camera, so
   * the points arrive in canvas pixels and the only work left is the centring and the CSS
   * upscale. Zdog's own viewport carries a zoom because its points arrive unzoomed.
   */
  const placeCoords = (): void => {
    const box = canvas.getBoundingClientRect();
    if (box.width < 1) return;
    coordinates.place(
      projectQuads(),
      { width: canvas.width, height: canvas.height, zoom: 1 },
      box.width / canvas.width,
    );
  };

  const theme = boardTheme(themeKey);
  const scene = createScene3d({
    canvas,
    flipped: ctx.playerSide === 'b',
    unlit: unlit(),
    light: theme.light,
    dark: theme.dark,
    rim: theme.rim,
  });

  /** The arrows, as flat shapes lying on the board. Rebuilt whenever the advice changes. */
  const arrows = new THREE.Group();
  scene.scene.add(arrows);

  /**
   * ⚠️ THREE DOES NOT FREE A GEOMETRY when its mesh leaves the scene — it is a GPU buffer and it
   * stays there until something disposes it. Rebuilding thirty-two pieces a few times a minute
   * without disposing is a leak that only shows up after a long game, on the machine least able to
   * afford it.
   */
  function drawPieces(hidden: readonly Square[]): void {
    for (const child of [...scene.pieces.children]) {
      scene.pieces.remove(child);
      disposePiece3d(child as THREE.Group);
    }
    const palette = projectedPalette(boardTheme(themeKey));
    // ⚠️ The 3D table, not the shared one. Two Hartwig pieces in the shared table are the design
    // as a PAINTER'S ALGORITHM can draw it rather than as Hartwig described it — see
    // `render3d/geometry3d.ts`. Neither constraint exists here.
    const specs = specs3dFor(designKey);
    for (const { piece, square } of rules().placements()) {
      if (hidden.some((s) => s.x === square.x && s.y === square.y)) continue;
      /*
       * ⚠️ NO OUTLINE HERE, and that is the point of this view. The flat and projected boards draw
       * one because they have no light. This scene has three lights and real perspective, which do
       * that job properly — an inverted hull on top of them adds a black rim that reads as a
       * drawing convention carried over from a renderer that needed it.
       */
      const group = buildPiece3d(
        specs[piece.type],
        piece.side === 'w' ? palette.lightPieces : palette.darkPieces,
        { unlit: unlit() },
      );
      const { x, z } = sceneCenter(square, TILE);
      group.position.set(x, 0, z);
      scene.pieces.add(group);
    }
  }

  function clearArrows(): void {
    for (const child of [...arrows.children]) {
      arrows.remove(child);
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }

  /* ---------- the pointer: a press selects, a HOLD turns the table ---------- */

  let holding = false;
  let turning = false;
  let last = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let holdTimer = 0;

  /** The square under a client point, or null off the board. Raycast against the real meshes. */
  const squareAt = (point: { clientX: number; clientY: number }): Square | null => {
    const box = canvas.getBoundingClientRect();
    return scene.pick(point.clientX - box.left, point.clientY - box.top, box.width, box.height);
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
    focus: (square) => mirror.focusSquare(square),
    cancelHold: () => window.clearTimeout(holdTimer),
  });

  canvas.addEventListener('pointerdown', (event) => {
    start = { x: event.clientX, y: event.clientY };
    last = start;
    holding = true;
    turning = false;
    // ⚠️ The same one-second hold the projected view uses, and for the same reason: a teacher
    // pointing at a square in front of a class must not spin the board by resting a finger on it.
    holdTimer = window.setTimeout(() => { if (holding) turning = true; }, 1000);
    carry.down(event);
    try { canvas.setPointerCapture(event.pointerId); } catch { /* no such pointer */ }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!holding) return;
    /*
     * ⚠️ THE CARRY IS OFFERED THE MOVE BEFORE THE CAMERA, AND ONLY WHILE THE TABLE IS NOT TURNING.
     * Once the hold has fired the press belongs to the camera for good, which is what keeps a
     * teacher who has been resting a finger on the board from flinging a piece when they move.
     */
    if (!turning && carry.move(event)) return;
    if (!turning) return;
    /*
     * ⚠️ THE VIEWER WALKS AROUND THE BOARD — the opposite model to the projected view's camera,
     * where dragging pushes the TABLE (`render/camera.ts` argues that at length, and it stays as it
     * is). Both are defensible and they are exact opposites; which one reads depends on whether the
     * scene has real perspective. This one does, so the drag moves the eye.
     */
    scene.orbit((event.clientX - last.x) * 0.008, (event.clientY - last.y) * 0.006);
    last = { x: event.clientX, y: event.clientY };
  });

  /*
   * ========================= THE WHEEL ZOOMS, BUT ONLY WHILE PRESSED =========================
   * A bare wheel over the canvas has to keep scrolling the page — the board fills the viewport on a
   * small screen, and a page you cannot scroll past is worse than a board you cannot zoom.
   *
   * ⚠️ `turning` is set here rather than waited for. Wheeling while pressed is already an
   * unambiguous camera gesture, so it hands the rest of this press over to the camera and stops the
   * release from being read as a click on a square the pointer never left.
   */
  canvas.addEventListener('wheel', (event) => {
    if (!holding) return;
    event.preventDefault();
    // The press is the camera's now, so whatever was in hand is put back down untouched.
    carry.abandon();
    turning = true;
    scene.dolly(Math.sign(event.deltaY));
  }, { passive: false });

  const release = (event: PointerEvent): void => {
    window.clearTimeout(holdTimer);
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    /*
     * ⚠️ THE CARRY IS SETTLED BEFORE THE SLOP CHECK BELOW. A carry has travelled further than a
     * click by definition, so `moved < SLOP` would drop it on the floor — the piece would be
     * picked up and never put down.
     */
    const dropped = turning ? (carry.abandon(), false) : carry.up(event);
    if (!dropped && holding && !turning && moved < SLOP) {
      const square = squareAt(event);
      if (square) {
        mirror.focusSquare(square);
        ctx.activate(square);
      }
    }
    holding = false;
    turning = false;
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* no such pointer */ }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  return {
    hudControls: {
      pieceSets: () => PIECE_DESIGNS.map((d) => ({ key: d.key, label: ctx.i18n.t(d.name) })),
      pieceSet: () => designKey,
      onPieceSet: (key) => {
        designKey = key;
        drawPieces([]);
        prefs.save({ design: key });
      },
      /*
       * ⚠️ NO COORDINATE LABELS ON THIS BOARD, and the switch says so by being absent rather than
       * by lying. The other two lay DOM text over a board whose squares project to a known place on
       * a fixed canvas; here the camera orbits and zooms freely, so a label would have to be
       * re-projected every frame from a live perspective matrix. That is real work and it has not
       * been done — see `docs/` and the debts in the plan.
       */
      coordinates: () => coordinates.visible(),
      onCoordinates: (on: boolean) => {
        coordinates.setVisible(on);
        prefs.save({ coordinates: on });
        placeCoords();
      },
    },

    applyTheme: (key) => {
      themeKey = key;
      const next = boardTheme(key);
      scene.setBoard(next.light, next.dark, next.rim, unlit());
      drawPieces([]);
    },

    drawPosition: (hidden) => { drawPieces(hidden); },

    drawMarks: (markers, hints, cursor) => {
      /*
       * ⚠️ THESE USED TO BE DROPPED. `render3d/scene.ts` had no marker channel, so this board could
       * not show which square was selected, where the piece being held could go, or which king was
       * in check — three facts a player here learned only from the screen reader's labels, which is
       * to say only if they were using one. It is why lessons were switched off on this page.
       */
      scene.setMarkers(markers, cursor);
      clearArrows();
      for (const hint of hints) {
        const from = sceneCenter(hint.from, TILE);
        const to = sceneCenter(hint.to, TILE);
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const length = Math.hypot(dx, dz);
        if (length < 1e-6) continue;

        // A flat arrow drawn in its own local space and then laid on the board. Simpler than the
        // flat renderer's path because a mesh may overlap itself without a painter's algorithm
        // minding.
        const shape = new THREE.Shape();
        const w = TILE * 0.09;
        const head = TILE * 0.34;
        shape.moveTo(TILE * 0.34, -w);
        shape.lineTo(length - head, -w);
        shape.lineTo(length - head, -w * 2.4);
        shape.lineTo(length - TILE * 0.06, 0);
        shape.lineTo(length - head, w * 2.4);
        shape.lineTo(length - head, w);
        shape.lineTo(TILE * 0.34, w);
        shape.closePath();

        const mesh = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({
            color: hintHue(hint.behind, SAME_LEVEL_CP),
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
          }),
        );
        mesh.rotation.set(Math.PI / 2, 0, 0, 'XYZ');
        mesh.rotation.z = Math.atan2(dz, dx);
        // Just above the board's face, so it is drawn ON the squares and under the pieces.
        mesh.position.set(from.x, -0.15, from.z);
        arrows.add(mesh);
      }
    },

    /*
     * ⚠️ RESOLVES AT ONCE, BECAUSE NOTHING FLIES HERE YET. This board places a piece where the
     * rules put it, exactly as it did before the shell existed — `onTakeBack` used to be a bare
     * `game.takeBack()`. Keeping that behaviour is what makes this a structural change and not a
     * behavioural one; a real tween is a separate, easy commit now that the seam exists, and it is
     * the same shape the projected view already uses.
     */
    travel: () => Promise.resolve(),

    /*
     * ========================= ⚠️ THIS VIEW HAD NO KEYBOARD CAMERA AT ALL =========================
     * The board here orbits on a pointer drag and zooms on a wheel, and neither had an equivalent
     * anybody could reach from a keyboard — a plain WCAG 2.1.1 failure in the one view whose whole
     * selling point is that you can walk around the board. The projected view has had this since
     * its camera was written; the solid one got the pointer half and never the other.
     *
     * ⚠️ AND THE HINT LINE HAS BEEN PROMISING IT. "⇧ + WASD gira o tabuleiro" is printed under
     * this board, which makes the gap worse than an omission: somebody pressing the named key and
     * getting nothing concludes the keyboard does not work here.
     *
     * The steps are deliberately coarser than a pointer's. A drag reports many small deltas and a
     * key reports one event, so matching the pointer's per-event amount would make a key press
     * imperceptible — the same reason `render/camera.ts` gives its own `nudge` a step of its own.
     */
    onKey: (event) => {
      if (!event.shiftKey) return false;

      const zoomed = { '+': -1, '=': -1, '-': +1, _: +1 }[event.key];
      if (zoomed !== undefined) { scene.dolly(zoomed); return true; }

      const turn: Record<string, readonly [number, number]> = {
        ArrowLeft: [-YAW_STEP, 0], ArrowRight: [YAW_STEP, 0],
        ArrowUp: [0, -PITCH_STEP], ArrowDown: [0, PITCH_STEP],
        A: [-YAW_STEP, 0], D: [YAW_STEP, 0], W: [0, -PITCH_STEP], S: [0, PITCH_STEP],
      };
      const by = turn[event.key.length === 1 ? event.key.toUpperCase() : event.key];
      if (!by) return false;
      scene.orbit(by[0], by[1]);
      return true;
    },

    /**
     * One frame. A WebGL scene is redrawn whole every time, so there is no dirty flag to consult
     * and nothing here reads `dt` — the orbit is set by input rather than integrated.
     *
     * ⚠️ THIS FILE USED TO BUILD ITS OWN TICKER AND CALL `startLoop`, and ADR-0139 §3 is what
     * moved it: a cartridge never starts a loop. The `aoFalhar` it passed was a `console.error`,
     * which announces a dead board to whoever has a console open; the shell passes the engine's,
     * which reaches the screen reader.
     */
    frame: () => { scene.render(); placeCoords(); },

    relayout: () => {
      /*
       * ⚠️ SOMETHING ELSE SIZES THIS BOX AND THIS VIEW ONLY READS IT. Without that, the canvas
       * comes out one pixel by one, which is exactly what the first run did.
       *
       * ⚠️ AND «THE ENGINE» IS WHAT THIS LINE USED TO SAY, MEASURED AND WRONG. The engine's own
       * `ui/layout()` is never called by `createGame` — checked on the running page: `#game-region`
       * carries no `--ui-fs` written by it. This game has its OWN `ui/layout.ts`, whose header says
       * so in its first paragraph, and that is what sizes the board.
       */
      const box = region.getBoundingClientRect();
      scene.resize(Math.max(1, box.width), Math.max(1, box.height));
      placeCoords();
    },

    debug: () => ({
      scene,
      canvas,
      design: () => designKey,
      /**
       * Draws one frame by hand, the same hook the projected view exposes as `step`.
       * ⚠️ A hidden pane never fires requestAnimationFrame, so a board verified from a screenshot
       * is a board that has to be drawable on demand — otherwise it is black and the reason is
       * indistinguishable from a fault.
       */
      step: () => { scene.render(); placeCoords(); },
    }),

    destroy: () => {
      clearArrows();
      scene.destroy();
      /*
       * ⚠️ TAKE THE CANVAS OFF THE REGION, 2026-10-03. `scene.destroy()` releases Three's GPU
       * buffers but leaves the `canvas.stage-3d` in the DOM; the next `switchView` would stack a
       * new renderer's canvas on top and the dead 3D canvas would keep painting (black, in the
       * 3D case) over the live board.
       */
      canvas.remove();
      // The label overlay goes with the canvas.
      coordinates.destroy();
    },
  };
};
