// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= ONE TABLE, TWO RENDERERS =========================
// `render/pieces/geometry.ts` is a table rather than a set of drawing calls, and this is the test
// that the decision paid off: Three reads the SAME table Zdog reads, and a piece built by one has
// the bounds the other's arithmetic predicts. If these ever disagree, one of the two renderers has
// grown its own copy of the shapes — which is the failure this whole arrangement exists to make
// impossible.
//
// No WebGL is touched here. Geometries and materials are plain objects; only a renderer needs a
// context, and there is no renderer in this file.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  PIECE_SPECS, pieceFootprint, pieceHeight, restsOnBoard,
} from '../app/js/render/pieces/geometry.ts';
import { PIECE_DESIGNS, pieceDesign } from '../app/js/render/pieces/sets.ts';
import { LIGHT_PIECES } from '../app/js/render/palette.ts';
import { buildPiece3d, disposePiece3d } from '../app/js/render3d/pieces.ts';
import { HARTWIG_3D, specs3dFor } from '../app/js/render3d/geometry3d.ts';
import { TILE } from '../app/js/render/resolution.ts';
import type { PieceType } from '../app/js/chess/types.ts';

const ALL: PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k'];

const boundsOf = (group: THREE.Object3D): THREE.Box3 => new THREE.Box3().setFromObject(group);

describe('[3D] a piece is the table, built', () => {
  it('stands ON the board, base at zero, for every piece of every design', () => {
    // ⚠️ Y POINTS DOWN in this scene, as it does in the table: a piece occupies negative y and
    // its base sits at 0. Mirroring the axis would have meant re-deriving the sign of every
    // rotation in the table, which is invisible on a cube and wrong on a knight's head.
    for (const design of PIECE_DESIGNS) {
      for (const type of ALL) {
        const group = buildPiece3d(design.specs[type], LIGHT_PIECES);
        const box = boundsOf(group);
        expect(`${design.key} ${type} ${Math.abs(box.max.y) < 0.01}`)
          .toBe(`${design.key} ${type} true`);
        disposePiece3d(group);
      }
    }
  });

  it('is as tall as the flat renderer says it is', () => {
    for (const design of PIECE_DESIGNS) {
      for (const type of ALL) {
        const spec = design.specs[type];
        const group = buildPiece3d(spec, LIGHT_PIECES);
        const box = boundsOf(group);
        expect(box.min.y).toBeCloseTo(-pieceHeight(spec), 1);
        disposePiece3d(group);
      }
    }
  });

  it('is as wide as the flat renderer says it is', () => {
    // The footprint arithmetic in `geometry.ts` projects a box's eight corners. Three builds the
    // real solid and measures it. They are two ways of answering one question and they agree.
    for (const design of PIECE_DESIGNS) {
      for (const type of ALL) {
        const spec = design.specs[type];
        const group = buildPiece3d(spec, LIGHT_PIECES);
        const size = boundsOf(group).getSize(new THREE.Vector3());
        expect(Math.max(size.x, size.z)).toBeCloseTo(pieceFootprint(spec), 1);
        disposePiece3d(group);
      }
    }
  });
});

describe('[3D] the outline is an inverted hull', () => {
  it('doubles the meshes and grows the second one', () => {
    // WebGL has no wide line worth using, so a solid is outlined by drawing it AGAIN, larger,
    // with the front faces culled. The same shape as the second Box the Zdog builder draws.
    const spec = pieceDesign('hartwig').specs.r;
    const plain = buildPiece3d(spec, LIGHT_PIECES);
    const edged = buildPiece3d(spec, LIGHT_PIECES, { outline: true });
    expect(edged.children.length).toBe(plain.children.length * 2);
    expect(boundsOf(edged).getSize(new THREE.Vector3()).x)
      .toBeGreaterThan(boundsOf(plain).getSize(new THREE.Vector3()).x);
    disposePiece3d(plain);
    disposePiece3d(edged);
  });

  it('culls the FRONT of the hull, or it would simply hide the piece', () => {
    const group = buildPiece3d(pieceDesign('hartwig').specs.p, LIGHT_PIECES, { outline: true });
    const hull = group.children[1] as THREE.Mesh;
    expect((hull.material as THREE.Material).side).toBe(THREE.BackSide);
    disposePiece3d(group);
  });
});

