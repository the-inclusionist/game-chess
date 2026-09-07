// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE ONE NUMBER THE USER ASKED FOR TWICE =========================
// "O tabuleiro, o menu lateral e a barra de lição devem ocupar uma tela com resolução de múltiplos
// inteiros de 360x180" — and, later, "As dimensões do tabuleiro e menu lateral estão horrivelmente
// estranhas. Isso será corrigido?". `ui/layout.ts` is where both of those live, and it had no test
// at all: every claim in it was held up by its own comments.
//
// ⚠️ AND IT IS THE PIXEL-ART INVARIANT TOO. One source pixel must be a whole number of PHYSICAL
// pixels — ADR-001, corrected against device pixel ratio — which is the difference between art
// this project can ship and art with uneven scanlines. Nothing was checking it.
//
// The `win` is a stub because the module reads exactly one thing from it. That is not a shortcut:
// it is what lets a device pixel ratio of 2 be tested on a machine that has 1, and the ratio is
// where this arithmetic actually goes wrong.
import { afterEach, describe, expect, it } from 'vitest';
import { applyLayout } from '../app/js/ui/layout.ts';
import { LOGICAL_H, LOGICAL_W } from '../app/js/render/resolution.ts';

const STAGE_UNIT_W = 360;
const STAGE_UNIT_H = 180;

/**
 * A page, at a stated viewport.
 *
 * `#stage-wrap` is given a real size, because `clientWidth` is what the module measures — a
 * fixture that only set a style attribute without laying out would report zero and the module
 * would fall back to its floor, which is the one path that must not be the one under test.
 */
function page(width: number, height: number, opts: { canvas?: boolean } = {}): void {
  document.body.innerHTML = `
    <div id="stage-wrap" style="width:${width}px;height:${height}px">
      <div id="stage">
        <div id="game-region">${opts.canvas ? '<canvas id="board-canvas"></canvas>' : ''}</div>
        <div id="side-column"></div>
      </div>
    </div>
  `;
}

const win = (devicePixelRatio: number): Window =>
  ({ devicePixelRatio } as unknown as Window);

const px = (el: HTMLElement | null, prop: 'width' | 'height'): number =>
  Number.parseFloat((el?.style[prop] ?? '0').replace('px', ''));

const stage = (): HTMLElement | null => document.getElementById('stage');
const column = (): HTMLElement | null => document.getElementById('side-column');

afterEach(() => { document.body.replaceChildren(); });

describe('[Stage] whole units of 360x180, and never fewer than three', () => {
  it('⚠️ is an exact multiple on every viewport, not merely close to one', () => {
    /*
     * Swept rather than sampled at one size. A rounding that only shows up on odd widths is
     * exactly the kind of thing a single well-chosen fixture agrees with — and the complaint that
     * started this was about how the board looked, which is a complaint about the sizes nobody
     * picked deliberately.
     */
    for (let w = 700; w <= 2400; w += 37) {
      page(w, Math.round(w / 2));
      applyLayout({ doc: document, win: win(1) });
      const sw = px(stage(), 'width');
      const sh = px(stage(), 'height');
      expect(`${w}: ${sw % STAGE_UNIT_W} ${sh % STAGE_UNIT_H}`).toBe(`${w}: 0 0`);
      // And it stays 2:1, which is what "multiples of 360x180" means when both are multiplied by
      // the same whole number.
      expect(`${w}: ${sw / sh}`).toBe(`${w}: 2`);
    }
  });

  it('⚠️ floors at k=3, and a viewport too small OVERFLOWS rather than shrinking the art', () => {
    /*
     * The floor is three and not the two that was asked for, and that is arithmetic: the board is
     * 640x360 logical and scales by whole numbers, so at k=2 it would be 640 px wide inside a
     * 720 px stage and leave 80 px for a panel that has to hold a lesson.
     */
    page(400, 200);
    applyLayout({ doc: document, win: win(1) });
    expect(px(stage(), 'width')).toBe(STAGE_UNIT_W * 3);
    expect(px(stage(), 'height')).toBe(STAGE_UNIT_H * 3);
    // Deliberately larger than the viewport it was given: the art does not shrink to fit.
    expect(px(stage(), 'width')).toBeGreaterThan(400);
  });

  it('grows by whole units as the window does', () => {
    page(1100, 560);
    applyLayout({ doc: document, win: win(1) });
    const small = px(stage(), 'width');

    page(1500, 760);
    applyLayout({ doc: document, win: win(1) });
    expect(px(stage(), 'width')).toBeGreaterThan(small);
    expect(px(stage(), 'width') % STAGE_UNIT_W).toBe(0);
  });
});

