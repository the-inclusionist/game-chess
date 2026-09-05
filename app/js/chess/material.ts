// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/material — what each side has on the board, counted the way players count it.
//
// ⚠️ This is what survived `engine/evaluate.ts`, which was the heart of a negamax that no longer
// exists. The piece-square tables and the combined evaluation went with the search, because
// Stockfish does that job and does it incomparably better.
//
// The count stayed because it is the one thing the ENGINE CANNOT SAY. An evaluation has already
// made up its mind: it folds material, safety, structure and tempo into a single number, and a
// child reading "-1.2" learns nothing about why. Showing both — "material +3, engine -1.2" —
// teaches the most useful lesson in chess, that the pieces are not the position. So the two
// numbers are deliberately computed by different things and deliberately allowed to disagree.

import type { Rules } from './rules.ts';
import type { PieceType, Side } from './types.ts';

/**
 * Centipawns, on the scale every beginner's book uses: the pawn is 1, the knight and bishop are
 * about 3, the rook 5, the queen 9.
 *
 * ⚠️ NOT the engine's scale. Stockfish has normalised its own centipawn since 15.1, so its
 * `+1.00` is roughly an even chance of winning rather than a pawn of material. Two numbers with
 * the same unit written on them and different meanings behind them — which is precisely why the
 * readout labels them separately instead of pretending they can be added.
 *
 * The king is zero because it is never captured. Counting it would add the same number to both
 * sides in every position that has ever been played.
 */
export const PIECE_VALUE: Readonly<Record<PieceType, number>> = {
  p: 100, n: 300, b: 300, r: 500, q: 900, k: 0,
};

export interface Material {
  /** Centipawns on the board, per side. */
  readonly w: number;
  readonly b: number;
  /** Positive when white is ahead. The number the readout shows, before it is divided by 100. */
  readonly lead: number;
}

/** What is standing on the board right now. Says nothing about who is winning. */
export function material(rules: Rules): Material {
  let w = 0;
  let b = 0;
  for (const { piece } of rules.placements()) {
    const value = PIECE_VALUE[piece.type];
    if (piece.side === 'w') w += value;
    else b += value;
  }
  return { w, b, lead: w - b };
}

/** The lead in pawns, from one side's point of view. Negative when that side is behind. */
export function leadFor(count: Material, side: Side): number {
  return (side === 'w' ? count.lead : -count.lead) / 100;
}
