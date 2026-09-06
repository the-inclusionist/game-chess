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
   * Resolves when there is an OPPONENT to play. Rejecting is handled, not thrown.
   *
   * ⚠️ THIS GATES `JOGAR` AND NOTHING ELSE. It is the 6.98 MB engine download, and a lesson does
   * not use it: `chess/state.ts` runs a lesson as a hot seat, so nothing is ever asked to reply.
   * A child who came to learn was waiting for seven megabytes of a chess engine they would never
   * consult, on a school connection, in front of a screen that said "loading".
   */
  readonly ready: Promise<unknown>;
  /**
   * Resolves when the PAGE can run: fonts, and whatever else a board needs to be drawn.
   *
   * Absent means "as soon as the splash exists", which is what a page with no such wait should
   * say rather than borrowing the opponent's.
   */
  readonly canRun?: Promise<unknown>;
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
    return { done: Promise.resolve('play') };
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
    return { done: Promise.resolve('play') };
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
    let learnReady = false;
    let playReady = false;

    const show = (message: string): void => {
      status.textContent = message;
      const first = doors.hidden;
      doors.hidden = !(learnReady || playReady);
      play.disabled = !playReady;
      learn.disabled = !learnReady;
      // Focus the way out as soon as there IS one — and the first time only, so a reader who has
      // already reached for `APRENDER` is not pulled back when `JOGAR` becomes available.
      if (first && !doors.hidden) (playReady ? play : learn).focus();
    };

    // Hidden AND disabled until then: `hidden` is what the eye reads and `disabled` is what a
    // click and a screen reader read. One without the other is a button that lies.
    play.disabled = true;
    learn.disabled = true;

    void (deps.canRun ?? Promise.resolve())
      .then(() => { learnReady = true; show(i18n.t('splash.loadingOpponent')); })
      .catch(() => { /* the page itself failed; the opponent's own path still speaks below */ });

    const timer = setTimeout(() => {
      // ⚠️ THE WAY OUT OF A FAILED LOAD. A splash with no button is a game that never starts, and
      // "the opponent did not arrive" is a thing to be told rather than trapped by — the board,
      // the lessons and every setting work perfectly well without one.
      playReady = true;
      show(i18n.t('splash.slow'));
    }, PATIENCE_MS);
    void deps.ready
      .then(() => { playReady = true; show(i18n.t('splash.ready')); })
      .catch(() => { playReady = true; show(i18n.t('splash.failed')); })
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

  return { done };
}
