// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest';
import { boot } from '../app/js/boot/main.ts';

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
