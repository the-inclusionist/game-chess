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
      <div id="stage">
        <div id="game-region" tabindex="0"></div>
        <div id="side-column"></div>
      </div>
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
    shell.setTaught([{ square: at('e4'), mark: 'look' }]);
    expect(document.querySelector('[data-square="e4"]')!.getAttribute('data-lesson')).toBe('look');

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
    shell.setTaught([{ square: at('e4'), mark: 'look' }, { square: at('d5'), mark: 'look' }]);
    const cell = document.querySelector('[data-square="e4"]')!;
    expect(cell.getAttribute('data-lesson')).toBe('look');
    expect(cell.getAttribute('aria-label')).toContain('nesta casa');
    shell.setTaught([]);
    expect(cell.getAttribute('data-lesson')).toBeNull();
  });
});

describe('[Keyboard] the keys work from where the splash leaves you', () => {
  /*
   * ========================= ⚠️ THE BUG THIS PINS =========================
   * `ui/grid-mirror.ts` listens on its OWN root, so it only ever heard keys pressed while focus was
   * already inside the grid. The splash leaves focus on `#game-region` — the grid's PARENT — so
   * pressing START and then a direction key did nothing at all, every time, until a square happened
   * to be clicked first. Every key looked correctly mapped, and the mapping was never the problem.
   */
  const at = (name: string): Square => ({
    x: 'abcdefgh'.indexOf(name[0]!), y: 8 - Number(name[1]),
  });

  function shellFor() {
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    return createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      debugName: '__shellKeys', contrastTheme: 'contrast-flat',
    });
  }

  /** The engine's SOLO scheme, which is what a player has before remapping anything. */
  const press = (code: string, key = code): void => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true }),
    );
  };

  it('⚠️ moves the cursor with focus on the REGION, not only on a cell', () => {
    const shell = shellFor();
    document.getElementById('game-region')!.focus();
    expect(document.activeElement?.id).toBe('game-region');

    const start = shell.mirror.cursor();
    press('KeyD');
    expect(shell.mirror.cursor()).toEqual({ x: start.x + 1, y: start.y });
    press('KeyW');
    expect(shell.mirror.cursor()).toEqual({ x: start.x + 1, y: start.y - 1 });
  });

  it('confirms and cancels from there too', () => {
    const shell = shellFor();
    document.getElementById('game-region')!.focus();
    shell.mirror.focusSquare(at('e2'));
    document.getElementById('game-region')!.focus();

    press('KeyJ');
    expect(shell.game().selection()).toEqual(at('e2'));
    press('KeyK');
    expect(shell.game().selection()).toBeNull();
  });

  it('⚠️ does not take a key twice when focus IS inside the grid', () => {
    /*
     * The other half of the fix. The grid's own listener still runs first when focus is on a cell,
     * so the shell checks `defaultPrevented` before offering the key on — otherwise every press
     * would move two squares.
     */
    const shell = shellFor();
    shell.mirror.focusSquare(at('e2'));
    press('KeyD');
    expect(shell.mirror.cursor()).toEqual(at('f2'));
  });

  it('opens the pause on H and on Enter, which the engine scheme does not bind', () => {
    // Asked of the running page: `KeyU`, `KeyJ`, `KeyK` and `KeyI` all resolve through the engine,
    // and `KeyH` and `Enter` both come back null. So the pause key is named rather than resolved.
    const shell = shellFor();
    document.getElementById('game-region')!.focus();
    press('KeyH');
    expect(document.querySelector<HTMLElement>('.pause-menu')!.hidden).toBe(false);
    press('Escape', 'Escape');
    expect(document.querySelector<HTMLElement>('.pause-menu')!.hidden).toBe(true);

    document.getElementById('game-region')!.focus();
    press('Enter', 'Enter');
    expect(document.querySelector<HTMLElement>('.pause-menu')!.hidden).toBe(false);
    expect(shell.region).toBeTruthy();
  });
});

