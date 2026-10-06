// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE ARITHMETIC OF SHRINKING TO FIT =========================
// `fitScale` is pulled out of `applyLayout` so the decision can be tested without a page, because
// the decision is where the two wrong attempts of 2026-10-06 went wrong — not the DOM work.
//
// The Dev asked why a phone held sideways cuts the interface rather than shrinking it. The floor
// turned out to belong to the ENGINE (`MIN_K = 2`, «EACH viewport is at least 640×360»), which
// sizes `#game-region` after this module runs, so the fix had to scale what the engine produced
// instead of arguing with it.
import { describe, expect, it } from 'vitest';
import { fitScale } from '../app/js/ui/layout.ts';

describe('[Fit] a stage too tall for the screen is scaled down, on the integer ladder', () => {
  it('leaves a stage that already fits completely alone', () => {
    // 1 means «no transform at all», and the caller writes an empty string for it. A 0.999 here
    // would put a transform on every desktop in the catalogue for nothing.
    expect(fitScale(414, 700, 2)).toBe(1);
    expect(fitScale(414, 414, 2)).toBe(1);
  });

  it('🔴 fits the four landscape phones this was measured on', () => {
    /*
     * The numbers are the measurement of 2026-10-06, not invented: the stage is 360 tall at the
     * engine's floor and the strip under it 54, so 414 has to fit into the phone's height.
     *
     *   iPhone SE      375 tall, dpr 2  → 414 × 1/2 = 207 ✓
     *   Android 360dp  360 tall, dpr 2  → 207 ✓
     *   iPhone 14      390 tall, dpr 3  → 414 × 2/3 = 276 ✓
     *   Pixel 7        393 tall, dpr 2.6 → round(2.6) = 3, so 2/3 as well
     */
    expect(fitScale(414, 375, 2)).toBe(1 / 2);
    expect(fitScale(414, 360, 2)).toBe(1 / 2);
    expect(fitScale(414, 390, 3)).toBe(2 / 3);
    expect(fitScale(469, 393, 2.6)).toBe(2 / 3);
  });

  it('⚠️ takes the LARGEST rung that fits, not the smallest that would', () => {
    // Walking up from 1/steps would hand a phone the tiniest legal board when a bigger one fits.
    // 414 into 390 at dpr 3: 2/3 works, so 1/3 must never be chosen.
    expect(fitScale(414, 390, 3)).toBe(2 / 3);
    // And when only the smallest rung is enough, it is taken.
    expect(fitScale(1200, 420, 3)).toBe(1 / 3);
  });

  it('🔴 refuses to scale a device ratio of 1, because there is no integer below one', () => {
    /*
     * The honest limit, and the reason it is a limit rather than an oversight: under one whole
     * physical pixel per art pixel there is no integer left, and buying a few pixels by resampling
     * the art is the trade this renderer exists to refuse. A plain desktop overflows as it did.
     */
    expect(fitScale(1134, 1080, 1)).toBe(1);
    expect(fitScale(10_000, 300, 1)).toBe(1);
  });

  it('⚠️ gives up rather than returning something unusable when nothing fits', () => {
    // A box so short that even the last rung overflows gets 1 — the caller then draws as it always
    // did and the clipping is visible, which is better than an interface scaled to nothing.
    expect(fitScale(10_000, 100, 3)).toBe(1);
  });

  it('survives the degenerate boxes a detached or hidden element reports', () => {
    expect(fitScale(0, 390, 3)).toBe(1);
    expect(fitScale(414, 0, 3)).toBe(1);
    expect(fitScale(Number.NaN, 390, 3)).toBe(1);
  });

  it('every answer it ever gives keeps the art on whole physical pixels', () => {
    /*
     * ⚠️ THE PROPERTY, NOT A CASE. `scale × steps` must come out a whole number for every input, or
     * the board stops landing on whole physical pixels and this whole mechanism has bought a
     * resampled raster — which is what ADR-001 exists to prevent.
     */
    for (const dpr of [1, 2, 2.6, 3, 4]) {
      const steps = Math.max(1, Math.round(dpr));
      for (let needed = 100; needed <= 2000; needed += 37) {
        for (let room = 100; room <= 1200; room += 53) {
          const k = fitScale(needed, room, dpr) * steps;
          expect(`${dpr}/${needed}/${room}: ${Number.isInteger(k)}`)
            .toBe(`${dpr}/${needed}/${room}: true`);
        }
      }
    }
  });
});
