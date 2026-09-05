// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/engine/same-level — which of the engine's suggestions count as equally good.

/**
 * ==================== "THE SAME LEVEL" IS A MARGIN, NOT AN EQUALITY ====================
 * The hint used to filter on `score === top`, and it showed one move almost every time. Two moves
 * scoring 34 and 33 are not distinguishable by the function that scored them, but they are not
 * `===`, so the second was thrown away. Stockfish's MultiPV lines essentially never carry the same
 * number, so in practice the filter kept exactly one.
 *
 * ⚠️ THIRTY IS NOT A THIRD OF A PAWN, and the coincidence is worth not believing. Stockfish has
 * normalised its centipawn since 15.1: `+1.00` means roughly an even chance of winning from here,
 * not a pawn of material — internally a pawn is about 330 units, rescaled before it reaches the
 * UCI output. So this margin is a small shift in WINNING CHANCE, measured against three things:
 *
 *   1. The evaluation disagrees with itself by more than this between iterations. In a quiet
 *      position the same move is 0.24 at depth 18 and 0.11 at 19. Two moves 0.20 apart are inside
 *      the noise of whatever produced both numbers.
 *   2. Above about 0.30 there is usually something concrete to point at — a pawn structure, a
 *      tempo — and a hint that calls those the same thing is teaching something false.
 *   3. A CONSTANT margin narrows itself where it should. In an opening it opens two or three
 *      ideas. In a position where the best move wins a rook (+5.00) and the next is +0.40 it shows
 *      one — and it shows one because there IS one. A proportional margin would widen exactly
 *      where the answer is least ambiguous.
 */
export const SAME_LEVEL_CP = 30;

/** How many suggestions a hint will ever show. More than three stops being advice and becomes a list. */
export const HINT_LIMIT = 3;

/** Anything with a score. The engine's own line shape, reduced to what this decision needs. */
export interface Scored {
  readonly score: number;
}

/**
 * The entries worth calling equally good, best first. At least one whenever there is one at all.
 *
 * ⚠️ Measured from the BEST, never from the neighbour. A chain of small steps is not a wide band:
 * scores of 100, 80 and 60 are two moves at the same level and a third that is not, even though
 * every step is inside the margin.
 */
export function sameLevel<T extends Scored>(entries: readonly T[], limit = HINT_LIMIT): readonly T[] {
  const top = entries[0]?.score;
  if (top === undefined) return [];
  return entries.filter((entry) => top - entry.score <= SAME_LEVEL_CP).slice(0, limit);
}
