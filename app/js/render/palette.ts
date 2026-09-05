// SPDX-License-Identifier: AGPL-3.0-or-later
// render/palette — the colours, and the reason they are these colours.
//
// ========================= YELLOW AGAINST PURPLE, CHOSEN FOR LUMINANCE =========================
// The two sides are told apart by a large LUMINANCE gap, not by hue. Hue-based pairs each fail
// under one deficiency or another — red/green under protanopia and deuteranopia, blue/yellow
// under tritanopia — while a luminance separation survives all of them, and survives the engine's
// own colour-vision simulation filters, which is where a hue-only choice would be caught.
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
  top: '#9179DA',
  side: '#4E3499',
  face: '#6F52C4',
  stroke: '#241640',
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
