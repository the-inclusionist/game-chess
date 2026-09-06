// SPDX-License-Identifier: AGPL-3.0-or-later
// render/pieces/turned — the five historic patterns, as DATA.
//
// ========================= WHY THESE ARE NOT HARTWIG =========================
// Hartwig's set is stereometry: five of its six pieces are a cube and the sixth adds a ball, and
// that is the whole design — the movement of a piece expressed as a solid. Every European pattern
// from the eighteenth century on is a different thing entirely: a shape TURNED ON A LATHE, which
// is to say a stack of circles of varying diameter, plus a carved head for the knight because a
// horse cannot be turned.
//
// So this file speaks a different vocabulary from `geometry.ts`, and it is the vocabulary a lathe
// has: frusta, drums, cones and domes, stacked.
//
// ========================= ⚠️ WHERE THESE PROFILES COME FROM =========================
// The first version of this file was written from PROSE — a sentence of description per pattern,
// turned into a stack of drums — and it showed. Five patterns authored from adjectives come out as
// five variations on one shape, because the adjectives are what they have in common.
//
// These are drawn from reference, and the reference is named so the next person can check the
// drawing rather than trust it:
//
//   RÉGENCE    the plate from the *Encyclopédie Méthodique* (public domain, Wikimedia Commons,
//              File:RegenceChessPcs2.jpg). It settles what no description does: the base is a
//              SQUARE STEPPED PLINTH, the king and queen are URNS carrying stacked disc tiers, and
//              the bishop is a SPHERE under a wide flat saucer.
//   SELENUS    File:Selenus2.jpg — a set of the Schaakmuseum Max Euwe-Centrum, Amsterdam, public
//              domain on Wikimedia Commons. It settles that the CROWN OF PETALS belongs to the king
//              and queen alone, that the rook is the one straight drum on the board, and that the
//              king's finial is a long segmented spire.
//   ST GEORGE  the pattern is documented piece by piece rather than photographed: king with a
//              ribbed crown and a BALL finial, queen with a large bulb top, bishop with a split
//              mitre, rook with four crenellations, pawn with a bulb top. The ball is the whole
//              point of the pattern — St George is the English playing set with the cross REPLACED,
//              and every version of this file before this one gave it a cross.
//   STAUNTON   the 1849 Jaques pattern, which needs no citation and gets none.
//   SIKH       see its own section. It is the only one of the five that is a set sold TODAY rather
//              than a historic pattern, and that changes what fidelity means.
//
// ========================= ⚠️ WHAT SURVIVES, AND WHERE =========================
// The flat and projected boards are 232 logical pixels wide: a square is 29 and a piece stands
// about twenty pixels tall, so a mitre slit is not a pixel there and never will be. That argument
// was used to justify drawing these coarsely, and it was only ever half true — the WebGL board
// renders at the device's own resolution and now zooms, so on that board the profile is the
// picture. These are authored for the board that can show them, and they still have to read as
// six distinct silhouettes on the board that cannot.
//
// ========================= STACKED, NOT PLACED =========================
// Every y here is computed by `stack()` from the heights, bottom upward. Two dozen hand-placed
// centres per set is two dozen chances to float a collar half a unit above its own stem, and a
// piece that floats does not look like an error — it looks like a slightly wrong drawing.

import type { PieceType } from '../../chess/types.ts';
import type { BoxSpec, PieceSpec, TurnedSpec } from './geometry.ts';

/** One part of a turned piece, before it is told where it stands. */
interface Part {
  readonly shape: 'cylinder' | 'cone' | 'dome' | 'taper';
  /** Diameter at the bottom. For a cone this is the WIDE end. */
  readonly d: number;
  /** A taper's diameter at the top. */
  readonly dTop?: number;
  readonly h: number;
  /** A cone or dome pointing down instead of up. */
  readonly down?: boolean;
}

/**
 * Stacks parts upward from `from` and returns them with their centres filled in.
 *
 * Zdog's Y points DOWN, so a piece occupies negative y and the first part's base sits at `from` —
 * which is 0 for a piece that stands on the board and the top of the plinth for one that stands on
 * a plinth made of boxes, as every Régence piece does.
 */
function stack(parts: readonly Part[], from = 0): TurnedSpec[] {
  let base = from;
  return parts.map((part) => {
    const y = base - part.h / 2;
    base -= part.h;
    return { ...part, y };
  });
}

