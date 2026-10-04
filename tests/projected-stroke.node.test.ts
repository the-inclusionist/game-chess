// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE PROJECTED BOARD CANNOT OUTLINE IN WHITE =========================
// On the flat board a piece has three inks and the SILHOUETTE is what meets the square. Zdog draws
// no silhouette: there the stroke is the outermost ink, so the stroke is what a square meets — and
// a white stroke on a black piece, which is exactly what these themes ask for on the flat board,
// measures between 1.37 and 2.30 against their light squares.
//
// No grey fixes it either, and that is the finding worth keeping: a stroke has to escape BOTH
// squares, which means going below the darker one or above the lighter one, and the second is
// above luminance 1 while the first collides with the 3:1 the stroke owes the black filling.
//
// So the stroke went black and the FILLING moved. These tests pin both halves.
import { describe, expect, it } from 'vitest';
import { luminance } from '../app/js/ui/contrast-report.ts';
import { boardTheme } from '../app/js/ui/board-themes.ts';
import { projectedPalette } from '../app/js/render/palette.ts';

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** The four the change was asked for. José keeps its own answer; alto contraste 2 already had one. */
const CHANGED = ['brown', 'wikipedia', 'xboard', 'contrast-flat'];

/*
 * ========================= ⚠️ THERE ARE TWO WAYS TO HAVE AN EDGE, NOT ONE =========================
 * This file pinned one of them: a stroke that clears both squares, and a filling that clears the
 * stroke. The Dev, 2026-10-04: "no alto contraste Preto e Branco não há contraste entre peças
 * pretas e casas pretas em 2.5D e 3D."
 *
 * He was right, and the rule above is what allowed it. On that board the filling was #5A5A5A and
 * so was the dark SQUARE — the same ink, 1.00 — and every assertion here was green, because none
 * of them ever compared the filling to the square it stands on. The set that was optimised was
 * filling-against-stroke.
 *
 * So the rule is a disjunction. A piece is delimited if EITHER
 *   (a) its own filling clears 3:1 against both squares — then it needs no stroke at all, and a
 *       stroke the same colour as the filling is simply invisible, which is fine; or
 *   (b) its stroke clears 3:1 against both squares AND the filling clears 3:1 against the stroke.
 * (a) is strictly better where it is reachable, because what a player looks at is the SHAPE. On
 * these boards it is reachable only for the dark piece on «Preto & Branco», where black is 3.04
 * and 9.14 against the two squares; the wooden boards have no ink that escapes both, which is
 * what the last test in this file proves and why they keep (b).
 */
const delimited = (
  key: string,
  side: { top: string; face: string; side: string; stroke: string },
  squares: readonly [string, string],
): string => {
  const byFill = squares.every((sq) => contrast(side.top, sq) >= 3);
  if (byFill) return `${key} ok`;
  const byStroke = squares.every((sq) => contrast(side.stroke, sq) >= 3)
    && [side.top, side.face, side.side].every((p) => contrast(p, side.stroke) >= 3);
  return byStroke ? `${key} ok` : `${key} the piece has no edge against the squares`;
};

