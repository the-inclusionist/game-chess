// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest';
import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import { createFrameTicker, type FrameTicker } from '../app/js/render/frame-ticker.ts';
import { createBoard } from '../app/js/render/board.ts';
import { LOGICAL_H, LOGICAL_W } from '../app/js/render/resolution.ts';
import { createZdogStage, type ZdogStage } from '../app/js/render/zdog-stage.ts';

// ========================= WHAT THIS REPLACED =========================
// `pixi-surface.browser.test.ts` guarded a seam that no longer exists. Its central case was that
// the board must not "freeze on its first frame" — the failure where forgetting `texture.update()`
// leaves the picture on frame one while input, state and the screen reader all keep working.
//
// That bug CANNOT HAPPEN NOW. There is no second copy of the picture: Zdog draws into the canvas
// that is in the document. The test is gone because the failure mode is gone, which is a better
// outcome than a passing test.
//
// What is left to prove is the clock, and the contract it has to satisfy is exact. `core/loop.ts`
// reads `ticker.deltaTime` at the moment it calls the frame, and calls `ticker.remove?.(fn)` when
// a frame throws so a broken game stops costing sixty wake-ups a second. Both are load-bearing.

let ticker: FrameTicker | null = null;
let stage: ZdogStage | null = null;

afterEach(() => {
  ticker?.destroy();
  stage?.destroy();
  ticker = null;
  stage = null;
});

/** A hand-cranked animation frame, so the clock can be tested without waiting for a real one. */
function fakeClock() {
  let pending: ((now: number) => void) | null = null;
  let cancelled: number[] = [];
  return {
    raf: (fn: (now: number) => void) => { pending = fn; return 1; },
    cancel: (handle: number) => { cancelled.push(handle); },
    now: () => 0,
    advance(at: number) {
      const fn = pending;
      pending = null;
      fn?.(at);
    },
    get cancelled() { return cancelled; },
  };
}

describe('[Ticker] the shape core/loop.ts actually requires', () => {
  it('reports the FIRST frame as one, not as zero and not as the age of the page', () => {
    const clock = fakeClock();
    ticker = createFrameTicker(clock);
    const seen: number[] = [];
    ticker.add(() => seen.push(ticker!.deltaTime));

    clock.advance(4321);
    expect(seen).toEqual([1]);
  });

  it('measures later frames in FRAMES, not milliseconds', () => {
    const clock = fakeClock();
    ticker = createFrameTicker(clock);
    const seen: number[] = [];
    ticker.add(() => seen.push(ticker!.deltaTime));

    clock.advance(0);
    clock.advance(1000 / 60);        // exactly one frame at 60 fps
    clock.advance(1000 / 60 + 50);   // three frames of catching up
    expect(seen[1]).toBeCloseTo(1, 6);
    expect(seen[2]).toBeCloseTo(3, 1);
  });

  it('sets deltaTime BEFORE calling, which is when startLoop reads it', () => {
    // Not a detail: `startLoop` does `frame(Math.min(ticker.deltaTime, maxDt))` inside the
    // callback. A ticker that updated the value afterwards would hand every frame the last one.
    const clock = fakeClock();
    ticker = createFrameTicker(clock);
    const seen: number[] = [];
    startLoop(ticker, (dt) => seen.push(dt), 2);

    clock.advance(0);
    clock.advance(1000 / 60);
    expect(seen).toEqual([1, 1]);
  });

  it('clamps through startLoop, so a backgrounded tab does not jump the board', () => {
    const clock = fakeClock();
    ticker = createFrameTicker(clock);
    const seen: number[] = [];
    startLoop(ticker, (dt) => seen.push(dt), 2);

    clock.advance(0);
    clock.advance(30_000);   // half a minute in another tab
    expect(seen.at(-1)).toBe(2);
  });

  it('lets startLoop unregister itself when a frame throws', () => {
    // The engine's rule: catch ONCE, stop, and announce. `remove` is how it stops costing anything.
    const clock = fakeClock();
    ticker = createFrameTicker(clock);
    let calls = 0;
    let announced: unknown = null;
    startLoop(ticker, () => { calls++; throw new Error('boom'); }, 2, {
      aoFalhar: (erro) => { announced = erro; },
    });

    clock.advance(0);
    clock.advance(16);
    clock.advance(32);
    expect(calls).toBe(1);
    expect((announced as Error).message).toBe('boom');
  });

  it('survives a listener removing itself mid-tick', () => {
    // Which is exactly what startLoop does on the throwing frame: the array being iterated is
    // mutated from inside the iteration.
    const clock = fakeClock();
    ticker = createFrameTicker(clock);
    const order: string[] = [];
    const first = (): void => { order.push('first'); ticker!.remove(first); };
    ticker.add(first);
    ticker.add(() => order.push('second'));

    clock.advance(0);
    expect(order).toEqual(['first', 'second']);
  });

  it('stops for good once destroyed', () => {
    const clock = fakeClock();
    ticker = createFrameTicker(clock);
    let calls = 0;
    ticker.add(() => { calls++; });
    clock.advance(0);
    ticker.destroy();
    clock.advance(16);
    expect(calls).toBe(1);
  });
});

describe('[Surface] the Zdog canvas IS the screen now', () => {
  it('is the logical size, with no texture between it and the eye', () => {
    stage = createZdogStage();
    expect(stage.canvas.width).toBe(LOGICAL_W);
    expect(stage.canvas.height).toBe(LOGICAL_H);
  });

  it('carries a board after one render', () => {
    stage = createZdogStage();
    createBoard(stage.root);
    stage.render();

    const ctx = stage.canvas.getContext('2d');
    const data = ctx!.getImageData(0, 0, stage.canvas.width, stage.canvas.height).data;
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 128) painted++;
    expect(painted).toBeGreaterThan(2000);
  });

  it('redraws when the camera moves — no upload step to forget', () => {
    stage = createZdogStage();
    createBoard(stage.root);
    const signature = (): string => {
      const ctx = stage!.canvas.getContext('2d');
      const d = ctx!.getImageData(0, 0, stage!.canvas.width, stage!.canvas.height).data;
      let h = 0x811c9dc5;
      for (let i = 0; i < d.length; i += 97) h = Math.imul(h ^ d[i], 0x01000193);
      return String(h >>> 0);
    };

    stage.render();
    const first = signature();
    stage.setCamera(-0.55, 0.8);
    stage.render();
    expect(signature()).not.toBe(first);
  });
});
