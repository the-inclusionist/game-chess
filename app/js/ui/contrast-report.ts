// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/contrast-report — every pair of inks a board palette puts next to each other, measured.
//
// ========================= NOTHING READS THIS AT RUN TIME ANY MORE =========================
// It drew a table over the board while a palette was being chosen, and then a document. Both are
// gone, and for the same reason: EVERY palette in this game now clears 3:1 on every pair that
// touches. There is no longer a choice to warn anybody about.
//
// What is left is the measurement itself, and the tests are what use it — `board-2d.browser`
// walks every theme through `contrastRows` and fails if any touching pair drops below the floor.
// So this module went from being a feature to being the thing that keeps the palettes honest,
// which is the more useful of the two.
//
// ⚠️ THE DISTINCTION THIS FILE TURNS ON: 1.4.11 asks that a BOUNDARY be perceivable, and two
// colours that never share an edge have no boundary between them. A piece's fill against a square
// is such a pair — the silhouette is always drawn between them — and marking it `optional` is
// what stops the tests from demanding something that is arithmetically impossible.

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

