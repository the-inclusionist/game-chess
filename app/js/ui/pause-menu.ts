// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/pause-menu — what START opens, in both modes.
//
// ========================= WHY LEAVING A LESSON LIVES HERE =========================
// It was a button in the lesson panel under the board, and it was wrong twice over: it took a
// tap-target's worth of a panel whose job is to carry ONE sentence a child is reading, and it put
// a way out inside the thing being read. Leaving is not part of the lesson. It belongs with the
// other things you do TO the game rather than IN it, which is what a pause menu is.
//
// ========================= ⚠️ THIS ONE REALLY IS A DIALOG =========================
// `ui/lesson-panel.ts` argues at length for NOT being a dialog, and the argument does not transfer:
// its question is answered on the board, so a modal would stand between the reader and the only
// place they can answer. A pause menu is the opposite — the board is suspended, everything to be
// done is in here, and there is exactly one way back out. So it takes focus, traps it, and returns
// focus to whatever opened it.
//
// The engine's own pause menu was declined at boot (`semMenuDePausa`), and this is why: the engine
// pauses a running simulation for a platformer. Chess has no clock to stop.

import type { I18n } from '../i18n/index.ts';

export interface PauseAction {
  /** i18n key. */
  readonly label: string;
  readonly run: () => void;
  /** A destructive or mode-leaving choice, drawn as the secondary one. */
  readonly leaving?: boolean;
}

export interface PauseMenuDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  /** What this menu offers right now. Re-read every time it opens: the modes differ. */
  actions(): readonly PauseAction[];
  /** Settings that live in the menu rather than in the side panel. Appended as-is. */
  readonly settings?: HTMLElement;
}

export interface PauseMenu {
  readonly root: HTMLElement;
  readonly open: boolean;
  show(): void;
  hide(): void;
  toggle(): void;
  refresh(): void;
  destroy(): void;
}

export function createPauseMenu(deps: PauseMenuDeps): PauseMenu {
  const { doc, i18n } = deps;
  /** Where focus was when this opened, so it can go back there. */
  let opener: HTMLElement | null = null;

  const root = doc.createElement('div');
  root.className = 'pause-menu';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.hidden = true;

  const box = doc.createElement('div');
  box.className = 'pause-box';
  const heading = doc.createElement('h2');
  heading.className = 'pause-title';
  heading.id = 'pause-title';
  root.setAttribute('aria-labelledby', heading.id);

  const list = doc.createElement('div');
  list.className = 'pause-actions';

  box.append(heading, list);
  if (deps.settings) box.appendChild(deps.settings);
  root.appendChild(box);

  let buttons: { el: HTMLButtonElement; handler: () => void }[] = [];

  function clear(): void {
    for (const { el, handler } of buttons) el.removeEventListener('click', handler);
    buttons = [];
    list.replaceChildren();
  }

  function refresh(): void {
    heading.textContent = i18n.t('pause.title');
    clear();
    for (const action of deps.actions()) {
      const el = doc.createElement('button');
      el.type = 'button';
      el.className = action.leaving ? 'pause-action pause-leaving' : 'pause-action';
      el.textContent = i18n.t(action.label);
      const handler = (): void => action.run();
      el.addEventListener('click', handler);
      buttons.push({ el, handler });
      list.appendChild(el);
    }
  }

  /**
   * ⚠️ A REAL FOCUS TRAP, because `aria-modal` is a CLAIM and not an implementation. Saying the
   * dialog is modal while Tab walks out of it into a board that is meant to be suspended is worse
   * than not saying it: a screen reader tells the reader they are in a dialog and then loses them.
   */
  function onKey(event: KeyboardEvent): void {
    if (root.hidden) return;
    if (event.key === 'Escape') { hide(); event.preventDefault(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
    )];
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = doc.activeElement;
    if (event.shiftKey && active === first) { last.focus(); event.preventDefault(); }
    else if (!event.shiftKey && active === last) { first.focus(); event.preventDefault(); }
  }
  doc.addEventListener('keydown', onKey, true);

  function show(): void {
    if (!root.hidden) return;
    opener = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    refresh();
    root.hidden = false;
    // The first action, which is always the one that simply goes back to the game: a reader who
    // presses Enter without looking has resumed, not left.
    buttons[0]?.el.focus();
  }

  function hide(): void {
    if (root.hidden) return;
    root.hidden = true;
    // ⚠️ Focus goes back where it came from. Dropping it lands the reader on `<body>`, which for a
    // keyboard user means starting the page again from the top.
    opener?.focus();
    opener = null;
  }

  return {
    root,
    get open() { return !root.hidden; },
    show,
    hide,
    toggle() { if (root.hidden) show(); else hide(); },
    refresh,
    destroy() {
      doc.removeEventListener('keydown', onKey, true);
      clear();
      root.remove();
    },
  };
}
