// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/review — the mark the score sheet puts beside a move, and how it is earned.
//
// ========================= WHY NOT CENTIPAWNS =========================
// The obvious rule is "lost more than three pawns, call it a blunder", and it is wrong in the two
// places it matters most. A player winning by a queen who drops a rook has given away 500
// centipawns and still wins trivially — marking that `??` teaches a child to panic over nothing.
// A player in a dead-lost position cannot lose anything, so every move they play is flawless.
//
// The fix is the one Lichess uses: convert the evaluation into a WIN PROBABILITY first, and
// measure the drop in that. It self-corrects at both ends, because probability saturates where
// centipawns do not — +9 to +7 is a drop of nearly nothing, and +0.2 to -0.6 is a real one.
//
//   win% = 50 + 50 · (2 / (1 + e^(−0.00368208 · cp)) − 1)
//
// The constant is Lichess's, fitted to millions of their own games. It is used here rather than
// invented because a fitted constant is evidence and a guessed one is decoration.
//
// ========================= ⚠️ ! AND !! ARE OURS, AND SAY SO =========================
// Lichess assigns `?!`, `?` and `??` automatically and deliberately does NOT assign `!` or `!!` —
// there is no agreed way to tell a brilliant move from a merely correct one, and annotators
// disagree with each other constantly. This game assigns them anyway, because a score sheet that
// can only ever criticise is a bad teacher, and it defines them narrowly enough to defend:
//
//   `!`  the move was the engine's first choice AND every other move was clearly worse — a move
//        that had to be FOUND, not merely a move that was fine.
//   `!!` the same, with a gap wide enough that almost nothing else held the position at all.
//
// That is "only move, and you found it". It is not the tournament meaning of `!!`, which involves
// beauty and surprise and is not a thing a search can measure. Anywhere the difference matters,
// what this file computes is the honest thing to cite: the gap to the second-best move.

/** What can appear beside a move on the score sheet. `null` is an ordinary move, which is most. */
export type Mark = '!!' | '!' | '?!' | '?' | '??' | null;

/**
 * Percentage points of winning chance. Lichess's own thresholds for the three criticisms, kept
 * because they are calibrated against real games rather than chosen for roundness.
 */
export const INACCURACY = 10;
export const MISTAKE = 20;
export const BLUNDER = 30;

/** And ours for the two compliments — see the note above on why these are ours to defend. */
export const ONLY_MOVE = 10;
export const ONLY_MOVE_BY_FAR = 25;

/** Centipawns, from one side's point of view, into that side's chance of winning. 0 to 100. */
export function winChance(centipawns: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * centipawns)) - 1);
}

export interface Played {
  /**
   * What the position was worth to the mover BEFORE the move, in centipawns.
   *
   * ⚠️ From the MOVER's point of view, both of these. UCI reports from the side to move, and the
   * side to move changes across a move — so exactly one of the two engine scores has to be
   * negated before it gets here. Getting that wrong does not throw; it produces a score sheet
   * that calls every good move a blunder, which is the kind of bug that looks like a bad opinion.
   */
  readonly before: number;
  /** And after. Same point of view. */
  readonly after: number;
  /** Whether the move played was the engine's first choice in the position before it. */
  readonly wasBest: boolean;
  /**
   * How much better the best move was than the second best, in centipawns, in the position
   * before. Zero when the engine offered only one line, which means no compliment can be earned.
   */
  readonly gapToSecond: number;
}

export interface Verdict {
  readonly mark: Mark;
  /** Winning chance given away, in percentage points. Never negative. */
  readonly lost: number;
}

/**
 * What to write beside a move.
 *
 * Criticism is checked first and wins: a move can be the only move the engine considered and
 * still be terrible, in a position where everything is.
 */
export function judge(played: Played): Verdict {
  const lost = Math.max(0, winChance(played.before) - winChance(played.after));

  if (lost >= BLUNDER) return { mark: '??', lost };
  if (lost >= MISTAKE) return { mark: '?', lost };
  if (lost >= INACCURACY) return { mark: '?!', lost };

  if (played.wasBest) {
    // The gap is measured in winning chance too, and measured AT the position — a 100-centipawn
    // gap is enormous in a level game and nothing at all in a won one, which is exactly the
    // distinction a compliment should be sensitive to.
    const alternative = winChance(played.before - played.gapToSecond);
    const margin = winChance(played.before) - alternative;
    if (margin >= ONLY_MOVE_BY_FAR) return { mark: '!!', lost };
    if (margin >= ONLY_MOVE) return { mark: '!', lost };
  }

  return { mark: null, lost };
}

/** Whether a mark is one the player should be warned about rather than merely shown. */
export function isBlunder(mark: Mark): boolean {
  return mark === '??';
}
