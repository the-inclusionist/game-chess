// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/board-themes — the squares AND the piece inks of the flat board, as named palettes.
//
// ========================= WHY A THEME IS NOT JUST TWO SQUARES =========================
// It began as two colours and that was not enough to say what was being asked for. "The
// high-contrast colours of the 2D board" and "the high-contrast colours of the 2.5D board" have
// THE SAME SQUARES — #ABABAB and #5A5A5A, solved once for both — and differ entirely in the
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
//   contrast-*  searched, here and in palette.ts            #ABABAB / #5A5A5A
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
//  · Only the two high-contrast themes clear 3:1 on the FILLS. The other five are carried by the
//    rim, which is how the printed convention has always worked and what WCAG 1.4.11 actually
//    asks — that the boundary be perceivable, not the fill. (⚠️ It said FOUR until `cb-safe` was
//    added, which is how a count in a comment goes wrong: the new theme was measured, and the
//    sentence that totals the measurements was not.)
//  · ⚠️ AND EVERY BOARD'S TWO SQUARES CLEAR 3:1 AGAINST EACH OTHER. They share an edge along
//    their whole length — the largest boundary on the board — and every palette here was failing
//    it: chessboard.js 2.29, Wikipedia 1.94, XBoard 1.60, José 2.50, high contrast 2.13. A board
//    whose squares run together is not a board, and it is the first thing a person with low
//    vision feels.
//
//    ⚠️ THE THREE NAMED BOARDS ARE THEREFORE NO LONGER EXACT CITATIONS, and that is a real cost,
//    decided rather than overlooked. Their DARK square was deepened until the pair reached 3:1;
//    the light square, which is what makes a board recognisable, is untouched, and the hue of the
//    dark one is unchanged — only its lightness. The originals, for anyone who needs them back:
//
//      chessboard.js / lichess brown   #b58863  ->  #9C7555   (2.29 -> 3.01)
//      Wikipedia                       #d18b47  ->  #A36C37   (1.94 -> 3.06)
//      XBoard                          #77A26D  ->  #52704B   (1.60 -> 3.03)
//      José and José-2                 #8D8677  ->  #7D776A   (2.50 -> 3.07)
//
//    Lightening the light square instead was measured and rejected: chessboard.js would have
//    needed luminance 0.949, which is very nearly white and is a different board altogether.

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
    readonly light?: readonly [top: string, face: string, side: string];
    readonly dark?: readonly [top: string, face: string, side: string];
  };
  /**
   * ⚠️ THE STROKE THE PROJECTED BOARD OUTLINES A PIECE WITH, when it must differ from the inner
   * rim. On the flat board `whiteRim` and `blackRim` are drawn INSIDE a piece, with the silhouette
   * between them and the square; in Zdog there is no silhouette, so the stroke is the outermost
   * ink and it is the one that touches the square.
   *
   * That is not a detail: on the high-contrast boards a LIGHT stroke cannot touch these squares at
   * all — it would need luminance 1.32 and the maximum is 1 — so both strokes have to be black,
   * and the side a piece belongs to moves into the fill. Without this field the projected board
   * would inherit `blackRim`, which is a pale blue chosen for a job it does not do there.
   */
  readonly solidStroke?: { readonly light: string; readonly dark: string };
  /** No shading at all: a high-contrast palette has no luminance room for it. See palette.ts. */
  readonly flatSolid?: boolean;
}

const INK = { white: '#FFFFFF', black: '#000000', whiteRim: '#000000', blackRim: '#FFFFFF' };