/**
 * A whole ball, as two hemispheres.
 *
 * ⚠️ NOT a `dome`. A dome is half a ball with its flat face down, and a bulb finial — which is what
 * a St George queen, a Staunton pawn and a Selenus bishop all carry — is a ball sitting on a neck
 * thinner than itself. Drawn as a dome it reads as a thumb pressed onto the stem.
 */
function ball(d: number): Part[] {
  return [{ shape: 'dome', d, h: d / 2, down: true }, { shape: 'dome', d, h: d / 2 }];
}

/**
 * The knight's head: the one thing on a lathe-turned board that is carved.
 *
 * ⚠️ IT IS A SLAB, NOT A BLOCK, and the depth is what makes that true. A horse's head is seen from
 * the side — that is the whole convention — so it is wide and tall and THIN. Cut as deep as it is
 * tall it reads as a cube standing on a stem, which is exactly what the first pass looked like on
 * screen once the head was made big enough to satisfy the height order.
 *
 * ⚠️ AND THE SIZE IS SMALL RELATIVE TO ITS NECK. The way to make a knight taller is to lengthen
 * what it stands on, never to grow the head: a head that outgrows the piece's own foot stops
 * looking carved and starts looking bolted on. `size` here is about a third of the piece.
 *
 * Three boxes: the muzzle tilted forward, the crest behind it, and one ear. The ear costs almost
 * nothing and it is the difference between a wedge and an animal — it is the only part of the
 * outline that is not a straight line, and the eye finds it first. The head stands 1.25 × `size`.
 */
function knightHead(top: number, size: number): BoxSpec[] {
  return [
    // The muzzle, tilted forward — the whole of what says "horse" at twenty pixels.
    { w: size * 1.55, h: size * 0.62, d: size * 0.55, y: top - size * 0.34, rotZ: -0.40 },
    // The crest behind it, upright, so the head has a back as well as a front.
    { w: size * 0.66, h: size * 1.02, d: size * 0.55, x: size * 0.44, y: top - size * 0.51 },
    // The ear.
    { w: size * 0.34, h: size * 0.40, d: size * 0.30, x: size * 0.30, y: top - size * 1.05 },
  ];
}

/**
 * A rook's battlements: four blocks stood around the rim of its cap.
 *
 * ⚠️ THIS IS WHY THE ROOK NEEDED BOXES. Four crenellations are named in the description of the
 * English and French patterns, and a lathe cannot cut them — they are sawn into the turned cap
 * afterwards. Drawn as one more disc, which is what this file did before, the rook is a drum with a
 * lid and nothing on the board says "tower".
 *
 * ⚠️ SELENUS DOES NOT GET THEM. Its rook is a plain banded drum in the photograph, and that is
 * exactly what makes it the only parallel-sided section on a Selenus board.
 */
function crenels(top: number, radius: number, size: number, height: number): BoxSpec[] {
  return [
    { w: size, h: height, d: size, x: +radius, y: top - height / 2 },
    { w: size, h: height, d: size, x: -radius, y: top - height / 2 },
    { w: size, h: height, d: size, z: +radius, y: top - height / 2 },
    { w: size, h: height, d: size, z: -radius, y: top - height / 2 },
  ];
}

/** The king's cross: an upright and a bar, which is two little boxes and not a carving. */
function cross(top: number, arm: number, thick: number): BoxSpec[] {
  return [
    { w: thick, h: arm * 2, d: thick, y: top - arm },
    { w: arm * 2, h: thick, d: thick, y: top - arm * 0.75 },
  ];
}

/* ============================ STAUNTON ============================ */
// The 1849 Jaques pattern. A broad low foot, a body that narrows in one long sweep to a collar,
// and a head that names the piece: a ball, a battlemented turret, a horse, a mitre, a coronet, a
// cross. The mass sits at the BOTTOM — the set was designed to be seen from across a table and to
// stand up when it is knocked, which is why it displaced everything else on this page.

const ST_BASE: Part[] = [
  { shape: 'taper', d: 11.0, dTop: 10.2, h: 1.0 },
  { shape: 'taper', d: 9.8, dTop: 6.8, h: 1.4 },
];

const STA = (parts: readonly Part[], boxes: readonly BoxSpec[] = []): PieceSpec => ({
  boxes: [...boxes],
  turned: stack([...ST_BASE, ...parts]),
});

