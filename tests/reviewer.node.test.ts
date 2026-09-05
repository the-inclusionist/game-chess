// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The engine watching the game go by. The stub below answers with fixed scores, because what is
// being tested is the BOOKKEEPING — which position is compared with which, whose point of view
// each score is from, and what a take-back does to marks already written. Those are the parts a
// real engine would hide behind plausible-looking output.
import { describe, expect, it, vi } from 'vitest';
import type { EngineClient, EngineMove } from '../app/js/chess/engine/client.ts';
import { createReviewer } from '../app/js/chess/reviewer.ts';
import { createRules } from '../app/js/chess/rules.ts';
import { fromAlgebraic, type Square } from '../app/js/chess/types.ts';

const sq = (name: string): Square => {
  const square = fromAlgebraic(name);
  if (!square) throw new Error(`bad square ${name}`);
  return square;
};

/** Scores by board position, so a test can say exactly what the engine thinks of each. */
function stub(scores: Record<string, number>) {
  const asked: string[] = [];
  const engine: EngineClient = {
    requestMove: () => Promise.resolve(null),
    requestHint: () => Promise.resolve(null),
    requestReview: (fen) => {
      asked.push(fen);
      const score = scores[fen.split(' ')[0]] ?? 0;
      const move = { from: sq('a1'), to: sq('a2'), promotion: null };
      const reply: EngineMove = {
        move, score, nodes: 1, depth: 1, ties: [],
        // Two lines five centipawns apart, so nothing earns a compliment by accident.
        lines: [{ move, score }, { move, score: score - 5 }],
      };
      return Promise.resolve(reply);
    },
    cancel: () => {},
    destroy: () => {},
  };
  return { engine, asked };
}

/**
 * Lets every queued review settle. A real task rather than a microtask turn: the reviewer chains
 * each search onto the last with `.finally()`, so counting microtasks would be counting an
 * implementation detail and would break the moment one more `then` was added.
 */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => { setTimeout(resolve, 0); });
};

const OPENING = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR';
const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR';

describe('[Reviewer] whose point of view', () => {
  it('negates the evaluation after a move, because the side to move changed', async () => {
    // ⚠️ THE BUG THIS EXISTS TO PREVENT. Both scores are +200 for whoever is on move — which
    // means White went from +200 to -200, thirty-five points of winning chance. Forget the
    // negation and the two numbers are identical, the drop is zero, and every move in every game
    // is judged perfectly average for ever.
    const rules = createRules();
    const { engine } = stub({ [OPENING]: 200, [AFTER_E4]: 200 });
    const reviewer = createReviewer({ rules, engine });

    reviewer.observe();
    rules.move(sq('e2'), sq('e4'));
    reviewer.observe();
    await settle();

    expect(reviewer.markAt(0)).toBe('??');
  });

  it('reports the evaluation from White, whoever is to move', async () => {
    const rules = createRules();
    // Black is on move after 1.e4, and +150 for Black is -150 for White.
    const { engine } = stub({ [OPENING]: 0, [AFTER_E4]: 150 });
    const reviewer = createReviewer({ rules, engine });
    rules.move(sq('e2'), sq('e4'));
    reviewer.observe();
    await settle();

    expect(reviewer.evaluation()).toBe(-150);
  });
});

