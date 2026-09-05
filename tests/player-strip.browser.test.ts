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
import { createPlayerStrips, RISK_FULL, type PlayerStrips } from '../app/js/ui/player-strip.ts';

const sq = (name: string): Square => {
  const square = fromAlgebraic(name);
  if (!square) throw new Error(`bad square ${name}`);
  return square;
};

let strips: PlayerStrips | null = null;
afterEach(() => { strips = null; document.body.replaceChildren(); });

function build(fen?: string, opts: { evaluation?: number | null; risk?: Record<Side, number> } = {}) {
  const rules = createRules(fen);
  strips = createPlayerStrips({
    doc: document,
    i18n: createI18n('pt'),
    rules,
    evaluation: () => opts.evaluation ?? null,
    risk: (side) => opts.risk?.[side] ?? 0,
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

describe('[PlayerStrip] the score', () => {
  it('shows the material lead from each side, and level as neither', () => {
    build();
    for (const side of ['w', 'b'] as const) {
      expect(box(side).querySelector<HTMLElement>('.player-score b')?.dataset.lead).toBe('level');
    }
  });

  it('reads the same board in opposite directions', () => {
    const { play } = build();
    play('e2', 'e4');
    play('d7', 'd5');
    play('e4', 'd5');
    expect(box('w').querySelector<HTMLElement>('b')?.dataset.lead).toBe('ahead');
    expect(box('b').querySelector<HTMLElement>('b')?.dataset.lead).toBe('behind');
  });

  it('says a dash rather than nought while the engine has no opinion', () => {
    // ⚠️ `0.0` would be an opinion — that the position is level — invented and then quietly
    // replaced a second later by the real one.
    build();
    expect(box('w').querySelector('.player-engine')?.textContent).toBe('—');
  });

  it('turns the engine round for the black player', () => {
    build(undefined, { evaluation: 150 });
    expect(box('w').querySelector('.player-engine')?.textContent).toBe('+1.5');
    expect(box('b').querySelector('.player-engine')?.textContent).toBe('−1.5');
  });
});

describe('[PlayerStrip] the risk bar', () => {
  const bar = (side: Side): HTMLElement => box(side).querySelector('.player-risk-bar')!;
  const fill = (side: Side): HTMLElement => box(side).querySelector('.player-risk-fill')!;

  it('says its value in numbers as well as in width', () => {
    // 1.4.1: a bar whose only content is its own length says nothing to a screen reader and
    // nothing at all on a projector with the contrast wound down.
    build(undefined, { risk: { w: 21, b: 0 } });
    expect(bar('w').getAttribute('aria-valuenow')).toBe('21');
    expect(box('w').querySelector('.player-risk-value')?.textContent).toBe('21');
    expect(bar('w').getAttribute('aria-valuemax')).toBe(String(RISK_FULL));
  });

  it('grows with what was thrown away, and stops at full', () => {
    build(undefined, { risk: { w: RISK_FULL / 2, b: RISK_FULL * 4 } });
    expect(fill('w').style.width).toBe('50%');
    // ⚠️ Clamped. A player can give away far more than one game's worth, and a bar 400% wide
    // would escape its own container and paint over the board.
    expect(fill('b').style.width).toBe('100%');
  });

  it('bands the level, so the colour is never the only thing that says it', () => {
    build(undefined, { risk: { w: 0, b: RISK_FULL } });
    expect(fill('w').dataset.level).toBe('low');
    expect(fill('b').dataset.level).toBe('high');
  });
});
