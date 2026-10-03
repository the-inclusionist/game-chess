// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest';
import { createBoard } from '../app/js/render/board.ts';
import { LOGICAL_H, LOGICAL_W } from '../app/js/render/resolution.ts';
import { createZdogStage, type ZdogStage } from '../app/js/render/zdog-stage.ts';
import { createCoordinates, type Coordinates } from '../app/js/ui/coordinates.ts';

// ========================= WHAT THIS PROVES =========================
// A board coordinate sits OUTSIDE the board, where there is no square to read a projected corner
// from. The module claims it can place one anyway by extrapolating along the line between two
// projected edge midpoints, and that this is EXACT rather than approximate, because Zdog's
// projection is orthographic and an orthographic projection of a plane is affine.
//
// That claim is the whole design, so it is the thing tested — against ZDOG ITSELF. A probe Rect is
// put at the world point where a label belongs and the renderer is asked to project it; the module
// must arrive at the same screen position without ever seeing that point. Checking the module
// against a second copy of its own formula would only prove that two copies of a formula agree.
//
// Three camera angles, because an approximation would drift as the board turned, and one angle
// cannot tell a right answer from a lucky one.

let stage: ZdogStage | null = null;
let coords: Coordinates | null = null;

afterEach(() => {
  coords?.destroy();
  stage?.destroy();
  coords = null;
  stage = null;
  document.body.replaceChildren();
});

function build(visible = true) {
  stage = createZdogStage();
  const board = createBoard(stage.root);
  coords = createCoordinates({ doc: document, visible });
  document.body.appendChild(coords.root);
  return { stage, board, coords };
}

