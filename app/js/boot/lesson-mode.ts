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
import { lessonById, lessonIndex, syllabus } from '../teach/lessons.ts';
import { loadTeach } from '../i18n/teach/index.ts';
import { markLearned, rememberPlace } from '../chess/session.ts';
import { positionFor } from '../teach/position.ts';
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
   * Finds a lesson by id. Defaults to the syllabus.
   *
   * ⚠️ INJECTED SO A PUZZLE CAN BE ONE. `teach/puzzle-lesson.ts` turns a tactic into a `Lesson`,
   * and everything here then works on it unchanged — but resolving a `puzzle:` id means fetching a
   * 59 KB file, which is the composition root's business rather than this driver's.
   */
  find?(id: string): Promise<Lesson | null>;
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
  /** Which step of it, from zero. */
  stepIndex(): number;
  /**
   * The previous exercise, wrapping into the end of the lesson before it.
   *
   * ⚠️ WRAPPING IS WHY THIS IS NOT JUST `tutor.back()`. The syllabus is one course, so the first
   * step of the bishop lesson is preceded by the last step of the rook lesson, not by nothing.
   * Only the very first step of the very first lesson has nowhere to go.
   */
  back(): Promise<void>;
  /** The next exercise, wrapping into the start of the lesson after it. */
  forward(): Promise<void>;
  canBack(): boolean;
  canForward(): boolean;
  /** Whether the teacher is showing the answer. */
  teacher(): boolean;
  setTeacher(on: boolean): void;
  /** Whether the teacher may be switched on yet — three tries at THIS question. */
  teacherReady(): boolean;
  /** Wrong answers to the current step. */
  mistakes(): number;
}

const squaresOf = (names: readonly SquareName[]): Square[] =>
  names.map(fromAlgebraic).filter((s): s is Square => s !== null);

/**
 * The squares a step points at, which are shown WHATEVER the teacher is doing.
 *
 * ⚠️ `show.squares` IS THE QUESTION, NOT THE ANSWER, and telling the two apart is what makes the
 * teacher gate safe. The notation lesson's third step asks "what is this square called?" and
 * lights f3; hiding that until a child has been wrong three times would leave them staring at a
 * question with its subject missing. An arrow from e2 to e4, by contrast, simply IS the answer.
 */
function askedBy(step: Step): Square[] {
  return squaresOf(step.show?.squares ?? []);
}

