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
// ⚠️ THE "OUTLINE" ROWS BELOW ARE NOT DRAWN. This was asserted for several commits and it is
// false. Zdog's `Box.setFace` assigns `color = <that face's colour>`, and `Shape` uses `color` for
// the stroke as well as the fill — there is no separate stroke colour anywhere in the library. The
// `stroke:` passed to a Box is a WIDTH only, so every face is outlined in its own colour, which is
// to say not outlined at all. Measured on a full board: 65 pixels out of 76,495 carry either
// stroke colour, and those are antialiasing coincidences.
//
// So the stroke rows are kept for what they would be worth IF an outline were ever drawn, and the
// legibility of a light piece on a light square rests on something else entirely: the SHADING
// between its faces. That is why widening top-against-front from 1.18 to 1.72 mattered far more
// than a shading tweak has any right to.
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
 * Where the engine would play. A HUE of its own, because it is not one of the player's own states:
 * a hint is an opinion from outside the game, and giving it the selection blue or the move green
 * would make it look like something the player had done.
 */
/**
 * ========================= ONE HUE PER MOVE, AND THE HUE IS NOT THE BOUNDARY =========================
 * A hint offers up to three moves, and each is drawn in its own colour on BOTH of its squares —
 * so a board wearing six marks reads as three sentences rather than six loose facts. Where two
 * moves want the same square, that square wears both colours.
 *
 * ⚠️ MEASURED, and the measurement changed the design. No colour clears 3:1 against every square
 * this game can draw: the best of five candidate triples still fell to 1.17:1 on the dark grey of
 * the high-contrast board, and every candidate did. So the hue CANNOT carry the boundary — the
 * hairline sandwich in the stylesheet does, a dark line outside and a light one inside, one of
 * which always contrasts whatever is under it (1.4.11). The hue is identity, nothing else.
 *
 * Which then makes the hue information conveyed by colour, so it needs a second channel (1.4.1).
 * That is the RADIAL SLOT: the best move always takes the outer ring, the second the middle one,
 * the third the centre. Someone who sees no colour at all counts inwards.
 *
 * ========================= WHY THESE THREE =========================
 * Chosen by measuring ΔE between the three, as seen through the Machado 2009 simulations the game
 * already ships, against four rival triples — and by measuring the distance to the marks the game
 * already uses, so a hint is never mistaken for a check or a legal-move ring.
 *
 *   violet · amber · wine   ΔE 60 normal, 52 protan, 56 deuteran, 29 tritan; 40 from the nearest
 *                           existing marker — the largest clearance of every triple tried.
 *
 * The runner-up (violet · amber · crimson) separated better for a tritan viewer, 33 against 29,
 * and sat 28 from the red of check and capture. A hint that can be mistaken for "you are in
 * check" is a worse failure than a rare viewer leaning on the radial slot, which is there anyway.
 */
export const HINT_HUES: readonly string[] = ['#7A4FBF', '#C07A00', '#7A1038'];

/** The best move's hue, for anything that needs to speak about hints in general. */
export const MARKER_HINT = HINT_HUES[0];

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

/**
 * ========================= THE DARK SIDE'S OUTLINE, HALVED =========================
 * An intuition being tested rather than a measurement being applied, and it is worth saying which
 * of the two it is.
 *
 * The reasoning behind it: the ink counts in `tests/pieces.browser.test.ts` showed that a piece is
 * mostly its own outline — the bishop worst at 4.94 to one — and that the ink which COVERS a piece
 * is the ink that names it. That cuts differently for the two sides. A light piece outlined dark
 * reads as a light piece with lines on it, because the eye takes the bright interior for the
 * object. A dark piece outlined dark has nothing to separate the line from the mass, so the
 * outline only thickens it; and a dark piece outlined LIGHT becomes a light piece, which is the
 * fault this project already found and fixed once in high contrast.
 *
 * So the dark side may not need as much line as the light side does. Half is the first thing to
 * try, and it is a constant here rather than a literal in the builder precisely so the next
 * measurement can move it.
 *
 * ⚠️ It cannot go much below this and stay visible. Zdog's stroke is CENTRED on the path, so a
 * fill box already reaches STROKE/2 = 0.75 units beyond its faces; an outline narrower than that
 * sits entirely inside the silhouette and stops being an edge at all.
 */
