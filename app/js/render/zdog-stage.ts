// SPDX-License-Identifier: AGPL-3.0-or-later
// render/zdog-stage — the Zdog illustration and the offscreen canvas it rasterises into.
//
// ========================= WHY THIS IS SEPARATE FROM PIXI =========================
// The pipeline is Zdog → Canvas2D (320×180) → PIXI.Texture → a sprite in the engine's layer stack.
// The seam is HERE, and the split is not bookkeeping:
//
//  · This half needs no WebGL, so it can be tested in a headless browser against real projected
//    geometry — which is the only way to prove that picking reads the same points the renderer
//    draws.
//  · The plan's fallback — rasterising Zdog straight into PIXI.Graphics through a Canvas2D shim —
//    replaces `pixi-surface`, not this. That property is only worth having if the boundary is real.
//
// ========================= THE INVARIANT THIS FILE EXISTS TO HOLD =========================
// Zdog's Illustration defaults `pixelRatio` to `devicePixelRatio` and, given no explicit size,
// measures the ELEMENT. This canvas is displayed at an integer multiple of its resolution. Left
// alone the backing store comes out several times too large, the low resolution that is pillar 5
// of the engine evaporates, and NOTHING reports an error. Both lines below are load-bearing.
// Measured in docs/spike-0-legibility.md; guarded by tests/canvas.browser.test.ts.

import Zdog, { type Anchor, type Illustration } from 'zdog';
import { LOGICAL_H, LOGICAL_W } from './resolution.ts';
import type { Viewport } from './picking.ts';

/** Camera and framing, all measured in spike 0 by drawing them rather than by estimating. */
export const CAMERA = {
  /** Pitch in radians. Negative tilts the far edge of the board away from the viewer. */
  pitch: -1,
  yaw: 0,
  /**
   * Doubled with the source resolution. The WORLD is unchanged — TILE is still 16 and every piece
   * keeps its size — so the same geometry simply rasterises twice as finely and the board occupies
   * the same fraction of the screen it always did.
   */
  zoom: 2.3,
  /** Pushes the board left so the HUD gets its 88 px column on the right. */
  offsetX: -42,
} as const;

export interface ZdogStage {
  /** The 320×180 canvas the illustration draws into. Not in the document: it is a texture source. */
  readonly canvas: HTMLCanvasElement;
  /** Add scene content here, not to the illustration — this anchor carries the board offset. */
  readonly root: Anchor;
  /** Applies transforms, re-sorts, and draws. */
  render(): void;
  /** Transforms and sorts WITHOUT drawing — enough to read projected points for picking. */
  update(): void;
  viewport(): Viewport;
  setCamera(pitch: number, yaw: number): void;
  camera(): { pitch: number; yaw: number };
  setZoom(zoom: number): void;
  destroy(): void;
}

export interface ZdogStageOptions {
  /** Overrides the logical size. Only for measuring what a different resolution would cost. */
  readonly width?: number;
  readonly height?: number;
}

export function createZdogStage(options: ZdogStageOptions = {}): ZdogStage {
  const width = options.width ?? LOGICAL_W;
  const height = options.height ?? LOGICAL_H;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const illo: Illustration = new Zdog.Illustration({
    element: canvas,
    zoom: CAMERA.zoom * (width / LOGICAL_W),
    centered: true,
    // The engine owns the frame loop and the pointer; Zdog must not add listeners of its own.
    resize: false,
    dragRotate: false,
  });

  // ⚠️ Both lines are the invariant described at the top. Do not remove either.
  illo.pixelRatio = 1;
  illo.setSize(width, height);

  illo.rotate.x = CAMERA.pitch;
  illo.rotate.y = CAMERA.yaw;

  // ========================= THE FRAMING OFFSET IS NOT PART OF THE SCENE =========================
  // It shifts the board left so the panel gets its column, and it used to live on `root` — inside
  // the graph the illustration rotates. That is fine until the camera turns: at half a turn, for a
  // player who has chosen black, the rotation carried the offset with it and pushed the board
  // RIGHT, under the panel.
  //
  // On the illustration itself it is applied AFTER its own rotation, so it is a framing decision
  // about where the picture sits on the canvas rather than a fact about where the board is in the
  // world — which is what it always meant. Picking is unaffected: it reads `renderPoint`, which
  // carries every transform either way.
  //
  // Still in world units, and still not multiplied by the zoom here: the renderer scales the whole
  // context by `zoom` when it draws, and doing it twice is what pushed the board off the left edge
  // the first time.
  illo.translate.x = CAMERA.offsetX;
  const root = new Zdog.Anchor({ addTo: illo });

  return {
    canvas,
    root,

    render() { illo.updateRenderGraph(); },
    update() { illo.updateGraph(); },

    viewport() {
      return { width, height, zoom: illo.zoom };
    },

    setCamera(pitch, yaw) {
      illo.rotate.x = pitch;
      illo.rotate.y = yaw;
    },

    camera() {
      return { pitch: illo.rotate.x, yaw: illo.rotate.y };
    },

    setZoom(zoom) { illo.zoom = zoom; },

    destroy() { illo.children.length = 0; },
  };
}