export const SET_1849: Readonly<Record<PieceType, PieceSpec>> = {
  p: STA([
    { shape: 'taper', d: 6.4, dTop: 3.0, h: 3.2 },
    { shape: 'taper', d: 3.8, dTop: 3.2, h: 0.6 },
    ...ball(2.4),
  ]),

  r: STA([
    { shape: 'taper', d: 6.6, dTop: 5.6, h: 1.5 },
    { shape: 'cylinder', d: 5.4, h: 4.0 },
    { shape: 'taper', d: 5.2, dTop: 6.6, h: 0.9 },
    { shape: 'cylinder', d: 6.6, h: 0.5 },
  ], crenels(-9.3, 2.2, 1.7, 1.2)),

  n: {
    boxes: knightHead(-6.6, 4.0),
    turned: stack([...ST_BASE,
      { shape: 'taper', d: 6.6, dTop: 4.2, h: 3.6 },
      { shape: 'taper', d: 4.6, dTop: 4.0, h: 0.6 },
    ]),
  },

  b: STA([
    { shape: 'taper', d: 6.4, dTop: 3.0, h: 4.8 },
    { shape: 'taper', d: 4.2, dTop: 3.4, h: 0.7 },
    // The mitre. A taper and not a cone: a cone ends in a point, and the ball that finishes a
    // Staunton bishop sits on a flat, which is what stops it reading as a spike with a bead on it.
    { shape: 'taper', d: 4.8, dTop: 1.2, h: 3.3 },
    ...ball(1.4),
  ]),

  q: STA([
    { shape: 'taper', d: 6.8, dTop: 3.2, h: 7.6 },
    { shape: 'taper', d: 4.4, dTop: 3.6, h: 0.7 },
    // The coronet: the one place on the piece where the profile turns back OUTWARD.
    { shape: 'taper', d: 4.0, dTop: 6.4, h: 1.8 },
    { shape: 'cylinder', d: 6.4, h: 0.5 },
    { shape: 'taper', d: 3.2, dTop: 2.2, h: 0.8 },
    ...ball(1.8),
  ]),

  k: STA([
    { shape: 'taper', d: 7.0, dTop: 3.4, h: 8.6 },
    { shape: 'taper', d: 4.6, dTop: 3.8, h: 0.7 },
    { shape: 'taper', d: 4.2, dTop: 6.2, h: 1.7 },
    { shape: 'cylinder', d: 6.2, h: 0.5 },
    { shape: 'taper', d: 3.0, dTop: 2.0, h: 0.9 },
  ], cross(-14.8, 1.6, 1.3)),
};

/* ============================ RÉGENCE ============================ */
// The French pattern of the Café de la Régence, and the one Staunton was a reaction against.
// Drawn from the Encyclopédie Méthodique plate, which contradicts the description this file
// carried before it on the point that matters most: the Régence base is not small. It is a SQUARE
// STEPPED PLINTH, wider than anything the piece above it does, and the piece it carries is an
// URN — a body that opens UPWARD like a goblet — under a stack of disc tiers.
//
// ⚠️ THE PLINTH IS BOXES, so every turned part here is stacked from its top rather than from the
// board. It is the only pattern on the page whose foot is not a circle, and at twenty pixels a
// square corner against a square board is the fastest thing on the piece to recognise.

const REG_PLINTH: BoxSpec[] = [
  { w: 8.0, h: 0.8, d: 8.0, y: -0.4 },
  { w: 6.8, h: 0.7, d: 6.8, y: -1.15 },
];
const REG_TOP = -1.5;

/** Régence stacks its stem in TIERS: a swelling, then the disc that caps it. */
function tier(swell: number, disc: number): Part[] {
  return [
    { shape: 'taper', d: swell - 0.6, dTop: swell, h: 0.9 },
    { shape: 'cylinder', d: disc, h: 0.4 },
  ];
}

const REG = (parts: readonly Part[], boxes: readonly BoxSpec[] = []): PieceSpec => ({
  boxes: [...REG_PLINTH, ...boxes],
  turned: stack(parts, REG_TOP),
});