export const DARK_OUTLINE_SCALE = 0.5;


/* ============================ THE HIGH-CONTRAST MODE ============================ */

/**
 * ========================= WHY THE SHADING DISAPPEARS =========================
 * The default palette leans on outlines: its light fills contrast 1.07:1 with a light square,
 * which WCAG accepts only because 1.4.11 judges the BOUNDARY. This mode does not lean.
 *
 * Making it work forces a conclusion worth stating. For a shaded SIDE face — darker than the top
 * by design — to reach 3:1 against the light square, its luminance would have to exceed 0.93.
 * So in high contrast the shading has to go: each side is one flat tone and the FORM comes
 * entirely from the outline. That works here because the outline is a real second Box drawn in a
 * single colour over every face, so the edges between faces stay drawn and a cube still reads as
 * a cube, in line.
 *
 * ========================= WHY THE PIECES ARE NOT WHITE AND BLACK =========================
 * They were, and it was reported as making things worse rather than better. The measurement says
 * why, and it is not a matter of taste: counted on a rendered board, the dark side came to
 * **4,439 white pixels against 2,527 of filling** — 1.76 to 1. The stroke is not a line around a
 * piece at this scale, it IS most of the piece: 1.5 Zdog units of it against bodies six to eleven
 * units across. Counted piece by piece, stroke against filling:
 *
 *   pawn   2.24     rook   0.87     knight 2.15
 *   bishop 4.94     queen  1.77     king   1.31
 *
 * The bishop is the extreme — three thin boxes are almost all edge, which is exactly why it was
 * the piece the white outline was noticed on. Only the rook, one compact 9-unit cube, has enough
 * face to out-cover its own edges. So a dark piece outlined in white is a WHITE piece with dark
 * filling, and the one distinction chess cannot lose — whose piece is that — was being carried by
 * the minority ink.
 *
 * So the colour that dominates has to be the colour that identifies:
 *
 *   LIGHT side   yellow #FFFF00 filling, black #000000 stroke
 *   DARK side    black #000000 filling, light blue #0099FF stroke
 *
 * #0099FF is the most saturated blue — no red at all — that reaches exactly 7.00:1 against the
 * black it outlines, so the piece's own edges are legible at the AAA text ratio while the piece
 * reads unmistakably as the blue side. The founding argument of this file survives: the sides are
 * still told apart by LUMINANCE (the light side averages about 0.34 against the dark side's 0.19
 * once each ink is weighted by the area it actually covers), which is what comes through every
 * colour-vision deficiency and every one of the engine's simulation filters.
 *
 * Measured, against squares re-solved for this pair:
 *
 *   yellow against light square   3.01      black against light square   6.49
 *   yellow against dark square    6.42      black against dark square    3.05
 *   blue against black            7.00      yellow against black        19.56
 *   square against square         2.13
 *
 * ========================= WHAT THIS COSTS, STATED =========================
 * The blue stroke contrasts 1.08:1 with the light square, so on those squares the outer rim of a
 * dark piece does not delineate it — the BLACK filling does, at 6.49:1, and that is what WCAG
 * 1.4.11 is asking for. It is a real limit and it is arithmetic, not oversight: for the rim to
 * clear 3:1 against a light square as well, the squares would have to drop below luminance 0.067,
 * and the black filling would then fail against them. Four inks cannot satisfy six pairs.
 *
 * Square against square is 2.17, under the floor and accepted for the same reason it always was:
 * a square is identified by WHERE it is, which is why a chess diagram works in a single ink, and
 * a piece is not. It is better than the 1.86 of the navy-filled version, because putting the dark
 * ink back at pure black widens the window the squares have to live in: they now run from the
 * darkest grey that leaves black 3:1 to the brightest that leaves yellow 3:1, and both ends are
 * hard against their bound.
 *
 * Every ratio above is asserted in `tests/palette.node.test.ts`, computed rather than copied, and
 * the ink ratio that started this is asserted in `tests/pieces.browser.test.ts` by counting
 * pixels — because the last time this file carried a table of numbers, it also carried one that
 * had never been measured.
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
  // Flat fills, for the reason above: there is no luminance room left for shading once each side
  // sits at an end of the range. The form comes from the stroke, and the stroke is also what
  // names the side, because it covers about two thirds of the piece.
  lightPieces: { top: '#FFFF00', side: '#FFFF00', face: '#FFFF00', stroke: '#000000' },
  darkPieces: { top: '#000000', side: '#000000', face: '#000000', stroke: '#0099FF' },
  // Neutral greys, and as far apart as the two fills allow: the light one is the brightest that
  // still leaves yellow 3:1, the dark one the darkest that still leaves black 3:1.
  squareLight: '#8F8F8F',
  squareDark: '#5A5A5A',
};

export function createPalette(mode: PaletteMode): Palette {
  return mode === 'high-contrast' ? HIGH_CONTRAST_PALETTE : DEFAULT_PALETTE;
}

/* ============================ THE NAMED PALETTES, SHADED ============================ */

