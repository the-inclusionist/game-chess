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
