// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHAT A BOOK NEEDS FROM THE RULES =========================
// The plan's Stage 3 is a book — Capablanca's `Chess Fundamentals`, English by the author and in
// the public domain since 2013. A book is a game plus NOTES, and the notes are the part that
// matters: a game's moves are facts and can come from anywhere, while a master's commentary on
// them is what the book actually is.
//
// ⚠️ AND IT MUST NOT THROW. `searchPlay` throws on a token it cannot play, and the plan flagged
// that a book "vai precisar de um caminho de SAN que não lance". A book is a file — downloaded,
// transcribed, possibly edited by a teacher — and a file that will not parse is a thing to be told
// about, not an exception thrown through whatever happened to be reading it.
import { describe, expect, it } from 'vitest';
import { createRules, rulesFromPgn } from '../app/js/chess/rules.ts';
import { fromAlgebraic, type Square } from '../app/js/chess/types.ts';

const sq = (name: string): Square => {
  const square = fromAlgebraic(name);
  if (!square) throw new Error(`no such square: ${name}`);
  return square;
};

/** The opening of Capablanca–Marshall, New York 1918, with a note where a book would put one. */
const GAME = `[Event "New York"]
[White "Capablanca"]
[Black "Marshall"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 {The Ruy Lopez, and the move this whole game is remembered for
answering.} 3... a6 4. Ba4 Nf6 5. O-O Be7 *`;

describe('[PGN] a game can be read from text', () => {
  it('plays every move, in order', () => {
    const rules = rulesFromPgn(GAME);
    expect(rules).not.toBeNull();
    expect(rules!.history().map((m) => m.san))
      .toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7']);
  });

  it('⚠️ comes back INDISTINGUISHABLE from a game somebody played', () => {
    /*
     * THE REASON IT IS REBUILT BY REPLAY RATHER THAN WRAPPED. `createRules` owns the redo stack,
     * the played list and the start position, and none of that exists on a `Chess` loaded from
     * text. Going through the front door is what lets the reviewer, the score sheet, the take-back
     * and the declaration all work on a book without knowing it is one.
     */
    const rules = rulesFromPgn(GAME)!;
    expect(rules.canUndo()).toBe(true);
    rules.undo();
    expect(rules.history()).toHaveLength(9);
    expect(rules.canRedo()).toBe(true);
    rules.redo();
    expect(rules.history()).toHaveLength(10);
    // And the position agrees with the same moves played by hand.
    const byHand = createRules();
    for (const [from, to] of [
      ['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f1', 'b5'], ['a7', 'a6'],
      ['b5', 'a4'], ['g8', 'f6'], ['e1', 'g1'], ['f8', 'e7'],
    ] as const) byHand.move(sq(from), sq(to));
    expect(rules.fen()).toBe(byHand.fen());
  });

  it('keeps a position the header names, rather than assuming the opening', () => {
    // A book is mostly DIAGRAMS — a position and a question about it — so the start position is
    // the common case rather than the exception.
    const study = rulesFromPgn('[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=Q+ *');
    expect(study).not.toBeNull();
    expect(study!.startFen()).toContain('7k/P7');
    expect(study!.history()[0]!.promotion).toBe('q');
  });

  it('⚠️ answers null instead of throwing, for anything that is not a game', () => {
    for (const bad of ['', 'not a game', '1. e4 e5 2. Qxq9 ??', '[White "x"]\n\n1. Ke2 *']) {
      expect(`${JSON.stringify(bad)}: ${rulesFromPgn(bad) === null}`)
        .toBe(`${JSON.stringify(bad)}: true`);
    }
  });
});

describe('[PGN] the notes are the part a book is', () => {
  it('finds the comment on the position it was written about', () => {
    /*
     * ⚠️ INDEXED BY PLY, because that is what a comment is attached to: PGN puts a note after the
     * move it is about, which is to say on the position that move produced. Numbering by MOVE
     * would need a rule for whose move, and that rule would be wrong half the time.
     */
    const rules = rulesFromPgn(GAME)!;
    expect(rules.commentAt(5)).toContain('Ruy Lopez');
    expect(rules.commentAt(4)).toBeNull();
    expect(rules.commentAt(6)).toBeNull();
  });

  it('shrugs off a ply nobody has', () => {
    const rules = rulesFromPgn(GAME)!;
    expect(rules.commentAt(-1)).toBeNull();
    expect(rules.commentAt(999)).toBeNull();
  });

  it('⚠️ does not confuse two occurrences of the same position', () => {
    /*
     * THE FAULT THE REPLAY EXISTS TO AVOID. `chess.js` keeps comments against the FEN of the
     * position they sit on, and a FEN REPEATS — knights out and back gives the same position twice.
     * Reading `getComments()` as a flat list and matching by FEN would show the note about the
     * second occasion against the first, which in a book is a paragraph attached to the wrong move.
     */
    const repeat = rulesFromPgn(
      '1. Nf3 Nf6 2. Ng1 {Back where we started, and that is the point.} Ng8 *',
    )!;
    // The note sits after White's third half-move, not on the opening position it matches.
    expect(repeat.commentAt(0)).toBeNull();
    expect(repeat.commentAt(3)).toContain('Back where we started');
  });

  it('writes the game back out, notes and all', () => {
    // What a caller needs to hand a game on: to storage, to a teacher, to the clipboard.
    const rules = rulesFromPgn(GAME)!;
    expect(rules.pgn()).toContain('Ruy Lopez');
    expect(rules.pgn()).toContain('Bb5');
    // And it round-trips: read what was written and get the same moves.
    expect(rulesFromPgn(rules.pgn())!.history()).toHaveLength(10);
  });
});
