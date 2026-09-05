// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHAT "THE SAME LEVEL" HAS TO MEAN =========================
// The hint used to filter on `score === top`, and it showed one move almost every time. These
// tests pin the margin that replaced it, because the number is a JUDGEMENT and a judgement with
// no test around it is a number somebody will quietly change.
import { describe, expect, it } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import { bestMoves, rankMoves, SAME_LEVEL_CP, type RankedResult } from '../app/js/chess/engine/search.ts';
import { fromAlgebraic, toAlgebraic, type Square } from '../app/js/chess/types.ts';

const sq = (name: string): Square => {
  const square = fromAlgebraic(name);
  if (!square) throw new Error(`bad square ${name}`);
  return square;
};

/** A ranked result built by hand, so the margin is tested and not the search that feeds it. */
const ranked = (...scores: number[]): RankedResult => ({
  moves: scores.map((score, i) => ({
    move: { from: sq('a1'), to: sq(`a${(i % 7) + 2}`), promotion: null },
    score,
  })),
  depth: 3,
  nodes: 0,
});

describe('[Hint] the margin', () => {
  it('keeps a move the margin away, and drops the one past it', () => {
    const inside = bestMoves(ranked(50, 50 - SAME_LEVEL_CP));
    expect(inside).toHaveLength(2);

    const outside = bestMoves(ranked(50, 50 - SAME_LEVEL_CP - 1));
    expect(outside).toHaveLength(1);
  });

  it('measures from the best move, not from its neighbour', () => {
    // A chain of small steps is not a wide band: the third is 40 below the best and out, even
    // though it is only 20 below the one before it.
    expect(bestMoves(ranked(100, 80, 60))).toHaveLength(2);
  });

  it('narrows itself where there is one answer', () => {
    // A move that wins a rook against one that wins a tempo. The same constant margin that
    // opened three ideas in a quiet position shows exactly one here — because there is one.
    expect(bestMoves(ranked(500, 40, 35, 30))).toHaveLength(1);
  });

  it('never shows more than three, however flat the position', () => {
    expect(bestMoves(ranked(10, 10, 10, 10, 10, 10))).toHaveLength(3);
  });

  it('always answers when there is a legal move, and never when there is none', () => {
    expect(bestMoves(ranked(-900))).toHaveLength(1);
    expect(bestMoves(ranked())).toHaveLength(0);
  });
});

describe('[Hint] against the real search', () => {
  it('offers more than one idea in the opening', () => {
    // ⚠️ The defect this whole change is about: at depth 2 the opening is a position with
    // several reasonable first moves, and the old exact-match filter reported a single one.
    const result = rankMoves(createRules(), 2);
    expect(result).not.toBeNull();
    const moves = bestMoves(result!);
    expect(moves.length).toBeGreaterThan(1);
  });

  it('points at one move when only one move is legal', () => {
    // Black is in check from the queen and can only take it.
    const result = rankMoves(createRules('7k/8/8/8/8/8/5PPP/6qK w - - 0 1'), 2);
    const moves = bestMoves(result!);
    expect(moves).toHaveLength(1);
    expect(toAlgebraic(moves[0].move.from) + toAlgebraic(moves[0].move.to)).toBe('h1g1');
  });

  it('carries both halves of every move it returns', () => {
    // The mark is only as good as the data: a hint with no `from` is the bug that started this.
    for (const entry of bestMoves(rankMoves(createRules(), 2)!)) {
      expect(entry.move.from).not.toBe(entry.move.to);
    }
  });
});