describe('[Reviewer] the bookkeeping', () => {
  it('searches each position once, however often it is told to look', async () => {
    const rules = createRules();
    const { engine, asked } = stub({});
    const reviewer = createReviewer({ rules, engine });

    reviewer.observe();
    reviewer.observe();
    rules.move(sq('e2'), sq('e4'));
    reviewer.observe();
    reviewer.observe();
    await settle();

    expect(new Set(asked).size).toBe(asked.length);
    expect(asked).toHaveLength(2);
  });

  it('counts the blunders of one side, and only that side', async () => {
    const rules = createRules();
    // White throws the game away and Black then holds. Scores are per side to move, so a large
    // positive for the side about to move means the side that just moved is in trouble.
    const { engine } = stub({ [OPENING]: 0, [AFTER_E4]: 600, [AFTER_E5]: -600 });
    const reviewer = createReviewer({ rules, engine });

    reviewer.observe();
    rules.move(sq('e2'), sq('e4'));
    reviewer.observe();
    rules.move(sq('e7'), sq('e5'));
    reviewer.observe();
    await settle();

    expect(reviewer.markAt(0)).toBe('??');
    expect(reviewer.blunders('w')).toBe(1);
    expect(reviewer.blunders('b')).toBe(0);
  });

  it('forgets a mark when the move it belonged to is taken back', async () => {
    // ⚠️ A take-back can be followed by a DIFFERENT move. A mark left behind would end up beside
    // the move that replaced it — the score sheet accusing a player of somebody else's blunder.
    const rules = createRules();
    const { engine } = stub({ [OPENING]: 0, [AFTER_E4]: 600 });
    const reviewer = createReviewer({ rules, engine });

    reviewer.observe();
    rules.move(sq('e2'), sq('e4'));
    reviewer.observe();
    await settle();
    expect(reviewer.markAt(0)).toBe('??');

    rules.undo();
    reviewer.observe();
    expect(reviewer.markAt(0)).toBeNull();
    expect(reviewer.blunders('w')).toBe(0);
  });

  it('says nothing at all until it has both halves', async () => {
    const rules = createRules();
    const { engine } = stub({});
    const reviewer = createReviewer({ rules, engine });
    rules.move(sq('e2'), sq('e4'));
    reviewer.observe();

    // Nothing has settled: no mark, no evaluation, and above all no wrong ones.
    expect(reviewer.markAt(0)).toBeNull();
    expect(reviewer.evaluation()).toBeNull();
  });

  it('stops asking once it is destroyed', async () => {
    const rules = createRules();
    const { engine, asked } = stub({});
    const reviewer = createReviewer({ rules, engine });
    reviewer.destroy();
    reviewer.observe();
    await settle();
    expect(asked).toHaveLength(0);
  });

  it('tells whoever is listening, once per move', async () => {
    const rules = createRules();
    const onVerdict = vi.fn();
    const { engine } = stub({ [OPENING]: 0, [AFTER_E4]: 600 });
    const reviewer = createReviewer({ rules, engine, onVerdict });

    reviewer.observe();
    rules.move(sq('e2'), sq('e4'));
    reviewer.observe();
    await settle();

    expect(onVerdict).toHaveBeenCalledTimes(1);
    expect(onVerdict)
      .toHaveBeenCalledWith(expect.objectContaining({ ply: 0, side: 'w', mark: '??' }));
  });
});

describe('[Reviewer] a game that was already going', () => {
  it('numbers its plies from where it started, not from move one', async () => {
    // ⚠️ THE BUG THIS EXISTS TO PREVENT. A game is restored from the score sheet on every reload
    // and on every switch between the 2D and 2.5D views, so the reviewer routinely starts four
    // moves in. Numbering positions from zero put the mark for the move just played beside the
    // FIRST move of the game: a score sheet that opened `1. e4??` and blamed the player for it.
    const rules = createRules();
    rules.move(sq('e2'), sq('e4'));
    rules.move(sq('e7'), sq('e5'));

    const afterNf3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R';
    const { engine } = stub({ [AFTER_E5]: 0, [afterNf3]: 600 });
    const reviewer = createReviewer({ rules, engine });

    reviewer.observe();
    rules.move(sq('g1'), sq('f3'));
    reviewer.observe();
    await settle();

    expect(reviewer.markAt(2)).toBe('??');
    // Nothing is ever said about the moves played before anybody was watching.
    expect(reviewer.markAt(0)).toBeNull();
    expect(reviewer.markAt(1)).toBeNull();
  });

  it('counts a ply it will never see as already judged', async () => {
    // Otherwise protected mode waits for ever for a verdict on a move played before it existed.
    const rules = createRules();
    rules.move(sq('e2'), sq('e4'));
    const { engine } = stub({});
    const reviewer = createReviewer({ rules, engine });
    expect(reviewer.judged(0)).toBe(true);
    expect(reviewer.judged(1)).toBe(false);
  });
});
