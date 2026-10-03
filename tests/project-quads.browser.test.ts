// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHAT THIS PROVES, AND WHY IT IS A SEPARATE FILE =========================
// `ui/coordinates.ts` does not know which renderer handed it a board. It reads a CONTRACT off the
// four corners of each square — 0 = far-left, 1 = far-right, 2 = near-right, 3 = near-left — and
// extrapolates the labels outward from the edges those corners name. The Zdog view satisfies that
// contract by construction, because the corners come straight off a Rect path. The WebGL view has
// to build them, and it built them MIRRORED for the whole life of the view.
//
// ⚠️ THE FAILURE MODE IS WHY THIS NEEDED ITS OWN TEST RATHER THAN A GLANCE. Swapping left and
// right in the corner list is INVISIBLE in the file letters and LOUD in the rank numbers:
//
//   · the letters read the pairs (0,1) and (2,3) — a far edge and a near edge — and take the
//     MIDPOINT of each, which does not change when the two members swap;
//   · the numbers read (0,3) and (1,2) — the two SIDE edges — and a swap turns "push beyond the
//     west edge" into "push beyond the east edge", dropping the column of numbers ON the board.
//
// So the board can look entirely correct, with its letters in the right order under the right
// files, and still be feeding `ui/coordinates` a mirror image. That is the 2026-10-04 report, and
// it is the reason the assertions below are about WHICH CORNER IS WHICH rather than about where
// any particular label ended up.
import { afterEach, describe, expect, it } from 'vitest';
import { FILES, RANKS, type Square } from '../app/js/chess/types.ts';
import { squareIndex } from '../app/js/render/board-geometry.ts';
import { createScene3d } from '../app/js/render3d/scene.ts';
import { projectBoardQuads } from '../app/js/render3d/project-quads.ts';
import { createCoordinates } from '../app/js/ui/coordinates.ts';
import * as THREE from 'three';

const W = 360;
const H = 360;

const build = () => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  document.body.appendChild(canvas);
  const scene = createScene3d({ canvas });
  scene.resize(W, H);
  // The camera's `matrixWorld` is what `project` reads, and positioning it does not publish one.
  scene.render();
  return {
    scene,
    quads: () => projectBoardQuads(scene.camera, new THREE.Vector3(), W, H),
  };
};

const at = (quads: ReturnType<ReturnType<typeof build>['quads']>, x: number, y: number) =>
  quads[squareIndex({ x, y } as Square)];

describe('[3D quads] ⚠️ the corner order is the contract, in SCREEN terms', () => {
  it('puts corners 0 and 3 on the LEFT of the square, 1 and 2 on the right', () => {
    const { scene, quads } = build();
    const all = quads();

    for (let y = 0; y < RANKS; y++) {
      for (let x = 0; x < FILES; x++) {
        const c = at(all, x, y).corners;
        // ⚠️ This is the assertion the bug failed. "Left" means a smaller screen x — and in this
        // scene that is a LARGER world x, because the camera's right vector is (−1, 0, 0).
        expect(c[0].x, `far corners of ${x},${y}`).toBeLessThan(c[1].x);
        expect(c[3].x, `near corners of ${x},${y}`).toBeLessThan(c[2].x);
      }
    }
    scene.destroy();
  });

  it('puts corners 0 and 1 FAR and 2 and 3 near, so the letters do not end up behind black', () => {
    const { scene, quads } = build();
    const all = quads();

    for (let y = 0; y < RANKS; y++) {
      for (let x = 0; x < FILES; x++) {
        const c = at(all, x, y).corners;
        // Further up the screen is a smaller y. At any pitch above the board, far is up.
        expect(c[0].y, `left edge of ${x},${y}`).toBeLessThan(c[3].y);
        expect(c[1].y, `right edge of ${x},${y}`).toBeLessThan(c[2].y);
      }
    }
    scene.destroy();
  });

  it('agrees with the board it projects: the a-file is left of the h-file', () => {
    const { scene, quads } = build();
    const all = quads();
    const centreX = (q: { corners: readonly { x: number }[] }) =>
      q.corners.reduce((sum, p) => sum + p.x, 0) / 4;

    // Not a restatement of the test above: that one checks a square against itself, this one
    // checks the squares against each other, which is what a whole-board mirror would break.
    for (let x = 1; x < FILES; x++) {
      expect(centreX(at(all, x, RANKS - 1))).toBeGreaterThan(centreX(at(all, x - 1, RANKS - 1)));
    }
    scene.destroy();
  });
});

