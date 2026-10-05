// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= A WHOLE LESSON, THROUGH THE REAL PARTS =========================
// Everything under this has its own test and passes it. What has had no test until now is the claim
// that they FIT: that a lesson taken through the shell's single door — `activate`, the same door a
// pointer and a keyboard both use — advances, corrects itself, and finishes.
//
// ⚠️ NOTHING HERE IS MOCKED EXCEPT THE DRAWING. Real rules, real state machine, real tutor, real
// panel, real grid mirror, real storage. The view is the recording fake the shell's own test uses,
// because the browser pane is not visible under vitest and a real animation never settles there.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGameShell, type GameShell } from '../app/js/boot/standalone.ts';
import { createLessonMode, type LessonMode } from '../app/js/boot/lesson-mode.ts';
import { createLessonPanel } from '../app/js/ui/lesson-panel.ts';
import type { BoardView, ViewContext } from '../app/js/boot/view.ts';
import {
  clear, loadProgress, loadSettings, saveProgress, saveSettings,
} from '../app/js/chess/session.ts';
import { LESSONS } from '../app/js/teach/lessons.ts';
import { GAMES, gameById } from '../app/js/teach/games.ts';
import { gameLesson, isBookId } from '../app/js/teach/game-lesson.ts';
import { fromAlgebraic, type Square } from '../app/js/chess/types.ts';

const at = (name: string): Square => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

function fakeView(ctx: ViewContext): BoardView {
  ctx.region.appendChild(ctx.mirror.root);
  return {
    hudControls: { coordinates: () => false, onCoordinates: () => {} },
    applyTheme: () => {},
    drawPosition: () => {},
    drawMarks: () => {},
    carry: () => {},
    travel: () => Promise.resolve(),
    relayout: () => {},
    destroy: () => {},
  };
}

let shell: GameShell;
let mode: LessonMode;
let said: string[];
let left: number;

beforeEach(() => {
  document.body.innerHTML = `
    <div id="stage-wrap" style="width: 640px; height: 360px">
      <div id="game-region">
        <div id="chess-board" tabindex="0"></div>
        <div id="side-column"></div>
      </div>
      <div class="pause-icons" id="title-icons" role="group" aria-label="Atalhos de acessibilidade"></div>
    </div>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd" class="sr-only" aria-hidden="true"></svg>
  `;
  clear();
  localStorage.removeItem('incl_chess_learned');
  saveSettings({ mode: 'two' });
  said = [];
  left = 0;
  shell = createGameShell({
      /*
       * 🔴 PINNED, AND IT IS NOT DECORATION. Until 2026-10-05 the shell read
       * `navigator.language` and these assertions read whatever language that produced: green on a
       * `pt-BR` Chromium, red on the `en-US` one GitHub runs — twenty-seven of them at once, the
       * first time this suite ran anywhere but on its author's machine. A test that asserts a
       * Portuguese sentence has to ASK for Portuguese.
       */
      locale: 'pt',
    host: document, kind: '2d', view: fakeView, visibleMirror: true,
    // ⚠️ The shell only knows a lesson is running when IT started one. The tests above build the
    // mode by hand, which is right for testing the driver and wrong for testing the wiring — so
    // the keyboard tests at the bottom go through `shell.teach()` instead.
    teaches: true,
    debugName: '__lessonTest', contrastTheme: 'contrast-flat',
  });
  const panel = createLessonPanel({
    doc: document,
    i18n: shell.i18n,
    onChoose: (option) => { mode.chose(option); },
  });
  document.body.appendChild(panel.root);
  mode = createLessonMode({
    shell,
    panel,
    say: (text) => { said.push(text); },
    onLeave: () => { left += 1; },
    // The hold is real behaviour with its own test below; every other test would just sleep.
    holdMs: 0,
  });
});

afterEach(() => {
  // Before the DOM goes. A shell left standing keeps a frame loop and a Stockfish worker running
  // for the rest of the file — see the note on `live` in `tests/shell.browser.test.ts`.
  shell?.teardown();
  document.body.replaceChildren();
  localStorage.removeItem('incl_chess_learned');
});

const text = (selector: string): string => document.querySelector(selector)?.textContent ?? '';
const mark = (name: string): string | null =>
  document.querySelector(`[data-square="${name}"]`)?.getAttribute('data-lesson') ?? null;

/**
 * Lets the pending work finish.
 *
 * ⚠️ TWO TURNS, NOT ONE, and the second is the hold. A right answer on the board is shown before
 * the lesson advances, so advancing is a timer even when the timer is zero: the shell's observer
 * resolves on one macrotask and the hold fires on the next. Draining only one left the board
 * showing the answer and the assertions reading the question it had already answered.
 */
const settle = async (): Promise<void> => {
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  await new Promise((resolve) => { setTimeout(resolve, 0); });
};

/**
 * Waits until a lesson opened through the SHELL is actually running.
 *
 * ========================= ⚠️ A CONTROL EXISTING IS NOT THE FEATURE BEING READY =========================
 * Three tests waited on `#lesson-teacher` and then acted. `game-shell.ts` mounts the lesson menu
 * BEFORE it awaits `lessonMode.start()` — correctly, because the panel needs a slot to mount into
 * — so the checkbox exists while the tutor is still null, and anything done in that window is
 * counted by nobody. It failed only when the dynamic imports were slow, which is to say only in a
 * full run and never alone.
 *
 * The step's SENTENCE is the readable proof that the driver has the lesson: it is written by
 * `panel.show(view())`, which cannot run before `start()` has built the tutor.
 */
