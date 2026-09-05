// SPDX-License-Identifier: AGPL-3.0-or-later
// render/resolution — the logical viewport, and the split of it between board and HUD.
//
// ========================= ONE SOURCE, NOT TWO =========================
// `LOGICAL_W`, `LOGICAL_H` and `TILE` are RE-EXPORTED from the engine rather than restated. They
// are pillar 5 of ADR-0010 and the engine's `ui/layout` computes the integer upscale from them; a
// copy here that drifted by a pixel would produce a board that no longer integer-scales, and the
// symptom would be irregular scanlines rather than an error.
//
// ========================= THE TRAP THIS FILE EXISTS TO NAME =========================
// Zdog's `Illustration` measures the ELEMENT to size itself, and this canvas is displayed at
// several times its resolution. Left alone the backing store comes out at the CSS size and the
// game silently stops being a pixel game. Anything that builds a Zdog illustration here must set
// `pixelRatio = 1` and call `setSize(LOGICAL_W, LOGICAL_H)` explicitly.
// Measured in docs/spike-0-legibility.md; guarded by tests/canvas.browser.test.ts.

export { LOGICAL_H, LOGICAL_W, TILE } from '@pm-monte/inclusionist-engine/core/constants.ts';

import { LOGICAL_W as W } from '@pm-monte/inclusionist-engine/core/constants.ts';

/**
 * Width of the HUD column on the right: turn indicator, captured pieces, move list.
 * Measured in spike 0 by drawing it — 88 px holds all three at the engine's text sizes.
 */
export const HUD_W = 88;

/** Left edge of the HUD column. Everything left of this belongs to the board. */
export const HUD_X = W - HUD_W;

/** Horizontal room the board gets, once the HUD has taken its column. */
export const BOARD_W = HUD_X;
