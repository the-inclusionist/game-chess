// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest';
/*
 * ⚠️ ONE ROOT, THREE VIEWS. This imported three entry modules, one per page, because each view WAS
 * a page. Inside a platform a second HTML entry is a second URL rather than a second bundle, so the
 * pages went and the kind became an argument.
 */
import { bootChess } from '../app/js/boot/standalone.ts';
import { saveSettings } from '../app/js/chess/session.ts';

// ========================= WHY THIS TEST EXISTS =========================
// Twice now, a change to `boot/main.ts` has thrown on the very first line of the game and been
// caught by neither `tsc --noEmit`, nor 375 tests, nor the build.
//
//   1. The walk state was declared below `createHud`, which calls its own `refresh()` while being
//      constructed — and `refresh` asks `canTakeBack`, which reads that state.
//   2. `relayout()` was made to call `invalidate()`, and `relayout()` runs before `invalidate` is
//      initialised.
//
// Both are temporal dead zones: legal TypeScript, legal JavaScript, and a `ReferenceError` at run
// time. TypeScript does not track initialisation order across closure boundaries, so it cannot see
// either one. The build succeeds because a bundler does not run the code. And every other test
// imports the modules `main.ts` composes WITHOUT composing them, which is exactly the gap: the
// composition root is the one module whose only job is the order things happen in.
//
// So this test does the one thing the others could not: it BOOTS. It is deliberately shallow —
// what it asserts is that the game came up at all, which is all either bug needed to be caught.

function fixture(): void {
  document.body.innerHTML = `
    <div id="stage-wrap" style="width: 640px; height: 360px">
      <div id="game-region">
        <div id="chess-board" tabindex="0"></div>
        <div id="side-column"></div>
      </div>
      <div class="pause-icons" id="title-icons" role="group" aria-label="Atalhos de acessibilidade"></div>
    </div>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd" class="sr-only" aria-hidden="true"></svg>
  `;
}

afterEach(() => { document.body.replaceChildren(); });

