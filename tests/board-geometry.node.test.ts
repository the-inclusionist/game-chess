// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  isLightSquare, squareCenter, squareFromIndex, squareIndex,
} from '../app/js/render/board-geometry.ts';
import { fromAlgebraic } from '../app/js/chess/types.ts';

const sq = (name: string) => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

describe('[Colour] the board is oriented the way a real one is', () => {
  // Got this backwards in the spike, which is why it is pinned here. The rule every player
  // knows is "light square on the right", i.e. h1 is light — and a1, diagonally opposite,
  // is dark. With y counted from black, a1 is {x:0,y:7} and the parity is EVEN for light.
  it('h1 is light and a1 is dark', () => {
    expect(isLightSquare(sq('h1'))).toBe(true);
    expect(isLightSquare(sq('a1'))).toBe(false);
  });

  it('a8 is light and h8 is dark', () => {
    expect(isLightSquare(sq('a8'))).toBe(true);
    expect(isLightSquare(sq('h8'))).toBe(false);
  });

  it('e4 is light and d4 is dark', () => {
    expect(isLightSquare(sq('e4'))).toBe(true);
    expect(isLightSquare(sq('d4'))).toBe(false);
  });

  it('alternates along a rank and along a file', () => {
    for (let x = 0; x < 7; x++) {
      expect(isLightSquare({ x, y: 3 })).not.toBe(isLightSquare({ x: x + 1, y: 3 }));
    }
    for (let y = 0; y < 7; y++) {
      expect(isLightSquare({ x: 3, y })).not.toBe(isLightSquare({ x: 3, y: y + 1 }));
    }
  });

  it('splits the board evenly, 32 and 32', () => {
    let light = 0;
    for (let i = 0; i < 64; i++) if (isLightSquare(squareFromIndex(i))) light++;
    expect(light).toBe(32);
  });
});

describe('[Index] flat index and square agree', () => {
  it('round-trips all 64', () => {
    for (let i = 0; i < 64; i++) {
      expect(squareIndex(squareFromIndex(i))).toBe(i);
    }
  });

  it('starts at a8 and ends at h1, which is the order the squares are built in', () => {
    expect(squareFromIndex(0)).toEqual(sq('a8'));
    expect(squareFromIndex(63)).toEqual(sq('h1'));
  });
});

describe('[Layout] square centres in Zdog units', () => {
  it('centres the board on the origin', () => {
    const a8 = squareCenter(sq('a8'), 16);
    const h1 = squareCenter(sq('h1'), 16);
    expect(a8.x).toBeCloseTo(-h1.x, 10);
    expect(a8.z).toBeCloseTo(-h1.z, 10);
  });

  it('spaces squares one tile apart', () => {
    expect(squareCenter({ x: 1, y: 0 }, 16).x - squareCenter({ x: 0, y: 0 }, 16).x).toBeCloseTo(16, 10);
    expect(squareCenter({ x: 0, y: 1 }, 16).z - squareCenter({ x: 0, y: 0 }, 16).z).toBeCloseTo(16, 10);
  });

  it('puts the eight files across 7 tiles of span', () => {
    const span = squareCenter({ x: 7, y: 0 }, 16).x - squareCenter({ x: 0, y: 0 }, 16).x;
    expect(span).toBeCloseTo(7 * 16, 10);
  });
});
