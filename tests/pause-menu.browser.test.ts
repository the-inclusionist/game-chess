// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHAT FAILS INVISIBLY IN A DIALOG =========================
// Not the buttons. `aria-modal="true"` is a CLAIM, and the two ways of breaking it both look
// perfect on screen: Tab that walks out of the dialog into a board meant to be suspended, and focus
// that is dropped on close so a keyboard reader restarts the page from the top. A screen reader
// announces "dialog" for both, and then loses the person inside it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPauseMenu, type PauseMenu } from '../app/js/ui/pause-menu.ts';
import { createI18n } from '../app/js/i18n/index.ts';

let menu: PauseMenu | null = null;
afterEach(() => { menu?.destroy(); menu = null; document.body.replaceChildren(); });

function build(actions: { label: string; run: () => void; leaving?: boolean }[]) {
  menu = createPauseMenu({ doc: document, i18n: createI18n('pt'), actions: () => actions });
  document.body.appendChild(menu.root);
  return menu;
}

const press = (key: string, shift = false): void => {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true, cancelable: true }),
  );
};

describe('[Pause] it opens, it closes, and it says what it is', () => {
  it('starts hidden and is a labelled modal dialog when shown', () => {
    const m = build([{ label: 'pause.resume', run: () => {} }]);
    expect(m.root.hidden).toBe(true);
    m.show();
    expect(m.root.hidden).toBe(false);
    expect(m.root.getAttribute('role')).toBe('dialog');
    expect(m.root.getAttribute('aria-modal')).toBe('true');
    expect(m.root.getAttribute('aria-labelledby')).toBe('pause-title');
    expect(document.querySelector('.pause-title')!.textContent).toBe('Pausa');
  });

  it('toggles, and showing twice does not reopen', () => {
    const m = build([{ label: 'pause.resume', run: () => {} }]);
    m.toggle();
    expect(m.open).toBe(true);
    m.toggle();
    expect(m.open).toBe(false);
  });

  it('runs the action it is given', () => {
    const leave = vi.fn();
    const m = build([
      { label: 'pause.resume', run: () => m.hide() },
      { label: 'pause.leaveLesson', run: leave, leaving: true },
    ]);
    m.show();
    document.querySelectorAll<HTMLButtonElement>('.pause-action')[1]!.click();
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('re-reads its actions every time it opens, because the modes differ', () => {
    // The exit only exists while a lesson is running. A menu built once at boot would offer it
    // in a plain game, or never offer it at all.
    let inLesson = false;
    menu = createPauseMenu({
      doc: document,
      i18n: createI18n('pt'),
      actions: () => (inLesson
        ? [{ label: 'pause.resume', run: () => {} }, { label: 'pause.leaveLesson', run: () => {} }]
        : [{ label: 'pause.resume', run: () => {} }]),
    });
    document.body.appendChild(menu.root);

    menu.show();
    expect(document.querySelectorAll('.pause-action')).toHaveLength(1);
    menu.hide();
    inLesson = true;
    menu.show();
    expect(document.querySelectorAll('.pause-action')).toHaveLength(2);
  });
});

describe('[Pause] ⚠️ the focus promises `aria-modal` makes on its behalf', () => {
  it('focuses the FIRST action, which is always the harmless one', () => {
    // A reader who presses Enter without looking has resumed, not left the lesson.
    const m = build([
      { label: 'pause.resume', run: () => {} },
      { label: 'pause.leaveLesson', run: () => {}, leaving: true },
    ]);
    m.show();
    expect(document.activeElement).toBe(document.querySelector('.pause-action'));
  });

  it('⚠️ gives focus back to whatever opened it', () => {
    /*
     * Dropping focus on close lands the reader on `<body>`, which for somebody using a keyboard
     * means starting the page again from the top — and the board they were on is now several
     * dozen Tab presses away.
     */
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const m = build([{ label: 'pause.resume', run: () => {} }]);
    m.show();
    expect(document.activeElement).not.toBe(opener);
    m.hide();
    expect(document.activeElement).toBe(opener);
  });

  it('⚠️ keeps Tab inside itself, in both directions', () => {
    /*
     * THE CLAIM `aria-modal` MAKES AND CANNOT KEEP ON ITS OWN. Tab that walks out into a suspended
     * board is a reader told they are in a dialog and then quietly let out of it.
     */
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    const m = build([
      { label: 'pause.resume', run: () => {} },
      { label: 'pause.leaveLesson', run: () => {}, leaving: true },
    ]);
    m.show();
    const actions = [...document.querySelectorAll<HTMLButtonElement>('.pause-action')];

    // Forward off the end wraps to the first.
    actions[actions.length - 1]!.focus();
    press('Tab');
    expect(document.activeElement).toBe(actions[0]);

    // And backward off the front wraps to the last.
    actions[0]!.focus();
    press('Tab', true);
    expect(document.activeElement).toBe(actions[actions.length - 1]);
  });

  it('closes on Escape, and ignores keys while it is shut', () => {
    const m = build([{ label: 'pause.resume', run: () => {} }]);
    m.show();
    press('Escape');
    expect(m.open).toBe(false);
    // Shut, it must not eat the board's own keys.
    press('Escape');
    expect(m.open).toBe(false);
  });

  it('stops listening once destroyed', () => {
    // The handler is on the DOCUMENT, so a menu that outlived its game would swallow Escape for
    // whatever came next.
    const m = build([{ label: 'pause.resume', run: () => {} }]);
    m.show();
    m.destroy();
    menu = null;
    expect(() => press('Escape')).not.toThrow();
  });
});
