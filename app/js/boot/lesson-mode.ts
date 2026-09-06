// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/lesson-mode — the ninety lines that make the other seven steps a mode.
//
// ========================= WHAT THIS IS AND IS NOT =========================
// Every part of a lesson already exists and every part is already tested: the table says what a
// step asks, the tutor says whether an answer was right, the panel draws it, the shell owns the
// board. NOTHING HERE DECIDES ANYTHING. It carries messages between four things that each know
// their own job, and that is why it is short — a driver that had to think would mean one of the
// four was not finished.
//
// ========================= ⚠️ THE ORDER IS THE WHOLE OF IT =========================
// Three orderings here are load-bearing, and each was learned from a test rather than guessed:
//
//  · THE PROSE IS FETCHED BEFORE THE PANEL OPENS. `i18n/teach` is a dynamic import, so a panel
//    shown first says `teach.rook.title` — correct by the contract of `t()`, and useless to a
//    child. `tests/lesson-panel.browser.test.ts` asserts that failure so this one has to avoid it.
//  · THE UNDO WAITS FOR THE PIECE TO LAND. The shell's observer already fires after the flight
//    (see `ActivationObserver`), and `chess/state.ts` refuses a take-back while the phase is
//    `animating` — a lesson that undid too early would silently not undo, and the next answer
//    would come back `ignored/busy`.
//  · THE STEP IS SAID AFTER THE BOARD IS SET. `srSay` describes a position; saying it first
//    describes the one before.

import type { GameShell } from './game-shell.ts';
import type { LessonPanel, LessonView } from '../ui/lesson-panel.ts';
import type { Lesson, SquareName, Step } from '../teach/lesson.ts';
import { createTutor, type Tutor } from '../teach/tutor.ts';
import { lessonById } from '../teach/lessons.ts';
import { loadTeach } from '../i18n/teach/index.ts';
import { markLearned, rememberPlace } from '../chess/session.ts';
import { fromAlgebraic, type Square } from '../chess/types.ts';

export interface LessonModeDeps {
  readonly shell: GameShell;
  readonly panel: LessonPanel;
  /** Says a sentence politely. The shell's own `srSay`, so there is one live region, not two. */
  say(text: string): void;
  /** Called when the lesson ends, however it ends. The caller puts the game back. */
  onLeave(): void;
}

export interface LessonMode {
  /** Opens a lesson, fetching its prose first. Resolves once the first step is on the board. */
  start(lessonId: string, from?: number): Promise<boolean>;
  /** An option was chosen in the panel. */
  chose(option: number): void;
  /** Closes the lesson and hands the board back. */
  stop(): void;
  /** The lesson being taken, or null. */
  active(): Lesson | null;
}

const squaresOf = (names: readonly SquareName[]): Square[] =>
  names.map(fromAlgebraic).filter((s): s is Square => s !== null);

/** The squares a step wants lit: what it says to look at, plus both ends of every arrow. */
function litBy(step: Step): Square[] {
  const names = [
    ...(step.show?.squares ?? []),
    ...(step.show?.arrows ?? []).flat(),
  ];
  return squaresOf(names);
}