export const SET_REGENCE: Readonly<Record<PieceType, PieceSpec>> = {
  // A ball sitting almost on the plinth, a thin stem, and a small bell with a bead — the plate's
  // rightmost piece, and the only pawn on this page whose body is a sphere.
  p: REG([
    { shape: 'taper', d: 5.0, dTop: 4.2, h: 0.5 },
    ...ball(3.8),
    { shape: 'taper', d: 1.5, dTop: 1.3, h: 0.9 },
    { shape: 'taper', d: 1.3, dTop: 2.8, h: 0.9 },
    ...ball(1.1),
  ]),

  // A tapering tower with turned bands and four crenellations, which is the plate's fifth piece
  // almost literally. The bands are what make it a Régence rook rather than any other turret.
  r: REG([
    { shape: 'taper', d: 7.4, dTop: 6.4, h: 1.8 },
    { shape: 'cylinder', d: 6.6, h: 0.4 },
    { shape: 'taper', d: 6.2, dTop: 5.4, h: 1.6 },
    { shape: 'cylinder', d: 5.8, h: 0.4 },
    { shape: 'taper', d: 5.2, dTop: 4.6, h: 1.6 },
    { shape: 'cylinder', d: 5.6, h: 0.6 },
  ], crenels(-7.9, 1.9, 1.5, 1.3)),

  n: {
    boxes: [...REG_PLINTH, ...knightHead(-7.8, 3.2)],
    turned: stack([
      { shape: 'taper', d: 5.0, dTop: 3.2, h: 0.7 },
      { shape: 'taper', d: 2.2, dTop: 2.6, h: 1.6 },
      ...ball(3.4),
      { shape: 'taper', d: 1.8, dTop: 1.6, h: 0.6 },
    ], REG_TOP),
  },

  // The plate's third piece: a sphere, then a WIDE FLAT SAUCER, then a small point. Nothing else
  // on this page has a disc that overhangs its own body, and it is the whole of the silhouette.
  b: REG([
    { shape: 'taper', d: 5.2, dTop: 3.2, h: 0.7 },
    { shape: 'taper', d: 2.4, dTop: 2.8, h: 1.8 },
    ...ball(4.6),
    { shape: 'cylinder', d: 1.8, h: 0.5 },
    { shape: 'taper', d: 2.4, dTop: 6.2, h: 0.8 },
    { shape: 'taper', d: 6.2, dTop: 3.6, h: 0.7 },
    { shape: 'taper', d: 1.8, dTop: 1.6, h: 0.9 },
    { shape: 'cone', d: 2.6, h: 1.4 },
  ]),

  q: REG([
    { shape: 'taper', d: 5.0, dTop: 3.4, h: 0.7 },
    { shape: 'taper', d: 3.4, dTop: 7.2, h: 4.6 },
    { shape: 'cylinder', d: 7.2, h: 0.4 },
    ...tier(3.2, 5.0), ...tier(3.0, 4.6), ...tier(2.8, 4.2),
    { shape: 'cone', d: 2.6, h: 2.0 },
    ...ball(1.2),
  ]),

  // The king takes a fourth tier and finishes in a CROWN — a flared band with battlements round
  // it, which is what the plate draws and what no other king here has.
  k: REG([
    { shape: 'taper', d: 5.4, dTop: 3.6, h: 0.7 },
    { shape: 'taper', d: 3.6, dTop: 7.6, h: 5.4 },
    { shape: 'cylinder', d: 7.6, h: 0.4 },
    ...tier(3.4, 5.4), ...tier(3.2, 5.0), ...tier(3.0, 4.6), ...tier(2.8, 4.2),
    { shape: 'taper', d: 2.4, dTop: 4.6, h: 0.9 },
    { shape: 'cylinder', d: 4.6, h: 0.5 },
  ], crenels(-14.6, 1.7, 1.2, 1.4)),
};

/* ============================ ST GEORGE ============================ */
// The English playing set as modified for the St George Chess Club about 1840, turned by Calvert,
// by Lund, by Ayres and by Jaques among others, and in common use into the twentieth century.
//
// ⚠️ THE KING HAS A BALL, NOT A CROSS. That single substitution IS the St George pattern — it is
// the modification the club asked for and the reason the set has its own name — and every version
// of this file before this one gave it a cross, which made it a slightly wider Staunton.
//
// The rest follows the same description: a queen with a large bulb top, a bishop with a split
// mitre, a rook with four crenellations, a pawn with a bulb top. The bodies are bulbous low down
// with reeded collars, on the widest foot of the five.

