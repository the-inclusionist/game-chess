// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/opening-note — the opening's name with the reason beside it, above the engine's thinking.
//
// ========================= WHERE IT SITS, AND WHY THERE =========================
// In `#below-board`, between the blunder bar and `ui/thinking` — the Dev's instruction of
// 2026-10-04 was "coloque acima de «Pensamento da engine»", and this is the only container that
// word means. The order inside that container is blunder bar, then this, then the thinking strip,
// which keeps the rule `game-shell` already wrote for the bar: a warning about the move just
// played outranks everything, and a running commentary about a search ranks below prose a player
// can read at leisure.
//
// ⚠️ NOT IN THE SIDE PANEL, where the opening NAME already lives (`hud-opening`). Two reasons, and
// the second is the one that matters: the panel scrolls, so a paragraph put there would be the
// thing a child has to scroll past to reach the buttons; and the panel is hidden outright while a
// lesson runs, which would make the explanation disappear exactly when somebody is learning.
//
// The name therefore appears twice on screen, and that is deliberate rather than an oversight. The
// panel's line is the LABEL — one line, always in the same place, the answer to "where am I". This
// is the EXPLANATION, and it has to carry its own heading or the paragraph beneath it is a
// paragraph about nothing.
//
// ========================= ⚠️ NOT A LIVE REGION, FOR THE SAME REASON AS `thinking` =========================
// `role=status` with `aria-live="off"`: readable on demand, silent by default. The opening name
// changes on almost every move for the first ten moves of a game — Sicilian, then Sicilian
// Defense: Open, then Sicilian Defense: Najdorf Variation — and announcing each refinement would
// talk over the move announcements, which are the ones a blind player is waiting for. `srSay`
// still speaks the move itself, as it always did.

import type { I18n } from '../i18n/index.ts';
import { openingNoteKey } from '../openings/notes.ts';

export interface OpeningNotePanel {
  readonly root: HTMLElement;
  /**
   * The opening the game is in now, exactly as the book names it, or null.
   *
   * Cheap enough to call on every move: it does one table walk and two text assignments, and
   * returns early when the name has not changed.
   */
  setOpening(name: string | null): void;
  /** Re-reads every string, after a language change. */
  refresh(): void;
}

export interface OpeningNoteDeps {
  readonly doc: Document;
  readonly i18n: I18n;
}

export function createOpeningNote(deps: OpeningNoteDeps): OpeningNotePanel {
  const { doc, i18n } = deps;

  const root = doc.createElement('section');
  root.className = 'opening-note';
  root.setAttribute('role', 'status');
  // ⚠️ Off, on purpose. See the note at the top of the file.
  root.setAttribute('aria-live', 'off');
  // Hidden until there IS an opening, which is from the first move onwards and never before.
  root.hidden = true;

  const title = doc.createElement('h2');
  /*
   * ========================= ⚠️ `sr-only`, ON THE DEV'S INSTRUCTION OF 2026-10-04 =========================
   * «Escreva apenas Abertura: <nome da abertura>. A descrição deixe como tooltip.» So the screen
   * shows one line and the explanation moves to the `title` of the heading, where a mouse finds it.
   *
   * 🔴 AND THE PARAGRAPH STAYS IN THE DOM RATHER THAN BEING DELETED, which is the whole difference
   * between doing this and doing it in this game. A `title` is reached by HOVERING: no keyboard, no
   * touch, no screen reader that is not also driving a pointer. Deleting the paragraph would have
   * taken the explanation away from precisely the children this repository exists for, in order to
   * give it to the ones with a mouse. `sr-only` keeps it in the accessibility tree, unseen and
   * still spoken, and costs no pixel at all.
   *
   * ⚠️ `aria-hidden` ON THE HEADING'S TOOLTIP IS NOT NEEDED, and must not be added: a `title` is an
   * accessible DESCRIPTION, so with the paragraph already in the tree a reader would hear the same
   * sentence twice. That is why the `title` goes on the `h2` and the prose stays in the `p` —
   * `role=status` reads its contents, and the heading's description is a separate thing a reader
   * only reaches on request.
   */
  const body = doc.createElement('p');
  body.className = 'opening-note-text sr-only';
  root.append(title, body);

  let name: string | null = null;

  function refresh(): void {
    if (name === null) {
      root.hidden = true;
      // ⚠️ CLEARED RATHER THAN LEFT BEHIND. `hidden` keeps it off the screen and out of the
      // accessibility tree, but a new game that reaches no named line would otherwise leave the
      // last game's paragraph sitting in the DOM for a text-extraction gate to find and believe.
      title.textContent = '';
      title.removeAttribute('title');
      body.textContent = '';
      return;
    }

    /*
     * ⚠️ THE KEY MAY NOT EXIST, AND THAT IS THE NORMAL CASE. 116 of the book's 148 families have
     * no note written. The whole panel hides rather than showing the heading alone, because the
     * side panel already carries the name: a heading with no paragraph under it would be the same
     * sentence printed twice, in a container whose only purpose is the paragraph.
     */
    const key = openingNoteKey(name);
    if (key === null) {
      root.hidden = true;
      title.textContent = '';
      title.removeAttribute('title');
      body.textContent = '';
      return;
    }

    const text = i18n.t(key);
    /*
     * ⚠️ AND THE PROSE MAY NOT HAVE LANDED YET. `loadOpeningNotes` is a dynamic import, so for a
     * moment after the first move `t()` returns the KEY — which is its documented contract and
     * useless on screen. A key is recognisable: it is the only value that equals the key we asked
     * with. Until the file arrives the panel stays hidden, and `game-shell` calls `refresh()` when
     * it lands.
     */
    if (text === key) {
      root.hidden = true;
      return;
    }

    title.textContent = i18n.t('hud.opening', { name });
    title.title = text;
    body.textContent = text;
    root.hidden = false;
  }

  return {
    root,
    setOpening(next) {
      // The name is re-derived on every move and is usually the same string as last time.
      if (next === name) return;
      name = next;
      refresh();
    },
    refresh,
  };
}
