// SPDX-License-Identifier: AGPL-3.0-or-later
// render/pieces/geometry — the six Hartwig pieces, as DATA.
//
// ========================= WHY DATA AND NOT ZDOG CALLS =========================
// A table of boxes can be reasoned about without a renderer: whether a piece fits its square,
// whether it stands on the board rather than floating, whether the six heights read in the order
// a player expects, whether the knight really is four equal cubes. Those are the claims worth
// holding, and they hold in the node project, in milliseconds, without a canvas.
//
// ========================= HARTWIG'S OWN WORDS =========================
// Josef Hartwig explained the set in 1924, and the explanation IS the specification:
//
//   · "Pawn and rook move at right angles to the edge of the board: expressed by the CUBE."
//     Two cubes, differing only in size.
//   · "The knight moves at right angles in a hook over four squares: FOUR CUBES combined at
//     right angles."
//   · "The bishop moves diagonally: a CROSS cut from the cube."
//   · "The king: a smaller cube turned ACROSS THE CORNER of a larger one." (über Eck — turned 45°,
//     not balanced on a vertex.)
//   · "A CIRCLE on the queen's top, for her versatile movement."
//
// Five of the six are boxes. Only the queen needs anything else, and what she needs is a BALL: the
// physical set carries a wooden sphere, and "a circle" is that sphere described in two dimensions.
// Zdog builds it from two Hemispheres. It was a flat disc at first — cheaper, and it read as a
// sticker.
//
// ========================= UNITS AND AXES =========================
// Everything is in Zdog units, where the square is TILE = 16. Zdog's Y points DOWN, so a piece
// occupies NEGATIVE y and its base sits at y = 0. `restsOnBoard` is the invariant that keeps that
// true: a piece that floats or sinks is not visible as an error, only as a wrongness.

import type { PieceType } from '../../chess/types.ts';

export interface BoxSpec {
  readonly w: number;
  readonly h: number;
  readonly d: number;
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  /** Turn about the vertical axis, in radians. */
  readonly rotY?: number;
}

/**
 * The ball on the queen's head.
 *
 * It was a flat disc — a single-point `Zdog.Shape` with a large stroke, which draws a filled circle
 * that always faces the camera. Cheap, and wrong: Hartwig's queen carries a wooden BALL, and
 * "a circle on the queen's top" is that ball described in two dimensions. Drawn flat it reads as a
 * sticker rather than as a sphere, and no amount of turning the board changes it.
 *
 * Now two `Zdog.Hemisphere`s, apex up and apex down. Zdog gives Hemisphere its own sort value —
 * the centroid 3/8 of the way to the apex — precisely so a pair of them behaves like one ball.
 */
export interface SphereSpec {
  readonly diameter: number;
  readonly y: number;
}

export interface PieceSpec {
  readonly boxes: readonly BoxSpec[];
  readonly sphere?: SphereSpec;
}

const QUARTER = Math.PI / 4;

/** One cube for the knight. Four of these make the hook. */
const HOOK = 4.6;

