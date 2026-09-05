// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/board-themes — the squares AND the piece inks of the flat board, as named palettes.
//
// ========================= WHY A THEME IS NOT JUST TWO SQUARES =========================
// It began as two colours and that was not enough to say what was being asked for. "The
// high-contrast colours of the 2D board" and "the high-contrast colours of the 2.5D board" have
// THE SAME SQUARES — #8F8F8F and #5A5A5A, solved once for both — and differ entirely in the
// pieces: white against black in one, yellow against black-under-a-blue-rim in the other. A theme
// that carried only squares would have made those two the same entry.
//
// So a theme carries the squares, both piece fills, the thin rim INSIDE each piece, and the heavy
// rim BEHIND it. Which is also what lets `jose` mean anything: the Hartwig palette is a choice
// about pieces first.
//
// ========================= WHERE THESE COME FROM =========================
//   wikipedia   Wikipedia's chess diagram template          #ffce9e / #d18b47
//   brown       chessboard.js (MIT), also lichess's default #f0d9b5 / #b58863
//   xboard      XBoard, the GNU Chess interface             #C8C365 / #77A26D
//   jose        this project's own, from render/palette.ts  #DCD6C8 / #8D8677
//   contrast-*  solved numerically here and in palette.ts   #8F8F8F / #5A5A5A
//
// ⚠️ On licensing, since it was asked: a pair of hex values is a FACT, not creative expression, so
// no licence reaches them. XBoard is GPL and chessboard.js is MIT, and both are named here for
// credit and for recognition — a player who has met a board somewhere else should be able to find
// it again by name — not because permission was needed.
//
// ========================= MEASURED, ALL OF THEM =========================
// sRGB relative luminance, computed rather than copied. `rim` is the silhouette behind a piece.
//
//   theme          rim/light rim/dark  white/light white/dark black/light black/dark piece:piece sq:sq
//   wikipedia         13.00     6.69         1.44       2.80       14.57       7.50      21.00   1.94
//   brown             13.65     5.95         1.37       3.15       15.30       6.67      21.00   2.29
//   xboard            10.21     6.40         1.83       2.93       11.45       7.17      21.00   1.60
//   jose              13.52     5.42         1.12       2.80        7.93       3.18       8.91   2.50
//   contrast 1         6.49     3.04         3.23       6.90        6.49       3.04      21.00   2.13
//   contrast 2         6.49     3.04         3.01       6.42        6.49       3.04      19.56   2.13
//
// Two things to read out of that table:
//
//  · EVERY rim clears 3:1 against BOTH squares — 5.42 at worst. That is what makes a piece have an
//    edge on any of these boards, and it is why the rim exists: the light fills do not.
//  · Only the two high-contrast themes clear 3:1 on the FILLS. The other four are carried by the
//    rim, which is how the printed convention has always worked and what WCAG 1.4.11 actually
//    asks — that the boundary be perceivable, not the fill.

export interface BoardTheme {
  readonly key: string;
  readonly light: string;
  readonly dark: string;
  /** The two piece fills. */
  readonly white: string;
  readonly black: string;
  /** The thin stroke INSIDE each piece, which separates a crown from a collar. */
  readonly whiteRim: string;
  readonly blackRim: string;
  /** The heavy silhouette BEHIND every piece, which gives it an edge against the board. */
  readonly rim: string;
  /** i18n key for the name in the panel. */
  readonly name: string;
}

const INK = { white: '#FFFFFF', black: '#000000', whiteRim: '#000000', blackRim: '#FFFFFF' };

export const BOARD_THEMES: readonly BoardTheme[] = [
  { key: 'wikipedia', light: '#ffce9e', dark: '#d18b47', ...INK, rim: '#17110a', name: 'theme.wikipedia' },
  { key: 'brown', light: '#f0d9b5', dark: '#b58863', ...INK, rim: '#17110a', name: 'theme.brown' },
  { key: 'xboard', light: '#C8C365', dark: '#77A26D', ...INK, rim: '#17110a', name: 'theme.xboard' },
  {
    // The Hartwig palette, flat. Yellow against indigo separates by LUMINANCE at 8.91, which is
    // the argument `render/palette.ts` is built on and the reason it survives a CVD filter.
    key: 'jose',
    light: '#DCD6C8',
    dark: '#8D8677',
    white: '#FFE08A',
    black: '#3F2B78',
    whiteRim: '#3B2A12',
    blackRim: '#FFE08A',
    rim: '#0E0722',
    name: 'theme.jose',
  },
  {
    // High contrast as the FLAT board solves it: the default already uses the extreme inks, so all
    // that is left to fix is the board.
    key: 'contrast-flat',
    light: '#8F8F8F',
    dark: '#5A5A5A',
    ...INK,
    rim: '#000000',
    name: 'theme.contrast1',
  },
  {
    // High contrast as the PROJECTED board solves it, brought over unchanged: yellow filling and a
    // #0099FF rim on black, because there the ink that COVERS a piece is its stroke.
    key: 'contrast-solid',
    light: '#8F8F8F',
    dark: '#5A5A5A',
    white: '#FFFF00',
    black: '#000000',
    whiteRim: '#000000',
    blackRim: '#0099FF',
    rim: '#000000',
    name: 'theme.contrast2',
  },
];

/** Wikipedia's, because it is the board a learner is most likely to have seen. */
export const DEFAULT_THEME = 'wikipedia';
/** What the high-contrast switch selects on the flat board. */
export const CONTRAST_THEME = 'contrast-flat';

const BY_KEY: ReadonlyMap<string, BoardTheme> = new Map(BOARD_THEMES.map((t) => [t.key, t]));

/** Falls back to the default, so a stale or unknown setting cannot leave a board unpainted. */
export function boardTheme(key: string): BoardTheme {
  return BY_KEY.get(key) ?? (BY_KEY.get(DEFAULT_THEME) as BoardTheme);
}