describe('[3D quads] the labels land OUTSIDE the board, which is the reported symptom', () => {
  /*
   * The end-to-end form of the same fact, asserted the way the Dev sees it: he circled the column
   * of numbers sitting ON the b-file and drew an arrow to where they belong. This is that arrow.
   *
   * ⚠️ EACH LABEL IS CHECKED AGAINST ITS OWN SQUARE, not against the board's bounding box, and
   * the first draft of this test got that wrong. This camera has PERSPECTIVE: rank 1 is drawn
   * wider than rank 8, so the leftmost point of the whole board belongs to a1 and no label beside
   * rank 8 could ever be left of it. A bounding box is the right question for the orthographic
   * Zdog board and the wrong one here.
   */
  afterEach(() => {
    document.body.replaceChildren();
  });

  const placed = (kind: 'file' | 'rank') =>
    [...document.querySelectorAll<HTMLElement>(`.coords-label[data-kind="${kind}"]`)].map((l) => {
      const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(l.style.transform);
      if (!m) throw new Error(`no position on ${l.textContent}`);
      return { text: l.textContent, x: Number(m[1]), y: Number(m[2]) };
    });

  /** The labels as `place` leaves them, beside the squares they name, in the same CSS space. */
  const layout = () => {
    const { scene, quads } = build();
    const coords = createCoordinates({ doc: document, visible: true });
    document.body.appendChild(coords.root);
    const all = quads();
    coords.place(all, { width: W, height: H, zoom: 1 }, 1);
    // `place` works in centred canvas space; `put` adds half the canvas to land in CSS pixels.
    const square = (x: number, y: number) =>
      at(all, x, y).corners.map((p) => ({ x: p.x + W / 2, y: p.y + H / 2 }));
    return { scene, coords, square };
  };

  it('⚠️ keeps every rank number LEFT of its own square, not on top of the b-file', () => {
    const { scene, coords, square } = layout();

    placed('rank').forEach((label, y) => {
      // The a-file square on this label's own rank: the one the number is printed beside.
      const own = square(0, y);
      const leftEdge = Math.min(...own.map((p) => p.x));
      expect(label.x, `rank ${label.text} sits on the board instead of beside it`)
        .toBeLessThan(leftEdge);
    });

    coords.destroy();
    scene.destroy();
  });

  it('keeps every file letter BELOW its own square, clear of rank 1', () => {
    const { scene, coords, square } = layout();

    placed('file').forEach((label, x) => {
      const own = square(x, RANKS - 1);
      const nearEdge = Math.max(...own.map((p) => p.y));
      expect(label.y, `file ${label.text} sits on the board instead of below it`)
        .toBeGreaterThan(nearEdge);
    });

    coords.destroy();
    scene.destroy();
  });

  it('reads 8 at the top down to 1 at the bottom, and a..h left to right', () => {
    const { scene, coords } = layout();

    const ranks = placed('rank');
    const files = placed('file');
    expect(ranks.map((r) => r.text).join('')).toBe('87654321');
    for (let i = 1; i < ranks.length; i++) expect(ranks[i].y).toBeGreaterThan(ranks[i - 1].y);
    expect(files.map((f) => f.text).join('')).toBe('abcdefgh');
    for (let i = 1; i < files.length; i++) expect(files[i].x).toBeGreaterThan(files[i - 1].x);

    coords.destroy();
    scene.destroy();
  });
});