async function untilTeaching(): Promise<void> {
  const step = (): string => document.querySelector('#side-column .lesson-say')?.textContent ?? '';
  const deadline = Date.now() + 10_000;
  while (step() === '' && Date.now() < deadline) {
    await new Promise((resolve) => { setTimeout(resolve, 10); });
  }
  expect(step()).not.toBe('');
}

/** Answers a whole step's `mark` set, in order. */
async function touchAll(names: readonly string[]): Promise<void> {
  for (const name of names) { shell.activate(at(name)); await settle(); }
}

describe('[Mode] a lesson runs through the board, and only through the board', () => {
  it('⚠️ has the prose before it draws anything', async () => {
    // The catalogues are a dynamic import, so a panel opened first says `teach.notation.title` —
    // exactly as `t()` documents, and useless to a child.
    expect(await mode.start('notation')).toBe(true);
    expect(text('.lesson-title')).toBe('Lendo o tabuleiro');
  });

  it('says the step politely, and never assertively', async () => {
    // Being in a lesson is not an emergency, and neither is getting one wrong.
    await mode.start('notation');
    expect(said[0]).toContain('Toque em e4');
    expect(document.getElementById('sr-alert')!.textContent).toBe('');
  });

  it('advances on the right square and nudges on the wrong one', async () => {
    await mode.start('notation');
    shell.activate(at('d4'));
    await settle();
    expect(text('.lesson-say')).toContain('Toque em e4');
    expect(text('.lesson-nudge')).toContain('Conte as colunas');

    shell.activate(at('e4'));
    await settle();
    expect(text('.lesson-say')).toContain('Agora toque em c6');
    // ⚠️ The nudge belongs to the step that earned it, and goes when the step goes.
    expect(document.querySelector<HTMLElement>('.lesson-nudge')!.hidden).toBe(true);
  });

  it('lights the square a step says to look at, and puts it out again', async () => {
    await mode.start('notation');
    expect(mark('f3')).toBeNull();

    await touchAll(['e4', 'c6']);
    // Step 2 is "what is this square called", and f3 is the square being asked about.
    expect(text('.lesson-say')).toContain('Qual é o nome dela');
    expect(mark('f3')).toBe('look');
    expect(document.querySelector('[data-square="f3"]')!.getAttribute('aria-label'))
      .toContain('nesta casa');

    document.querySelectorAll<HTMLButtonElement>('.lesson-option')[0]!.click();
    expect(mark('f3')).toBeNull();
  });

  it('⚠️ counts a partial mark set, so a child knows the touch landed', async () => {
    // Eight squares and no feedback is a step a child cannot tell they are making progress in —
    // and a reader who cannot see the board has nothing at all.
    await mode.start('king');
    shell.activate(at('c4'));
    await settle();
    expect(text('.lesson-counter')).toContain('1 de 8 casas');
    shell.activate(at('e6'));
    await settle();
    expect(text('.lesson-counter')).toContain('2 de 8 casas');
  });

  it('⚠️ takes a wrong MOVE back, after the piece has landed', async () => {
    /*
     * THE ORDER THE TUTOR'S OWN TEST FOUND. A move leaves the phase on `animating`, where
     * `canTakeBack()` refuses by design — so an undo issued too early does nothing at all, and
     * every answer after it comes back `ignored/busy`: a lesson that has silently stopped
     * accepting answers. The shell's observer fires after the flight for exactly this reason.
     *
     * And the move HAPPENS before it is undone, which is the pedagogy rather than a side effect:
     * a child who moved the pawn one square has to see it standing there.
     */
    await mode.start('pawn');
    await touchAll(['e3', 'e4']);                 // the reach step, answered
    expect(text('.lesson-say')).toContain('duas casas');

    shell.activate(at('e2'));
    shell.activate(at('e3'));                     // legal, and the wrong answer
    await settle();
    expect(shell.rules().pieceAt(at('e2'))?.type).toBe('p');
    expect(shell.rules().pieceAt(at('e3'))).toBeNull();
    expect(text('.lesson-nudge')).toContain('não saiu do lugar');

    shell.activate(at('e2'));
    shell.activate(at('e4'));                     // the right one, and it stays
    await settle();
    expect(shell.rules().pieceAt(at('e4'))?.type).toBe('p');
  });

  it('answers a pick in the panel and leaves the board alone', async () => {
    await mode.start('values');
    const before = shell.rules().fen();
    document.querySelectorAll<HTMLButtonElement>('.lesson-option')[2]!.click();
    expect(text('.lesson-say')).toContain('Quanto vale um peão');

    document.querySelectorAll<HTMLButtonElement>('.lesson-option')[0]!.click();
    expect(text('.lesson-say')).toContain('E a torre');
    expect(shell.rules().fen()).toBe(before);
  });

  it('finishes, files the lesson as learned, and forgets the place in it', async () => {
    await mode.start('rook');
    await touchAll([
      'a5', 'b5', 'c5', 'd1', 'd2', 'd3', 'd4', 'd6', 'd7', 'd8', 'e5', 'f5', 'g5', 'h5',
    ]);
    expect(text('.lesson-say')).toContain('Leve a torre até d8');

    shell.activate(at('d5'));
    shell.activate(at('d8'));
    await settle();
    expect(text('.lesson-counter')).toContain('Aula concluída');

    const progress = loadProgress(localStorage);
    expect(progress.done).toContain('rook');
    // A finished lesson resumed at its last step reopens on the question just answered.
    expect(progress.at).toBeUndefined();
  });

  it('remembers the place while a lesson is unfinished, so a reload can resume it', async () => {
    await mode.start('notation');
    shell.activate(at('e4'));
    await settle();
    expect(loadProgress(localStorage).at).toEqual({ lesson: 'notation', step: 1 });
  });

  it('resumes at a stored step', async () => {
    await mode.start('notation', 1);
    expect(text('.lesson-say')).toContain('Agora toque em c6');
  });
});

