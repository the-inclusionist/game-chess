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
import { createGameShell } from '../app/js/boot/game-shell.ts';
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
          pieceSets: [{ key: 'outline', label: 'Outline' }, { key: 'solid', label: 'Solid' }],
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

  const dialog = (): HTMLElement | null => document.querySelector('[role="dialog"]');

  it('⚠️ carries every display setting the redesign moved there', () => {
    shellFor(false);
    document.getElementById('game-region')!.focus();
    press('KeyH', 'h');

    const open = dialog();
    expect(open).not.toBeNull();
    expect(open!.getAttribute('aria-modal')).toBe('true');

    // The seven, by the ids they are actually built with. Named one at a time rather than counted,
    // so a failure says WHICH one went missing.
    expect(open!.querySelector('.hud-views'), '2D/2.5D/3D').not.toBeNull();
    expect(open!.querySelector('#hud-set'), 'piece drawing').not.toBeNull();
    expect(open!.querySelector('#hud-theme'), 'board colours').not.toBeNull();
    expect(open!.querySelector('#hud-vision'), 'colour vision').not.toBeNull();
    expect(open!.querySelector('#hud-motion'), 'reduced motion').not.toBeNull();
    expect(open!.querySelector('#hud-outline'), 'piece outline').not.toBeNull();
    expect(open!.querySelector('#hud-coords'), 'files and ranks').not.toBeNull();
    expect(open!.querySelector('#hud-locale'), 'language').not.toBeNull();
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
   * fold. `.hud` sets `display: flex`, and a class beats the UA sheet's `[hidden] { display: none }`.
   *
   * The trap was known — `.pause-menu`, `.lesson-menu`, `.lesson-panel`, `.lesson-nudge`,
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
    probe.className = 'hud';
    document.body.appendChild(probe);
    expect(getComputedStyle(probe).display).toBe('flex');
    probe.remove();
  });

  it('⚠️ the HUD, the player strips and the engine line all LEAVE during a lesson', async () => {
    const shell = shellFor();
    expect(shown('.hud')).toBe('flex');

    expect(shell.teach()).toBe(true);
    await untilLesson();

    // Not `hidden === true`, which was true all along. What a person would see.
    expect(shown('.hud'), 'the HUD').toBe('none');
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

    const strips = document.querySelector('.board-players') as HTMLElement | null;
    const board = document.getElementById('game-region')!;
    expect(strips, 'the player strips are on the page').not.toBeNull();

    const row = strips!.getBoundingClientRect();
    const box = board.getBoundingClientRect();
    expect(row.height, 'the strips have a size at all').toBeGreaterThan(0);

    // Above: the row ends at or before the board begins. A one-pixel tolerance, not a whole line.
    expect(`strips end above the board? ${row.bottom <= box.top + 1}`)
      .toBe('strips end above the board? true');

    // And the full width of the board, so the two names land on its two edges.
    expect(`width ${Math.round(row.width)} of ${Math.round(box.width)}`)
      .toBe(`width ${Math.round(box.width)} of ${Math.round(box.width)}`);
  });

  it('⚠️ and all three come back when the lesson is left', async () => {
    // They were hidden rather than destroyed, so the move list keeps its scroll and whatever
    // control had focus keeps it. That only pays if they actually return.
    const shell = shellFor();
    expect(shell.teach()).toBe(true);
    await untilLesson();
    expect(shown('.hud')).toBe('none');

    press('KeyH', 'h');
    const quit = [...document.querySelectorAll('[role="dialog"] button')]
      .find((b) => /sair/i.test(b.textContent ?? ''));
    expect(quit, 'a way out of the lesson').toBeDefined();
    (quit as HTMLButtonElement).click();
    await new Promise((resolve) => { setTimeout(resolve, 50); });

    expect(shown('.hud'), 'the HUD came back').toBe('flex');
    expect(shown('.board-players'), 'the strips came back').not.toBe('none');
    expect(shown('.thinking'), 'the engine line came back').not.toBe('none');
  });
});
