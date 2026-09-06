// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHY THIS ONE IS A BROWSER TEST =========================
// `render3d/scene.ts` builds a `WebGLRenderer` in its constructor, so it cannot run in the node
// project the way `render3d/pieces.ts` can — a mesh is a plain object, a renderer is a GPU
// context. Everything asserted here is nonetheless arithmetic: where the camera ends up after a
// gesture. Nothing is drawn and nothing is looked at.
import { describe, expect, it } from 'vitest';
import { createScene3d, BOARD_SPAN } from '../app/js/render3d/scene.ts';

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
