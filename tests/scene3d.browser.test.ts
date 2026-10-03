// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHY THIS ONE IS A BROWSER TEST =========================
// `render3d/scene.ts` builds a `WebGLRenderer` in its constructor, so it cannot run in the node
// project the way `render3d/pieces.ts` can — a mesh is a plain object, a renderer is a GPU
// context. Everything asserted here is nonetheless arithmetic: where the camera ends up after a
// gesture. Nothing is drawn and nothing is looked at.
import { describe, expect, it } from 'vitest';
import { createScene3d, BOARD_SPAN } from '../app/js/render3d/scene.ts';
import { FILES, RANKS } from '../app/js/chess/types.ts';

const stage = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  document.body.appendChild(canvas);
  return canvas;
};

/** How far the camera stands from the board's centre, which is what the wheel changes. */
const distance = (scene: ReturnType<typeof createScene3d>): number =>
  Math.hypot(scene.camera.position.x, scene.camera.position.y, scene.camera.position.z);

describe('[3D] the wheel moves the camera, within limits', () => {
  it('comes closer on a notch in and goes back on a notch out', () => {
    const scene = createScene3d({ canvas: stage() });
    const start = distance(scene);

    scene.dolly(-1);
    const near = distance(scene);
    expect(near).toBeLessThan(start);

    /*
     * ⚠️ EXACTLY back, not roughly. The step is a FACTOR, so in-then-out is a multiplication by
     * its own reciprocal — which is the property that makes a notch feel the same close up and
     * far away. A step measured in units would fail this by construction.
     */
    scene.dolly(+1);
    expect(distance(scene)).toBeCloseTo(start, 6);

    scene.destroy();
  });

  it('stops at both ends however long the wheel is turned', () => {
    const scene = createScene3d({ canvas: stage() });
    const start = distance(scene);

    for (let i = 0; i < 200; i++) scene.dolly(-1);
    const nearest = distance(scene);
    // Near enough to read a piece's faces, never so near the board leaves the frame.
    expect(nearest).toBeGreaterThan(BOARD_SPAN * 0.5);
    expect(nearest).toBeLessThan(start);

    for (let i = 0; i < 400; i++) scene.dolly(+1);
    const farthest = distance(scene);
    // Far enough to see the whole board, never so far the six silhouettes stop being six.
    expect(farthest).toBeGreaterThan(start);
    expect(farthest).toBeLessThan(BOARD_SPAN * 3.5);

    scene.destroy();
  });

  it('keeps its distance when the board is turned', () => {
    // The two gestures are independent: orbiting must not creep the zoom, or a player who turns
    // the board a few times ends up somewhere they never asked to be.
    const scene = createScene3d({ canvas: stage() });
    scene.dolly(-4);
    const held = distance(scene);

    scene.orbit(0.9, 0.3);
    scene.orbit(-2.1, -0.8);
    expect(distance(scene)).toBeCloseTo(held, 6);

    scene.destroy();
  });

  it('never lets the camera under the table, however far the pitch is pushed', () => {
    // The same clamp the projected view has, and for the same reason: below the board every piece
    // is upside down and getting back is not obvious to anybody.
    const scene = createScene3d({ canvas: stage() });
    for (let i = 0; i < 50; i++) scene.orbit(0, -1);
    expect(scene.look().pitch).toBeGreaterThan(0);

    for (let i = 0; i < 50; i++) scene.orbit(0, +1);
    expect(scene.look().pitch).toBeLessThan(Math.PI / 2);

    scene.destroy();
  });
});

describe('[Marks] the solid board can finally say what it is doing', () => {
  /*
   * ⚠️ THIS VIEW SHOWED NOTHING AT ALL until now — not the selection, not the legal moves, not
   * check. A player here learned those three facts only from the screen reader's labels, which is
   * to say only if they were using one, and it is why the teaching mode was switched off on this
   * page. Recorded as a debt in the plan; this is it being paid.
   */
  const marksIn = (s: ReturnType<typeof createScene3d>): number => {
    let count = 0;
    s.scene.traverse((node) => {
      // The marks are the flat unlit meshes laid on the board; the board and pieces are neither.
      const mesh = node as { isMesh?: boolean; rotation?: { x: number } };
      if (mesh.isMesh && Math.abs((mesh.rotation?.x ?? 0) + Math.PI / 2) < 1e-6) count += 1;
    });
    return count;
  };

  it('draws nothing when nothing is marked, and clears back to nothing', () => {
    const scene = createScene3d({ canvas: document.createElement('canvas') });
    expect(marksIn(scene)).toBe(0);

    scene.setMarkers(new Map([[28, 'selected']]));
    expect(marksIn(scene)).toBeGreaterThan(0);

    scene.setMarkers(new Map());
    expect(marksIn(scene)).toBe(0);
  });

  it('⚠️ tells a move from a capture by SHAPE, not only by colour', () => {
    /*
     * The rule `render/board-geometry.ts` sets, and it is not this view's to reinvent: a filled
     * disc is a move, a ring is a capture, both together is the selection. One mesh against two is
     * how that is visible in a test.
     */
    const scene = createScene3d({ canvas: document.createElement('canvas') });
    scene.setMarkers(new Map([[28, 'move']]));
    const move = marksIn(scene);
    scene.setMarkers(new Map([[28, 'capture']]));
    const capture = marksIn(scene);
    scene.setMarkers(new Map([[28, 'selected']]));
    const selected = marksIn(scene);

    expect(move).toBe(1);
    expect(capture).toBe(1);
    // Selection is the two of them together, which is what makes it a third readable state.
    expect(selected).toBe(2);
  });

  it('gives a lesson mark its halo, which is what carries its contrast', () => {
    // No hue clears 3:1 against every square this game draws — see `render/palette.ts` — so the
    // black halo behind it is the thing satisfying 1.4.11, and a count of one would mean it went.
    const scene = createScene3d({ canvas: document.createElement('canvas') });
    scene.setMarkers(new Map([[28, 'lesson']]));
    expect(marksIn(scene)).toBe(2);
  });

  it('draws every square it is given, and ignores an index nobody has', () => {
    const scene = createScene3d({ canvas: document.createElement('canvas') });
    scene.setMarkers(new Map([[0, 'move'], [63, 'move'], [64, 'move'], [-1, 'move']]));
    expect(marksIn(scene)).toBe(2);
  });

  it('survives a whole game of marking without leaking meshes', () => {
    // Rebuilt every move in a scene rendered every frame: a mesh left behind each time is a leak
    // that only shows up after somebody has been playing for a while.
    const scene = createScene3d({ canvas: document.createElement('canvas') });
    for (let i = 0; i < 40; i += 1) {
      scene.setMarkers(new Map([[i % 64, 'selected'], [(i + 1) % 64, 'move']]));
    }
    expect(marksIn(scene)).toBe(3);
  });
});

