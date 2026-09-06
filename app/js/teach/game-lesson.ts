// SPDX-License-Identifier: AGPL-3.0-or-later
// teach/game-lesson — an annotated game, expressed as a lesson.
//
// ========================= THE PLAN WROTE THIS MODULE IN ONE SENTENCE =========================
// "partida comentada é lista de passos cujo `want` é `{san}` e cujo `say` é a anotação." Taken
// literally, that is this file — and it is the third time the lesson table has absorbed a whole
// stage without growing a field. The syllabus, a Lichess tactic, and now a book all reach the
// student through the same driver, the same panel, the same column and the same idea of "wrong".
//
// `chess/rules.ts` had already grown the reading half of it — `rulesFromPgn`, `positions()`,
// `commentAt()` — and had no consumer at all. This is the consumer.
//
// ========================= ⚠️ ONLY THE ANNOTATED MOVES ARE STEPS =========================
// Not every ply. A book is not a move list with prose bolted on: the annotator CHOSE where to stop
// and say something, and that choice is the book. The plies between two notes are folded into the
// next step's FEN, which is what `Step.fen` has been for since the first lesson — "the position
// this step starts from" — and it is why this file is forty lines rather than four hundred.
//
// The alternative was a step per ply, and it fails on its own terms: an unannotated move has
// nothing to read, so its step would have to invent a sentence, and the only true sentence is
// "play Nf3", which hands over the answer and teaches a beginner nothing. `boot/narration.ts`
// exists because raw notation is not language.
//
// ========================= ⚠️ AND THERE IS NO `side` FIELD =========================
// The student plays BOTH sides, whichever the annotated move belongs to — because that is how a
// book is actually studied: one board, one person, playing the game through. A `side` field would
// be a second place to say something the PGN already says, and the plan's own rule about `Step.fen`
// applies to it exactly: a second place for it to be wrong.
//
// It also disposes of the question a puzzle had to answer. A puzzle needs an opponent because the
// position is a problem posed to one side; a book has no opponent, it has a game.
//
// ========================= ⚠️ THE COMMENTS ARE i18n KEYS, NOT PROSE =========================
// A PGN's `{...}` carries the key — `{teach.book.opera.n7}` — and the sentence lives in the catalogues
// with every other sentence in the game. Three reasons, and the third is the one that decided it:
//
//  · The floor here is three languages, and a note written into the PGN would be one.
//  · `i18n.t()` returns the key when nothing has it, so a book with a missing note degrades to a
//    visible key rather than to silence — and `tests/teach-i18n.node.test.ts` already collects
//    every `say` in the game and demands all three languages resolve it. A book gets that check
//    free, on the day it is added.
//  · For a public-domain book the ENGLISH is the original and the other two are ours. Putting the
//    English in the PGN would make it the odd one out — the only language that lives somewhere
//    else — when it is the one that most needs to be quotable verbatim beside a licence note.

import { rulesFromPgn } from '../chess/rules.ts';
import { toAlgebraic } from '../chess/types.ts';
import type { Lesson, Step } from './lesson.ts';

export interface AnnotatedGame {
  /** Bare id. `bookId()` namespaces it, the way `puzzleId()` does. */
  readonly id: string;
  /** i18n key. Lives in the MAIN catalogue: the menu lists titles before any prose is fetched. */
  readonly title: string;
  /**
   * The game, with i18n keys in its comments.
   *
   * ⚠️ THE MOVES ARE FACTS AND THE NOTES ARE NOT. A game's score can come from anywhere; the notes
   * on it are what a book IS, and what copyright attaches to. `docs/LICENSES.md` carries which
   * books are old enough for their notes to be usable at all — this type cannot check that, and
   * saying so here is the only place a reader will meet the question before adding one.
   */
  readonly pgn: string;
}

/** `book:` and the game's id, so it can never collide with a lesson or a puzzle. */
export function bookId(game: AnnotatedGame): string {
  return `book:${game.id}`;
}

/** Whether an id names an annotated game. */
export function isBookId(id: string): boolean {
  return id.startsWith('book:');
}

/**
 * The game as a lesson, or null if the PGN will not parse or carries no notes at all.
 *
 * Null rather than a throw, for the reason `rulesFromPgn` gives: a book is a FILE, and a file that
 * will not parse is something to be told about, not an exception thrown through whatever happened
 * to be reading it.
 */
export function gameLesson(game: AnnotatedGame): Lesson | null {
  const rules = rulesFromPgn(game.pgn);
  if (!rules) return null;

  const history = rules.history();
  const positions = rules.positions();
  const steps: Step[] = [];

  for (const [ply, move] of history.entries()) {
    /*
     * ⚠️ THE NOTE ON A MOVE IS THE COMMENT ON THE POSITION IT PRODUCED, which is `ply + 1` — PGN
     * writes a note AFTER the move it is about. Off by one here would attach every note to the
     * previous move, and the result would read almost sensibly, which is the worst kind of wrong.
     */
    const say = rules.commentAt(ply + 1);
    if (!say) continue;
    steps.push({
      // positions[0] is the start, so positions[ply] is the board just before this move.
      fen: positions[ply]!,
      say,
      /*
       * ⚠️ `san` IS THE ESCAPE HATCH EVERYWHERE ELSE AND THE RIGHT ANSWER HERE. `MoveShape` warns
       * to prefer the flags because they say WHY a move is being asked for — but a book asks for a
       * move because the master played it, and the notation is how the master wrote it down. There
       * is no underlying reason to name, and inventing one would be putting words in their mouth.
       */
      task: { kind: 'play', want: { san: move.san } },
      // The teacher's answer, locked behind three tries like every other lesson's.
      show: { arrows: [[toAlgebraic(move.from), toAlgebraic(move.to)]] },
    });
  }

  if (steps.length === 0) return null;
  return { id: bookId(game), title: game.title, steps };
}