/** The squares an arrow runs between: the answer, and therefore the teacher's to give. */
function hintedBy(step: Step): Square[] {
  return squaresOf((step.show?.arrows ?? []).flat());
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

/**
 * How many wrong answers unlock the teacher.
 *
 * ⚠️ COUNTED PER STEP, NOT PER LESSON. The point of the gate is that a child tries the question in
 * front of them before being shown its answer — a count that carried across steps would hand the
 * answer to the fourth question because the first three were hard.
 */
export const TRIES_BEFORE_TEACHER = 3;

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
   * Whether the teacher is showing the answer.
   *
   * ⚠️ TURNED OFF BY EVERY CHANGE OF STEP. A toggle that stayed on would show the answer to the
   * next question before it had been read — and the gate below exists precisely so that the answer
   * is something a child arrives at after trying, not something the interface hands over.
   */
  let teacherOn = false;

  /**
   * Everything the board should be showing about this step.
   *
   * ⚠️ ORDER MATTERS AND THE ANSWERS COME LAST. A square that a step says to look at AND that has
   * just been answered should read as the answer — the map keeps the last write, so "you got it"
   * wins over "look here", which is the more useful of the two once the child has acted.
   */
  function marks(step: Step | null): LessonSquare[] {
    const asked = step ? askedBy(step) : [];
    // ⚠️ Only when the teacher is on, and the teacher only turns on after three tries. See
    // `teacherReady`: help that arrives before anyone has tried is not help, it is the answer.
    const hinted = step && teacherOn ? hintedBy(step) : [];
    const out: LessonSquare[] = [...asked, ...hinted]
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
  /**
   * Puts a step on the board, then draws it, then says it.
   *
   * `replay` is for arriving at a step from BEHIND — going back, or jumping into the middle of a
   * lesson. Forward, the board is already in the state the previous step left it, and rebuilding
   * would throw that away; see `teach/position.ts` for why backwards cannot do the same.
   */
  function open(step: Step, replay = false): void {
    if (replay && lesson && tutor) {
      const fen = positionFor(lesson, tutor.stepIndex());
      if (fen) shell.newGame(fen, { teaching: true });
    } else if (step.fen) {
      // ⚠️ Only when the step names one. A step without a FEN continues from where the last one
      // left the board, which is what makes "take the knight to f3, now to g5" one lesson.
      shell.newGame(step.fen, { teaching: true });
    }
    paint();
    panel.show(view());
    deps.say(shell.i18n.t(step.say));
    if (lesson && tutor) rememberPlace(lesson.id, tutor.stepIndex());
  }

  /** Clears everything that belonged to the step being left. */
  function leaveStep(): void {
    if (holding) { clearTimeout(holding); holding = null; }
    right = [];
    wrong = null;
    nudge = null;
    found = null;
    teacherOn = false;
  }

  function advance(): void {
    right = [];
    wrong = null;
    teacherOn = false;
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
      const found_ = deps.find ? await deps.find(lessonId) : lessonById(lessonId);
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

    stepIndex: () => tutor?.stepIndex() ?? 0,
    mistakes: () => tutor?.mistakes() ?? 0,
    teacher: () => teacherOn,
    teacherReady: () => (tutor?.mistakes() ?? 0) >= TRIES_BEFORE_TEACHER,

    setTeacher(on) {
      /*
       * ⚠️ REFUSED UNTIL THE GATE OPENS, HERE AND NOT ONLY IN THE MENU. A disabled control is a
       * hint to a person, not a rule: the keyboard shortcut, a stale click and any future caller
       * all reach this instead. The rule belongs where the state is.
       */
      if (on && (tutor?.mistakes() ?? 0) < TRIES_BEFORE_TEACHER) return;
      teacherOn = on;
      paint();
    },

    canBack: () => Boolean(lesson) && !(tutor?.stepIndex() === 0 && lessonIndex(lesson!.id) === 0),
    canForward: () => Boolean(lesson),

    async back() {
      if (!lesson || !tutor) return;
      leaveStep();
      const step = tutor.back();
      if (step) { open(step, true); return; }
      // Off the front of this lesson: the last step of the one before it in the syllabus.
      /*
       * ⚠️ ONLY WITHIN THE SYLLABUS. A puzzle is a `Lesson` but it is not IN the course, so its
       * index is -1 — and `order[-2]` is undefined while `order[-1 + 1]` is the FIRST lesson.
       * Without this guard, pressing "next" at the end of a tactic dropped the reader into the
       * notation lesson.
       */
      const order = syllabus();
      const at = lessonIndex(lesson.id);
      const previous = at < 0 ? undefined : order[at - 1];
      if (!previous) { open(tutor.step()!, true); return; }
      await this.start(previous.id, previous.steps.length - 1);
    },

    async forward() {
      if (!lesson || !tutor) return;
      leaveStep();
      const step = tutor.advance();
      if (step) { open(step, true); return; }
      // Off the end: the first step of the next lesson, or back to the list when there is none.
      const order = syllabus();
      const here = lessonIndex(lesson.id);
      const next = here < 0 ? undefined : order[here + 1];
      if (!next) { this.stop(); return; }
      await this.start(next.id, 0);
    },

    stop() {
      // ⚠️ A pending hold would advance a lesson that has been closed, into a panel that has been
      // destroyed. Cancelled first, before anything it touches goes away.
      leaveStep();
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
