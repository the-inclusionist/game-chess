// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHAT IS ACTUALLY AT RISK IN THIS PANEL =========================
// Not the drawing. What is at risk is the set of things it deliberately does NOT do — because
// every one of them is what the module it was modelled on DOES do, and each would be an easy,
// invisible regression written by somebody being consistent.
//
// The blunder bar is `role="alertdialog"`, takes focus, and interrupts. All three are right there
// and wrong here, and none of them fails visibly: a lesson that stole focus every step would look
// perfectly fine to whoever wrote it and would be unusable with a screen reader.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLessonPanel, type LessonPanel } from '../app/js/ui/lesson-panel.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { lessonById } from '../app/js/teach/lessons.ts';
import { loadTeach } from '../app/js/i18n/teach/index.ts';
import type { Lesson, Step } from '../app/js/teach/lesson.ts';

// ⚠️ FETCHED, BECAUSE THE PROSE IS NOT BUNDLED. The lesson catalogues are dynamic imports, so a
// panel handed a bare `I18n` shows raw keys — correctly, by the documented contract of `t()`, and
// uselessly to a child. The shell owes this load before it opens a lesson, and the last test in
// this file is what says so.
const TEACH = { pt: await loadTeach('pt'), en: await loadTeach('en'), es: await loadTeach('es') };

let panel: LessonPanel | null = null;
afterEach(() => { panel?.destroy(); panel = null; document.body.replaceChildren(); });

const lesson = (id: string): Lesson => {
  const found = lessonById(id);
  if (!found) throw new Error(`no lesson: ${id}`);
  return found;
};

function build(locale: 'pt' | 'en' | 'es' = 'pt', withProse = true) {
  const onChoose = vi.fn();
  const onLeave = vi.fn();
  const i18n = createI18n(locale);
  if (withProse) for (const code of ['pt', 'en', 'es'] as const) i18n.extend(code, TEACH[code]);
  panel = createLessonPanel({ doc: document, i18n, onChoose });
  document.body.appendChild(panel.root);
  return { panel, i18n, onChoose, onLeave };
}

/** A view for one step of a real lesson, so the fixtures cannot drift from the table. */
const viewOf = (id: string, at = 0): { title: string; step: Step; at: number; of: number } => {
  const l = lesson(id);
  return { title: l.title, step: l.steps[at]!, at: at + 1, of: l.steps.length };
};

const q = <T extends Element>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`no ${selector}`);
  return el;
};

describe('[Panel] it shows the step, and hides when there is none', () => {
  it('starts hidden and hides again when told nothing', () => {
    const { panel: p } = build();
    expect(p.root.hidden).toBe(true);
    p.show(viewOf('rook'));
    expect(p.root.hidden).toBe(false);
    p.show(null);
    expect(p.root.hidden).toBe(true);
  });

  it('names the lesson and counts the steps for a person, from one', () => {
    // 1-based, because "step 0 of 2" is a sentence for a programmer.
    const { panel: p } = build();
    p.show(viewOf('rook'));
    expect(q('.lesson-title').textContent).toBe('A torre');
    expect(q('.lesson-counter').textContent).toContain('Passo 1 de 2');
  });

  it('⚠️ shows how much of a mark set has been found', () => {
    /*
     * A `mark` step with eight squares gives a child no way of knowing whether a touch counted —
     * the board lights up under a lot of things — and a reader who cannot see the board has no way
     * at all. This is the only place the two numbers from a `waiting` reaction are ever shown.
     */
    const { panel: p } = build();
    p.show({ ...viewOf('king'), found: { done: 3, of: 8 } });
    expect(q('.lesson-counter').textContent).toContain('3 de 8 casas');
  });
});

