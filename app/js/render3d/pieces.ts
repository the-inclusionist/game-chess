// SPDX-License-Identifier: AGPL-3.0-or-later
// render3d/pieces — the same geometry table, built as real solids.
//
// ========================= THE POINT OF THIS FILE =========================
// `render/pieces/geometry.ts` is a TABLE, not a set of drawing calls, and this is what that
// decision was for. Zdog reads it and draws flat shapes sorted by depth; Three reads the same
// table and builds meshes. Neither knows about the other, the invariants that keep a piece inside
// its square are asserted once, and there is no second copy of the shapes to drift.
//
// ⚠️ Every number here comes from that table unchanged. A conversion factor, a rescaling, a
// "3D version" of a spec — any of those would be the second copy arriving through the back door.
//
// ========================= ⚠️ Y POINTS DOWN, AND THAT IS DELIBERATE =========================
// Zdog's Y points down: a piece occupies NEGATIVE y and its base sits at y = 0. Three's convention
// is the opposite, and the obvious thing is to negate every y on the way in.
//
// This does not. Mirroring an axis flips handedness, which means every rotation in the table would
// need its sign worked out again — and a sign error on a rotation is invisible on a cube and
// wrong on a knight's head. So the SCENE keeps Zdog's convention and the camera is told that up
// is (0, −1, 0). Lighting, shadows and raycasting do not care which way up is; they care that
// everything agrees, and this way everything does, including the table.

import * as THREE from 'three';
import type { PieceSpec } from '../render/pieces/geometry.ts';
import type { SidePalette } from '../render/palette.ts';

/** How much bigger the outline hull is than the piece, as a fraction of a Zdog unit. */
const HULL = 0.28;

/** Segments around a turned part. Twelve reads as round at this size and costs nothing. */
const SEGMENTS = 16;

export interface Build3dOptions {
  /**
   * Draw the outline, as an inverted hull in `colours.stroke`.
   *
   * ========================= WHY A HULL AND NOT A LINE =========================
   * WebGL has no wide-line support worth using — `linewidth` is ignored by every desktop driver —
   * so the standard way to outline a solid is to draw it AGAIN, slightly larger, with the front
   * faces culled so only its far side shows. What is left is a rim of the outline colour exactly
   * where the silhouette is.
   *
   * That is the same shape as the trick the Zdog builder plays with a second Box, which is a nice
   * accident: the two renderers disagree about almost everything and agree about this.
   */
  readonly outline?: boolean;
  /**
   * Unlit materials, for the high-contrast palettes.
   *
   * ⚠️ THIS IS NOT A STYLE. Those palettes were solved numerically — every pair that touches
   * clears 3:1 — and a light source moves every one of those numbers by an amount nobody
   * measured. Lighting a high-contrast board is a way of undoing the only thing it is for.
   */
  readonly unlit?: boolean;
}

function material(colour: string, unlit: boolean): THREE.Material {
  return unlit
    ? new THREE.MeshBasicMaterial({ color: colour })
    // Lambert rather than Standard: this set is matte painted wood, there is nothing to be
    // specular about, and Lambert is a third of the shader.
    : new THREE.MeshLambertMaterial({ color: colour });
}

/**
 * The mesh for one part of a spec, centred on its own origin.
 *
 * A cone and a dome point along +y in Three's own primitives, which in this scene's convention is
 * DOWN — so `down: false` is the one that gets flipped. That reads backwards and is correct: the
 * table's `down` means "down on the board", and the board's down is Three's up.
 */
function partGeometry(
  part: { shape: 'cylinder' | 'cone' | 'dome'; d: number; h: number },
): THREE.BufferGeometry {
  if (part.shape === 'cylinder') return new THREE.CylinderGeometry(part.d / 2, part.d / 2, part.h, SEGMENTS);
  if (part.shape === 'cone') return new THREE.ConeGeometry(part.d / 2, part.h, SEGMENTS);
  // A dome is the top half of a sphere: phi from 0 to π/2.
  return new THREE.SphereGeometry(part.d / 2, SEGMENTS, SEGMENTS / 2, 0, Math.PI * 2, 0, Math.PI / 2);
}