const STG_BASE: Part[] = [
  { shape: 'taper', d: 12.4, dTop: 11.4, h: 0.9 },
  { shape: 'taper', d: 11.0, dTop: 7.2, h: 1.4 },
];

const STG = (parts: readonly Part[], boxes: readonly BoxSpec[] = []): PieceSpec => ({
  boxes: [...boxes],
  turned: stack([...STG_BASE, ...parts]),
});

export const SET_ST_GEORGE: Readonly<Record<PieceType, PieceSpec>> = {
  p: STG([
    { shape: 'taper', d: 6.8, dTop: 5.0, h: 1.6 },
    { shape: 'taper', d: 4.6, dTop: 2.6, h: 1.6 },
    { shape: 'cylinder', d: 3.4, h: 0.5 },
    ...ball(3.0),
  ]),

  r: STG([
    { shape: 'taper', d: 6.8, dTop: 5.4, h: 1.6 },
    { shape: 'taper', d: 5.0, dTop: 4.6, h: 3.4 },
    { shape: 'taper', d: 4.4, dTop: 6.4, h: 0.9 },
    { shape: 'cylinder', d: 6.4, h: 0.5 },
  ], crenels(-8.7, 2.1, 1.7, 1.3)),

  n: {
    boxes: knightHead(-6.7, 3.6),
    turned: stack([...STG_BASE,
      { shape: 'taper', d: 6.8, dTop: 5.0, h: 1.8 },
      { shape: 'taper', d: 4.6, dTop: 3.6, h: 2.1 },
      { shape: 'cylinder', d: 4.0, h: 0.5 },
    ]),
  },

  // ⚠️ THE SPLIT IS NOT DRAWN. A St George mitre is cut with a slit, and cutting is subtraction:
  // the table has no boolean and neither renderer has one either. What is here is the mitre
  // without its slit, which is honest, and the alternative — two half-mitres with a gap — is a
  // notch the flat board would draw as a black line down the middle of a twenty-pixel piece.
  b: STG([
    { shape: 'taper', d: 6.8, dTop: 4.6, h: 2.2 },
    { shape: 'taper', d: 4.0, dTop: 2.6, h: 2.4 },
    { shape: 'cylinder', d: 3.6, h: 0.5 },
    { shape: 'taper', d: 4.4, dTop: 1.2, h: 3.6 },
    ...ball(1.3),
  ]),

  q: STG([
    { shape: 'taper', d: 7.0, dTop: 4.4, h: 2.6 },
    { shape: 'taper', d: 3.8, dTop: 2.8, h: 4.2 },
    { shape: 'cylinder', d: 4.2, h: 0.5 },
    { shape: 'taper', d: 3.0, dTop: 2.4, h: 0.8 },
    // "Queens with large bulb top finials" — and large is the point: it is bigger than the king's.
    ...ball(4.4),
  ]),

  k: STG([
    { shape: 'taper', d: 7.2, dTop: 4.6, h: 2.8 },
    { shape: 'taper', d: 4.0, dTop: 3.0, h: 5.0 },
    { shape: 'cylinder', d: 4.4, h: 0.5 },
    // The ribbed crown: a flare, then three turned ribs.
    { shape: 'taper', d: 3.4, dTop: 5.6, h: 1.3 },
    { shape: 'cylinder', d: 5.6, h: 0.4 },
    { shape: 'cylinder', d: 5.0, h: 0.4 },
    { shape: 'cylinder', d: 4.4, h: 0.4 },
    { shape: 'taper', d: 2.6, dTop: 2.0, h: 0.8 },
    ...ball(3.4),
  ]),
};

/* ============================ SELENUS ============================ */
// Named for Gustavus Selenus — the pen name Augustus the Younger, Duke of Brunswick-Lüneburg, put
// on *Das Schach- oder König-Spiel* in 1616 — and the German pattern that stood for two centuries
// before Staunton.
//
// Drawn from a set of the Max Euwe-Centrum, and the photograph settles three things that prose had
// got wrong here:
//
//   · THE CROWN OF PETALS BELONGS TO THE KING AND QUEEN ALONE. It is a cup that opens upward with
//     a scalloped rim, and it is not a stack of discs on every piece. This file used to give every
//     piece a countable coronet and call the count its identity; the photograph shows four pieces
//     with no crown at all.
//   · THE ROOK IS THE ONE STRAIGHT DRUM on the board, banded top and bottom. Nothing else in the
//     set has a parallel-sided section, which is what makes it findable at any size.
//   · THE KING'S FINIAL IS A LONG SEGMENTED SPIRE — a tower of diminishing discs, nearly a third of
//     the piece. It is the tallest thing in the set by a long way and it is why a Selenus king is
//     unmistakable across a room.
//
// Under all of them: a small flared skirt and a long slender baluster stem with one vase-shaped
// swelling low down. The feet are the narrowest of the five and the pieces the most vertical.