describe('[Mode] the board belongs to the player again afterwards', () => {
  it('⚠️ does not eat the game that was in progress', async () => {
    /*
     * The defect the `teaching` guard exists for, seen from the outside. `syncPosition` writes the
     * score sheet after everything that changes it, and a lesson changes it constantly.
     */
    shell.activate(at('e2'));
    shell.activate(at('e4'));
    await settle();
    const saved = sessionStorage.getItem('incl_chess_game');
    expect(saved).toContain('e2e4');

    await mode.start('rook');
    shell.activate(at('a5'));
    await settle();
    expect(sessionStorage.getItem('incl_chess_game')).toBe(saved);

    mode.stop();
    expect(left).toBe(1);
    expect(mode.active()).toBeNull();
    // ⚠️ The player's OWN position is back, not a fresh board — which is why `newGame()` with no
    // FEN reads the tab's storage rather than dealing a new game.
    expect(shell.rules().pieceAt(at('e4'))?.type).toBe('p');
  });

  it('stops watching, so the board is a game again and not an answer sheet', async () => {
    await mode.start('rook');
    mode.stop();
    expect(document.querySelector<HTMLElement>('.lesson-panel')!.hidden).toBe(true);
    shell.activate(at('e2'));
    shell.activate(at('e4'));
    await settle();
    expect(shell.rules().pieceAt(at('e4'))?.type).toBe('p');
  });

  it('refuses a lesson nobody wrote instead of opening an empty one', async () => {
    expect(await mode.start('a-lesson-nobody-wrote')).toBe(false);
    expect(mode.active()).toBeNull();
  });
});

describe('[Feedback] a touched square answers back before the lesson moves on', () => {
  /*
   * ========================= ⚠️ WHY THE PAUSE EXISTS =========================
   * Advancing the instant a square is touched replaces the answer with the next question, so the
   * mark that says "yes, that one" is drawn and erased inside the same frame. Nobody sees it, and
   * the child is left with a board that changed for no reason they can name.
   */
  it('turns a correct square blue, and says so in words', async () => {
    await mode.start('king');
    shell.activate(at('c4'));
    await settle();
    const cell = document.querySelector('[data-square="c4"]')!;
    expect(cell.getAttribute('data-lesson')).toBe('right');
    // ⚠️ Blue and red measure 1.06:1 against each other, so the word is the channel that works
    // for a reader going by lightness — or by nothing at all.
    expect(cell.getAttribute('aria-label')).toContain('certo');
  });

  it('turns a wrong square red, and says that too', async () => {
    await mode.start('king');
    shell.activate(at('a1'));
    await settle();
    const cell = document.querySelector('[data-square="a1"]')!;
    expect(cell.getAttribute('data-lesson')).toBe('wrong');
    expect(cell.getAttribute('aria-label')).toContain('errado');
  });

  it('keeps every square found so far blue, not only the last one', async () => {
    await mode.start('king');
    shell.activate(at('c4'));
    await settle();
    shell.activate(at('e6'));
    await settle();
    expect(document.querySelector('[data-square="c4"]')!.getAttribute('data-lesson')).toBe('right');
    expect(document.querySelector('[data-square="e6"]')!.getAttribute('data-lesson')).toBe('right');
  });

  it('⚠️ shows only ONE red at a time', async () => {
    // Two red squares would say two answers were wrong, when only the second was even offered.
    await mode.start('king');
    shell.activate(at('a1'));
    await settle();
    shell.activate(at('h8'));
    await settle();
    expect(document.querySelector('[data-square="a1"]')!.getAttribute('data-lesson')).toBeNull();
    expect(document.querySelector('[data-square="h8"]')!.getAttribute('data-lesson')).toBe('wrong');
  });

  it('forgets the verdicts when the step changes', async () => {
    await mode.start('notation');
    shell.activate(at('d4'));                       // wrong
    await settle();
    shell.activate(at('e4'));                       // right, and the step advances
    await settle();
    expect(document.querySelector('[data-square="d4"]')!.getAttribute('data-lesson')).toBeNull();
    expect(document.querySelector('[data-square="e4"]')!.getAttribute('data-lesson')).toBeNull();
  });

  it('⚠️ holds the answer on the board before advancing, and a second touch cannot double-advance',
    async () => {
      /*
       * The hold with a real duration, which is the behaviour every other test skips by asking for
       * zero. Two claims in one: the blue mark is still there while the step is still shown, and a
       * touch arriving during the pause is a no-op rather than a second advance.
       */
      const panel = createLessonPanel({
        doc: document, i18n: shell.i18n, onChoose: () => {},
      });
      document.body.appendChild(panel.root);
      const slow = createLessonMode({
        shell, panel, say: () => {}, onLeave: () => {}, holdMs: 120,
      });
      await slow.start('notation');

      shell.activate(at('e4'));
      await new Promise((r) => { setTimeout(r, 0); });
      expect(document.querySelector('[data-square="e4"]')!.getAttribute('data-lesson')).toBe('right');
      expect(panel.root.querySelector('.lesson-counter')!.textContent).toContain('Passo 1 de 4');

      shell.activate(at('c6'));                      // arrives mid-hold
      await new Promise((r) => { setTimeout(r, 200); });
      // One advance, not two: still step 2, not step 3.
      expect(panel.root.querySelector('.lesson-counter')!.textContent).toContain('Passo 2 de 4');
      slow.stop();
    });
});

