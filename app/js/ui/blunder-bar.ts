// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/blunder-bar — what protected mode looks like when it has something to say.
//
// ========================= WHY A BAR AND NOT A DIALOG =========================
// A modal dialog would be the obvious choice and the wrong one. It would cover the board, and the
// board is the argument: a player being told "that move gave the game away" needs to be looking at
// the position while they decide, not at a box that replaced it. So the bar sits under the board,
// where the engine's own thinking already appears, and the position stays in view.
//
// It is still a decision the game waits for — the opponent does not reply until it is answered —
// which is what `role="alertdialog"` and moving focus here are for. What it is NOT is a trap:
// both buttons move the game on, and turning the mode off dismisses it.
//
// ⚠️ THE SECOND BUTTON IS NOT A CANCEL. "Carry on anyway" plays the move as it stands, and it is
// offered as an equal because it has to be: a player who is told they made a mistake and given
// only one way forward has not been taught anything, they have been overruled. Some of them will
// want to see what happens. That is a legitimate thing to want, and often the lesson.

import type { I18n } from '../i18n/index.ts';

export interface BlunderBarDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  /** `true` takes the move back, `false` keeps it. Either way the game continues. */
  onAnswer(takeBack: boolean): void;
}

export interface BlunderBar {
  readonly root: HTMLElement;
  /** Shows the warning, or hides it when given null. Moves focus in when it appears. */
  show(what: { readonly mark: string; readonly lost: number } | null): void;
  refresh(): void;
  destroy(): void;
}

export function createBlunderBar(deps: BlunderBarDeps): BlunderBar {
  const { doc, i18n } = deps;

  const root = doc.createElement('div');
  root.className = 'blunder-bar';
  root.setAttribute('role', 'alertdialog');
  root.hidden = true;

  const message = doc.createElement('p');
  message.className = 'blunder-message';
  message.id = 'blunder-message';
  root.setAttribute('aria-describedby', message.id);

  const actions = doc.createElement('p');
  actions.className = 'blunder-actions';
  const back = doc.createElement('button');
  const carryOn = doc.createElement('button');
  for (const button of [back, carryOn]) button.type = 'button';
  actions.append(back, carryOn);
  root.append(message, actions);

  const onBack = (): void => deps.onAnswer(true);
  const onCarryOn = (): void => deps.onAnswer(false);
  back.addEventListener('click', onBack);
  carryOn.addEventListener('click', onCarryOn);

  function refresh(): void {
    back.textContent = i18n.t('protected.takeBack');
    carryOn.textContent = i18n.t('protected.continue');
  }
  refresh();

  return {
    root,
    refresh,
    show(what) {
      if (!what) { root.hidden = true; return; }
      message.textContent = i18n.t('protected.warn', {
        mark: what.mark,
        lost: String(Math.round(what.lost)),
      });
      refresh();
      root.hidden = false;
      // Focus the way out, and the SAFER way out first: take-back is the reversible choice, and
      // a player who presses Enter without reading has undone a move rather than committed one.
      back.focus();
    },
    destroy() {
      back.removeEventListener('click', onBack);
      carryOn.removeEventListener('click', onCarryOn);
      root.remove();
    },
  };
}