const SEL_BASE: Part[] = [
  { shape: 'taper', d: 8.8, dTop: 6.0, h: 1.2 },
  { shape: 'taper', d: 5.2, dTop: 2.6, h: 0.9 },
];

/** The baluster: a shaft, the vase swelling, and the shaft above it. */
function baluster(shaft: number, swell: number, neck: number, above: number): Part[] {
  return [
    { shape: 'taper', d: shaft, dTop: shaft - 0.2, h: 1.0 + above * 0.2 },
    { shape: 'taper', d: shaft - 0.2, dTop: swell, h: 0.8 },
    { shape: 'taper', d: swell, dTop: neck, h: 1.0 },
    { shape: 'taper', d: neck, dTop: neck - 0.1, h: above },
  ];
}

const SEL = (parts: readonly Part[], boxes: readonly BoxSpec[] = []): PieceSpec => ({
  boxes: [...boxes],
  turned: stack([...SEL_BASE, ...parts]),
});

export const SET_SELENUS: Readonly<Record<PieceType, PieceSpec>> = {
  p: SEL([
    ...baluster(2.2, 3.0, 1.7, 1.0),
    { shape: 'cylinder', d: 2.8, h: 0.4 },
    ...ball(2.2),
    ...ball(0.9),
  ]),

  r: SEL([
    ...baluster(2.2, 3.2, 1.8, 0.8),
    { shape: 'cylinder', d: 4.6, h: 0.4 },
    { shape: 'cylinder', d: 4.2, h: 2.8 },
    { shape: 'cylinder', d: 4.6, h: 0.4 },
    ...ball(1.4),
  ]),

  n: {
    boxes: knightHead(-7.7, 3.2),
    turned: stack([...SEL_BASE,
      ...baluster(2.2, 3.2, 1.8, 2.0),
      { shape: 'cylinder', d: 3.4, h: 0.4 },
    ]),
  },

  b: SEL([
    ...baluster(2.2, 3.4, 1.8, 1.6),
    { shape: 'cylinder', d: 3.2, h: 0.4 },
    { shape: 'taper', d: 2.0, dTop: 2.8, h: 0.8 },
    ...ball(3.0),
    ...ball(1.0),
  ]),

  q: SEL([
    ...baluster(2.4, 3.6, 2.0, 1.8),
    { shape: 'cylinder', d: 3.6, h: 0.4 },
    // The crown: a cup opening upward. This and the king's are the only two on the board.
    { shape: 'taper', d: 3.4, dTop: 6.4, h: 2.2 },
    { shape: 'taper', d: 1.9, dTop: 1.7, h: 1.4 },
    { shape: 'cylinder', d: 2.8, h: 0.4 },
    ...ball(2.4),
    ...ball(0.9),
  ]),

  k: SEL([
    ...baluster(2.6, 3.8, 2.1, 1.8),
    { shape: 'cylinder', d: 3.8, h: 0.4 },
    { shape: 'taper', d: 3.6, dTop: 6.8, h: 2.3 },
    { shape: 'taper', d: 2.0, dTop: 1.8, h: 1.2 },
    // The spire: six diminishing discs and a point, which is a third of the piece.
    { shape: 'cylinder', d: 3.0, h: 0.5 },
    { shape: 'cylinder', d: 2.7, h: 0.5 },
    { shape: 'cylinder', d: 2.4, h: 0.5 },
    { shape: 'cylinder', d: 2.1, h: 0.5 },
    { shape: 'cylinder', d: 1.8, h: 0.5 },
    { shape: 'cylinder', d: 1.5, h: 0.5 },
    { shape: 'cone', d: 1.2, h: 2.0 },
  ]),
};