const channels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
];

const hex = (rgb: readonly number[]): string =>
  `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`
    .toUpperCase();

/** Moves a colour `amount` of the way towards `target`, channel by channel. */
const towards = (colour: string, target: string, amount: number): string => {
  const from = channels(colour);
  const to = channels(target);
  return hex(from.map((c, i) => c + (to[i] - c) * amount));
};

/** sRGB relative luminance, the same function every measurement in this file uses. */
function luminance(colour: string): number {
  const linear = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = channels(colour);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/**
 * ========================= SHADING, DERIVED RATHER THAN AUTHORED =========================
 * Six named palettes times three planes times two sides is thirty-six colours, and hand-picking
 * them would be thirty-six chances to miss the one thing that matters — that the top and the front
 * stay far enough apart to read as two planes. So they come from ONE rule with the measurement
 * built into it.
 *
 * The direction is decided by the fill, not chosen: a light piece is shaded by moving its lower
 * planes towards black, and a dark piece by lifting its upper planes towards white, because
 * darkening black does nothing and lightening white does nothing. Pure black is the case that
 * forces this — and it is a real case, since three of the six themes have black pieces.
 *
 * The amounts are the smallest that clear the 1.5 the file already argued for, with margin: they
 * come out between 1.6 and 2.0 for every theme, which `tests/palette.node.test.ts` asserts for all
 * six rather than for the two that used to exist.
 */
function shade(fill: string): [string, string, string] {
  // Above this a colour has room to be darkened; below it, it has to be lifted instead.
  const light = luminance(fill) > 0.18;
  return light
    ? [fill, towards(fill, '#000000', 0.28), towards(fill, '#000000', 0.5)]
    : [towards(fill, '#FFFFFF', 0.29), towards(fill, '#FFFFFF', 0.14), fill];
}

/**
 * The palette the projected board draws a named theme with.
 *
 * Authored values win where they exist: this project's own palette and the two high-contrast ones
 * were solved numerically, and re-deriving them would silently move numbers that were argued for.
 */
export function projectedPalette(theme: {
  light: string; dark: string; white: string; black: string;
  whiteRim: string; blackRim: string;
  solid?: { light: readonly [string, string, string]; dark: readonly [string, string, string] };
  flatSolid?: boolean;
}): Palette {
  const planes = (fill: string, authored?: readonly [string, string, string]): [string, string, string] => {
    if (authored) return [authored[0], authored[1], authored[2]];
    if (theme.flatSolid) return [fill, fill, fill];
    return shade(fill);
  };

  const [lightTop, lightFace, lightSide] = planes(theme.white, theme.solid?.light);
  const [darkTop, darkFace, darkSide] = planes(theme.black, theme.solid?.dark);

  return {
    lightPieces: { top: lightTop, face: lightFace, side: lightSide, stroke: theme.whiteRim },
    darkPieces: { top: darkTop, face: darkFace, side: darkSide, stroke: theme.blackRim },
    squareLight: theme.light,
    squareDark: theme.dark,
  };
}