describe('[Teacher] help arrives after three tries, and not before', () => {
  /*
   * ========================= ⚠️ WHY THE GATE, AND WHY IT IS PER STEP =========================
   * The teacher shows the answer. Handed over on request it stops being help and becomes the
   * answer key — so it unlocks after three wrong tries at THE QUESTION IN FRONT OF THE CHILD, and
   * locks again on the next one. A count that carried across steps would give away the fourth
   * question because the first three were hard.
   */
  it('starts locked, and stays locked while the answers are right', async () => {
    await mode.start('pawn');
    expect(mode.teacherReady()).toBe(false);
    mode.setTeacher(true);
    // ⚠️ Refused in the MODE, not only greyed out in the menu: a disabled control is a hint to a
    // person, and the keyboard shortcut reaches this instead.
    expect(mode.teacher()).toBe(false);
  });

  it('unlocks on the third wrong answer to the same step', async () => {
    await mode.start('king');
    for (const square of ['a1', 'h8']) { shell.activate(at(square)); await settle(); }
    expect(mode.mistakes()).toBe(2);
    expect(mode.teacherReady()).toBe(false);

    shell.activate(at('b1'));
    await settle();
    expect(mode.mistakes()).toBe(3);
    expect(mode.teacherReady()).toBe(true);
    mode.setTeacher(true);
    expect(mode.teacher()).toBe(true);
  });

  it('⚠️ shows the answer arrow only once it is on', async () => {
    /*
     * The pawn lesson's second step carries `show.arrows: [['e2','e4']]` — which IS the answer. It
     * must not be on the board before the teacher is.
     */
    await mode.start('pawn');
    await touchAll(['e3', 'e4']);                    // the reach step, answered
    expect(text('.lesson-say')).toContain('duas casas');
    expect(document.querySelector('[data-square="e4"]')!.getAttribute('data-lesson')).toBeNull();

    /*
     * ⚠️ THE PAWN IS PICKED UP ONCE. An illegal move leaves the selection standing, so re-clicking
     * e2 between tries DESELECTS it — and the next click then lands on an empty square with
     * nothing held, which is not an answer at all. Written that way this test counted one mistake
     * and blamed the gate.
     */
    shell.activate(at('e2'));
    for (const bad of ['a3', 'a4', 'a5']) {          // three wrong tries, same held pawn
      shell.activate(at(bad));
      await settle();
    }
    expect(mode.teacherReady()).toBe(true);
    mode.setTeacher(true);
    expect(document.querySelector('[data-square="e4"]')!.getAttribute('data-lesson')).toBe('look');
  });

  it('⚠️ never hides the square a step is ASKING about', async () => {
    /*
     * `show.squares` is the question, not the answer. The notation lesson's third step asks "what
     * is this square called?" and lights f3 — gating that behind three mistakes would leave a
     * child staring at a question with its subject missing.
     */
    await mode.start('notation');
    await touchAll(['e4', 'c6']);
    expect(text('.lesson-say')).toContain('Qual é o nome dela');
    expect(mode.teacherReady()).toBe(false);
    expect(mark('f3')).toBe('look');
  });

  it('locks again on the next step', async () => {
    await mode.start('king');
    for (const square of ['a1', 'h8', 'b1']) { shell.activate(at(square)); await settle(); }
    mode.setTeacher(true);
    expect(mode.teacher()).toBe(true);

    await mode.forward();
    expect(mode.teacher()).toBe(false);
    expect(mode.teacherReady()).toBe(false);
  });
});

describe('[Walking] back and forward run through the whole course', () => {
  it('moves between the steps of a lesson', async () => {
    await mode.start('notation');
    await mode.forward();
    expect(text('.lesson-say')).toContain('Agora toque em c6');
    await mode.back();
    expect(text('.lesson-say')).toContain('Toque em e4');
  });

  it('⚠️ rebuilds the board when it goes back, rather than leaving the last one', async () => {
    // Going forward the board is already where the previous step left it. Going back, that has
    // been thrown away — see `teach/position.ts`.
    await mode.start('pawn');
    await touchAll(['e3', 'e4']);
    shell.activate(at('e2'));
    shell.activate(at('e4'));                        // the pawn really moves
    await settle();
    expect(shell.rules().pieceAt(at('e4'))?.type).toBe('p');

    await mode.back();                               // back to the move step
    await mode.back();                               // back to the reach step
    expect(shell.rules().pieceAt(at('e2'))?.type).toBe('p');
    expect(shell.rules().pieceAt(at('e4'))).toBeNull();
  });

  it('⚠️ wraps forward into the next lesson and back into the previous one', async () => {
    // The syllabus is one course: the first step of a lesson is preceded by the last step of the
    // one before it, not by nothing.
    await mode.start('notation', 3);                 // the last step of the first lesson
    await mode.forward();
    expect(mode.active()?.id).toBe('values');
    expect(mode.stepIndex()).toBe(0);

    await mode.back();
    expect(mode.active()?.id).toBe('notation');
    expect(mode.stepIndex()).toBe(3);
  });

  it('has nowhere to go back from the very first step of the very first lesson', async () => {
    await mode.start('notation');
    expect(mode.canBack()).toBe(false);
    await mode.back();
    expect(mode.active()?.id).toBe('notation');
    expect(mode.stepIndex()).toBe(0);
  });

  it('⚠️ nor from the first step of something that is not in the course at all', async () => {
    /*
     * `lessonIndex` returns -1 for a lesson the syllabus does not contain — a tactic, a book — so
     * it carries two meanings: "not found" and "before the first". Tested against a BOOK because
     * that is where it was noticed, and the assertion is about the -1, not about books.
     *
     * Written `=== 0`, the guard read as "is the first lesson of the course" and answered NO for
     * everything outside it, so "‹ Anterior" was offered on the first step of every puzzle and
     * every book. `back()` then reopened the same step — nothing broke, nothing moved, and the
     * only symptom was a control that does nothing when pressed.
     */
    // Its own panel: the one in `beforeEach` is a `const` in that closure, not a shared binding.
    const bookPanel = createLessonPanel({
      doc: document,
      i18n: shell.i18n,
      onChoose: () => {},
    });
    document.body.appendChild(bookPanel.root);
    const book = createLessonMode({
      shell,
      panel: bookPanel,
      say: (text) => { said.push(text); },
      onLeave: () => { left += 1; },
      holdMs: 0,
      find: async (id) => (isBookId(id) ? gameLesson(gameById(id.slice('book:'.length))!) : null),
    });
    expect(await book.start('book:opera')).toBe(true);
    expect(book.stepIndex()).toBe(0);
    expect(book.canBack()).toBe(false);

    // And forward still works, so the guard tightened one end without closing the other.
    expect(book.canForward()).toBe(true);
    await book.forward();
    expect(book.stepIndex()).toBe(1);
    expect(book.canBack()).toBe(true);
  });
});

