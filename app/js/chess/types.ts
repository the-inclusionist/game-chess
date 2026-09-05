// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/types — the vocabulary of the game, and nothing else.
//
// A leaf module: zero imports, zero I/O. Everything downstream — rules, renderer, i18n, the
// engine declaration — agrees on these names, and none of them has to agree on anything more.
//
// The board is addressed the way the engine's grid topology addresses it: `{x, y}` with x as the
// FILE (0 = a) and y as the RANK COUNTED FROM BLACK (0 = rank 8, 7 = rank 1). That inversion is
// deliberate and worth stating once, here, rather than being rediscovered in four places: screen
// space runs top-down, the engine's grid runs top-down, and chess notation runs bottom-up. Only
// `toAlgebraic` and `fromAlgebraic` know about the flip.

/** Piece kinds, in the one-letter form chess.js and FEN both use. */
export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';

/** 'w' and 'b', matching chess.js so no translation layer is needed at the boundary. */
export type Side = 'w' | 'b';

export interface Piece {
  readonly type: PieceType;
  readonly side: Side;
}

/** A board address. `x` is the file (0 = a); `y` is the rank counted from black (0 = rank 8). */
export interface Square {
  readonly x: number;
  readonly y: number;
}

export const FILES = 8;
export const RANKS = 8;

export function isOnBoard(s: Square): boolean {
  return s.x >= 0 && s.x < FILES && s.y >= 0 && s.y < RANKS;
}

export function sameSquare(a: Square, b: Square): boolean {
  return a.x === b.x && a.y === b.y;
}

/** `{x:4, y:6}` → `"e2"`. The rank flip lives here and only here. */
export function toAlgebraic(s: Square): string {
  return String.fromCharCode(97 + s.x) + String(RANKS - s.y);
}

/** `"e2"` → `{x:4, y:6}`. Returns null for anything that is not a square name. */
export function fromAlgebraic(name: string): Square | null {
  if (name.length !== 2) return null;
  const x = name.charCodeAt(0) - 97;
  const rank = Number(name[1]);
  if (!Number.isInteger(rank)) return null;
  const y = RANKS - rank;
  const square = { x, y };
  return isOnBoard(square) ? square : null;
}
