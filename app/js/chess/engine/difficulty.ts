// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/engine/difficulty — how hard the opponent plays, and why it stops where it does.
//
// ========================= THE NUMBERS THESE COME FROM =========================
// Measured on the position after 1.e4 e5 2.Nf3 Nc6 3.Bc4, with alpha-beta:
//
//   depth 1      16 ms        33 nodes
//   depth 2      70 ms       455 nodes
//   depth 3     443 ms     3,416 nodes
//   depth 4   6,018 ms    52,805 nodes
//
// Depth 4 is fourteen times depth 3 and takes SIX SECONDS. That is not a hard opponent, it is a
// game that appears to have frozen — and to a child waiting for a reply, indistinguishable from
// broken. So the ladder stops at 3: measured and rejected, rather than quietly absent.
//
// The same numbers are why the search runs in a Web Worker. Even 443 ms on the main thread would
// stall the frame loop, the camera and the screen reader together.

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_DEPTH: Readonly<Record<Difficulty, number>> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const DEFAULT_DIFFICULTY: Difficulty = 'medium';

export function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}