export function createLessonMode(deps: LessonModeDeps): LessonMode {
  const { shell, panel } = deps;
  let tutor: Tutor | null = null;
  let lesson: Lesson | null = null;
  /** The hint to show, cleared when the step moves on. */
  let nudge: string | null = null;
  /** How much of a `mark` step is found, for the panel's "3 of 8". */
  let found: { done: number; of: number } | null = null;

  /** The panel's picture of the step in progress. `advance` builds the finished one by hand. */
  function view(): LessonView | null {
    const step = tutor?.step();
    if (!tutor || !lesson || !step) return null;
    return {
      title: lesson.title,
      step,
      at: tutor.stepIndex() + 1,
      of: lesson.steps.length,
      nudge,
      found,
    };
  }

  /** Puts a step on the board, then draws it, then says it. */
  function open(step: Step): void {
    // ⚠️ Only when the step names one. A step without a FEN continues from where the last one left
    // the board, which is what makes "take the knight to f3, now to g5" one lesson.
    if (step.fen) shell.newGame(step.fen, { teaching: true });
    shell.setTaught(litBy(step));
    panel.show(view());
    deps.say(shell.i18n.t(step.say));
    if (lesson && tutor) rememberPlace(lesson.id, tutor.stepIndex());
  }

  function advance(): void {
    /*
     * ⚠️ THE LAST STEP IS CAPTURED BEFORE ADVANCING PAST IT, and the first version was not.
     * `view()` needs a step to draw and `tutor.step()` is null once the lesson is over, so the
     * finished state came out as `panel.show(null)` — the panel simply VANISHED. The spoken half
     * still said "lesson finished", so the failure was invisible to everybody except the person
     * looking at the screen, which is an unusual way round and exactly why a test caught it.
     *
     * Keeping the last step on screen is also the better ending: the child sees the question they
     * just answered, with the congratulation on it.
     */
    const last = tutor?.step() ?? null;
    nudge = null;
    found = null;
    const next = tutor?.advance() ?? null;
    if (next) { open(next); return; }
    // The end. The lesson is filed as learned, which also drops the remembered place — a finished
    // lesson resumed at its last step reopens on the question that was just answered.
    if (lesson) markLearned(lesson.id);
    shell.setTaught([]);
    panel.show(lesson && last
      ? {
        title: lesson.title,
        step: last,
        at: lesson.steps.length,
        of: lesson.steps.length,
        nudge: null,
        found: null,
        finished: true,
      }
      : null);
    deps.say(shell.i18n.t('lesson.finished'));
  }

  /** What the tutor said, turned into board and panel. The only branch in this file. */
  function react(reaction: ReturnType<Tutor['saw']>): void {
    if (reaction.kind !== 'waiting' && reaction.kind !== 'right' && reaction.kind !== 'wrong') {
      if (reaction.undo) shell.undoLast();
      return;
    }
    if (reaction.undo) shell.undoLast();

    if (reaction.kind === 'waiting') {
      found = { done: reaction.marked, of: reaction.wanted };
      panel.show(view());
      return;
    }
    if (reaction.kind === 'wrong') {
      // ⚠️ POLITELY, AND NEVER TO `#sr-alert`. Being wrong in a lesson is not an emergency, and a
      // mode that trained a child to hear their own mistakes as an alarm has taught them
      // something other than chess.
      if (reaction.nudge) nudge = reaction.nudge;
      panel.show(view());
      if (nudge) deps.say(shell.i18n.t(nudge));
      return;
    }
    advance();
  }

  return {
    active: () => lesson,

    async start(lessonId, from) {
      const found_ = lessonById(lessonId);
      if (!found_) return false;
      // ⚠️ FIRST. The prose is a dynamic import; a panel opened before it lands shows raw keys.
      shell.i18n.extend(shell.i18n.getLocale(), await loadTeach(shell.i18n.getLocale()));
      lesson = found_;
      tutor = createTutor(found_, from === undefined ? {} : { from });
      nudge = null;
      found = null;
      shell.watch((square, result) => { react(tutor!.saw(square, result)); });
      const step = tutor.step();
      if (step) open(step);
      return true;
    },

    chose(option) {
      if (tutor) react(tutor.chose(option));
    },

    stop() {
      shell.watch(null);
      panel.show(null);
      shell.setTaught([]);
      tutor = null;
      lesson = null;
      // ⚠️ The board goes back to the player's OWN game: `newGame()` with no FEN reads the tab's
      // storage rather than dealing a fresh board — see the note there — and turns `teaching` off,
      // so the score sheet starts being written again.
      shell.newGame();
      deps.onLeave();
    },
  };
}
