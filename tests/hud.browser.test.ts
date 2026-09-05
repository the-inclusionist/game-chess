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
  let highContrast = false;
  const onDifficulty = vi.fn((level: Difficulty) => { difficulty = level; });
  const onHighContrast = vi.fn((on: boolean) => { highContrast = on; });
  let vision = 'normal';
  const onVision = vi.fn((key: string) => { vision = key; });
  let motion = false;
  const onReducedMotion = vi.fn((on: boolean) => { motion = on; });
  let outline = true;
  const onOutline = vi.fn((on: boolean) => { outline = on; });
  hud = createHud({
    doc: document, i18n: createI18n(locale), rules, state,
    difficulty: () => difficulty, onDifficulty,
    highContrast: () => highContrast, onHighContrast,
    vision: () => vision, onVision,
    reducedMotion: () => motion, onReducedMotion,
    outline: () => outline, onOutline,
  });
  document.body.appendChild(hud.root);
  const play = (from: string, to: string) => {
    state.activate(sq(from));
    state.activate(sq(to));
    state.animationDone();
    hud!.refresh();
  };
  return { rules, state, hud, onDifficulty, onHighContrast, onVision, play,
           getDifficulty: () => difficulty, getContrast: () => highContrast,
           getVision: () => vision, onReducedMotion, getMotion: () => motion,
           onOutline, getOutline: () => outline };
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
    expect([...document.querySelectorAll('#hud-difficulty option')].map((o) => o.textContent))
      .toEqual(['Fácil', 'Médio', 'Difícil']);
  });

  it('is labelled, and the label points at it', () => {
    build();
    const select = document.querySelector<HTMLSelectElement>('#hud-difficulty')!;
    const label = document.querySelector<HTMLLabelElement>('label[for="hud-difficulty"]')!;
    expect(label.htmlFor).toBe(select.id);
    expect(label.textContent).toBe('Dificuldade');
  });

  it('shows the level in force', () => {
    build();
    expect(document.querySelector<HTMLSelectElement>('#hud-difficulty')!.value).toBe('medium');
  });

  it('reports a change', () => {
    const { onDifficulty, getDifficulty } = build();
    const select = document.querySelector<HTMLSelectElement>('#hud-difficulty')!;
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
    expect(document.querySelector('label[for="hud-difficulty"]')?.textContent).toBe('Difficulty');
    expect([...document.querySelectorAll('#hud-difficulty option')].map((o) => o.textContent))
      .toEqual(['Easy', 'Medium', 'Hard']);
  });

  it('speaks Spanish', () => {
    build('es');
    expect(text('.hud-turn')).toContain('Blancas');
    expect(document.querySelector('label[for="hud-difficulty"]')?.textContent).toBe('Dificultad');
  });
});

describe('[High contrast] a switch the system may have already thrown', () => {
  it('offers a labelled checkbox', () => {
    build();
    const box = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const label = document.querySelector<HTMLLabelElement>('label[for="hud-contrast"]')!;
    expect(label.textContent).toBe('Alto contraste');
    expect(label.htmlFor).toBe(box.id);
  });

  it('starts off, and reports being switched on', () => {
    const { onHighContrast, getContrast } = build();
    const box = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(box.checked).toBe(false);
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onHighContrast).toHaveBeenCalledWith(true);
    expect(getContrast()).toBe(true);
  });

  it('follows the interface language', () => {
    build('en');
    expect(document.querySelector('label[for="hud-contrast"]')?.textContent).toBe('High contrast');
  });
});

describe('[Colour vision] the corrections, and only the corrections', () => {
  it('offers normal plus the three corrections, named by the ENGINE', () => {
    build();
    const options = [...document.querySelectorAll('#hud-vision option')];
    expect(options.map((o) => (o as HTMLOptionElement).value))
      .toEqual(['normal', 'fix-protan', 'fix-deuter', 'fix-tritan']);
    expect(options[0].textContent).toBe('Cores normais');
    expect(options[1].textContent).toBe('Correção protanopia');
  });

  it('offers no SIMULATION of a deficiency', () => {
    // The engine's list also holds simulations, which show a sighted adult what a deficiency
    // looks like. Beside a child's own correction, that control would invite switching a
    // disability ON in the one place they came to switch it off. Teaching tools live in the
    // engine's empathy menu, not here.
    build();
    const values = [...document.querySelectorAll('#hud-vision option')]
      .map((o) => (o as HTMLOptionElement).value);
    expect(values.some((v) => v.startsWith('sim-'))).toBe(false);
    expect(values.some((v) => v.startsWith('lv-') || v === 'blind')).toBe(false);
  });

  it('is labelled, and the label points at it', () => {
    build();
    const select = document.querySelector<HTMLSelectElement>('#hud-vision')!;
    const label = document.querySelector<HTMLLabelElement>('label[for="hud-vision"]')!;
    expect(label.textContent).toBe('Visão de cores');
    expect(label.htmlFor).toBe(select.id);
  });

  it('reports a change', () => {
    const { onVision, getVision } = build();
    const select = document.querySelector<HTMLSelectElement>('#hud-vision')!;
    select.value = 'fix-deuter';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onVision).toHaveBeenCalledWith('fix-deuter');
    expect(getVision()).toBe('fix-deuter');
  });
});

describe('[Reduced motion] one switch, because one thing moves', () => {
  it('offers a labelled checkbox', () => {
    build();
    const label = document.querySelector<HTMLLabelElement>('label[for="hud-motion"]')!;
    expect(label.textContent).toBe('Movimento reduzido');
    expect(label.htmlFor).toBe('hud-motion');
  });

  it('reports a change', () => {
    const { onReducedMotion, getMotion } = build();
    const box = document.querySelector<HTMLInputElement>('#hud-motion')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onReducedMotion).toHaveBeenCalledWith(true);
    expect(getMotion()).toBe(true);
  });
});

describe('[Outline] on by default, and switchable', () => {
  it('starts on, because it is what gives a piece form in high contrast', () => {
    build();
    expect(document.querySelector<HTMLInputElement>('#hud-outline')!.checked).toBe(true);
  });

  it('is labelled, and the label points at it', () => {
    build();
    const label = document.querySelector<HTMLLabelElement>('label[for="hud-outline"]')!;
    expect(label.textContent).toBe('Contorno das peças');
  });

  it('reports being switched off', () => {
    const { onOutline, getOutline } = build();
    const box = document.querySelector<HTMLInputElement>('#hud-outline')!;
    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onOutline).toHaveBeenCalledWith(false);
    expect(getOutline()).toBe(false);
  });
});