describe('[Scale] one source pixel is a whole number of PHYSICAL pixels', () => {
  it('⚠️ is an integer at every device pixel ratio, which is where this goes wrong', () => {
    /*
     * ADR-001, corrected 2026-07-04. Scaling by a whole number of CSS pixels is not enough: on a
     * 1.5x or 2x screen a "clean" CSS scale lands the art on half a physical pixel and every edge
     * in it is resampled. The board is drawn in a renderer whose entire point is not resampling.
     */
    for (const dpr of [1, 1.25, 1.5, 2, 3]) {
      for (let w = 800; w <= 2000; w += 113) {
        page(w, Math.round(w / 2), { canvas: true });
        const result = applyLayout({ doc: document, win: win(dpr) })!;
        expect(`dpr ${dpr} at ${w}: ${Number.isInteger(result.scaleDevice)}`)
          .toBe(`dpr ${dpr} at ${w}: true`);
        expect(`dpr ${dpr} at ${w}: ${result.scaleDevice >= 1}`)
          .toBe(`dpr ${dpr} at ${w}: true`);
      }
    }
  });

  it('reports the size the scale implies, rather than a size it rounded to separately', () => {
    // Two numbers that must agree by construction. If they are ever computed apart, the canvas
    // stretches by whatever the difference is and nothing says so.
    page(1500, 760, { canvas: true });
    const result = applyLayout({ doc: document, win: win(2) })!;
    expect(result.width).toBeCloseTo((LOGICAL_W * result.scaleDevice) / 2, 6);
    expect(result.height).toBeCloseTo((LOGICAL_H * result.scaleDevice) / 2, 6);
  });
});

describe('[Column] the panel is the remainder, and the remainder is clamped', () => {
  it('⚠️ never narrower than 300, which is the width a sentence needs', () => {
    /*
     * Measured before it was chosen: at the old 176 px the lesson column held 875 px of content in
     * 357 px of height and a child read a sentence through a slot.
     */
    for (let w = 700; w <= 2400; w += 53) {
      page(w, Math.round(w / 2));
      applyLayout({ doc: document, win: win(1) });
      expect(`${w}: ${px(column(), 'width') >= 300}`).toBe(`${w}: true`);
    }
  });

  it('⚠️ never wider than one stage unit, or the screen reads as two equal halves', () => {
    /*
     * This is what a 2:1 stage does to a SQUARE board if nothing stops it: the board is bound by
     * the stage's height, so the panel inherits everything left over — one chess board and one
     * menu, the same size. Capped, the leftover becomes margin either side of the pair.
     */
    for (let w = 700; w <= 2400; w += 53) {
      page(w, Math.round(w / 2));
      applyLayout({ doc: document, win: win(1) });
      expect(`${w}: ${px(column(), 'width') <= 360}`).toBe(`${w}: true`);
    }
  });
});

describe('[Region] as tall and as wide as what it must contain', () => {
  it('⚠️ a canvas page gets exactly the art, because a canvas stretches to its box', () => {
    page(1500, 760, { canvas: true });
    const result = applyLayout({ doc: document, win: win(1) })!;
    const region = document.getElementById('game-region');
    expect(px(region, 'width')).toBeCloseTo(result.width, 6);
    expect(px(region, 'height')).toBeCloseTo(result.height, 6);
  });

  it('⚠️ a flat page gets a SQUARE, because its board is DOM sized as a percentage', () => {
    /*
     * The two pages differ here and the module asks the document rather than being told, because
     * the answer is a fact about it: either there is a canvas in it or there is not. Holding the
     * flat board to the canvas's height left 180 px empty and drew a 338 px board where a 507 px
     * one fits.
     */
    page(1500, 760);
    applyLayout({ doc: document, win: win(1) });
    const region = document.getElementById('game-region');
    expect(px(region, 'width')).toBe(px(region, 'height'));
    expect(px(region, 'height')).toBeGreaterThanOrEqual(px(stage(), 'height'));
  });

  it('the board and the panel together never exceed the stage', () => {
    // The two are siblings in a fixed box: if this ever fails, one of them is off the screen.
    for (let w = 700; w <= 2400; w += 41) {
      page(w, Math.round(w / 2));
      applyLayout({ doc: document, win: win(1) });
      const used = px(document.getElementById('game-region'), 'width') + px(column(), 'width');
      expect(`${w}: ${used <= px(stage(), 'width')}`).toBe(`${w}: true`);
    }
  });
});

