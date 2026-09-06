// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The title screen exists because the opponent is a 6.98 MB download and a board that looks ready
// and will not answer is worse than a wait. So what these tests pin is the promise it makes: START
// is not there until there is something to play — AND it is always eventually there, because a
// splash with no button is a game that never starts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from '../app/js/i18n/index.ts';
import { createSplash } from '../app/js/ui/splash.ts';

function markup(): { region: HTMLElement; start: HTMLButtonElement; doors: HTMLElement } {
  document.body.innerHTML = `
    <div id="splash" role="dialog" aria-modal="true" aria-labelledby="splash-title">
      <h1 id="splash-title">WebChess</h1>
      <p id="splash-by">by prof. José Rocha</p>
      <p id="splash-status" role="status"></p>
      <p id="splash-doors" hidden><button id="splash-play" type="button">JOGAR</button><button id="splash-learn" type="button">APRENDER</button></p>
    </div>
    <div id="game-region" tabindex="0"></div>`;
  return {
    region: document.getElementById('game-region') as HTMLElement,
    start: document.getElementById('splash-play') as HTMLButtonElement,
    /*
     * ⚠️ THE WRAPPER CARRIES `hidden`, NOT THE BUTTON, since the title screen grew a second door.
     * PLAY and LEARN appear together or not at all — revealing one and not the other would offer
     * a choice with half of it missing.
     */
    doors: document.getElementById('splash-doors') as HTMLElement,
  };
}

afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); });

const settle = () => new Promise((resolve) => { setTimeout(resolve, 0); });

describe('[Splash] the way out appears only when it is real', () => {
  it('hides START, and the board, until the engine is ready', async () => {
    const { region, start, doors } = markup();
    let arrive: () => void = () => {};
    const ready = new Promise<void>((resolve) => { arrive = resolve; });

    createSplash({ doc: document, i18n: createI18n('pt'), ready, region });
    expect(doors.hidden).toBe(true);
    // ⚠️ A board that cannot be played must not be reachable by Tab either. Hiding it visually
    // and leaving it in the tab order is the classic half-done modal.
    expect(region.inert).toBe(true);

    arrive();
    await settle();
    expect(doors.hidden).toBe(false);
    expect(document.activeElement).toBe(start);
  });

  it('opens onto the game, with focus somewhere the arrow keys work', async () => {
    const { region, start } = markup();
    const splash = createSplash({
      doc: document, i18n: createI18n('pt'), ready: Promise.resolve(), region,
    });
    await settle();

    start.click();
    await splash.done;
    expect(document.getElementById('splash')).toBeNull();
    expect(region.inert).toBe(false);
    // Focus with nowhere to go falls to the body, where this game's keyboard does nothing: the
    // keys are listened for on the region, never on window.
    expect(document.activeElement).toBe(region);
  });

  it('still offers START when the engine fails, and says so', async () => {
    const { region, doors } = markup();
    createSplash({
      doc: document, i18n: createI18n('pt'), ready: Promise.reject(new Error('no wasm')), region,
    });
    await settle();

    expect(doors.hidden).toBe(false);
    // The board, the score sheet and every setting work perfectly well without an opponent.
    expect(document.getElementById('splash-status')?.textContent)
      .toBe(createI18n('pt').t('splash.failed'));
  });

  it('offers START anyway if the engine simply never answers', async () => {
    vi.useFakeTimers();
    const { region, doors } = markup();
    createSplash({
      doc: document, i18n: createI18n('pt'), ready: new Promise(() => {}), region,
    });
    expect(doors.hidden).toBe(true);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(doors.hidden).toBe(false);
  });

  it('does nothing at all on a page with no splash in it', () => {
    document.body.innerHTML = '<div id="game-region"></div>';
    const region = document.getElementById('game-region') as HTMLElement;
    const splash = createSplash({
      doc: document, i18n: createI18n('pt'), ready: Promise.resolve(), region,
    });
    expect(region.inert).toBe(false);
    // ⚠️ `play`, not nothing. A game with no title screen is a game already begun — answering
    // `learn` would open a lesson nobody asked for, on a page that may not even teach.
    return expect(splash.done).resolves.toBe('play');
  });
});