describe('[Panel] ⚠️ what it refuses to do, which is the whole design', () => {
  it('is a labelled region and NOT a dialog', () => {
    /*
     * `blunder-bar.ts` is `role="alertdialog"` because it interrupts a game to ask a question the
     * game is waiting on. A lesson's question is answered ON THE BOARD, so a dialog here would put
     * a modal between the reader and the only place they can answer.
     */
    const { panel: p } = build();
    p.show(viewOf('rook'));
    expect(p.root.getAttribute('role')).toBeNull();
    expect(p.root.getAttribute('aria-modal')).toBeNull();
    expect(p.root.getAttribute('aria-labelledby')).toBe('lesson-title');
  });

  it('⚠️ does NOT take focus for a step answered on the board', () => {
    /*
     * THE ONE THAT WOULD BE WRITTEN WRONG BY SOMEBODY BEING CONSISTENT. The bar focuses its safest
     * button; copying that here moves the reader off the board once per step for the length of a
     * lesson, and it fails silently — the panel looks perfect to whoever is using a mouse.
     */
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    anchor.focus();

    const { panel: p } = build();
    p.show(viewOf('rook'));
    expect(document.activeElement).toBe(anchor);
  });

  it('⚠️ does not put the step text in a live region', () => {
    // The shell announces each step through `srSay`. A second live region carrying the same
    // sentence says it twice, which is worse than saying it nowhere: the reader stops trusting it.
    const { panel: p } = build();
    p.show(viewOf('rook'));
    const text = q('.lesson-say');
    expect(text.getAttribute('aria-live')).toBeNull();
    expect(text.getAttribute('role')).toBeNull();
  });

  it('⚠️ never touches the assertive channel', () => {
    // Being wrong in a lesson is not an emergency. `#sr-alert` belongs to check and to mate; a
    // mode that trained a child to hear their own mistakes as an alarm has taught them something,
    // and not the thing it meant to.
    const alert = document.createElement('div');
    alert.id = 'sr-alert';
    document.body.appendChild(alert);

    const { panel: p } = build();
    p.show({ ...viewOf('pawn'), nudge: 'teach.pawn.reach.nudge' });
    expect(alert.textContent).toBe('');
  });

  it('⚠️ carries NO way out, because the way out is not part of the lesson', () => {
    /*
     * There was a "leave the lesson" button here and removing it was a correction. It spent a whole
     * tap target on a panel whose entire job is to carry ONE sentence a child is reading, and it
     * put the exit inside the thing being read. Leaving is something done TO the game rather than
     * in it, so it lives in the pause menu that START opens — in both modes.
     */
    const { panel: p } = build();
    p.show(viewOf('rook'));
    expect(p.root.querySelector('.lesson-leave')).toBeNull();
    expect(p.root.querySelectorAll('button')).toHaveLength(0);
  });
});

describe('[Panel] a pick is the one step whose answer is not on the board', () => {
  it('draws a button per option and reports the index', () => {
    const { panel: p, onChoose } = build();
    p.show(viewOf('values'));
    const buttons = document.querySelectorAll<HTMLButtonElement>('.lesson-option');
    expect(buttons).toHaveLength(3);
    buttons[1]!.click();
    expect(onChoose).toHaveBeenCalledWith(1);
  });

  it('⚠️ DOES move focus here, and only here', () => {
    // The exception that proves the rule above: focus goes where the answer is. On a `pick` step
    // the answer is not on the board, so leaving focus there would strand a keyboard reader in
    // front of a question they cannot reach the answers to.
    const { panel: p } = build();
    p.show(viewOf('values'));
    expect(document.activeElement).toBe(document.querySelector('.lesson-option'));
  });

  it('⚠️ does not yank focus back when the same step is redrawn', () => {
    /*
     * A wrong answer redraws the step to show its nudge. Re-focusing the first button then would
     * throw a reader who had tabbed to the third option back to the first, mid-sentence, as a
     * reward for answering.
     */
    const { panel: p } = build();
    p.show(viewOf('values'));
    const buttons = document.querySelectorAll<HTMLButtonElement>('.lesson-option');
    buttons[2]!.focus();
    p.show({ ...viewOf('values'), nudge: 'teach.values.rook.nudge' });
    expect(document.activeElement).toBe(document.querySelectorAll('.lesson-option')[2]);
  });

  it('⚠️ translates an option that is a key and leaves one that is a square alone', () => {
    /*
     * The contract `teach/lesson.ts` leans on so that `Task` needs no union type: `t()` returns
     * the key when nobody has it, so `'f3'` passes through untouched while `'teach.values.one'` is
     * translated. One rule, and this is where it is visible.
     */
    const { panel: p } = build();
    p.show(viewOf('values'));
    expect(document.querySelector('.lesson-option')!.textContent).toBe('1 ponto');

    p.show(viewOf('notation', 2));
    const names = [...document.querySelectorAll('.lesson-option')].map((b) => b.textContent);
    expect(names).toEqual(['f3', 'c3', 'f6', 'h3']);
  });

  it('hides the options again for a step that has none', () => {
    const { panel: p } = build();
    p.show(viewOf('values'));
    expect(document.querySelectorAll('.lesson-option')).toHaveLength(3);
    p.show(viewOf('rook'));
    expect(document.querySelectorAll('.lesson-option')).toHaveLength(0);
    expect(q<HTMLElement>('.lesson-options').hidden).toBe(true);
  });
});

