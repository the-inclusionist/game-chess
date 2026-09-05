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
// ========================= AND THE SHADING HAD TO SEPARATE =========================
// The pieces read as MASS rather than as solids: top against front face measured 1.18 on the light
// side and 1.20 on the dark. Two neighbouring planes need roughly 1.5-2.0 before the eye reads them
// as distinct planes; below that they fuse, and the only thing giving a piece its form was the
// outline around each face.
//
// Widened to 1.72 and 1.64. Which pair mattered was itself a measurement: counting pixels by face
// at this camera pitch gives TOP 935, FRONT 532, SIDE under 251 — you are looking down at roughly
// 57 degrees, so the sides are nearly invisible and only top-against-front does any work. A first
// attempt widened top-against-SIDE and changed nothing anyone could see.
//
// The cost, stated rather than buried: dark piece on a dark square falls from 3.18 to 2.09, under
// the 3:1 floor. It is still carried by its outline at 5.42, and the high-contrast mode is the
// answer for anyone who needs the fills themselves to carry it.
//
// Measured ratios (sRGB relative luminance), after the change:
//
//                        light square   dark square
//   light top                  1.12          2.80   ← carried by its outline
//   light front                1.53          1.63   ← carried by its outline
//   light side                 2.52          1.01   ← barely visible at this pitch
//   light outline              9.50          3.81
//   dark top                   5.22          2.09
//   dark front                 8.57          3.43
//   dark side                 11.99          4.80
//   dark outline              13.52          5.42
//   light against dark (top faces): 5.86
//   top against front: 1.72 light, 1.64 dark
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
  top: '#FFE08A',
  side: '#B8781F',
  face: '#E0A33A',
  stroke: '#3B2A12',
};

export const DARK_PIECES: SidePalette = {
  top: '#5B44A0',
  side: '#1E1140',
  face: '#3A2670',
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
 * Stroke width in Zdog units.
 *
 * ========================= WHY 1.5 AND NOT 0.9 =========================
 * 0.9 came out of spike 0 by eye and it made the board look SOFT. The cause is not the upscale —
 * that is an exact integer factor with `image-rendering: pixelated`, verified — it is that
 * Canvas2D antialiases every path and cannot be told not to.
 *
 * A stroke of 0.9 units is 0.9 x 1.15 zoom = about ONE screen pixel. An antialiased one-pixel line
 * at an arbitrary angle has no fully covered pixel anywhere along it: the whole line is
 * half-opacity, and it reads as a grey smear rather than as an edge.
 *
 * Measured, sweeping the stroke and counting pixels with partial alpha:
 *
 *   0.9   9.2 % soft      0.7 % outline ink
 *   1.1   9.0 %           0.8 %
 *   1.3   4.5 %           0.9 %      <- the knee
 *   1.5   3.5 %           1.0 %
 *   1.8   1.9 %           1.0 %
 *
 * The knee sits between 1.1 and 1.3, which is exactly where the line first covers a whole pixel.
 * The outline INK barely grows across the range — the fear that a thicker stroke would swallow a
 * six-unit pawn was unfounded, because the stroke is centred on the edge and most of its width
 * falls on the neighbouring face rather than on the background.
 *
 * 1.5 is past the knee with room to spare. Eliminating the softness entirely would mean
 * rasterising through PIXI.Graphics with `antialias: false` — the fallback the plan reserved —
 * and that is a different trade: hard edges on a board whose every line is diagonal.
 */
export const STROKE = 1.5;

/**
 * The squares get the SAME weight as the pieces, and the reason is not about weight at all.
 *
 * This stroke is drawn in the square's OWN fill colour — it is not a grid line and is never seen
 * as one. Its whole job is to give the filled quad a crisp edge, because a Canvas2D fill has an
 * antialiased boundary whatever you do. A stroke thick enough to cover a whole pixel replaces that
 * soft boundary with a line that has a solid core; a thin one does not.
 *
 * It was `STROKE * 0.5` — 0.75 units, about 0.86 screen pixels — on the reasoning that 64 squares
 * at full weight would out-shout 32 pieces. That reasoning was about a visible line, and there is
 * no visible line. What it actually bought was 64 soft-edged quads, and MEASURED they were the
 * dominant source of blur on the whole board:
 *
 *   squares at 0.75   12.8 % of drawn pixels soft
 *   squares at 1.5     3.5 %
 *   squares with NO stroke at all   11.5 %   <- removing it barely helps: the FILL is still soft
 *
 * That last row is the point. The stroke is not decoration here, it is what makes an edge an edge.
 */
export const SQUARE_STROKE = STROKE;


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