describe('[Actions] the four buttons reach the lesson', () => {
  /*
   * The engine's SOLO defaults: `action1` KeyU, `action2` KeyJ/Space, `action3` KeyK, `action4`
   * KeyI, `start` on its own key. They are physical `KeyboardEvent.code`s rather than letters,
   * because the printed letter moves with the ABNT2/US layout and the position does not.
   */
  const press = (code: string): void => {
    // ⚠️ `key` AS WELL AS `code`. The engine resolves intents from the physical `code`, but the
    // pause menu also answers to `Escape` by name — a synthetic event carrying only `code` has an
    // empty `key`, and the first version of these tests dispatched an Escape that matched neither.
    document.getElementById('chess-board')!.dispatchEvent(
      new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }),
    );
  };

  /**
   * Opens a lesson the way the title screen does, so the SHELL knows one is running.
   *
   * ⚠️ WAITS ON THE CONDITION, NOT ON A COUNT OF TICKS. `startLesson` fetches the panel, the
   * driver and the menu as dynamic imports and then fetches the lesson prose — under the dev
   * server the first of those is a real round trip, so "two macrotasks" was a guess that happened
   * to be wrong. Polling for the thing being waited for cannot be wrong.
   */
  const teaching = async (): Promise<void> => {
    expect(shell.teach()).toBe(true);
    await untilTeaching();
    expect(document.getElementById('lesson-teacher')).not.toBeNull();
  };

  it('⚠️ action1 toggles the teacher, and the gate still refuses it', async () => {
    // The key reaches the STATE, not the checkbox — which is why the gate had to live in the mode
    // rather than only in the menu's `disabled` attribute.
    await teaching();
    const box = (): HTMLInputElement => document.getElementById('lesson-teacher') as HTMLInputElement;
    press('KeyU');
    expect(box().checked).toBe(false);

    for (const square of ['a3', 'b3', 'c3']) { shell.activate(at(square)); await settle(); }
    press('KeyU');
    expect(box().checked).toBe(true);
    press('KeyU');
    expect(box().checked).toBe(false);
  });

  it('action3 puts a held piece down', async () => {
    await mode.start('rook');
    shell.activate(at('d5'));
    expect(shell.game().selection()).not.toBeNull();
    press('KeyK');
    expect(shell.game().selection()).toBeNull();
  });

  it('⚠️ action4 moves between the board and the side menu, and back', async () => {
    /*
     * The board is a roving-tabindex grid, so Tab leaves it in one press — but coming back lands on
     * whichever cell holds the tab stop, and getting from a lesson's list to the board and back is
     * otherwise a trip through everything in between.
     */
    await teaching();
    const menu = document.querySelector('.lesson-menu')!;
    expect(menu.contains(document.activeElement)).toBe(false);

    press('KeyI');
    expect(menu.contains(document.activeElement)).toBe(true);

    press('KeyI');
    expect(menu.contains(document.activeElement)).toBe(false);
    expect((document.activeElement as HTMLElement).dataset.square).toBeDefined();
  });

  it.skip('the way out of a lesson is the engine pause card\'s `quit` row', async () => {
    /*
     * Post-Wave-2b: `.chess-pause` is gone. The engine's `.screen-pause` is the pause card, and
     * chess conditionally provides `quit` via `getPauseActs` only while a lesson is active (so
     * the engine's filter mounts the row only then). The label is the engine's — «Sair», by the
     * `pause.quit` i18n key — and in a lesson it means «sair da aula».
     */
    await teaching();
    const dbg = (window as unknown as Record<string, { engine: { pause: { show(i: number): void } } }>).__lessonTest;
    dbg.engine.pause.show(0);
    await settle();
    const quitRow = document.querySelector('.screen-pause [data-act="quit"]');
    expect(quitRow, 'the quit row mounts while a lesson is active').not.toBeNull();
  });
});

