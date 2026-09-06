// SPDX-License-Identifier: AGPL-3.0-or-later
// teach/puzzle-lesson — a tactic, expressed as a lesson.
//
// ========================= WHY THERE IS NO PUZZLE MODE =========================
// The plan said it in one line before any of this was built: "um puzzle é um passo com FEN e
// objetivo `play`". Taking that literally is worth a great deal — a converter is forty lines, and
// a second driver would have been four hundred with its own panel, its own menu, its own idea of
// what "wrong" means and its own bugs in all three.
//
// So a puzzle becomes a `Lesson`, and everything already written works on it unchanged: the tutor
// judges the move, the panel draws the step, the column lists them, back and forward walk them,
// and the teacher unlocks after three tries exactly as it does in a lesson.
//
// ========================= ⚠️ THE ASSUMPTIONS, STATED =========================
// Three things had to be decided to build this at all. Each follows what this codebase already
// does, and each is cheap to reverse:
//
//  · THE OPPONENT ANSWERS BY ITSELF. Every puzzle trainer works this way, and the data is shaped
//    for it — `isStudentMove` exists because the dump alternates. A student asked to play both
//    sides would be solving a different problem from the one Lichess rated.
//  · A WRONG MOVE IS TAKEN BACK, not restarted. That is what a lesson does, and `ui/blunder-bar.ts`
//    argued it first: somebody told their move was wrong needs to have SEEN it. Restarting also
//    throws away the moves they got right, which punishes progress.
//  · IT LIVES BESIDE THE LESSONS, in the same column, because that is where a list of things to
//    work through already lives.
//
// ========================= ⚠️ WHY EVERY STEP CARRIES ITS OWN FEN =========================
// It would be tempting to give only the first one a position and let the rest continue from it, the
// way a lesson does. That breaks going BACKWARDS. `teach/position.ts` rebuilds a step by replaying
// the `play` goals before it — and the opponent's replies are not goals, so they would be skipped
// and every step after the first would be rebuilt one ply short, from a position with the wrong
// side to move.
//
// Computing them here instead costs one `Rules` per puzzle and makes going back exact.

import { createRules } from '../chess/rules.ts';
import { fromAlgebraic, type PieceType } from '../chess/types.ts';
import { isStudentMove, type Puzzle } from '../puzzles/puzzle.ts';
import type { Lesson, Step } from './lesson.ts';

/** `puzzle:` and the Lichess id. Namespaced so a puzzle can never collide with a lesson. */
export function puzzleId(puzzle: Puzzle): string {
  return `puzzle:${puzzle.id}`;
}

/** Whether an id names a puzzle rather than a lesson. */
export function isPuzzleId(id: string): boolean {
  return id.startsWith('puzzle:');
}

/**
 * The tactic as a lesson, or null if its solution cannot be played from its position.
 *
 * Null rather than a throw: the file is generated from a 304 MB download and validated by
 * `tests/puzzles.node.test.ts`, but a caller that meets a bad one should skip it rather than take
 * the page down.
 */
export function puzzleLesson(puzzle: Puzzle): Lesson | null {
  let rules;
  try {
    rules = createRules(puzzle.fen);
  } catch {
    return null;
  }

  const steps: Step[] = [];
  for (const [index, token] of puzzle.solution.entries()) {
    const from = fromAlgebraic(token.slice(0, 2));
    const to = fromAlgebraic(token.slice(2, 4));
    if (!from || !to) return null;
    const promotion = token[4] as PieceType | undefined;

    if (isStudentMove(index)) {
      steps.push({
        fen: rules.fen(),
        // ⚠️ ONE SENTENCE FOR EVERY PUZZLE, and it is the theme that varies. Two hundred tactics
        // cannot each have prose written for them, and a puzzle does not want prose: the position
        // is the question. What a child needs told is what KIND of thing to look for.
        say: `puzzle.say.${puzzle.theme}`,
        task: {
          kind: 'play',
          want: {
            from: token.slice(0, 2),
            to: token.slice(2, 4),
            ...(promotion ? { promotion } : {}),
          },
        },
        nudge: `puzzle.nudge.${puzzle.theme}`,
        // The teacher's answer: the move itself, drawn as an arrow, and locked behind three tries
        // like every other lesson's.
        show: { arrows: [[token.slice(0, 2), token.slice(2, 4)]] },
      });
    }
    if (!rules.move(from, to, promotion)) return null;
  }

  if (steps.length === 0) return null;
  return {
    id: puzzleId(puzzle),
    title: `puzzle.theme.${puzzle.theme}`,
    steps,
  };
}
