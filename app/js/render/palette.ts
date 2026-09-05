// SPDX-License-Identifier: AGPL-3.0-or-later
// render/palette — the colours, and the reason they are these colours.
//
// ========================= YELLOW AGAINST INDIGO, AND THE NUMBERS THAT SETTLED IT ==============
// The two sides are told apart by LUMINANCE, not by hue: hue pairs each fail under one deficiency
// or another — red/green under protanopia and deuteranopia, blue/yellow under tritanopia — while
// a luminance separation survives all of them, and survives the engine's own CVD simulation
// filters, which is exactly where a hue-only choice gets caught.
//
// ⚠️ THAT CLAIM WAS ASSERTED BEFORE IT WAS MEASURED, and the first measurement failed it. The
// original dark side (#9179DA) gave a side-against-side ratio of 2.60:1 — BELOW the 3:1 floor of
// WCAG 1.4.11, on the single most important visual distinction in chess: whose piece is that.
// Darkening to #3F2B78 takes it to 8.46:1.
//
// Measured ratios (sRGB relative luminance), after the change:
//
//                        light square   dark square
//   light top                  1.07          2.66   ← carried by its outline
//   light side                 1.45          1.72   ← carried by its outline
//   light outline              9.50          3.81
//   dark top                   7.93          3.18
//   dark side                 11.38          4.56
//   dark outline              13.52          5.42
//   light against dark (top faces): 8.46
//
// The light side's FILLS have almost no contrast against a light square — 1.07:1 is nothing. What
// makes a light piece legible there is its OUTLINE at 9.50:1, and WCAG 1.4.11 judges the boundary,
// so this passes. It is thinner ice than it looks, and step 8's high-contrast variant is where the
// fills themselves should be brought up. Recorded rather than glossed.
//
// The look is "Zdog assumed": flat saturated fills, a visible rounded stroke, toy-like. That is a
// deliberate aesthetic choice, and it happens to push in the same direction as contrast.
//
// Squares are muted on purpose. They are the ground; the pieces are the figure.

export interface SidePalette {
  readonly top: string;
  readonly side: string;
  readonly face: string;
  readonly stroke: string;
}

export const LIGHT_PIECES: SidePalette = {
  top: '#FFD97D',
  side: '#E8A72E',
  face: '#F7C55A',
  stroke: '#3B2A12',
};

export const DARK_PIECES: SidePalette = {
  top: '#3F2B78',
  side: '#241547',
  face: '#332063',
  stroke: '#0E0722',
};

export const SQUARE_LIGHT = '#DCD6C8';
export const SQUARE_DARK = '#8D8677';

/** Markers sit above the board and must read against both square colours. */
export const MARKER_MOVE = '#2E7D5B';
export const MARKER_CAPTURE = '#B3341F';
export const MARKER_SELECTED = '#1B4F8A';
export const MARKER_CHECK = '#B3341F';

/**
 * Stroke width in Zdog units. Thick enough to read as Zdog at this resolution, thin enough not to
 * swallow a face that is only a few pixels across. Measured in spike 0.
 */
export const STROKE = 0.9;

/** Squares carry a lighter outline than pieces: they are ground, and 64 of them at full weight
 * would out-shout the 32 figures standing on them. */
export const SQUARE_STROKE = STROKE * 0.5;