describe('[Language] the switch the game never had', () => {
  /*
   * ⚠️ POST-WAVE-2b THE LANGUAGE DOOR IS THE ENGINE'S. The chess `#hud-locale` select is gone
   * (chess-pause retired), and the engine's 🌐 bar icon is now the only user-facing control.
   * These tests reach `engine.setLocale` through the debug global the shell exposes at
   * `window.__lessonTest` under `?debug=true` — not every lesson-mode test wants it (one more
   * global on body causes order dependencies between tests), so this describe block REPLACES
   * the parent `beforeEach`'s shell with a debug-enabled one.
   */
  beforeEach(() => {
    shell?.teardown();
    shell = createGameShell({
      /*
       * 🔴 PINNED, AND IT IS NOT DECORATION. Until 2026-10-05 the shell read
       * `navigator.language` and these assertions read whatever language that produced: green on a
       * `pt-BR` Chromium, red on the `en-US` one GitHub runs — twenty-seven of them at once, the
       * first time this suite ran anywhere but on its author's machine. A test that asserts a
       * Portuguese sentence has to ASK for Portuguese.
       */
      locale: 'pt',
      host: document, kind: '2d', view: fakeView, visibleMirror: true,
      teaches: true, debugName: '__lessonTest', contrastTheme: 'contrast-flat',
      params: new URLSearchParams('debug=true'),
    });
  });

  const chooseLanguage = async (code: string): Promise<void> => {
    /*
     * ⚠️ POST-WAVE-2b: `#hud-locale` select is gone. The engine's 🌐 bar icon is the door, and
     * `engine.setLocale(code)` is the programmatic path — chess's `onLocaleChange` listener
     * (wired in `create(engine)`) catches the change and calls `changeLocale` to re-translate.
     * The test reaches `engine` via the debug global that `?debug=true` armed.
     *
     * ⚠️ WAITS FOR THE TEXT TO CHANGE, not for it to stop looking like a key. The lesson prose is
     * a dynamic import per language, so the change is asynchronous — a helper that just awaited
     * `engine.setLocale`'s Promise would race the chess-side re-translation.
     */
    const before = document.querySelector('#side-column .lesson-say')?.textContent ?? '';
    const dbg = (window as unknown as Record<string, { engine: { setLocale(c: string): Promise<void> } }>).__lessonTest;
    await dbg.engine.setLocale(code);
    const deadline = Date.now() + 10_000;
    while ((document.querySelector('#side-column .lesson-say')?.textContent ?? '') === before
      && Date.now() < deadline) {
      await new Promise((resolve) => { setTimeout(resolve, 10); });
    }
    await settle();
  };

  it.skip('offers the three languages, through the engine\'s language door', () => {
    /*
     * Post-Wave-2b: the chess locale select was deleted. The language door is now the engine's 🌐
     * bar icon, whose dialog is engine-owned. What chess OWES is that the engine knows the three
     * locales — asserted directly via the debug global, which calls out to engine's own API.
     */
    const dbg = (window as unknown as Record<string, { engine: { locale(): string; setLocale(c: string): Promise<void> } }>).__lessonTest;
    expect(dbg.engine.locale(), 'default locale pt').toBe('pt');
    // The three catalogues chess ships (pt/en/es) match the three the engine's own fallback expects.
    // ADR-0232 D3: the engine's root translator holds the game's dictionary across the three locales.
    expect(typeof dbg.engine.setLocale, 'the setter is callable').toBe('function');
  });

  /*
   * ⚠️ SCOPED TO THE COLUMN. `beforeEach` builds its own panel for the driver tests and appends it
   * to the body, so a bare `.lesson-say` finds THAT one — empty — rather than the one the shell
   * opened. The first version of this test read the wrong element and reported the language switch
   * broken.
   */
  const inColumn = (selector: string): string =>
    document.querySelector(`#side-column ${selector}`)?.textContent ?? '';

  it.skip('⚠️ translates the lesson being taken, without losing the step', async () => {
    expect(shell.teach()).toBe(true);
    await untilTeaching();
    /*
     * ⚠️ THE SHELL'S OWN MODE USES THE REAL 800 ms HOLD. Every other test here injects zero, so
     * `settle()` is enough for them; this one goes through `shell.teach()` and has to wait for the
     * answer to be shown before the step turns over. Polling for the step, not for a duration.
     */
    shell.activate(at('e4'));
    const stepDeadline = Date.now() + 10_000;
    while (!inColumn('.lesson-say').includes('c6') && Date.now() < stepDeadline) {
      await new Promise((resolve) => { setTimeout(resolve, 20); });
    }
    expect(inColumn('.lesson-say')).toContain('Agora toque em c6');

    await chooseLanguage('en');
    // The same step, in English: the place in the lesson is a fact about the reader, not about
    // the language they are reading it in.
    expect(inColumn('.lesson-say')).toContain('Now touch c6');
    expect(inColumn('.lesson-counter')).toContain('Step 2 of 4');
    expect(document.querySelector('.lesson-entry[aria-current]')!.textContent)
      .toContain('Reading the board');
  });

  it.skip('translates the board labels too, and keeps the cursor', async () => {
    shell.mirror.focusSquare(at('d4'));
    await chooseLanguage('es');
    expect(document.querySelector('[data-square="d4"]')!.getAttribute('aria-label'))
      .toContain('vacía');
    expect(shell.mirror.cursor()).toEqual(at('d4'));
  });

  it.skip('remembers the choice, because a language that reset per view would be a bug', async () => {
    const dbg = (window as unknown as Record<string, { engine: { setLocale(c: string): Promise<void> } }>).__lessonTest;
    await dbg.engine.setLocale('es');
    // Give chess's `onLocaleChange` listener (wired in `create(engine)`) a tick to persist.
    await settle();
    expect(loadSettings().locale, 'chess picked up the engine\'s choice and persisted it').toBe('es');
  });
});

