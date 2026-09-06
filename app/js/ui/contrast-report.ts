// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/contrast-report — the measured contrast of a board palette, shown to whoever is choosing it.
//
// ========================= WHY THIS IS NOT ON SCREEN =========================
// It was, over the board, while a palette was being chosen. It is `docs/CONTRAST.md` now, written
// by `contrastMarkdown()` below and held to this module by a test.
//
// The person the numbers are for is whoever CONFIGURES the game — a teacher setting a room up, a
// maintainer changing an ink — and they read documentation. A child choosing a board mid-game is
// not deciding on ratios, and six columns of them were in their way.
//
// ========================= WHY THE NUMBERS EXIST AT ALL =========================
// Every palette in this project was argued for with numbers, and until now those numbers lived in
// comments and tests — read by whoever maintains the code and by nobody who uses it. But the
// person choosing a board is the one the numbers are about. A teacher picking a palette for a
// child with low vision has exactly one question, and it is the question this table answers.
//
// It is not a warning and it does not stop anyone. Four of the six palettes have fills under the
// 3:1 floor, on purpose — that is how the printed convention works, and the rim is what carries
// them. Showing the whole table, floor marked, says that plainly instead of hiding it or refusing
// the choice.
//
// The ratios are COMPUTED here from the palette the renderer will actually use. A table typed out
// by hand would be a fourth copy of numbers this repository has already had go stale once.

import type { BoardTheme } from './board-themes.ts';

/** WCAG 1.4.11: non-text contrast, for anything that has to be told apart from its background. */
export const FLOOR = 3;

export interface ContrastRow {
  /** i18n key for the pair being measured. */
  readonly label: string;
  readonly ratio: number;
  readonly passes: boolean;
  /**
   * ⚠️ TRUE FOR PAIRS THAT NEVER TOUCH, and that is the whole of what this flag means now. It
   * used to mean "allowed to fail", and it counted the two SQUARES among them — on the reasoning
   * that squares are told apart by position. They are not: they share an edge along their whole
   * length, they are the largest boundary on the board, and a board whose squares run together is
   * not a board. That misclassification is why every palette here shipped with its squares below
   * the floor and nothing complained.
   *
   * A piece's fill against a square, by contrast, genuinely never meets it: the silhouette is
   * drawn between them. 1.4.11 asks that a BOUNDARY be perceivable, and there is no boundary
   * between two colours that do not share an edge.
   */
  readonly optional: boolean;
}

const channel = (hex: string, offset: number): number => {
  const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every pair worth knowing about, in the order they matter. */
export function contrastRows(theme: BoardTheme): ContrastRow[] {
  const row = (label: string, a: string, b: string, optional = false): ContrastRow => {
    const ratio = contrast(a, b);
    return { label, ratio, passes: ratio >= FLOOR, optional };
  };

  return [
    // Identity first: whose piece is that. Not a boundary, but the question a board exists to
    // answer, so it is held to the same floor.
    row('contrast.pieces', theme.white, theme.black),

    // ---- pairs that TOUCH -----------------------------------------------------
    // The largest boundary on the board, and the one every palette here used to fail.
    row('contrast.squares', theme.light, theme.dark),
    // The silhouette is the outermost ink of a piece: it is what a square actually meets.
    row('contrast.rimLight', theme.rim, theme.light),
    row('contrast.rimDark', theme.rim, theme.dark),
    // And inside a piece: the thin stroke that separates a crown from a collar.
    row('contrast.innerWhite', theme.whiteRim, theme.white),
    row('contrast.innerBlack', theme.blackRim, theme.black),

    // ---- pairs that never meet, because the silhouette is between them ---------
    row('contrast.whiteLight', theme.white, theme.light, true),
    row('contrast.whiteDark', theme.white, theme.dark, true),
    row('contrast.blackLight', theme.black, theme.light, true),
    row('contrast.blackDark', theme.black, theme.dark, true),
  ];
}

/** One line saying what the table amounts to, so nobody has to read eight rows to get the point. */
export function verdict(rows: readonly ContrastRow[]): 'all' | 'required' | 'short' {
  if (rows.every((r) => r.passes)) return 'all';
  return rows.every((r) => r.passes || r.optional) ? 'required' : 'short';
}

/**
 * The whole table as Markdown, for `docs/CONTRAST.md`.
 *
 * ⚠️ GENERATED, and a test fails if the document and this module disagree. A table typed by hand
 * would be a second copy of numbers this repository has already had go stale once — which is
 * exactly how the high-contrast palette shipped for months with its squares at 2.13:1 while every
 * comment around it said otherwise.
 */
export function contrastMarkdown(
  themes: readonly BoardTheme[],
  label: (key: string) => string,
): string {
  const rows = contrastRows(themes[0]);
  const head = `| par | ${themes.map((t) => label(t.short)).join(' | ')} |`;
  const rule = `| --- | ${themes.map(() => '---:').join(' | ')} |`;
  const body = rows.map((_, index) => {
    const cells = themes.map((theme) => {
      const row = contrastRows(theme)[index];
      const mark = row.passes ? '' : row.optional ? ' ·' : ' **<**';
      return `${row.ratio.toFixed(2)}${mark}`;
    });
    const touches = rows[index].optional ? '' : ' **(encosta)**';
    return `| ${label(rows[index].label)}${touches} | ${cells.join(' | ')} |`;
  });
  return [head, rule, ...body].join(String.fromCharCode(10));
}
