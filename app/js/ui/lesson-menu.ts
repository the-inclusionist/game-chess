// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/lesson-menu — the side panel while a lesson is being taken.
//
// ========================= WHY A SEPARATE PANEL AND NOT A MODE OF THE HUD =========================
// Almost nothing the HUD shows means anything in a lesson. Whose turn it is, the captured tally,
// the move list, the difficulty, the take-back pair — a lesson has one side, no captures worth
// counting, no opponent and no history to walk. A HUD that hid nine of its twelve controls would
// still be a HUD pretending, and every one of those controls would still be built, refreshed and
// kept in step for a mode that never shows them.
//
// ========================= ⚠️ A LIST, NOT A DROPDOWN, AND THE REASON IS THE SYLLABUS =========================
// A `<select>` shows one lesson at a time. That is fine for picking a board colour and wrong for a
// course: the thing a child wants to see is WHERE THEY ARE IN IT — what is done, what is next, how
// much is left. A list shows all three at once, and `aria-current` says which one is open in a way
// a screen reader repeats on every entry.
//
// The tick on a finished lesson is a CHARACTER IN THE TEXT rather than an icon or a colour, for the
// same reason it was in the dropdown: it has to survive being read aloud. WCAG 1.4.1.
//
// ========================= ⚠️ MEASURED, AND CURRENTLY TOO NARROW =========================
// This column inherits `.chess-hud`'s 27.5% of the board, which is 176 px against a 640-px region. With
// the lesson in it, the content measures 875 px tall in 357 px of height — the sentence alone
// takes 173 — so it scrolls, and a child reads a lesson through a slot.
//
// It scrolls rather than clipping, and the lesson is FIRST so the sentence is the part you do not
// have to scroll for. That is a floor, not a fix. The fix is the 2:1 stage: a board region that is
// only the board, with this column beside it rather than overlaid on it, which needs the camera
// offset that reserves the right 27.5% of the canvas to go to zero on the projected and solid
// pages. That is measured camera work with its own tests, and it is deliberately not being done
// halfway.

import type { I18n } from '../i18n/index.ts';

export interface MenuLesson {
  readonly id: string;
  /** i18n key. */
  readonly title: string;
  readonly done: boolean;
  readonly current: boolean;
}

export interface LessonMenuDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  /**
   * The lesson itself — the title, the step, the nudge, the choices.
   *
   * ⚠️ IT USED TO SIT UNDER THE BOARD and it moved up here, which also settled a geometry problem
   * it had created: a third panel below the board cost 157 px of height that the board needed to
   * scale at all. Two panels beside each other need no such room. The right-hand column now reads
   * top to bottom as the lesson and then the things you do to it.
   */
  readonly lesson?: HTMLElement;
  lessons(): readonly MenuLesson[];
  onPick(id: string): void;
  /** Where in the current lesson, 1-based, and how many steps it has. */
  place(): { readonly at: number; readonly of: number };
  onBack(): void;
  onForward(): void;
  canBack(): boolean;
  canForward(): boolean;
  teacher(): boolean;
  /** Whether the teacher may be switched on yet. See `TRIES_BEFORE_TEACHER`. */
  teacherReady(): boolean;
  onTeacher(on: boolean): void;
}

export interface LessonMenu {
  readonly root: HTMLElement;
  refresh(): void;
  destroy(): void;
}

