// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import { evaluate, evaluateMaterial, MATE, PIECE_VALUE } from '../app/js/chess/engine/evaluate.ts';
import { search, searchWithoutPruning } from '../app/js/chess/engine/search.ts';
import { toAlgebraic } from '../app/js/chess/types.ts';

const sanOf = (fen: string, depth: number): string | null => {
  const rules = createRules(fen);
  const best = search(rules, depth);
  if (!best) return null;
  return `${toAlgebraic(best.move.from)}${toAlgebraic(best.move.to)}`;
};

describe('[Evaluate] material and place', () => {
  it('calls the opening position level', () => {
    expect(evaluate(createRules(), 'w')).toBe(0);
    expect(evaluate(createRules(), 'b')).toBe(0);
  });

  it('is antisymmetric: what is good for one side is bad for the other', () => {
    const fens = [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      '4k3/8/8/8/8/8/8/Q3K3 w - - 0 1',
      'r3k3/8/8/8/4N3/8/8/4K3 w - - 0 1',
    ];
    for (const fen of fens) {
      const rules = createRules(fen);
      // Stated as a SUM rather than as `a === -b`: Object.is(0, -0) is false, and a level
      // position is exactly where that bites. The sum says the same thing without the trap.
      expect(evaluate(rules, 'w') + evaluate(rules, 'b'), fen).toBe(0);
      expect(evaluateMaterial(rules, 'w') + evaluateMaterial(rules, 'b'), fen).toBe(0);
    }
  });

  it('counts a spare queen at about her value', () => {
    const rules = createRules('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1');
    expect(evaluate(rules, 'w')).toBeGreaterThan(PIECE_VALUE.q * 0.8);
    expect(evaluate(rules, 'w')).toBeLessThan(PIECE_VALUE.q * 1.2);
  });

  it('prefers a knight in the middle to a knight in the corner', () => {
    // `evaluateMaterial`, not `evaluate`: king and knight against king is INSUFFICIENT MATERIAL,
    // so `evaluate` rightly calls both positions a dead draw and returns 0 for either. Placement
    // is a question about the sum, and the sum is what evaluateMaterial answers.
    const middle = evaluateMaterial(createRules('4k3/8/8/8/4N3/8/8/4K3 w - - 0 1'), 'w');
    const corner = evaluateMaterial(createRules('4k3/8/8/8/8/8/8/N3K3 w - - 0 1'), 'w');
    expect(middle).toBeGreaterThan(corner);
  });

  it('calls king and knight against king a draw, table or no table', () => {
    // Worth pinning, because it is the behaviour that made the test above ask the wrong thing.
    expect(evaluate(createRules('4k3/8/8/8/4N3/8/8/4K3 w - - 0 1'), 'w')).toBe(0);
    expect(evaluateMaterial(createRules('4k3/8/8/8/4N3/8/8/4K3 w - - 0 1'), 'w')).toBeGreaterThan(0);
  });

  it('prefers an advanced pawn to a pawn at home', () => {
    const advanced = evaluate(createRules('4k3/8/P7/8/8/8/8/4K3 w - - 0 1'), 'w');
    const home = evaluate(createRules('4k3/8/8/8/8/8/P7/4K3 w - - 0 1'), 'w');
    expect(advanced).toBeGreaterThan(home);
  });

  it('scores a mated side at minus MATE, and the mating side at plus', () => {
    // Black is mated: Qh4# after 1.f3 e5 2.g4.
    const rules = createRules();
    for (const [from, to] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']] as const) {
      rules.move({ x: from.charCodeAt(0) - 97, y: 8 - Number(from[1]) },
                 { x: to.charCodeAt(0) - 97, y: 8 - Number(to[1]) });
    }
    expect(rules.isCheckmate()).toBe(true);
    expect(evaluate(rules, 'w')).toBeLessThanOrEqual(-MATE + 100);
    expect(evaluate(rules, 'b')).toBeGreaterThanOrEqual(MATE - 100);
  });

  it('scores a stalemate level, however lopsided the material', () => {
    const rules = createRules('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(evaluate(rules, 'w')).toBe(0);
    expect(evaluate(rules, 'b')).toBe(0);
  });
});

describe('[Search] it finds the move a beginner would be shown', () => {
  it('plays mate in one', () => {
    // Back rank: black king g8 walled in by its own pawns, white rook swings to a8.
    expect(sanOf('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 2)).toBe('a1a8');
  });

  it('takes a free queen', () => {
    // Black queen on d5 is en prise to the pawn on e4 and defended by nothing.
    const best = sanOf('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1', 2);
    expect(best).toBe('e4d5');
  });

  it('does not stalemate when it can mate instead', () => {
    // White Kg6, Qd1, black Kh8. The king already covers g7 and h7, so Qd5 covers g8 WITHOUT
    // giving check — a textbook stalemate — while Qd8 is mate. A material-only engine sees both
    // as "still a queen up"; only scoring stalemate as level tells them apart.
    const rules = createRules('7k/8/6K1/8/8/8/8/3Q4 w - - 0 1');
    const best = search(rules, 3);
    expect(best).not.toBeNull();
    rules.move(best!.move.from, best!.move.to, best!.move.promotion ?? undefined);
    expect(rules.isStalemate(), 'the engine walked into stalemate').toBe(false);
  });

  it('returns null when there is nothing to play', () => {
    expect(search(createRules('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), 3)).toBeNull();
  });

  it('always returns a legal move', () => {
    const rules = createRules();
    const best = search(rules, 2);
    expect(best).not.toBeNull();
    const legal = rules.allMoves()
      .some((m) => m.from.x === best!.move.from.x && m.from.y === best!.move.from.y
                && m.to.x === best!.move.to.x && m.to.y === best!.move.to.y);
    expect(legal).toBe(true);
  });

  it('leaves the position exactly as it found it', () => {
    const rules = createRules();
    const before = rules.fen();
    search(rules, 3);
    expect(rules.fen()).toBe(before);
  });
});

describe('[Alpha-beta] pruning changes the work, never the answer', () => {
  // The classic equivalence check. Alpha-beta is only sound if it returns the SAME score as a
  // full minimax at the same depth; a mistake in the window makes it quietly play worse moves,
  // with no crash and no failing assertion anywhere else.
  // Depth 2 on the crowded positions and depth 3 on the sparse ones. The property does not need
  // depth to hold, and an UNPRUNED depth-3 middlegame is ~27,000 nodes — the very cost that
  // pruning exists to avoid, and not a cost worth paying on every test run.
  const cases: [string, number][] = [
    ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 2],
    ['4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1', 3],
    ['r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', 2],
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 3],
  ];

  it.each(cases)('agrees with plain minimax — %s at depth %i', (fen, depth) => {
    const pruned = search(createRules(fen), depth);
    const full = searchWithoutPruning(createRules(fen), depth);
    expect(pruned?.score).toBe(full?.score);
  });

  it('visits strictly fewer nodes than the full search', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1';
    const pruned = search(createRules(fen), 2);
    const full = searchWithoutPruning(createRules(fen), 2);
    expect(pruned!.nodes).toBeLessThan(full!.nodes);
  });
});

describe('[Determinism] the same position gives the same move', () => {
  it('repeats itself', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1';
    const a = search(createRules(fen), 3);
    const b = search(createRules(fen), 3);
    expect(a).toEqual(b);
  });
});

describe('[Depth] a deeper search is at least as good, and costs more', () => {
  it('reports the depth it reached', () => {
    expect(search(createRules(), 2)?.depth).toBe(2);
  });

  it('visits more nodes the deeper it goes', () => {
    const shallow = search(createRules(), 2)!.nodes;
    const deep = search(createRules(), 3)!.nodes;
    expect(deep).toBeGreaterThan(shallow);
  });

  it('refuses a depth below one rather than guessing', () => {
    expect(search(createRules(), 0)).toBeNull();
  });
});
