// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE SENTENCES NOBODY HAD EVER TESTED =========================
// `moveSentence` was written out three times, once per composition root, and no test in the
// repository named it. It is the function that turns a move into the words a blind player hears —
// "a torre branca de a1 captura o peão preto em a7" — and it had exactly the coverage that its
// being duplicated predicts: none, three times over.
//
// This file is a node test and nothing here touches a live region: `moveSentence` returns a string
// and `announceOutcome` takes an `Outcome`, not a `GameState`. That was the point of taking the
// outcome rather than the game — three plain objects instead of a state machine.
import { describe, expect, it } from 'vitest';
import { moveSentence } from '../app/js/boot/narration.ts';
import { createRules } from '../app/js/chess/rules.ts';
import { createI18n, availableLocales } from '../app/js/i18n/index.ts';
import { fromAlgebraic, type Square } from '../app/js/chess/types.ts';

const sq = (name: string): Square => {
  const square = fromAlgebraic(name);
  if (!square) throw new Error(`no such square: ${name}`);
  return square;
};

/** Plays a list of moves and returns the last one, so a fixture reads as a game and not as setup. */
function after(moves: readonly [string, string][]) {
  const rules = createRules();
  let last = null;
  for (const [from, to] of moves) last = rules.move(sq(from), sq(to));
  if (!last) throw new Error('a fixture played an illegal move');
  return last;
}

describe('[Narration] a move is a sentence, not notation', () => {
  it('names the piece, where it came from and where it went', () => {
    const i18n = createI18n('pt');
    const said = moveSentence(i18n, after([['e2', 'e4']]));
    expect(said).toContain('e2');
    expect(said).toContain('e4');
    // The piece by name — this is what SAN cannot do and what a beginner needs.
    expect(said).toContain('peão');
  });

  it('names what was taken as well as what took it', () => {
    const i18n = createI18n('pt');
    const said = moveSentence(i18n, after([['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5']]));
    expect(said).toContain('peão');
    expect(said).toContain('d5');
    // A capture reads differently from a move, or the most consequential thing on the board
    // sounds exactly like the least.
    expect(said).not.toBe(moveSentence(i18n, after([['e2', 'e4']])));
  });

  it('says CASTLE rather than describing the king walking two squares', () => {
    /*
     * ⚠️ THIS IS WHY THE CASTLE CASES COME FIRST. A castle is one move that shifts two pieces, and
     * "king from e1 to g1" describes half of it — the rook, which is the part a beginner is asking
     * about, would go unmentioned entirely.
     */
    const i18n = createI18n('pt');
    const short = moveSentence(i18n, after([
      ['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f1', 'c4'], ['f8', 'c5'],
      ['e1', 'g1'],
    ]));
    expect(short).toBe(i18n.t('move.castleShort'));
    expect(short).not.toContain('e1');
    expect(short).not.toContain('g1');
  });

  it('says which piece a pawn became, not which square it stopped on', () => {
    const rules = createRules('7k/P7/8/8/8/8/8/7K w - - 0 1');
    const move = rules.move(sq('a7'), sq('a8'), 'q');
    if (!move) throw new Error('the promotion fixture is not legal');
    const i18n = createI18n('pt');
    const said = moveSentence(i18n, move);
    expect(said).toContain('a8');
    expect(said).toContain('dama');
  });

  it('speaks all three languages, and never leaves a slot unfilled', () => {
    // ⚠️ An unfilled slot is the failure this catches: `t()` leaves `{piece}` literal rather than
    // printing `undefined`, so a missing parameter is silent everywhere except here.
    const move = after([['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5']]);
    for (const locale of availableLocales()) {
      const said = moveSentence(createI18n(locale), move);
      expect(`${locale} ${said.length > 0}`).toBe(`${locale} true`);
      expect(`${locale} ${/\{[a-z]+\}/.test(said)}`).toBe(`${locale} false`);
    }
  });

  it('is the SAME sentence in every view, which is the whole reason it moved here', () => {
    // The solid board used to announce `status.played` — the raw SAN, which a screen reader
    // pronounces roughly as "en ex dee four". Three roots, three behaviours, one name.
    const move = after([['e2', 'e4']]);
    const pt = createI18n('pt');
    expect(moveSentence(pt, move)).toBe(moveSentence(pt, move));
    expect(moveSentence(pt, move)).not.toBe(move.san);
  });
});
