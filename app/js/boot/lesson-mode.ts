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
import type { LessonSquare } from '../ui/grid-mirror.ts';

export interface LessonModeDeps {
  readonly shell: GameShell;
  readonly panel: LessonPanel;
  /** Says a sentence politely. The shell's own `srSay`, so there is one live region, not two. */
  say(text: string): void;
  /** Called when the lesson ends, however it ends. The caller puts the game back. */
  onLeave(): void;
  /**
   * How long a right answer stays on the board before the lesson moves on. Defaults to `HOLD_MS`.
   *
   * ⚠️ INJECTABLE FOR THE TESTS, and for nothing else. A suite that waited 800 ms per correct
   * answer would spend most of a minute asleep, and a suite that stubbed the clock would stop
   * exercising the very ordering the hold exists to create.
   */
  readonly holdMs?: number;
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

/**
 * How long a right answer stays on the board before the lesson moves on.
 *
 * ⚠️ THE PAUSE IS THE FEEDBACK. Advancing the instant a square is touched replaces the answer with
 * the next question, so the mark that says "yes, that one" is drawn and erased inside the same
 * frame and nobody ever sees it. The child is left with a board that changed and no idea why.
 *
 * Not tied to reduced motion: this is a pause, not an animation, and somebody who has asked for
 * less movement has not asked to be told less.
 */
const HOLD_MS = 800;

export function createLessonMode(deps: LessonModeDeps): LessonMode {
  const { shell, panel } = deps;
  let tutor: Tutor | null = null;
  let lesson: Lesson | null = null;
  /** The hint to show, cleared when the step moves on. */
  let nudge: string | null = null;
  /** How much of a `mark` step is found, for the panel's "3 of 8". */
  let found: { done: number; of: number } | null = null;
  /** Squares answered correctly in this step, kept so they all stay blue. */
  let right: Square[] = [];
  /** The one square answered wrongly, cleared by the next touch. */
  let wrong: Square | null = null;
  /** A pending advance, so a second touch during the hold cannot advance twice. */
  let holding: ReturnType<typeof setTimeout> | null = null;

  /**
   * Everything the board should be showing about this step.
   *
   * ⚠️ ORDER MATTERS AND THE ANSWERS COME LAST. A square that a step says to look at AND that has
   * just been answered should read as the answer — the map keeps the last write, so "you got it"
   * wins over "look here", which is the more useful of the two once the child has acted.
   */
  function marks(step: Step | null): LessonSquare[] {
    const out: LessonSquare[] = (step ? litBy(step) : [])
      .map((square) => ({ square, mark: 'look' as const }));
    for (const square of right) out.push({ square, mark: 'right' });
    if (wrong) out.push({ square: wrong, mark: 'wrong' });
    return out;
  }

  function paint(): void {
    shell.setTaught(marks(tutor?.step() ?? null));
  }

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
    paint();
    panel.show(view());
    deps.say(shell.i18n.t(step.say));
    if (lesson && tutor) rememberPlace(lesson.id, tutor.stepIndex());
  }

  function advance(): void {
    right = [];
    wrong = null;
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
  /**
   * What the tutor said, turned into board and panel.
   *
   * `at` is the square that was touched, or null when the answer came from the panel. It is what
   * lets a `mark` step answer the square itself rather than only the step.
   */
  function react(reaction: ReturnType<Tutor['saw']>, at: Square | null): void {
    if (holding) return;                      // mid-hold: the step is already answered.
    if (reaction.undo) shell.undoLast();
    if (reaction.kind === 'ignored') return;

    // ⚠️ THE PREVIOUS RED GOES BEFORE THE NEW VERDICT IS DRAWN. Two red squares at once would say
    // two answers were wrong, when only the second one was even offered.
    wrong = null;
    if (at) {
      if (reaction.kind === 'wrong') wrong = at;
      else if (!right.some((s) => s.x === at.x && s.y === at.y)) right.push(at);
    }

    if (reaction.kind === 'waiting') {
      found = { done: reaction.marked, of: reaction.wanted };
      paint();
      panel.show(view());
      return;
    }
    if (reaction.kind === 'wrong') {
      // ⚠️ POLITELY, AND NEVER TO `#sr-alert`. Being wrong in a lesson is not an emergency, and a
      // mode that trained a child to hear their own mistakes as an alarm has taught them
      // something other than chess.
      if (reaction.nudge) nudge = reaction.nudge;
      paint();
      panel.show(view());
      if (nudge) deps.say(shell.i18n.t(nudge));
      return;
    }

    paint();
    panel.show(view());

    /*
     * Right. ⚠️ THE ANSWER IS SHOWN BEFORE THE NEXT QUESTION REPLACES IT. Advancing here would draw
     * the blue mark and erase it inside the same frame, leaving a child with a board that changed
     * for no visible reason. `holding` also makes a second touch during the pause a no-op rather
     * than a double advance.
     *
     * ⚠️ ONLY WHEN THE ANSWER WAS ON THE BOARD. A `pick` is answered in the panel and colours no
     * square, so a pause there shows nothing and is simply a delay — and a delay with nothing to
     * look at is the kind of thing a child reads as the game having frozen.
     */
    if (!at) { advance(); return; }
    holding = setTimeout(() => { holding = null; advance(); }, deps.holdMs ?? HOLD_MS);
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
      shell.watch((square, result) => { react(tutor!.saw(square, result), square); });
      const step = tutor.step();
      if (step) open(step);
      return true;
    },

    chose(option) {
      // No square: a `pick` is answered in the panel, so there is nothing on the board to colour.
      if (tutor) react(tutor.chose(option), null);
    },

    stop() {
      // ⚠️ A pending hold would advance a lesson that has been closed, into a panel that has been
      // destroyed. Cancelled first, before anything it touches goes away.
      if (holding) { clearTimeout(holding); holding = null; }
      right = [];
      wrong = null;
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
