// SPDX-License-Identifier: AGPL-3.0-or-later
// render/hint-arrows — a suggested move, turned into the arrow that draws it.
//
// ========================= WHY AN ARROW AND NOT A PAIR OF MARKS =========================
// The first version marked only the destination, which is half a sentence: "play to d4" is not
// advice until you know which piece. The second marked both ends and had to invent a way of
// saying WHICH end belongs to WHICH move — a hue per move, and a radial slot as its non-colour
// twin, because three pieces can all be able to take on d4 and three separate marks on that
// square say nothing about who is being asked to go there.
//
// An arrow does not encode the pairing. It DRAWS it. There is nothing left for a reader to
// decode, no legend to learn, and no colour carrying meaning on its own (1.4.1) — direction is a
// shape. It is also what every chess site on earth uses, which is not an argument from fashion:
// it means a child who has seen a board before already knows how to read this one.
//
// ========================= WHY THIS IS ITS OWN MODULE =========================
// Both boards draw the same hint and neither may learn it from the other. The projected board is
// Zdog and the flat board is DOM, and `main-2d.ts` exists to be the entry point that never loads
// Zdog at all — 110 KB against 148 KB, measured. So the geometry lives here, in a module with no
// imports at all, and both views scale it into their own coordinates.

/** One suggested move. Both halves, because half of one is not advice. */
export interface HintMove {
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  /** Centipawns behind the best move. Zero for the best move itself. */
  readonly behind: number;
}

/** A point in whatever unit the caller works in. The maths below is scale-free. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The arrow for one suggested move: a shaft and two wings, ready to stroke. */
export interface Arrow {
  /** How far behind the best move this one scored, in centipawns. Chooses width and hue. */
  readonly behind: number;
  readonly tail: Point;
  readonly head: Point;
  /** The two barbs, each a point to draw a line to the head from. */
  readonly wings: readonly [Point, Point];
}

/**
 * How much of a tile each end gives up, and how big the barbs are. Fractions of one square.
 *
 * ⚠️ The TAIL is inset much further than the head. An arrow that started at the exact centre of
 * its own square would be drawn straight through the piece it is talking about, and the piece is
 * the thing the reader has to identify. Starting outside it leaves the piece legible and still
 * points at it unambiguously — nothing else in this game draws a line out of that square.
 */
const TAIL_INSET = 0.34;
const HEAD_INSET = 0.10;
const BARB_LENGTH = 0.30;
const BARB_SPREAD = 0.22;

/**
 * Shaft width, in fractions of a tile: boldest for the engine's own choice, thinnest for a move
 * at the far edge of what still counts as the same level.
 *
 * ⚠️ THIS IS THE CHANNEL THAT ACTUALLY RANKS THEM. The colours ramp too, but a red-to-violet
 * ramp is close to one colour for a deuteranope, and no hue in it clears 3:1 against every square
 * this game can draw. Thickness survives greyscale, every kind of colour blindness and a
 * projector with the contrast wound down (1.4.1).
 */
const WIDEST = 0.15;
const NARROWEST = 0.07;

/** How thick the arrow for a move this far behind the best should be. `band` is the margin. */
export function arrowWidth(behind: number, band: number): number {
  if (band <= 0) return WIDEST;
  const away = Math.min(Math.max(behind, 0), band) / band;
  return WIDEST - (WIDEST - NARROWEST) * away;
}

/**
 * The arrow from one square centre to another, in the caller's units.
 *
 * `tile` is how long one square is in those units — every inset above is a fraction of it, so an
 * arrow keeps its proportions whether it is drawn across 8 SVG units or 80 Zdog ones.
 *
 * A move from a square to itself has no direction to point in, so it comes back as `null` rather
 * than as a division by zero. Chess has no such move, but a take-back mid-animation can ask.
 */
export function arrowBetween(from: Point, to: Point, tile: number): Arrow | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return null;

  const ux = dx / length;
  const uy = dy / length;

  const tail: Point = { x: from.x + ux * tile * TAIL_INSET, y: from.y + uy * tile * TAIL_INSET };
  const head: Point = { x: to.x - ux * tile * HEAD_INSET, y: to.y - uy * tile * HEAD_INSET };

  // The barbs sit back along the shaft and out to either side: one step against the direction of
  // travel, one step along the perpendicular. The perpendicular of (ux, uy) is (-uy, ux).
  const back = { x: -ux * tile * BARB_LENGTH, y: -uy * tile * BARB_LENGTH };
  const side = { x: -uy * tile * BARB_SPREAD, y: ux * tile * BARB_SPREAD };

  return {
    behind: 0,
    tail,
    head,
    wings: [
      { x: head.x + back.x + side.x, y: head.y + back.y + side.y },
      { x: head.x + back.x - side.x, y: head.y + back.y - side.y },
    ],
  };
}

/** The same, carrying the distance the caller already knows. */
export function arrowFor(from: Point, to: Point, tile: number, behind: number): Arrow | null {
  const arrow = arrowBetween(from, to, tile);
  return arrow ? { ...arrow, behind } : null;
}