export function createLessonMenu(deps: LessonMenuDeps): LessonMenu {
  const { doc, i18n } = deps;

  const root = doc.createElement('nav');
  root.className = 'hud lesson-menu';
  root.hidden = true;

  const heading = doc.createElement('h2');
  heading.className = 'lesson-menu-title';
  heading.id = 'lesson-menu-title';
  root.setAttribute('aria-labelledby', heading.id);

  /*
   * ⚠️ A REAL `<ul>` OF `<button>`s. A row of divs with click handlers would look identical and
   * would give a screen reader no list, no count, and nothing to say about position — "3 of 11" is
   * something the platform supplies for free here and would have to be rebuilt, wrongly, otherwise.
   */
  const list = doc.createElement('ul');
  list.className = 'lesson-list';

  const steps = doc.createElement('p');
  steps.className = 'lesson-menu-steps';

  const walk = doc.createElement('p');
  walk.className = 'lesson-walk';
  const back = doc.createElement('button');
  const forward = doc.createElement('button');
  for (const button of [back, forward]) button.type = 'button';
  walk.append(back, forward);

  /*
   * ⚠️ A CHECKBOX, NOT A BUTTON, because it is a STATE and not an act. The hint control it replaces
   * was a verb once and the verb was wrong for the same reason: help that has to be re-requested is
   * help people stop requesting. The platform supplies "checked"/"unchecked" to a screen reader,
   * which `aria-pressed` on a button only approximates.
   */
  const teacherBox = doc.createElement('p');
  teacherBox.className = 'lesson-teacher';
  const teacher = doc.createElement('input');
  teacher.type = 'checkbox';
  teacher.id = 'lesson-teacher';
  const teacherLabel = doc.createElement('label');
  teacherLabel.htmlFor = teacher.id;
  /*
   * ⚠️ THE REASON IT IS LOCKED HAS TO BE SAYABLE. A disabled control with no explanation is a
   * control that does nothing, and a reader who cannot see it greyed out is told only that it is
   * unavailable. `aria-describedby` carries the condition, and the same sentence is on screen.
   */
  const teacherWhy = doc.createElement('span');
  teacherWhy.className = 'lesson-teacher-why';
  teacherWhy.id = 'lesson-teacher-why';
  teacher.setAttribute('aria-describedby', teacherWhy.id);
  teacherBox.append(teacher, teacherLabel, teacherWhy);

  /*
   * ⚠️ THE LESSON FIRST, THE CONTROLS AFTER. Reading order is the order of importance here: the
   * sentence a child is answering comes before the machinery for moving between sentences, and a
   * screen reader walks the column in exactly this order.
   */
  if (deps.lesson) root.appendChild(deps.lesson);
  root.append(heading, steps, walk, teacherBox, list);

  const onBack = (): void => deps.onBack();
  const onForward = (): void => deps.onForward();
  const onTeacher = (): void => deps.onTeacher(teacher.checked);
  back.addEventListener('click', onBack);
  forward.addEventListener('click', onForward);
  teacher.addEventListener('change', onTeacher);

  /** One button per lesson, kept so their listeners can be removed. */
  let entries: { el: HTMLButtonElement; handler: () => void }[] = [];

  function clearList(): void {
    for (const { el, handler } of entries) el.removeEventListener('click', handler);
    entries = [];
    list.replaceChildren();
  }

  function refresh(): void {
    heading.textContent = i18n.t('hud.lessons');
    back.textContent = i18n.t('lesson.back');
    forward.textContent = i18n.t('lesson.forward');
    back.disabled = !deps.canBack();
    forward.disabled = !deps.canForward();

    const { at, of } = deps.place();
    steps.textContent = i18n.t('lesson.step', { at, of });

    const ready = deps.teacherReady();
    teacher.checked = deps.teacher();
    teacher.disabled = !ready;
    teacherLabel.textContent = i18n.t('lesson.teacher');
    teacherWhy.textContent = ready ? '' : i18n.t('lesson.teacherLocked');
    teacherWhy.hidden = ready;

    clearList();
    for (const lesson of deps.lessons()) {
      const item = doc.createElement('li');
      const el = doc.createElement('button');
      el.type = 'button';
      el.className = 'lesson-entry';
      el.textContent = lesson.done
        ? i18n.t('hud.lessonDone', { title: i18n.t(lesson.title) })
        : i18n.t(lesson.title);
      // The one being taken, said by the platform rather than by a colour.
      if (lesson.current) el.setAttribute('aria-current', 'step');
      const handler = (): void => deps.onPick(lesson.id);
      el.addEventListener('click', handler);
      entries.push({ el, handler });
      item.appendChild(el);
      list.appendChild(item);
    }
  }
  refresh();

  return {
    root,
    refresh,
    destroy() {
      back.removeEventListener('click', onBack);
      forward.removeEventListener('click', onForward);
      teacher.removeEventListener('change', onTeacher);
      clearList();
      root.remove();
    },
  };
}
