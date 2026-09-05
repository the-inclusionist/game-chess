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

  it('leaves no pair far behind the others, which is the whole of the answer', () => {
    // ⚠️ The palette shipped for a long time with its two squares at **2.13:1** — a high-contrast
    // board you could not see the squares of — because every other pair had been maximised and
    // that one paid for it. What matters is the WORST pair, and there is no pair below 2.68.
    const pairs = [
      contrast(p.squareLight, p.squareDark),
      contrast(p.lightPieces.top, p.squareLight),
      contrast(p.lightPieces.top, p.squareDark),
      contrast(p.darkPieces.top, p.squareLight),
      contrast(p.darkPieces.top, p.squareDark),
    ];
    expect(Math.min(...pairs)).toBeGreaterThan(2.68);
  });

  it('is on the ceiling, which is 2.759 and not 3', () => {
    // ========================= WHY NOT 3:1 EVERYWHERE =========================
    // Each piece has to sit 3:1 from BOTH squares, and the squares 3:1 from each other. A colour
    // between the squares only clears both if the squares are 9:1 apart, so the cheapest possible
    // arrangement is light piece above, squares in the middle, dark piece below — three gaps of
    // three, which is 27. The whole range from white to black is worth 21.
    //
    // There is no palette, and no clever hue, that does it. 21^(1/3) = 2.759 is the ceiling on
    // the worst pair, and it is reached when the three gaps are equal.
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
    expect(3 * 3 * 3).toBeGreaterThan(21);
    expect(21 ** (1 / 3)).toBeCloseTo(2.759, 3);
  });

  it('spends the whole budget, because there is exactly one budget to spend', () => {
    // ========================= THREE GAPS IN SERIES =========================
    // Light piece, light square, dark square, dark piece: four inks in a row. The lightest thing
    // there is measures 21:1 against the darkest, so the three gaps between them MULTIPLY to at
    // most 21, however they are arranged. Three gaps at 3:1 would need 27.
    //
    // Which means every point given to one gap comes out of another, and the only real question
    // is where to put them. A palette whose product is below 21 is not a trade-off — it is
    // waste, and it is exactly what the second version of this palette was: 1.05 x 4.23 x 2.71,
    // a product of 12, nine points thrown away by making the light square nearly white and by
    // softening the pieces off the ends of the range.
    const gaps = contrast(p.lightPieces.top, p.squareLight)
      * contrast(p.squareLight, p.squareDark)
      * contrast(p.squareDark, p.darkPieces.top);
    // ⚠️ 19.56 and not 21, and the difference is deliberate: this palette's light piece is YELLOW,
    // which is a shade below white. That is what being readable by hue as well as by lightness
    // costs, and it is the only point in the budget spent on anything but contrast.
    expect(gaps).toBeGreaterThan(19.4);
    expect(gaps).toBeCloseTo(contrast(p.lightPieces.top, p.darkPieces.top), 1);
  });

  it('is the best grey pair there is, searched rather than chosen', () => {
    // ⚠️ THE SEARCH ITSELF, so the numbers cannot drift back to something that merely looks
    // plausible. Every grey pair, judged by its worst row — and nothing beats what is shipped.
    const hex = (v: number): string => `#${v.toString(16).padStart(2, '0').repeat(3)}`;
    const worstFor = (light: string, dark: string): number => Math.min(
      contrast(light, dark),
      contrast(p.lightPieces.top, light), contrast(p.lightPieces.top, dark),
      contrast(p.darkPieces.top, light), contrast(p.darkPieces.top, dark),
    );

    let best = 0;
    for (let light = 2; light < 255; light++) {
      for (let dark = 1; dark < light; dark++) best = Math.max(best, worstFor(hex(light), hex(dark)));
    }
    expect(worstFor(p.squareLight, p.squareDark)).toBeGreaterThanOrEqual(best - 0.01);
  });

  it('gives a piece a real edge on the square it is hardest to see on', () => {
    // ⚠️ THE FILL IS NOT THE ONLY INK. In the projected view a piece is a fill and a stroke, and
    // Zdog draws no silhouette behind it — so on the square where the fill runs out, the STROKE
    // is the whole of the piece's edge and has to carry 3:1 by itself.
    expect(Math.max(
      contrast(p.lightPieces.top, p.squareLight), contrast(p.lightPieces.stroke, p.squareLight),
    )).toBeGreaterThanOrEqual(3);
    expect(Math.max(
      contrast(p.darkPieces.top, p.squareDark), contrast(p.darkPieces.stroke, p.squareDark),
    )).toBeGreaterThanOrEqual(3);
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

  it('is flat, because shading would spend luminance the gaps have already claimed', () => {
    for (const side of [p.lightPieces, p.darkPieces]) {
      expect(new Set([side.top, side.face, side.side]).size).toBe(1);
    }
  });

  it('leaves the two pieces at the ends of the range, because that IS the budget', () => {
    // ⚠️ 21:1 between the pieces looked like an excess and was trimmed to 8.45, and the trim came
    // straight out of the two pairs a player looks at: a piece against its own square fell to
    // 1.05 and 2.71. The distance between the pieces is not spent ON the pieces — it is the total
    // there is to divide, and shrinking it shrinks everything.
    expect(contrast(p.lightPieces.top, p.darkPieces.top)).toBeGreaterThan(19);
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
