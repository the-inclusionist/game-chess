// SPDX-License-Identifier: AGPL-3.0-or-later
// render3d/geometry3d — Hartwig as he described it, without the flat renderer's compromises.
//
// ========================= ⚠️ WHAT WAS BENT, AND BY WHAT =========================
// `render/pieces/geometry.ts` is the shared table, and two of its six pieces are not the design
// Josef Hartwig described. They are the design as a PAINTER'S ALGORITHM can draw it, and the
// comments there say so plainly:
//
//   · THE KNIGHT. Hartwig: "four cubes combined at right angles." The table builds it from TWO
//     boxes, because four cubes share three internal faces, a shared face is coplanar with its
//     twin, and coplanar faces have identical sort values — so the order is decided by nothing.
//     Zdog draws those interior faces (it does not cull backfaces) and they win the tie often
//     enough that the hook comes apart into loose cubes as the camera turns.
//   · THE BISHOP. Hartwig: "a cross cut from the cube." A cross cut from a cube is two slabs
//     passing THROUGH each other, and that is unrenderable by a painter's algorithm: where they
//     interpenetrate, one whole face wins over the other and the cross collapses into a notched
//     block.
//
// Neither constraint exists here. A depth buffer resolves interpenetration per pixel, and it does
// not care how many internal faces two cubes share. So this table is the set as described: the
// knight is four cubes and the bishop is two crossing slabs.
//
// ========================= WHY A SECOND TABLE AND NOT A FIXED ONE =========================
// The flat and projected boards still need the workarounds — the limitation is real where they
// draw. Editing the shared table would break them to fix this one. So this is an OVERRIDE, keyed
// by design, and `specs3dFor` falls through to the shared table for everything with no reason to
// differ. The turned patterns have no such reason: a stack of coaxial cylinders is already what a
// lathe makes, and nothing about it was bent to suit a sort order.

import type { PieceType } from '../chess/types.ts';
import { PIECE_SPECS, type PieceSpec } from '../render/pieces/geometry.ts';
import { pieceDesign } from '../render/pieces/sets.ts';

const QUARTER = Math.PI / 4;

/** One cube of the knight. Four of these make the hook, and here there really are four. */
const HOOK = 4.6;

/** The bishop's cross, in the proportions the shared table already uses. */
const SPAN = 10;
const THICK = 3.4;
const CROSS_H = 11.5;

export const HARTWIG_3D: Readonly<Record<PieceType, PieceSpec>> = {
  ...PIECE_SPECS,

  /*
   * FOUR CUBES COMBINED AT RIGHT ANGLES — Hartwig's own words, and now the actual construction:
   * a column of three with a fourth beside its foot, which is the hook the knight's move draws.
   *
   * They share faces, and that is fine here. The three interior faces that made Zdog take the
   * piece apart are simply never a question for a depth buffer: two coincident surfaces resolve
   * per pixel, and a shared face is not drawn over the cube in front of it.
   */
  n: {
    boxes: [
      { w: HOOK, h: HOOK, d: HOOK, x: -HOOK / 2, y: -HOOK / 2 },
      { w: HOOK, h: HOOK, d: HOOK, x: -HOOK / 2, y: -HOOK * 1.5 },
      { w: HOOK, h: HOOK, d: HOOK, x: -HOOK / 2, y: -HOOK * 2.5 },
      { w: HOOK, h: HOOK, d: HOOK, x: +HOOK / 2, y: -HOOK / 2 },
    ],
  },

  /*
   * A CROSS CUT FROM THE CUBE: two slabs through one another, which is what "cut from" means and
   * what the flat board cannot draw. The 45° turn is Hartwig's too — it is what makes the cross
   * read as DIAGONAL movement rather than as a plus sign, which is his whole reason for giving
   * the bishop a cross at all.
   *
   * The shared table's three-box version — one slab plus two arms that meet its sides and never
   * overlap — is the same silhouette from directly above and a notched block from anywhere else.
   */
  b: {
    boxes: [
      { w: SPAN, h: CROSS_H, d: THICK, y: -CROSS_H / 2, rotY: QUARTER },
      { w: THICK, h: CROSS_H, d: SPAN, y: -CROSS_H / 2, rotY: QUARTER },
    ],
  },
};

/**
 * The drawing this view should build for a design, which is the shared table unless there is a
 * reason to differ. Only Hartwig has one, and the reason is written above.
 */
export function specs3dFor(key: string): Readonly<Record<PieceType, PieceSpec>> {
  return key === 'hartwig' ? HARTWIG_3D : pieceDesign(key).specs;
}
