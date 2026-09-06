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

/*
 * ================= ⚠️ THE ⚠️ERS LIVE HERE, NOT BESIDE THE THING THAT DRAWS THEM =================
 * `render/board.ts` imports Zdog, and Zdog is 146 KB that the flat board never loads. The shell
 * that drives all three views has to name a marker to hand one to a view, and naming it from
 * `board.ts` would put a `import type` one careless keystroke away from becoming a value import —
 * which does not fail, does not warn, and quietly puts a renderer in a bundle built to avoid one.
 *
 * This module imports `chess/types.ts` and nothing else. It cannot carry Zdog in by accident.
 */

/**
 * ========================= SHAPE, NOT ONLY COLOUR =========================
 * WCAG 1.4.1: colour must never be the only carrier of meaning. So the three markers that
 * co-occur during a turn are told apart by FORM:
 *
 *   · `move`     — a filled dot in the middle of an empty destination
 *   · `capture`  — an outline ring around the square, with no dot
 *   · `selected` — outline AND dot together
 *
 * `check` is the exception, and it is an honest one: it is an outline like `capture`, on a square
 * that is never simultaneously a capture target for the side in check. Its primary channel is not
 * visual at all — it goes out through `srAlert`, assertively.
 *
 * `cursor` is where the KEYBOARD is. The DOM grid that carries the board for a screen reader is
 * visually hidden, so a sighted person navigating by keyboard would otherwise have focus sitting
 * somewhere invisible. This marker is that focus, drawn on the board.
 *
 * `lesson` is the teaching mode's "look here", and it needed a THIRD FORM rather than a third
 * colour — an inner filled square, smaller than the ring, so it reads as a different shape at any
 * size and in any palette. The reason is the rule above rather than an exception to it: a lesson
 * highlight COINCIDES with `selected` and with `move`, because the child picks the taught piece up
 * while the square they were told to look at is still lit. A second ring in another colour would
 * be a 1.4.1 failure in the one mode whose whole purpose is to teach.
 *
 * `lessonRight` and `lessonWrong` answer a square the student just touched. ⚠️ They are told apart
 * by FILL, not by colour: blue and red measure 1.06:1 against each other, so a reader going by
 * lightness sees one mark, not two. Right is filled; wrong is hollow.
 */
export type Marker =
  | 'cursor' | 'selected' | 'move' | 'capture' | 'check'
  | 'lesson' | 'lessonRight' | 'lessonWrong';
