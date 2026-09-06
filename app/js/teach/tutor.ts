// SPDX-License-Identifier: AGPL-3.0-or-later
// teach/tutor — marks the answer. No DOM, no engine, no text.
//
// ========================= WHY THE WRONG MOVE IS PLAYED AND THEN TAKEN BACK =========================
// Three ways to judge a step were considered, and the other two were worse for reasons worth
// keeping:
//
//  · A PREDICATE ON `GameStateOptions`, consulted before the move. It changes the most-tested
//    module in the game to serve a case that is not its own — and, worse, it REFUSES the move. A
//    child who has moved the bishop like a rook needs to SEE the bishop standing on the wrong
//    square. `ui/blunder-bar.ts` already argues this for the game: "somebody being told their move
//    gave the game away needs to be looking at the position while they decide."
//  · A LESSON DRIVER THAT BYPASSES `chess/state.ts`. Loses the declaration, the sonar, the DOM
//    mirror and the keyboard in one move.
//
// So the tutor sits BETWEEN the shell and the state, judging what already happened, and says
// whether to put the board back. That is the same shape the protected mode has used since it was
// written, and it is why `Reaction` carries `undo` rather than doing anything itself.
//
// ========================= ⚠️ THIS MODULE TOUCHES NOTHING =========================
// It has no `Rules`, no `GameState`, no i18n and no board. It is handed what happened and returns
// what it thinks — which is what lets the whole of Stage 1 be tested in the node project, and what
// stops "was that right?" from depending on a canvas.

import type { Square } from '../chess/types.ts';
import { toAlgebraic } from '../chess/types.ts';
import type { Activation } from '../chess/state.ts';
import type { Lesson, SquareName, Step } from './lesson.ts';
import { matchesShape } from './lesson.ts';

/**
 * What the tutor makes of what just happened.
 *
 * ⚠️ `undo` IS ON `ignored` AS WELL AS ON `wrong`, and that is not symmetry for its own sake. A
 * student can move a piece during a step that is not asking for a move at all — the values lesson
 * sits on the opening position, and nothing stops a child pushing a pawn while reading the
 * question. That is not a wrong answer and must not be nudged, but the board still has to go back.
 * Without this the position would drift out from under a lesson that never mentioned it.
 */
export type Reaction =
  /**
   * The step is answered. `done` means the lesson is too.
   *
   * ⚠️ AND A RIGHT ANSWER CAN NEED AN UNDO. A `mark` step is satisfied by touching squares, but
   * the last one may have been reached by moving a piece onto it — see `touchedSquare` — and a
   * lesson whose next step carries no FEN continues from this position. Being right does not make
   * the board correct.
   *
   * A `play` step is the opposite and never undoes: the move IS the answer, and the knight is
   * meant to still be standing on f3 when the next step asks it to go to g5.
   */
  | { readonly kind: 'right'; readonly done: boolean; readonly undo: boolean }
  /**
   * Answered wrongly. `nudge` is the key to say, or null when it has already been said once for
   * this step — repeating the same hint at every attempt is nagging, not help.
   */
  | { readonly kind: 'wrong'; readonly undo: boolean; readonly nudge: string | null }
  /**
   * A `mark` step with some but not all of its squares found. Neither right nor wrong yet.
   *
   * ⚠️ AND IT CARRIES `undo` FOR THE SAME REASON `right` DOES, which is the more dangerous half of
   * it: a rook that reached the first of its fourteen squares by moving there would have the other
   * thirteen judged from the square it left. The step would become unanswerable in the middle,
   * with the child holding the pieces.
   */
  | {
    readonly kind: 'waiting';
    readonly marked: number;
    readonly wanted: number;
    readonly undo: boolean;
  }
  /** Not an answer at all. Put the board back if `undo`. */
  | { readonly kind: 'ignored'; readonly undo: boolean };

export interface Tutor {
  readonly lesson: Lesson;
  /** The step being worked on, or null once the lesson is finished. */
  step(): Step | null;
  stepIndex(): number;
  finished(): boolean;
  /**
   * Something happened on the board.
   *
   * ⚠️ THE SQUARE IS A PARAMETER BECAUSE `Activation` DOES NOT ALWAYS CARRY ONE. An empty square
   * comes back as `{kind:'ignored', reason:'empty'}` with no square named — which is right for a
   * game, where touching nothing is a non-event, and useless for the notation lesson, where
   * touching an empty square IS the answer. One parameter, and `chess/state.ts` stays untouched.
   */
  saw(square: Square, result: Activation): Reaction;
  /** An option picked in the panel. Ignored unless the step is a `pick`. */
  chose(option: number): Reaction;
  /** Moves to the next step and returns it, or null at the end. */
  advance(): Step | null;
  /** The squares found so far in a `mark` step, in the order they were touched. */
  marked(): readonly SquareName[];
}

export interface TutorOptions {
  /** Where to start. For resuming a lesson from stored progress; out of range starts at the top. */
  readonly from?: number;
}