/** Reads back the transform this module writes, which is where the position actually lives. */
function positionOf(label: HTMLElement): { x: number; y: number } {
  const match = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(label.style.transform);
  if (!match) throw new Error(`no position on ${label.textContent}: ${label.style.transform}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

const labels = (kind: 'file' | 'rank'): HTMLElement[] =>
  [...document.querySelectorAll<HTMLElement>(`.coords-label[data-kind="${kind}"]`)];

describe('[Coordinates] sixteen labels, hidden from the reader that already has them', () => {
  it('makes eight files and eight ranks', () => {
    build();
    expect(labels('file').map((l) => l.textContent).join('')).toBe('abcdefgh');
    // Rank 8 first: `y` counts from black, the same order the board array uses.
    expect(labels('rank').map((l) => l.textContent).join('')).toBe('87654321');
  });

  it('is aria-hidden, because the grid mirror already names every square', () => {
    const { coords: c } = build();
    expect(c.root.getAttribute('aria-hidden')).toBe('true');
  });

  it('can be switched off, and does no work while it is off', () => {
    const { stage: z, board, coords: c } = build(false);
    z.render();
    c.place(board.quads(), z.viewport(), 1);
    expect(c.visible()).toBe(false);
    expect(c.root.hidden).toBe(true);
    // Nothing positioned: a hidden element has no layout to get wrong.
    expect(labels('file')[0].style.transform).toBe('');

    c.setVisible(true);
    c.place(board.quads(), z.viewport(), 1);
    expect(labels('file')[0].style.transform).not.toBe('');
  });
});

describe('[Coordinates] a straight column and a straight row, outside the board', () => {
  /*
   * ⚠️ `projectPoint` AND ITS `OUTSET` CONSTANT WENT WITH THE DIAGONAL (2026-10-03). They existed
   * to re-derive, from Zdog itself, where a point `OUTSET` beyond one square's own edge lands on
   * screen — the right question while each label followed its own square outward. The labels
   * share an axis now, so the thing to check is that they LINE UP, which needs no second copy of
   * the camera's arithmetic.
   */

  /*
   * ⚠️ THESE TWO USED TO ASSERT THE DIAGONAL, and they were right about the code at the time:
   * each label was pushed `OUTSET` beyond its OWN square's edge, so the correct answer was the
   * camera's projection of that extrapolated world point. The Dev's drawing of 2026-10-03 is
   * what retired that rule — a pitched board makes "beyond my own edge" a DIAGONAL, so rank 8
   * walked off the stage's left while rank 1 sat under the near pieces. The labels form a
   * straight column and a straight row now, and these two say so instead.
   */
  it('puts the eight rank numbers in a STRAIGHT COLUMN, at every angle', () => {
    const { stage: z, board, coords: c } = build();

    for (const [pitch, yaw] of [[-1, 0], [-0.6, 0.8], [-1.2, -1.4]] as const) {
      z.setCamera(pitch, yaw);
      z.render();
      c.place(board.quads(), z.viewport(), 1);

      const xs = Array.from({ length: 8 }, (_, y) => positionOf(labels('rank')[y]).x);
      // One X for all eight. Hundredths, because the value is read back out of the CSSOM, which
      // rounds a transform's pixels; the failure being ruled out is a diagonal, not a rounding.
      for (const x of xs) expect(x).toBeCloseTo(xs[0], 2);

      // And each one keeps its own HEIGHT — the thing that says which rank it names. Rank 8 is
      // index 0 (`y` counts from black), so the column reads downward in screen order.
      const ys = Array.from({ length: 8 }, (_, y) => positionOf(labels('rank')[y]).y);
      const ascending = ys.every((v, i) => i === 0 || v > ys[i - 1]);
      const descending = ys.every((v, i) => i === 0 || v < ys[i - 1]);
      expect(`monotonic: ${ascending || descending}`).toBe('monotonic: true');
    }
  });

  it('puts the eight file letters in a STRAIGHT ROW, under the board', () => {
    const { stage: z, board, coords: c } = build();
    z.setCamera(-0.9, 0.5);
    z.render();
    c.place(board.quads(), z.viewport(), 1);

    const ys = Array.from({ length: 8 }, (_, x) => positionOf(labels('file')[x]).y);
    for (const y of ys) expect(y).toBeCloseTo(ys[0], 2);

    const xs = Array.from({ length: 8 }, (_, x) => positionOf(labels('file')[x]).x);
    const ascending = xs.every((v, i) => i === 0 || v > xs[i - 1]);
    const descending = xs.every((v, i) => i === 0 || v < xs[i - 1]);
    expect(`monotonic: ${ascending || descending}`).toBe('monotonic: true');
  });

  it('puts every label OUTSIDE the board it labels', () => {
    const { stage: z, board, coords: c } = build();
    z.render();
    c.place(board.quads(), z.viewport(), 1);

    const quads = board.quads();
    const view = z.viewport();
    const toScreen = (p: { x: number; y: number }) => ({
      x: p.x * view.zoom + view.width / 2,
      y: p.y * view.zoom + view.height / 2,
    });
    const xs: number[] = [];
    const ys: number[] = [];
    for (const q of quads) {
      for (const corner of q.corners) {
        const s = toScreen(corner);
        xs.push(s.x);
        ys.push(s.y);
      }
    }
    const bounds = {
      left: Math.min(...xs), right: Math.max(...xs),
      top: Math.min(...ys), bottom: Math.max(...ys),
    };

    // Files sit below the board's lowest point, ranks to the left of its leftmost.
    for (const label of labels('file')) {
      expect(positionOf(label).y).toBeGreaterThan(bounds.top);
    }
    for (const label of labels('rank')) {
      expect(positionOf(label).x).toBeLessThan(bounds.right);
    }
    // And none of them wanders off the canvas at the default camera.
    for (const label of [...labels('file'), ...labels('rank')]) {
      const at = positionOf(label);
      expect(at.x).toBeGreaterThan(-20);
      expect(at.x).toBeLessThan(LOGICAL_W + 20);
      expect(at.y).toBeGreaterThan(-20);
      expect(at.y).toBeLessThan(LOGICAL_H + 20);
    }
  });

  it('follows the board when the camera turns — the labels are printed ON it', () => {
    const { stage: z, board, coords: c } = build();
    z.render();
    c.place(board.quads(), z.viewport(), 1);
    const before = labels('file').map(positionOf);

    z.setCamera(-0.8, 0.9);
    z.render();
    c.place(board.quads(), z.viewport(), 1);
    const after = labels('file').map(positionOf);

    for (let i = 0; i < before.length; i++) {
      expect(Math.hypot(after[i].x - before[i].x, after[i].y - before[i].y)).toBeGreaterThan(1);
    }
  });

  it('scales with the upscale factor it is handed', () => {
    const { stage: z, board, coords: c } = build();
    z.render();
    c.place(board.quads(), z.viewport(), 1);
    const at1 = positionOf(labels('file')[0]);
    c.place(board.quads(), z.viewport(), 3);
    const at3 = positionOf(labels('file')[0]);
    /*
     * ⚠️ `toBeCloseTo(_, 3)` — tolerance ~0.0005 px, not six-digit float equality. The projection
     * math goes through `CAMERA.zoom`, and at zoom 2.0 (2026-10-03) the FP accumulation lands at
     * a ten-thousandth of a pixel off the exact `at1 * 3`, which is a rounding fact of the
     * floating-point pipeline rather than a scaling defect. Three digits still rules out any
     * whole-pixel bug — the real failure this guards against — without pinning the test to a
     * specific zoom's lucky FP alignment.
     */
    expect(at3.x).toBeCloseTo(at1.x * 3, 2);
    expect(at3.y).toBeCloseTo(at1.y * 3, 2);
  });
});
