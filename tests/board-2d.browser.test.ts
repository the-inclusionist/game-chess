// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import { createGameState } from '../app/js/chess/state.ts';
import { type Square } from '../app/js/chess/types.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createGridMirror, type GridMirror } from '../app/js/ui/grid-mirror.ts';
import { AVAILABLE_SETS, DEFAULT_SET, PIECE_SETS, pieceSet } from '../app/js/ui/piece-sets.ts';
import { contrastRows } from '../app/js/ui/contrast-report.ts';
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
    doc: document, i18n: createI18n('pt'), rules: () => rules, state: () => state, visible, onActivate,
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
    m.setPieceSet('math');
    expect(m.pieceSetKey()).toBe('math');
    // The whole reason this is a cheap control: the meaning lives in the label, and the label did
    // not move.
    expect(cellAt('e2').getAttribute('aria-label')).toBe(before);
    // What DID change is the face the cell asks for.
    expect(m.root.style.getPropertyValue('--piece-font')).toContain('STIX Two Math');
  });

  it('names each set by its typeface, not by a description of it', () => {
    // ⚠️ These were "chess symbols" and "mathematical symbols" — a description dressed as a name,
    // which helps nobody: it hides the answer from someone who knows the face and teaches nothing
    // to someone who does not. A typeface is a proper noun, so the label is a literal in every
    // language, exactly as the engine's own font catalogue keeps `fam`.
    expect(PIECE_SETS.map((set) => set.label))
      .toEqual(['Noto Sans Symbols 2', 'STIX Two Math', 'Pecita']);
  });

  it('falls back rather than breaking on an unknown set', () => {
    // A stale setting must not leave a player with an empty board.
    expect(pieceSet('nonsense').key).toBe(DEFAULT_SET);
    expect(AVAILABLE_SETS.every((set) => !set.off)).toBe(true);
  });

  it('offers all three faces, now that all three are vendored', () => {
    // Pecita was held back for a licence question that turned out to be settled — SIL OFL 1.1 —
    // and then for the real reason, which was that the file was not here. It is now: 2,748 bytes
    // of it, being the twelve codepoints a board needs.
    expect(AVAILABLE_SETS).toHaveLength(PIECE_SETS.length);
    expect(AVAILABLE_SETS.map((set) => set.key)).toEqual(['symbols', 'math', 'pecita']);
  });

  it('ships Pecita under a name that is not Pecita, because the OFL says so', () => {
    // ⚠️ "Pecita" is a Reserved Font Name and a subset is a Modified Version, which may not carry
    // one. The FONT is renamed; the SET keeps the designer's name, because that names the design a
    // player is choosing rather than the font software.
    const hand = pieceSet('pecita');
    expect(hand.label).toBe('Pecita');
    expect(hand.family.startsWith("'HandwrittenChess'")).toBe(true);
  });

  it('ends every stack in a generic family, so a missing file still draws a board', () => {
    for (const set of PIECE_SETS) {
      expect(/(serif|sans-serif|cursive|monospace)\s*$/.test(set.family)).toBe(true);
    }
  });

});

// ========================= THE FLAT BOARD USES THE FLAT CONVENTION =========================
// It first reused the 3D palette — yellow on indigo — which was solved for solids catching light
// on three faces and looked wrong flat. Two-dimensional chess has a convention older than any of
// this, and a learner has already met it everywhere else.

