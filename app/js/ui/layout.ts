// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/layout — how big the game region is, in whole physical pixels.
//
// ========================= WHY THIS IS NOT THE ENGINE'S layout() =========================
// It was, and it had to stop being. The engine's `ui/layout` derives the base size from
// `screenBaseSize(numJogadores)` — 320×180 for one player, 640×180 for two, 640×360 for three or
// four. That conflates two different questions: HOW MANY PLAYERS share the screen, and WHAT
// RESOLUTION this game draws at. A game with its own source resolution has no way to say so, and
// the only way to get 640×360 out of it is to claim three players, which would be a lie the rest
// of the engine would then act on.
//
// So the arithmetic below is the engine's, deliberately: ADR-001, integer PHYSICAL pixels, the ≤5
// logical pixels of tolerated crop per side (the −10), and the same floor. Only the base changes.
// If the engine ever separates those two questions, this file should go away.
//
// ========================= WHAT THE UI VARIABLES MEAN HERE =========================
// `--ui-fs` and `--tap` are sized against the ENGINE's 320-wide base, not against ours. A tap
// target is 44 CSS pixels because a finger is a finger; it must not shrink just because this game
// happens to rasterise at twice the density. So the scale for UI is the region's size relative to
// 320, and it comes out identical to what the engine would have produced.

import { LOGICAL_H, LOGICAL_W } from '../render/resolution.ts';

/** The engine's own base width. UI sizes are expressed against this so they match its games. */
const ENGINE_BASE_W = 320;

/**
 * Smallest region we will draw into, in CSS pixels: the engine's k=2 floor, chosen so a 2×2 grid
 * fits a 1366×768 government Chromebook. Ours is a single screen, but the floor is about how small
 * the art may get, not about the grid.
 */
const MIN_REGION_W = 640;

export interface LayoutHost {
  readonly doc: Document;
  readonly win: Window;
}

export interface LayoutResult {
  /** Region size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Source pixels to physical pixels. A whole number, always. */
  readonly scaleDevice: number;
}

export function applyLayout(host: LayoutHost): LayoutResult | null {
  const wrap = host.doc.getElementById('stage-wrap');
  const region = host.doc.getElementById('game-region');
  if (!wrap || !region) return null;

  const dpr = host.win.devicePixelRatio || 1;
  /*
   * ⚠️ WHAT IS UNDER THE BOARD COMES OUT OF THE BOARD'S HEIGHT. The lesson bar and the blunder bar
   * are inside the stage now, so measuring the wrap alone would size a region that does not fit
   * beside them and push one off the bottom of the screen. Measured rather than assumed, because
   * the bar's height depends on how long the step's sentence is.
   *
   * The reserve is read BEFORE the region is resized, so it is the height the panels have with the
   * width they currently have. A relayout follows any change to the panels, which is what keeps
   * that from drifting.
   */
  const below = host.doc.getElementById('below-board');
  const reserved = below ? below.getBoundingClientRect().height : 0;
  const availW = wrap.clientWidth || MIN_REGION_W;
  const availH = Math.max(120, (wrap.clientHeight || (MIN_REGION_W * 9) / 16) - reserved);

  // The scale is locked in REAL pixels, not CSS ones. That is ADR-001, corrected 2026-07-04: each
  // art pixel must be a whole number of PHYSICAL pixels, or the scanlines come out uneven at any
  // device pixel ratio that is not 1.
  const floorDevice = Math.round((MIN_REGION_W / LOGICAL_W) * dpr);
  const scaleDevice = Math.max(floorDevice, Math.floor(Math.min(
    (availW * dpr) / (LOGICAL_W - 10),
    (availH * dpr) / (LOGICAL_H - 10),
  )));

  const scale = scaleDevice / dpr;
  const width = LOGICAL_W * scale;
  const height = LOGICAL_H * scale;

  region.style.width = `${width}px`;
  region.style.height = `${height}px`;

  // Against the ENGINE's base, not ours: a 44 px target is 44 px whatever this game rasterises at.
  const ui = width / ENGINE_BASE_W;
  region.style.setProperty('--ui-fs', `${8 * ui}px`);
  region.style.setProperty('--tap', `${22 * ui}px`);
  region.style.setProperty('--hud-fs', `${Math.max(9, Math.round(180 * ui * 0.052))}px`);

  if (below) {
    // Exactly the board and the side menu together — the panels under the board are neither wider
    // nor narrower than the thing they are talking about.
    below.style.width = `${width}px`;
    /*
     * ⚠️ TYPE SIZED AGAINST THE STAGE, WITH A FLOOR. A lesson sentence is prose to be read, not a
     * HUD label to be glanced at, so it tracks the board rather than staying at whatever `body`
     * happens to say — and it never goes below 13 px, because the smallest stage is still a stage
     * somebody has to read from.
     */
    below.style.setProperty(
      '--panel-fs',
      // Floor and ceiling both: 13 px because the smallest stage is still one somebody reads from,
      // and 20 px because a lesson sentence that grows without limit on a projector stops being a
      // caption under a board and becomes the thing the board is under.
      `${Math.min(20, Math.max(13, Math.round(width * 0.022)))}px`,
    );
    below.style.setProperty('--tap', `${22 * ui}px`);
  }

  return { width, height, scaleDevice };
}
