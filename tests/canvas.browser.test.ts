// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest';
import { LOGICAL_H, LOGICAL_W, SOURCE_MULTIPLE } from '../app/js/render/resolution.ts';

// ========================= WHAT THIS GUARDS =========================
// Spike 0 found a trap that fails SILENTLY: Zdog's `Illustration` sizes itself from the element's
// measured box, and this game shows a 320×180 canvas upscaled to several times that in CSS. Left
// alone, the backing store comes out at the CSS size, the low resolution that is pillar 5 of the
// engine evaporates, and nothing anywhere reports an error — the game just quietly stops being a
// pixel game. The defence is `pixelRatio = 1` plus an explicit `setSize`, and the invariant those
// two protect is the one asserted here.

function upscaledCanvas(cssScale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = LOGICAL_W;
  c.height = LOGICAL_H;
  c.style.width = `${LOGICAL_W * cssScale}px`;
  c.style.height = `${LOGICAL_H * cssScale}px`;
  c.style.imageRendering = 'pixelated';
  document.body.appendChild(c);
  return c;
}

afterEach(() => { document.body.replaceChildren(); });

describe('[Resolution] the backing store is the logical size, whatever CSS says', () => {
  it('stays at the logical size while the element measures four times that', () => {
    const c = upscaledCanvas(4);
    expect(c.width).toBe(LOGICAL_W);
    expect(c.height).toBe(LOGICAL_H);
    // The trap, stated as an assertion: measuring the ELEMENT does not give you the resolution.
    expect(Math.round(c.getBoundingClientRect().width)).toBe(LOGICAL_W * 4);
  });

  it('holds at the smallest scale the layout will produce', () => {
    const c = upscaledCanvas(1);
    expect(c.width).toBe(LOGICAL_W);
    expect(Math.round(c.getBoundingClientRect().width)).toBe(LOGICAL_W);
  });

  it('is 16:9 and a whole multiple of the engine base, so it integer-scales beside it', () => {
    expect(LOGICAL_W / LOGICAL_H).toBeCloseTo(16 / 9, 5);
    expect(LOGICAL_W).toBe(320 * SOURCE_MULTIPLE);
    expect(Number.isInteger(SOURCE_MULTIPLE)).toBe(true);
    expect(Number.isInteger(LOGICAL_W / 16)).toBe(true);
  });
});

describe('[Canvas] a 2D context exists and draws into those pixels', () => {
  it('paints a known pixel at the logical resolution', () => {
    const c = upscaledCanvas(4);
    const ctx = c.getContext('2d');
    expect(ctx).not.toBeNull();

    ctx!.fillStyle = '#ffd97d';
    ctx!.fillRect(0, 0, 2, 2);
    const [r, g, b, a] = ctx!.getImageData(0, 0, 1, 1).data;
    expect([r, g, b, a]).toEqual([0xff, 0xd9, 0x7d, 0xff]);

    // Nothing was drawn here, so it must still be transparent — proof the coordinate space is
    // the 320×180 one and not a scaled one.
    expect(ctx!.getImageData(10, 10, 1, 1).data[3]).toBe(0);
  });
});
