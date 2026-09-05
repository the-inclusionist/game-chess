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
  zoom: 1.15,
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

export function createZdogStage(): ZdogStage {
  const canvas = document.createElement('canvas');
  canvas.width = LOGICAL_W;
  canvas.height = LOGICAL_H;

  const illo: Illustration = new Zdog.Illustration({
    element: canvas,
    zoom: CAMERA.zoom,
    centered: true,
    // The engine owns the frame loop and the pointer; Zdog must not add listeners of its own.
    resize: false,
    dragRotate: false,
  });

  // ⚠️ Both lines are the invariant described at the top. Do not remove either.
  illo.pixelRatio = 1;
  illo.setSize(LOGICAL_W, LOGICAL_H);

  illo.rotate.x = CAMERA.pitch;
  illo.rotate.y = CAMERA.yaw;

  const root = new Zdog.Anchor({ addTo: illo, translate: { x: CAMERA.offsetX } });

  return {
    canvas,
    root,

    render() { illo.updateRenderGraph(); },
    update() { illo.updateGraph(); },

    viewport() {
      return { width: LOGICAL_W, height: LOGICAL_H, zoom: illo.zoom };
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