/** Builds one piece as a group standing on the board plane at the origin. */
export function buildPiece3d(
  spec: PieceSpec,
  colours: SidePalette,
  options: Build3dOptions = {},
): THREE.Group {
  const group = new THREE.Group();
  const unlit = options.unlit ?? false;
  /*
   * ⚠️ `top`, NOT `face`. A Zdog palette carries three planes per side because Zdog cannot light
   * anything: the shading is painted in by hand, and `face` is the middle of three tones. Here
   * there are real lights, so painting a hand-shaded tone and then shading it again gives every
   * white piece a grey cast and every dark one a black one — which is exactly how the first
   * render came out. `top` is the side's actual colour, and the lights do the rest.
   */
  const skin = material(colours.top, unlit);
  const rim = options.outline
    ? new THREE.MeshBasicMaterial({ color: colours.stroke, side: THREE.BackSide })
    : null;

  const add = (geometry: THREE.BufferGeometry, place: (m: THREE.Object3D) => void): void => {
    const mesh = new THREE.Mesh(geometry, skin);
    place(mesh);
    group.add(mesh);
    if (!rim) return;
    const hull = new THREE.Mesh(geometry, rim);
    place(hull);
    // Grown by a fixed WIDTH rather than a fixed factor: scaling a 1.3-unit cross-arm and a
    // 10-unit base by the same 4% gives one a hairline and the other a border.
    const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
    hull.scale.set(
      1 + (HULL * 2) / Math.max(size.x, 0.01),
      1 + (HULL * 2) / Math.max(size.y, 0.01),
      1 + (HULL * 2) / Math.max(size.z, 0.01),
    );
    group.add(hull);
  };

  for (const box of spec.boxes) {
    add(new THREE.BoxGeometry(box.w, box.h, box.d), (mesh) => {
      mesh.position.set(box.x ?? 0, box.y ?? 0, box.z ?? 0);
      // ⚠️ Zdog rotates Z, then Y, then X. Three's 'XYZ' Euler order composes the same way —
      // qx · qy · qz — so the angles carry across unchanged, which is the whole point of not
      // mirroring the axis.
      mesh.rotation.set(box.rotX ?? 0, box.rotY ?? 0, box.rotZ ?? 0, 'XYZ');
    });
  }

  for (const part of spec.turned ?? []) {
    add(partGeometry(part), (mesh) => {
      if (part.shape === 'cylinder') {
        mesh.position.set(0, part.y, 0);
        return;
      }
      // A cone or a dome points toward the board unless it is turned over. Three's cone and this
      // table's both grow along +y, which in this scene is DOWN — so `down: false` is the one
      // that gets flipped, which reads backwards and is right.
      mesh.rotation.set(part.down ? 0 : Math.PI, 0, 0, 'XYZ');

      if (part.shape === 'cone') {
        // Three centres a cone on its own height and so does the table. Nothing to move.
        mesh.position.set(0, part.y, 0);
        return;
      }
      /*
       * ⚠️ A DOME IS NOT CENTRED, and this is where the two renderers genuinely disagree. Zdog's
       * `Hemisphere` puts its FLAT FACE at the origin and grows the crown away from it; Three's
       * half-sphere does the same, but the table places every part by its CENTRE. So the mesh has
       * to be pushed half its own height to put the flat face where the table says the part
       * begins — otherwise a piece stands half a dome too tall, which is exactly what the height
       * test caught: 10.6 where the table said 9.3.
       */
      mesh.position.set(0, part.y + (part.down ? -part.h / 2 : part.h / 2), 0);
    });
  }

  if (spec.sphere) {
    add(new THREE.SphereGeometry(spec.sphere.diameter / 2, SEGMENTS, SEGMENTS), (mesh) => {
      mesh.position.set(0, spec.sphere!.y, 0);
    });
  }

  return group;
}

/** Frees the geometries and materials a piece owns. Three does not do this on removal. */
export function disposePiece3d(group: THREE.Group): void {
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    const mat = node.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat.dispose();
  });
}
