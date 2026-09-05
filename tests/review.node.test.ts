// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The marks the score sheet writes by itself. These tests exist because the rule they pin is one
// that is easy to get plausibly wrong: a rule in centipawns passes every simple test and then
// calls a queen-up player's sloppy rook move a blunder, which is the case that actually matters.
import { describe, expect, it } from 'vitest';
import {
  BLUNDER, INACCURACY, isBlunder, judge, MISTAKE, winChance,
} from '../app/js/chess/review.ts';

const played = (before: number, after: number, extra: Partial<Parameters<typeof judge>[0]> = {}) =>
  judge({ before, after, wasBest: false, gapToSecond: 0, ...extra });

describe('[Review] winning chance, not centipawns', () => {
  it('calls a level position level', () => {
    expect(winChance(0)).toBe(50);
  });

  it('saturates, which is the whole reason it is used', () => {
    // ⚠️ THE CASE A CENTIPAWN RULE GETS WRONG. Overwhelmingly won, and a rook goes: 800
    // centipawns, nearly three times any blunder threshold in material — and the game is exactly
    // as won as it was. A score sheet that shouts here teaches a child to panic over nothing.
    const verdict = played(2000, 1200);
    expect(verdict.lost).toBeLessThan(INACCURACY);
    expect(verdict.mark).toBeNull();

    // ⚠️ And the calibration is doing real work rather than merely damping: +9 down to +4 IS
    // flagged, because it is a measurable loss of winning chance and not only of wood. The rule
    // is not "big leads are exempt" — it is that probability, unlike material, has a ceiling.
    expect(played(900, 400).mark).toBe('?!');
  });

  it('and gets the case that matters right', () => {
    // The same 500 centipawns, given away from a level position: that is the game.
    expect(played(100, -400).mark).toBe('??');
  });

  it('cannot lose what is already lost', () => {
    // Dead lost to slightly more dead lost. There is nothing here to criticise, and criticising
    // it anyway is how a beaten player is told off for being beaten.
    expect(played(-1200, -1800).mark).toBeNull();
  });
});

describe('[Review] the three criticisms', () => {
  it('grades by how much winning chance went', () => {
    // Built backwards from the thresholds so the test pins the RULE and not one example of it.
    const from = 0;
    const at = (drop: number): number => {
      // The centipawns whose win chance is `drop` points below an even game.
      const target = 50 - drop;
      let cp = 0;
      while (winChance(cp) > target) cp -= 1;
      return cp;
    };
    expect(played(from, at(INACCURACY - 1)).mark).toBeNull();
    expect(played(from, at(INACCURACY + 1)).mark).toBe('?!');
    expect(played(from, at(MISTAKE + 1)).mark).toBe('?');
    expect(played(from, at(BLUNDER + 1)).mark).toBe('??');
  });

  it('says which one is worth interrupting a game for', () => {
    expect(isBlunder('??')).toBe(true);
    for (const mark of ['?', '?!', '!', '!!', null] as const) expect(isBlunder(mark)).toBe(false);
  });
});

describe('[Review] the two compliments, which are ours', () => {
  it('rewards a move that had to be found, not one that was merely fine', () => {
    // Best move, and everything else loses the game: that is what `!` is for here.
    expect(played(0, 0, { wasBest: true, gapToSecond: 300 }).mark).toBe('!!');
    expect(played(0, 0, { wasBest: true, gapToSecond: 120 }).mark).toBe('!');
    // Best move, but three others were just as good. Correct, and not an achievement.
    expect(played(0, 0, { wasBest: true, gapToSecond: 15 }).mark).toBeNull();
  });

  it('gives nothing for a move that was not the best one', () => {
    expect(played(0, 0, { wasBest: false, gapToSecond: 900 }).mark).toBeNull();
  });

  it('never praises a move that lost the game, however forced it was', () => {
    // ⚠️ Criticism is checked FIRST. In a position where everything loses, the only move is still
    // the only move — and marking it `!` would be congratulating someone as they resign.
    expect(played(200, -400, { wasBest: true, gapToSecond: 900 }).mark).toBe('??');
  });

  it('scales the compliment to the position, not to the centipawns', () => {
    // The same 120-centipawn gap. In a level game it is the difference between playing on and
    // being lost; in a won one it is the difference between winning and winning.
    expect(played(0, 0, { wasBest: true, gapToSecond: 120 }).mark).toBe('!');
    expect(played(1200, 1200, { wasBest: true, gapToSecond: 120 }).mark).toBeNull();
  });
});
