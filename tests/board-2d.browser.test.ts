// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import { createGameState } from '../app/js/chess/state.ts';
import { type Square } from '../app/js/chess/types.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createGridMirror, type GridMirror } from '../app/js/ui/grid-mirror.ts';
import { AVAILABLE_SETS, DEFAULT_SET, PIECE_SETS, pieceSet } from '../app/js/ui/piece-sets.ts';
import { BOARD_THEMES, DEFAULT_THEME, boardTheme } from '../app/js/ui/board-themes.ts';

// ========================= WHAT THE 2D BOARD IS =========================
// The grid mirror with its `sr-only` taken off. That is not a shortcut — it is the point. This
// grid was already 64 real buttons in a real grid with roving tabindex, `aria-selected`, arrows
// clamped at the edges, and one funnel to `onActivate` shared with the pointer. A second board
// built for the flat view would have meant building all of that again and keeping two correct.
//
// So what these tests guard is the seam: everything a screen reader had must survive being made
// visible, and everything drawn must stay out of the accessibility tree.

let mirror: GridMirror | null = null;
afterEach(() => { mirror?.destroy(); mirror = null; document.body.replaceChildren(); });

function build(visible = true, fen?: string) {
  const rules = createRules(fen);
  const state = createGameState({ rules, opponent: false });
  const onActivate = vi.fn((square: Square) => { state.activate(square); mirror?.refresh(); });
  mirror = createGridMirror({
    doc: document, i18n: createI18n('pt'), rules, state, visible, onActivate,
  });
  document.body.appendChild(mirror.root);
  return { rules, state, mirror: mirror!, onActivate };
}

const cells = (): HTMLButtonElement[] =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="gridcell"]')];
const cellAt = (name: string): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`[data-square="${name}"]`)!;

describe('[Board2D] the same grid, now visible', () => {
  it('drops sr-only and takes the board class', () => {
    const { mirror: m } = build(true);
    expect(m.root.className).toBe('board-2d');
    expect(cells()).toHaveLength(64);
  });

  it('stays hidden and glyph-free when it is only a mirror', () => {
    build(false);
    expect(document.querySelector('.board-2d')).toBeNull();
    expect(document.querySelectorAll('.cell-piece')).toHaveLength(0);
    expect(document.querySelectorAll('.cell-coord')).toHaveLength(0);
  });

  it('draws 32 pieces and leaves the middle empty', () => {
    build();
    const filled = [...document.querySelectorAll('.cell-piece')].filter((g) => g.textContent);
    expect(filled).toHaveLength(32);
    expect(cellAt('e4').querySelector('.cell-piece')!.textContent).toBe('');
  });

  it('shades a1 dark, which is the rule the 3D board proves too', () => {
    build();
    expect(cellAt('a1').dataset.shade).toBe('dark');
    expect(cellAt('h1').dataset.shade).toBe('light');
    expect(cellAt('a8').dataset.shade).toBe('light');
  });

  it('marks the corners with sixteen coordinates, hidden from the reader', () => {
    build();
    const marks = [...document.querySelectorAll('.cell-coord')];
    expect(marks).toHaveLength(16);
    for (const mark of marks) expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(cellAt('a1').querySelector('[data-kind="file"]')!.textContent).toBe('a');
    expect(cellAt('a1').querySelector('[data-kind="rank"]')!.textContent).toBe('1');
    expect(cellAt('a8').querySelector('[data-kind="rank"]')!.textContent).toBe('8');
  });
});

describe('[Board2D] nothing drawn reaches the screen reader', () => {
  it('hides every glyph, because the label already says what stands there', () => {
    build();
    for (const glyph of document.querySelectorAll('.cell-piece')) {
      expect(glyph.getAttribute('aria-hidden')).toBe('true');
    }
    // And the label is still the sentence, in Portuguese, with the piece's gender attached.
    expect(cellAt('e2').getAttribute('aria-label')).toContain('peão branco');
  });

  it('keeps the roving tabindex: one stop for the whole board', () => {
    build();
    expect(cells().filter((c) => c.tabIndex === 0)).toHaveLength(1);
  });
});