/**
 * Which square an activation is ABOUT.
 *
 * ⚠️ A MARK STEP CAN PRODUCE A MOVE, and the plan that specified this module did not say so. The
 * squares a lesson asks to be marked are the squares the taught piece can reach — which are
 * exactly the squares that a child who has already picked the piece up will MOVE it to. Touch the
 * rook, then touch d8, and the rook is on d8.
 *
 * That is not a mistake to be scolded for; d8 is a correct answer, arrived at by the other of the
 * two gestures the board offers. So the destination counts as the touched square and the caller is
 * told to take the move back. Reading only `ignored/empty` would have made half the marks in every
 * piece lesson silently do nothing.
 */
function touchedSquare(square: Square, result: Activation): { name: SquareName; moved: boolean } {
  if (result.kind === 'moved') return { name: toAlgebraic(result.move.to), moved: true };
  if (result.kind === 'illegal') return { name: toAlgebraic(result.square), moved: false };
  // `selected` names the square it picked up; every other shape names nothing, so the caller's
  // square is the only source. They agree in the cases where both exist.
  return { name: toAlgebraic(square), moved: false };
}

export function createTutor(lesson: Lesson, options: TutorOptions = {}): Tutor {
  const start = options.from ?? 0;
  let index = start >= 0 && start < lesson.steps.length ? start : 0;
  /** Squares found in the current `mark` step. Cleared by `advance`. */
  let found: SquareName[] = [];
  /** Whether this step's nudge has been said. Cleared by `advance`. */
  let nudged = false;

  function current(): Step | null {
    return lesson.steps[index] ?? null;
  }

  function wrong(undo: boolean): Reaction {
    const step = current();
    const nudge = !nudged && step?.nudge ? step.nudge : null;
    if (nudge) nudged = true;
    return { kind: 'wrong', undo, nudge };
  }

  function right(undo = false): Reaction {
    return { kind: 'right', done: index >= lesson.steps.length - 1, undo };
  }

  return {
    lesson,
    step: current,
    stepIndex: () => index,
    finished: () => index >= lesson.steps.length,
    marked: () => [...found],

    saw(square, result) {
      const step = current();
      if (!step) return { kind: 'ignored', undo: false };

      /*
       * ⚠️ ONLY `busy` AND `over` ARE DISCARDED, and the other two reasons are answers.
       *
       * `empty` is the notation lesson's whole answer — touching a square with nothing on it. And
       * `not-your-turn` means the student pointed at an ENEMY piece, which is a perfectly good mark
       * for "find every square this bishop attacks" when one of them is occupied. Discarding it
       * with the rest would have made those marks silently do nothing.
       *
       * `busy` and `over` are different in kind: they say the board refused to look at the square,
       * so there is nothing to judge and nothing to put back.
       */
      if (result.kind === 'ignored' && (result.reason === 'busy' || result.reason === 'over')) {
        return { kind: 'ignored', undo: false };
      }

      if (step.task.kind === 'play') {
        if (result.kind === 'moved') {
          return matchesShape(step.task.want, result.move) ? right() : wrong(true);
        }
        // ⚠️ AN ILLEGAL MOVE NEEDS NO UNDO. `chess/rules.ts` turns an illegal move from an
        // exception into a value, so `activate` reports it having played nothing at all.
        if (result.kind === 'illegal') return wrong(false);
        // Picking a piece up, putting it down, touching an empty square: the student is still
        // choosing. None of it is an answer.
        return { kind: 'ignored', undo: false };
      }

      if (step.task.kind === 'mark') {
        // ⚠️ PICKING A PIECE UP IS NOT AN ANSWER, and must not count as a wrong one. It is how a
        // sighted child sees the legal targets and how a keyboard child hears them, so a lesson
        // that punished it would punish the very move it is trying to teach.
        if (result.kind === 'selected' || result.kind === 'deselected') {
          return { kind: 'ignored', undo: false };
        }
        const { name, moved } = touchedSquare(square, result);
        if (!step.task.want.includes(name)) return wrong(moved);
        if (!found.includes(name)) found.push(name);
        // The set is what matters, so a square touched twice is still one square. The counts come
        // back unchanged rather than as an `ignored`, because "you already have that one" is
        // something a panel may want to say and a silence is not.
        if (found.length < step.task.want.length) {
          return {
            kind: 'waiting', marked: found.length, wanted: step.task.want.length, undo: moved,
          };
        }
        // ⚠️ The board may have moved on the way to being right, and it still has to go back.
        return right(moved);
      }

      // A `pick` step: the answer is in the panel. The board is scenery, and a child reading a
      // question can still push a pawn across it.
      return { kind: 'ignored', undo: result.kind === 'moved' };
    },

    chose(option) {
      const step = current();
      if (!step || step.task.kind !== 'pick') return { kind: 'ignored', undo: false };
      // Nothing was played, so there is nothing to undo — this is the one wrong answer that costs
      // the position nothing.
      return option === step.task.answer ? right() : wrong(false);
    },

    advance() {
      index += 1;
      found = [];
      nudged = false;
      return current();
    },
  };
}