describe('[Panel] the nudge is a second voice, not an error', () => {
  it('appears only when there is one, and politely', () => {
    const { panel: p } = build();
    p.show(viewOf('pawn'));
    expect(q<HTMLElement>('.lesson-nudge').hidden).toBe(true);

    p.show({ ...viewOf('pawn'), nudge: 'teach.pawn.reach.nudge' });
    const el = q<HTMLElement>('.lesson-nudge');
    expect(el.hidden).toBe(false);
    // Polite, because a nudge appears LATER than the step text and has no other channel carrying
    // it — unlike the step text, which the shell has already said.
    expect(el.getAttribute('role')).toBe('status');
  });

  it('goes away again on the next step', () => {
    const { panel: p } = build();
    p.show({ ...viewOf('pawn'), nudge: 'teach.pawn.reach.nudge' });
    p.show(viewOf('pawn', 1));
    expect(q<HTMLElement>('.lesson-nudge').hidden).toBe(true);
    expect(q('.lesson-nudge').textContent).toBe('');
  });
});

describe('[Panel] a change of language mid-lesson', () => {
  it('re-reads every string without moving anything', () => {
    /*
     * ⚠️ AND WITHOUT MOVING FOCUS, which is the part that would be missed. After a language change
     * the reader is standing in the language menu; re-drawing the panel is not a reason to drag
     * them onto a chess board.
     */
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);

    const { panel: p, i18n } = build();
    p.show(viewOf('rook'));
    anchor.focus();

    i18n.setLocale('en');
    p.refresh();
    expect(q('.lesson-counter').textContent).toContain('Step 1 of 2');
    expect(q('.lesson-title').textContent).toBe('The rook');
    expect(document.activeElement).toBe(anchor);
  });

  it('says the lesson is finished rather than counting a step that is over', () => {
    const { panel: p } = build();
    p.show({ ...viewOf('rook', 1), finished: true });
    expect(q('.lesson-counter').textContent).toContain('Aula concluída');
  });

  it('⚠️ reads the frame AND the title without the prose, and only the step text goes raw', () => {
    /*
     * THE DEBT THIS PANEL HANDS TO THE SHELL, and it got smaller once the running page was looked
     * at. The prose is a dynamic import, so a panel opened before it lands shows raw keys for the
     * STEP — `t()` behaving exactly as documented, and useless to a child. The shell must
     * `loadTeach` before it opens a lesson, and `boot/lesson-mode.ts` does.
     *
     * The title is no longer part of that. It moved to the main catalogue because the HUD lists
     * eleven lesson names at BOOT, long before any prose is fetched — and with the titles next
     * door the menu read `teach.notation.title` eleven times over on the real page. No test caught
     * that; looking at it did.
     */
    const { panel: p } = build('pt', false);
    p.show(viewOf('rook'));
    expect(q('.lesson-title').textContent).toBe('A torre');
    expect(q('.lesson-counter').textContent).toContain('Passo 1 de 2');
    // The half that genuinely still needs the fetch.
    expect(q('.lesson-say').textContent).toBe('teach.rook.reach');
  });
});