export const BOARD_THEMES: readonly BoardTheme[] = [
  // ⚠️ THE DEFAULT, and it is one pair serving two names: lichess's "brown" board and
  // chessboard.js's default are the same #f0d9b5 / #b58863 — confirmed against
  // `niklasf/web-boardimage`'s `lichess-brown.json`, not remembered. It is very probably the board
  // a learner has already met, since it is what lichess shows before anyone changes anything.
  { key: 'brown', light: '#f0d9b5', dark: '#9C7555', ...INK, rim: '#17110a',     /*
     * ========================= ⚠️ THE PROJECTED BOARD CANNOT OUTLINE IN WHITE =========================
     * On the flat board the dark piece is black with a white line inside it, and the SILHOUETTE —
     * a third ink, outside both — is what meets the square. Zdog draws no silhouette: there the
     * stroke is the outermost ink, so the stroke is what has to clear 3:1 against both squares.
     *
     * White cannot. Measured on this board it is 1.37 against the light square, and no grey can do
     * it either: a stroke escaping BOTH squares needs luminance below 0.035 or above 2.24, and above 1
     * does not exist while below 0.035 collides with the 3:1 it owes the black filling underneath.
     *
     * So the stroke went black — which clears both squares easily — and the FILLING moved instead.
     * `#5A5A5A` is the darkest grey that still keeps 3:1 from that black stroke (3.04) and from
     * the white piece (6.90). The dark piece is therefore dark grey here and black on the flat
     * board, and that is a real difference between the two views, accepted rather than overlooked.
     */
    solidStroke: { light: '#000000', dark: '#000000' },
    solid: { dark: ['#5A5A5A', '#5A5A5A', '#5A5A5A'] },
    name: 'theme.brown', short: 'theme.short.brown' },
  { key: 'wikipedia', light: '#ffce9e', dark: '#A36C37', ...INK, rim: '#17110a',     /*
     * ========================= ⚠️ THE PROJECTED BOARD CANNOT OUTLINE IN WHITE =========================
     * On the flat board the dark piece is black with a white line inside it, and the SILHOUETTE —
     * a third ink, outside both — is what meets the square. Zdog draws no silhouette: there the
     * stroke is the outermost ink, so the stroke is what has to clear 3:1 against both squares.
     *
     * White cannot. Measured on this board it is 1.44 against the light square, and no grey can do
     * it either: a stroke escaping BOTH squares needs luminance below 0.029 or above 2.14, and above 1
     * does not exist while below 0.029 collides with the 3:1 it owes the black filling underneath.
     *
     * So the stroke went black — which clears both squares easily — and the FILLING moved instead.
     * `#5A5A5A` is the darkest grey that still keeps 3:1 from that black stroke (3.04) and from
     * the white piece (6.90). The dark piece is therefore dark grey here and black on the flat
     * board, and that is a real difference between the two views, accepted rather than overlooked.
     */
    solidStroke: { light: '#000000', dark: '#000000' },
    solid: { dark: ['#5A5A5A', '#5A5A5A', '#5A5A5A'] },
    name: 'theme.wikipedia', short: 'theme.short.wikipedia' },
  { key: 'xboard', light: '#C8C365', dark: '#52704B', ...INK, rim: '#17110a',     /*
     * ========================= ⚠️ THE PROJECTED BOARD CANNOT OUTLINE IN WHITE =========================
     * On the flat board the dark piece is black with a white line inside it, and the SILHOUETTE —
     * a third ink, outside both — is what meets the square. Zdog draws no silhouette: there the
     * stroke is the outermost ink, so the stroke is what has to clear 3:1 against both squares.
     *
     * White cannot. Measured on this board it is 1.83 against the light square, and no grey can do
     * it either: a stroke escaping BOTH squares needs luminance below 0.013 or above 1.67, and above 1
     * does not exist while below 0.013 collides with the 3:1 it owes the black filling underneath.
     *
     * So the stroke went black — which clears both squares easily — and the FILLING moved instead.
     * `#5A5A5A` is the darkest grey that still keeps 3:1 from that black stroke (3.04) and from
     * the white piece (6.90). The dark piece is therefore dark grey here and black on the flat
     * board, and that is a real difference between the two views, accepted rather than overlooked.
     */
    solidStroke: { light: '#000000', dark: '#000000' },
    solid: { dark: ['#5A5A5A', '#5A5A5A', '#5A5A5A'] },
    name: 'theme.xboard', short: 'theme.short.xboard' },
  {
    // The Hartwig palette, flat. Yellow against indigo separates by LUMINANCE at 8.91, which is
    // the argument `render/palette.ts` is built on and the reason it survives a CVD filter.
    key: 'jose',
    light: '#DCD6C8',
    dark: '#7D776A',
    white: '#FFE08A',
    black: '#3F2B78',
    whiteRim: '#3B2A12',
    /*
     * ⚠️ WHITE, and it has been three things. It was #0E0722, near-black on a #3F2B78 violet:
     * **1.71**, which is not a line, it is the same colour twice, and the dark pieces had no
     * crown and no collar. Then a lavender at 3.18, the least that cleared the floor. White is
     * 11.49 and it is simply the right answer — the stroke is drawn INSIDE the piece, so it never
     * meets a square and has nothing to lose by being bright.
     *
     * The old note here said a dark piece must be outlined in something darker than itself. That
     * rule is about the SILHOUETTE, which is still #0E0722 and still the outermost ink. It was
     * never about the stroke drawn inside the piece, and applying it there left the piece blank.
     */
    blackRim: '#FFFFFF',
    rim: '#0E0722',
    name: 'theme.jose',
    short: 'theme.short.jose',
    /*
     * ========================= ⚠️ THE DARK SIDE, OUTLINED IN BLACK =========================
     * Its projected stroke was the lavender inner rim, `#8C80AE`, and in Zdog the stroke is the
     * OUTERMOST ink — so that lavender was what met the square: 2.49 against the light one and
     * 1.23 against the dark. Neither is an edge.
     *
     * Black meets both at 14.50 and 4.72, and every other board here was moved to it for the same
     * reason. What that costs is the indigo: `#1E1140` against a black stroke is 1.34, so the
     * three planes had to come up until the darkest of them clears 3:1. `#6545C0` is the least
     * lift that does it (3.17) with the hue untouched, and the other two are placed to reproduce
     * THIS palette's own measured shading — 1.53 top-against-face and 1.43 face-against-side,
     * where the originals were 1.54 and 1.42.
     *
     * The LIGHT side keeps `#3B2A12`, because it already works: 9.50 and 3.09 against the two
     * squares. It is a very dark brown rather than black, and it is where the warmth of this
     * palette lives.
     */
    solidStroke: { light: '#3B2A12', dark: '#000000' },
    solid: {
      light: ['#FFE08A', '#E0A33A', '#B8781F'],
      dark: ['#9C88D7', '#7E63CA', '#6545C0'],
    },
  },
  /*
   * ========================= ⚠️ ONLY WHAT TOUCHES HAS TO CLEAR 3:1 =========================
   * Three wrong answers came before this one, and all three came from optimising the wrong set.
   * WCAG 1.4.11 is about a BOUNDARY being perceivable, and two colours that never meet have no
   * boundary between them. On this board:
   *
   *   TOUCHING          the two squares, along every edge of every square
   *                     the silhouette against each square — it is the outermost ink of a piece
   *                     the fill against the silhouette, and the inner stroke against the fill
   *   NOT TOUCHING      a piece's FILL against a square. The silhouette is always between them.
   *
   * The two squares touching is the one that matters most and the one every palette here was
   * failing. It is also the one a person with low vision feels first: a board whose squares run
   * together is not a board.
   *
   *   #8F8F8F / #5A5A5A   2.13   <- what shipped for months
   *   #9C9C9C / #545454   2.76   <- maximising the worst row, which was the wrong objective
   *   #ABABAB / #5A5A5A   3.00   <- every touching pair at 3:1 or better
   *
   * ⚠️ The DARK square is the original one. Only the light square moved, and that is the whole of
   * the fix: the earlier attempts kept darkening the dark square to buy square contrast, which
   * costs the silhouette its own 3:1 against it — the silhouette is black, so it has nowhere to
   * go. Lightening the light square costs only the light piece's fill against it, which is a pair
   * that never meets.
   *
   * What is left below 3:1 is exactly that: 2.30 between a light piece and the light square, and
   * 2.14 on the coloured palette. Neither is a boundary anybody looks at, because the silhouette
   * is drawn between them at 9.14:1.
   */
  /*
   * ========================= ⚠️ A COLOUR-BLIND-SAFE BOARD, AND WHY IT IS BLUE-GREY =========================
   * The honest first answer is that this project was already close: `render/palette.ts` argues that
   * the two sides are told apart by LUMINANCE and not by hue, "because hue pairs each fail under
   * one deficiency or another — red/green under protanopia and deuteranopia, blue/yellow under
   * tritanopia — while a luminance separation survives all of them".
   *
   * So this board is not a different idea; it is that idea taken all the way. What the wooden
   * boards keep is a WARM hue that carries some of the work, and warm hues are exactly the ones a
   * protanope loses. `xboard`'s green-and-yellow pair is the clearest case: two hues a deuteranope
   * reads as one, held apart only by whatever lightness they happen to differ by.
   *
   * SIMULATED, not assumed. Each pair was run through the standard dichromacy matrices and the
   * square-against-square ratio recomputed in each:
   *
   *                     normal   protan  deutan  tritan
   *   this board         3.03     3.01    3.04    3.01
   *
   * It barely moves, which is the point: nothing here is carried by hue, so nothing here is lost
   * when a hue is. Both squares are ONE hue at two lightnesses, so there is no hue pair left to
   * lose — and the hue is blue, which survives red-green deficiency, by far the commonest.
   *
   * ========================= ⚠️ AND THE HUES ARE OKABE-ITO NOW, BY NAME =========================
   * The Dev asked on 2026-10-04 whether this board should use the Okabe-Ito palette. It should
   * take its HUES from there, and it now does — but not its colours, and the difference is the
   * whole answer.
   *
   * Okabe-Ito is a QUALITATIVE palette: eight hues chosen so that eight CATEGORIES stay apart
   * under any dichromacy. It says nothing about luminance, because telling categories apart is not
   * what it is for. A board asks a different question — two surfaces sharing an edge, each owing
   * the other 3:1, with pieces standing on both — and measured, the palette cannot answer it:
   *
   *   ⚠️ OF THE 72 ORDERED PAIRS of its nine colours (the eight plus the grey published with
   *   them), NOT ONE clears squares 3:1, outline-against-dark 3:1 and the squares' own floor at
   *   the same time. The best square pair in the whole palette is sky-blue over blue at 2.25.
   *
   * So the same treatment the three named boards already got: keep the hue, move the lightness.
   *   light  #56B4E9 Okabe-Ito sky blue, lifted 2% to buy the margin -> #57B6EB
   *   dark   #0072B2 Okabe-Ito blue, deepened                        -> #005F94
   * What that buys is credit and recognition, which is why the other three are named here too.
   *
   * ⚠️ AND THE MARKERS ARE NOT THIS THEME'S TO FIX. Move-green and capture-red would be one colour
   * to a deuteranope; they are told apart by FORM — a dot against a ring — and `board-geometry.ts`
   * makes that argument. A theme that recoloured them would be solving, badly, a problem that was
   * already solved properly.
   */
  {
    // Measured: squares 3.03 (3.01/3.04/3.01 simulated), silhouette 9.30 and 3.06, pieces 21.
    /*
     * ========================= ⚠️ THE LIGHT SQUARE WAS #E3E6E8 UNTIL 2026-10-04 =========================
     * The Dev: "o tabuleiro seguro para daltonismo tem um contraste ruim entre as peças brancas e
     * as cores claras do tabuleiro." He is right, and this board was the SECOND WORST of the seven
     * on exactly that pair: 1.25, against 2.30 on «Preto & Branco».
     *
     * ⚠️ AND THE ARGUMENT THAT MADE IT SO IS WRITTEN A FEW LINES ABOVE THIS FILE. It says
     * lightening the light square "costs only the light piece's fill against it, which is a pair
     * that never meets". That is true of a BOUNDARY — the silhouette is always drawn between them,
     * and WCAG 1.4.11 asks for the boundary. It is not true of what a person sees. At #E3E6E8 the
     * white piece's whole body was the colour of the square under it, and the only thing saying
     * "piece" was a line around it. The outline is a line; the body is the shape.
     *
     * So the light square came down to meet the piece, and the dark square followed to keep the
     * squares' own 3:1.
     *
     *                      squares  outline/dark  white piece on light square
     *   #E3E6E8 / #4F6E8C     4.25          3.94          1.25
     *   #57B6EB / #005F94     3.03          3.06          2.26   <- this
     *
     * ⚠️ 2.26 IS NOT 3, AND IT CANNOT BE. With a single black outline the ceiling is 2.33, and the
     * proof is three lines: the outline owes the dark square 3:1, so the dark square's luminance is
     * at least 0.10; the squares owe each other 3:1, so the light square's is at least 0.40; a
     * white piece on that is at most 1.05/0.45. Every board in this file is under 3 on this pair
     * for that reason, and the best of them is 2.30. This board is now level with it instead of
     * half of it, and the cost is paid in margin — 4.25 squares down to 3.03 — rather than in
     * anything going under the floor.
     */
    key: 'cb-safe',
    light: '#57B6EB',
    dark: '#005F94',
    ...INK,
    rim: '#000000',
    /*
     * The projected board's constraint is the one `brown` states at length: Zdog draws no
     * silhouette, so the STROKE is the outermost ink and it owes 3:1 to both squares. Black clears
     * them at 9.30 and 3.06. The dark filling then moved to `#5A5A5A`, the darkest grey still
     * keeping 3:1 from that black stroke (3.04) — and it holds 6.90 from the white piece, which is
     * the distinction a chess player cannot afford to lose.
     */
    solidStroke: { light: '#000000', dark: '#000000' },
    solid: { dark: ['#5A5A5A', '#5A5A5A', '#5A5A5A'] },
    name: 'theme.cbsafe',
    short: 'theme.short.cbsafe',
  },
  {
    // Read by lightness. Squares 3.00, silhouette 9.14 and 3.04, pieces 21.
    key: 'contrast-flat',
    light: '#ABABAB',
    dark: '#5A5A5A',
    ...INK,
    rim: '#000000',
    /*
     * ========================= ⚠️ THE PROJECTED BOARD CANNOT OUTLINE IN WHITE =========================
     * On the flat board the dark piece is black with a white line inside it, and the SILHOUETTE —
     * a third ink, outside both — is what meets the square. Zdog draws no silhouette: there the
     * stroke is the outermost ink, so the stroke is what has to clear 3:1 against both squares.
     *
     * White cannot. Measured on this board it is 2.30 against the light square, and no grey can do
     * it either: a stroke escaping BOTH squares needs luminance below 0.0007 or above 1.32, and above 1
     * does not exist while below 0.0007 collides with the 3:1 it owes the black filling underneath.
     *
     * So the stroke went black — which clears both squares easily — and the FILLING moved instead.
     * `#5A5A5A` is the darkest grey that still keeps 3:1 from that black stroke (3.04) and from
     * the white piece (6.90). The dark piece is therefore dark grey here and black on the flat
     * board, and that is a real difference between the two views, accepted rather than overlooked.
     */
    solidStroke: { light: '#000000', dark: '#000000' },
    solid: { dark: ['#5A5A5A', '#5A5A5A', '#5A5A5A'] },
    name: 'theme.contrast1',
    short: 'theme.short.contrast1',
    flatSolid: true,
  },
  {
    // The same board for someone who reads hue faster than lightness: yellow against black, with
    // a light blue inner stroke so the dark piece has detail as well as an edge. The squares are
    // shared, because what constrains them — the silhouette, which is black in both — is shared.
    key: 'contrast-solid',
    light: '#ABABAB',
    dark: '#5A5A5A',
    white: '#FFFF00',
    /*
     * ⚠️ BLUE, not black, and this was an outright fault. The flat board drew a BLACK piece with
     * a BLUE outline while the projected board drew a blue piece with a black one — the same
     * palette, the same name, two different pieces, and the flat version had a bright blue line
     * around a black mass, which reads as neither colour.
     *
     * The blue is #3557A8, the tone the projected board already uses, so the two views finally
     * show the same piece. Against the yellow it is 6.35, and against its own white stroke 6.82.
     */
    black: '#3557A8',
    whiteRim: '#000000',
    /*
     * WHITE. The inner stroke never meets a square — the silhouette is between them — so it is
     * free to be the brightest thing available, and against this blue that is 6.82.
     */
    blackRim: '#FFFFFF',
    rim: '#000000',
    // Projected: both strokes black, because the stroke is what touches the square there. The
    // blue moves into the FILL, which never meets a square and is free to be a real blue — and
    // still clears 3.08 against its own black stroke, so the piece keeps its form.
    solidStroke: { light: '#000000', dark: '#000000' },
    solid: {
      light: ['#FFFF00', '#FFFF00', '#FFFF00'],
      dark: ['#3557A8', '#3557A8', '#3557A8'],
    },
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
