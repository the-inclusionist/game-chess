// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/lesson-panel — what a lesson looks like while it is being taken.
//
// ========================= WHY A BAR UNDER THE BOARD, AND NOT A DIALOG =========================
// `ui/blunder-bar.ts` made this argument first and it transfers whole: a modal would cover the
// board, and the board IS the lesson. Somebody being asked to find every square a bishop attacks
// has to be looking at the bishop. So this sits under the board, where the engine's thinking
// already appears, and the position stays in view.
//
// ========================= ⚠️ WHERE IT PARTS COMPANY WITH THE BLUNDER BAR =========================
// The bar is `role="alertdialog"` and takes focus, because it interrupts a game to ask a question
// the game is waiting on. A lesson is the opposite: the question is answered ON THE BOARD, so
// taking focus would move the reader away from the only place they can answer, once per step, for
// the length of a lesson. Every step.
//
// So this is a labelled region and nothing more:
//
//  · NO `role="alertdialog"`, no `aria-modal`, no focus trap.
//  · ⚠️ NO `aria-live` ON THE TEXT. The shell says each step through `srSay`, and a second live
//    region carrying the same sentence would announce it twice. The visible text and the spoken
//    text are the same words on purpose; only one of them is allowed to be an announcement.
//  · Focus moves exactly once: into the options of a `pick` step, because that is the one kind of
//    step whose answer is NOT on the board. It moves for the same reason it does not move
//    otherwise — to where the answer is.
//
// ========================= ⚠️ GETTING IT WRONG IS NOT AN EMERGENCY =========================
// Nothing here ever reaches `#sr-alert`. That channel is assertive and it belongs to check and to
// mate — a mode that trains a child to hear their own mistakes as an alarm has taught them
// something, and not the thing it meant to.
//
// ========================= WHY THE FRAME'S WORDS ARE IN THE MAIN CATALOGUE =========================
// `i18n/teach/` is lesson PROSE: seventy-three strings, per lesson, fetched only by somebody
// taking a lesson. The eight strings below are CHROME — they exist the moment this panel does, and
// they do not grow when a lesson is added. Putting them next door would also have cost the
// completeness test its teeth: it requires every key in a teaching catalogue to be asked for by
// `LESSONS`, which no frame string ever is.

import type { I18n } from '../i18n/index.ts';
import type { Step } from '../teach/lesson.ts';

export interface LessonPanelDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  /** An option was chosen. Only ever called for a `pick` step. */
  onChoose(option: number): void;
  /** The reader wants out. A mode with no visible way out is a trap; see `blunder-bar.ts`. */
  onLeave(): void;
}

/** Everything the panel draws, as one record. The panel holds no state of its own but the DOM. */
export interface LessonView {
  /** i18n key for the lesson's name. */
  readonly title: string;
  readonly step: Step;
  /** 1-based, for a person. */
  readonly at: number;
  readonly of: number;
  /** i18n key for a hint, said once after a wrong answer, or null. */
  readonly nudge?: string | null;
  /** How much of a `mark` set has been found, or null when the step is not one. */
  readonly found?: { readonly done: number; readonly of: number } | null;
  /** True once the last step has been answered. */
  readonly finished?: boolean;
}

export interface LessonPanel {
  readonly root: HTMLElement;
  /** Draws a step, or hides the panel when given null. */
  show(view: LessonView | null): void;
  /** Re-reads every string from the catalogue. For a change of language mid-lesson. */
  refresh(): void;
  destroy(): void;
}

