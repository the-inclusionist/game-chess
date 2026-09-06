// SPDX-License-Identifier: AGPL-3.0-or-later
// teach/lesson — what a lesson IS, as data.
//
// ========================= WHY A TABLE AND NOT A SCRIPT =========================
// `render/pieces/geometry.ts` made this argument first and the argument transfers exactly: a table
// of boxes can be reasoned about without a renderer, so every claim worth holding about a piece —
// it fits its square, it stands on the board, the six heights read in the order a player expects —
// holds in the node project, in milliseconds, with no canvas anywhere.
//
// A table of lessons is the same bargain one level up. "This lesson's goal is reachable from this
// lesson's position" is a claim about chess and about data, and it can be checked without a board,
// a panel, a renderer or a browser. `tests/teach-lesson.node.test.ts` is that check, and it is what
// makes the table safe to grow: a lesson that asks for an impossible move fails a test rather than
// failing a child.
//
// ========================= ⚠️ THE MODEL IS ALREADY IN `MoveResult` =========================
// This is the fact the whole design rests on. `chess/rules.ts` returns, for every move:
//
//     { from, to, piece, captured, san, promotion, castle, enPassant, check, checkmate }
//
// Castling is a FLAG. En passant is a FLAG. Promotion carries the piece. So "castle kingside",
// "capture en passant" and "promote to a queen" — the three special rules a beginner has to be
// taught explicitly — are already first-class vocabulary here. `MoveShape` is nothing but that
// record with every field made optional, and matching is a conjunction of equalities.
//
// That is why this is a table. The alternative was a predicate function per step, which is a
// scripting language wearing a type, and which no test can check: a function can only be RUN, and
// running it needs the position it was written for.

import type { MoveResult } from '../chess/rules.ts';
import { fromAlgebraic, toAlgebraic, type PieceType } from '../chess/types.ts';

/** `'a1'` to `'h8'`. Validated by the table test, never at runtime — a typo is a bug, not an input. */
export type SquareName = string;

/**
 * A move described by what must be TRUE of it.
 *
 * Every field present must match; an absent field means "don't care". So `{ from: 'g1', to: 'f3' }`
 * is one exact move, `{ piece: 'n' }` is any knight move at all, and `{}` is any move — which is
 * what a first step asking a child to touch something, anything, actually wants.
 *
 * ⚠️ PREFER THE FLAGS OVER `san`. `{ castle: 'king' }` says what is being taught; `{ san: 'O-O' }`
 * says how it is written down. The first survives a change of notation, reads as the lesson it is,
 * and cannot be misspelled in a way that still parses.
 */
export interface MoveShape {
  readonly from?: SquareName;
  readonly to?: SquareName;
  readonly piece?: PieceType;
  /** A specific piece taken, or `true` for any capture at all. */
  readonly captures?: PieceType | true;
  readonly castle?: 'king' | 'queen';
  readonly enPassant?: true;
  /** A specific promotion, or `true` for any. */
  readonly promotion?: PieceType | true;
  /** The escape hatch, and the last one. */
  readonly san?: string;
}

/**
 * What a step asks the student to do.
 *
 * Three shapes cover every requirement of the first stage: how each piece moves, the three special
 * rules, the value of the pieces, and reading a1–h8 in both directions.
 *
 * ⚠️ WHEN A STEP NEEDS A CONDITION, A BRANCH OR A VARIABLE, the answer is a fourth named shape —
 * not an interpreter. The moment this union grows an `if`, it has stopped being a table.
 */
export type Task =
  /** Play a move that fits. The board is the answer sheet. */
  | { readonly kind: 'play'; readonly want: MoveShape }
  /**
   * Point at a SET of squares. Order does not matter; the set does.
   *
   * One square is "touch e4" — the notation lesson, and the same gesture the game's own hint asks
   * for. Several is "find every square this bishop attacks".
   */
  | { readonly kind: 'mark'; readonly want: readonly SquareName[] }
  /**
   * Pick one written answer.
   *
   * Options are i18n KEYS, except that `i18n.t()` returns the key itself when nothing has it — a
   * documented contract, not an accident — so a literal square name like `'d4'` passes through
   * untranslated and `'piece.r'` is translated. One rule, no union type, and the typo it allows is
   * closed by the table test rather than by the compiler.
   */
  | { readonly kind: 'pick'; readonly options: readonly string[]; readonly answer: number };

