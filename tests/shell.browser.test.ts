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
/*
 * ⚠️ THE GAME'S STYLESHEET, AND IT IS LOAD-BEARING. The three HTML pages link it; a test that
 * builds its DOM by hand gets none of it, which made every 'is it hidden' assertion in this
 * suite a question about a PROPERTY rather than about the screen. See the [Chrome] describe.
 */
import '../app/css/board.css';
import { createGameShell } from '../app/js/boot/standalone.ts';
import type { BoardView, ViewContext } from '../app/js/boot/view.ts';
import { clear, saveSettings } from '../app/js/chess/session.ts';
import { toAlgebraic, type Square } from '../app/js/chess/types.ts';
import type { EngineMove } from '../app/js/chess/engine/client.ts';

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
    <svg id="cvd" class="sr-only" aria-hidden="true"></svg>
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

  it('opens the pause on H and on Enter, which the engine scheme DOES bind', () => {
    /*
     * ⚠️ THIS TEST'S NAME USED TO END "which the engine scheme does not bind", and it was accurate
     * when written: `KeyH` and `Enter` both resolved to null, so the shell named them by hand.
     * Asked again on engine 8.0.0 at `?debug=true`, both resolve to `start` — the engine's default
     * bindings carry `start: ['KeyH', 'Enter']`, the same two keys. The shell stopped spelling them
     * out, so what this now proves is that the RESOLVED path reaches the menu.
     */
    const shell = shellFor();
    document.getElementById('game-region')!.focus();
    press('KeyH');
    expect(document.querySelector<HTMLElement>('.chess-pause')!.hidden).toBe(false);
    press('Escape', 'Escape');
    expect(document.querySelector<HTMLElement>('.chess-pause')!.hidden).toBe(true);

    document.getElementById('game-region')!.focus();
    press('Enter', 'Enter');
    expect(document.querySelector<HTMLElement>('.chess-pause')!.hidden).toBe(false);
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

  it('⚠️ fills the lesson list in a two-player game, where there is no hint button', () => {
    /*
     * The other half of the same brace. `deps.lessons` and `deps.onHint` are independent — a hot
     * seat has a course and no engine — but the list was drawn inside the hint's `if`, so it
     * stayed empty on exactly the boards two people share.
     *
     * ⚠️ ASSERTED THROUGH THE OPTIONS RATHER THAN THE COUNT. The number is `LESSONS.length` and
     * writing it here would be the same copy-of-data this repository has now got wrong three
     * times; what matters is that the list is not EMPTY and that the names came through `t()`
     * rather than arriving as raw keys, which is the other way this has failed before.
     */
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      teaches: true,
      debugName: '__hudHotSeat', contrastTheme: 'contrast-flat',
    });

    const select = document.getElementById('hud-lesson') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    expect(document.getElementById('hud-hint')).toBeNull();     // no engine, no hint: the premise
    const names = [...select!.options].map((o) => o.textContent ?? '');
    expect(names.length).toBeGreaterThan(0);
    expect(names.some((n) => n.includes('.'))).toBe(false);     // no raw `teach.*.title` keys
    expect(names).toContain('Lendo o tabuleiro');
  });

  it('⚠️ names the Ruy Lopez on the board that is in one', async () => {
    const shell = shellFor();
    // 1.e4 e5 2.Nf3 Nc6 3.Bb5 — hot seat, so both sides are played from the same board.
    play(shell, 'e2', 'e4');
    play(shell, 'e7', 'e5');
    play(shell, 'g1', 'f3');
    play(shell, 'b8', 'c6');
    play(shell, 'f1', 'b5');

    const deadline = Date.now() + 10_000;
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

describe('[Camera keys] a modified arrow is not board navigation', () => {
  /*
   * ========================= THE HINT LINE MAKES A PROMISE =========================
   * Under the board it says "⇧ + WASD gira o tabuleiro". The turn is implemented in
   * `boot/view-zdog.ts` behind `onKey`, and the shell only offers the view a key that nothing
   * else wanted — so whether that promise is kept is a question about ROUTING, not about the
   * camera.
   *
   * ⚠️ `grid-mirror.handleKey` DOES NOT LOOK AT MODIFIERS. `Shift+ArrowLeft` resolves through the
   * engine to the `left` intent exactly as a bare arrow does, so the cursor moves and the shell
   * returns — and the camera code never runs. Held down together, one gesture was doing the other
   * one's job, and the hint under the board named a key that turns nothing.
   *
   * The fake view records the offer, which is the whole question: a real camera is not needed to
   * ask whether the key ever got there.
   */
  const press = (code: string, key: string, shift: boolean): void => {
    document.getElementById('game-region')!.dispatchEvent(new KeyboardEvent('keydown', {
      code, key, shiftKey: shift, bubbles: true, cancelable: true,
    }));
  };

  function shellWithKeys(seen: string[]) {
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    const view = (ctx: ViewContext): BoardView => {
      ctx.region.appendChild(ctx.mirror.root);
      return {
        hudControls: { coordinates: () => false, onCoordinates: () => {} },
        applyTheme: () => {},
        drawPosition: () => {},
        drawMarks: () => {},
        travel: () => Promise.resolve(),
        relayout: () => {},
        destroy: () => {},
        onKey: (event) => {
          if (!event.shiftKey) return false;
          seen.push(event.key);
          return true;
        },
      };
    };
    return createGameShell({
      host: document, kind: '2d', view, visibleMirror: true,
      debugName: '__cameraTest', contrastTheme: 'contrast-flat',
    });
  }

  it('⚠️ offers a shifted arrow to the view instead of moving the cursor', () => {
    const seen: string[] = [];
    const shell = shellWithKeys(seen);
    document.getElementById('game-region')!.focus();
    const before = shell.mirror.cursor();

    press('ArrowLeft', 'ArrowLeft', true);
    expect(seen).toEqual(['ArrowLeft']);
    // And the board did NOT move under it: one gesture, one job.
    expect(shell.mirror.cursor()).toEqual(before);
  });

  it('⚠️ offers shifted WASD too, because movement here is arrows OR WASD', () => {
    // The hint line names WASD, and the whole game binds both — a camera that answered only to
    // arrows would make that line wrong in the other direction.
    const seen: string[] = [];
    const shell = shellWithKeys(seen);
    document.getElementById('game-region')!.focus();
    const before = shell.mirror.cursor();

    press('KeyA', 'A', true);
    expect(seen).toEqual(['A']);
    expect(shell.mirror.cursor()).toEqual(before);
  });

  it('still moves the cursor on a BARE arrow, which is the thing not to break', () => {
    const seen: string[] = [];
    const shell = shellWithKeys(seen);
    document.getElementById('game-region')!.focus();
    const before = shell.mirror.cursor();

    press('ArrowRight', 'ArrowRight', false);
    expect(seen).toEqual([]);
    expect(shell.mirror.cursor()).toEqual({ x: before.x + 1, y: before.y });
  });
});

describe('[Pause] START opens the menu the settings were moved into', () => {
  /*
   * ========================= THE REQUIREMENT, ASSERTED WHERE IT LANDS =========================
   * "2D/2.5D/3D, Piece drawing, Board colours, colour vision, reduced motion, files and ranks ==>
   * devem ir para o menu de pausa, acessível nos dois modos via START." Seven things, and they
   * were moved rather than copied — the HUD still builds and refreshes them, and hands the
   * container over.
   *
   * ⚠️ THAT HAND-OVER IS THE SEAM NOTHING WAS CHECKING. `ui/hud.browser.test.ts` mounts
   * `hud.settings` itself and asks what is inside it; `ui/pause-menu.browser.test.ts` builds a
   * dialog with a fixture and asks about focus and Escape. Both pass with the shell never putting
   * one into the other — and the symptom would be a pause menu with nothing in it but the way out,
   * which is exactly what the old build looked like before the move.
   */
  const press = (code: string, key: string): void => {
    document.getElementById('stage')!.dispatchEvent(new KeyboardEvent('keydown', {
      code, key, bubbles: true, cancelable: true,
    }));
  };

  /*
   * ⚠️ THE PIECE SET AND THE OUTLINE ARE THE VIEW'S, NOT THE SHELL'S — `HudViewControls` is a
   * `Pick` of exactly those, and all three real views supply them. The shared `fakeView` supplies
   * only `coordinates`, so a shell built on it has no piece-drawing control at all and this test
   * read that absence as a missing setting. The premise was the fixture's, not the code's.
   */
  function shellFor(teaches: boolean) {
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    const view = (ctx: ViewContext): BoardView => {
      ctx.region.appendChild(ctx.mirror.root);
      return {
        hudControls: {
          coordinates: () => false,
          onCoordinates: () => {},
          pieceSets: () => [{ key: 'outline', label: 'Outline' }, { key: 'solid', label: 'Solid' }],
          pieceSet: () => 'outline',
          onPieceSet: () => {},
          outline: () => false,
          onOutline: () => {},
        },
        applyTheme: () => {},
        drawPosition: () => {},
        drawMarks: () => {},
        travel: () => Promise.resolve(),
        relayout: () => {},
        destroy: () => {},
      };
    };
    return createGameShell({
      host: document, kind: '2d', view, visibleMirror: true,
      teaches,
      debugName: '__pauseTest', contrastTheme: 'contrast-flat',
    });
  }

  /*
   * ⚠️ THIS GAME'S DIALOG BY NAME, NOT "the dialog on the page". Since engine 8.0.0 there are two:
   * `createGame` mounts the engine's own pause card — `role="dialog"`, inside `#game-region` — and
   * `#game-region` comes first in document order, so a bare `[role="dialog"]` answered with the
   * engine's card and every assertion below asked the wrong element about the right thing.
   */
  const dialog = (): HTMLElement | null => document.querySelector('.chess-pause');

  it('⚠️ carries every display setting the redesign moved there', () => {
    shellFor(false);
    document.getElementById('game-region')!.focus();
    press('KeyH', 'h');

    const open = dialog();
    expect(open).not.toBeNull();
    expect(open!.getAttribute('aria-modal')).toBe('true');

    // The six, by the ids they are actually built with. Named one at a time rather than counted,
    // so a failure says WHICH one went missing.
    //
    // ⚠️ SEVEN UNTIL 2026-09-11: the view switch was here and is not any more. It is asserted in its
    // new home instead, in the test right below — moving an assertion to follow a control is the only way a
    // move stays covered, and deleting this line without adding that one is how a control goes
    // missing twice.
    expect(open!.querySelector('#hud-set'), 'piece drawing').not.toBeNull();
    expect(open!.querySelector('#hud-theme'), 'board colours').not.toBeNull();
    expect(open!.querySelector('#hud-vision'), 'colour vision').not.toBeNull();
    expect(open!.querySelector('#hud-motion'), 'reduced motion').not.toBeNull();
    expect(open!.querySelector('#hud-outline'), 'piece outline').not.toBeNull();
    expect(open!.querySelector('#hud-coords'), 'files and ranks').not.toBeNull();
    expect(open!.querySelector('#hud-locale'), 'language').not.toBeNull();
  });

  it('⚠️ the three view buttons are in the PANEL, under the accessibility bar', () => {
    /*
     * ========================= THE CONTROL THAT WENT MISSING =========================
     * `32d5227` swept the view switch into the pause menu with the six set-once controls, on the
     * reasoning that all seven are chosen once and forgotten. The Dev's report of 2026-09-11 is
     * that the three buttons «sumiram» — and they had: from the side panel they were gone, and
     * behind a menu that opens on a key they were not found. Nothing was broken; they were filed
     * where nobody looks.
     *
     * ⚠️ AND A CONTROL THAT MOVES NEEDS ITS ASSERTION TO MOVE WITH IT. Deleting the line that held
     * it in the dialog without writing this one is how the same control goes missing twice, with a
     * green suite both times.
     */
    shellFor(false);
    const views = document.querySelector('.hud-views');
    expect(views, 'the switcher exists').not.toBeNull();

    const column = document.getElementById('side-column')!;
    expect(views!.parentElement, 'a child of the side column').toBe(column);
    expect(document.querySelector('.chess-pause')?.contains(views!), 'not in the pause menu')
      .toBe(false);

    // Under the bar, not over it: the order in the column is what "below the inclusion buttons" means.
    const bar = document.querySelector('.a11y-bar')!;
    const order = [...column.children];
    expect(order.indexOf(views!) > order.indexOf(bar), 'below the accessibility bar').toBe(true);

    // And a sibling of the panel rather than a child of it, so a lesson hiding the panel keeps it.
    expect(document.querySelector('.chess-hud')?.contains(views!), 'outside the panel').toBe(false);

    expect([...views!.querySelectorAll('.hud-view')].map((v) => v.textContent))
      .toEqual(['2D', '2,5D', '3D']);
  });

  it('⚠️ and they are IN the dialog, not merely somewhere on the page', () => {
    /*
     * The assertion above would pass if the settings sat in the HUD and the dialog happened to be
     * an ancestor of nothing at all — so this one asks the other way round, from the control up.
     * `contains` is what "moved, not copied" actually means.
     */
    shellFor(false);
    document.getElementById('game-region')!.focus();
    press('KeyH', 'h');
    const coords = document.getElementById('hud-coords')!;
    expect(dialog()!.contains(coords)).toBe(true);
  });

  it('⚠️ opens in a lesson too, which is the only way out of one', () => {
    // "Apertando START é que aparece o menu para sair das aulas." A pause menu that only worked
    // while playing would leave a child inside a lesson with no exit that is not the browser's.
    const shell = shellFor(true);
    expect(shell.teach()).toBe(true);
    document.getElementById('game-region')!.focus();
    press('KeyH', 'h');
    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector('#hud-coords')).not.toBeNull();
  });
});

describe('[Opponent] the reply lands on the board, which is the defect that survived', () => {
  /*
   * ========================= THE PLAN NAMED THIS EXACTLY =========================
   * "não há como testar o caminho do oponente sem baixar 6,98 MB de Stockfish, que é exatamente
   * por que o defeito 1 sobreviveu." Defect 1 was the solid board's opponent never moving: it
   * applied the reply with two `activate` calls, and `activate` answers every call made during the
   * `thinking` phase with `ignored/busy` — which is the entire point of that phase. The search ran,
   * found `e7e5`, scored it, and the move was dropped in silence.
   *
   * `makeOpponent` was added so this could be tested. One test used it, to prove that a LESSON
   * never blocks on an engine — a fake whose every method hangs for ever. The path it was actually
   * added for, a reply arriving and being played, was still not exercised by anything.
   *
   * ⚠️ AND IT CANNOT BE CAUGHT ANYWHERE ELSE. `state.ts` is right to refuse `activate` while
   * thinking; the view is right to draw what it is given. Only the seam between them is wrong, and
   * only from here does anybody look at it.
   */
  const at = (name: string): Square => ({
    x: 'abcdefgh'.indexOf(name[0]!), y: 8 - Number(name[1]),
  });

  /** An engine that answers with one named move, or refuses. */
  function engine(reply: { from: string; to: string } | null | 'reject') {
    return () => ({
      ready: () => Promise.resolve({ minElo: 1320, maxElo: 3190 }),
      requestMove: () => (reply === 'reject'
        ? Promise.reject(new Error('the worker died'))
        : Promise.resolve(reply === null ? null : {
          move: { from: at(reply.from), to: at(reply.to), promotion: null },
          // ⚠️ TYPED RATHER THAN CAST. The first version of this fake said `as never`, which hid
          // that it was answering with an `options` field this contract does not have and missing
          // the two it does. A cast on a fixture lets it drift from the interface it is standing
          // in for, and the test then proves something about a shape nothing else uses.
          score: 12, nodes: 1000, depth: 8, ties: [], lines: [],
        })),
      // Neither is asked for here, and both are typed rather than left as `Promise<unknown>`:
      // a fake that satisfies the interface is a fake the compiler keeps honest.
      requestHint: () => new Promise<EngineMove | null>(() => {}),
      requestReview: () => new Promise<EngineMove | null>(() => {}),
      setStrength: () => {},
      cancel: () => {},
      destroy: () => {},
    });
  }

  function shellFor(reply: { from: string; to: string } | null | 'reject', record: Recorded) {
    fixture();
    clear();
    // Player is White, so the engine has Black and is asked the moment White has moved.
    saveSettings({ mode: 'w' });
    return createGameShell({
      host: document, kind: '2d', view: fakeView(record), visibleMirror: true,
      makeOpponent: engine(reply),
      debugName: '__opponentTest', contrastTheme: 'contrast-flat',
    });
  }

  /** Waits for the reply to have reached the board. */
  const settled = async (test: () => boolean): Promise<void> => {
    const deadline = Date.now() + 10_000;
    while (!test() && Date.now() < deadline) {
      await new Promise((resolve) => { setTimeout(resolve, 10); });
    }
  };

  it('⚠️ plays the reply even though the phase refuses every activate', async () => {
    const record: Recorded = { legs: [], hidden: [] };
    const shell = shellFor({ from: 'e7', to: 'e5' }, record);

    shell.activate(at('e2'));
    shell.activate(at('e4'));
    await settled(() => shell.rules().history().length >= 2);

    expect(shell.rules().history().map((m) => m.san)).toEqual(['e4', 'e5']);
    // And the board is the reader's, not the engine's: the piece TRAVELLED rather than appearing.
    expect(record.legs).toContain('e7e5');
  });

  it('⚠️ announces it, because the reply is the move nobody was watching for', async () => {
    const record: Recorded = { legs: [], hidden: [] };
    const shell = shellFor({ from: 'b8', to: 'c6' }, record);

    shell.activate(at('e2'));
    shell.activate(at('e4'));
    await settled(() => shell.rules().history().length >= 2);

    // A sentence, not raw notation: `boot/narration.ts` exists because "Nc6" teaches nobody.
    const said = document.getElementById('sr-status')!.textContent ?? '';
    expect(said).not.toBe('');
    expect(said.toLowerCase()).toContain('c6');
  });

  it('⚠️ says so when the engine fails, rather than thinking for ever', async () => {
    /*
     * The other half of the same seam. Saying nothing would leave the game on "thinking" for good,
     * and a child waiting for a reply cannot tell that apart from a game that is broken — so the
     * failure is ASSERTIVE, which is one of the two places in this game that is allowed to be.
     */
    const record: Recorded = { legs: [], hidden: [] };
    const shell = shellFor('reject', record);

    shell.activate(at('e2'));
    shell.activate(at('e4'));
    await settled(() => (document.getElementById('sr-alert')!.textContent ?? '') !== '');

    expect(document.getElementById('sr-alert')!.textContent).not.toBe('');
    // And the board is left in a state the player can act from, rather than mid-thought.
    expect(shell.rules().history()).toHaveLength(1);
  });

  it('a reply of null leaves the position alone rather than guessing', async () => {
    // The engine says "no move" in a position it cannot search. Nothing should be played.
    const record: Recorded = { legs: [], hidden: [] };
    const shell = shellFor(null, record);

    shell.activate(at('e2'));
    shell.activate(at('e4'));
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    expect(shell.rules().history().map((m) => m.san)).toEqual(['e4']);
    expect(record.legs).not.toContain('e7e5');
  });
});

/** Waits until a lesson opened through the shell is actually running. */
async function untilLesson(): Promise<void> {
  const step = (): string => document.querySelector('#side-column .lesson-say')?.textContent ?? '';
  const deadline = Date.now() + 10_000;
  while (step() === '' && Date.now() < deadline) {
    await new Promise((resolve) => { setTimeout(resolve, 10); });
  }
  expect(step()).not.toBe('');
}


describe('[Chrome] what steps aside for a lesson actually leaves the screen', () => {
  /*
   * ========================= ⚠️ THE SUITE WAS BLIND TO THE SCREEN =========================
   * This whole file — and every other browser test — built its DOM by hand and never loaded
   * `app/css/board.css`, which is a `<link>` in the three HTML pages. So `hud.root.hidden` read
   * `true`, every assertion agreed, and the HUD sat on screen through every lesson: 360x720 of
   * controls, an engine evaluation and a difficulty selector, pushing the lesson panel below the
   * fold. `.chess-hud` sets `display: flex`, and a class beats the UA sheet's `[hidden] { display: none }`.
   *
   * The trap was known — `.chess-pause`, `.lesson-menu`, `.lesson-panel`, `.lesson-nudge`,
   * `.lesson-options`, `.lesson-teacher-why` and `.blunder-bar` all carry the guard, and the comment
   * beside the blunder bar spells out why. The one element the teaching mode actually hides did not.
   *
   * ⚠️ SO THE STYLESHEET IS IMPORTED HERE, and that is the point of this describe rather than an
   * incidental. `hidden` is a property; `display` is what a person sees. Only the second one is
   * worth asserting, and until this import there was no way to ask.
   */
  const press = (code: string, key: string): void => {
    document.getElementById('stage')!.dispatchEvent(new KeyboardEvent('keydown', {
      code, key, bubbles: true, cancelable: true,
    }));
  };

  function shellFor() {
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    return createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      teaches: true,
      debugName: '__chromeTest', contrastTheme: 'contrast-flat',
    });
  }

  const shown = (selector: string): string => {
    const el = document.querySelector(selector);
    return el ? getComputedStyle(el).display : 'absent';
  };

  it('⚠️ the stylesheet is actually loaded, or every assertion below is vacuous', () => {
    /*
     * A guard on the guards. If the import ever stops arriving — a bundler change, a moved file —
     * these tests would pass by measuring unstyled elements, which is exactly the failure they
     * exist to catch, one level up.
     */
    fixture();
    const probe = document.createElement('div');
    probe.className = 'chess-hud';
    document.body.appendChild(probe);
    expect(getComputedStyle(probe).display).toBe('flex');
    probe.remove();

    /*
     * ⚠️ AND THE ENGINE'S SHEET, WHICH `board.css` PULLS IN BY `@import`, BECAUSE ARRIVING IS NOT
     * THE SAME QUESTION. The game's own rules could load while the imported half did not resolve,
     * and then every assertion about the accessibility bar would be measuring bare buttons — the
     * same vacuity as above, one layer further in, and invisible for exactly the same reason.
     *
     * `.pi-btn` is sized from `--tap`, so a probe with no `--tap` in scope would measure the
     * engine's own `:root` fallback. The assertion is only that the rule EXISTS.
     */
    const icon = document.createElement('button');
    icon.className = 'pi-btn';
    document.body.appendChild(icon);
    expect(getComputedStyle(icon).borderRadius, "the engine's stylesheet").toBe('10px');
    icon.remove();
  });

  it('⚠️ the HUD, the player strips and the engine line all LEAVE during a lesson', async () => {
    const shell = shellFor();
    expect(shown('.chess-hud')).toBe('flex');

    expect(shell.teach()).toBe(true);
    await untilLesson();

    // Not `hidden === true`, which was true all along. What a person would see.
    expect(shown('.chess-hud'), 'the HUD').toBe('none');
    expect(shown('.board-players'), 'the player strips').toBe('none');
    expect(shown('.thinking'), 'the engine line').toBe('none');
    // And the thing that replaced them is there.
    expect(shown('.lesson-menu')).not.toBe('none');
  });

  it('⚠️ every switch keeps its label beside its box, in the HUD and in the pause menu', () => {
    /*
     * ========================= THE SAME MARKUP, TWO OUTCOMES =========================
     * Four switches are built identically in `ui/hud.ts` — reduced motion, the piece outline, the
     * board coordinates and protected mode. Three of them go into the container the pause menu
     * takes; the fourth stays in the HUD. Only the fourth came apart: box on one line, a full-width
     * label under it, looking like a control that had broken in half.
     *
     * ⚠️ `.hud label` IS `display: block` AND SCORES (0,1,1); `.hud-check` SCORED (0,1,0). The
     * override lost every time the label was inside the HUD, and won everywhere else purely because
     * nothing was competing there. Where an element happens to be mounted decided how it looked.
     *
     * Asserted by GEOMETRY rather than by computed display, because "on the same line" is what a
     * reader sees and `inline` is only one way to achieve it.
     */
    /*
     * ⚠️ AN ENGINE MODE, AND THAT IS THE POINT OF THE FIXTURE. Protected mode is the switch that
     * was broken, and `ui/hud.ts` only builds it when `deps.onProtected` exists — which the shell
     * withholds in a two-player game, correctly, because there is no engine to hold back.
     *
     * The first version of this test used a hot seat, so the broken control was never on the page:
     * reverting the CSS fix left it green. Found by making that exact change and watching nothing
     * happen. It is the third time this session a test has looked for something by a property the
     * failure does not disturb.
     */
    fixture();
    clear();
    saveSettings({ mode: 'w' });
    const shell = createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      teaches: true,
      makeOpponent: () => ({
        ready: () => new Promise<{ minElo: number; maxElo: number }>(() => {}),
        requestMove: () => new Promise<EngineMove | null>(() => {}),
        requestHint: () => new Promise<EngineMove | null>(() => {}),
        requestReview: () => new Promise<EngineMove | null>(() => {}),
        setStrength: () => {},
        cancel: () => {},
        destroy: () => {},
      }),
      debugName: '__checkTest', contrastTheme: 'contrast-flat',
    });
    // The settings live in the pause menu's slot, so they need mounting to have a layout at all.
    document.body.appendChild(shell.hud.settings);

    // The one that was broken has to be among them, or this proves nothing about it.
    expect(document.getElementById('hud-protected'), 'protected mode is on the page').not.toBeNull();

    const pairs = [...document.querySelectorAll('input[type="checkbox"]')]
      .map((input) => ({
        id: input.id,
        label: document.querySelector(`label[for="${input.id}"]`) as HTMLElement | null,
        input: input as HTMLElement,
      }))
      .filter((pair) => pair.label && pair.input.getBoundingClientRect().width > 0);

    /*
     * ⚠️ TWO, NOT FOUR, AND THE GUARD SAYS SO RATHER THAN ASSUMING. The outline switch belongs to
     * the VIEW (`HudViewControls`) and the shared fake does not offer one; another has no layout
     * until the pause menu is open. The guard exists so this can never silently become zero and
     * pass by checking nothing.
     */
    expect(pairs.length, 'switches found to check').toBeGreaterThanOrEqual(2);
    for (const pair of pairs) {
      const box = pair.input.getBoundingClientRect();
      const text = pair.label!.getBoundingClientRect();
      // Same line: their tops agree to within a line's slack, rather than one sitting under the
      // other. A stacked pair differs by the whole height of the box.
      expect(`${pair.id}: ${Math.abs(box.top - text.top) < 12}`).toBe(`${pair.id}: true`);
      // And the label is a word beside a box, not a full-width block.
      expect(`${pair.id} label narrower than the column: ${text.width < 300}`)
        .toBe(`${pair.id} label narrower than the column: true`);
    }
  });

  it('⚠️ the player strips sit ABOVE the board, not painted over it', () => {
    /*
     * Reported in those words: "o HUD está por cima do tabuleiro ao invés de acima". The row of
     * names and the evaluation were `top: 0` inside the board's own box, so they were painted over
     * the eighth rank — over the black pieces themselves on the solid board.
     *
     * ⚠️ AND THE ROW WAS INSET `right: 27.5%`, which is the dead HUD column for the third time: a
     * fraction reserving the right quarter of the BOARD for a panel that has been a sibling in
     * `#side-column` since the teaching mode landed. That is why the evaluation sat left of centre
     * and the black player's name landed mid-board instead of at its right edge.
     *
     * Two assertions, because the fault had two halves and either could come back alone.
     */
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      debugName: '__stripsTest', contrastTheme: 'contrast-flat',
    });

    /*
     * ⚠️ AGAINST THE BOARD, NOT THE REGION, and the difference is the whole later spec. The strips
     * used to live in the margin ABOVE `#game-region`, so comparing them to the region was the same
     * question. They are inside it now, at the top of the board's own nine units — because nothing
     * may be drawn outside the sixteen-by-nine stage — and the thing they must not cover is the
     * grid.
     */
    const strips = document.querySelector('.board-players') as HTMLElement | null;
    const board = (document.querySelector('.board-2d')
      ?? document.getElementById('game-region')) as HTMLElement;
    expect(strips, 'the player strips are on the page').not.toBeNull();

    const row = strips!.getBoundingClientRect();
    const box = board.getBoundingClientRect();
    expect(row.height, 'the strips have a size at all').toBeGreaterThan(0);

    // Above: the row ends at or before the board begins. A one-pixel tolerance, not a whole line.
    expect(`strips end above the board? ${row.bottom <= box.top + 1}`)
      .toBe('strips end above the board? true');

    /*
     * ⚠️ AND THE WIDTH IS THE PANEL'S, NOT THE GRID'S — two measurements against two different
     * things, on purpose. The strips sit at the top of the board's nine units and span them, so
     * the two names land on the panel's edges; the grid is a square centred inside what is left,
     * and is narrower. Comparing the row to the GRID would demand it shrink with the board, which
     * is neither what was asked for nor what looks right.
     */
    const panel = document.getElementById('game-region')!.getBoundingClientRect();
    expect(`width ${Math.round(row.width)} of ${Math.round(panel.width)}`)
      .toBe(`width ${Math.round(panel.width)} of ${Math.round(panel.width)}`);
  });

  it('⚠️ nothing visible is drawn outside the stage, the pause menu included', () => {
    /*
     * ========================= THE SPEC, AND IT NAMED THE EXCEPTION ITSELF =========================
     * "Nada pode ser desenhado fora desta resolução, especialmente menus como o de pausa." Three
     * things were: the player strips, the bar under the board, and the keyboard reference — all
     * three moved inside, and this is what stops a fourth appearing.
     *
     * ⚠️ EVERY VISIBLE ELEMENT, NOT A LIST OF THE ONES THAT WERE WRONG. A list is a copy of the
     * data and would have covered exactly the three already fixed; the rule is about the box.
     *
     * Screen-reader-only elements are exempt and stay exempt: `#sr-status` and `#sr-alert` are
     * one pixel in the corner by design, because a live region has to be IN the document to be
     * announced and must take no space to do it.
     *
     * ⚠️ AND THE FIXTURES WERE MISSING `class="sr-only"` ON `#cvd`, which the three real pages all
     * carry. This test reported the colour-vision filter host as a stray — correctly, given the
     * markup it was handed, and wrongly about the game. The fixtures say what the pages say now,
     * which is worth more than the exemption I nearly wrote instead.
     */
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    const shell = createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      teaches: true,
      debugName: '__boundsTest', contrastTheme: 'contrast-flat',
    });

    const stageEl = document.getElementById('stage')!;
    const stage = stageEl.getBoundingClientRect();

    /*
     * ⚠️ A RECT OUTSIDE THE STAGE IS NOT THE SAME AS SOMETHING DRAWN OUTSIDE IT, and the first
     * version of this conflated them. It reported 34 strays on the real page — the side panel's
     * score table and everything under it, which sit past the stage's foot because the panel holds
     * more than 360 px of content and SCROLLS. They are clipped, not painted.
     *
     * So an element counts only if nothing between it and the stage clips it away. `#stage` itself
     * is `overflow: hidden`, which makes the spec structural rather than a promise each child has
     * to keep — this walk is what proves no child is relying on that to hide a mistake.
     */
    const clipped = (el: Element): boolean => {
      const box = el.getBoundingClientRect();
      for (let p = el.parentElement; p && p !== stageEl.parentElement; p = p.parentElement) {
        const style = getComputedStyle(p);
        if (style.overflow === 'visible' && style.overflowY === 'visible') continue;
        const bounds = p.getBoundingClientRect();
        if (box.bottom <= bounds.top || box.top >= bounds.bottom
          || box.right <= bounds.left || box.left >= bounds.right) return true;
        if (box.bottom > bounds.bottom + 1 || box.top < bounds.top - 1
          || box.right > bounds.right + 1 || box.left < bounds.left - 1) return true;
      }
      return false;
    };

    const strays = (): string[] => [...document.querySelectorAll('body *')]
      .filter((el) => {
        if (el.closest('.sr-only') || el.classList.contains('sr-only')) return false;
        if (el.id === 'stage-wrap' || el.id === 'stage' || el.closest('#splash')) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        const out = r.left < stage.left - 1 || r.right > stage.right + 1
          || r.top < stage.top - 1 || r.bottom > stage.bottom + 1;
        return out && !clipped(el);
      })
      .map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`
        + `${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}`);

    expect(strays().join(', ')).toBe('');

    // And with the pause menu open, which the spec singled out by name.
    document.getElementById('stage')!.dispatchEvent(new KeyboardEvent('keydown', {
      code: 'KeyH', key: 'h', bubbles: true, cancelable: true,
    }));
    expect(document.querySelector('.chess-pause'), 'the pause menu opened').not.toBeNull();
    expect(strays().join(', ')).toBe('');
    expect(shell).toBeTruthy();
  });

  it('⚠️ the panel scrolls rather than losing what does not fit', () => {
    /*
     * ========================= THE DECISION, AND IT IS THE USER'S =========================
     * At the smallest stage the panel is 280x360 and holds about 464 px of controls. Asked what
     * should leave it at that size, the answer was: nothing — it keeps scrolling.
     *
     * ⚠️ WHICH MAKES "IT SCROLLS" A SPEC AND NOT A CONSEQUENCE, so it is asserted here. The
     * failure it guards against is not cosmetic: `overflow: hidden` on this box means the
     * difficulty select and the outline switch are on the page, focusable, announced by a screen
     * reader — and unreachable with a pointer. Losing a menu by playing twenty moves is the bug
     * this replaced, and it would come back silently, because nothing else measures it.
     *
     * The height is forced rather than waited for: whether the content overflows depends on which
     * rung of the ladder the test window lands on, and the property is about what happens WHEN it
     * does. 200 px is the same question the 360 px panel asks.
     */
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      teaches: true,
      debugName: '__scrollTest', contrastTheme: 'contrast-flat',
    });

    const hud = document.querySelector('.chess-hud') as HTMLElement;
    expect(hud, 'a panel to measure').not.toBeNull();
    expect(getComputedStyle(hud).overflowY).toMatch(/auto|scroll/);

    /*
     * ⚠️ `max-height` AND NOT `height`, AND THE CHANGE IS THE LESSON. This line set `height` until
     * the accessibility bar arrived and made the panel a FLEX ITEM of `#side-column` — after which
     * `flex: 1 1 auto` resolved the size and the height written here was ignored. The test did not
     * fail loudly: it measured 331 against 331, content fitting a box it had not actually shrunk,
     * and would have gone on passing while proving nothing. A `max-height` constrains a flex item.
     */
    hud.style.maxHeight = '200px';
    expect(hud.scrollHeight, 'content past the foot of the panel').toBeGreaterThan(hud.clientHeight);

    const controls = [...hud.querySelectorAll('button, select, input')] as HTMLElement[];
    const last = controls[controls.length - 1];
    expect(last, 'a last control').toBeDefined();

    hud.scrollTop = hud.scrollHeight;
    const box = hud.getBoundingClientRect();
    const reached = last.getBoundingClientRect();
    // At or above the foot, not exactly on it: the panel has padding, so scrolling to the end
    // leaves the last control a few pixels inside. What matters is that it is no longer below.
    const past = Math.round(reached.bottom - box.bottom);
    expect(`${past} px past the foot, inside? ${past <= 1}`).toBe(`${past} px past the foot, inside? true`);
  });

  it('⚠️ a tap target is 44 CSS pixels, whatever the game rasterises at', () => {
    /*
     * ========================= THE PROMISE THAT WAS BROKEN BY ARITHMETIC =========================
     * `ui/layout.ts` says it in those words, and WCAG 2.5.5 asks for 44x44. It was computed as
     * `boardWidth / 320`, which gave 2 for as long as the board's raster WAS the interface — 640
     * CSS pixels wide. Making the raster square dropped it to 360, so the same line produced 1.125
     * and every control came out 25 pixels tall.
     *
     * ⚠️ NOTHING NOTICED, BECAUSE NOTHING MEASURED A RENDERED CONTROL. The arithmetic reads as
     * correct, `--tap` was still "computed from the base", and the number it produced was never
     * compared against the promise. This is that comparison.
     */
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      teaches: true,
      debugName: '__tapTest', contrastTheme: 'contrast-flat',
    });

    const stage = document.getElementById('stage')!;
    const board = Math.round(document.getElementById('game-region')!.getBoundingClientRect().width);
    const tap = Number.parseFloat(getComputedStyle(stage).getPropertyValue('--tap'));

    /*
     * ⚠️ GRADUATED, NOT A SINGLE NUMBER, and the levels are why. WCAG 2.2 gives 24x24 at AA
     * (2.5.8 Minimum) and 44x44 at AAA (2.5.5 Enhanced); this game takes AA at the smallest board
     * and AAA once there is room to spend on it. A 44 px floor everywhere is what made the HUD
     * scroll inside a 280x360 panel.
     */
    const wanted = board >= 720 ? 44 : board >= 540 ? 34 : 24;
    expect(`board ${board}: --tap ${tap}`).toBe(`board ${board}: --tap ${wanted}`);

    // And the controls that use it actually come out that tall — the variable is only a promise
    // until something is sized from it.
    const buttons = [...document.querySelectorAll('.chess-hud button')]
      .map((b) => Math.round(b.getBoundingClientRect().height))
      .filter((h) => h > 0);
    expect(buttons.length, 'controls to measure').toBeGreaterThan(0);
    for (const height of buttons) {
      expect(`a control is ${height}px, at least ${wanted}? ${height >= wanted}`)
        .toBe(`a control is ${height}px, at least ${wanted}? true`);
    }
  });

  it('⚠️ and all three come back when the lesson is left', async () => {
    // They were hidden rather than destroyed, so the move list keeps its scroll and whatever
    // control had focus keeps it. That only pays if they actually return.
    const shell = shellFor();
    expect(shell.teach()).toBe(true);
    await untilLesson();
    expect(shown('.chess-hud')).toBe('none');

    press('KeyH', 'h');
    const quit = [...document.querySelectorAll('.chess-pause button')]
      .find((b) => /sair/i.test(b.textContent ?? ''));
    expect(quit, 'a way out of the lesson').toBeDefined();
    (quit as HTMLButtonElement).click();
    await new Promise((resolve) => { setTimeout(resolve, 50); });

    expect(shown('.chess-hud'), 'the HUD came back').toBe('flex');
    expect(shown('.board-players'), 'the strips came back').not.toBe('none');
    expect(shown('.thinking'), 'the engine line came back').not.toBe('none');
  });
});

