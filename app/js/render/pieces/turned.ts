// SPDX-License-Identifier: AGPL-3.0-or-later
// render/pieces/turned — the three European patterns, as DATA.
//
// ========================= WHY THESE ARE NOT HARTWIG =========================
// Hartwig's set is stereometry: five of its six pieces are a cube and the sixth adds a ball, and
// that is the whole design — the movement of a piece expressed as a solid. Every European pattern
// from the eighteenth century on is a different thing entirely: a shape TURNED ON A LATHE, which
// is to say a stack of circles of varying diameter, plus a carved head for the knight because a
// horse cannot be turned.
//
// So this file speaks a different vocabulary from `geometry.ts`, and it is the vocabulary a lathe
// has: cylinders, cones, domes, stacked. Zdog has shipped `Cylinder` and `Cone` all along.
//
// ========================= ⚠️ WHAT SEPARATES THE THREE, AT THIS SIZE =========================
// The board is 232 logical pixels wide, so a square is 29 and a piece stands about 20 pixels tall.
// A Staunton bishop's mitre-slit, a Régence collar's bead, the fluting on a St George base — none
// of that is a pixel. Anyone claiming to draw the difference in detail is drawing it for a
// screenshot at 8x and not for the game.
//
// What DOES survive at 20 pixels is the silhouette: how wide the foot is against the head, where
// the mass sits, how tall the neck is, whether the finial is a ball or a point. That is what these
// three differ in, and each is authored from the one proportion that identifies its pattern:
//
//   1849 (à maneira de)  a broad low foot and a heavy collar; the mass is at the BOTTOM, and the
//                        heads are compact. The pattern was designed to be seen from across a
//                        table and to stand up when knocked.
//   Régence              tall and thin, a small foot, a long neck and a small head: the mass is in
//                        the MIDDLE and the piece reads as a line. The French pattern that
//                        Staunton was a reaction against.
//   St George            a bulbous body low down, a narrow waist and a large ball on top: the mass
//                        is at BOTH ENDS. The English pattern that came before Staunton.
//
// ========================= STACKED, NOT PLACED =========================
// Every y here is computed by `stack()` from the heights, bottom upward. Twenty-four hand-placed
// centres per set is twenty-four chances to float a collar half a unit above its own stem, and a
// piece that floats does not look like an error — it looks like a slightly wrong drawing.

import type { PieceType } from '../../chess/types.ts';
import type { BoxSpec, PieceSpec, TurnedSpec } from './geometry.ts';

/** One part of a turned piece, before it is told where it stands. */
interface Part {
  readonly shape: 'cylinder' | 'cone' | 'dome';
  /** Diameter. For a cone this is the WIDE end. */
  readonly d: number;
  readonly h: number;
  /** A cone or dome pointing down instead of up. */
  readonly down?: boolean;
}

/**
 * Stacks parts from the board upward and returns them with their centres filled in.
 *
 * Zdog's Y points DOWN, so a piece occupies negative y and the first part's base sits at 0.
 */
function stack(parts: readonly Part[]): TurnedSpec[] {
  let base = 0;
  return parts.map((part) => {
    const y = base - part.h / 2;
    base -= part.h;
    return { ...part, y };
  });
}

/** The knight's head: the one thing on a lathe-turned board that is carved. */
function knightHead(top: number, size: number): BoxSpec[] {
  return [
    // The muzzle, tilted forward — the whole of what says "horse" at twenty pixels.
    { w: size * 1.5, h: size * 0.72, d: size * 0.72, y: top - size * 0.36, rotZ: -0.42 },
    // The crest behind it, upright, so the head has a back as well as a front.
    { w: size * 0.62, h: size, d: size * 0.72, x: size * 0.42, y: top - size * 0.5 },
  ];
}

/* ============================ À MANEIRA DE 1849 ============================ */
// Broad foot, heavy collar, compact heads: the mass is at the bottom.

const S49 = (parts: readonly Part[], boxes: readonly BoxSpec[] = []): PieceSpec => ({
  boxes: [...boxes],
  turned: stack([{ shape: 'cylinder', d: 10, h: 1.7 }, { shape: 'cylinder', d: 8.4, h: 1.0 },
    ...parts]),
});