export const PIECE_SPECS: Readonly<Record<PieceType, PieceSpec>> = {
  // The cube, small. Spike 0 had pawn and rook at 1.31× apart, which is 4 px against 6 px on
  // screen — too close to read. Widened to exactly half again.
  p: { boxes: [{ w: 6, h: 6, d: 6, y: -3 }] },

  // The cube, large. Same shape as the pawn because they share the same movement.
  r: { boxes: [{ w: 9, h: 9, d: 9, y: -4.5 }] },

  // The hook: a column three cubes tall with a fourth cube beside its foot. Hartwig's own words
  // are "four cubes combined at right angles", and the SHAPE here is exactly that — but it is
  // built from TWO boxes rather than four.
  //
  // The decomposition matters because Zdog sorts whole FACES by depth. Four cubes share three
  // internal faces, and a shared face is coplanar with its twin: identical sort value, order
  // decided by nothing. Those interior faces are drawn (Zdog does not cull backfaces) and win the
  // tie often enough that the hook comes apart into loose cubes as the camera turns. Two boxes
  // touch on ONE face instead of three, and the piece holds together.
  n: {
    boxes: [
      { w: HOOK, h: HOOK * 3, d: HOOK, x: -HOOK / 2, y: -HOOK * 1.5 },
      { w: HOOK, h: HOOK, d: HOOK, x: +HOOK / 2, y: -HOOK / 2 },
    ],
  },

  // The cross, built so nothing INTERPENETRATES.
  //
  // It was two slabs crossed through each other, and that is unrenderable by a painter's
  // algorithm: Zdog sorts whole faces, so where the slabs pass through one another an entire
  // face of one wins over the other and the cross collapses into a notched block. Seen at a
  // large scale it is unmistakable, and it is what makes the X vanish as the board turns.
  //
  // Now one full slab plus two ARMS that meet its sides — three boxes that touch and never
  // overlap. The 45° turn is kept: it is what makes the cross read as DIAGONAL movement rather
  // than as a plus sign, which is Hartwig's whole reason for giving the bishop a cross.
  b: (() => {
    const SPAN = 10;
    const THICK = 3.4;
    const ARM = (SPAN - THICK) / 2;
    const REACH = (THICK + ARM) / 2;
    // The arms sit on the slab's local Z axis — perpendicular to its long side. Zdog's rotateY is
    // `x' = x·cos − z·sin, z' = z·cos + x·sin`, so local +Z points to world (−sin t, +cos t) and
    // NOT (+sin t, +cos t). Getting that sign wrong puts the arms along the slab's LONG axis,
    // where they sit inside it — which is the very overlap this shape exists to avoid, and which
    // the solidity test caught on its first run.
    const OFF = REACH * Math.SQRT1_2;
    return {
      boxes: [
        { w: SPAN, h: 11.5, d: THICK, y: -5.75, rotY: QUARTER },
        { w: THICK, h: 11.5, d: ARM, x: -OFF, z: +OFF, y: -5.75, rotY: QUARTER },
        { w: THICK, h: 11.5, d: ARM, x: +OFF, z: -OFF, y: -5.75, rotY: QUARTER },
      ],
    };
  })(),

  // A ball on top, for the queen who moves every way.
  q: {
    boxes: [{ w: 8.5, h: 8.5, d: 8.5, y: -4.25 }],
    sphere: { diameter: 7.5, y: -11.5 },
  },

  // A smaller cube turned across the corner of a larger one.
  k: {
    boxes: [
      { w: 10, h: 10, d: 10, y: -5, rotY: 0 },
      { w: 7.5, h: 7.5, d: 7.5, y: -13.75, rotY: QUARTER },
    ],
  },
};

/** Half-extents of a box on the board plane, after its turn about the vertical axis. */
function halfExtents(b: BoxSpec): { x: number; z: number } {
  const t = b.rotY ?? 0;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return {
    x: (b.w / 2) * c + (b.d / 2) * s,
    z: (b.w / 2) * s + (b.d / 2) * c,
  };
}

/**
 * The largest span the piece occupies on the board plane. Must stay under TILE or neighbouring
 * pieces run into each other on the back rank.
 *
 * ⚠️ Turning a THIN slab by 45° makes it NARROWER on the axis, not wider: `w·cos + d·sin` is
 * less than `w` when `d` is small. It is a roughly CUBIC box whose diagonal reaches further —
 * the king's finial, at 7.5·√2 ≈ 10.6. The spike 0 note stated this backwards.
 */
export function pieceFootprint(spec: PieceSpec): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const b of spec.boxes) {
    const half = halfExtents(b);
    const x = b.x ?? 0;
    const z = b.z ?? 0;
    minX = Math.min(minX, x - half.x);
    maxX = Math.max(maxX, x + half.x);
    minZ = Math.min(minZ, z - half.z);
    maxZ = Math.max(maxZ, z + half.z);
  }

  if (spec.sphere) {
    const r = spec.sphere.diameter / 2;
    minX = Math.min(minX, -r);
    maxX = Math.max(maxX, r);
    minZ = Math.min(minZ, -r);
    maxZ = Math.max(maxZ, r);
  }

  return Math.max(maxX - minX, maxZ - minZ);
}

/** How tall the piece stands above the board, in Zdog units. */
export function pieceHeight(spec: PieceSpec): number {
  let top = 0;
  for (const b of spec.boxes) top = Math.min(top, (b.y ?? 0) - b.h / 2);
  if (spec.sphere) top = Math.min(top, spec.sphere.y - spec.sphere.diameter / 2);
  return -top;
}

/**
 * Does the piece sit exactly on the board plane? A piece that floats or sinks looks like a
 * drawing mistake rather than reading as an error, so it is asserted rather than eyeballed.
 */
export function restsOnBoard(spec: PieceSpec): boolean {
  let bottom = -Infinity;
  for (const b of spec.boxes) bottom = Math.max(bottom, (b.y ?? 0) + b.h / 2);
  return Math.abs(bottom) < 1e-9;
}
