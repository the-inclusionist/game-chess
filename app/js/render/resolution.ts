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

import { LOGICAL_W as ENGINE_W } from '@pm-monte/inclusionist-engine/core/constants.ts';

/** How many times the engine's own base this game draws at. */
export const SOURCE_MULTIPLE = 2;

export const LOGICAL_W = ENGINE_W * SOURCE_MULTIPLE;          // 640
export const LOGICAL_H = (ENGINE_W * 9 / 16) * SOURCE_MULTIPLE; // 360

/** Re-exported unchanged: the world unit of a square is the engine's tile, and stays 16. */
export { TILE } from '@pm-monte/inclusionist-engine/core/constants.ts';

/**
 * Width of the HUD column on the right: turn indicator, captured pieces, move list.
 * Measured in spike 0 by drawing it — 27.5 % of the viewport holds all three at the engine's
 * text sizes, which was 88 px of 320 and is 176 of 640.
 */
export const HUD_FRACTION = 0.275;
export const HUD_W = Math.round(LOGICAL_W * HUD_FRACTION);

/** Left edge of the HUD column. Everything left of this belongs to the board. */
export const HUD_X = LOGICAL_W - HUD_W;

/** Horizontal room the board gets, once the HUD has taken its column. */
export const BOARD_W = HUD_X;