describe('[3D] ⚠️ the board is not mirrored: a1 is bottom-left', () => {
  /*
   * ========================= WHY THIS TEST EXISTS =========================
   * It did not, and the defect it pins lived for the whole life of this view: THE SOLID BOARD WAS
   * DRAWN MIRRORED. The table's axes are left-handed (x right, y DOWN, z toward the viewer) and
   * Three.js is right-handed, so telling the camera `up = (0, −1, 0)` fixed the vertical and
   * reflected the horizontal — world +x landed on the LEFT of the screen, and file `a`, which
   * lives at negative x, was drawn on the right. The files ran h..a.
   *
   * A chessboard with no coordinates printed on it looks completely normal like that. It is
   * symmetric in the only way the eye checks: the light squares are still right, white is still
   * nearest, the pieces are still where you left them. So nothing caught it until the DOM
   * coordinate labels arrived in this view and read backwards (the Dev's report of 2026-10-03),
   * and then the obvious-looking fix was to conform the labels to the board — which is fixing the
   * wrong end, and is exactly what shipped the backwards letters.
   *
   * The assertion is therefore made against `pick`, the one function that answers "which square is
   * under this point on the screen". Not against the conversion's arithmetic: a test of
   * `sceneCenter` would be a second copy of its own formula, and would have agreed with the bug.
   */
  const probe = (): { scene: ReturnType<typeof createScene3d>; w: number; h: number } => {
    const canvas = stage();
    const scene = createScene3d({ canvas });
    const w = canvas.width;
    const h = canvas.height;
    scene.resize(w, h);
    // `pick` raycasts through `matrixWorld`, which a camera that has only been positioned does not
    // yet have. One render is what publishes it.
    scene.render();
    return { scene, w, h };
  };

  /** Every square found by sweeping a straight line across the canvas, in the order it met them. */
  const sweep = (
    scene: ReturnType<typeof createScene3d>,
    from: { x: number; y: number }, to: { x: number; y: number }, w: number, h: number,
  ): { x: number; y: number }[] => {
    const found: { x: number; y: number }[] = [];
    const STEPS = 160;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const hit = scene.pick(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, w, h);
      if (hit) found.push(hit);
    }
    return found;
  };

  it('⚠️ reads a..h from LEFT to RIGHT, which is what this file was missing', () => {
    const { scene, w, h } = probe();
    const across = sweep(scene, { x: 0, y: h / 2 }, { x: w, y: h / 2 }, w, h);

    expect(across.length).toBeGreaterThan(8);
    // A straight sweep across a board seen head-on may linger on a file but must never go
    // backwards. A mirrored board fails this on the very first pair.
    for (let i = 1; i < across.length; i++) {
      expect(across[i].x).toBeGreaterThanOrEqual(across[i - 1].x);
    }
    // And it really crosses the whole board, rather than passing by finding one file.
    expect(across[0].x).toBe(0);
    expect(across[across.length - 1].x).toBe(FILES - 1);

    scene.destroy();
  });

  it('keeps rank 1 nearest the player, so white is at the bottom', () => {
    const { scene, w, h } = probe();
    const down = sweep(scene, { x: w / 2, y: 0 }, { x: w / 2, y: h }, w, h);

    expect(down.length).toBeGreaterThan(8);
    // `y` counts from black: rank 8 is y = 0. Sweeping down the screen must count up through it.
    for (let i = 1; i < down.length; i++) {
      expect(down[i].y).toBeGreaterThanOrEqual(down[i - 1].y);
    }
    expect(down[0].y).toBe(0);
    expect(down[down.length - 1].y).toBe(RANKS - 1);

    scene.destroy();
  });

  it('puts a1 in the bottom-left corner and h1 in the bottom-right', () => {
    const { scene, w, h } = probe();
    const across = sweep(scene, { x: 0, y: h / 2 }, { x: w, y: h / 2 }, w, h);
    const down = sweep(scene, { x: w / 2, y: 0 }, { x: w / 2, y: h }, w, h);

    // The two sweeps together name the corner the whole report was about: leftmost file, nearest
    // rank. In chess notation that is a1 — and a1 is dark, which `isLightSquare` already pins.
    expect({ x: across[0].x, y: down[down.length - 1].y }).toEqual({ x: 0, y: RANKS - 1 });
    expect({ x: across[across.length - 1].x, y: down[down.length - 1].y })
      .toEqual({ x: FILES - 1, y: RANKS - 1 });

    scene.destroy();
  });
});