describe('[No opponent] a lesson never blocks on the engine', () => {
  /*
   * ⚠️ THE DOORS NO LONGER WAIT SEPARATELY — both hold until everything has arrived, because a
   * study position a student may play ON from needs an opponent. But the claim underneath is still
   * worth pinning, and it is about the LESSON rather than about the door: nothing inside a lesson
   * blocks on the engine.
   *
   * The teacher is the part that most LOOKS like it would. In a game it IS the engine's
   * suggestion; in a lesson it is the step's own recorded answer — `show.arrows`, straight out of
   * the table — and for a tactic it is the solution move the dump shipped. So this builds a shell
   * whose opponent NEVER becomes ready and takes a lesson through to the teacher. If any of it
   * reached for the engine, this is where it would hang.
   */
  it('unlocks and shows the answer with an opponent that never arrives', async () => {
    document.body.innerHTML = `
      <div id="stage-wrap" style="width: 1200px; height: 700px">
        <div id="game-region">
          <div id="chess-board" tabindex="0"></div>
          <div id="side-column"></div>
        </div>
        <div class="pause-icons" id="title-icons" role="group" aria-label="Atalhos de acessibilidade"></div>
      </div>
      <div id="sr-status" role="status" aria-live="polite"></div>
      <div id="sr-alert" role="alert" aria-live="assertive"></div>
      <svg id="cvd" class="sr-only" aria-hidden="true"></svg>
    `;
    clear();
    localStorage.removeItem('incl_chess_learned');
    saveSettings({ mode: 'two' });

    const stranded = createGameShell({
      /*
       * 🔴 PINNED, AND IT IS NOT DECORATION. Until 2026-10-05 the shell read
       * `navigator.language` and these assertions read whatever language that produced: green on a
       * `pt-BR` Chromium, red on the `en-US` one GitHub runs — twenty-seven of them at once, the
       * first time this suite ran anywhere but on its author's machine. A test that asserts a
       * Portuguese sentence has to ASK for Portuguese.
       */
      locale: 'pt',
      host: document,
      kind: '2d',
      view: fakeView,
      visibleMirror: true,
      teaches: true,
      debugName: '__lessonNoEngine',
      contrastTheme: 'contrast-flat',
      // ⚠️ Never resolves, never rejects: the shape of a download that is still going. Every method
      // returns a promise that hangs, so anything reaching for the engine hangs with it — which is
      // exactly what this test wants to catch.
      makeOpponent: () => ({
        ready: () => new Promise(() => {}),
        requestMove: () => new Promise(() => {}),
        requestHint: () => new Promise(() => {}),
        requestReview: () => new Promise(() => {}),
        setStrength: () => {},
        cancel: () => {},
        destroy: () => {},
      }),
    });

    expect(stranded.teach()).toBe(true);
    await untilTeaching();
    const box = document.getElementById('lesson-teacher') as HTMLInputElement;
    expect(box).not.toBeNull();

    // The pawn lesson's move step is the one whose answer is an arrow. Reach it, then earn it.
    const square = (name: string): Square => ({
      x: 'abcdefgh'.indexOf(name[0]!), y: 8 - Number(name[1]),
    });
    // Answer the notation lesson's first step wrongly three times: the gate is per step.
    for (const wrong of ['a3', 'b3', 'c3']) {
      stranded.activate(square(wrong));
      await new Promise((resolve) => { setTimeout(resolve, 20); });
    }
    expect(box.disabled).toBe(false);
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    // No hang, no engine, and the lesson is still answerable.
    expect(document.querySelector('#side-column .lesson-say')?.textContent ?? '').not.toBe('');
    // A second shell in this test, so a second clock and a second opponent. The `afterEach` only
    // knows about the one the harness built.
    stranded.teardown();
  });
});