describe('[Panel keys] being IN the side panel is not the same as getting into it', () => {
  /*
   * ⚠️ THE BUG: `action4` moved focus into the panel, and the very next arrow key moved the
   * BOARD's cursor and left the reader stranded there. The forwarding rule asked "is focus outside
   * the grid?", which is true of the panel too — so getting in worked and being in did not.
   */
  const press = (code: string, key = code): void => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true }),
    );
  };

  function shellFor() {
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    return createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      debugName: '__shellPanel', contrastTheme: 'contrast-flat',
    });
  }

  it('⚠️ walks the panel with the arrows, and leaves the board alone', () => {
    const shell = shellFor();
    document.getElementById('game-region')!.focus();
    const cursor = shell.mirror.cursor();

    press('KeyI');
    const column = document.getElementById('side-column')!;
    expect(column.contains(document.activeElement)).toBe(true);
    const first = document.activeElement;

    press('KeyS');
    expect(column.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(first);
    // ⚠️ And the board did not move underneath them.
    expect(shell.mirror.cursor()).toEqual(cursor);
  });

  it('comes back to the board on action4, and the arrows drive it again', () => {
    const shell = shellFor();
    document.getElementById('game-region')!.focus();
    press('KeyI');
    press('KeyI');
    expect(document.getElementById('side-column')!.contains(document.activeElement)).toBe(false);

    const cursor = shell.mirror.cursor();
    press('KeyD');
    expect(shell.mirror.cursor()).toEqual({ x: cursor.x + 1, y: cursor.y });
  });

  it('stops at the ends rather than wrapping, like the board does', () => {
    shellFor();
    document.getElementById('game-region')!.focus();
    press('KeyI');
    const first = document.activeElement;
    press('KeyW');
    expect(document.activeElement).toBe(first);
  });
});

describe('[Opening] the name reaches the screen, not only the lookup', () => {
  /*
   * ========================= THE HALF NOBODY WAS CHECKING =========================
   * `openings.node.test.ts` is thorough about the BOOK: all 2,833 lines play from the opening
   * position, none carries a move number, the search runs deepest-first so a Najdorf is not
   * announced as a Sicilian. Every one of those assertions can hold while the name never appears
   * on screen, because none of them touches the shell or the HUD.
   *
   * That gap has bitten this repository before and in this exact shape: the lesson catalogue was
   * correct and complete, and the menu still listed `teach.notation.title` over and over, because
   * the titles were on the wrong side of a dynamic import. Logic right, delivery broken, and no
   * test in the suite could see it.
   *
   * ⚠️ AND THE BOOK IS FETCHED, so this waits rather than asserting immediately. 230 kB is not
   * carried by somebody who never plays a move — `refreshOpening` starts the download on the first
   * move and names the line when it lands.
   */
  const at = (name: string): Square => ({
    x: 'abcdefgh'.indexOf(name[0]!), y: 8 - Number(name[1]),
  });

  function shellFor() {
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    return createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      debugName: '__openingTest', contrastTheme: 'contrast-flat',
    });
  }

  const play = (shell: ReturnType<typeof shellFor>, from: string, to: string): void => {
    shell.activate(at(from));
    shell.activate(at(to));
  };

  const shown = (): string => document.querySelector('.hud-opening')?.textContent ?? '';

  it('says nothing before there is anything to say', () => {
    shellFor();
    expect(document.querySelector('.hud-opening')).not.toBeNull();
    expect((document.querySelector('.hud-opening') as HTMLElement).hidden).toBe(true);
  });

  it('⚠️ names the Ruy Lopez on the board that is in one', async () => {
    const shell = shellFor();
    // 1.e4 e5 2.Nf3 Nc6 3.Bb5 — hot seat, so both sides are played from the same board.
    play(shell, 'e2', 'e4');
    play(shell, 'e7', 'e5');
    play(shell, 'g1', 'f3');
    play(shell, 'b8', 'c6');
    play(shell, 'f1', 'b5');

    const deadline = Date.now() + 5000;
    while (!shown().includes('Ruy Lopez') && Date.now() < deadline) {
      await new Promise((resolve) => { setTimeout(resolve, 20); });
    }
    expect(shown()).toContain('Ruy Lopez');
    // The label around it is translated even though the name is not — the one thing
    // `openingLabelKey` exists to say.
    expect(shown()).toContain('Abertura');
    expect((document.querySelector('.hud-opening') as HTMLElement).hidden).toBe(false);
  });
});
