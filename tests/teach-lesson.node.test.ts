// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= A LESSON IS DATA, SO IT IS CHECKABLE =========================
// `piece-geometry.node.test.ts` proves a piece fits its square without drawing one. This is the
// same bargain a level up: a goal is a conjunction of equalities over `MoveResult`, so "does this
// move satisfy this step" is a claim about data and holds in the node project with no board, no
// panel, no renderer and no browser.
//
// The moves here are played through the real `chess/rules.ts` rather than hand-built, because a
// hand-built `MoveResult` would let a fixture assert a flag chess.js would never set — and the
// three special rules this model exists to teach are exactly the three that live in those flags.
import { describe, expect, it } from 'vitest';
import {
  asSquareSet, isSquareName, matchesShape, type MoveShape,
} from '../app/js/teach/lesson.ts';
import { createRules, type MoveResult } from '../app/js/chess/rules.ts';
import { fromAlgebraic, type PieceType, type Square } from '../app/js/chess/types.ts';

const sq = (name: string): Square => {
  const square = fromAlgebraic(name);
  if (!square) throw new Error(`no such square: ${name}`);
  return square;
};

/** Plays a list of moves from a position and returns the last one. Reads as a game, not as setup. */
function play(moves: readonly string[], fen?: string): MoveResult {
  const rules = createRules(fen);
  let last: MoveResult | null = null;
  for (const move of moves) {
    last = rules.move(sq(move.slice(0, 2)), sq(move.slice(2, 4)), move[4] as PieceType | undefined);
    if (!last) throw new Error(`the fixture played an illegal move: ${move}`);
  }
  if (!last) throw new Error('the fixture played nothing');
  return last;
}

