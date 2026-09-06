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
import { createGameShell, type GameShell } from '../app/js/boot/game-shell.ts';
import { createLessonMode, type LessonMode } from '../app/js/boot/lesson-mode.ts';
import { createLessonPanel } from '../app/js/ui/lesson-panel.ts';
import type { BoardView, ViewContext } from '../app/js/boot/view.ts';
import { clear, loadProgress, loadSettings, saveSettings } from '../app/js/chess/session.ts';
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
      <div id="stage">
        <div id="game-region" tabindex="0"></div>
        <div id="side-column"></div>
      </div>
    </div>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd" aria-hidden="true"></svg>
  `;
  clear();
  localStorage.removeItem('incl_chess_learned');
  saveSettings({ mode: 'two' });
  said = [];
  left = 0;
  shell = createGameShell({
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
    document.getElementById('game-region')!.dispatchEvent(
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
    const deadline = Date.now() + 3000;
    while (!document.getElementById('lesson-teacher') && Date.now() < deadline) {
      await new Promise((resolve) => { setTimeout(resolve, 10); });
    }
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

  it('start opens the pause menu, and the way out of a lesson is in it', async () => {
    await teaching();
    press('Escape');
    const actions = [...document.querySelectorAll('.pause-action')].map((b) => b.textContent);
    expect(actions).toContain('Sair da aula');
  });
});

describe('[Language] the switch the game never had', () => {
  /*
   * ⚠️ THREE CATALOGUES SHIPPED AND `setLocale` WAS CALLED NOWHERE IN PRODUCTION. The language was
   * decided at boot from `navigator.language` and never again, so a child on a Portuguese machine
   * could not read the game in Spanish however much they wanted to — and the plan's own
   * verification list has had "changing language mid-lesson keeps the progress" on it, unrunnable,
   * since it was written.
   */
  const chooseLanguage = async (code: string): Promise<void> => {
    /*
     * ⚠️ WAITS FOR THE TEXT TO CHANGE, not for it to stop looking like a key. The prose is a
     * dynamic import per language, so the change is asynchronous — and the first version of this
     * helper waited for "no longer a raw key", which was already true of the Portuguese it was
     * replacing. It exited immediately, and the test then read the old language and blamed the
     * switch. It passed alone and failed in the full suite, which is what a race looks like.
     */
    const before = document.querySelector('#side-column .lesson-say')?.textContent ?? '';
    const select = document.getElementById('hud-locale') as HTMLSelectElement;
    select.value = code;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const deadline = Date.now() + 3000;
    while ((document.querySelector('#side-column .lesson-say')?.textContent ?? '') === before
      && Date.now() < deadline) {
      await new Promise((resolve) => { setTimeout(resolve, 10); });
    }
    await settle();
  };

  it('offers the three languages, named in their own words', () => {
    const select = document.getElementById('hud-locale') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent))
      .toEqual(['Português', 'English', 'Español']);
  });

  /*
   * ⚠️ SCOPED TO THE COLUMN. `beforeEach` builds its own panel for the driver tests and appends it
   * to the body, so a bare `.lesson-say` finds THAT one — empty — rather than the one the shell
   * opened. The first version of this test read the wrong element and reported the language switch
   * broken.
   */
  const inColumn = (selector: string): string =>
    document.querySelector(`#side-column ${selector}`)?.textContent ?? '';

  it('⚠️ translates the lesson being taken, without losing the step', async () => {
    expect(shell.teach()).toBe(true);
    const deadline = Date.now() + 3000;
    while (!document.getElementById('lesson-teacher') && Date.now() < deadline) {
      await new Promise((resolve) => { setTimeout(resolve, 10); });
    }
    /*
     * ⚠️ THE SHELL'S OWN MODE USES THE REAL 800 ms HOLD. Every other test here injects zero, so
     * `settle()` is enough for them; this one goes through `shell.teach()` and has to wait for the
     * answer to be shown before the step turns over. Polling for the step, not for a duration.
     */
    shell.activate(at('e4'));
    const stepDeadline = Date.now() + 3000;
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

  it('translates the board labels too, and keeps the cursor', async () => {
    shell.mirror.focusSquare(at('d4'));
    await chooseLanguage('es');
    expect(document.querySelector('[data-square="d4"]')!.getAttribute('aria-label'))
      .toContain('vacía');
    expect(shell.mirror.cursor()).toEqual(at('d4'));
  });

  it('remembers the choice, because a language that reset per view would be a bug', () => {
    const select = document.getElementById('hud-locale') as HTMLSelectElement;
    select.value = 'es';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(loadSettings().locale).toBe('es');
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
        <div id="stage">
          <div id="game-region" tabindex="0"></div>
          <div id="side-column"></div>
        </div>
      </div>
      <div id="sr-status" role="status" aria-live="polite"></div>
      <div id="sr-alert" role="alert" aria-live="assertive"></div>
      <svg id="cvd" aria-hidden="true"></svg>
    `;
    clear();
    localStorage.removeItem('incl_chess_learned');
    saveSettings({ mode: 'two' });

    const stranded = createGameShell({
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
    const deadline = Date.now() + 4000;
    while (!document.getElementById('lesson-teacher') && Date.now() < deadline) {
      await new Promise((resolve) => { setTimeout(resolve, 10); });
    }
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
  });
});