describe('[Weight] the engine downloads nothing this game declined', () => {
  /*
   * ========================= A DEFAULT THAT CONTRADICTS A DECLARATION =========================
   * `createGame` ends its boot with `if (o.baixarPesados !== false) void baixarPesados(...)`, and
   * the catalogue behind it is the neural voices plus a vision bundle — the engine's own comment
   * speaks of "faltam 241 MB". This game passes `declines.semVozNeural: true`, so from the moment
   * it moved to 8.0.0 it was declining the voice and fetching the voice in the same breath.
   *
   * ⚠️ NOTHING COULD HAVE TOLD US. The promise is discarded into an empty `catch` on purpose, so
   * the cost is invisible on a fast connection and merely slow on the one that matters — a school's.
   * A test is the only witness there is.
   */
  it('⚠️ fetches none of the heavy catalogue at boot', async () => {
    /*
     * ⚠️ THE VACUITY GUARD FIRST, because this assertion has a way of passing for the wrong reason:
     * `baixarPesados` bails out early when there is no Cache Storage or no `fetch`, reporting
     * 'sem Cache Storage ou sem fetch'. In a browser without either, "nothing was fetched" would be
     * true with the option removed as well, and the test would defend nothing.
     */
    expect(typeof caches, 'Cache Storage, or the assertion below is vacuous').not.toBe('undefined');
    expect(typeof fetch, 'fetch, or the assertion below is vacuous').toBe('function');

    const asked: string[] = [];
    const real = window.fetch;
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      asked.push(String(input instanceof Request ? input.url : input));
      return real.call(window, input as RequestInfo, init);
    }) as typeof fetch;

    try {
      fixture();
      clear();
      saveSettings({ mode: 'two' });
      createGameShell({
        host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
        debugName: '__weightTest', contrastTheme: 'contrast-flat',
      });
      // The download is the last thing the engine's boot starts, and it is not awaited by anyone.
      await new Promise((resolve) => { setTimeout(resolve, 50); });
    } finally {
      window.fetch = real;
    }

    /*
     * The hosts of the catalogue, named rather than counted: this game does fetch things at boot —
     * the opening book is 230 kB — so "no request at all" would be the wrong assertion and would
     * break the first time something legitimate was added.
     */
    const heavy = asked.filter((url) => /jsdelivr|huggingface|webgazer|storage\.googleapis/.test(url));
    expect(heavy.join(', ')).toBe('');
  });
});

