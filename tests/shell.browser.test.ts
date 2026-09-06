// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE NET FOR THE TWO VIEWS STILL TO MOVE =========================
// `boot/game-shell.ts` drives all three boards through one seam — `BoardView` — and the hardest
// part of that seam is `travel`, which returns a promise the shell awaits. The flat board's is a
// Web Animation; the projected board's will bridge a frame loop to a promise; the solid board's
// resolves at once. Three implementations, one contract, and the two faults that contract can have
// are both invisible to `tsc`, to the build, and to a person looking at the screen:
//
//   · A promise that never resolves leaves `walking` true for the rest of the game, and the only
//     symptom is that take-back and replay quietly stop working. No error, no console.
//   · A resolver captured and cleared in the wrong order nulls the NEXT leg's resolver, and a
//     two-ply walk stops halfway with the board in a position nobody asked for.
//
// So the view here is a FAKE that records what it was asked to do and resolves immediately. It is
// the only way to assert the shell's own behaviour without a renderer, an engine, or a visible
// pane — and the pane is not visible under vitest, which is exactly when a real animation never
// settles.
import { afterEach, describe, expect, it } from 'vitest';
import { createGameShell } from '../app/js/boot/game-shell.ts';
import type { BoardView, ViewContext } from '../app/js/boot/view.ts';
import { clear, saveSettings } from '../app/js/chess/session.ts';
import { toAlgebraic, type Square } from '../app/js/chess/types.ts';

function fixture(): void {
  document.body.innerHTML = `
    <div id="stage-wrap" style="width: 640px; height: 360px">
      <div id="game-region" tabindex="0"></div>
    </div>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd" aria-hidden="true"></svg>
  `;
}

interface Recorded {
  readonly legs: string[];
  readonly hidden: string[][];
}

/** A view that draws nothing and remembers everything. */
function fakeView(record: Recorded) {
  return (ctx: ViewContext): BoardView => {
    ctx.region.appendChild(ctx.mirror.root);
    return {
      hudControls: { coordinates: () => false, onCoordinates: () => {} },
      applyTheme: () => {},
      drawPosition: (hidden) => { record.hidden.push(hidden.map(toAlgebraic)); },
      drawMarks: () => {},
      travel: (from: Square, to: Square) => {
        record.legs.push(`${toAlgebraic(from)}${toAlgebraic(to)}`);
        return Promise.resolve();
      },
      relayout: () => {},
      destroy: () => {},
    };
  };
}

const settle = (): Promise<void> => new Promise((r) => { setTimeout(r, 0); });

afterEach(() => {
  clear();
  saveSettings({});
  document.body.replaceChildren();
});

describe('[Shell] the walk travels every ply, and lets go of the board afterwards', () => {
  it('flies one leg per ply and comes back the way it went', async () => {
    // Hot seat: no engine, so a take-back is one ply and nothing answers.
    saveSettings({ mode: 'two' });
    fixture();
    const record: Recorded = { legs: [], hidden: [] };
    const shell = createGameShell({
      host: document, kind: '2d', view: fakeView(record), visibleMirror: true,
      debugName: '__shellTest', contrastTheme: 'contrast-flat',
    });

    const at = (name: string): Square => ({
      x: 'abcdefgh'.indexOf(name[0]), y: 8 - Number(name[1]),
    });
    shell.activate(at('e2')); shell.activate(at('e4')); await settle();
    shell.activate(at('d7')); shell.activate(at('d5')); await settle();
    expect(record.legs).toEqual(['e2e4', 'd7d5']);

    record.legs.length = 0;
    await shell.walkHistory('back');
    // ⚠️ REVERSED: a take-back flies the move from where it landed to where it began. Getting this
    // the right way round is the difference between a piece coming home and a piece leaving twice.
    expect(record.legs).toEqual(['d5d7']);

    record.legs.length = 0;
    await shell.walkHistory('forward');
    expect(record.legs).toEqual(['d7d5']);
  });

  it('lets go of the board even when a leg is refused', async () => {
    /*
     * ⚠️ THE FAULT THIS EXISTS TO CATCH, and its only symptom is two dead buttons. `walking` is
     * released in a `finally`; without it, a `travel` that rejects — a disposed scene, a cancelled
     * animation, a view torn down mid-walk — would leave the flag true for the rest of the game
     * and nothing on screen or in the console would say why.
     */
    saveSettings({ mode: 'two' });
    fixture();
    const record: Recorded = { legs: [], hidden: [] };
    const shell = createGameShell({
      host: document,
      kind: '2d',
      visibleMirror: true,
      debugName: '__shellTest', contrastTheme: 'contrast-flat',
      view: (ctx) => {
        const view = fakeView(record)(ctx);
        return { ...view, travel: () => Promise.reject(new Error('the scene went away')) };
      },
    });

    const at = (name: string): Square => ({
      x: 'abcdefgh'.indexOf(name[0]), y: 8 - Number(name[1]),
    });
    shell.activate(at('e2'));
    shell.activate(at('e4'));
    await settle();

    await shell.walkHistory('back').catch(() => { /* the rejection is the point */ });
    await settle();

    // The board is usable again: a second walk is accepted rather than refused by a stuck flag.
    await shell.walkHistory('back').catch(() => {});
    expect(shell.game.canReplay()).toBe(true);
  });

  it('withholds BOTH pieces when a capture is walked backwards', async () => {
    /*
     * ⚠️ `hidden` IS A LIST BECAUSE A TAKE-BACK RESTORES TWO PIECES AT ONCE — the mover coming home
     * and the piece it took. Both are on the board as far as the rules are concerned the moment the
     * ply is undone, so a view that withholds only the traveller draws the captured piece
     * underneath a piece that is still flying away from it.
     */
    saveSettings({ mode: 'two' });
    fixture();
    const record: Recorded = { legs: [], hidden: [] };
    const shell = createGameShell({
      host: document, kind: '2d', view: fakeView(record), visibleMirror: true,
      debugName: '__shellTest', contrastTheme: 'contrast-flat',
    });

    const at = (name: string): Square => ({
      x: 'abcdefgh'.indexOf(name[0]), y: 8 - Number(name[1]),
    });
    shell.activate(at('e2')); shell.activate(at('e4')); await settle();
    shell.activate(at('d7')); shell.activate(at('d5')); await settle();
    shell.activate(at('e4')); shell.activate(at('d5')); await settle();

    record.hidden.length = 0;
    await shell.walkHistory('back');
    // The first draw of the walk is the one that matters: the pawn coming home to e4, and the
    // black pawn reappearing on d5.
    expect(record.hidden[0]).toEqual(['e4', 'd5']);
    // And afterwards nothing is withheld, or a piece stays invisible for the rest of the game.
    expect(record.hidden[record.hidden.length - 1]).toEqual([]);
  });
});
