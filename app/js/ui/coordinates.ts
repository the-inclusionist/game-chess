// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/coordinates — the file letters and rank numbers, in the DOM, laid over the projected board.
//
// ========================= WHY THIS IS NOT DRAWN WITH THE BOARD =========================
// Because it cannot be. Zdog has no text primitive of any kind — not a `Text` shape, not a font
// hook, nothing. The three ways out were: draw glyphs out of Zdog paths (correct, absurd), call
// `ctx.fillText` on the 640×360 offscreen canvas before it is upscaled (cheap, and it puts text
// back into the pixel grid this project has already fought twice), or put real text in the DOM and
// position it from the projection. This is the third.
//
// What that buys, and it is not a consolation prize: the labels are real text. They scale with
// `--ui-fs`, they honour a reader's own font size, they can be selected, and they never meet the
// pixel grid — so a rank number stays sharp at every window size while the board beside it is
// deliberately pixelated.
//
// ========================= WHY EXTRAPOLATING FROM SQUARE CORNERS IS EXACT =========================
// A label sits outside the board, where there is no square to read a corner from. It would seem to
// need a projection of its own — replicating Zdog's camera transform for an arbitrary world point,
// which is a second copy of the maths the renderer already does and a second thing to keep in step.
//
// It does not, because **Zdog's projection is orthographic**: it rotates and scales and never
// divides by depth. An orthographic projection of a plane is AFFINE, and an affine map sends
// straight lines to straight lines and preserves ratios along them. So a point 0.7 of a square
// beyond an edge projects exactly to the screen point 0.7 of the way beyond that edge's projection.
// Linear extrapolation in screen space is not an approximation here; it is the same answer the
// camera would give, obtained from corners the renderer has already computed for picking.
//
// The labels therefore turn WITH the board, which is also what a real board does: the coordinates
// are printed on it, not on the room.

import { FILES, RANKS, type Square } from '../chess/types.ts';
import { squareIndex } from '../render/board-geometry.ts';
import type { Quad, Viewport } from '../render/picking.ts';

/** How far outside the board edge a label sits, in squares. */
const OUTSET = 0.72;

const FILE_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
/** Rank 8 first, because `y` is counted from black — the same order the board array uses. */
const RANK_NAMES = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

export interface Coordinates {
  readonly root: HTMLElement;
  setVisible(on: boolean): void;
  visible(): boolean;
  /**
   * Repositions every label from the projected board. Valid only after the stage has updated its
   * graph — the same precondition `quads()` carries for picking.
   *
   * `upscale` is CSS pixels per canvas pixel. It is passed in rather than measured here because
   * measuring means reading layout, and reading layout every frame is how a render loop starts
   * fighting the browser.
   */
  place(quads: readonly Quad[], viewport: Viewport, upscale: number): void;
  destroy(): void;
}

export interface CoordinatesDeps {
  readonly doc: Document;
  /** Start shown. On by default is the pedagogical choice: the names are what the reader speaks. */
  readonly visible?: boolean;
}

type Point = { x: number; y: number };

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** `from` pushed away from `toward` by `OUTSET` of the distance between them. */
const beyond = (from: Point, toward: Point): Point => ({
  x: from.x + (from.x - toward.x) * OUTSET,
  y: from.y + (from.y - toward.y) * OUTSET,
});

export function createCoordinates(deps: CoordinatesDeps): Coordinates {
  const { doc } = deps;

  const root = doc.createElement('div');
  root.className = 'coords';
  // The grid mirror already names every square to a screen reader, in the player's own language.
  // Repeating sixteen bare letters here would be noise in front of that.
  root.setAttribute('aria-hidden', 'true');

  const make = (text: string, kind: string): HTMLElement => {
    const label = doc.createElement('span');
    label.className = 'coords-label';
    label.dataset.kind = kind;
    label.textContent = text;
    root.appendChild(label);
    return label;
  };

  const fileLabels = FILE_NAMES.map((name) => make(name, 'file'));
  const rankLabels = RANK_NAMES.map((name) => make(name, 'rank'));

  let shown = deps.visible ?? true;
  root.hidden = !shown;

  function put(label: HTMLElement, at: Point, viewport: Viewport, upscale: number): void {
    // Illustration space is centred on the canvas and unzoomed; this is the same conversion
    // `screenOf` does for the pointer, minus the element's own offset, because the overlay is
    // positioned against the canvas rather than against the page.
    const x = (at.x * viewport.zoom + viewport.width / 2) * upscale;
    const y = (at.y * viewport.zoom + viewport.height / 2) * upscale;
    label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  }

  return {
    root,

    visible: () => shown,

    setVisible(on) {
      shown = on;
      root.hidden = !on;
    },

    place(quads, viewport, upscale) {
      // Nothing to position while hidden, and a hidden element has no layout to be wrong.
      if (!shown) return;

      for (let x = 0; x < FILES; x++) {
        // Rank 1 is y = 7: `y` counts from black, so the last row is the one nearest the player.
        const quad = quads[squareIndex({ x, y: RANKS - 1 } as Square)];
        if (!quad) continue;
        // Corner order comes from Zdog's Rect path, flat under rotate.x = TAU/4:
        // 0 = far-left, 1 = far-right, 2 = near-right, 3 = near-left.
        const near = mid(quad.corners[2], quad.corners[3]);
        const far = mid(quad.corners[0], quad.corners[1]);
        put(fileLabels[x], beyond(near, far), viewport, upscale);
      }

      for (let y = 0; y < RANKS; y++) {
        const quad = quads[squareIndex({ x: 0, y } as Square)];
        if (!quad) continue;
        const west = mid(quad.corners[0], quad.corners[3]);
        const east = mid(quad.corners[1], quad.corners[2]);
        put(rankLabels[y], beyond(west, east), viewport, upscale);
      }
    },

    destroy() {
      root.remove();
    },
  };
}
