// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The title screen exists because the opponent is a 6.98 MB download and a board that looks ready
// and will not answer is worse than a wait. So what these tests pin is the promise it makes: START
// is not there until there is something to play — AND it is always eventually there, because a
// splash with no button is a game that never starts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from '../app/js/i18n/index.ts';
import { createSplash } from '../app/js/ui/splash.ts';

/*
 * ⚠️ THE REGION AND THE BOARD ARE TWO ELEMENTS HERE, AND THAT IS THE POINT OF THE FIXTURE. This
 * built one, called it the region, and handed it over for both jobs — which is exactly the shape the
 * page had, and exactly why the defect was invisible: with one element, «make it inert» and «focus
 * it» cannot disagree. On the page the panel is a sibling of the board, so making the board inert
 * left twenty-two controls reachable by Tab behind a title screen covering them.
 */
function markup(): {
  region: HTMLElement; board: HTMLElement;
  start: HTMLButtonElement; learn: HTMLButtonElement; doors: HTMLElement;
} {
  document.body.innerHTML = `
    <div id="splash" role="dialog" aria-modal="true" aria-labelledby="splash-title">
      <h1 id="splash-title">WebChess</h1>
      <p id="splash-by">by prof. José Rocha</p>
      <p id="splash-status" role="status"></p>
      <progress id="splash-progress" max="1" value="0"></progress>
      <p id="splash-doors" hidden><button id="splash-play" type="button">JOGAR</button><button id="splash-learn" type="button">APRENDER</button></p>
    </div>
    <div id="game-region">
      <div id="chess-board" tabindex="0"></div>
      <div id="side-column"><button id="panel-control" type="button">painel</button></div>
    </div>`;
  return {
    region: document.getElementById('game-region') as HTMLElement,
    board: document.getElementById('chess-board') as HTMLElement,
    start: document.getElementById('splash-play') as HTMLButtonElement,
    learn: document.getElementById('splash-learn') as HTMLButtonElement,
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
  it('⚠️ keeps BOTH doors shut, and disabled, until everything has arrived', async () => {
    /*
     * An earlier version split these — opening `APRENDER` before the engine, on the grounds that a
     * lesson runs as a hot seat and never consults one. That was wrong about what study IS:
     * Capablanca's exercises let the student play the position ON from where it is set, and a
     * board you can only answer one question on is not the book.
     *
     * ⚠️ HIDDEN AND DISABLED, BOTH, which is the half that survived from that attempt. `hidden` is
     * what the eye reads and `disabled` is what a click and a screen reader read; a button that is
     * only one of the two is a button that lies.
     */
    const { region, board, start, learn, doors } = markup();
    let arrive: () => void = () => {};
    const ready = new Promise<void>((resolve) => { arrive = resolve; });

    createSplash({ doc: document, i18n: createI18n('pt'), ready, region, board });
    expect(doors.hidden).toBe(true);
    expect(start.disabled).toBe(true);
    expect(learn.disabled).toBe(true);
    // ⚠️ A board that cannot be played must not be reachable by Tab either. Hiding it visually
    // and leaving it in the tab order is the classic half-done modal.
    expect(region.inert).toBe(true);

    arrive();
    await settle();
    expect(doors.hidden).toBe(false);
    expect(start.disabled).toBe(false);
    expect(learn.disabled).toBe(false);
    expect(document.activeElement).toBe(start);
  });

  it('⚠️ says how far the download has got, in words as well as in a bar', async () => {
    /*
     * Seven megabytes on a school connection is a long time to look at something that only says it
     * is busy — "busy" and "stuck" look identical, and the second is what a child concludes. The
     * percentage goes into the SAME live region the loading message uses, because a `<progress>`
     * announces its value only when a screen reader is asked to look.
     */
    const { region, board } = markup();
    const splash = createSplash({
      doc: document, i18n: createI18n('pt'), ready: new Promise(() => {}), region, board,
    });
    const bar = document.getElementById('splash-progress') as HTMLProgressElement;
    expect(bar.hidden).toBe(false);

    splash.setProgress(0.42);
    expect(bar.value).toBeCloseTo(0.42, 5);
    expect(document.getElementById('splash-status')!.textContent).toContain('42');

    // Clamped: a `content-length` that disagrees with what arrives must not drive it past the end.
    splash.setProgress(1.8);
    expect(bar.value).toBe(1);
  });

  it('puts the bar away once there is a way in', async () => {
    // A full bar left on screen reads as a thing still happening.
    const { region, board } = markup();
    let arrive: () => void = () => {};
    const ready = new Promise<void>((resolve) => { arrive = resolve; });
    createSplash({ doc: document, i18n: createI18n('pt'), ready, region, board });
    arrive();
    await settle();
    expect((document.getElementById('splash-progress') as HTMLProgressElement).hidden).toBe(true);
  });

  it('opens onto the game, with focus somewhere the arrow keys work', async () => {
    const { region, board, start } = markup();
    const splash = createSplash({
      doc: document, i18n: createI18n('pt'), ready: Promise.resolve(), region, board,
    });
    await settle();

    start.click();
    await splash.done;
    expect(document.getElementById('splash')).toBeNull();
    expect(region.inert).toBe(false);
    /*
     * Focus with nowhere to go falls to the body, where this game's keyboard does nothing: the keys
     * are listened for on the region, never on window.
     *
     * ⚠️ ON THE BOARD, NOT ON THE REGION, and the two stopped being the same element when the region
     * grew to hold the panel. The region would work — its own handler passes directions down — but
     * it would put the focus ring around the whole game and tell the player they are «in» something
     * the size of the screen. Inert covers everything; focus lands on the one square thing.
     */
    expect(document.activeElement).toBe(board);
  });

  it('⚠️ covers the PANEL too, not only the board', async () => {
    /*
     * Measured on the running page before this was true: with the title screen up, `#chess-board`
     * was inert and `#side-column` was not, so Tab reached 22 controls underneath it — the four
     * buttons of the accessibility bar first. `position: fixed` and `z-index: 100` hide a thing from
     * the eye; only `inert` hides it from the keyboard, and someone navigating by Tab was the one
     * person the title screen did not cover.
     *
     * It is asserted through the PANEL's own control rather than through `region.inert`, because the
     * property is what the code sets and reachability is what the child experiences — and the whole
     * defect was a true property on the wrong element.
     */
    const { region, board } = markup();
    createSplash({
      doc: document, i18n: createI18n('pt'), ready: new Promise(() => {}), region, board,
    });

    const control = document.getElementById('panel-control') as HTMLButtonElement;
    expect(control.closest('[inert]'), 'the panel is under the inert element').toBe(region);
    control.focus();
    expect(document.activeElement, 'and it cannot be focused').not.toBe(control);
  });

  it('still offers START when the engine fails, and says so', async () => {
    const { region, board, doors } = markup();
    createSplash({
      doc: document, i18n: createI18n('pt'), ready: Promise.reject(new Error('no wasm')), region, board,
    });
    await settle();

    expect(doors.hidden).toBe(false);
    // The board, the score sheet and every setting work perfectly well without an opponent.
    expect(document.getElementById('splash-status')?.textContent)
      .toBe(createI18n('pt').t('splash.failed'));
  });

  it('offers START anyway if the engine simply never answers', async () => {
    vi.useFakeTimers();
    const { region, board, doors } = markup();
    createSplash({
      doc: document, i18n: createI18n('pt'), ready: new Promise(() => {}), region, board,
    });
    expect(doors.hidden).toBe(true);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(doors.hidden).toBe(false);
  });

  it('does nothing at all on a page with no splash in it', () => {
    document.body.innerHTML = '<div id="game-region"><div id="chess-board"></div></div>';
    const region = document.getElementById('game-region') as HTMLElement;
    const board = document.getElementById('chess-board') as HTMLElement;
    const splash = createSplash({
      doc: document, i18n: createI18n('pt'), ready: Promise.resolve(), region, board,
    });
    expect(region.inert).toBe(false);
    // ⚠️ `play`, not nothing. A game with no title screen is a game already begun — answering
    // `learn` would open a lesson nobody asked for, on a page that may not even teach.
    return expect(splash.done).resolves.toBe('play');
  });
});
