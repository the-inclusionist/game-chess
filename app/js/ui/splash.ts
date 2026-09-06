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
  /**
   * Resolves when EVERYTHING needed to run has arrived. Rejecting is handled, not thrown.
   *
   * ⚠️ BOTH DOORS WAIT FOR THIS, and an earlier version split them: `APRENDER` was opened before
   * the 7.3 MB engine on the grounds that a lesson runs as a hot seat and never consults one.
   * That was wrong about what a lesson IS. Capablanca's exercises let the student play the position
   * ON from where it is set — study is not a fixed script, and a board you can only answer one
   * question on is not the book. Seven megabytes is also very little to organise a whole loading
   * strategy around.
   *
   * So the wait is honest and shared, and what changed instead is that it is now VISIBLE: see
   * `setProgress` and `chess/engine/preload.ts`.
   */
  readonly ready: Promise<unknown>;
  /** The element to make inert while the splash is up, and to focus once it is gone. */
  readonly region: HTMLElement;
  onStart?(): void;
}

/**
 * Which door was taken.
 *
 * ⚠️ THE TITLE SCREEN IS WHERE THE TWO MODES DIVERGE, and that is why it answers with a value
 * rather than resolving empty. "START" asked a child to begin something without saying what it
 * was; offering PLAY and LEARN says there are two things here, and lets somebody who came to
 * learn arrive at a lesson instead of at a game they must then find their way out of.
 */
export type Door = 'play' | 'learn';

export interface Splash {
  /** Resolves with the door taken, or immediately with `play` if there was no splash. */
  readonly done: Promise<Door>;
  /**
   * How far the download has got, 0 to 1.
   *
   * ⚠️ A NUMBER RATHER THAN A SPINNER. Seven megabytes on a school connection is a long time to
   * look at something that only says it is busy — "busy" and "stuck" look identical, and the
   * second one is what a child concludes.
   */
  setProgress(fraction: number): void;
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
  const doors = doc.getElementById('splash-doors');
  const bar = doc.getElementById('splash-progress') as HTMLProgressElement | null;
  const play = doc.getElementById('splash-play');
  const learn = doc.getElementById('splash-learn');
  const status = doc.getElementById('splash-status');

  // The markup lives in the HTML so it paints before this bundle has even parsed — which is the
  // whole point of it. A page that had to boot in order to say "loading" would show the board
  // first, and the board is the lie being avoided.
  if (!root || !status || !doors
    || !(play instanceof HTMLButtonElement) || !(learn instanceof HTMLButtonElement)) {
    // ⚠️ `play` is the answer when there is no splash at all, because that is what a game with no
    // title screen is: already begun. Answering `learn` would open a lesson nobody asked for.
    return { done: Promise.resolve('play'), setProgress: () => {} };
  }

  // ========================= NOT ON THE WAY BETWEEN VIEWS =========================
  // ⚠️ Each view is its own page, so changing view is a navigation and a navigation runs this
  // again. But this screen is for loading the GAME, and a player who has already pressed START is
  // not loading anything — the engine is warm, the fonts are cached, and the position they were
  // just looking at is waiting behind the title. Being asked to start something you are in the
  // middle of is the kind of small nonsense that makes a program feel like it is not listening.
  //
  // Read AND cleared: the flag survives exactly one navigation, so a reload later in the session
  // — which really can be a cold start — gets the title screen it is for.
  let switching = false;
  try {
    switching = sessionStorage.getItem('incl_chess_switching') === '1';
    sessionStorage.removeItem('incl_chess_switching');
  } catch { /* private mode, or storage disabled: show the splash, which is the safe answer */ }

  if (switching) {
    root.remove();
    return { done: Promise.resolve('play'), setProgress: () => {} };
  }

  root.setAttribute('aria-label', i18n.t('splash.title'));
  status.textContent = i18n.t('splash.loading');
  play.textContent = i18n.t('splash.play');
  learn.textContent = i18n.t('splash.learn');
  region.inert = true;

  const done = new Promise<Door>((resolve) => {
    /*
     * ========================= ⚠️ EACH DOOR WAITS FOR WHAT IT NEEDS =========================
     * A button may only be pressable once the thing behind it has arrived — and the two doors need
     * different things. `APRENDER` needs the page; `JOGAR` needs the opponent, which is 6.98 MB.
     *
     * They used to appear together, when the ENGINE was ready, so a child who came to learn waited
     * for a chess engine no lesson consults. Learning is now offered the moment the page can draw a
     * board, and playing joins it when there is somebody to play.
     */
    const reveal = (message: string): void => {
      status.textContent = message;
      doors.hidden = false;
      play.disabled = false;
      learn.disabled = false;
      // The bar has nothing left to say once there is a way in, and a full bar left on screen
      // reads as a thing still happening.
      if (bar) bar.hidden = true;
      // Focus the way out as soon as there is one. Without this a keyboard player is left on
      // whatever the browser chose while the buttons did not exist.
      play.focus();
    };

    /*
     * ⚠️ HIDDEN AND DISABLED, BOTH. `hidden` is what the eye reads and `disabled` is what a click
     * and a screen reader read; one without the other is a button that lies. Nothing is pressable
     * until everything needed to run has arrived — including the opponent, because a study
     * position a student is allowed to play ON from needs one.
     */
    play.disabled = true;
    learn.disabled = true;

    const timer = setTimeout(() => reveal(i18n.t('splash.slow')), PATIENCE_MS);
    void deps.ready
      .then(() => reveal(i18n.t('splash.ready')))
      .catch(() => reveal(i18n.t('splash.failed')))
      .finally(() => clearTimeout(timer));

    const enter = (door: Door) => (): void => {
      region.inert = false;
      root.remove();
      // Into the game, not merely out of the splash: the element that just held focus is gone,
      // and focus with nowhere to go falls to the body, where the arrow keys do nothing.
      region.focus();
      deps.onStart?.();
      resolve(door);
    };
    play.addEventListener('click', enter('play'), { once: true });
    learn.addEventListener('click', enter('learn'), { once: true });
  });

  return {
    done,
    setProgress(fraction) {
      if (!bar) return;
      const clamped = Math.min(1, Math.max(0, fraction));
      bar.value = clamped;
      // ⚠️ SAID AS WELL AS DRAWN. A `<progress>` announces its value to a screen reader only when
      // asked; the percentage in the status line is what a reader hears without asking, and it is
      // the same live region the "loading" message was already using.
      status.textContent = i18n.t('splash.downloading', { percent: Math.round(clamped * 100) });
    },
  };
}
