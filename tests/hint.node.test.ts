// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHAT "THE SAME LEVEL" HAS TO MEAN =========================
// The hint used to filter on `score === top`, and it showed one move almost every time. These
// tests pin the margin that replaced it, because the number is a JUDGEMENT and a judgement with
// no test around it is a number somebody will quietly change.
import { describe, expect, it } from 'vitest';
import { HINT_LINES, sameLevel, SAME_LEVEL_CP } from '../app/js/chess/engine/same-level.ts';

/** The engine's lines reduced to the only field the decision reads. Best first, as they arrive. */
const lines = (...scores: number[]) => scores.map((score, i) => ({ score, id: i }));

describe('[Hint] the margin', () => {
  it('keeps a move the margin away, and drops the one past it', () => {
    expect(sameLevel(lines(50, 50 - SAME_LEVEL_CP))).toHaveLength(2);
    expect(sameLevel(lines(50, 50 - SAME_LEVEL_CP - 1))).toHaveLength(1);
  });

  it('measures from the best move, not from its neighbour', () => {
    // A chain of small steps is not a wide band: the third is 40 below the best and out, even
    // though it is only 20 below the one before it.
    expect(sameLevel(lines(100, 80, 60))).toHaveLength(2);
  });

  it('narrows itself where there is one answer', () => {
    // A move that wins a rook against one that wins a tempo. The same constant margin that opens
    // three ideas in a quiet position shows exactly one here — because there is one.
    expect(sameLevel(lines(500, 40, 35, 30))).toHaveLength(1);
  });

  it('shows every move inside the margin, not a fixed number of them', () => {
    // ⚠️ There is NO rank cap. A quiet position where six moves are indistinguishable offers
    // six, and a sharp one offers one — which is the honest answer in both cases. The only
    // ceiling is how many lines the engine was asked to keep.
    expect(sameLevel(lines(10, 10, 10, 10, 10, 10))).toHaveLength(6);
    expect(sameLevel(lines(...Array<number>(HINT_LINES + 4).fill(10)))).toHaveLength(HINT_LINES);
  });

  it('always answers when there is something to answer with, and never when there is not', () => {
    expect(sameLevel(lines(-900))).toHaveLength(1);
    expect(sameLevel(lines())).toHaveLength(0);
  });

  it('keeps the order the engine sent, which is the order of preference', () => {
    // ⚠️ Rank 1 must stay first. It is the move the announcement names and the arrow drawn
    // boldest, and a filter that reordered would make the game recommend its own second choice.
    expect(sameLevel(lines(20, 10, 5)).map((line) => line.id)).toEqual([0, 1, 2]);
  });
});