describe('[Shape] a goal is a conjunction, not a script', () => {
  it('asks about the fields it names and no others', () => {
    const e4 = play(['e2e4']);
    expect(matchesShape({ from: 'e2', to: 'e4' }, e4)).toBe(true);
    expect(matchesShape({ piece: 'p' }, e4)).toBe(true);
    // An empty shape is "any move at all" — which is what a first step asking a child to touch
    // something, anything, actually wants.
    expect(matchesShape({}, e4)).toBe(true);
    // And every named field has to hold, not just one of them.
    expect(matchesShape({ from: 'e2', to: 'e5' }, e4)).toBe(false);
    expect(matchesShape({ piece: 'n' }, e4)).toBe(false);
  });

  it('recognises a castle by its FLAG, never by parsing "O-O"', () => {
    /*
     * ⚠️ THIS IS THE MODEL'S WHOLE ARGUMENT. `MoveResult.castle` already exists, because the rules
     * layer already had to know. A lesson that matched on the string would be re-deriving a fact
     * the position had already established, in a place with less information.
     */
    const short = play(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1g1']);
    expect(matchesShape({ castle: 'king' }, short)).toBe(true);
    expect(matchesShape({ castle: 'queen' }, short)).toBe(false);

    const long = play([
      'd2d4', 'd7d5', 'b1c3', 'b8c6', 'c1f4', 'c8f5', 'd1d2', 'd8d7', 'e1c1',
    ]);
    expect(matchesShape({ castle: 'queen' }, long)).toBe(true);
    expect(matchesShape({ castle: 'king' }, long)).toBe(false);
  });

  it('recognises en passant by its flag, and an ordinary capture does not satisfy it', () => {
    const ep = play(['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']);
    expect(ep.enPassant).toBe(true);
    expect(matchesShape({ enPassant: true }, ep)).toBe(true);
    // ⚠️ The taken pawn is on d5 and the mover lands on d6 — which is why a lesson cannot express
    // "capture en passant" as a pair of squares and have it mean anything.
    expect(matchesShape({ captures: 'p' }, ep)).toBe(true);

    const ordinary = play(['e2e4', 'd7d5', 'e4d5']);
    expect(ordinary.enPassant).toBe(false);
    expect(matchesShape({ enPassant: true }, ordinary)).toBe(false);
  });

  it('recognises a promotion, and which piece it became', () => {
    const queen = play(['a7a8q'], '7k/P7/8/8/8/8/8/7K w - - 0 1');
    expect(matchesShape({ promotion: true }, queen)).toBe(true);
    expect(matchesShape({ promotion: 'q' }, queen)).toBe(true);
    // A lesson that says "underpromote to a knight" is a real lesson, and it must not be satisfied
    // by the queen a child reaches for first.
    expect(matchesShape({ promotion: 'n' }, queen)).toBe(false);

    const knight = play(['a7a8n'], '7k/P7/8/8/8/8/8/7K w - - 0 1');
    expect(matchesShape({ promotion: 'n' }, knight)).toBe(true);
  });

  it('tells a capture from a move, and names what was taken', () => {
    const took = play(['e2e4', 'd7d5', 'e4d5']);
    expect(matchesShape({ captures: true }, took)).toBe(true);
    expect(matchesShape({ captures: 'p' }, took)).toBe(true);
    expect(matchesShape({ captures: 'q' }, took)).toBe(false);

    const quiet = play(['e2e4']);
    expect(matchesShape({ captures: true }, quiet)).toBe(false);
  });

  it('never mistakes an absent flag for a satisfied one', () => {
    /*
     * ⚠️ THE FAULT THIS CATCHES IS A TRUTHINESS BUG. `castle` is `null` on an ordinary move and
     * `promotion` is `null`; `enPassant` is `false`. A comparison written as "the shape asked and
     * the move has something" would pass every one of these — and a lesson on castling would be
     * completed by pushing a pawn.
     */
    const plain = play(['e2e4']);
    for (const shape of [
      { castle: 'king' }, { castle: 'queen' }, { enPassant: true },
      { promotion: true }, { promotion: 'q' }, { captures: true },
    ] as MoveShape[]) {
      expect(`${JSON.stringify(shape)} ${matchesShape(shape, plain)}`)
        .toBe(`${JSON.stringify(shape)} false`);
    }
  });

  it('takes `san` as the escape hatch it is', () => {
    const move = play(['g1f3']);
    expect(matchesShape({ san: 'Nf3' }, move)).toBe(true);
    expect(matchesShape({ san: 'Nc3' }, move)).toBe(false);
    // And it composes with the rest, so a book move can still be constrained by piece or square.
    expect(matchesShape({ san: 'Nf3', piece: 'n' }, move)).toBe(true);
    expect(matchesShape({ san: 'Nf3', piece: 'b' }, move)).toBe(false);
  });
});

describe('[Marks] a set of squares, in any order', () => {
  it('does not care which square the student touched first', () => {
    // "Find every square this bishop attacks" has no order. A child who starts from the far corner
    // is not wrong, and comparing arrays directly would fail the child rather than the answer.
    expect(asSquareSet(['c6', 'b7', 'a8'])).toBe(asSquareSet(['a8', 'c6', 'b7']));
  });

  it('counts a square touched twice once', () => {
    expect(asSquareSet(['e4', 'e4', 'd5'])).toBe(asSquareSet(['d5', 'e4']));
  });

  it('still tells a different set apart', () => {
    expect(asSquareSet(['e4', 'd5'])).not.toBe(asSquareSet(['e4', 'd4']));
    expect(asSquareSet(['e4'])).not.toBe(asSquareSet(['e4', 'd5']));
  });

  it('knows a real square from a typo', () => {
    for (const good of ['a1', 'h8', 'e4', 'd5']) {
      expect(`${good} ${isSquareName(good)}`).toBe(`${good} true`);
    }
    for (const bad of ['i1', 'a9', 'a0', '', 'e', '44', 'E4 ']) {
      expect(`${bad} ${isSquareName(bad)}`).toBe(`${bad} false`);
    }
  });
});

describe('[Positions] a lesson board still has to be a chess board', () => {
  it('⚠️ refuses a FEN with no kings, which is why every lesson position has two', () => {
    /*
     * Verified against chess.js rather than assumed: `new Chess('8/8/…/8 w - - 0 1')` throws
     * "Invalid FEN: missing white king". So a notation lesson — which is about nothing but square
     * names and wants an empty board — cannot have one, and puts a king in each far corner instead.
     * This is the constraint that would otherwise be rediscovered painfully, one lesson at a time.
     */
    expect(() => createRules('8/8/8/8/8/8/8/8 w - - 0 1')).toThrow();
    expect(() => createRules('k7/8/8/8/8/8/8/7K w - - 0 1')).not.toThrow();
  });

  it('lets a lone piece move on an otherwise empty board', () => {
    // The shape of every "how this piece moves" lesson: two kings out of the way, one piece to
    // learn, and every square it reaches available to be marked.
    const rules = createRules('k7/8/8/3B4/8/8/8/7K w - - 0 1');
    const targets = rules.legalTargets(sq('d5')).map((s) => `${'abcdefgh'[s.x]}${8 - s.y}`);
    expect(targets).toContain('c6');
    expect(targets).toContain('b7');
    expect(targets).toContain('e4');
    // Diagonals only. This is the whole content of the lesson, and it is asserted rather than
    // described.
    expect(targets).not.toContain('d4');
    expect(targets).not.toContain('e5');
  });

  it('⚠️ counts TWELVE, not thirteen, because a king is standing on the long diagonal', () => {
    /*
     * A bishop on d5 reaches thirteen squares on a truly empty board. It reaches twelve here, and
     * the missing one is h1 — where the white king had to be parked, because chess.js refuses a
     * board without one.
     *
     * ⚠️ SO WHERE THE KINGS GO CHANGES WHAT THE TAUGHT PIECE CAN DO. That is not a curiosity: a
     * `mark` step listing thirteen squares for this position would be unanswerable, and the child
     * would be the one to discover it. The table test is what has to catch that, which is why the
     * expected set of a `mark` step is compared against `legalTargets` rather than trusted.
     */
    const rules = createRules('k7/8/8/3B4/8/8/8/7K w - - 0 1');
    const targets = rules.legalTargets(sq('d5')).map((s) => `${'abcdefgh'[s.x]}${8 - s.y}`);
    expect(targets).toHaveLength(12);
    expect(targets).not.toContain('h1');

    // Move the kings off that diagonal and the thirteenth square comes back.
    const clear = createRules('7k/8/8/3B4/8/8/8/K7 w - - 0 1');
    expect(clear.legalTargets(sq('d5'))).toHaveLength(13);
  });
});
