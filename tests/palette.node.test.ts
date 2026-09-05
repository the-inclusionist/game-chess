// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTE, HIGH_CONTRAST_PALETTE, type Palette,
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

/** Every fill a piece presents against every square it can stand on. */
function pieceAgainstSquare(palette: Palette): number[] {
  const fills = [
    palette.lightPieces.top, palette.lightPieces.face, palette.lightPieces.side,
    palette.darkPieces.top, palette.darkPieces.face, palette.darkPieces.side,
  ];
  return fills.flatMap((fill) => [
    contrast(fill, palette.squareLight),
    contrast(fill, palette.squareDark),
  ]);
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

  it('puts every piece fill at 3:1 or better against BOTH squares', () => {
    for (const ratio of pieceAgainstSquare(p)) expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it('separates the two sides far past the floor', () => {
    // The reason the mode exists at all: whose piece is that. 7:1 is the AAA text floor, quoted
    // here because it is the threshold this pair was checked against when it was chosen.
    expect(contrast(p.lightPieces.top, p.darkPieces.top)).toBeGreaterThanOrEqual(7);
  });

  it('keeps the sides in the game colours rather than in one ink', () => {
    // The failure being guarded: white outlined in black beside black outlined in white reads as
    // the same two inks twice. Each side must be identifiable by its FILL, not by its outline.
    const light = p.lightPieces.top;
    const dark = p.darkPieces.top;
    expect(contrast(light, dark)).toBeGreaterThanOrEqual(7);
    expect([light, dark]).not.toContain('#FFFFFF');
    expect([light, dark]).not.toContain('#000000');
    // And each outline must still be the strongest ink available against its own fill.
    expect(contrast(p.lightPieces.stroke, light)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.darkPieces.stroke, dark)).toBeGreaterThanOrEqual(7);
  });

  it('is flat by necessity, not by oversight', () => {
    // Recorded as arithmetic in palette.ts: a shaded face cannot clear 3:1 against the light
    // square once the top does, because the top is already at the ceiling the square imposes.
    for (const side of [p.lightPieces, p.darkPieces]) {
      expect(new Set([side.top, side.face, side.side]).size).toBe(1);
    }
    const ceiling = (luminance(p.lightPieces.top) + 0.05) / 3 - 0.05;
    expect(luminance(p.squareLight)).toBeLessThanOrEqual(ceiling);
  });

  it('accepts a square pair under the floor, and says how far under', () => {
    // Not a pass — an acceptance, recorded so it cannot quietly get worse. Four tones cannot
    // satisfy all six pairs, and a square is identified by where it is.
    const squares = contrast(p.squareLight, p.squareDark);
    expect(squares).toBeLessThan(3);
    expect(squares).toBeGreaterThan(1.8);
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