describe('[Projected] the stroke is what touches the square', () => {
  it('gives each piece ONE ink that clears both squares — stroke or fill', () => {
    /*
     * ⚠️ THIS SAID «BOTH STROKES CLEAR BOTH SQUARES» UNTIL 2026-10-04, and that was the special
     * case where the fill could not carry it. On the three boards whose dark piece is now black,
     * the fill clears both squares and the stroke is WHITE — 2.30 against the light square, which
     * the old assertion read as a failure and which is simply the mirror of the light piece, whose
     * white FILL is 2.30 against that same square.
     *
     *                         fill/stroke  fill on light  fill on dark  stroke on light  on dark
     *   dark piece  ■ + white       21.00           9.14          3.04             2.30     6.90
     *   light piece □ + black       21.00           2.30          6.90             9.14     3.04
     */
    for (const key of CHANGED) {
      const p = projectedPalette(boardTheme(key));
      for (const side of [p.lightPieces, p.darkPieces]) {
        const clears = (ink: string): boolean =>
          contrast(ink, p.squareLight) >= 3 && contrast(ink, p.squareDark) >= 3;
        expect(`${key} ${clears(side.stroke) || clears(side.top)}`).toBe(`${key} true`);
      }
    }
  });

  it('⚠️ and a fill is NEVER the colour of the outline around it', () => {
    /*
     * The Dev, 2026-10-04: "nem as peças nem o tabuleiro podem ser preto propriamente dito, pois
     * preto já é o contorno e é preciso haver contraste com o contorno."
     *
     * He is answering a black filling inside a black stroke, which I had argued for an hour
     * earlier: "a piece does not need an edge when it is already 3:1 from everything it stands
     * on". What that threw away is that the edge is not only a boundary against the square — it is
     * the piece's own drawing, the line that says crown and collar, and a child learning the
     * pieces reads shapes.
     */
    for (const key of ['brown', 'wikipedia', 'xboard', 'jose', 'cb-safe', 'cb-warm',
                       'contrast-flat', 'contrast-solid']) {
      const p = projectedPalette(boardTheme(key));
      for (const side of [p.lightPieces, p.darkPieces]) {
        for (const plane of [side.top, side.face, side.side]) {
          expect(`${key} ${contrast(plane, side.stroke).toFixed(2)}`)
            .toBe(`${key} ${Math.max(3, contrast(plane, side.stroke)).toFixed(2)}`);
        }
      }
    }
  });

  it('gives every piece an edge, by its filling or by its stroke', () => {
    for (const key of CHANGED) {
      const p = projectedPalette(boardTheme(key));
      for (const side of [p.lightPieces, p.darkPieces]) {
        expect(delimited(key, side, [p.squareLight, p.squareDark])).toBe(`${key} ok`);
      }
    }
  });

  it('⚠️ and NO filling is ever the colour of the square it stands on', () => {
    // The Dev's report of 2026-10-04, as the one line that would have caught it. 1.5 rather than
    // 3: a filling below the floor may be carried by a stroke, but a filling at the SAME ink as
    // the square is not carried by anything — there is no shape left, only an outline.
    // ⚠️ `cb-safe` AND `cb-warm` ARE NOT IN THIS LIST and the test below says why: on those two
    // the Dev asked for the opposite thing first, and the two requests point in opposite
    // directions along one curve.
    for (const key of ['brown', 'wikipedia', 'xboard', 'jose', 'contrast-flat', 'contrast-solid']) {
      const p = projectedPalette(boardTheme(key));
      for (const [side, square] of [
        [p.lightPieces, p.squareLight], [p.darkPieces, p.squareDark],
        [p.lightPieces, p.squareDark], [p.darkPieces, p.squareLight],
      ] as const) {
        expect(`${key} ${contrast(side.top, square) > 1.05}`).toBe(`${key} true`);
      }
    }
  });

  it('still tells the two sides apart', () => {
    for (const key of CHANGED) {
      const p = projectedPalette(boardTheme(key));
      expect(contrast(p.lightPieces.top, p.darkPieces.top)).toBeGreaterThanOrEqual(3);
    }
  });

  it('takes the darkest grey the rules allow, on the boards still carried by a stroke', () => {
    // ⚠️ The request was "the darkest grey that keeps both 3:1", so this is the rule and not a
    // taste: one step darker than #5A5A5A falls under 3:1 against the black stroke.
    // ⚠️ `side`, NOT `top`, SINCE 2026-10-04: the dark piece stopped being one grey repeated three
    // times and became three planes, so the grey the rule produces is now the DARKEST of them.
    for (const key of ['brown', 'wikipedia', 'xboard']) {
      expect(projectedPalette(boardTheme(key)).darkPieces.side).toBe('#5A5A5A');
    }
    expect(contrast('#595959', '#000000')).toBeLessThan(3);
  });

  it('⚠️ on «Preto & Branco» the SQUARES moved instead, to the point where the curve crosses', () => {
    /*
     * That grey used to BE this board's dark square — #5A5A5A on #5A5A5A, 1.00, the Dev's report.
     * Two answers were tried on the piece and both were sent back: a black filling (no edge left
     * inside the shape) and then a white stroke on it (2.30 against the light square). His third
     * instruction was to leave the pieces alone and move the board: "mudar a cor das casas do
     * tabuleiro para conseguir um contraste melhor ao invés das peças."
     *
     * Both pieces are fixed — white, and the darkest grey that clears its black stroke — so the
     * squares trade one weak pair against the other along a single curve. #767676/#D2D2D2 is
     * where it crosses itself: the two weak pairs are equal, which is the one place the WORST of
     * them is as good as a square pair can make it.
     */
    const theme = boardTheme('contrast-flat');
    const p = projectedPalette(theme);
    // ⚠️ Still ONE grey on this board, where the other five got three planes: see the note in
    // `board-themes.ts` — shading needs room, and a high-contrast palette spends its room on
    // telling the two sides apart.
    expect(p.darkPieces.top).toBe('#5A5A5A');
    expect(p.darkPieces.side).toBe('#5A5A5A');
    const weakDark = contrast(p.darkPieces.top, theme.dark);
    const weakLight = contrast(p.lightPieces.top, theme.light);
    expect(weakDark).toBeGreaterThan(1.4);
    expect(weakLight).toBeGreaterThan(1.4);
    // Balanced to within a rounding step of each other: that is the maximin, not a coincidence.
    expect(Math.abs(weakDark - weakLight)).toBeLessThan(0.05);
    // ⚠️ AND BOTH CROSS PAIRS CLEAR THE FLOOR, which is what the board buys with it: each piece is
    // unmistakable on half the squares and carried by its stroke on the other half.
    expect(contrast(p.darkPieces.top, theme.light)).toBeGreaterThanOrEqual(3);
    expect(contrast(p.lightPieces.top, theme.dark)).toBeGreaterThanOrEqual(3);
  });

  it('⚠️ and 3:1 on BOTH is impossible on any board here — the proof, not an apology', () => {
    /*
     * The stroke must escape both squares, so it is black (nothing above luminance 1 exists), so
     * the dark square is at least 0.10 or the stroke has no edge against it. The dark piece must
     * escape that same black stroke, so it is at least 0.10 too. For it to ALSO clear the dark
     * square by 3:1 the square would need 0.405 or more — and the squares' own 3:1 would then put
     * the light square past 1.3, where 1 is the maximum a screen has.
     *
     * Every palette in this file therefore has two pairs its silhouette carries. What a board can
     * choose is WHERE on the curve to sit, not whether to be on it.
     */
    const floorForStroke = 3 * 0.05 - 0.05;            // 0.10: what black needs from a square
    const neededBySquare = 3 * (floorForStroke + 0.05) - 0.05;   // 0.40: what the fill would need
    const thenTheLightSquare = 3 * (neededBySquare + 0.05) - 0.05;
    expect(thenTheLightSquare).toBeGreaterThan(1);
    for (const key of ['brown', 'wikipedia', 'xboard', 'jose', 'cb-safe', 'cb-warm',
                       'contrast-flat', 'contrast-solid']) {
      const theme = boardTheme(key);
      const p = projectedPalette(theme);
      expect(`${key} ${contrast(p.darkPieces.top, theme.dark) < 3}`).toBe(`${key} true`);
    }
  });

  it('⚠️ the two «Seguro para daltonismo» boards sit at the OTHER end of that curve, by request', () => {
    /*
     * Their dark piece measures 1.01 against their dark square — the number the Dev reported on
     * «Preto & Branco». It is a decision, not an oversight, and the decision is also his: earlier
     * the same day he reported the opposite end of the same curve on these two boards — "o
     * tabuleiro seguro para daltonismo tem um contraste ruim entre as peças brancas e as cores
     * claras do tabuleiro" — and the light square came DOWN to 2.26 to answer it.
     *
     * The curve has one lever. Moving the dark square up far enough to show a grey piece forces
     * the light square up with it, and the white piece loses exactly what it just gained. These
     * two boards are at the end he asked for, by name, first.
     *
     * ⚠️ AND IT IS TIGHTER HERE THAN ON «Preto & Branco», because their dark square sits at the
     * black stroke's own floor: there is no room at all, not a worse trade.
     */
    for (const key of ['cb-safe', 'cb-warm']) {
      const theme = boardTheme(key);
      const p = projectedPalette(theme);
      // The end that was asked for, and is held.
      expect(`${key} ${contrast(p.lightPieces.top, theme.light) > 2.1}`).toBe(`${key} true`);
      // The dark square is at the floor the black stroke puts under it: 0.10, give or take a byte.
      expect(`${key} ${luminance(theme.dark) < 0.12}`).toBe(`${key} true`);
      // So the stroke does the delimiting for the dark piece, as on every board in this file.
      expect(contrast(p.darkPieces.stroke, theme.dark)).toBeGreaterThanOrEqual(3);
      expect(contrast(p.darkPieces.top, p.darkPieces.stroke)).toBeGreaterThanOrEqual(3);
    }
  });

  it('shows why white was impossible, so nobody puts it back', () => {
    for (const key of CHANGED) {
      const theme = boardTheme(key);
      // What white does against the light square on each of these boards.
      expect(contrast('#FFFFFF', theme.light)).toBeLessThan(3);
      // And why no grey rescues it: below the dark square is under the filling's own floor,
      // and above the light square is past luminance 1.
      const below = (luminance(theme.dark) + 0.05) / 3 - 0.05;
      const above = 3 * (luminance(theme.light) + 0.05) - 0.05;
      const floor = 3 * 0.05 - 0.05;
      expect(below).toBeLessThan(floor);
      expect(above).toBeGreaterThan(1);
    }
  });

  it('leaves the FLAT board alone: there the dark piece is still black', () => {
    // The silhouette does the work on that board, so nothing there had to move.
    for (const key of CHANGED) expect(boardTheme(key).black).toBe('#000000');
  });
});
