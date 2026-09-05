// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import { createGameState } from '../app/js/chess/state.ts';
import { fromAlgebraic, toAlgebraic, type Square } from '../app/js/chess/types.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createGridMirror, type GridMirror } from '../app/js/ui/grid-mirror.ts';

const sq = (name: string): Square => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

let mirror: GridMirror | null = null;
afterEach(() => { mirror?.destroy(); mirror = null; document.body.replaceChildren(); });

function build(fen?: string, locale: 'pt' | 'en' | 'es' = 'pt') {
  const rules = createRules(fen);
  const state = createGameState({ rules, opponent: false });
  const onActivate = vi.fn((square: Square) => {
    state.activate(square);
    mirror?.refresh();
  });
  mirror = createGridMirror({
    doc: document, i18n: createI18n(locale), rules, state, onActivate,
  });
  document.body.appendChild(mirror.root);
  return { rules, state, onActivate, mirror };
}

const cellAt = (name: string): HTMLButtonElement => {
  const el = document.querySelector<HTMLButtonElement>(`[data-square="${name}"]`);
  if (!el) throw new Error(`no cell ${name}`);
  return el;
};

const labelOf = (name: string): string => cellAt(name).getAttribute('aria-label') ?? '';

describe('[Structure] a real grid, of real buttons', () => {
  it('lays out 64 cells in 8 rows', () => {
    build();
    expect(document.querySelectorAll('[role="gridcell"]')).toHaveLength(64);
    expect(document.querySelectorAll('[role="row"]')).toHaveLength(8);
  });

  it('reads top-left to bottom-right, the way a diagram is printed', () => {
    build();
    const order = [...document.querySelectorAll<HTMLElement>('[role="gridcell"]')]
      .map((c) => c.dataset.square);
    expect(order[0]).toBe('a8');
    expect(order[7]).toBe('h8');
    expect(order[63]).toBe('h1');
  });

  it('keeps the cells as real buttons, so the platform supplies Enter and Space', () => {
    build();
    expect(cellAt('e2').tagName).toBe('BUTTON');
    expect(cellAt('e2').type).toBe('button');
  });

  it('announces itself, with how to use it', () => {
    const { mirror: m } = build();
    const label = m.root.getAttribute('aria-label') ?? '';
    expect(label).toContain('Tabuleiro de xadrez');
    expect(label).toContain('Setas');
  });
});

describe('[Labels] every square says where it is and what is on it', () => {
  it('names the piece standing there', () => {
    build();
    expect(labelOf('a1')).toBe('a1, torre branca');
    expect(labelOf('b8')).toBe('b8, cavalo preto');
  });

  it('says an empty square is empty', () => {
    build();
    expect(labelOf('d4')).toBe('d4, vazia');
  });

  it('follows the interface language', () => {
    build(undefined, 'en');
    expect(labelOf('a1')).toBe('a1, white rook');
    expect(labelOf('d4')).toBe('d4, empty');
  });

  it('re-labels after a move', () => {
    const { onActivate } = build();
    onActivate(sq('e2'));
    onActivate(sq('e4'));
    expect(labelOf('e2')).toBe('e2, vazia');
    expect(labelOf('e4')).toBe('e4, peão branco');
  });

  it('marks a legal destination WITHOUT inflecting on the piece', () => {
    const { onActivate } = build();
    onActivate(sq('e2'));
    expect(labelOf('e4')).toContain('lance possível');
    expect(labelOf('e3')).toContain('lance possível');
    expect(labelOf('d4')).not.toContain('lance possível');
  });

  it('tells a capture apart from a quiet move', () => {
    // White knight e4 can take the black pawn on d6 or step to a quiet square.
    const { onActivate } = build('4k3/8/3p4/8/4N3/8/8/4K3 w - - 0 1');
    onActivate(sq('e4'));
    expect(labelOf('d6')).toContain('captura possível');
    expect(labelOf('f6')).toContain('lance possível');
  });

  it('says which king is in check', () => {
    // White rook h7, black king h8, black to move.
    build('7k/7R/8/8/8/8/8/4K3 b - - 0 1');
    expect(labelOf('h8')).toContain('em xeque');
    expect(labelOf('a8')).not.toContain('em xeque');
  });
});

describe('[Selection] state travels as ARIA, not as a word', () => {
  it('marks the held square with aria-selected', () => {
    const { onActivate } = build();
    expect(cellAt('e2').getAttribute('aria-selected')).toBe('false');
    onActivate(sq('e2'));
    expect(cellAt('e2').getAttribute('aria-selected')).toBe('true');
    // The reader says "selected" in the user's own language; the label stays about the board.
    expect(labelOf('e2')).toBe('e2, peão branco');
  });

  it('clears when the piece is put down', () => {
    const { onActivate } = build();
    onActivate(sq('e2'));
    onActivate(sq('e2'));
    expect(cellAt('e2').getAttribute('aria-selected')).toBe('false');
  });
});