describe('[Engine pause] the engine mounts a card, and this game says only where', () => {
  /*
   * ========================= WHERE, NOT WHETHER =========================
   * ADR-0122 removed the decline: from 8.0.0 `createGame` mounts its own `.screen-pause` card and
   * the game declares only `host.pauseHost`. Absent one it falls back to `#game-region` — which in
   * this game is not "the game" but the BOARD, nine of the stage's sixteen units.
   */
  it('⚠️ puts the engine card in the stage, never inside the board', () => {
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      debugName: '__engPauseTest', contrastTheme: 'contrast-flat',
    });

    const card = document.getElementById('vp-pause-0');
    // If this ever goes missing the engine stopped mounting it, and the two assertions below would
    // pass by vacuity — `contains(null)` is false for both boxes.
    expect(card, 'the engine mounted its pause card').not.toBeNull();
    expect(document.getElementById('game-region')!.contains(card), 'inside the board').toBe(false);
    expect(document.getElementById('stage')!.contains(card), 'inside the stage').toBe(true);
  });

  it('⚠️ and this game never opens it — the pause key is its own menu', () => {
    /*
     * The Dev's instruction, 2026-09-11: the engine pauses at the moments it is itself programmed
     * to, not at ours. So `H` opens `.chess-pause` and leaves the engine's card exactly as it was.
     * Written as a test because the wiring that would break it is wiring that does not exist —
     * an absence is only a decision while something says so.
     */
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      debugName: '__engPauseKey', contrastTheme: 'contrast-flat',
    });

    const card = document.getElementById('vp-pause-0') as HTMLElement;
    expect(card.hidden, 'the card is born hidden').toBe(true);

    document.getElementById('game-region')!.focus();
    document.getElementById('game-region')!.dispatchEvent(new KeyboardEvent('keydown', {
      code: 'KeyH', key: 'h', bubbles: true, cancelable: true,
    }));

    expect(document.querySelector<HTMLElement>('.chess-pause')!.hidden, 'ours opened').toBe(false);
    expect(card.hidden, 'theirs did not').toBe(true);
  });
});

