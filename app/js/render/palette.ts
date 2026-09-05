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
/** Where the keyboard is. Distinct from selection: the cursor is looking, the selection is held. */
export const MARKER_CURSOR = '#0E7C86';

/**
 * Stroke width in Zdog units. Thick enough to read as Zdog at this resolution, thin enough not to
 * swallow a face that is only a few pixels across. Measured in spike 0.
 */
export const STROKE = 0.9;

/** Squares carry a lighter outline than pieces: they are ground, and 64 of them at full weight
 * would out-shout the 32 figures standing on them. */
export const SQUARE_STROKE = STROKE * 0.5;


/* ============================ THE HIGH-CONTRAST MODE ============================ */

/**
 * ========================= WHY THE SHADING DISAPPEARS =========================
 * The default palette leans on outlines: its light fills contrast 1.07:1 with a light square,
 * which WCAG accepts only because 1.4.11 judges the BOUNDARY. This mode does not lean.
 *
 * Making it work forces a conclusion worth stating. For a shaded SIDE face — darker than the top
 * by design — to reach 3:1 against the light square, its luminance would have to exceed 0.97:
 * essentially white. So in high contrast the shading has to go. The light side becomes uniformly
 * white and the dark side uniformly black, and the FORM comes entirely from the outline.
 *
 * That is not a loss, it is what high contrast means — and it works here because Zdog draws every
 * face of a Box with its own outline, so the edges between faces stay drawn and a cube still
 * reads as a cube, in line.
 *
 * The square pair was solved numerically: these are the two tones with the LARGEST separation
 * from each other that still keep all four piece-against-square pairs at or above 3:1.
 *
 *   white against light square   3.00      black against light square   6.99
 *   white against dark square    6.95      black against dark square    3.02
 *   light side against dark     21.00      square against square        2.31
 *
 * The squares themselves land at 2.31, under the floor — and that is a deliberate acceptance
 * rather than an oversight. Four tones cannot satisfy all six pairs at once, and a square is not
 * identified by its colour alone: it is identified by WHERE it is on the board, which is why a
 * chess diagram works in one ink.
 */

export interface Palette {
  readonly lightPieces: SidePalette;
  readonly darkPieces: SidePalette;
  readonly squareLight: string;
  readonly squareDark: string;
}

export type PaletteMode = 'default' | 'high-contrast';

export const DEFAULT_PALETTE: Palette = {
  lightPieces: LIGHT_PIECES,
  darkPieces: DARK_PIECES,
  squareLight: SQUARE_LIGHT,
  squareDark: SQUARE_DARK,
};

export const HIGH_CONTRAST_PALETTE: Palette = {
  lightPieces: { top: '#FFFFFF', side: '#FFFFFF', face: '#FFFFFF', stroke: '#000000' },
  darkPieces: { top: '#000000', side: '#000000', face: '#000000', stroke: '#FFFFFF' },
  squareLight: '#9A948C',
  squareDark: '#5E5951',
};

export function createPalette(mode: PaletteMode): Palette {
  return mode === 'high-contrast' ? HIGH_CONTRAST_PALETTE : DEFAULT_PALETTE;
}