/* ============================ SIKH EMPIRE ============================ */
// ⚠️ THIS ONE IS NOT A HISTORIC PATTERN, and pretending otherwise is what the first version of it
// did. There is no catalogued nineteenth-century Punjabi playing pattern in the sense that Régence
// and Selenus are catalogued, and the drawing here used to be an ONION DOME AND A SPIRE — read off
// the region's architecture, which is a guess wearing a citation.
//
// What does exist, and what "Sikh Empire" names to anyone who looks it up today, is a set carved
// in Amritsar and sold under that name: a STAUNTON FORM, taller and more slender, whose king
// carries the KHANDA — the double-edged blade of the Sikh emblem — where a Staunton king carries a
// cross, and whose knight is the armoured horse of Ranjit Singh's cavalry.
//
// So that is what this is: the Staunton profile drawn thinner and taller, with the finial changed.
// It is deliberately the closest of the five to another pattern on this page, because the object it
// names is. What tells them apart at twenty pixels is the finial and the proportion; what tells
// them apart on the WebGL board is everything.

const SIK_BASE: Part[] = [
  { shape: 'taper', d: 10.4, dTop: 9.6, h: 0.9 },
  { shape: 'taper', d: 9.2, dTop: 6.2, h: 1.3 },
  { shape: 'cylinder', d: 5.6, h: 0.4 },
];

const SIK = (parts: readonly Part[], boxes: readonly BoxSpec[] = []): PieceSpec => ({
  boxes: [...boxes],
  turned: stack([...SIK_BASE, ...parts]),
});

/**
 * The Khanda: a straight double-edged blade, the chakram across it, and the two kirpans crossed
 * at its foot. Four boxes, which is what a finial gets.
 */
function khanda(top: number): BoxSpec[] {
  return [
    { w: 0.9, h: 3.4, d: 0.9, y: top - 1.7 },
    { w: 3.0, h: 0.9, d: 0.9, y: top - 1.0 },
    { w: 0.7, h: 2.4, d: 0.7, x: +1.3, y: top - 1.2, rotZ: +0.5 },
    { w: 0.7, h: 2.4, d: 0.7, x: -1.3, y: top - 1.2, rotZ: -0.5 },
  ];
}

export const SET_SIKH: Readonly<Record<PieceType, PieceSpec>> = {
  p: SIK([
    { shape: 'taper', d: 5.6, dTop: 2.8, h: 3.4 },
    { shape: 'taper', d: 3.6, dTop: 3.0, h: 0.6 },
    ...ball(2.6),
  ]),

  r: SIK([
    { shape: 'taper', d: 5.8, dTop: 5.0, h: 1.6 },
    { shape: 'cylinder', d: 4.8, h: 4.2 },
    { shape: 'taper', d: 4.6, dTop: 6.0, h: 0.9 },
    { shape: 'cylinder', d: 6.0, h: 0.5 },
  ], crenels(-9.8, 2.0, 1.6, 1.3)),

  n: {
    boxes: knightHead(-7.7, 3.6),
    turned: stack([...SIK_BASE,
      { shape: 'taper', d: 5.8, dTop: 3.8, h: 4.5 },
      { shape: 'taper', d: 4.2, dTop: 3.6, h: 0.6 },
    ]),
  },

  b: SIK([
    { shape: 'taper', d: 5.6, dTop: 2.8, h: 5.2 },
    { shape: 'taper', d: 3.8, dTop: 3.0, h: 0.7 },
    { shape: 'taper', d: 4.4, dTop: 1.1, h: 3.4 },
    ...ball(1.4),
  ]),

  q: SIK([
    { shape: 'taper', d: 6.0, dTop: 2.9, h: 8.2 },
    { shape: 'taper', d: 4.0, dTop: 3.2, h: 0.7 },
    { shape: 'taper', d: 3.6, dTop: 6.0, h: 1.8 },
    { shape: 'cylinder', d: 6.0, h: 0.5 },
    { shape: 'taper', d: 2.8, dTop: 2.0, h: 0.8 },
    ...ball(1.7),
  ]),

  k: SIK([
    { shape: 'taper', d: 6.2, dTop: 3.0, h: 8.8 },
    { shape: 'taper', d: 4.2, dTop: 3.4, h: 0.7 },
    { shape: 'taper', d: 3.8, dTop: 5.8, h: 1.6 },
    { shape: 'cylinder', d: 5.8, h: 0.5 },
    { shape: 'taper', d: 2.6, dTop: 1.8, h: 0.8 },
  ], khanda(-15.0)),
};