describe('[A11y bar] the control a child needs before they can read the screen', () => {
  /*
   * ========================= THE HOLE THIS FILLS, NAMED =========================
   * Searched before it was built: this game exposes NO control for blind mode, NONE for TTS, and
   * the word Libras appears nowhere in `app/`. The sonar is reachable only by knowing the `L` key.
   * Everything it does offer is behind the pause menu, which is behind knowing START opens one.
   *
   * The engine has mounted that bar for every game since 8.0.0 and was reporting this one as
   * missing it. These tests are what stop it going missing again.
   */
  const mount = (name: string): void => {
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      teaches: true,
      debugName: name, contrastTheme: 'contrast-flat',
    });
  };

  it('⚠️ the engine actually wrote buttons into it', () => {
    mount('__barTest');
    const bar = document.querySelector('.a11y-bar');
    expect(bar, 'the host exists').not.toBeNull();
    const icons = [...bar!.querySelectorAll('button')];
    /*
     * A count, not a list of ids: WHICH icons appear is the engine's to decide — it mounts only the
     * ones that act, so `contrast` and `cvd` are absent here by design (they need setters
     * `createGame` does not accept, and this game already offers both in its pause menu). What this
     * game is responsible for is that the bar was given somewhere to be.
     */
    expect(icons.length, 'icons mounted').toBeGreaterThan(0);
    expect(icons.every((b) => b.getAttribute('aria-label')), 'every icon is named').toBeTruthy();
  });

  it('⚠️ it is a SIBLING of the panel, so a lesson cannot take it away', () => {
    /*
     * The teaching mode hides `.chess-hud`. An accessibility control that disappears during a
     * lesson is worse than useless — it is gone exactly when a child is being asked to concentrate.
     * Structure rather than behaviour: hiding an element cannot hide its sibling, so this holds
     * without depending on the order the lesson does things in.
     */
    mount('__barSibling');
    const bar = document.querySelector('.a11y-bar')!;
    const panel = document.querySelector('.chess-hud')!;
    expect(panel.contains(bar), 'inside the panel').toBe(false);
    expect(bar.parentElement?.id, 'in the side column').toBe('side-column');
    expect(document.getElementById('stage')!.contains(bar), 'inside the stage').toBe(true);
  });

  it('⚠️ its icons are as big as every other control in this game', () => {
    // `--tap` is graduated by board size — 24 at the floor, 44 where there is room — and the bar is
    // sized from it by the engine's own stylesheet. A control that a child cannot hit is not a
    // control, and these are the ones that matter most.
    mount('__barTap');
    const tap = Number.parseFloat(getComputedStyle(document.getElementById('stage')!).getPropertyValue('--tap'));
    expect(tap, 'a tap size to measure against').toBeGreaterThan(0);
    const icons = [...document.querySelectorAll('.a11y-bar button')] as HTMLElement[];
    for (const icon of icons) {
      const box = icon.getBoundingClientRect();
      expect(`${Math.round(box.width)}x${Math.round(box.height)} >= ${tap}? `
        + `${box.width >= tap - 0.5 && box.height >= tap - 0.5}`)
        .toBe(`${Math.round(box.width)}x${Math.round(box.height)} >= ${tap}? true`);
    }
  });
});

