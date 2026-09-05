// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/contrast-report — the measured contrast of a board palette, shown to whoever is choosing it.
//
// ========================= WHY A PLAYER SEES THIS AT ALL =========================
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
   * True for the pairs a palette is ALLOWED to fail: a piece's fill, which the printed convention
   * lets the rim carry, and the two squares, which are told apart by position on the board.
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
    // First, because it is the one that must never fail: whose piece is that.
    row('contrast.pieces', theme.white, theme.black),
    // Then the rim, which is what actually delineates a piece on four of the six boards.
    row('contrast.rimLight', theme.rim, theme.light),
    row('contrast.rimDark', theme.rim, theme.dark),
    row('contrast.whiteLight', theme.white, theme.light, true),
    row('contrast.whiteDark', theme.white, theme.dark, true),
    row('contrast.blackLight', theme.black, theme.light, true),
    row('contrast.blackDark', theme.black, theme.dark, true),
    row('contrast.squares', theme.light, theme.dark, true),
  ];
}

/** One line saying what the table amounts to, so nobody has to read eight rows to get the point. */
export function verdict(rows: readonly ContrastRow[]): 'all' | 'required' | 'short' {
  if (rows.every((r) => r.passes)) return 'all';
  return rows.every((r) => r.passes || r.optional) ? 'required' : 'short';
}
