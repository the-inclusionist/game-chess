// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/engine/evaluate — how good is this position, for this side.
//
// Material plus piece-square tables, which is the smallest evaluation that still plays like
// something rather than like a random legal move. It is deliberately not more: the catalogue asks
// for "xadrez com motor minimax RASO", the opponent exists so a child has someone to play, and
// every extra term is another thing to tune and to be wrong about.
//
// ========================= UNITS AND SIGN =========================
// Centipawns — a pawn is 100 — because that is what every chess text uses, and because integers
// avoid the float comparisons that make an evaluation subtly non-deterministic.
//
// `evaluate(rules, side)` is POSITIVE when the position favours `side`. It is antisymmetric by
// construction, which is asserted: an evaluation that is not costs the search its correctness,
// since negamax assumes exactly that.
//
// The king is worth ZERO. Both are always on the board, so any value cancels — and giving him a
// huge one only invites it to collide with the mate scores below.

import type { Rules } from '../rules.ts';
import type { PieceType, Side } from '../types.ts';

export const PIECE_VALUE: Readonly<Record<PieceType, number>> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

/**
 * Mate, in centipawns. Far above any material total so it always dominates, far below
 * `Number.MAX_SAFE_INTEGER` so the search can subtract ply from it to prefer a faster mate.
 */
export const MATE = 100_000;

// Tables are written from WHITE's point of view, rank 8 first — which is exactly this game's `y`
// order, so a white piece indexes straight in at `y * 8 + x`. Black mirrors vertically.
const PAWN = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const KNIGHT = [
 -50,-40,-30,-30,-30,-30,-40,-50,
 -40,-20,  0,  0,  0,  0,-20,-40,
 -30,  0, 10, 15, 15, 10,  0,-30,
 -30,  5, 15, 20, 20, 15,  5,-30,
 -30,  0, 15, 20, 20, 15,  0,-30,
 -30,  5, 10, 15, 15, 10,  5,-30,
 -40,-20,  0,  5,  5,  0,-20,-40,
 -50,-40,-30,-30,-30,-30,-40,-50,
];

const BISHOP = [
 -20,-10,-10,-10,-10,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5, 10, 10,  5,  0,-10,
 -10,  5,  5, 10, 10,  5,  5,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10, 10, 10, 10, 10, 10, 10,-10,
 -10,  5,  0,  0,  0,  0,  5,-10,
 -20,-10,-10,-10,-10,-10,-10,-20,
];

const ROOK = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
];

const QUEEN = [
 -20,-10,-10, -5, -5,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
   0,  0,  5,  5,  5,  5,  0, -5,
 -10,  5,  5,  5,  5,  5,  0,-10,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -20,-10,-10, -5, -5,-10,-10,-20,
];

// Middlegame king: stay home, stay behind pawns. A shallow search cannot see an endgame coming,
// so there is only one table — another consequence of "raso" being the brief.
const KING = [
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -20,-30,-30,-40,-40,-30,-30,-20,
 -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20,
];

const TABLES: Readonly<Record<PieceType, readonly number[]>> = {
  p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING,
};

/**
 * Centipawns from `side`'s point of view. Positive is better for `side`.
 *
 * Terminal positions are settled first and absolutely: a mate is a mate whatever the material
 * says, and a stalemate is level however lopsided the board looks — which is the one thing that
 * stops the engine from happily walking into one while a queen up.
 */
export function evaluate(rules: Rules, side: Side): number {
  if (rules.isCheckmate()) {
    // The side to move is the one that has been mated.
    return rules.turn() === side ? -MATE : MATE;
  }
  if (rules.isStalemate() || rules.isDraw()) return 0;
  return evaluateMaterial(rules, side);
}

/**
 * The same sum, with NO terminal detection.
 *
 * The search calls this and not `evaluate`, because by the time it reaches a leaf it has already
 * settled mate and stalemate from an empty move list — and `isDraw()` alone measures **38 us**,
 * which across every leaf of the tree is the second largest cost after move generation. Threefold
 * repetition is the expensive part of it, and a shallow search cannot use it anyway.
 */
export function evaluateMaterial(rules: Rules, side: Side): number {
  let score = 0;
  for (const { piece, square } of rules.placements()) {
    const index = piece.side === 'w'
      ? square.y * 8 + square.x
      : (7 - square.y) * 8 + square.x;
    const value = PIECE_VALUE[piece.type] + TABLES[piece.type][index];
    score += piece.side === side ? value : -value;
  }
  return score;
}