describe('[Menu nav] the engine never takes the board keys', () => {
  it('⚠️ arrows still reach the cursor with the engine card revealed', () => {
    /*
     * ========================= A TEST FOR A DAY THAT HAS NOT COME =========================
     * `isNavigable` defaults to YES, and the engine's `menu-nav` listens on the WINDOW in the
     * capture phase: with a yes, it consumes any key carrying menu intent — arrows, Enter, Space,
     * Escape — as soon as it finds a card of its own open. Every one of those keys is the board's
     * here, so this game answers NO.
     *
     * ⚠️ IT CHANGES NOTHING TODAY, which is exactly why the test has to force the condition. The
     * only card the engine could find is the one this game never reveals, so an honest assertion
     * has to reveal it by hand — otherwise the test passes with the answer either way and defends
     * nothing at all. Revealed, a YES would move the engine's selection instead of the cursor.
     */
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    const shell = createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      debugName: '__navTest', contrastTheme: 'contrast-flat',
    });

    const card = document.getElementById('vp-pause-0') as HTMLElement;
    expect(card, "the engine's card, to reveal").not.toBeNull();
    card.hidden = false;

    document.getElementById('game-region')!.focus();
    const before = shell.mirror.cursor();
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {
      code: 'ArrowRight', key: 'ArrowRight', bubbles: true, cancelable: true,
    }));
    const after = shell.mirror.cursor();

    expect(`${before.x},${before.y} -> ${after.x},${after.y}`)
      .not.toBe(`${before.x},${before.y} -> ${before.x},${before.y}`);
    card.hidden = true;
  });
});

