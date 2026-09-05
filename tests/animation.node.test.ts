// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  createMoveAnimation, MOVE_FRAMES, type MoveAnimation,
} from '../app/js/render/animation.ts';
import { fromAlgebraic, type Square } from '../app/js/chess/types.ts';

const sq = (name: string): Square => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

/**
 * Runs the animation to completion, as the engine's loop would, and returns the dt consumed.
 *
 * Counts EVERY call rather than only the ones that return true: the final advance is the one
 * that lands the piece, and skipping it undercounts by exactly one tick.
 */
function runToEnd(a: MoveAnimation, step = 1): number {
  let frames = 0;
  while (!a.done()) {
    a.advance(step);
    frames += step;
    if (frames > 1000) throw new Error('animation never finished');
  }
  return frames;
}

describe('[Travel] the piece leaves one square and arrives at the other', () => {
  it('starts exactly on the origin square', () => {
    const a = createMoveAnimation(sq('e2'), sq('e4'));
    const start = a.position();
    expect(a.progress()).toBe(0);
    expect(start.lift).toBeCloseTo(0, 10);
  });

  it('ends exactly on the destination square', () => {
    const a = createMoveAnimation(sq('e2'), sq('e4'));
    runToEnd(a);
    const end = a.position();
    const target = createMoveAnimation(sq('e4'), sq('e4')).position();
    expect(a.done()).toBe(true);
    expect(a.progress()).toBe(1);
    expect(end.x).toBeCloseTo(target.x, 10);
    expect(end.z).toBeCloseTo(target.z, 10);
    expect(end.lift).toBeCloseTo(0, 10);
  });

  it('passes between the two squares on the way', () => {
    const a = createMoveAnimation(sq('a1'), sq('h8'));
    const from = a.position();
    a.advance(MOVE_FRAMES / 2);
    const middle = a.position();
    runToEnd(a);
    const to = a.position();

    expect(middle.x).toBeGreaterThan(Math.min(from.x, to.x));
    expect(middle.x).toBeLessThan(Math.max(from.x, to.x));
    expect(middle.z).toBeGreaterThan(Math.min(from.z, to.z));
    expect(middle.z).toBeLessThan(Math.max(from.z, to.z));
  });

  it('advances monotonically — a piece never slides backwards', () => {
    const a = createMoveAnimation(sq('a1'), sq('h8'));
    let previous = a.position().x;
    for (let i = 0; i < MOVE_FRAMES; i++) {
      a.advance(1);
      const now = a.position().x;
      expect(now).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = now;
    }
  });
});

describe('[Arc] the piece rises and settles', () => {
  it('lifts in the middle and touches down at both ends', () => {
    const a = createMoveAnimation(sq('b1'), sq('c3'));
    expect(a.position().lift).toBeCloseTo(0, 10);
    a.advance(MOVE_FRAMES / 2);
    // Zdog Y points down, so a lift is NEGATIVE.
    expect(a.position().lift).toBeLessThan(0);
    runToEnd(a);
    expect(a.position().lift).toBeCloseTo(0, 10);
  });

  it('never lifts a piece higher than a square is wide', () => {
    const a = createMoveAnimation(sq('a1'), sq('h8'));
    for (let i = 0; i <= MOVE_FRAMES; i++) {
      expect(Math.abs(a.position().lift)).toBeLessThan(16);
      a.advance(1);
    }
  });
});

describe('[Time] dt is counted in FRAMES, not seconds', () => {
  // Inherited from the engine and stated in its own loop: "physics copied from a seconds-based
  // tutorial runs wrong". A move that took MOVE_FRAMES seconds instead of frames would last
  // several minutes, and nothing would report an error — the board would just seem frozen.
  it('finishes in exactly MOVE_FRAMES frames of dt = 1', () => {
    const a = createMoveAnimation(sq('e2'), sq('e4'));
    expect(runToEnd(a, 1)).toBe(MOVE_FRAMES);
  });

  it('finishes in half as many ticks at dt = 2, which is the loop clamp', () => {
    const a = createMoveAnimation(sq('e2'), sq('e4'));
    expect(runToEnd(a, 2)).toBe(MOVE_FRAMES);
  });

  it('clamps rather than overshooting when handed a huge dt', () => {
    const a = createMoveAnimation(sq('e2'), sq('e4'));
    a.advance(9999);
    expect(a.progress()).toBe(1);
    expect(a.done()).toBe(true);
    expect(a.advance(1)).toBe(false);
  });
});

describe('[Reduced motion] the piece is simply there', () => {
  // The engine exposes reduced motion per element rather than as one switch, and a moving piece
  // is exactly the kind of thing it covers. Instant is not a degraded animation: it is the
  // correct behaviour, and it must land on the destination, not skip the arrival.
  it('is finished before the first frame', () => {
    const a = createMoveAnimation(sq('e2'), sq('e4'), { reducedMotion: true });
    expect(a.done()).toBe(true);
    expect(a.progress()).toBe(1);
    expect(a.advance(1)).toBe(false);
  });

  it('sits on the destination with no lift', () => {
    const a = createMoveAnimation(sq('a1'), sq('h8'), { reducedMotion: true });
    const target = createMoveAnimation(sq('h8'), sq('h8')).position();
    expect(a.position().x).toBeCloseTo(target.x, 10);
    expect(a.position().z).toBeCloseTo(target.z, 10);
    expect(a.position().lift).toBeCloseTo(0, 10);
  });
});

describe('[Degenerate] a move that goes nowhere', () => {
  it('finishes without dividing by zero', () => {
    const a = createMoveAnimation(sq('e4'), sq('e4'));
    expect(() => runToEnd(a)).not.toThrow();
    expect(a.done()).toBe(true);
  });
});