describe('[3D] high contrast is not lit', () => {
  it('uses an unlit material when asked, and a shaded one otherwise', () => {
    // ⚠️ NOT A STYLE. Those palettes were solved numerically — every pair that touches clears
    // 3:1 — and a light source moves every one of those numbers by an amount nobody measured.
    const lit = buildPiece3d(pieceDesign('hartwig').specs.p, LIGHT_PIECES);
    const flat = buildPiece3d(pieceDesign('hartwig').specs.p, LIGHT_PIECES, { unlit: true });
    expect((lit.children[0] as THREE.Mesh).material).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect((flat.children[0] as THREE.Mesh).material).toBeInstanceOf(THREE.MeshBasicMaterial);
    disposePiece3d(lit);
    disposePiece3d(flat);
  });
});

describe('[3D] Hartwig as he described it', () => {
  it('builds the knight from FOUR cubes, which the flat board cannot', () => {
    // ⚠️ Hartwig: "the knight moves at right angles in a hook over four squares: FOUR CUBES
    // combined at right angles." The shared table uses two boxes because four cubes share three
    // internal faces, coplanar faces tie in a painter's sort, and the hook comes apart as the
    // camera turns. A depth buffer resolves that per pixel and does not care.
    expect(PIECE_SPECS.n.boxes).toHaveLength(2);
    expect(HARTWIG_3D.n.boxes).toHaveLength(4);
    for (const box of HARTWIG_3D.n.boxes) {
      expect(`${box.w} ${box.h} ${box.d}`).toBe(`${box.w} ${box.w} ${box.w}`);
    }
  });

  it('builds the bishop as two slabs THROUGH one another, which is what a cross cut from a cube is', () => {
    // The shared table uses three boxes that touch and never overlap, because interpenetration is
    // unrenderable by a painter's algorithm: one whole face wins and the cross becomes a notched
    // block. Here the two slabs simply cross.
    expect(PIECE_SPECS.b.boxes).toHaveLength(3);
    const [a, b] = HARTWIG_3D.b.boxes;
    expect(HARTWIG_3D.b.boxes).toHaveLength(2);
    // Crossed: one long on its width, the other long on its depth, both turned 45°.
    expect(a.w).toBeGreaterThan(a.d);
    expect(b.d).toBeGreaterThan(b.w);
    expect(a.rotY).toBeCloseTo(Math.PI / 4, 6);
    expect(b.rotY).toBeCloseTo(Math.PI / 4, 6);
    // And they really do overlap, which is the whole difference.
    expect(Math.abs((a.x ?? 0) - (b.x ?? 0))).toBeLessThan(0.01);
    expect(Math.abs((a.z ?? 0) - (b.z ?? 0))).toBeLessThan(0.01);
  });

  it('keeps every promise the shared table makes, for every piece', () => {
    // The override changes how a piece is CONSTRUCTED, never how big it is or where it stands.
    for (const type of ALL) {
      expect(`${type} ${restsOnBoard(HARTWIG_3D[type])}`).toBe(`${type} true`);
      expect(pieceHeight(HARTWIG_3D[type])).toBeCloseTo(pieceHeight(PIECE_SPECS[type]), 6);
      expect(pieceFootprint(HARTWIG_3D[type])).toBeLessThan(TILE);
    }
  });

  it('leaves every other design alone, because none of them was bent', () => {
    // A stack of coaxial cylinders is already what a lathe makes; nothing about the turned
    // patterns was shaped to suit a sort order.
    for (const design of PIECE_DESIGNS) {
      if (design.key === 'hartwig') continue;
      expect(specs3dFor(design.key)).toBe(design.specs);
    }
  });
});