export const SET_1849: Readonly<Record<PieceType, PieceSpec>> = {
  p: S49([{ shape: 'cone', d: 5.6, h: 2.6, down: true }, { shape: 'cylinder', d: 3.0, h: 1.4 },
    { shape: 'dome', d: 5.2, h: 2.6 }]),
  r: S49([{ shape: 'cylinder', d: 6.6, h: 5.0 }, { shape: 'cylinder', d: 8.2, h: 1.6 },
    { shape: 'cylinder', d: 7.0, h: 1.2 }]),
  b: S49([{ shape: 'cone', d: 6.4, h: 4.4, down: true }, { shape: 'cylinder', d: 6.2, h: 1.0 },
    { shape: 'cone', d: 5.6, h: 4.0 }, { shape: 'dome', d: 2.2, h: 1.1 }]),
  n: {
    boxes: knightHead(-8.7, 4.6),
    turned: stack([{ shape: 'cylinder', d: 10, h: 1.7 }, { shape: 'cylinder', d: 8.4, h: 1.0 },
      { shape: 'cone', d: 6.8, h: 5.0, down: true }, { shape: 'cylinder', d: 4.6, h: 1.0 }]),
  },
  q: S49([{ shape: 'cone', d: 6.8, h: 8.2, down: true }, { shape: 'cylinder', d: 7.6, h: 1.4 },
    { shape: 'cone', d: 7.2, h: 1.6, down: true }, { shape: 'dome', d: 3.4, h: 1.7 }]),
  k: {
    boxes: [
      { w: 1.3, h: 3.4, d: 1.3, y: -16.3 },
      { w: 3.2, h: 1.3, d: 1.3, y: -16.9 },
    ],
    turned: stack([{ shape: 'cylinder', d: 10, h: 1.7 }, { shape: 'cylinder', d: 8.4, h: 1.0 },
      { shape: 'cone', d: 7.0, h: 7.4, down: true }, { shape: 'cylinder', d: 7.8, h: 1.4 },
      { shape: 'cone', d: 7.4, h: 1.6, down: true }, { shape: 'dome', d: 3.0, h: 1.5 }]),
  },
};

/* ============================ RÉGENCE ============================ */
// Small foot, long neck, small head: the piece reads as a line.

const REG = (parts: readonly Part[], boxes: readonly BoxSpec[] = []): PieceSpec => ({
  boxes: [...boxes],
  turned: stack([{ shape: 'cylinder', d: 8.6, h: 1.1 }, { shape: 'cone', d: 7.6, h: 1.6, down: true },
    ...parts]),
});

export const SET_REGENCE: Readonly<Record<PieceType, PieceSpec>> = {
  p: REG([{ shape: 'cylinder', d: 2.4, h: 3.4 }, { shape: 'cylinder', d: 4.0, h: 0.7 },
    { shape: 'dome', d: 3.8, h: 1.9 }]),
  r: REG([{ shape: 'cylinder', d: 2.8, h: 4.6 }, { shape: 'cylinder', d: 6.6, h: 1.0 },
    { shape: 'cylinder', d: 5.4, h: 2.2 }]),
  b: REG([{ shape: 'cylinder', d: 2.6, h: 6.4 }, { shape: 'cylinder', d: 5.0, h: 0.8 },
    { shape: 'cone', d: 4.4, h: 3.0 }, { shape: 'dome', d: 1.8, h: 0.9 }]),
  n: {
    boxes: knightHead(-10.1, 4.2),
    turned: stack([{ shape: 'cylinder', d: 8.6, h: 1.1 },
      { shape: 'cone', d: 7.6, h: 1.6, down: true },
      { shape: 'cylinder', d: 2.6, h: 6.6 }, { shape: 'cylinder', d: 4.4, h: 0.8 }]),
  },
  q: REG([{ shape: 'cylinder', d: 2.8, h: 10.0 }, { shape: 'cylinder', d: 5.6, h: 0.9 },
    { shape: 'cone', d: 5.2, h: 1.4, down: true }, { shape: 'dome', d: 3.2, h: 1.6 }]),
  k: {
    boxes: [
      { w: 1.1, h: 2.8, d: 1.1, y: -17.2 },
      { w: 2.6, h: 1.1, d: 1.1, y: -17.7 },
    ],
    turned: stack([{ shape: 'cylinder', d: 8.6, h: 1.1 },
      { shape: 'cone', d: 7.6, h: 1.6, down: true },
      { shape: 'cylinder', d: 3.0, h: 9.4 }, { shape: 'cylinder', d: 5.8, h: 0.9 },
      { shape: 'cone', d: 5.4, h: 1.4, down: true }, { shape: 'dome', d: 2.8, h: 1.4 }]),
  },
};

