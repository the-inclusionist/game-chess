// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest';
import { createBoard } from '../app/js/render/board.ts';
import { createPixiSurface, type PixiSurface } from '../app/js/render/pixi-surface.ts';
import { createZdogStage, type ZdogStage } from '../app/js/render/zdog-stage.ts';

// ========================= WHAT THIS PROVES =========================
// That the seam actually carries a picture. Zdog draws into an offscreen 320×180 canvas, PixiJS
// takes that canvas as a NEAREST-sampled texture, and the sprite sits at the engine's TILES layer
// with the HUD above it. The failure this guards against is specific and silent: forgetting to
// mark the texture dirty leaves the board frozen on its first frame, with everything else — input,
// state, the screen reader — working perfectly.

let stage: ZdogStage | null = null;
let surface: PixiSurface | null = null;

function build() {
  stage = createZdogStage();
  const board = createBoard(stage.root);
  surface = createPixiSurface(stage.canvas);
  return { stage, board, surface };
}

afterEach(() => {
  surface?.destroy();
  stage?.destroy();
  surface = null;
  stage = null;
});

/** Reads back the PixiJS canvas — the composited result, not the Zdog source. */
function composited(s: PixiSurface): Uint8ClampedArray {
  const ctx = s.view.getContext('2d');
  if (ctx) return ctx.getImageData(0, 0, s.view.width, s.view.height).data;
  // A WebGL canvas has no 2D context; copy it through one.
  const copy = document.createElement('canvas');
  copy.width = s.view.width;
  copy.height = s.view.height;
  const c2d = copy.getContext('2d');
  if (!c2d) throw new Error('no 2d context available for readback');
  c2d.drawImage(s.view, 0, 0);
  return c2d.getImageData(0, 0, copy.width, copy.height).data;
}

function signature(data: Uint8ClampedArray): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) h = Math.imul(h ^ data[i], 0x01000193);
  return String(h >>> 0);
}

describe('[Surface] the compositor keeps the engine pixel identity', () => {
  it('is 320×180 at resolution 1', () => {
    const { surface: s } = build();
    expect(s.view.width).toBe(320);
    expect(s.view.height).toBe(180);
  });

  it('exposes a ticker shaped the way the engine startLoop expects', () => {
    const { surface: s } = build();
    expect(typeof s.ticker.add).toBe('function');
    expect(typeof s.ticker.deltaTime).toBe('number');
  });

  it('gives the HUD a container above the board', () => {
    const { surface: s } = build();
    // Z.TILES is 8000 and Z.HUD is 24000 in the engine's stack.
    expect(s.hud.zIndex).toBeGreaterThan(8000);
  });
});

describe('[Surface] the Zdog frame reaches the screen', () => {
  it('composites a board that is not blank', () => {
    const { stage: z, surface: s } = build();
    z.render();
    s.present();
    s.render();

    const data = composited(s);
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Anything clearly brighter than the 0x05070f background counts as drawn.
      if (data[i] > 40 || data[i + 1] > 40 || data[i + 2] > 40) lit++;
    }
    expect(lit).toBeGreaterThan(2000);
  });

  it('does not freeze on the first frame — the texture is re-uploaded', () => {
    // The bug this catches has no symptom anywhere else: input, state and the screen reader all
    // keep working while the picture stays on frame one.
    const { stage: z, surface: s } = build();
    z.render();
    s.present();
    s.render();
    const first = signature(composited(s));

    z.setCamera(-0.55, 0.8);
    z.render();
    s.present();
    s.render();
    const second = signature(composited(s));

    expect(second).not.toBe(first);
  });

  it('leaves the picture alone when nothing moved', () => {
    const { stage: z, surface: s } = build();
    z.render();
    s.present();
    s.render();
    const a = signature(composited(s));
    s.present();
    s.render();
    expect(signature(composited(s))).toBe(a);
  });
});
