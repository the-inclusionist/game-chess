// SPDX-License-Identifier: AGPL-3.0-or-later
// teach/position — which board a step starts from, computed rather than remembered.
//
// ========================= ⚠️ WHY GOING BACK NEEDS THIS AND GOING FORWARD DOES NOT =========================
// Forward, the board is simply already there: a step without a FEN continues from where the last
// one left it, which is what makes "take the knight to f3, now to g5" ONE lesson.
//
// Backward, that history is exactly what has been thrown away. Re-opening step 3 means putting the
// board back into the state step 2 left it in — and step 2 may have been a MOVE. Resetting to the
// nearest preceding FEN would work for every lesson written today, and would quietly break the
// first lesson anybody writes with two moves in a row: the second step would be asked from the
// position before the first move, where its own goal is unreachable.
//
// So the position is REPLAYED. And because it is a pure function of the table and an index, it can
// be proved in the node project with no board on screen — which is how `tests/teach-position.node.
// test.ts` checks it for every step of every lesson rather than for the ones somebody remembered.

import { createRules, type Rules } from '../chess/rules.ts';
import { matchesShape, type Lesson } from './lesson.ts';

/**
 * Plays the first move that satisfies a goal.
 *
 * ⚠️ "THE FIRST" IS ENOUGH, and it is worth saying why rather than reaching for a search. A `play`
 * goal is a conjunction of equalities over `MoveResult`, so every move that satisfies it is a move
 * the step would have accepted — a student who took a different one is at a different board, and a
 * lesson that cared would have to say so in its goal. `tests/teach-table.node.test.ts` already
 * requires every goal to be satisfiable at all.
 */
function playGoal(rules: Rules, want: Parameters<typeof matchesShape>[0]): boolean {
  for (const candidate of rules.allMoves()) {
    const move = rules.move(candidate.from, candidate.to, candidate.promotion ?? 'q');
    if (!move) continue;
    if (matchesShape(want, move)) return true;
    rules.undo();
  }
  return false;
}

/**
 * The FEN step `index` of `lesson` begins from, or null if the lesson cannot reach it.
 *
 * Null is a real answer rather than a throw: a table can be edited into a state where a step's
 * premise is unreachable, and the caller that finds out is a test, not a child.
 */
export function positionFor(lesson: Lesson, index: number): string | null {
  if (index < 0 || index >= lesson.steps.length) return null;

  // The nearest FEN at or before the step. Every lesson's first step carries one — asserted in the
  // table test — so this search always ends.
  let from = index;
  while (from > 0 && !lesson.steps[from]!.fen) from -= 1;
  const start = lesson.steps[from]!.fen;
  if (!start) return null;

  let rules: Rules;
  try {
    rules = createRules(start);
  } catch {
    return null;
  }

  // Everything between that FEN and the step being opened. Only `play` steps move anything: a
  // `mark` never changes the position and a `pick` is answered in the panel.
  for (let at = from; at < index; at += 1) {
    const task = lesson.steps[at]!.task;
    if (task.kind !== 'play') continue;
    if (!playGoal(rules, task.want)) return null;
  }
  return rules.fen();
}
