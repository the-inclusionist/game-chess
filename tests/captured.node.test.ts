// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE TALLY A BEGINNER ACTUALLY READS =========================
// The row of captured pieces beside each player is how a child answers "am I winning?" before
// they can read an evaluation, and `chess/material.ts` keeps the 1/3/3/5/9 scale precisely so that
// question has a beginner's answer. `chess/captured.ts` builds that row and had no test.
//
// ⚠️ IT IS DERIVED, NOT KEPT, AND THAT IS THE CLAIM WORTH CHECKING. The list is read out of the
// history every time rather than maintained as a running count — the file argues that a taken-back
// move then corrects itself for free, instead of needing an undo path that drifts silently and is
// noticed a game later. A test that only played moves forwards would never touch the half of that
// sentence that matters.
//
// The two positions where a tally is usually wrong are both here: EN PASSANT, where the pawn taken
// is not on the square the capturing pawn lands on, and a captured PROMOTED piece, which is a queen
// when it is taken and was a pawn when it set out.
import { describe, expect, it } from 'vitest';
import { CAPTURE_GLYPH, CAPTURE_ORDER, capturedFrom, capturedGlyphs } from '../app/js/chess/captured.ts';
import { createRules, type Rules } from '../app/js/chess/rules.ts';
import { fromAlgebraic, type PieceType, type Square } from '../app/js/chess/types.ts';

const at = (name: string): Square => {
  const square = fromAlgebraic(name);
  if (!square) throw new Error(`no such square: ${name}`);
  return square;
};

/** Plays a list of `from-to` moves, failing loudly on the first one the rules refuse. */
function play(rules: Rules, moves: readonly string[], promotion?: PieceType): void {
  for (const move of moves) {
    const [from, to] = move.split('-');
    const played = rules.move(at(from!), at(to!), promotion);
    if (!played) throw new Error(`illegal in this test: ${move}`);
  }
}

describe('[Captured] what each side has lost, heaviest first', () => {
  it('says nothing at all before anything is taken', () => {
    const rules = createRules();
    expect(capturedFrom(rules, 'w')).toEqual([]);
    expect(capturedFrom(rules, 'b')).toEqual([]);
    expect(capturedGlyphs(rules, 'b')).toBe('');
  });

  it('records the piece that was taken, against the side that lost it', () => {
    // 1.e4 d5 2.exd5 — White has taken a black pawn, so it is BLACK's loss.
    const rules = createRules();
    play(rules, ['e2-e4', 'd7-d5', 'e4-d5']);
    expect(capturedFrom(rules, 'b')).toEqual(['p']);
    expect(capturedFrom(rules, 'w')).toEqual([]);
  });

  it('⚠️ sorts heaviest first, in the order the pieces were NOT taken in', () => {
    /*
     * The order is the reason the row is readable at a glance, and the only way to prove a sort
     * happened is to feed it a sequence that is already wrong. The pawn goes first and the rook
     * second; the row must come back rook then pawn.
     */
    expect(CAPTURE_ORDER).toEqual(['q', 'r', 'b', 'n', 'p']);

    // Black rook b8, black pawn b3, white queen d1, kings out of each other's way.
    const rules = createRules('1r2k3/8/8/8/8/1p6/8/K2Q4 w - - 0 1');
    play(rules, ['d1-b3']);       // queen takes the pawn
    play(rules, ['e8-e7']);       // black waits
    play(rules, ['b3-b8']);       // queen takes the rook, up the open file
    expect(capturedFrom(rules, 'b')).toEqual(['r', 'p']);
  });

  it('⚠️ counts the pawn taken EN PASSANT, which is not on the landing square', () => {
    /*
     * The capture every derived tally gets wrong. The white pawn lands on d6 and the pawn it takes
     * was on d5 — so anything reading "what stood where the capture ended" finds an empty square
     * and counts nothing. `MoveResult.captured` carries it because the rules know.
     */
    const rules = createRules('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1');
    play(rules, ['d7-d5']);       // the double step that makes it possible
    play(rules, ['e5-d6']);       // en passant
    const history = rules.history();
    expect(history.at(-1)!.enPassant).toBe(true);
    expect(capturedFrom(rules, 'b')).toEqual(['p']);
  });

  it('⚠️ counts a captured PROMOTED piece as what it was when it was taken', () => {
    /*
     * It set out as a pawn and it is a queen when it dies, and the tally is about material on the
     * board rather than about biography. Counting it as a pawn would understate the loss by eight
     * points at the exact moment a beginner most needs the number to be right.
     */
    // White pawn a7, black rook a1, white king off the rook's rank so the position is legal.
    const rules = createRules('4k3/P7/8/8/8/8/7K/r7 w - - 0 1');
    play(rules, ['a7-a8'], 'q');
    expect(rules.history().at(-1)!.promotion).toBe('q');
    // The new queen gives check along the eighth rank, and taking it is how Black answers.
    play(rules, ['a1-a8']);
    expect(capturedFrom(rules, 'w')).toEqual(['q']);
    expect(capturedGlyphs(rules, 'w')).toBe(CAPTURE_GLYPH.q);
  });

  it('⚠️ a taken-back move corrects the list, which is the whole reason it is derived', () => {
    /*
     * THE HALF A FORWARDS-ONLY TEST NEVER REACHES. A running tally would need an undo path of its
     * own; this one has none because it has nothing to undo — the list is the history, read again.
     */
    const rules = createRules();
    play(rules, ['e2-e4', 'd7-d5', 'e4-d5']);
    expect(capturedFrom(rules, 'b')).toEqual(['p']);

    rules.undo();
    expect(capturedFrom(rules, 'b')).toEqual([]);

    // And it comes back on redo, because the history does.
    expect(rules.redo()).toBe(true);
    expect(capturedFrom(rules, 'b')).toEqual(['p']);
  });
});

describe('[Glyphs] figurines, because the NAME belongs to the screen reader', () => {
  it('renders the row in the same order the list is in', () => {
    const rules = createRules();
    play(rules, ['e2-e4', 'd7-d5', 'e4-d5']);
    expect(capturedGlyphs(rules, 'b')).toBe(CAPTURE_GLYPH.p);
  });

  it('⚠️ has a glyph for every piece type, including the king', () => {
    /*
     * A king is never captured in a legal game, and the map carries one anyway: a lookup that
     * returned `undefined` would put the string "undefined" in a row of chess symbols rather than
     * failing anywhere anybody would notice.
     */
    for (const type of ['p', 'n', 'b', 'r', 'q', 'k'] as const) {
      expect(`${type}: ${typeof CAPTURE_GLYPH[type]}`).toBe(`${type}: string`);
      expect(`${type}: ${CAPTURE_GLYPH[type].length > 0}`).toBe(`${type}: true`);
    }
  });

  it('⚠️ leaves the king out of the ORDER, because it cannot be taken', () => {
    // A king in the sort would be a row that can never happen, and `indexOf` returning -1 for it
    // would quietly sort it in front of the queen if one ever did.
    expect(CAPTURE_ORDER).not.toContain('k');
  });
});
