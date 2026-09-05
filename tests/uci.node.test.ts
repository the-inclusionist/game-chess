// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { limitFor, parseBestMove, parseInfo, parseSpinOption } from '../app/js/chess/engine/uci.ts';
import { toMove } from '../app/js/chess/engine/stockfish-client.ts';
import { STRENGTH_LADDER, rungFor } from '../app/js/chess/engine/strength.ts';

// ========================= WHAT THIS GUARDS =========================
// UCI is lines of text, and nothing in it is a promise. An engine may send whatever `info` fields
// it likes, in any order, and add its own. A parser that requires the shape it has seen is a
// parser that breaks on the next version of the engine — so what is tested here is mostly that
// unknown and missing things are survived rather than that known ones are read.

describe('[UCI] reading what the engine says about itself', () => {
  it('reads the Elo range from the engine rather than assuming it', () => {
    const line = 'option name UCI_Elo type spin default 1320 min 1320 max 3190';
    expect(parseSpinOption(line, 'UCI_Elo')).toEqual({ value: 1320, min: 1320, max: 3190 });
  });

  it('ignores an option it was not asked about', () => {
    expect(parseSpinOption('option name Hash type spin default 16 min 1 max 33554432', 'UCI_Elo'))
      .toBeNull();
  });
});

describe('[UCI] reading a thought', () => {
  it('takes depth, nodes, score and the line', () => {
    const t = parseInfo('info depth 12 seldepth 18 multipv 1 score cp 34 nodes 91000 nps 1 pv e2e4 e7e5 g1f3');
    expect(t).toEqual({ depth: 12, rank: 1, score: 34, nodes: 91000, line: ['e2e4', 'e7e5', 'g1f3'] });
  });

  it('tells a mate from a score, because they are not the same quantity', () => {
    const t = parseInfo('info depth 9 score mate -3 nodes 400 pv h4h7');
    expect(t?.mate).toBe(-3);
    expect(t?.score).toBeUndefined();
  });

  it('survives fields it has never seen, and fields it expected and did not get', () => {
    expect(parseInfo('info depth 4 tbhits 0 hashfull 12 wibble 9 nodes 55')).toEqual({ depth: 4, nodes: 55 });
    expect(parseInfo('info string Using NNUE')).toBeNull();
    expect(parseInfo('bestmove e2e4')).toBeNull();
  });
});

describe('[UCI] the move at the end', () => {
  it('reads a move and a promotion', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4');
    expect(toMove('e7e8q')?.promotion).toBe('q');
  });

  it('understands a position with no move', () => {
    expect(parseBestMove('bestmove (none)')).toBeNull();
  });
});

describe('[Strength] below the engine floor, weakness comes from the search', () => {
  it('uses UCI_Elo at or above the floor', () => {
    expect(limitFor(1600, 1320)).toEqual({ elo: 1600 });
    expect(limitFor(1320, 1320)).toEqual({ elo: 1320 });
  });

  it('limits NODES below it, rather than asking the engine to pretend', () => {
    // ⚠️ `UCI_Elo` stops at the engine's own minimum. An engine given few positions plays badly
    // because it has not seen enough, which is how a beginner plays badly; random blunders between
    // good moves is how nobody plays.
    const weak = limitFor(1000, 1320);
    const less = limitFor(1200, 1320);
    expect(weak.elo).toBeUndefined();
    expect(weak.nodes).toBeGreaterThan(0);
    expect(weak.nodes!).toBeLessThan(less.nodes!);
  });

  it('names every rung, and names 2200 twice because both systems land there', () => {
    expect(STRENGTH_LADDER[0].elo).toBe(1000);
    expect(STRENGTH_LADDER.map((r) => r.elo)).toContain(2200);
    // US Chess National Master and FIDE Candidate Master are both 2200 — a coincidence worth
    // showing rather than picking a side on.
    expect(rungFor(2250).elo).toBe(2200);
    expect(rungFor(999).elo).toBe(1000);
  });
});
