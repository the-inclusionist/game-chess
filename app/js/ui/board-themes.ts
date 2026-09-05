// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/board-themes — the squares and the piece inks of the FLAT board.
//
// ========================= WHY NOT THE 3D PALETTE =========================
// The first flat board reused `render/palette.ts`: yellow pieces on indigo. That palette was
// solved for a projected board where the pieces are SOLIDS catching light from three faces, and it
// was reported as looking bad flat — correctly. Two-dimensional chess has a convention that is
// older than any of this and that a learner has already met everywhere else, and departing from it
// costs recognition for nothing.
//
// So the flat board uses the two standards by name, with their real values:
//
//   Wikipedia's chess diagram template    light #ffce9e   dark #d18b47
//   XBoard, the GNU Chess interface       light #C8C365   dark #77A26D
//
// and the pieces are white and black with the opposite ink as an outline, which is what every
// printed diagram and every 2D interface does.
//
// ========================= WHAT THE NUMBERS SAY, INCLUDING THE AWKWARD PART =========================
// Measured (sRGB relative luminance), fill against square:
//
//                        Wikipedia          XBoard
//   white on light         1.44              1.83     ← both under the floor
//   white on dark          2.80              2.93     ← both under the floor
//   black on light        14.57             11.45
//   black on dark          7.50              7.17
//   piece against piece   21.00             21.00
//   square against square  1.94              1.60
//
// ⚠️ A WHITE PIECE'S FILL CLEARS 3:1 AGAINST NEITHER SQUARE, IN EITHER STANDARD. That is not a
// defect in these palettes; it is how the convention works. What identifies a white piece is its
// BLACK OUTLINE, at 14.57 and 11.45 — and WCAG 1.4.11 asks that the boundary be perceivable, not
// that the fill be. `render/palette.ts` already records the same position for the 3D default, and
// the high-contrast mode is the answer for anyone who needs the fills themselves to carry it.
//
// Which is exactly why the outline here is a real rim and not a hairline, and why high contrast
// overrides both themes rather than tinting them.

export interface BoardTheme {
  readonly key: string;
  readonly light: string;
  readonly dark: string;
  /** i18n key for the name shown in the panel. */
  readonly name: string;
}

export const BOARD_THEMES: readonly BoardTheme[] = [
  { key: 'wikipedia', light: '#ffce9e', dark: '#d18b47', name: 'theme.wikipedia' },
  { key: 'gnuchess', light: '#C8C365', dark: '#77A26D', name: 'theme.gnuchess' },
];

/** Wikipedia's, because it is the board a learner is most likely to have seen. */
export const DEFAULT_THEME = 'wikipedia';

const BY_KEY: ReadonlyMap<string, BoardTheme> = new Map(BOARD_THEMES.map((t) => [t.key, t]));

/** Falls back to the default, so a stale or unknown setting cannot leave a board unpainted. */
export function boardTheme(key: string): BoardTheme {
  return BY_KEY.get(key) ?? (BY_KEY.get(DEFAULT_THEME) as BoardTheme);
}
