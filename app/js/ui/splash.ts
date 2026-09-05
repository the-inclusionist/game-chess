// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/splash — the title screen, and the one honest reason to have one.
//
// ========================= IT IS NOT DECORATION =========================
// A splash screen is usually a logo in the way of the thing you came for. This one exists because
// removing the negamax made the opponent a 6.98 MB WebAssembly download, and before it there was
// a board that looked entirely ready and simply would not answer. A game that is visibly finished
// and secretly not is worse than a wait: the player blames themselves, or the click, or the
// machine. So the wait is shown, and the way out of it only appears when it is real.
//
// ⚠️ START IS THE READINESS INDICATOR. There is no spinner pretending to know a percentage the
// worker never reports. The button is absent, then it is there — which is the only thing about
// the load this file actually knows to be true.
//
// ========================= WHAT IT DOES FOR A SCREEN READER =========================
// The status line is `role="status"`, so "loading the engine" and then "ready" are announced
// without stealing focus, and `#game-region` is `inert` until START — a board that cannot yet be
// played should not be reachable by Tab either. Focus moves to START when it appears and into the
// region when it is pressed, so the keyboard never lands somewhere that does nothing.

import type { I18n } from '../i18n/index.ts';

export interface SplashDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  /** Resolves when there is something to play. Rejecting is handled, not thrown. */
  readonly ready: Promise<unknown>;
  /** The element to make inert while the splash is up, and to focus once it is gone. */
  readonly region: HTMLElement;
  onStart?(): void;
}

export interface Splash {
  /** Resolves when the player presses START, or immediately if there was no splash to press. */
  readonly done: Promise<void>;
}

/**
 * How long to wait for the engine before offering START anyway.
 *
 * ⚠️ There IS a way out of a failed load. A splash with no button is a game that never starts,
 * and "the download failed" is a thing to be told rather than a thing to be trapped by — the
 * board, the score sheet and every setting work perfectly well without an opponent.
 */
const PATIENCE_MS = 30_000;

export function createSplash(deps: SplashDeps): Splash {
  const { doc, i18n, region } = deps;
  const root = doc.getElementById('splash');
  const start = doc.getElementById('splash-start');
  const status = doc.getElementById('splash-status');

  // The markup lives in the HTML so it paints before this bundle has even parsed — which is the
  // whole point of it. A page that had to boot in order to say "loading" would show the board
  // first, and the board is the lie being avoided.
  if (!root || !(start instanceof HTMLButtonElement) || !status) {
    return { done: Promise.resolve() };
  }

  root.setAttribute('aria-label', i18n.t('splash.title'));
  status.textContent = i18n.t('splash.loading');
  start.textContent = i18n.t('splash.start');
  region.inert = true;

  const done = new Promise<void>((resolve) => {
    const reveal = (message: string): void => {
      status.textContent = message;
      start.hidden = false;
      // Focus the way out as soon as there is one. Without this a keyboard player is left on
      // whatever the browser chose while the button did not exist.
      start.focus();
    };

    const timer = setTimeout(() => reveal(i18n.t('splash.slow')), PATIENCE_MS);
    void deps.ready
      .then(() => reveal(i18n.t('splash.ready')))
      .catch(() => reveal(i18n.t('splash.failed')))
      .finally(() => clearTimeout(timer));

    start.addEventListener('click', () => {
      region.inert = false;
      root.remove();
      // Into the game, not merely out of the splash: the element that just held focus is gone,
      // and focus with nowhere to go falls to the body, where the arrow keys do nothing.
      region.focus();
      deps.onStart?.();
      resolve();
    }, { once: true });
  });

  return { done };
}
