// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTE, HIGH_CONTRAST_PALETTE, MARKER_CAPTURE, MARKER_CHECK, MARKER_CURSOR,
  MARKER_HINT, MARKER_LESSON, MARKER_LESSON_HALO, MARKER_MOVE, MARKER_SELECTED,
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

describe('[Contrast] the lesson mark, which is the one marker that was measured', () => {
  /*
   * ========================= ⚠️ THE PLAN ASKED FOR SOMETHING IMPOSSIBLE =========================
   * It said the lesson mark should clear 3:1 against `squareLight` and `squareDark`, in the
   * default palette and in the high-contrast one. Measuring it is what showed there is no such
   * colour — the same wall `HINT_RAMP` hit, reached from the other side.
   *
   * Clearing 3:1 against `#DCD6C8` needs luminance at most 0.193. Clearing it against the
   * high-contrast `#5A5A5A` needs at least 0.407, or else at most 0.0007, which is black. The two
   * ranges do not overlap. So the boundary is carried by a black halo, and the amber only has to
   * be legible against the halo — which is exactly what `HIGH_CONTRAST_PALETTE` concluded for the
   * piece strokes, independently.
   */
  const SQUARES: [string, string][] = [
    ['casa clara', DEFAULT_PALETTE.squareLight],
    ['casa escura', DEFAULT_PALETTE.squareDark],
    ['casa clara, alto contraste', HIGH_CONTRAST_PALETTE.squareLight],
    ['casa escura, alto contraste', HIGH_CONTRAST_PALETTE.squareDark],
  ];

  it('⚠️ puts the HALO at 3:1 against every square this game can draw', () => {
    // The halo is the boundary, so the halo is what 1.4.11 is about. The worst case is 3.04, on
    // the high-contrast dark grey — which is why this ink is black and not merely dark.
    for (const [name, square] of SQUARES) {
      const ratio = contrast(MARKER_LESSON_HALO, square);
      expect(`${name}: ${ratio >= 3}`).toBe(`${name}: true`);
    }
  });

  it('keeps the amber legible against its own halo, so the mark is a shape and not a blob', () => {
    expect(contrast(MARKER_LESSON, MARKER_LESSON_HALO)).toBeGreaterThanOrEqual(3);
  });

  it('⚠️ does not pretend the hue itself carries the boundary', () => {
    /*
     * Asserted rather than merely written down, because it is the thing a later reader will try to
     * "fix" by deleting the halo. The amber fails against three of the four squares, and that is
     * fine ONLY because the halo is there.
     */
    const failures = SQUARES.filter(([, square]) => contrast(MARKER_LESSON, square) < 3);
    expect(failures.length).toBeGreaterThan(0);
  });

  it('does not reuse a hue the game has already spent', () => {
    // Six states are taken — move, capture, check, selected, cursor, hint — and a seventh that
    // borrowed one would look like something the player had done rather than something the lesson
    // is saying.
    const taken = [
      MARKER_MOVE, MARKER_CAPTURE, MARKER_CHECK, MARKER_SELECTED, MARKER_CURSOR, MARKER_HINT,
    ];
    for (const other of taken) {
      expect(`${other} vs lesson: ${other === MARKER_LESSON}`).toBe(`${other} vs lesson: false`);
    }
  });
});

describe('[Contrast] high contrast: every pair that TOUCHES clears the floor', () => {
  const p = HIGH_CONTRAST_PALETTE;

  /*
   * ========================= ⚠️ WHAT TOUCHES WHAT =========================
   * Three wrong answers came before this one and all three optimised the wrong set. 1.4.11 is
   * about a BOUNDARY being perceivable, and two colours that never meet have no boundary.
   *
   * In the projected view a piece is two inks: a fill and a stroke, and Zdog draws the stroke
   * OUTSIDE the fill. So the stroke is what a square meets. The fill never does.
   */
  const touching: [string, string, string][] = [
    ['as duas casas', p.squareLight, p.squareDark],
    ['contorno claro x casa clara', p.lightPieces.stroke, p.squareLight],
    ['contorno claro x casa escura', p.lightPieces.stroke, p.squareDark],
    ['contorno escuro x casa clara', p.darkPieces.stroke, p.squareLight],
    ['contorno escuro x casa escura', p.darkPieces.stroke, p.squareDark],
    ['preenchimento claro x seu contorno', p.lightPieces.top, p.lightPieces.stroke],
    ['preenchimento escuro x seu contorno', p.darkPieces.top, p.darkPieces.stroke],
  ];

  it('clears 3:1 on every pair that shares an edge', () => {
    for (const [, a, b] of touching) expect(contrast(a, b)).toBeGreaterThanOrEqual(3);
  });

  it('puts the SQUARES at 3:1, which is the pair a low-vision player feels first', () => {
    // ⚠️ THE ONE THAT WAS WRONG FOR MONTHS, at 2.13:1. The squares share an edge along their
    // whole length and are the largest boundary on the board; a board whose squares run together
    // is not a board. Every other attempt at this palette bought something else with it.
    expect(contrast(p.squareLight, p.squareDark)).toBeGreaterThanOrEqual(3);
  });

  it('tells the two sides apart by their FILLS, because both strokes have to be dark', () => {
    // A light stroke cannot touch these squares at all: it would need luminance 1.32 and the
    // maximum is 1. So the side a piece belongs to moved out of the stroke and into the fill.
    const needed = 3 * (luminance(p.squareLight) + 0.05) - 0.05;
    expect(needed).toBeGreaterThan(1);
    expect(contrast(p.lightPieces.stroke, p.darkPieces.stroke)).toBeLessThan(1.1);
    expect(contrast(p.lightPieces.top, p.darkPieces.top)).toBeGreaterThanOrEqual(3);
  });

  it('lets the fills fall below the floor against the squares, on purpose', () => {
    // ⚠️ NOT A DEFECT and not something to "fix" back. The stroke is between them, so these two
    // colours never share an edge — and buying them 3:1 is exactly what cost the squares theirs
    // in every earlier version of this palette.
    expect(contrast(p.lightPieces.top, p.squareLight)).toBeLessThan(3);
  });

  it('is flat, because a stroke that must be black leaves nothing to shade with', () => {
    for (const side of [p.lightPieces, p.darkPieces]) {
      expect(new Set([side.top, side.face, side.side]).size).toBe(1);
    }
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
