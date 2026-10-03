// SPDX-License-Identifier: AGPL-3.0-or-later
// render3d/project-quads — the sixty-four squares as the camera draws them, in canvas pixels.
//
// ========================= WHY THIS IS A MODULE AND NOT A CLOSURE =========================
// It was four lines inside `boot/view-solid.ts`, and that is exactly how it got away with being
// wrong twice. `ui/coordinates.ts` reads a CONTRACT off these corners — which one is left, which
// one is near — and a contract that no test can reach is a comment. Here it can be reached.
//
// ========================= ⚠️ THE CONTRACT =========================
// `0 = far-left, 1 = far-right, 2 = near-right, 3 = near-left`, in SCREEN terms, copied from the
// Zdog Rect path that `ui/coordinates.ts` was written against.
//
// ⚠️ "LEFT" IS `+x` HERE, WHICH IS THE OPPOSITE OF WHAT IT LOOKS LIKE. The handedness note at the
// top of `render3d/scene.ts` has the whole derivation; the short of it is that this camera's own
// right vector is (−1, 0, 0), so world +x lands on the LEFT of the screen. Writing the corners in
// the obvious `x - half` first order puts them in mirror image of the contract.
//
// That mistake is SILENT for the file letters and LOUD for the rank numbers, which is why it
// survived the 2026-10-03 fix and was reported the next morning: the letters read the corners in
// the pairs (0,1) and (2,3), both of which are a far edge and a near edge, and the MIDPOINT of a
// pair does not care which of the two is on the left. The numbers read (0,3) and (1,2) — the two
// SIDE edges — and a swap there sends "beyond the west edge" east instead, which drops the column
// of numbers on top of the b-file instead of beside the board.

import { FILES, RANKS, type Square } from '../chess/types.ts';
import { squareIndex } from '../render/board-geometry.ts';
import { TILE } from '../render/resolution.ts';
import { sceneCenter } from './scene.ts';
import type { Quad } from '../render/picking.ts';
import type * as THREE from 'three';

/**
 * Projects every square onto the canvas, in the space `ui/coordinates` works in: canvas pixels,
 * measured from the CENTRE of the canvas, which is what `viewport.zoom = 1` declares.
 *
 * `scratch` is the vector to project through. It is passed in because this runs per frame and a
 * fresh `Vector3` sixty-four times a frame is garbage the renderer does not need to make.
 */
export function projectBoardQuads(
  camera: THREE.Camera,
  scratch: THREE.Vector3,
  width: number,
  height: number,
): Quad[] {
  const out: Quad[] = new Array<Quad>(FILES * RANKS);
  const half = TILE / 2;

  /*
   * ⚠️ ONLY `y` IS NEGATED, AND THAT IS ALL THIS CONVERSION OWES ANYBODY. NDC is y-up and the
   * screen is y-down, which is the ordinary WebGL viewport mapping and the whole of why `y`
   * flips. `x` needs nothing here, because `sceneCenter` already converted the handedness and
   * the corner ORDER below accounts for the rest.
   *
   * ⚠️ TWO WRONG VERSIONS THIS REPLACES, because both are easy to arrive at again:
   *
   *   1. Negating BOTH axes. That is a point reflection, not a viewport mapping. A chessboard
   *      seen head-on is near enough symmetric under it that the labels looked right at the
   *      opening angle and came apart the moment the camera turned.
   *   2. Negating neither, and leaving the SCENE mirrored. Clicking the left of the board
   *      selected g1 and the right selected b1, and that measurement was read as the camera's
   *      convention to conform to. It was not a convention; it was the bug, now fixed in
   *      `sceneCenter`. Conforming the labels to a mirrored board is what printed the letters
   *      backwards.
   */
  const toPixels = (x: number, z: number): { x: number; y: number } => {
    // ⚠️ `Vector3.project(camera)`, not `camera.project(…)`. Three puts the projection on the
    // VECTOR; the camera is only the argument.
    scratch.set(x, 0, z).project(camera);
    return { x: (scratch.x * width) / 2, y: (-scratch.y * height) / 2 };
  };

  for (let y = 0; y < RANKS; y++) {
    for (let x = 0; x < FILES; x++) {
      const centre = sceneCenter({ x, y } as Square, TILE);
      // Named rather than inlined, because `left = +half` is the whole trap this module exists to
      // keep out of the loop body. See the contract above.
      const left = centre.x + half;
      const right = centre.x - half;
      // "Far" is the black end: rank 8 is `y = 0`, and the camera stands at positive z.
      const far = centre.z - half;
      const near = centre.z + half;
      out[squareIndex({ x, y } as Square)] = {
        corners: [
          toPixels(left, far),
          toPixels(right, far),
          toPixels(right, near),
          toPixels(left, near),
        ],
        depth: 0,
      };
    }
  }
  return out;
}
