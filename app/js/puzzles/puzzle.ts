// SPDX-License-Identifier: AGPL-3.0-or-later
// puzzles/puzzle — what a tactic IS, and how the set is fetched.
//
// ========================= THE SAME BARGAIN AS `teach/lesson.ts` =========================
// A puzzle is data, so everything worth claiming about one — the position is legal, the solution is
// playable from it, a mate-in-one really is mate in one — is a claim about data and holds in the
// node project with no board anywhere. `tests/puzzles.node.test.ts` is that check, and it runs
// against the SHIPPED file rather than against the script that wrote it.
//
// ========================= ⚠️ THE PLY OFFSET IS THE WHOLE RISK =========================
// The Lichess dump's `FEN` is the position BEFORE the opponent's move, and the first token of its
// `Moves` is that opponent move. `scripts/build-puzzles.mjs` applies it and stores what the student
// actually sees; `solution` therefore begins with the STUDENT's move.
//
// Get it wrong and nothing throws: the puzzle simply asks the wrong side to play a move from a
// position nobody was shown, and the person who finds out is a child being told they are wrong.
// So `solution.length` is always ODD, and the test asserts that rather than this comment.

import type { LocaleCode } from '../i18n/types.ts';

/** The themes the generator keeps. Named here so a mode can offer them without re-deriving them. */
export type PuzzleTheme = 'mateIn1' | 'mateIn2' | 'fork' | 'pin' | 'hangingPiece';

export interface Puzzle {
  /** Lichess's own id, which is also how a puzzle is traced back to `url`. */
  readonly id: string;
  readonly theme: PuzzleTheme;
  /** The position the STUDENT sees: after the opponent's move, with the student to play. */
  readonly fen: string;
  /** UCI tokens, student first, alternating. Always an odd number of them. */
  readonly solution: readonly string[];
  /** Which side the student plays. Redundant with the FEN, and kept because a menu needs it. */
  readonly side: 'w' | 'b';
  readonly rating: number;
  readonly url: string;
}

export interface PuzzleSet {
  readonly source: string;
  readonly licence: string;
  readonly note: string;
  readonly sampled: string;
  readonly themes: readonly PuzzleTheme[];
  readonly rating: { readonly min: number; readonly max: number };
  readonly puzzles: readonly Puzzle[];
}

/**
 * Fetches the curated set.
 *
 * ⚠️ A DYNAMIC IMPORT, for the reason `i18n/teach` is one: at 59 KB this is half the weight of the
 * whole flat page, and somebody who only wants to play a game should not carry it. It becomes its
 * own chunk, fetched when a puzzle is first asked for.
 */
export async function loadPuzzles(): Promise<PuzzleSet> {
  const module = await import('../../data/puzzles.json');
  return module.default as unknown as PuzzleSet;
}

/**
 * Whose move it is at a given point in a solution.
 *
 * ⚠️ EVEN IS THE STUDENT, ODD IS THE OPPONENT, and that is only true because the generator dropped
 * the dump's leading opponent move. Written as a function so the convention has one home rather
 * than being re-derived, differently, in a driver and in a test.
 */
export function isStudentMove(index: number): boolean {
  return index % 2 === 0;
}

/** i18n key for a theme's name, in the same `teach.`-style namespace the lessons use. */
export function themeKey(theme: PuzzleTheme, _locale?: LocaleCode): string {
  return `puzzle.theme.${theme}`;
}
