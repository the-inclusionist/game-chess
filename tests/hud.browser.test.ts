// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Difficulty } from '../app/js/chess/engine/difficulty.ts';
import { createRules } from '../app/js/chess/rules.ts';
import { createGameState } from '../app/js/chess/state.ts';
import { fromAlgebraic, type Square } from '../app/js/chess/types.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createHud, type Hud } from '../app/js/ui/hud.ts';

const sq = (name: string): Square => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

let hud: Hud | null = null;
afterEach(() => { hud?.destroy(); hud = null; document.body.replaceChildren(); });

function build(locale: 'pt' | 'en' | 'es' = 'pt', fen?: string) {
  const rules = createRules(fen);
  const state = createGameState({ rules, opponent: false });
  let difficulty: Difficulty = 'medium';
  const onDifficulty = vi.fn((level: Difficulty) => { difficulty = level; });
  hud = createHud({
    doc: document, i18n: createI18n(locale), rules, state,
    difficulty: () => difficulty, onDifficulty,
  });
  document.body.appendChild(hud.root);
  const play = (from: string, to: string) => {
    state.activate(sq(from));
    state.activate(sq(to));
    state.animationDone();
    hud!.refresh();
  };
  return { rules, state, hud, onDifficulty, play, getDifficulty: () => difficulty };
}

const text = (selector: string): string =>
  document.querySelector(selector)?.textContent?.trim() ?? '';

describe('[Turn] whose move it is, said in words', () => {
  it('starts with white', () => {
    build();
    expect(text('.hud-turn')).toContain('Brancas');
  });

  it('changes hands after a move', () => {
    const { play } = build();
    play('e2', 'e4');
    expect(text('.hud-turn')).toContain('Pretas');
  });

  it('keeps the colour block out of the accessible name', () => {
    // Colour alone must never be the signal (WCAG 1.4.1). The swatch is decoration and says so
    // itself; the word beside it is what carries the meaning.
    build();
    expect(document.querySelector('.hud-swatch')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.hud-turn')?.getAttribute('aria-label')).toContain('Vez');
  });
});

describe('[Captured] read off the history, never tallied', () => {
  it('shows nothing at the start', () => {
    build();
    const rows = document.querySelectorAll('.hud-captured');
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.textContent).toBe('—');
  });

  it('shows a captured piece', () => {
    const { play } = build();
    play('e2', 'e4');
    play('d7', 'd5');
    play('e4', 'd5');
    expect(text('.hud-captured')).toContain('♟');
  });

  it('sorts the heaviest first, so a queen is not buried behind pawns', () => {
    const { play } = build('pt', '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1');
    play('e4', 'd5');
    expect(text('.hud-captured').startsWith('♛')).toBe(true);
  });

  it('corrects itself when a move is taken back', () => {
    // Reading the history rather than keeping a running tally is what makes this free: undo
    // needs no path of its own.
    const { rules, play, hud: h } = build();
    play('e2', 'e4');
    play('d7', 'd5');
    play('e4', 'd5');
    expect(text('.hud-captured')).toContain('♟');
    rules.undo();
    h.refresh();
    expect(text('.hud-captured')).toBe('—');
  });
});

describe('[Moves] a scoresheet, one line per pair', () => {
  it('is empty before anything is played', () => {
    build();
    expect(document.querySelectorAll('.hud-moves li')).toHaveLength(0);
  });

  it('pairs white and black on one line', () => {
    const { play } = build();
    play('e2', 'e4');
    play('e7', 'e5');
    expect([...document.querySelectorAll('.hud-moves li')].map((li) => li.textContent))
      .toEqual(['e4 e5']);
  });

  it('leaves a half-finished pair alone', () => {
    const { play } = build();
    play('e2', 'e4');
    play('e7', 'e5');
    play('g1', 'f3');
    expect([...document.querySelectorAll('.hud-moves li')].map((li) => li.textContent))
      .toEqual(['e4 e5', 'Nf3']);
  });

  it('is an ordered list, so the numbering belongs to the platform', () => {
    build();
    expect(document.querySelector('.hud-moves')?.tagName).toBe('OL');
  });

  it('is NOT a live region — every move is already spoken once', () => {
    // A live move list would announce each move a second time, which is worse than not having one.
    build();
    expect(document.querySelector('.hud-moves')?.getAttribute('aria-live')).toBeNull();
  });
});

describe('[Difficulty] a real control, with a real label', () => {
  it('offers the three levels', () => {
    build();
    expect([...document.querySelectorAll('select option')].map((o) => o.textContent))
      .toEqual(['Fácil', 'Médio', 'Difícil']);
  });

  it('is labelled, and the label points at it', () => {
    build();
    const select = document.querySelector('select')!;
    expect(document.querySelector('label')!.htmlFor).toBe(select.id);
    expect(document.querySelector('label')!.textContent).toBe('Dificuldade');
  });

  it('shows the level in force', () => {
    build();
    expect(document.querySelector('select')!.value).toBe('medium');
  });

  it('reports a change', () => {
    const { onDifficulty, getDifficulty } = build();
    const select = document.querySelector('select')!;
    select.value = 'hard';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onDifficulty).toHaveBeenCalledWith('hard');
    expect(getDifficulty()).toBe('hard');
  });
});

describe('[i18n] the panel follows the interface language', () => {
  it('speaks English', () => {
    build('en');
    expect(text('.hud-turn')).toContain('White');
    expect(document.querySelector('label')?.textContent).toBe('Difficulty');
    expect([...document.querySelectorAll('select option')].map((o) => o.textContent))
      .toEqual(['Easy', 'Medium', 'Hard']);
  });

  it('speaks Spanish', () => {
    build('es');
    expect(text('.hud-turn')).toContain('Blancas');
    expect(document.querySelector('label')?.textContent).toBe('Dificultad');
  });
});