describe('[Sonar] the key a player who cannot see the board depends on', () => {
  it('⚠️ KeyL reaches the sonar through the engine, not through a literal', () => {
    /*
     * ========================= THE PATH THAT HAD NO TEST AT ALL =========================
     * The sonar answered `event.code === 'KeyL'` for as long as no engine action carried it. It is
     * on a canonical slot now — `declaration.mapeamentoDoTeclado` binds `SONAR_ACTION` to `KeyL`
     * for seat 0 — which is what makes it remappable, and also what makes it able to die quietly:
     * if that mapping ever fails to land, `actionOf` answers null, the branch never runs, and the
     * only symptom is a key that stopped working for the player least able to report why.
     *
     * The assertion is that the event was CONSUMED, which is reachable without the engine handle
     * and is not accidental: with the mapping gone the branch does not fire, nothing else claims
     * `KeyL`, and the fake view has no `onKey` — so the event would come back unconsumed.
     */
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      debugName: '__sonarTest', contrastTheme: 'contrast-flat',
    });

    const region = document.getElementById('game-region')!;
    region.focus();
    const event = new KeyboardEvent('keydown', {
      code: 'KeyL', key: 'l', bubbles: true, cancelable: true,
    });
    region.dispatchEvent(event);

    expect(event.defaultPrevented, 'the sonar key was answered').toBe(true);
  });
});

