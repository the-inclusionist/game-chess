// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  FILES, RANKS, fromAlgebraic, isOnBoard, sameSquare, toAlgebraic,
} from '../app/js/chess/types.ts';

describe('[Addressing] the rank flip lives in one place', () => {
  // Screen space and the engine's grid topology both run top-down; chess notation runs bottom-up.
  // These four cases pin the corners, which is where an off-by-one would otherwise hide until a
  // screen reader announced the wrong square.
  it('pins the four corners', () => {
    expect(toAlgebraic({ x: 0, y: 0 })).toBe('a8');
    expect(toAlgebraic({ x: 7, y: 0 })).toBe('h8');
    expect(toAlgebraic({ x: 0, y: 7 })).toBe('a1');
    expect(toAlgebraic({ x: 7, y: 7 })).toBe('h1');
  });

  it("puts white's king pawn on e2", () => {
    expect(toAlgebraic({ x: 4, y: 6 })).toBe('e2');
    expect(fromAlgebraic('e2')).toEqual({ x: 4, y: 6 });
  });

  it('round-trips all 64 squares', () => {
    for (let x = 0; x < FILES; x++) {
      for (let y = 0; y < RANKS; y++) {
        expect(fromAlgebraic(toAlgebraic({ x, y }))).toEqual({ x, y });
      }
    }
  });

  it('produces 64 distinct names', () => {
    const names = new Set<string>();
    for (let x = 0; x < FILES; x++) {
      for (let y = 0; y < RANKS; y++) names.add(toAlgebraic({ x, y }));
    }
    expect(names.size).toBe(64);
  });
});

describe('[Addressing] rejects what is not a square', () => {
  it.each(['', 'e', 'e22', 'z4', 'e9', 'e0', 'E2', '4e'])('rejects %o', (bad) => {
    expect(fromAlgebraic(bad)).toBeNull();
  });
});

describe('[Bounds]', () => {
  it('accepts the board and rejects everything past its edge', () => {
    expect(isOnBoard({ x: 0, y: 0 })).toBe(true);
    expect(isOnBoard({ x: 7, y: 7 })).toBe(true);
    expect(isOnBoard({ x: -1, y: 0 })).toBe(false);
    expect(isOnBoard({ x: 8, y: 0 })).toBe(false);
    expect(isOnBoard({ x: 0, y: 8 })).toBe(false);
  });

  it('compares squares by value, not by identity', () => {
    expect(sameSquare({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(true);
    expect(sameSquare({ x: 3, y: 4 }, { x: 4, y: 3 })).toBe(false);
  });
});
