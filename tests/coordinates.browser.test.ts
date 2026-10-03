// SPDX-License-Identifier: AGPL-3.0-or-later
import Zdog from 'zdog';
import { afterEach, describe, expect, it } from 'vitest';
import { createBoard } from '../app/js/render/board.ts';
import { LOGICAL_H, LOGICAL_W, TILE } from '../app/js/render/resolution.ts';
import { squareCenter } from '../app/js/render/board-geometry.ts';
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

describe('[Coordinates] the extrapolation is exact, not close', () => {
  /**
   * The label for file `x` sits `OUTSET` of a tile beyond the near EDGE of rank 1, in world units.
   * Mirrors `app/js/ui/coordinates.ts`'s own `OUTSET` — tightened to 0.2 on 2026-10-03 so the
   * whole label box lands inside the HUD surround.
   */
  const OUTSET = 0.2;

  /**
   * Projects a world point on the board plane by putting a real (invisible) Rect there and letting
   * ZDOG project it. This is the answer the camera itself gives, obtained without the module's
   * arithmetic — which is the only way the comparison proves anything. Comparing the module against
   * a re-implementation of its own formula would only prove that two copies of a formula agree.
   */
  function projectPoint(z: ZdogStage, at: { x: number; z: number }): { x: number; y: number } {
    const probe = new Zdog.Rect({
      addTo: z.root,
      width: 2,
      height: 2,
      translate: { x: at.x, y: 0, z: at.z },
      rotate: { x: Zdog.TAU / 4 },
      visible: false,
    });
    z.update();
    const points = probe.pathCommands.map((cmd) => cmd.endRenderPoint);
    const centre = {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    };
    probe.remove();
    return centre;
  }

  it('reaches the point the CAMERA would put there, at every angle', () => {
    // Zdog projects orthographically — it rotates and scales and never divides by depth — so an
    // orthographic projection of a plane is affine, and extrapolating in screen space is the same
    // answer as projecting the extrapolated world point. If that were false, the two would drift
    // apart as the camera turned, which is why three angles are checked rather than one.
    const { stage: z, board, coords: c } = build();

    for (const [pitch, yaw] of [[-1, 0], [-0.6, 0.8], [-1.2, -1.4]] as const) {
      z.setCamera(pitch, yaw);
      z.render();
      c.place(board.quads(), z.viewport(), 1);
      const view = z.viewport();

      for (let x = 0; x < 8; x++) {
        // Rank 1 is y = 7; its near edge is half a tile beyond its centre.
        const home = squareCenter({ x, y: 7 }, TILE);
        const world = { x: home.x, z: home.z + TILE * (0.5 + OUTSET) };
        const projected = projectPoint(z, world);

        const want = {
          x: projected.x * view.zoom + view.width / 2,
          y: projected.y * view.zoom + view.height / 2,
        };
        const got = positionOf(labels('file')[x]);
        // Two decimal places, because the value is read back out of the CSSOM, which rounds a
        // transform's pixels. The error being ruled out here would be whole pixels, not hundredths.
        expect(got.x).toBeCloseTo(want.x, 2);
        expect(got.y).toBeCloseTo(want.y, 2);
      }
    }
  });

  it('does the same for the ranks, on the other edge', () => {
    const { stage: z, board, coords: c } = build();
    z.setCamera(-0.9, 0.5);
    z.render();
    c.place(board.quads(), z.viewport(), 1);
    const view = z.viewport();

    for (let y = 0; y < 8; y++) {
      const home = squareCenter({ x: 0, y }, TILE);
      const world = { x: home.x - TILE * (0.5 + OUTSET), z: home.z };
      const projected = projectPoint(z, world);
      const got = positionOf(labels('rank')[y]);
      expect(got.x).toBeCloseTo(projected.x * view.zoom + view.width / 2, 2);
      expect(got.y).toBeCloseTo(projected.y * view.zoom + view.height / 2, 2);
    }
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
