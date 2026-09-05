// SPDX-License-Identifier: AGPL-3.0-or-later
// render/board-geometry — where a square sits and what colour it is.
//
// Pure arithmetic, deliberately separated from `board.ts`: this half is provable in the node
// project against known chess facts, and the Zdog half is left with nothing to get wrong but
// wiring. The prototype in spike 0 shaded the board inverted, which is precisely the kind of
// error that looks fine until someone who plays chess glances at it — hence the tests.

import { FILES, RANKS, type Square } from '../chess/types.ts';

/**
 * Light square? The rule every player knows is "light square on the right": h1 is light, and a1
 * diagonally opposite is dark.
 *
 * With `y` counted from black (a8 is `{0,0}`, a1 is `{0,7}`), that makes EVEN parity light.
 */
export function isLightSquare(s: Square): boolean {
  return (s.x + s.y) % 2 === 0;
}

/** Flat index, a8 → 0 through h1 → 63. The order the 64 square nodes are built in. */
export function squareIndex(s: Square): number {
  return s.y * FILES + s.x;
}

export function squareFromIndex(index: number): Square {
  return { x: index % FILES, y: Math.floor(index / FILES) };
}

/**
 * Centre of a square on the board plane, in Zdog units, with the board centred on the origin.
 *
 * The board lies in the XZ plane — Zdog's Y is the vertical axis and points DOWN, so pieces
 * extend into negative Y. Rank maps to Z, file maps to X.
 */
export function squareCenter(s: Square, tile: number): { x: number; z: number } {
  return {
    x: (s.x - (FILES - 1) / 2) * tile,
    z: (s.y - (RANKS - 1) / 2) * tile,
  };
}