export interface Step {
  /**
   * The position this step starts from.
   *
   * ⚠️ ABSENT MEANS "CARRY ON FROM WHERE THE LAST STEP LEFT THE BOARD". That is what makes "take
   * the knight to f3, now to g5" one lesson and not two, and it is why this is optional rather
   * than required-with-a-default.
   *
   * ⚠️ THE FEN ALSO SAYS WHOSE TURN IT IS. There is deliberately no `side` field: a second place to
   * say the same thing is a second place for it to be wrong.
   *
   * ⚠️ AND IT CARRIES TWO KINGS, ALWAYS. chess.js refuses a board without them —
   * "Invalid FEN: missing white king" — so even the notation lesson, which is about nothing but
   * square names, puts a king in each far corner and works around them.
   */
  readonly fen?: string;
  /** i18n key. What the student reads, and what `srSay` puts in `#sr-status`. */
  readonly say: string;
  readonly task: Task;
  /** Squares to light and arrows to draw while the step is open. Data, not drawing calls. */
  readonly show?: {
    readonly squares?: readonly SquareName[];
    readonly arrows?: readonly (readonly [SquareName, SquareName])[];
  };
  /** i18n key, said once after a wrong answer. */
  readonly nudge?: string;
}

export interface Lesson {
  readonly id: string;
  /** i18n key. */
  readonly title: string;
  readonly steps: readonly Step[];
  /**
   * Lessons that come first.
   *
   * Keeps the syllabus DATA rather than an array index: a lesson inserted in the middle does not
   * silently reorder everything after it, and the ordering can be checked for cycles.
   */
  readonly after?: readonly string[];
}

/**
 * Does this move satisfy the goal?
 *
 * Every field the shape names must hold; every field it omits is not asked about. Fifteen lines,
 * pure, and the heart of the whole model.
 */
export function matchesShape(shape: MoveShape, move: MoveResult): boolean {
  if (shape.from !== undefined && shape.from !== toAlgebraic(move.from)) return false;
  if (shape.to !== undefined && shape.to !== toAlgebraic(move.to)) return false;
  if (shape.piece !== undefined && shape.piece !== move.piece.type) return false;
  if (shape.san !== undefined && shape.san !== move.san) return false;

  if (shape.captures !== undefined) {
    if (!move.captured) return false;
    if (shape.captures !== true && shape.captures !== move.captured.type) return false;
  }
  // ⚠️ `=== true` rather than truthiness. `castle` is `null` on an ordinary move and `enPassant`
  // is `false`, so a shape that asks for one must be answered by a move that HAS it — not merely
  // by a move whose field is not undefined.
  if (shape.castle !== undefined && shape.castle !== move.castle) return false;
  if (shape.enPassant !== undefined && move.enPassant !== true) return false;

  if (shape.promotion !== undefined) {
    if (!move.promotion) return false;
    if (shape.promotion !== true && shape.promotion !== move.promotion) return false;
  }
  return true;
}

/**
 * The squares a `mark` task wants, as a canonical string.
 *
 * ⚠️ A SET, NOT A SEQUENCE. "Find every square this bishop attacks" has no order — a student who
 * starts from the far corner is not wrong — so both sides are sorted before they are compared, and
 * a duplicate touch counts once. Comparing arrays directly would fail the child, not the answer.
 */
export function asSquareSet(squares: readonly SquareName[]): string {
  return [...new Set(squares)].sort().join(' ');
}

/** Is this a real square name? The one runtime check, and the table test is what makes it rare. */
export function isSquareName(name: SquareName): boolean {
  return fromAlgebraic(name) !== null;
}