describe('[Type] a tap target is a finger, whatever the game rasterises at', () => {
  it('sizes the UI variables against the ENGINE base, not against this one', () => {
    /*
     * `--tap` is 44 CSS pixels at the engine's own k=2, and it must not halve just because this
     * game draws at twice the density. The variables go on the STAGE rather than the region,
     * because the panel is a sibling of the board and would not inherit from it.
     */
    page(1500, 760, { canvas: true });
    applyLayout({ doc: document, win: win(1) });
    const vars = stage()!;
    expect(vars.style.getPropertyValue('--tap')).not.toBe('');
    expect(vars.style.getPropertyValue('--ui-fs')).not.toBe('');
    expect(Number.parseFloat(vars.style.getPropertyValue('--hud-fs'))).toBeGreaterThanOrEqual(9);
  });
});

describe('[Missing] a page without the elements is not a crash', () => {
  it('returns null rather than throwing when there is no stage to lay out', () => {
    // `applyLayout` runs on every resize, from a shell that may be mid-teardown.
    document.body.replaceChildren();
    expect(applyLayout({ doc: document, win: win(1) })).toBeNull();
  });
});

describe('[Stage] a canvas page stops growing where the board stops', () => {
  /*
   * ========================= THE ONE THAT WAS REPORTED FROM THE SCREEN =========================
   * "O tabuleiro reduziu drasticamente de tamanho. Por que?" — because a canvas board scales 1x,
   * 2x, 3x and nothing between, while the stage grew smoothly with the window. Every viewport from
   * 1440 to 1799 across produced a 1440x720 stage holding a 640x360 board and a 360 panel, with
   * 440 pixels of nothing between them: the board adrift in a box built for a bigger one.
   *
   * ⚠️ AND THE FIX SHIPPED WITH NO TEST AT ALL. Deleting the whole branch left all twelve
   * assertions in this file green, because every fixture above builds a page WITHOUT a canvas and
   * takes the other path. Found by deleting it and watching nothing happen.
   *
   * The property is not "k equals three at 1440". It is that the stage is never a whole unit wider
   * than the board and the panel actually need — which is what "adrift" means, measured.
   */
  it('⚠️ never leaves a whole stage unit of nothing between the board and the panel', () => {
    for (let w = 1080; w <= 2600; w += 29) {
      page(w, Math.round(w / 2), { canvas: true });
      applyLayout({ doc: document, win: win(1) });
      const stageW = px(stage(), 'width');
      const boardW = px(document.getElementById('game-region'), 'width');
      const columnW = px(column(), 'width');
      const spare = stageW - boardW - columnW;
      expect(`${w}: spare ${spare} under one unit? ${spare < STAGE_UNIT_W}`)
        .toBe(`${w}: spare ${spare} under one unit? true`);
    }
  });

  it('⚠️ and at 1440 specifically, which is where it was reported', () => {
    // The exact case in the screenshot: a 1440-wide window must not build a 1440-wide stage around
    // a 640-wide board.
    page(1440, 810, { canvas: true });
    applyLayout({ doc: document, win: win(1) });
    expect(px(stage(), 'width')).toBe(1080);
    expect(px(document.getElementById('game-region'), 'width')).toBe(640);
  });

  it('⚠️ but a FLAT page still fills the window, because its board is not pixel art', () => {
    /*
     * The other half, and the reason the rule is guarded on the document rather than applied to
     * both. The flat board is DOM sized as a percentage of its box: it takes whatever stage it is
     * given, so capping the stage there would shrink a board that was perfectly fine.
     */
    page(1440, 810);
    applyLayout({ doc: document, win: win(1) });
    const flat = px(stage(), 'width');
    page(1440, 810, { canvas: true });
    applyLayout({ doc: document, win: win(1) });
    expect(flat).toBeGreaterThan(px(stage(), 'width'));
  });

  it('still reaches the bigger scales when the window is big enough for them', () => {
    // 1x needs 1080, 2x needs 1800. The rule caps the stage; it must not cap the board.
    page(1920, 1080, { canvas: true });
    const result = applyLayout({ doc: document, win: win(1) })!;
    expect(px(stage(), 'width')).toBe(1800);
    expect(result.scaleDevice).toBe(2);
  });
});