describe('[Board2D] a legal move is a SHAPE and a word, never a colour alone', () => {
  it('marks destinations when a piece is picked up', () => {
    const { onActivate } = build();
    cellAt('e2').click();
    expect(onActivate).toHaveBeenCalled();

    expect(cellAt('e2').getAttribute('aria-selected')).toBe('true');
    expect(cellAt('e3').dataset.mark).toBe('move');
    expect(cellAt('e4').dataset.mark).toBe('move');
    expect(cellAt('e5').dataset.mark).toBeUndefined();
    // The same fact in words, which is WCAG 1.4.1 satisfied rather than approximated.
    expect(cellAt('e3').getAttribute('aria-label')).toContain('lance possível');
  });

  it('tells a capture from a move — a ring, not a dot', () => {
    // Black knight on d5, white pawn on e4: exd5 is a capture and e5 is a move.
    build(true, 'rnbqkbnr/ppp1pppp/8/3n4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1');
    cellAt('e4').click();
    expect(cellAt('d5').dataset.mark).toBe('capture');
    expect(cellAt('e5').dataset.mark).toBe('move');
    expect(cellAt('d5').getAttribute('aria-label')).toContain('captura possível');
  });

  it('clears the marks when the piece is put down', () => {
    build();
    cellAt('e2').click();
    expect(cellAt('e4').dataset.mark).toBe('move');
    cellAt('e2').click();
    expect(cellAt('e4').dataset.mark).toBeUndefined();
  });

  it('flags the king when it is in check', () => {
    // Fool's mate: white king on e1 is mated, so it is in check.
    build(true, 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(cellAt('e1').dataset.check).toBe('true');
    expect(cellAt('e1').getAttribute('aria-label')).toContain('em xeque');
  });
});

describe('[PieceSets] the drawing is a choice with no semantic surface', () => {
  it('uses the SOLID glyphs for both sides', () => {
    // A hollow glyph is almost entirely outline, so a light piece came out as a dark shape with a
    // thin light line inside it — the same finding the 3D pieces produced by measurement.
    const set = pieceSet(DEFAULT_SET);
    expect(set.glyph.w.p).toBe('♟');
    expect(set.glyph.b.p).toBe('♟');
    expect(set.glyph.w.k).toBe('♚');
  });

  it('carries the side on the element, not in the glyph', () => {
    build();
    expect(cellAt('e2').querySelector<HTMLElement>('.cell-piece')!.dataset.side).toBe('w');
    expect(cellAt('e7').querySelector<HTMLElement>('.cell-piece')!.dataset.side).toBe('b');
  });

  it('swaps the set without touching one label', () => {
    const { mirror: m } = build();
    const before = cellAt('e2').getAttribute('aria-label');
    m.setPieceSet('emoji');
    expect(m.pieceSetKey()).toBe('emoji');
    expect(cellAt('e2').getAttribute('aria-label')).toBe(before);
    // A coloured set cannot be tinted, so the side moves to the element and the board says so.
    expect(m.root.dataset.coloured).toBe('true');
    expect(cellAt('e2').querySelector('.cell-piece')!.textContent).not.toBe('♟');
  });

  it('falls back rather than breaking on an unavailable or unknown set', () => {
    // A stale setting must not leave a player with an empty board.
    expect(pieceSet('pecita').key).toBe(DEFAULT_SET);
    expect(pieceSet('nonsense').key).toBe(DEFAULT_SET);
    expect(AVAILABLE_SETS.every((set) => !set.off)).toBe(true);
    expect(AVAILABLE_SETS.length).toBeLessThan(PIECE_SETS.length);
  });

  it('names a font stack that always ends somewhere a machine actually has', () => {
    // ⚠️ The woff2 subsets are not vendored yet, so today every set falls back to a system face.
    // The stack must therefore END in a generic family, or a board can come out blank.
    for (const set of PIECE_SETS) {
      expect(/(serif|sans-serif|cursive|monospace)\s*$/.test(set.family)).toBe(true);
    }
  });
});

// ========================= THE FLAT BOARD USES THE FLAT CONVENTION =========================
// It first reused the 3D palette — yellow on indigo — which was solved for solids catching light
// on three faces and looked wrong flat. Two-dimensional chess has a convention older than any of
// this, and a learner has already met it everywhere else.

describe('[Themes] the two standards, by name and by value', () => {
  const luminance = (hex: string): number => {
    const channel = (offset: number): number => {
      const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const contrast = (a: string, b: string): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it('carries Wikipedia and XBoard at their real values', () => {
    expect(boardTheme('wikipedia').light).toBe('#ffce9e');
    expect(boardTheme('wikipedia').dark).toBe('#d18b47');
    expect(boardTheme('gnuchess').light).toBe('#C8C365');
    expect(boardTheme('gnuchess').dark).toBe('#77A26D');
    expect(DEFAULT_THEME).toBe('wikipedia');
  });

  it('paints the squares through custom properties, so one write does 64 cells', () => {
    const { mirror: m } = build();
    expect(m.root.dataset.theme).toBe('wikipedia');
    expect(m.root.style.getPropertyValue('--square-light')).toBe('#ffce9e');

    m.setTheme('gnuchess');
    expect(m.root.dataset.theme).toBe('gnuchess');
    expect(m.root.style.getPropertyValue('--square-dark')).toBe('#77A26D');
    m.setTheme('nonsense');
    expect(m.themeKey()).toBe(DEFAULT_THEME);
  });

  it('records the awkward half of the convention rather than pretending it away', () => {
    // ⚠️ A white piece's FILL clears 3:1 against NEITHER square, in EITHER standard. That is how
    // the convention works: what identifies it is the black outline. WCAG 1.4.11 asks that the
    // boundary be perceivable, not the fill — the same position render/palette.ts already takes
    // for the 3D default, with high contrast as the way out for anyone who needs more.
    for (const theme of BOARD_THEMES) {
      expect(contrast('#FFFFFF', theme.light)).toBeLessThan(3);
      expect(contrast('#FFFFFF', theme.dark)).toBeLessThan(3);
      // And the outline that carries it, which is why the stroke is a rim and not a hairline.
      expect(contrast('#000000', theme.light)).toBeGreaterThan(10);
      expect(contrast('#000000', theme.dark)).toBeGreaterThan(7);
      // The black piece's own fill needs no help.
      expect(contrast('#000000', theme.light)).toBeGreaterThanOrEqual(3);
      expect(contrast('#000000', theme.dark)).toBeGreaterThanOrEqual(3);
    }
  });
});
