// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The two corner blocks: how far ahead, how much has been thrown away, and what has been taken.
// The capture tests came here from the HUD suite when the tally moved to the board — a player
// deciding on a move is looking at the board, and a row of glyphs beside the panel is a row of
// glyphs nobody reads.
import { afterEach, describe, expect, it } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import { fromAlgebraic, type Side, type Square } from '../app/js/chess/types.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createPlayerStrips, type PlayerStrips } from '../app/js/ui/player-strip.ts';

const sq = (name: string): Square => {
  const square = fromAlgebraic(name);
  if (!square) throw new Error(`bad square ${name}`);
  return square;
};

let strips: PlayerStrips | null = null;
afterEach(() => { strips = null; document.body.replaceChildren(); });

function build(
  fen?: string,
  opts: { evaluation?: number | null; mistakes?: Record<Side, number> } = {},
) {
  const rules = createRules(fen);
  strips = createPlayerStrips({
    doc: document,
    i18n: createI18n('pt'),
    rules,
    evaluation: () => opts.evaluation ?? null,
    mistakes: (side) => opts.mistakes?.[side] ?? 0,
  });
  document.body.appendChild(strips.root);
  const play = (from: string, to: string): void => {
    rules.move(sq(from), sq(to));
    strips?.refresh();
  };
  return { rules, play, strips };
}

const box = (side: Side): HTMLElement =>
  document.querySelector<HTMLElement>(`.player-strip[data-side="${side}"]`)!;
const taken = (side: Side): string => box(side).querySelector('.player-taken')!.textContent ?? '';

describe('[PlayerStrip] the captures, read off the history and never tallied', () => {
  it('shows nothing at the start', () => {
    build();
    expect(taken('w')).toBe('');
    expect(taken('b')).toBe('');
  });

  it('shows a captured piece against the player who took it', () => {
    // ⚠️ THE ONE THAT READS PERFECTLY WHEN IT IS BACKWARDS. White takes a black pawn, so the
    // glyph belongs beside WHITE. Showing each player their own losses looks entirely plausible
    // and nobody notices for a week.
    const { play } = build();
    play('e2', 'e4');
    play('d7', 'd5');
    play('e4', 'd5');
    expect(taken('w')).toContain('♟');
    expect(taken('b')).toBe('');
  });

  it('sorts the heaviest first, so a queen is not buried behind pawns', () => {
    const { play } = build('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1');
    play('e4', 'd5');
    expect(taken('w').startsWith('♛')).toBe(true);
  });

  it('corrects itself when a move is taken back', () => {
    // Reading the history rather than keeping a running tally is what makes this free: undo
    // needs no path of its own.
    const { rules, play, strips: s } = build();
    play('e2', 'e4');
    play('d7', 'd5');
    play('e4', 'd5');
    expect(taken('w')).toContain('♟');
    rules.undo();
    s.refresh();
    expect(taken('w')).toBe('');
  });
});

describe('[PlayerStrip] the evaluation, in the middle where nobody owns it', () => {
  const evaluation = (): HTMLElement => document.querySelector('.board-eval')!;

  it('is ONE number, not one per player', () => {
    // ⚠️ It was two, one at each end, and that made an evaluation look like a possession — a
    // thing White has and Black has — when it is one fact about one position with a sign on it.
    build(undefined, { evaluation: 150 });
    expect(document.querySelectorAll('.board-eval')).toHaveLength(1);
    expect(evaluation().textContent).toBe('+1.5');
  });

  it('is positive for White and negative for Black, which is the convention everywhere', () => {
    build(undefined, { evaluation: -80 });
    expect(evaluation().textContent).toBe('−0.8');
    expect(evaluation().dataset.lead).toBe('black');
  });

  it('says a dash rather than nought while the engine has no opinion', () => {
    // `0.0` would be an opinion — that the position is level — invented and then quietly
    // replaced a second later by the real one.
    build();
    expect(evaluation().textContent).toBe('—');
    expect(evaluation().dataset.lead).toBe('level');
  });
});

describe('[PlayerStrip] the mistake counter', () => {
  const count = (side: Side): HTMLElement => box(side).querySelector('.player-mistakes')!;

  it('counts each side separately, and starts at nothing', () => {
    build();
    expect(count('w').textContent).toBe('0');
    expect(count('b').textContent).toBe('0');
  });

  it('shows what it is given', () => {
    build(undefined, { mistakes: { w: 3, b: 1 } });
    expect(count('w').textContent).toBe('3');
    expect(count('b').textContent).toBe('1');
  });

  it('bands the level, so the colour is never the only thing that says it', () => {
    build(undefined, { mistakes: { w: 0, b: 6 } });
    expect(count('w').dataset.level).toBe('low');
    expect(count('b').dataset.level).toBe('high');
  });

  it('keeps the counter on the OUTSIDE of the captured row, at both ends', () => {
    // Put it on the inside and a queen taken on move thirty pushes the number across the board.
    const kids = (side: Side): string[] =>
      [...box(side).querySelector('.player-row')!.children].map((el) => el.className);
    build();
    expect(kids('w')).toEqual(['player-mistakes', 'player-taken']);
    expect(kids('b')).toEqual(['player-taken', 'player-mistakes']);
  });
});