/* ============================ ST GEORGE ============================ */
// A bulbous body low down, a narrow waist, a large ball on top: mass at both ends.

const STG = (parts: readonly Part[], boxes: readonly BoxSpec[] = []): PieceSpec => ({
  boxes: [...boxes],
  turned: stack([{ shape: 'cylinder', d: 11, h: 1.4 }, { shape: 'cone', d: 10, h: 1.8, down: true },
    ...parts]),
});

export const SET_ST_GEORGE: Readonly<Record<PieceType, PieceSpec>> = {
  p: STG([{ shape: 'dome', d: 6.4, h: 3.2 }, { shape: 'cylinder', d: 2.6, h: 0.9 },
    { shape: 'dome', d: 4.2, h: 2.1 }]),
  r: STG([{ shape: 'dome', d: 7.4, h: 3.7 }, { shape: 'cylinder', d: 3.0, h: 1.0 },
    { shape: 'cylinder', d: 7.0, h: 1.4 }, { shape: 'cylinder', d: 5.8, h: 1.2 }]),
  b: STG([{ shape: 'dome', d: 7.2, h: 3.6 }, { shape: 'cylinder', d: 2.8, h: 2.4 },
    { shape: 'cone', d: 5.4, h: 3.4 }, { shape: 'dome', d: 2.4, h: 1.2 }]),
  n: {
    boxes: knightHead(-10.2, 4.8),
    turned: stack([{ shape: 'cylinder', d: 11, h: 1.4 },
      { shape: 'cone', d: 10, h: 1.8, down: true },
      { shape: 'dome', d: 7.2, h: 3.6 }, { shape: 'cylinder', d: 3.2, h: 3.4 }]),
  },
  q: STG([{ shape: 'dome', d: 8.0, h: 4.0 }, { shape: 'cylinder', d: 3.0, h: 5.0 },
    { shape: 'cylinder', d: 6.4, h: 1.1 }, { shape: 'dome', d: 5.4, h: 2.7 }]),
  k: {
    boxes: [
      { w: 1.4, h: 3.0, d: 1.4, y: -16.5 },
      { w: 3.4, h: 1.4, d: 1.4, y: -17.0 },
    ],
    turned: stack([{ shape: 'cylinder', d: 11, h: 1.4 },
      { shape: 'cone', d: 10, h: 1.8, down: true },
      { shape: 'dome', d: 8.2, h: 4.1 }, { shape: 'cylinder', d: 3.2, h: 4.0 },
      { shape: 'cylinder', d: 6.6, h: 1.1 }, { shape: 'dome', d: 5.2, h: 2.6 }]),
  },
};

/* ============================ SELENUS ============================ */
// Named for Gustavus Selenus — the pen name Augustus the Younger, Duke of Brunswick-Lüneburg, put
// on *Das Schach- oder König-Spiel* in 1616 — and the German pattern that stood for two centuries
// before Staunton. A long thin stem carrying a CORONET of stacked discs, and the number of tiers
// is what names the piece: one for a pawn, four for a king. It is the only pattern here whose
// identity is countable rather than proportional, which is exactly what survives at twenty pixels.

const SEL = (parts: readonly Part[], boxes: readonly BoxSpec[] = []): PieceSpec => ({
  boxes: [...boxes],
  turned: stack([{ shape: 'cylinder', d: 9.0, h: 1.2 }, { shape: 'cone', d: 8.0, h: 1.3, down: true },
    ...parts]),
});