describe('[Switch] the board changes renderer without leaving the page', () => {
  it('⚠️ swaps the view, and the panel follows it', async () => {
    /*
     * ========================= WHY THIS IS NOT A NAVIGATION =========================
     * Each view was its own HTML entry, and changing view meant loading a page. That is right while
     * a page IS the game and wrong for a cartridge: inside a platform a second entry is a second
     * URL, not a second bundle (ADR-0139 records this decision for this game by name).
     *
     * ⚠️ AND THE ASSERTION THAT MATTERS IS THE SECOND ONE. Swapping the renderer is the easy half;
     * the half that breaks quietly is everything that CAPTURED the old one. The piece-drawing list
     * is the case in point — the panel used to hold the array it was built with, so after a swap the
     * select would offer the previous renderer's drawings and choosing one would do nothing. Not an
     * error: a dead control.
     */
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    const shell = createGameShell({
      host: document, kind: '2.5d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      debugName: '__switchTest', contrastTheme: 'contrast-flat',
    });

    const before = shell.view();
    const optionsOf = (): string => [...document.querySelectorAll<HTMLOptionElement>('#hud-set option')]
      .map((o) => o.value).join(',');
    /*
     * ⚠️ THE FAKE OFFERS NO DRAWINGS AT ALL, and that turns out to be the sharper fixture. This
     * assertion was written the other way round — "the fake offers its own" — and failed on its own
     * setup, because the fake view in this file lends the panel only the coordinate switch. Empty
     * BEFORE and filled AFTER is a stronger statement than one list differing from another: it can
     * only be true if the panel asked the renderer that is drawing now.
     */
    const setsBefore = optionsOf();
    expect(setsBefore, 'the fake lends no drawings').toBe('');

    await shell.switchView('2d');

    expect(shell.view(), 'a different renderer is drawing').not.toBe(before);
    expect(optionsOf(), 'the panel is offering the flat board drawings').not.toBe('');
  });

  it('asking for the view already showing is a no-op', () => {
    // Cheap, and it guards the tear-down: a swap that destroyed and rebuilt the same renderer would
    // throw away the board for no reason a player could see.
    fixture();
    clear();
    saveSettings({ mode: 'two' });
    const shell = createGameShell({
      host: document, kind: '2.5d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      debugName: '__switchSame', contrastTheme: 'contrast-flat',
    });
    const before = shell.view();
    return shell.switchView('2.5d').then(() => {
      expect(shell.view(), 'untouched').toBe(before);
    });
  });
});
