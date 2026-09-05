// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest';
import { boot } from '../app/js/boot/main.ts';
import { boot2d } from '../app/js/boot/main-2d.ts';
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
      <div id="game-region" tabindex="0"></div>
    </div>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd" aria-hidden="true"></svg>
  `;
}

afterEach(() => { document.body.replaceChildren(); });

describe('[Boot] the composition root actually composes', () => {
  it('boots without throwing', () => {
    fixture();
    expect(() => boot(document)).not.toThrow();
  });

  it('puts the board, the mirror, the coordinates and the panel on the screen', () => {
    fixture();
    boot(document);
    const region = document.getElementById('game-region');
    expect(region?.querySelector('#board-canvas')).not.toBeNull();
    expect(region?.querySelectorAll('[role="gridcell"]')).toHaveLength(64);
    expect(region?.querySelectorAll('.coords-label')).toHaveLength(16);
    expect(region?.querySelector('.hud')).not.toBeNull();
  });

  it('starts from the opening position, drawn', () => {
    fixture();
    boot(document);
    // Thirty-two pieces named on the mirror is the position having reached the DOM, which means
    // the rules, the declaration and the renderer all built.
    const occupied = [...document.querySelectorAll('[role="gridcell"]')]
      .filter((cell) => !/vazia|empty|vacía/.test(cell.getAttribute('aria-label') ?? ''));
    expect(occupied).toHaveLength(32);
  });

  it('hides the canvas from the screen reader and keeps the mirror ahead of it', () => {
    fixture();
    boot(document);
    const region = document.getElementById('game-region')!;
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
  it('boots without throwing', () => {
    fixture();
    expect(() => boot2d(document)).not.toThrow();
  });

  it('puts a VISIBLE board and the panel on the screen, and no canvas', () => {
    fixture();
    boot2d(document);
    const region = document.getElementById('game-region');
    expect(region?.querySelector('.board-2d')).not.toBeNull();
    expect(region?.querySelectorAll('[role="gridcell"]')).toHaveLength(64);
    expect(region?.querySelectorAll('.cell-coord')).toHaveLength(16);
    expect(region?.querySelector('.hud')).not.toBeNull();
    // The whole point of the second entry: this view never builds a renderer.
    expect(region?.querySelector('canvas')).toBeNull();
  });

  it('draws the opening position', () => {
    fixture();
    boot2d(document);
    const drawn = [...document.querySelectorAll('.cell-piece')].filter((g) => g.textContent);
    expect(drawn).toHaveLength(32);
  });
});

describe('[Boot] the board turns round for a player who chose black', () => {
  it('flips the ELEMENT and leaves the grid alone', () => {
    // The rotation is CSS on the board. The DOM keeps its rows, its columns, its reading order and
    // its arrow keys — which is why a1 is still a1 to a screen reader on a turned board.
    saveSettings({ mode: 'b' });
    fixture();
    boot2d(document);
    const board = document.querySelector<HTMLElement>('.board-2d');
    expect(board?.dataset.flipped).toBe('true');
    const first = document.querySelector('[role="gridcell"]');
    expect(first?.getAttribute('data-square')).toBe('a8');
    saveSettings({});
  });
});
