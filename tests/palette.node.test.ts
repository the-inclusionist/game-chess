// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTE, HIGH_CONTRAST_PALETTE,
} from '../app/js/render/palette.ts';

// ========================= WHY THIS TEST EXISTS =========================
// `palette.ts` carries a table of contrast ratios, and the file itself records what happened the
// last time it carried one: a set of rows describing an outline that was never drawn, asserted
// across several commits and false the whole time. A number in a comment is a claim nobody checks.
//
// So the ratios are COMPUTED here from the colours the renderer actually uses. The point is not to
// pin the exact digits — it is that the floor of WCAG 1.4.11 is a floor, and that the one
// distinction chess cannot lose is which side a piece belongs to.

/** sRGB relative luminance, WCAG 2.x §relative-luminance. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channel = (offset: number): number => {
    const c = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}


describe('[Contrast] the measuring instrument agrees with the standard', () => {
  it('gives the two ratios everyone knows', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 4);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 4);
  });

  it('does not care which colour is named first', () => {
    expect(contrast('#001040', '#8F8F8F')).toBeCloseTo(contrast('#8F8F8F', '#001040'), 6);
  });
});

describe('[Contrast] high contrast clears the WCAG 1.4.11 floor everywhere it must', () => {
  const p = HIGH_CONTRAST_PALETTE;

  it('puts the SQUARES at 3:1, which is the rule this whole mode exists for', () => {
    // ⚠️ THIS IS THE TEST THAT WAS MISSING, and its absence is why the palette shipped at
    // **2.13:1** between its own two squares. The mode is called high contrast; the first thing
    // it has to deliver is a board you can see the squares of.
    expect(contrast(p.squareLight, p.squareDark)).toBeGreaterThanOrEqual(3);
  });

  it('gives every piece a boundary on every square, by its fill OR by its stroke', () => {
    // 1.4.11 asks that the BOUNDARY be perceivable, not that the fill be. On a light square a
    // dark piece is bounded by its own fill; on a dark square a light piece is. Each of the four
    // combinations needs one of the two to hold, and each one has it.
    const pairs: [string, string, string][] = [
      [p.lightPieces.top, p.lightPieces.stroke, p.squareLight],
      [p.lightPieces.top, p.lightPieces.stroke, p.squareDark],
      [p.darkPieces.top, p.darkPieces.stroke, p.squareLight],
      [p.darkPieces.top, p.darkPieces.stroke, p.squareDark],
    ];
    for (const [fill, stroke, square] of pairs) {
      expect(Math.max(contrast(fill, square), contrast(stroke, square)))
        .toBeGreaterThanOrEqual(3);
    }
  });

  it('separates the two sides far past the floor', () => {
    // The reason the mode exists at all: whose piece is that. 7:1 is the AAA text floor, quoted
    // here because it is the threshold this pair was checked against when it was chosen.
    expect(contrast(p.lightPieces.top, p.darkPieces.top)).toBeGreaterThanOrEqual(7);
  });

  it('names each side with the ink that COVERS it, which is the stroke', () => {
    // Measured on a rendered board: about two thirds of a piece's pixels are stroke, because the
    // stroke is 1.5 units and a bishop arm is 3.3. So the side a player sees is the side the
    // STROKE says, and the two strokes have to be told apart before anything else.
    expect(p.lightPieces.stroke).not.toBe(p.darkPieces.stroke);
    expect(contrast(p.lightPieces.stroke, p.darkPieces.stroke)).toBeGreaterThanOrEqual(7);
    // The specific failure that was reported: a dark piece drawn mostly in white ink.
    expect(p.darkPieces.stroke).not.toBe('#FFFFFF');
    const blue = p.darkPieces.stroke;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(blue.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
  });

  it('still separates the two fills, and each stroke from the fill it outlines', () => {
    expect(contrast(p.lightPieces.top, p.darkPieces.top)).toBeGreaterThanOrEqual(7);
    // 7:1 is the AAA text ratio, quoted because it is the bar these two pairs were chosen against.
    expect(contrast(p.lightPieces.stroke, p.lightPieces.top)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.darkPieces.stroke, p.darkPieces.top)).toBeGreaterThanOrEqual(7);
  });

  it('is flat, because the whole budget went on the boundaries', () => {
    for (const side of [p.lightPieces, p.darkPieces]) {
      expect(new Set([side.top, side.face, side.side]).size).toBe(1);
    }
  });

  it('proves the two demands cannot both be met, so nobody quietly re-swaps them', () => {
    // ⚠️ THE ARITHMETIC, kept as a test because it is the reason this palette looks the way it
    // does and the reason someone will one day try to "fix" it back.
    //
    // The lightest piece there is, is white, luminance 1. For it to clear 3:1 against the light
    // square:            (1 + 0.05) / (Ll + 0.05) >= 3   =>   Ll <= 0.300
    // The darkest piece there is, is black, luminance 0. Against the dark square:
    //                    (Ld + 0.05) / 0.05 >= 3         =>   Ld >= 0.100
    // And for the squares to clear 3:1 against each other, with Ll at its ceiling:
    //                    (0.30 + 0.05) / (Ld + 0.05) >= 3  =>  Ld <= 0.067
    //
    // 0.100 <= Ld <= 0.067 has no solutions. Squares at 3:1 AND both fills at 3:1 against both
    // squares is not a palette anyone failed to find; it does not exist. The old palette chose
    // the fills and left the squares at 2.13:1. This one chooses the squares, which is what the
    // mode is named after, and lets the stroke carry the boundary where the fill cannot.
    const lightestSquare = 1.05 / 3 - 0.05;
    const darkestSquareForBlackPiece = 3 * 0.05 - 0.05;
    const darkestSquareForContrast = (lightestSquare + 0.05) / 3 - 0.05;
    expect(darkestSquareForContrast).toBeLessThan(darkestSquareForBlackPiece);
  });

  it('spends what it needs on the pieces and no more', () => {
    // 21:1 is what black on white costs, and nothing asks for it: a piece has to be unmistakably
    // not the other piece, which is 3:1, not maximally different from it, which is tiring to look
    // at for a whole game. The room saved is the room the squares now have.
    const sides = contrast(p.lightPieces.top, p.darkPieces.top);
    expect(sides).toBeGreaterThanOrEqual(7);
    expect(sides).toBeLessThan(14);
  });
});

describe('[Contrast] the default palette, measured rather than described', () => {
  const p = DEFAULT_PALETTE;

  it('separates the two sides at the floor or better', () => {
    expect(contrast(p.lightPieces.top, p.darkPieces.top)).toBeGreaterThanOrEqual(3);
  });

  it('still shades: top against front is wide enough to read as two planes', () => {
    // 1.18 was measured and rejected — two neighbouring planes fuse below about 1.5.
    expect(contrast(p.lightPieces.top, p.lightPieces.face)).toBeGreaterThanOrEqual(1.5);
    expect(contrast(p.darkPieces.top, p.darkPieces.face)).toBeGreaterThanOrEqual(1.5);
  });

  it('has light fills that do NOT clear the floor against a light square', () => {
    // The debt this file names out loud, asserted so nobody later reads the table as a pass.
    // What carries it is the outline, and the high-contrast mode is the way out.
    expect(contrast(p.lightPieces.top, p.squareLight)).toBeLessThan(3);
    expect(contrast(p.lightPieces.stroke, p.squareLight)).toBeGreaterThanOrEqual(3);
  });
});
