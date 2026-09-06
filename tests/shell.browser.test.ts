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
    expect(shell.game().canReplay()).toBe(true);
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

describe('[NewGame] a lesson changes the board without rebuilding anything around it', () => {
  const at = (name: string): Square => ({
    x: 'abcdefgh'.indexOf(name[0]!), y: 8 - Number(name[1]),
  });

  function shellFor() {
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    return createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      debugName: '__shellTest', contrastTheme: 'contrast-flat',
    });
  }

  it('puts the named position on the board', () => {
    const shell = shellFor();
    shell.newGame('k7/7p/8/3R4/8/8/8/7K w - - 0 1');
    expect(shell.rules().pieceAt(at('d5'))?.type).toBe('r');
    expect(shell.rules().pieceAt(at('e2'))).toBeNull();
  });

  it('⚠️ keeps the same mirror, so the focused cell survives the step', () => {
    /*
     * THE WHOLE REASON `rules` AND `state` BECAME ACCESSORS. Rebuilding the mirror on every step
     * that changes the position would throw away the focused cell and the roving tabindex, and
     * dump a keyboard reader at the top of the page once per step, for the length of a lesson.
     */
    const shell = shellFor();
    const before = shell.mirror.root;
    shell.mirror.focusSquare(at('d5'));
    const focused = document.activeElement;

    shell.newGame('k7/7p/8/3R4/8/8/8/7K w - - 0 1');

    expect(shell.mirror.root).toBe(before);
    expect(document.activeElement).toBe(focused);
    expect(shell.mirror.cursor()).toEqual(at('d5'));
  });

  it('⚠️ does NOT write the lesson board over the player\'s saved game', () => {
    /*
     * THE DEFECT THIS GUARD EXISTS FOR, and the one whose symptom appears far from its cause.
     * `syncPosition` saves the score sheet after everything that changes it. Without the guard,
     * opening a lesson overwrites the player's real game in `sessionStorage` with a board holding
     * two kings and a rook — and the loss is discovered only when they change VIEW, by which time
     * nothing on screen connects it to what caused it.
     */
    const shell = shellFor();
    shell.activate(at('e2')); shell.activate(at('e4'));

    const saved = sessionStorage.getItem('incl_chess_game');
    expect(saved).toContain('e2e4');

    shell.newGame('k7/7p/8/3R4/8/8/8/7K w - - 0 1', { teaching: true });
    shell.activate(at('d5')); shell.activate(at('d8'));

    expect(sessionStorage.getItem('incl_chess_game')).toBe(saved);
  });

  it('saves again once the lesson hands the board back', () => {
    // The guard must be a mode, not a one-way door: leaving a lesson has to restore the game the
    // player was in the middle of.
    const shell = shellFor();
    shell.newGame('k7/7p/8/3R4/8/8/8/7K w - - 0 1', { teaching: true });
    shell.newGame();
    shell.activate(at('e2')); shell.activate(at('e4'));
    expect(sessionStorage.getItem('incl_chess_game')).toContain('e2e4');
  });

  it('⚠️ is a hot seat, so nothing ever replies', () => {
    /*
     * With `opponent: false` the phase settles to `idle` after a move and no engine is consulted.
     * Were it `thinking`, every activation after the first would come back `ignored/busy` — a
     * lesson that has quietly stopped accepting answers — and the shell would be waiting on a
     * search nobody started.
     */
    const shell = shellFor();
    shell.newGame('k7/7p/8/3R4/8/8/8/7K w - - 0 1', { teaching: true });
    shell.activate(at('d5')); shell.activate(at('d8'));
    shell.game().animationDone();
    expect(shell.game().phase()).toBe('idle');
  });

  it('clears the lesson marks, because they named squares in a position that is gone', () => {
    const shell = shellFor();
    shell.setTaught([at('e4')]);
    expect(document.querySelector('[data-square="e4"]')!.getAttribute('data-lesson')).toBe('true');

    shell.newGame('k7/7p/8/3R4/8/8/8/7K w - - 0 1', { teaching: true });
    expect(document.querySelector('[data-square="e4"]')!.getAttribute('data-lesson')).toBeNull();
  });
});

describe('[Taught] the shell can point at squares', () => {
  const at = (name: string): Square => ({
    x: 'abcdefgh'.indexOf(name[0]!), y: 8 - Number(name[1]),
  });

  it('marks them on the board and names them in the label', () => {
    fixture();
    clear();
    const shell = createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      debugName: '__shellTest', contrastTheme: 'contrast-flat',
    });
    shell.setTaught([at('e4'), at('d5')]);
    const cell = document.querySelector('[data-square="e4"]')!;
    expect(cell.getAttribute('data-lesson')).toBe('true');
    expect(cell.getAttribute('aria-label')).toContain('nesta casa');
    shell.setTaught([]);
    expect(cell.getAttribute('data-lesson')).toBeNull();
  });
});
