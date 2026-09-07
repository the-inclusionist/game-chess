// SPDX-License-Identifier: AGPL-3.0-or-later
// render/resolution — the logical viewport, and the split of it between board and HUD.
//
// ========================= 640×360, AND WHY IT DIVERGES FROM THE ENGINE =========================
// The engine's own base is 320×180 (pillar 5 of ADR-0010) and this game draws at exactly twice
// that. The reason is measured, not aesthetic.
//
// A board drawn in projected 3D has NO axis-aligned edges: the camera is pitched, so every line on
// screen is a diagonal. Diagonals are the one thing low-resolution pixel art handles worst, and a
// hand-drawn sprite avoids the problem by having an artist place each pixel — which a projection
// cannot do. The visible result is a staircase whose step is one source pixel wide, so it grows
// with the screen: at k=5 each step is five physical pixels.
//
// Doubling the source halves the step. It is still pixel art, it still integer-scales, it is still
// 16:9, and it keeps this game looking like a sibling of the platformer rather than a smooth vector
// render. The world units are UNCHANGED — `TILE` is still 16 and every piece keeps its size — only
// the camera zoom doubles, so the same geometry is simply rasterised twice as finely.
//
// Rendering at the DISPLAY resolution was measured too and costs nothing (1.67 ms at 1600×900
// against 1.84 ms at 320×180 — the cost is all geometry, not fill). It was rejected because it
// stops being pixel art, which is a product decision rather than a technical one.
//
// ========================= THE TRAP THIS FILE EXISTS TO NAME =========================
// Zdog's `Illustration` measures the ELEMENT to size itself, and this canvas is displayed at
// several times its resolution. Left alone the backing store comes out at the CSS size and the
// game silently stops being a pixel game. Anything that builds a Zdog illustration here must set
// `pixelRatio = 1` and call `setSize(LOGICAL_W, LOGICAL_H)` explicitly.
// Measured in docs/spike-0-legibility.md; guarded by tests/canvas.browser.test.ts.

import { LOGICAL_W as ENGINE_W } from '@the-inclusionist/engine/core/constants.js';

/**
 * ========================= ⚠️ THE CANVAS IS SQUARE, AND THAT IS THE SPEC =========================
 * It was 640x360 — the engine's 320x180 doubled — and the paragraph above still argues for that
 * shape. The argument for DOUBLING stands and is untouched; the argument for 16:9 does not, and
 * this is why.
 *
 * A chess board is square. In a 16:9 raster it can only ever use the height, so the projected
 * board measured 258x217 inside 640x360 — forty per cent of the width, with the rest letterboxed.
 * That was invisible while the HUD was drawn in the same canvas and filled the right 27.5%; when
 * the teaching mode moved the HUD out to a DOM sibling, the letterbox was all that was left there.
 *
 * The stage is now 16x9 UNITS: nine of them for a square board, seven for the panel beside it.
 * At the floor that is a 640x360 stage holding a 360x360 board and a 280x360 panel — so 360x360 is
 * the raster the board actually occupies, and the canvas is exactly that.
 *
 * ⚠️ THE DOUBLING IS PRESERVED WHERE IT MATTERS. 360 is twice the 180 the engine gives a square of
 * its own height, so a diagonal still costs half the staircase it would at the engine's base —
 * which is the whole of the argument above. What is dropped is 280 columns of pixels the board was
 * never able to draw into.
 */
export const SOURCE_MULTIPLE = 2;

/** The square the board is drawn in: nine of the stage's sixteen units, at the floor. */
export const LOGICAL_W = (ENGINE_W * 9 / 16) * SOURCE_MULTIPLE;  // 360
export const LOGICAL_H = LOGICAL_W;                              // 360 — a board is square

/** Re-exported unchanged: the world unit of a square is the engine's tile, and stays 16. */
export { TILE } from '@the-inclusionist/engine/core/constants.js';

/*
 * ========================= ⚠️ THE HUD COLUMN USED TO BE IN HERE, AND IS GONE =========================
 * Four exports lived here — `HUD_FRACTION`, `HUD_W`, `HUD_X` and `BOARD_W` — reserving 27.5% of
 * the canvas, 176 pixels of 640, for the turn indicator, the captured pieces and the move list.
 * Measured in spike 0 by drawing it, and correct for as long as the HUD was drawn INSIDE the
 * canvas.
 *
 * The teaching mode moved it out. It is DOM now, a sibling of the canvas in `#side-column`, and by
 * the time anybody looked these four were read by nothing at all — not by a renderer, not by a
 * test, not by a spike.
 *
 * ⚠️ THEY WERE NOT HARMLESS. `render/camera.ts` was framed against `BOARD_W` and still said so:
 * "this board is already sized to fill the 232 logical pixels the panel leaves it". The panel
 * leaves it all 640. The board went on being drawn two thirds the width of the canvas it had —
 * which is what "o tabuleiro reduziu drasticamente de tamanho" was, and a dead constant is exactly
 * how a framing survives the thing it was measured against.
 *
 * Deleted rather than left for tidiness later: the next person to reach for them would have
 * re-derived a layout from a fiction.
 */
