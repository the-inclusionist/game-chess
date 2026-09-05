// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/board-themes — the squares AND the piece inks of the flat board, as named palettes.
//
// ========================= WHY A THEME IS NOT JUST TWO SQUARES =========================
// It began as two colours and that was not enough to say what was being asked for. "The
// high-contrast colours of the 2D board" and "the high-contrast colours of the 2.5D board" have
// THEIR OWN SQUARES — each solved for its own pieces — and differ entirely in the
// pieces: white against black in one, yellow against black-under-a-blue-rim in the other. A theme
// that carried only squares would have made those two the same entry.
//
// So a theme carries the squares, both piece fills, the thin rim INSIDE each piece, and the heavy
// rim BEHIND it. Which is also what lets `jose` mean anything: the Hartwig palette is a choice
// about pieces first.
//
// ========================= WHERE THESE COME FROM =========================
//   brown       chessboard.js (MIT), and lichess's default #f0d9b5 / #b58863   ← the default here
//   wikipedia   Wikipedia's chess diagram template          #ffce9e / #d18b47
//   xboard      XBoard, the GNU Chess interface             #C8C365 / #77A26D
//   jose        this project's own, from render/palette.ts  #DCD6C8 / #8D8677
//   contrast-*  searched, here and in palette.ts            #9C9C9C / #989898
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
//  · ⚠️ AND THE SQUARES OF A HIGH-CONTRAST THEME CLEAR 3:1 AGAINST EACH OTHER, which is the rule
//    that mode exists for and the rule it was breaking: the two greys it used were 2.13:1. See
//    the note above those two entries for what moved, and what it moved from.

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
  /** i18n key for the abbreviation used as a column heading in the comparison table. */
  readonly short: string;
  /**
   * ========================= THE PROJECTED BOARD NEEDS MORE THAN A FILL =========================
   * A flat piece is one colour. A Zdog piece is a SOLID, and it reads as mass only if its top,
   * front and side differ — `render/palette.ts` measured that: below about 1.5 between two
   * neighbouring planes the eye fuses them and the piece goes flat.
   *
   * So each theme is shaded for that view. Most are DERIVED, by one rule, from the flat fill; the
   * three that were solved numerically already — this project's own and the two high-contrast
   * palettes — carry their answers here rather than being re-derived and quietly changed.
   */
  readonly solid?: {
    readonly light: readonly [top: string, face: string, side: string];
    readonly dark: readonly [top: string, face: string, side: string];
  };
  /** No shading at all: a high-contrast palette has no luminance room for it. See palette.ts. */
  readonly flatSolid?: boolean;
}

const INK = { white: '#FFFFFF', black: '#000000', whiteRim: '#000000', blackRim: '#FFFFFF' };