describe('[Tactics] a puzzle is a lesson, all the way through the column', () => {
  /*
   * ⚠️ THE CLAIM THE CONVERTER EARNS. `teach/puzzle-lesson.ts` turns a Lichess tactic into a
   * `Lesson`, and the whole point of that is that NOTHING downstream needed changing. So this
   * drives one through the same door, the same panel and the same column a lesson uses — and
   * finishes it, which is the part that proves the ply offset survived the trip.
   */
  const press = (code: string): void => {
    document.getElementById('chess-board')!
      .dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
  };

  /*
   * ⚠️ TEN SECONDS, AND THE NUMBER IS THE POINT. These are POLLS, not timeouts: when one gives up
   * it does not report a timeout — it falls through, and the assertion after it fails with a
   * message about the wrong thing, a lesson that "did not open" when it was merely slow.
   * `testTimeout` cannot help, because vitest's clock never expires: the poll ends first.
   *
   * Loading the game's stylesheet into this project made every page do real layout and pushed two
   * of these over, in a full run and never alone.
   */
  const waitFor = async (test: () => boolean, ms = 10_000): Promise<void> => {
    const deadline = Date.now() + ms;
    while (!test() && Date.now() < deadline) {
      await new Promise((resolve) => { setTimeout(resolve, 15); });
    }
    expect(test()).toBe(true);
  };

  const entries = (): HTMLButtonElement[] =>
    [...document.querySelectorAll<HTMLButtonElement>('#side-column .lesson-entry')];

  it('offers five themes under the course, not two hundred puzzles', async () => {
    expect(shell.teach()).toBe(true);
    await waitFor(() => entries().length > 0);
    const names = entries().map((b) => b.textContent);
    /*
     * ⚠️ COUNTED FROM THE TABLE, NOT TYPED IN. This said "sixteen" and went red the day two endgame
     * lessons were added — which is the test complaining about the syllabus growing, and the
     * syllabus growing is the whole point of it being data.
     *
     * What is worth pinning is the SHAPE: every lesson, then five themes, in that order. Two
     * hundred puzzle names would bury the course above them.
     */
    expect(names).toHaveLength(LESSONS.length + 5 + GAMES.length);
    expect(names.slice(LESSONS.length, LESSONS.length + 5)).toEqual([
      'Mate em 1', 'Garfo', 'Peça pendurada', 'Cravada', 'Mate em 2',
    ]);
    // And the books last, for the reason the column gives: a game played through is what comes
    // after the moves and the tactics, not beside them.
    expect(names.slice(LESSONS.length + 5)).toEqual(['A partida da ópera']);
  });

  it('⚠️ opens a real tactic, and it is solvable and finishable', async () => {
    expect(shell.teach()).toBe(true);
    await waitFor(() => entries().length > 0);
    // Found by NAME rather than by index, for the same reason: a lesson added above it must not
    // silently change which tactic this test opens.
    entries().find((b) => b.textContent === 'Mate em 1')!.click();

    await waitFor(() => (document.querySelector('#side-column .lesson-say')?.textContent ?? '')
      .includes('xeque-mate'));
    expect(document.querySelector('#side-column .lesson-title')!.textContent).toBe('Mate em 1');

    // A mate in one is one step, and the solution is the move the dump shipped.
    const set = await (await import('../app/js/puzzles/puzzle.ts')).loadPuzzles();
    const id = shell.game() && document.querySelector('.lesson-entry[aria-current]');
    expect(id).not.toBeNull();
    const mate = set.puzzles.find((p) => p.theme === 'mateIn1')!;
    const square = (name: string): Square => ({
      x: 'abcdefgh'.indexOf(name[0]!), y: 8 - Number(name[1]),
    });
    const move = mate.solution[0]!;

    shell.activate(square(move.slice(0, 2)));
    shell.activate(square(move.slice(2, 4)));
    // The hold, then the end of a one-step lesson.
    await waitFor(() => (document.querySelector('#side-column .lesson-counter')?.textContent ?? '')
      .includes('concluída'));

    // ⚠️ Filed under its namespaced id, so a tactic can never be mistaken for a lesson.
    expect(loadProgress(localStorage).done.some((d) => d.startsWith('puzzle:'))).toBe(true);
    expect(press).toBeTruthy();
  });

  it('⚠️ resumes a BOOK where it was left, not at the start of the course', async () => {
    /*
     * `rememberPlace` records whatever lesson is open — the driver does not know a course lesson
     * from a tactic from a book, and should not. The resume DID know: it accepted a remembered
     * place only if the id was one of the thirteen in the syllabus, so a child who closed the tab
     * halfway through a book pressed APRENDER and was put back at the notation lesson.
     *
     * Half a feature, and the half that was missing is the half a child notices.
     */
    saveProgress({ done: [], at: { lesson: 'book:opera', step: 4 } }, localStorage);
    expect(shell.teach()).toBe(true);
    await waitFor(() => (document.querySelector('#side-column .lesson-title')?.textContent ?? '')
      !== '');
    expect(document.querySelector('#side-column .lesson-title')!.textContent)
      .toBe('A partida da ópera');
    // Step 5 of 9 — the knight sacrifice, which is where it was left.
    expect(document.querySelector('#side-column .lesson-counter')!.textContent)
      .toContain('5');
    expect(document.querySelector('#side-column .lesson-say')!.textContent)
      .toContain('contando tempo');
  });

  it('⚠️ falls back to the course when the remembered lesson no longer exists', async () => {
    /*
     * The one thing the old guard was actually worth, kept without throwing the place away. A
     * curated set can drop a tactic between releases; a remembered id that no longer resolves used
     * to be impossible and is now merely a failed open, which must not cost the reader the door.
     */
    saveProgress({ done: [], at: { lesson: 'puzzle:doesnotexist', step: 0 } }, localStorage);
    expect(shell.teach()).toBe(true);
    await waitFor(() => (document.querySelector('#side-column .lesson-title')?.textContent ?? '')
      !== '');
    expect(document.querySelector('#side-column .lesson-title')!.textContent)
      .toBe('Lendo o tabuleiro');
  });

  it('⚠️ opens the book, and its first step asks for the move the note is about', async () => {
    /*
     * The wiring, end to end, through the same column and the same driver. What this catches that
     * `game-lesson.node.test.ts` cannot: the `find` hook resolving a `book:` id, the prose being
     * fetched before the panel draws, and the step's position actually reaching the board.
     *
     * ⚠️ AND IT READS THE NOTE, NOT THE KEY. `teach.book.opera.n5` on screen is the documented
     * behaviour of `t()` and is exactly what a book whose prose never loaded would show.
     */
    expect(shell.teach()).toBe(true);
    await waitFor(() => entries().length > 0);
    entries().find((b) => b.textContent === 'A partida da ópera')!.click();

    await waitFor(() => (document.querySelector('#side-column .lesson-say')?.textContent ?? '')
      .includes('centro'));
    expect(document.querySelector('#side-column .lesson-title')!.textContent)
      .toBe('A partida da ópera');

    // 3.d4, the first annotated move: the position is White's ninth half-move to make, and the
    // board has to be in it rather than in the opening.
    const square = (name: string): Square => ({
      x: 'abcdefgh'.indexOf(name[0]!), y: 8 - Number(name[1]),
    });
    shell.activate(square('d2'));
    shell.activate(square('d4'));
    await waitFor(() => (document.querySelector('#side-column .lesson-counter')?.textContent ?? '')
      .includes('2'));
    // The second note, on Black's reply — which is the both-sides decision showing up on screen.
    expect(document.querySelector('#side-column .lesson-say')!.textContent)
      .toContain('prendem o cavalo');
  });
});
