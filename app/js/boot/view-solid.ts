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

import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import * as THREE from 'three';
import { SAME_LEVEL_CP } from '../chess/engine/same-level.ts';
import type { Square } from '../chess/types.ts';
import { createFrameTicker } from '../render/frame-ticker.ts';
import { squareCenter } from '../render/board-geometry.ts';
import { hintHue, projectedPalette } from '../render/palette.ts';
import { DEFAULT_DESIGN, PIECE_DESIGNS } from '../render/pieces/sets.ts';
import { TILE } from '../render/resolution.ts';
import { specs3dFor } from '../render3d/geometry3d.ts';
import { buildPiece3d, disposePiece3d } from '../render3d/pieces.ts';
import { createScene3d } from '../render3d/scene.ts';
import { boardTheme } from '../ui/board-themes.ts';
import type { BoardView, ViewContext, ViewFactory } from './view.ts';

/** How far a pointer may wander during the hold before it counts as a drag rather than a press. */
const SLOP = 6;
/** The share of the region the board gets; the panel has the rest. */
const BOARD_SHARE = 0.725;

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

  const ticker = createFrameTicker();
  startLoop(ticker, () => { scene.render(); }, 2, {
    aoFalhar: (error: unknown) => {
      // ⚠️ A loop that stops silently leaves a frozen picture. A child who cannot see the screen
      // has no way to know the game has died.
      console.error('[chess3d] frame failed', error);
    },
  });

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
    for (const { piece, square } of rules.placements()) {
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
      const { x, z } = squareCenter(square, TILE);
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

  canvas.addEventListener('pointerdown', (event) => {
    start = { x: event.clientX, y: event.clientY };
    last = start;
    holding = true;
    turning = false;
    // ⚠️ The same one-second hold the projected view uses, and for the same reason: a teacher
    // pointing at a square in front of a class must not spin the board by resting a finger on it.
    holdTimer = window.setTimeout(() => { if (holding) turning = true; }, 1000);
    try { canvas.setPointerCapture(event.pointerId); } catch { /* no such pointer */ }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!holding || !turning) return;
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
    turning = true;
    scene.dolly(Math.sign(event.deltaY));
  }, { passive: false });

  const release = (event: PointerEvent): void => {
    window.clearTimeout(holdTimer);
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (holding && !turning && moved < SLOP) {
      const box = canvas.getBoundingClientRect();
      const square = scene.pick(
        event.clientX - box.left, event.clientY - box.top, box.width, box.height,
      );
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
      pieceSets: PIECE_DESIGNS.map((d) => ({ key: d.key, label: ctx.i18n.t(d.name) })),
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
      coordinates: () => false,
      onCoordinates: () => { /* nothing to show or hide */ },
    },

    applyTheme: (key) => {
      themeKey = key;
      const next = boardTheme(key);
      scene.setBoard(next.light, next.dark, next.rim, unlit());
      drawPieces([]);
    },

    drawPosition: (hidden) => { drawPieces(hidden); },

    drawMarks: (_markers, hints) => {
      /*
       * ⚠️ THE MARKERS ARE DROPPED, and that is a gap rather than a decision. `render3d/scene.ts`
       * has no marker channel: this board cannot show which square is selected, which squares a
       * piece can reach, or which king is in check. It is older than the shell — the other two
       * views have had it all along — and it is recorded rather than hidden, because a player here
       * currently learns those three facts only from the screen reader's labels.
       */
      clearArrows();
      for (const hint of hints) {
        const from = squareCenter(hint.from, TILE);
        const to = squareCenter(hint.to, TILE);
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

    relayout: () => {
      // ⚠️ THE ENGINE STILL SIZES THE REGION and it must: `#game-region` is what the panel, the
      // strips and every `--ui-fs` are laid out against. Without it the region has no size at all
      // and the canvas comes out one pixel by one, which is exactly what the first run did.
      const box = region.getBoundingClientRect();
      scene.resize(Math.max(1, box.width * BOARD_SHARE), Math.max(1, box.height));
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
      step: () => { scene.render(); },
    }),

    destroy: () => {
      ticker.destroy();
      clearArrows();
      scene.destroy();
    },
  };
};
