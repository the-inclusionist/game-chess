// SPDX-License-Identifier: AGPL-3.0-or-later
// render/pixi-surface — where the Zdog frame becomes a WebGL sprite.
//
// ========================= WHY PIXI IS HERE AT ALL =========================
// Zdog can draw to a canvas by itself, so a compositor has to earn its place. It earns it three
// times over:
//
//  · TEXT. Zdog has none, and the HUD is turn, captured pieces and a move list in algebraic
//    notation.
//  · THE ENGINE'S LAYER STACK. `core/layers` orders the whole screen, and the post-processing that
//    carries accessibility — colour-vision simulation, a11y correction, the flash limiter — is
//    applied in that stack. A board that is a sprite inside it inherits all of that. A board that
//    is a second, separate canvas inherits none of it.
//  · ONE SURFACE. Two stacked canvases would need their integer upscale kept in step by hand, and
//    would drift the first time one of them resized differently.
//
// ========================= WHY THE FRAME GOES VIA A TEXTURE =========================
// The obvious alternative is to rasterise Zdog straight into PIXI.Graphics through a Canvas2D
// shim, keeping everything as vector geometry in WebGL. That is a real option and the plan keeps
// it as a fallback — Zdog's renderer is pluggable by design.
//
// It is not the default because of the RESOLUTION. Uploading 320×180 is 57,600 pixels a frame,
// which is nothing, and it buys full Zdog fidelity with no shim to keep faithful and no fork. At
// 1920×1080 the arithmetic would invert and the shim would win. Low resolution is what makes the
// simple answer the right one here.

import { Z } from '@the-inclusionist/engine/core/layers.js';
import * as PIXI from 'pixi.js';
import { LOGICAL_H, LOGICAL_W } from './resolution.ts';

/** Matches the engine's own Application options — same pixel identity, same power profile. */
const APP_OPTIONS = {
  width: LOGICAL_W,
  height: LOGICAL_H,
  backgroundColor: 0x05070f,
  antialias: false,
  resolution: 1,
  powerPreference: 'low-power',
} as const;

export interface PixiSurface {
  /** The canvas to put in `#game-region`. The engine's `ui/layout` scales it by an integer. */
  readonly view: HTMLCanvasElement;
  /** Where HUD sprites and text go. Already above the board in the engine's Z order. */
  readonly hud: PIXI.Container;
  /** Structurally compatible with the engine's `startLoop(ticker, frame)`. */
  readonly ticker: PIXI.Ticker;
  /** Uploads the current contents of the Zdog canvas to the GPU. Call once per rendered frame. */
  present(): void;
  /** Draws the stage now. The ticker does this on its own; tests and single-shot renders need it. */
  render(): void;
  destroy(): void;
}

/**
 * @param source the Zdog stage's offscreen 320×180 canvas.
 */
export function createPixiSurface(source: HTMLCanvasElement): PixiSurface {
  // Library-level configuration, set here rather than at module scope: no module-level mutable
  // state in this repo, and a global mutated on import is exactly that.
  PIXI.settings.ROUND_PIXELS = true;

  const app = new PIXI.Application(APP_OPTIONS);
  app.stage.sortableChildren = true;

  const texture = PIXI.Texture.from(source);
  // The whole point of 320×180. Anything but NEAREST turns the upscale into a blur and throws
  // away the pixel identity that is pillar 5 of the engine.
  texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

  const board = new PIXI.Sprite(texture);
  board.zIndex = Z.TILES;
  app.stage.addChild(board);

  const hud = new PIXI.Container();
  hud.zIndex = Z.HUD;
  hud.sortableChildren = true;
  app.stage.addChild(hud);

  return {
    view: app.view as HTMLCanvasElement,
    hud,
    ticker: app.ticker,

    render() { app.render(); },

    present() {
      // Marks the canvas-backed texture dirty so the renderer re-uploads it. Without this the
      // board would freeze on its first frame — and freeze silently, which is the worst kind.
      texture.update();
    },

    destroy() {
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    },
  };
}