export function createLessonPanel(deps: LessonPanelDeps): LessonPanel {
  const { doc, i18n } = deps;
  let current: LessonView | null = null;

  const root = doc.createElement('section');
  root.className = 'lesson-panel';
  root.hidden = true;

  const heading = doc.createElement('h2');
  heading.className = 'lesson-title';
  heading.id = 'lesson-title';
  // A labelled region rather than a dialog: a screen reader can jump to it, and nothing about it
  // demands to be dealt with before the board can be touched again.
  root.setAttribute('aria-labelledby', heading.id);

  const counter = doc.createElement('p');
  counter.className = 'lesson-counter';

  const say = doc.createElement('p');
  say.className = 'lesson-say';

  /*
   * ⚠️ THE NUDGE IS `role="status"` AND THE STEP TEXT IS NOT, which looks inconsistent and is the
   * point. The step text is announced by the shell through `srSay` the moment the step opens, so a
   * live region here would say it twice. A nudge appears LATER, in response to a wrong answer,
   * with no other channel carrying it — and polite is the right register for it, because being
   * wrong in a lesson is not an emergency.
   */
  const nudge = doc.createElement('p');
  nudge.className = 'lesson-nudge';
  nudge.setAttribute('role', 'status');
  nudge.hidden = true;

  const options = doc.createElement('div');
  options.className = 'lesson-options';
  options.hidden = true;

  const actions = doc.createElement('p');
  actions.className = 'lesson-actions';
  const leave = doc.createElement('button');
  leave.type = 'button';
  leave.className = 'lesson-leave';
  actions.append(leave);

  root.append(heading, counter, say, nudge, options, actions);

  const onLeave = (): void => deps.onLeave();
  leave.addEventListener('click', onLeave);

  /** The buttons of a `pick` step. Kept so their listeners can be removed. */
  let buttons: { el: HTMLButtonElement; handler: () => void }[] = [];
  /** The step those buttons were built for, so a redraw of the SAME step can leave them alone. */
  let drawnFor: Step | null = null;

  function clearOptions(): void {
    for (const { el, handler } of buttons) el.removeEventListener('click', handler);
    buttons = [];
    drawnFor = null;
    options.replaceChildren();
    options.hidden = true;
  }

  /**
   * ⚠️ REBUILT ONLY WHEN THE STEP CHANGES, and the first version of this rebuilt every time.
   *
   * A wrong answer redraws the step to show its nudge. Rebuilding the buttons then REMOVES THE ONE
   * HOLDING FOCUS, and the browser drops focus to `<body>` — so a keyboard reader who answered a
   * question was thrown out of the panel entirely, silently, as a reward for answering. Not
   * calling `.focus()` on a redraw does not help: not moving focus and not destroying it are
   * different promises, and only the second one was being kept.
   *
   * So a redraw of the same step updates the labels in place, which is also exactly what a change
   * of language needs.
   */
  function drawOptions(step: Step): boolean {
    if (step.task.kind !== 'pick') { clearOptions(); return false; }
    if (drawnFor === step && buttons.length === step.task.options.length) {
      for (const [index, option] of step.task.options.entries()) {
        buttons[index]!.el.textContent = i18n.t(option);
      }
      return buttons.length > 0;
    }
    clearOptions();
    drawnFor = step;
    for (const [index, option] of step.task.options.entries()) {
      const el = doc.createElement('button');
      el.type = 'button';
      el.className = 'lesson-option';
      /*
       * ⚠️ THROUGH `t()`, WHICH IS WHAT MAKES ONE RULE COVER BOTH KINDS OF OPTION. `t()` returns
       * the key itself when nobody has it — a documented contract, not an accident — so the
       * notation lesson's literal square names pass through untouched while `teach.values.one` is
       * translated. That is why `Task` needs no union type for its options, and why the typo it
       * would otherwise allow is closed by a test instead.
       */
      el.textContent = i18n.t(option);
      const handler = (): void => deps.onChoose(index);
      el.addEventListener('click', handler);
      buttons.push({ el, handler });
      options.append(el);
    }
    options.hidden = buttons.length === 0;
    return buttons.length > 0;
  }

  function draw(view: LessonView, moveFocus: boolean): void {
    heading.textContent = i18n.t(view.title);
    counter.textContent = view.finished
      ? i18n.t('lesson.finished')
      : i18n.t('lesson.step', { at: view.at, of: view.of });
    say.textContent = i18n.t(view.step.say);

    if (view.nudge) {
      nudge.textContent = i18n.t(view.nudge);
      nudge.hidden = false;
    } else {
      nudge.textContent = '';
      nudge.hidden = true;
    }

    /*
     * ⚠️ "THREE OF EIGHT" IS NOT DECORATION. A `mark` step with eight squares gives a child no way
     * of knowing whether a touch counted — the board lights up under a lot of things — and a
     * reader who cannot see the board has no way at all. `waiting` carries the two numbers for
     * exactly this, and this is the only place they are ever shown.
     */
    if (view.found) {
      counter.textContent += ` — ${i18n.t('lesson.found', {
        done: view.found.done, of: view.found.of,
      })}`;
    }

    const hasOptions = drawOptions(view.step);
    leave.textContent = i18n.t('lesson.leave');
    root.hidden = false;

    // The one focus move, and only when the step actually changed — a redraw prompted by a wrong
    // answer must not yank focus back to the first button the reader had just moved past.
    if (hasOptions && moveFocus) buttons[0]?.el.focus();
  }

  return {
    root,

    show(view) {
      if (!view) {
        current = null;
        clearOptions();
        root.hidden = true;
        return;
      }
      const changed = !current
        || current.title !== view.title
        || current.at !== view.at
        || current.step !== view.step;
      current = view;
      draw(view, changed);
    },

    refresh() {
      // A language change mid-lesson: every string is re-read and NOTHING moves. Focus is
      // wherever the reader left it, which after a language change is the language menu.
      if (current) draw(current, false);
    },

    destroy() {
      leave.removeEventListener('click', onLeave);
      clearOptions();
      root.remove();
    },
  };
}