describe('[Roving tabindex] one stop, not sixty-four', () => {
  it('puts exactly one cell in the tab order', () => {
    build();
    const focusable = [...document.querySelectorAll<HTMLElement>('[role="gridcell"]')]
      .filter((c) => c.tabIndex === 0);
    expect(focusable).toHaveLength(1);
  });

  it('moves that single stop as the cursor moves', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('c3'));
    expect(cellAt('c3').tabIndex).toBe(0);
    expect(cellAt('e2').tabIndex).toBe(-1);
    expect([...document.querySelectorAll<HTMLElement>('[role="gridcell"]')]
      .filter((c) => c.tabIndex === 0)).toHaveLength(1);
  });

  it('survives a refresh', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('h5'));
    m.refresh();
    expect(cellAt('h5').tabIndex).toBe(0);
  });
});

describe('[Keyboard] the arrows walk the board', () => {
  const press = (key: string, init: KeyboardEventInit = {}) => {
    cellAt(toAlgebraic(mirror!.cursor()))
      .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  };

  it('moves one square at a time, in board terms', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('d4'));
    press('ArrowRight');
    expect(toAlgebraic(m.cursor())).toBe('e4');
    press('ArrowUp');
    expect(toAlgebraic(m.cursor())).toBe('e5');
    press('ArrowLeft');
    expect(toAlgebraic(m.cursor())).toBe('d5');
    press('ArrowDown');
    expect(toAlgebraic(m.cursor())).toBe('d4');
  });

  it('stops at the edge instead of wrapping to the far file', () => {
    // A board has corners. Being teleported across it is disorienting for exactly the person
    // this grid exists for.
    const { mirror: m } = build();
    m.focusSquare(sq('a1'));
    press('ArrowLeft');
    press('ArrowDown');
    expect(toAlgebraic(m.cursor())).toBe('a1');

    m.focusSquare(sq('h8'));
    press('ArrowRight');
    press('ArrowUp');
    expect(toAlgebraic(m.cursor())).toBe('h8');
  });

  it('Home and End jump along the rank', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('d4'));
    press('End');
    expect(toAlgebraic(m.cursor())).toBe('h4');
    press('Home');
    expect(toAlgebraic(m.cursor())).toBe('a4');
  });

  it('Ctrl+Home and Ctrl+End jump to the corners', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('d4'));
    press('Home', { ctrlKey: true });
    expect(toAlgebraic(m.cursor())).toBe('a8');
    press('End', { ctrlKey: true });
    expect(toAlgebraic(m.cursor())).toBe('h1');
  });

  it('actually moves DOM focus, not just a variable', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('d4'));
    expect(document.activeElement).toBe(cellAt('d4'));
    press('ArrowRight');
    expect(document.activeElement).toBe(cellAt('e4'));
  });
});

describe('[Activation] the keyboard uses the same door as the pointer', () => {
  it('a click on a cell activates that square', () => {
    const { onActivate } = build();
    cellAt('g1').click();
    expect(onActivate).toHaveBeenCalledWith(sq('g1'));
  });

  it('Enter on a focused cell activates it, because it is a real button', () => {
    const { onActivate, mirror: m } = build();
    m.focusSquare(sq('b1'));
    // A real <button> turns Enter into a click at the platform level. Simulating the click is
    // simulating what the platform does; the point of the test is that nothing here re-implements it.
    (document.activeElement as HTMLButtonElement).click();
    expect(onActivate).toHaveBeenCalledWith(sq('b1'));
  });

  it('plays a whole move through the grid alone', () => {
    const { onActivate, rules } = build();
    cellAt('e2').click();
    cellAt('e4').click();
    expect(onActivate).toHaveBeenCalledTimes(2);
    expect(rules.history().map((m) => m.san)).toEqual(['e4']);
  });

  it('reports the cursor to whoever draws it', () => {
    const rules = createRules();
    const state = createGameState({ rules, opponent: false });
    const onCursor = vi.fn();
    mirror = createGridMirror({
      doc: document, i18n: createI18n('pt'), rules, state, onActivate: () => {}, onCursor,
    });
    document.body.appendChild(mirror.root);
    mirror.focusSquare(sq('f6'));
    expect(onCursor).toHaveBeenCalledWith(sq('f6'));
  });
});
