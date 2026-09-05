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

describe('[Projected] the stroke is what touches the square', () => {
  it('outlines both sides in something that clears 3:1 against both squares', () => {
    for (const key of CHANGED) {
      const theme = boardTheme(key);
      const p = projectedPalette(theme);
      for (const stroke of [p.lightPieces.stroke, p.darkPieces.stroke]) {
        for (const square of [p.squareLight, p.squareDark]) {
          expect(`${key} ${contrast(stroke, square).toFixed(2)}`)
            .toBe(`${key} ${Math.max(3, contrast(stroke, square)).toFixed(2)}`);
        }
      }
    }
  });

  it('keeps every plane of a piece 3:1 from its own stroke', () => {
    for (const key of CHANGED) {
      const p = projectedPalette(boardTheme(key));
      for (const side of [p.lightPieces, p.darkPieces]) {
        for (const plane of [side.top, side.face, side.side]) {
          expect(`${key} ${contrast(plane, side.stroke).toFixed(2)}`)
            .toBe(`${key} ${Math.max(3, contrast(plane, side.stroke)).toFixed(2)}`);
        }
      }
    }
  });

  it('still tells the two sides apart', () => {
    for (const key of CHANGED) {
      const p = projectedPalette(boardTheme(key));
      expect(contrast(p.lightPieces.top, p.darkPieces.top)).toBeGreaterThanOrEqual(3);
    }
  });

  it('takes the darkest grey the rules allow, and not a lighter one', () => {
    // ⚠️ The request was "the darkest grey that keeps both 3:1", so this is the rule and not a
    // taste: one step darker than #5A5A5A falls under 3:1 against the black stroke.
    for (const key of CHANGED) {
      const p = projectedPalette(boardTheme(key));
      expect(p.darkPieces.top).toBe('#5A5A5A');
      expect(contrast('#595959', '#000000')).toBeLessThan(3);
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