describe('[Themes] six named palettes, measured', () => {
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

  it('keeps every source LIGHT square exactly, which is what makes a board recognisable', () => {
    expect(boardTheme('wikipedia').light).toBe('#ffce9e');
    // chessboard.js (MIT), which is also lichess's default board.
    expect(boardTheme('brown').light).toBe('#f0d9b5');
    // ⚠️ XBoard is the GUI; GNU Chess is the engine behind it. The colours are XBoard's.
    expect(boardTheme('xboard').light).toBe('#C8C365');
    // ⚠️ The default is lichess's board, confirmed against niklasf/web-boardimage's
    // lichess-brown.json rather than remembered. It is the board a learner has most likely
    // already met, because it is what lichess shows by default.
    expect(DEFAULT_THEME).toBe('brown');
  });

  it('deepens every source DARK square as far as 3:1 needs, and no further', () => {
    // ⚠️ THESE ARE NO LONGER EXACT CITATIONS, and that is a decision rather than an oversight.
    // Every one of these boards had its two squares below the floor, and two squares share an
    // edge along their whole length — the largest boundary there is. The HUE is untouched, only
    // the lightness, and the amount is the least that reaches 3:1, so each board is still
    // recognisably the board it names.
    //
    //   chessboard.js  #b58863 -> #9C7555     Wikipedia  #d18b47 -> #A36C37
    //   XBoard         #77A26D -> #52704B     José       #8D8677 -> #7D776A
    //
    // Lightening the light square instead was measured and rejected: chessboard.js would have
    // needed luminance 0.949, which is very nearly white and a different board altogether.
    for (const key of ['brown', 'wikipedia', 'xboard', 'jose']) {
      const ratio = contrast(boardTheme(key).light, boardTheme(key).dark);
      expect(ratio).toBeGreaterThanOrEqual(3);
      expect(ratio).toBeLessThan(3.2);
    }
  });

  it('clears 3:1 between the two squares on EVERY board, without exception', () => {
    // The largest boundary on the board, and the first thing a person with low vision feels.
    for (const theme of BOARD_THEMES) {
      const ratio = contrast(theme.light, theme.dark);
      expect(`${theme.key} ${ratio.toFixed(2)}`)
        .toBe(`${theme.key} ${Math.max(3, ratio).toFixed(2)}`);
    }
  });

  it('draws a line INSIDE every piece that can actually be seen against it', () => {
    // ⚠️ José had `blackRim: '#0E0722'` against a `#3F2B78` fill — **1.71**, which is not a line,
    // it is the same colour twice. The dark pieces had no crown, no collar, no internal drawing
    // at all. The rule that put it there is about the SILHOUETTE, the outermost ink, and was
    // never about the stroke drawn inside a piece.
    for (const theme of BOARD_THEMES) {
      for (const [inner, fill] of [[theme.whiteRim, theme.white], [theme.blackRim, theme.black]]) {
        const ratio = contrast(inner, fill);
        expect(`${theme.key} ${ratio.toFixed(2)}`)
          .toBe(`${theme.key} ${Math.max(3, ratio).toFixed(2)}`);
      }
    }
  });

  it('gives the two high-contrast entries the same SQUARES and different PIECES', () => {
    // They share their squares because what CONSTRAINS the squares is shared: the silhouette,
    // which is black on both, has to clear 3:1 against the dark square, and that fixes how dark
    // it may be — which then fixes how light the light one has to be. The pieces are free.
    const flat = boardTheme('contrast-flat');
    const solid = boardTheme('contrast-solid');
    expect(flat.light).toBe(solid.light);
    expect(flat.dark).toBe(solid.dark);
    expect(flat.white).not.toBe(solid.white);
  });

  it('keeps the Hartwig palette recognisable, and separated by luminance', () => {
    const jose = boardTheme('jose');
    expect(jose.white).toBe('#FFE08A');
    expect(jose.black).toBe('#3F2B78');
    // 8.91 — below black-against-white's 21, far above the 3:1 floor, and it is a LUMINANCE gap,
    // which is what makes it survive a colour-vision filter.
    expect(contrast(jose.white, jose.black)).toBeGreaterThan(8);
  });

  it('publishes every ink as a custom property, so one write reaches 64 cells', () => {
    const { mirror: m } = build();
    expect(m.root.dataset.theme).toBe('brown');
    expect(m.root.style.getPropertyValue('--square-light')).toBe('#f0d9b5');

    m.setTheme('jose');
    expect(m.root.style.getPropertyValue('--piece-white')).toBe('#FFE08A');
    expect(m.root.style.getPropertyValue('--piece-halo')).toBe('#0E0722');
    m.setTheme('nonsense');
    expect(m.themeKey()).toBe(DEFAULT_THEME);
  });

  it('gives every traditional board a rim that is an edge on both of its squares', () => {
    // ⚠️ NOT the high-contrast pair, and the exception is the interesting part. On those two the
    // dark square is deliberately dark — that is what buys the squares their 3:1 — so a black
    // silhouette behind a black piece is 2.65 against it and carries nothing. There the boundary
    // is the piece's LIGHT INNER STROKE instead, which the test below checks per combination.
    for (const theme of BOARD_THEMES) {
      if (theme.key.startsWith('contrast-')) continue;
      expect(contrast(theme.rim, theme.light)).toBeGreaterThanOrEqual(3);
      expect(contrast(theme.rim, theme.dark)).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives every piece an edge on every square, by fill, inner stroke or silhouette', () => {
    // ⚠️ The pair this catches is a black piece on the dark square of the coloured palette: its
    // fill is 2.69 there and its black silhouette is 2.69 too, so the light blue INNER stroke is
    // the only ink left. That is why it is #4DB3FF and not the older, darker #0099FF.
    // ⚠️ THE RULE IS PER COMBINATION, not per ink, and the previous version of this test got that
    // wrong in a way that only showed up when the high-contrast squares moved. A flat piece is
    // drawn with three inks — its fill, the thin stroke inside it, and the heavy silhouette
    // behind it — and 1.4.11 asks that the BOUNDARY be perceivable, not any particular one of
    // them. On a light square a dark piece is carried by its own fill; on a dark square it is
    // carried by its light inner stroke; the traditional boards are carried by the silhouette.
    for (const theme of BOARD_THEMES) {
      for (const square of [theme.light, theme.dark]) {
        for (const [fill, inner] of [[theme.white, theme.whiteRim], [theme.black, theme.blackRim]]) {
          const best = Math.max(
            contrast(fill, square), contrast(inner, square), contrast(theme.rim, square),
          );
          expect(best).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('separates the two pieces well past the floor on every board', () => {
    // ⚠️ 8 was the bound until the coloured palette's dark piece became BLUE instead of black.
    // Yellow against #3557A8 is 6.35 — twice the floor, and deliberately less than the 19.56 it
    // had against black: that palette exists for someone who reads hue faster than lightness, and
    // yellow-against-blue is the most robust hue pair there is under every kind of colour
    // blindness. Trading some luminance for that is the whole point of it.
    for (const theme of BOARD_THEMES) {
      expect(`${theme.key} ${contrast(theme.white, theme.black) > 6}`).toBe(`${theme.key} true`);
    }
  });

  it('clears 3:1 on every pair that TOUCHES, for both high-contrast palettes', () => {
    // ========================= ⚠️ THE ONLY RULE THAT MATTERS =========================
    // Three wrong answers came before this one, and all three optimised the wrong set. 1.4.11 is
    // about a BOUNDARY being perceivable, and two colours that never meet have no boundary.
    //
    // The SQUARES touch, along the whole length of every edge — they are the largest boundary on
    // the board and the one a low-vision player feels first, and every version of these palettes
    // until now had them at 2.13, 2.76 or 2.71. A piece's FILL never touches a square, because
    // the silhouette is drawn between them; buying that pair 3:1 is what cost the squares theirs.
    for (const key of ['contrast-flat', 'contrast-solid']) {
      const theme = boardTheme(key);
      for (const row of contrastRows(theme)) {
        if (row.optional) continue;
        expect(`${key} ${row.label} ${row.ratio.toFixed(2)}`)
          .toBe(`${key} ${row.label} ${Math.max(3, row.ratio).toFixed(2)}`);
      }
    }
  });
});

/*
 * ========================= THE BOARD THAT IS NAMED FOR BEING SAFE =========================
 * The Dev, 2026-10-04: "o tabuleiro seguro para daltonismo tem um contraste ruim entre as peças
 * brancas e as cores claras do tabuleiro." He was right, and it was the SECOND WORST of the seven
 * on that pair — 1.25, on the board whose name promises otherwise.
 */
describe('[cb-safe] a white piece has to read on the light square, not only have an edge', () => {
  const rows = () => contrastRows(boardTheme('cb-safe'));
  const row = (label: string) => {
    const found = rows().find((r) => r.label === label);
    if (!found) throw new Error(`${label} is not measured any more`);
    return found;
  };

  it('clears 3:1 on every pair that TOUCHES, like the two high-contrast boards', () => {
    for (const r of rows()) {
      if (r.optional) continue;
      expect(`${r.label} ${r.ratio.toFixed(2)}`).toBe(`${r.label} ${Math.max(3, r.ratio).toFixed(2)}`);
    }
  });

  it('⚠️ and comes within a tenth of the proven ceiling on the pair the Dev reported', () => {
    /*
     * THE CEILING IS 2.33 AND THE PROOF IS THREE LINES. The outline is black and owes the dark
     * square 3:1, so the dark square's luminance is at least 0.10. The squares owe each other 3:1,
     * so the light square's is at least 3×0.10 + 0.10 = 0.40. A white piece on that light square
     * is therefore at most 1.05 / 0.45 = 2.33 — for EVERY board in this file, not just this one.
     *
     * So 3:1 is not the bar here and asserting it would be asserting something impossible. The bar
     * is the ceiling, and the number to keep this test honest is how far under it we are.
     */
    const mine = row('contrast.whiteLight').ratio;
    expect(mine).toBeGreaterThan(2.2);
    // And no ordinary board may be meaningfully kinder than the one named for being safe. The
    // best of the other six is «Preto & Branco» at 2.30, which is the ceiling too; a tenth is the
    // rounding this is allowed, not a budget to spend.
    const others = BOARD_THEMES.filter((t) => t.key !== 'cb-safe').map((t) =>
      contrastRows(t).find((r) => r.label === 'contrast.whiteLight')!.ratio);
    expect(mine).toBeGreaterThan(Math.max(...others) - 0.1);
  });

  it('is still read by lightness alone, so a dichromat loses nothing', () => {
    const theme = boardTheme('cb-safe');
    // Both squares are ONE hue at two lightnesses — there is no hue pair left to lose. Stated as
    // a property of the palette rather than re-running the simulation matrices here: the three
    // simulated ratios are in the file's own comment, 3.01 / 3.04 / 3.01 against 3.03 normal.
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b);
    };
    expect(Math.abs(hue(theme.light) - hue(theme.dark))).toBeLessThan(0.25);
  });
});
