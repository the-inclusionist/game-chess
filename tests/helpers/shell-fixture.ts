// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/helpers/shell-fixture — the page a shell needs, and a view that draws nothing.
//
// 📌 EXTRACTED FROM `shell.browser.test.ts` ON 2026-10-05, when a second file needed the same two.
// Copying them would have been the drift this repository keeps paying for, and in this particular
// pair it would bite in a way that is hard to see: the markup below is the engine's REQUIRED ids
// (`#game-region`, `#sr-status`, `#sr-alert`) plus the hosts this game names. A copy that fell a
// version behind would not fail — the engine reports missing ids as `problems`, not as a throw —
// it would simply test a page the real one no longer looks like.

import { toAlgebraic, type Square } from '../../app/js/chess/types.ts';
import type { BoardView, ViewContext } from '../../app/js/boot/view.ts';

/** The markup a shell expects to find: the engine's required ids plus this game's own hosts. */
export function fixture(): void {
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

export interface Recorded {
  readonly legs: string[];
  readonly hidden: string[][];
}

/** A view that draws nothing and remembers everything. */
export function fakeView(record: Recorded) {
  return (ctx: ViewContext): BoardView => {
    ctx.region.appendChild(ctx.mirror.root);
    return {
      hudControls: { coordinates: () => false, onCoordinates: () => {} },
      applyTheme: () => {},
      drawPosition: (hidden) => { record.hidden.push(hidden.map(toAlgebraic)); },
      drawMarks: () => {},
      carry: () => {},
      travel: (from: Square, to: Square) => {
        record.legs.push(`${toAlgebraic(from)}${toAlgebraic(to)}`);
        return Promise.resolve();
      },
      relayout: () => {},
      destroy: () => {},
    };
  };
}
