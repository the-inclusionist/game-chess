// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/hint-overlay — the teacher's arrows, in SVG, over the projected board.
//
// ========================= ⚠️ WHY THEY LEFT THE ZDOG GRAPH =========================
// They were Zdog shapes lying on the board, and they came out HALVED. The Dev reported it on
// 2026-10-04 — "as setas estão aparecendo pela metade" — and named the cause in substance: the
// renderer can only order WHOLE SHAPES.
//
// Zdog is a painter. Every shape gets ONE sort value, the mean depth of its points, and the shapes
// are drawn in that order. An arrow's shaft crosses several squares, so it is entirely in front of
// or entirely behind each one of them — and the squares nearer the camera are painted after it,
// over the half of the shaft that lies above them. Measured: the shaft ran from z = 34.6 to
// z = 9.6, mean 22; the rank-2 square sits at z = 40, is therefore painted later, and takes the
// tail with it.
//
// ⚠️ LIFTING THEM IS THE ONE-LINE FIX AND IT IS WRONG. Raising the arrows above every square's
// sort value does make them whole — proved on the running build — but they then float, and the
// parallax moves them off the squares they name. Worse, the offset CHANGES WITH THE CAMERA, so a
// height that looks right head-on is wrong the moment a child turns the board.
//
// ========================= WHY SVG, AND WHY IT IS NOT A THIRD IMPLEMENTATION =========================
// This board already draws text it cannot draw in Zdog — the file letters and rank numbers — by
// putting real elements over the canvas and positioning them from the projection. `ui/coordinates`
// explains at length why that is EXACT rather than approximate: Zdog's projection is orthographic,
// an orthographic projection of a plane is AFFINE, and an affine map preserves straight lines and
// ratios along them. An arrow is a straight line between two square centres. The same argument
// carries it, unchanged.
//
// So this is the same overlay idea applied to the same problem, not a new one: no painter to lose
// to, no shapes on the Zdog budget, and the arrow stays ON the squares it names at every angle.
//
// ⚠️ AND THE GEOMETRY IS NOT REWRITTEN. `render/hint-arrows.ts` already says of its `tile`
// argument: "an arrow keeps its proportions whether it is drawn across 8 SVG units or 80 Zdog
// ones". It was built for this. The arithmetic below is the projection, and nothing else.

import { SAME_LEVEL_CP } from '../chess/engine/same-level.ts';
import { squareIndex } from '../render/board-geometry.ts';
import { arrowBetween, arrowWidth } from '../render/hint-arrows.ts';
import { hintHue } from '../render/palette.ts';
import type { HintMove } from '../render/hint-arrows.ts';
import type { Quad, Viewport } from '../render/picking.ts';
import type { Square } from '../chess/types.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface HintOverlay {
  readonly root: SVGSVGElement;
  /** The moves to draw. Replaces the previous set; an empty one clears. */
  setMoves(moves: readonly HintMove[]): void;
  /**
   * Redraws from the projected board. Valid only after the stage has updated its graph — the same
   * precondition `quads()` carries for picking, and the same one `ui/coordinates.place` carries.
   */
  place(quads: readonly Quad[], viewport: Viewport, upscale: number): void;
  destroy(): void;
}

export interface HintOverlayDeps {
  readonly doc: Document;
}

type Point = { x: number; y: number };

export function createHintOverlay(deps: HintOverlayDeps): HintOverlay {
  const { doc } = deps;

  const root = doc.createElementNS(SVG_NS, 'svg');
  root.setAttribute('class', 'hint-overlay');
  /*
   * ⚠️ HIDDEN FROM THE READER, like `.coords` and for the same reason. The suggestion is already
   * spoken — "A engine jogaria e2 e4" — in the player's own language and with the moves named.
   * Eight unlabelled paths in front of that would be noise.
   */
  root.setAttribute('aria-hidden', 'true');

  let moves: readonly HintMove[] = [];

  /** The projected centre of a square, in CSS pixels measured from the canvas's top-left. */
  const centre = (
    quads: readonly Quad[], square: Square, viewport: Viewport, upscale: number,
  ): Point | null => {
    const quad = quads[squareIndex(square)];
    if (!quad) return null;
    const c = quad.corners;
    const x = (c[0].x + c[1].x + c[2].x + c[3].x) / 4;
    const y = (c[0].y + c[1].y + c[2].y + c[3].y) / 4;
    // The same conversion `ui/coordinates.put` does, and for the same reason: the overlay is
    // positioned against the CANVAS rather than against the page.
    return {
      x: (x * viewport.zoom + viewport.width / 2) * upscale,
      y: (y * viewport.zoom + viewport.height / 2) * upscale,
    };
  };

  return {
    root,

    setMoves(next) {
      moves = next;
    },

    place(quads, viewport, upscale) {
      const paths: SVGPathElement[] = [];

      for (const move of moves) {
        const from = centre(quads, move.from, viewport, upscale);
        const to = centre(quads, move.to, viewport, upscale);
        if (!from || !to) continue;

        /*
         * ========================= ⚠️ ONE SQUARE, MEASURED ALONG THIS ARROW =========================
         * `arrowBetween` wants the length of one square in the units it is drawing in, and under a
         * projection that is not one number: the board is foreshortened, so a square is shorter
         * along the rank axis than along the file axis.
         *
         * The honest answer is the square as it appears ALONG THIS ARROW'S OWN DIRECTION, which
         * the projection hands over for free: the arrow spans a known number of squares, so one
         * square is its projected length divided by that number. Exact, because the map is affine,
         * and it keeps every arrow's head and insets in proportion to the squares it crosses
         * rather than to some board-wide average.
         */
        const steps = Math.max(
          Math.abs(move.to.x - move.from.x),
          Math.abs(move.to.y - move.from.y),
        );
        if (steps === 0) continue;
        const tile = Math.hypot(to.x - from.x, to.y - from.y) / steps;

        const arrow = arrowBetween(from, to, tile);
        if (!arrow) continue;

        const d = `M${arrow.tail.x.toFixed(2)} ${arrow.tail.y.toFixed(2)}`
          + `L${arrow.head.x.toFixed(2)} ${arrow.head.y.toFixed(2)}`
          + `M${arrow.wings[0].x.toFixed(2)} ${arrow.wings[0].y.toFixed(2)}`
          + `L${arrow.head.x.toFixed(2)} ${arrow.head.y.toFixed(2)}`
          + `L${arrow.wings[1].x.toFixed(2)} ${arrow.wings[1].y.toFixed(2)}`;

        const path = doc.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', hintHue(move.behind, SAME_LEVEL_CP));
        path.setAttribute('stroke-width', String(tile * arrowWidth(move.behind, SAME_LEVEL_CP)));
        // Round joins and caps, so the barbs meet the shaft the way they did in Zdog — which
        // rounds its caps — rather than showing a seam at the tip.
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('fill', 'none');
        paths.push(path);
      }

      // ⚠️ Replaced wholesale rather than diffed. At most a handful of arrows live for seconds of
      // a match, and a diff would be a second description of the same set to keep in step.
      root.replaceChildren(...paths);
    },

    destroy() {
      root.remove();
    },
  };
}