export const BOARD_THEMES: readonly BoardTheme[] = [
  // ⚠️ THE DEFAULT, and it is one pair serving two names: lichess's "brown" board and
  // chessboard.js's default are the same #f0d9b5 / #b58863 — confirmed against
  // `niklasf/web-boardimage`'s `lichess-brown.json`, not remembered. It is very probably the board
  // a learner has already met, since it is what lichess shows before anyone changes anything.
  { key: 'brown', light: '#f0d9b5', dark: '#b58863', ...INK, rim: '#17110a', name: 'theme.brown', short: 'theme.short.brown' },
  { key: 'wikipedia', light: '#ffce9e', dark: '#d18b47', ...INK, rim: '#17110a', name: 'theme.wikipedia', short: 'theme.short.wikipedia' },
  { key: 'xboard', light: '#C8C365', dark: '#77A26D', ...INK, rim: '#17110a', name: 'theme.xboard', short: 'theme.short.xboard' },
  {
    // The Hartwig palette, flat. Yellow against indigo separates by LUMINANCE at 8.91, which is
    // the argument `render/palette.ts` is built on and the reason it survives a CVD filter.
    key: 'jose',
    light: '#DCD6C8',
    dark: '#8D8677',
    white: '#FFE08A',
    black: '#3F2B78',
    whiteRim: '#3B2A12',
    // ⚠️ NOT a light rim. `render/palette.ts` gives the dark side `stroke: '#0E0722'` — the piece
    // is outlined in something darker than itself, not brighter. Putting the light side's yellow
    // here reversed that and the dark pieces came out ringed in gold, which is not this palette.
    // The rule the file states is the one that governs: the ink that covers a piece names it.
    blackRim: '#0E0722',
    rim: '#0E0722',
    name: 'theme.jose',
    short: 'theme.short.jose',
    // The numbers `render/palette.ts` solved: top against front is 1.72 on the light side and 1.64
    // on the dark, widened from 1.18 after counting pixels by face and finding that at this camera
    // pitch only top-against-front does any work.
    solid: {
      light: ['#FFE08A', '#E0A33A', '#B8781F'],
      dark: ['#5B44A0', '#3A2670', '#1E1140'],
    },
  },
  {
    // ========================= THE SAME PALETTE, OUTLINED THE OTHER WAY =========================
    // José with the dark side's rim taken from the LIGHT side: gold on indigo instead of a
    // near-black line. It was tried by accident, looked wrong, and was reverted — and then the
    // dark side's outline was halved, which changes the question. At full width that rim was a
    // thick gold ring and the piece read as a light one; at half it is a fine line on a mass of
    // indigo, which is a different proposition entirely.
    //
    // ⚠️ It is kept as its own entry rather than replacing anything, because the argument in
    // `render/palette.ts` — the ink that covers a piece is the ink that names it — is what
    // condemned it at full width, and that argument has not been withdrawn. This is the
    // experiment, on the board, where it can be looked at rather than described.
    key: 'jose2',
    light: '#DCD6C8',
    dark: '#8D8677',
    white: '#FFE08A',
    black: '#3F2B78',
    whiteRim: '#3B2A12',
    blackRim: '#FFE08A',
    rim: '#0E0722',
    name: 'theme.jose2',
    short: 'theme.short.jose2',
    solid: {
      light: ['#FFE08A', '#E0A33A', '#B8781F'],
      dark: ['#5B44A0', '#3A2670', '#1E1140'],
    },
  },
  /*
   * ========================= ⚠️ THE WHOLE TABLE, MAXIMISED BY SEARCH =========================
   * The contrast table measures eight pairs among five inks: two squares, two piece fills, and
   * the silhouette. These two palettes are the answer to "make every row of it as high as it can
   * go", and that answer is a SEARCH result, not a preference.
   *
   * FIRST, WHAT IS NOT POSSIBLE. Every row at 3:1 cannot be done by anyone. Each piece has to sit
   * 3:1 from BOTH squares, and the squares 3:1 from each other; a colour between the squares only
   * clears both if the squares are 9:1 apart, so the cheapest arrangement is light piece above,
   * squares in the middle, dark piece below — three gaps of 3, which is 27. The whole range from
   * white to black is worth 21. There is no palette; there is no clever hue. 21^(1/3) = 2.759 is
   * the ceiling on the worst row, reached when the three gaps are equal.
   *
   * SECOND, WHERE EACH VERSION LANDED. The search below is over every grey pair and every rim.
   *
   *                                    pior linha    o que ficava curto
   *   original                            2.13       casas
   *   a minha primeira correcao           2.61       contorno/casa escura, pecas, casas
   *   agora                               2.75       nada abaixo de 2.75
   *
   * The original bought three rows at 3-and-a-bit by leaving the squares at 2.13. Mine bought the
   * squares at 3.04 by dropping three rows below 3, including a required one. Neither was on the
   * ceiling. These are: four rows sit together at about 2.76 and nothing is below it.
   *
   * THIRD, THE SQUARES ARE 2.76 AND NOT 3. That is the cost of not having any row at 2.13, and it
   * is the arithmetic above rather than a decision — 3:1 on the squares forces something else
   * down to 2.61, which is worse for the table as a whole.
   *
   * ⚠️ The two palettes DO NOT share their squares any more. They cannot: the coloured one's light
   * piece is yellow, which is a shade below white, so its optimum sits two steps darker. Sharing
   * cost it 2.56 against its own 2.69, for the sake of a tidiness nobody can see.
   */
  {
    // Greys, read by lightness. Worst row 2.75; four rows sit at about 2.76 together.
    key: 'contrast-flat',
    light: '#9C9C9C',
    dark: '#545454',
    ...INK,
    rim: '#000000',
    name: 'theme.contrast1',
    short: 'theme.short.contrast1',
    flatSolid: true,
  },
  {
    // The same solved again for someone who reads hue faster than lightness: yellow against
    // black, with a light blue inner stroke so the dark piece has detail as well as an edge.
    // Its own squares, two steps darker, because yellow is not quite white. Worst row 2.69.
    key: 'contrast-solid',
    light: '#989898',
    dark: '#525252',
    white: '#FFFF00',
    black: '#000000',
    whiteRim: '#000000',
    // ⚠️ #4DB3FF and not #0099FF, and this is the INNER stroke — no row of the contrast table
    // touches it. It has to be brighter because it is the only ink a black piece has on a dark
    // square: the fill is 2.69 there, the black silhouette is 2.69 too, and the old blue was
    // 2.61. This one is 3.44, so the piece has a real edge. Nothing else about the palette moves.
    blackRim: '#4DB3FF',
    rim: '#000000',
    name: 'theme.contrast2',
    short: 'theme.short.contrast2',
    flatSolid: true,
  },
];

/** lichess's, which is also chessboard.js's — the board a learner is most likely to have seen. */
export const DEFAULT_THEME = 'brown';
/** What the high-contrast switch selects on the flat board. */
export const CONTRAST_THEME = 'contrast-flat';

const BY_KEY: ReadonlyMap<string, BoardTheme> = new Map(BOARD_THEMES.map((t) => [t.key, t]));

/** Falls back to the default, so a stale or unknown setting cannot leave a board unpainted. */
export function boardTheme(key: string): BoardTheme {
  return BY_KEY.get(key) ?? (BY_KEY.get(DEFAULT_THEME) as BoardTheme);
}