export const SET_SELENUS: Readonly<Record<PieceType, PieceSpec>> = {
  p: SEL([{ shape: 'cylinder', d: 2.6, h: 3.4 }, { shape: 'cylinder', d: 5.0, h: 0.9 },
    { shape: 'dome', d: 3.2, h: 1.6 }]),
  r: SEL([{ shape: 'cylinder', d: 2.8, h: 4.4 }, { shape: 'cylinder', d: 6.0, h: 1.0 },
    { shape: 'cylinder', d: 5.6, h: 2.6 }]),
  b: SEL([{ shape: 'cylinder', d: 2.6, h: 6.0 }, { shape: 'cylinder', d: 5.2, h: 0.9 },
    { shape: 'cone', d: 4.6, h: 2.4 }, { shape: 'dome', d: 1.8, h: 0.9 }]),
  n: {
    boxes: knightHead(-10.4, 4.2),
    turned: stack([{ shape: 'cylinder', d: 9.0, h: 1.2 },
      { shape: 'cone', d: 8.0, h: 1.3, down: true },
      { shape: 'cylinder', d: 2.6, h: 7.0 }, { shape: 'cylinder', d: 4.8, h: 0.9 }]),
  },
  q: SEL([{ shape: 'cylinder', d: 2.8, h: 9.2 }, { shape: 'cylinder', d: 5.8, h: 0.9 },
    { shape: 'cylinder', d: 4.8, h: 0.9 }, { shape: 'cylinder', d: 3.8, h: 0.9 },
    { shape: 'dome', d: 3.0, h: 1.5 }]),
  k: SEL([{ shape: 'cylinder', d: 3.0, h: 9.6 }, { shape: 'cylinder', d: 6.2, h: 0.9 },
    { shape: 'cylinder', d: 5.2, h: 0.9 }, { shape: 'cylinder', d: 4.2, h: 0.9 },
    { shape: 'cylinder', d: 3.2, h: 0.9 }, { shape: 'dome', d: 2.6, h: 1.3 }]),
};

/* ============================ SIKH EMPIRE ============================ */
// ⚠️ READ FROM THE ARCHITECTURE, not copied from a catalogued set. The turned sets of nineteenth
// century Punjab are not documented the way the European patterns are, and inventing a provenance
// for a drawing is worse than admitting where it came from. What IS documented, and what the
// pieces of that region share with everything built around them, is the vocabulary: a swelling
// ONION DOME on a wide plinth, finished with a slender spire.
//
// So that is the whole pattern here — bulb and spire, growing in both directions with rank. It is
// the only set on this board whose finial is a point rather than a ball, which is what makes it
// tell apart from St George at a glance despite both being bulbous.

const SIK = (parts: readonly Part[], boxes: readonly BoxSpec[] = []): PieceSpec => ({
  boxes: [...boxes],
  turned: stack([{ shape: 'cylinder', d: 11.2, h: 1.3 }, { shape: 'cone', d: 10.2, h: 1.4, down: true },
    ...parts]),
});

export const SET_SIKH: Readonly<Record<PieceType, PieceSpec>> = {
  p: SIK([{ shape: 'cone', d: 5.4, h: 1.4, down: true }, { shape: 'dome', d: 5.4, h: 2.7 },
    { shape: 'cone', d: 1.8, h: 1.6 }]),
  r: SIK([{ shape: 'cylinder', d: 5.6, h: 3.7 }, { shape: 'cylinder', d: 7.4, h: 1.0 },
    { shape: 'dome', d: 6.4, h: 3.2 }]),
  b: SIK([{ shape: 'cylinder', d: 3.0, h: 3.6 }, { shape: 'cone', d: 6.0, h: 1.6, down: true },
    { shape: 'dome', d: 6.0, h: 3.0 }, { shape: 'cone', d: 1.8, h: 2.0 }]),
  n: {
    boxes: knightHead(-10.2, 4.4),
    turned: stack([{ shape: 'cylinder', d: 11.2, h: 1.3 },
      { shape: 'cone', d: 10.2, h: 1.4, down: true },
      { shape: 'cylinder', d: 3.2, h: 6.6 }, { shape: 'cylinder', d: 4.6, h: 0.9 }]),
  },
  q: SIK([{ shape: 'cylinder', d: 3.2, h: 5.0 }, { shape: 'cone', d: 7.0, h: 1.8, down: true },
    { shape: 'dome', d: 7.0, h: 3.5 }, { shape: 'cone', d: 2.2, h: 2.6 }]),
  k: SIK([{ shape: 'cylinder', d: 3.4, h: 5.6 }, { shape: 'cone', d: 7.6, h: 2.0, down: true },
    { shape: 'dome', d: 7.6, h: 3.8 }, { shape: 'cylinder', d: 2.0, h: 1.2 },
    { shape: 'cone', d: 2.4, h: 3.0 }]),
};