describe('[Boot] the composition root actually composes', () => {
  it('boots without throwing', async () => {
    fixture();
    await expect(bootChess(document, '2.5d')).resolves.not.toThrow();
  });

  it('puts the board, the mirror, the coordinates and the panel on the screen', async () => {
    fixture();
    await bootChess(document, '2.5d');
    const region = document.getElementById('chess-board');
    expect(region?.querySelector('#board-canvas')).not.toBeNull();
    expect(region?.querySelectorAll('[role="gridcell"]')).toHaveLength(64);
    expect(region?.querySelectorAll('.coords-label')).toHaveLength(16);
    /*
     * ⚠️ IN THE STAGE, NOT IN THE REGION. The side panel used to be absolutely positioned over the
     * board's right 27.5% and was therefore a child of it — which is why it could never be widened
     * without covering the board. It is a sibling now, in `#side-column`, and `#game-region` is what
     * holds both. Asserting through the stage is asserting the thing that is still true: the panel
     * reached the document.
     */
    expect(document.querySelector('#game-region .chess-hud')).not.toBeNull();
    expect(region?.querySelector('.chess-hud')).toBeNull();
  });

  it('starts from the opening position, drawn', async () => {
    fixture();
    await bootChess(document, '2.5d');
    // Thirty-two pieces named on the mirror is the position having reached the DOM, which means
    // the rules, the declaration and the renderer all built.
    const occupied = [...document.querySelectorAll('[role="gridcell"]')]
      .filter((cell) => !/vazia|empty|vacía/.test(cell.getAttribute('aria-label') ?? ''));
    expect(occupied).toHaveLength(32);
  });

  it('hides the canvas from the screen reader and keeps the mirror ahead of it', async () => {
    fixture();
    await bootChess(document, '2.5d');
    const region = document.getElementById('chess-board')!;
    const canvas = region.querySelector('#board-canvas')!;
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    const grid = region.querySelector('[role="grid"]')!;
    // Node.DOCUMENT_POSITION_FOLLOWING: the canvas comes after the grid, so a reader meets the
    // board it can use first.
    expect(grid.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// The flat board has its own composition root, and the same gap: nothing else builds it. The 3D
// root has now thrown at boot twice for faults no other test could see, and this one composes the
// same modules in a different order — which is exactly where that class of fault lives.
describe('[Boot] the flat composition root composes too', () => {
  it('boots without throwing', async () => {
    fixture();
    await expect(bootChess(document, '2d')).resolves.not.toThrow();
  });

  it('puts a VISIBLE board and the panel on the screen, and no canvas', async () => {
    fixture();
    await bootChess(document, '2d');
    const region = document.getElementById('chess-board');
    expect(region?.querySelector('.board-2d')).not.toBeNull();
    expect(region?.querySelectorAll('[role="gridcell"]')).toHaveLength(64);
    expect(region?.querySelectorAll('.cell-coord')).toHaveLength(16);
    /*
     * ⚠️ IN THE STAGE, NOT IN THE REGION. The side panel used to be absolutely positioned over the
     * board's right 27.5% and was therefore a child of it — which is why it could never be widened
     * without covering the board. It is a sibling now, in `#side-column`, and `#game-region` is what
     * holds both. Asserting through the stage is asserting the thing that is still true: the panel
     * reached the document.
     */
    expect(document.querySelector('#game-region .chess-hud')).not.toBeNull();
    expect(region?.querySelector('.chess-hud')).toBeNull();
    // The whole point of the second entry: this view never builds a renderer.
    expect(region?.querySelector('canvas')).toBeNull();
  });

  it('draws the opening position', async () => {
    fixture();
    await bootChess(document, '2d');
    const drawn = [...document.querySelectorAll('.cell-piece')].filter((g) => g.textContent);
    expect(drawn).toHaveLength(32);
  });
});

describe('[Boot] the board turns round for a player who chose black', () => {
  it('flips the ELEMENT and leaves the grid alone', async () => {
    // The rotation is CSS on the board. The DOM keeps its rows, its columns, its reading order and
    // its arrow keys — which is why a1 is still a1 to a screen reader on a turned board.
    saveSettings({ mode: 'b' });
    fixture();
    await bootChess(document, '2d');
    const board = document.querySelector<HTMLElement>('.board-2d');
    expect(board?.dataset.flipped).toBe('true');
    const first = document.querySelector('[role="gridcell"]');
    expect(first?.getAttribute('data-square')).toBe('a8');
    saveSettings({});
  });
});

// ========================= AND THE THIRD ROOT, WHICH NOTHING EVER BOOTED =========================
// ⚠️ THIS IS THE TEST WHOSE ABSENCE COST A DEAD OPPONENT. `main-3d.ts` answered the engine by
// picking the piece up and putting it down the way a player does — two `activate` calls — and
// `activate` answers every call in the `thinking` phase with `ignored/busy`, which is the whole
// point of the phase and which `state.node.test.ts` has asserted all along. So the reply was
// dropped, in silence, for as long as this view has existed: the engine searched, the panel showed
// the depth it reached, and the board never changed.
//
// Nothing here would have caught THAT — the wiring lives inside a `.then()` that needs 6.98 MB of
// WebAssembly to reach, which is the seam the shared core is meant to open. What this catches is
// the class the other two describes catch: a root that does not come up at all.
describe('[Boot] the solid composition root composes too', () => {
  it('boots without throwing', async () => {
    fixture();
    await expect(bootChess(document, '3d')).resolves.not.toThrow();
  });

  it('puts a canvas, the mirror and the panel on the screen', async () => {
    fixture();
    await bootChess(document, '3d');
    const region = document.getElementById('chess-board');
    expect(region?.querySelector('canvas')).not.toBeNull();
    expect(region?.querySelectorAll('[role="gridcell"]')).toHaveLength(64);
    /*
     * ⚠️ IN THE STAGE, NOT IN THE REGION. The side panel used to be absolutely positioned over the
     * board's right 27.5% and was therefore a child of it — which is why it could never be widened
     * without covering the board. It is a sibling now, in `#side-column`, and `#game-region` is what
     * holds both. Asserting through the stage is asserting the thing that is still true: the panel
     * reached the document.
     */
    expect(document.querySelector('#game-region .chess-hud')).not.toBeNull();
    expect(region?.querySelector('.chess-hud')).toBeNull();
  });

  it('starts from the opening position', async () => {
    fixture();
    await bootChess(document, '3d');
    const occupied = [...document.querySelectorAll('[role="gridcell"]')]
      .filter((cell) => !/vazia|empty|vacía/.test(cell.getAttribute('aria-label') ?? ''));
    expect(occupied).toHaveLength(32);
  });

  it('hides the canvas from the screen reader and keeps the mirror ahead of it', async () => {
    /*
     * ⚠️ BOTH OF THESE FAILED BEFORE THE SHELL, and the 2.5D describe above has asserted them
     * since it was written. That asymmetry IS the fault: a reader arriving on this page met an
     * unlabelled canvas before the board it could use, because the third copy of the wiring had
     * quietly lost two lines the other two had.
     */
    fixture();
    await bootChess(document, '3d');
    const region = document.getElementById('chess-board')!;
    const canvas = region.querySelector('canvas')!;
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    const grid = region.querySelector('[role="grid"]')!;
    expect(grid.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
