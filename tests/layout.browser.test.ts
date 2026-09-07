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

describe('[Stage] sixteen units by nine, and nine of them are a square board', () => {
  /*
   * ========================= THE SPEC, IN THE WORDS IT WAS GIVEN IN =========================
   * "O painel se divide em duas partes, um quadrado perfeito para o tabuleiro e o restante para o
   * painel lateral. O tabuleiro fica com 9x9 unidades enquanto a barra lateral fica com 7x9
   * unidades. Juntos ficam com 16x9." And: the floor is 640x360, twice the engine's 320x180, with
   * a 360x360 board and a 280x360 panel — which makes one unit 40 pixels there.
   *
   * ⚠️ THE STAGE USED TO BE 2:1 IN UNITS OF 360x180, and these tests used to say so. A 2:1 stage
   * cannot hold a square board of nine units in sixteen: the board is bound by the height and the
   * panel takes everything else, which is the "board adrift beside an enormous panel" that was
   * reported from the screen. The old assertions were not wrong about the old stage; they were
   * describing a shape that has been replaced, and patching them would have kept it alive.
   */
  const RATIO = 16 / 9;

  it('⚠️ is exactly sixteen by nine on every viewport, not merely close to it', () => {
    for (let w = 700; w <= 2600; w += 37) {
      page(w, Math.round(w / 2), { canvas: true });
      applyLayout({ doc: document, win: win(1) });
      const sw = px(stage(), 'width');
      const sh = px(stage(), 'height');
      expect(`${w}: ${(sw / sh).toFixed(6)}`).toBe(`${w}: ${RATIO.toFixed(6)}`);
    }
  });

  it('⚠️ gives the board a PERFECT SQUARE, which is the whole point of the shape', () => {
    for (let w = 700; w <= 2600; w += 53) {
      page(w, Math.round(w / 2), { canvas: true });
      applyLayout({ doc: document, win: win(1) });
      const region = document.getElementById('game-region');
      expect(`${w}: ${px(region, 'width')} x ${px(region, 'height')}`)
        .toBe(`${w}: ${px(region, 'height')} x ${px(region, 'height')}`);
    }
  });

  it('⚠️ splits the sixteen columns nine to the board and seven to the panel', () => {
    for (let w = 700; w <= 2600; w += 53) {
      page(w, Math.round(w / 2), { canvas: true });
      applyLayout({ doc: document, win: win(1) });
      const unit = px(stage(), 'width') / 16;
      const boardUnits = px(document.getElementById('game-region'), 'width') / unit;
      const panelUnits = px(column(), 'width') / unit;
      expect(`${w}: board ${boardUnits.toFixed(3)} panel ${panelUnits.toFixed(3)}`)
        .toBe(`${w}: board 9.000 panel 7.000`);
    }
  });

  it('⚠️ floors at 640x360 and OVERFLOWS a smaller viewport rather than shrinking the art', () => {
    page(400, 200, { canvas: true });
    applyLayout({ doc: document, win: win(1) });
    expect(px(stage(), 'width')).toBe(640);
    expect(px(stage(), 'height')).toBe(360);
    expect(px(stage(), 'width')).toBeGreaterThan(400);
  });

  it('reaches a bigger rung when the window has room for one', () => {
    page(1400, 800, { canvas: true });
    applyLayout({ doc: document, win: win(1) });
    expect(px(stage(), 'width')).toBe(1280);
    expect(px(document.getElementById('game-region'), 'width')).toBe(720);
  });
});

describe('[Scale] the board lands on whole PHYSICAL pixels, at every device ratio', () => {
  it('⚠️ never puts the raster on a fraction of a real pixel', () => {
    /*
     * ADR-001, corrected 2026-07-04, and the reason the ladder is not simply every multiple of
     * 320x180. A 960x540 stage is a perfectly good multiple and puts a 360x360 board at 1.5x:
     * fractional at a device ratio of 1, and exactly 3x at a ratio of 2, where 540 CSS pixels ARE
     * 1080 real ones. So which rungs exist depends on the screen, and this is the invariant that
     * has to hold on all of them.
     */
    for (const dpr of [1, 1.25, 1.5, 2, 3]) {
      for (let w = 700; w <= 2400; w += 113) {
        page(w, Math.round(w / 2), { canvas: true });
        const result = applyLayout({ doc: document, win: win(dpr) })!;
        expect(`dpr ${dpr} at ${w}: ${Number.isInteger(result.scaleDevice)}`)
          .toBe(`dpr ${dpr} at ${w}: true`);
      }
    }
  });

  it('reports a size the scale implies, rather than one it rounded to separately', () => {
    page(1500, 900, { canvas: true });
    const result = applyLayout({ doc: document, win: win(2) })!;
    expect(result.width).toBeCloseTo((LOGICAL_W * result.scaleDevice) / 2, 6);
    expect(result.height).toBeCloseTo((LOGICAL_H * result.scaleDevice) / 2, 6);
    // And the raster is square, so the two agree with each other.
    expect(result.width).toBeCloseTo(result.height, 6);
  });
});

describe('[Bounds] nothing is drawn outside the stage', () => {
  it('⚠️ keeps the board and the panel inside it, exactly, with nothing spare', () => {
    /*
     * "Nada pode ser desenhado fora desta resolução, especialmente menus como o de pausa." The two
     * boxes are nine units and seven, so together they are the stage — no remainder to absorb and
     * none to overflow. The gap between them is padding INSIDE the panel for that reason: a flex
     * gap comes out of the children and squeezed the board to 351 where the spec says 360.
     */
    for (let w = 700; w <= 2600; w += 41) {
      page(w, Math.round(w / 2), { canvas: true });
      applyLayout({ doc: document, win: win(1) });
      const used = px(document.getElementById('game-region'), 'width') + px(column(), 'width');
      expect(`${w}: ${used} of ${px(stage(), 'width')}`)
        .toBe(`${w}: ${px(stage(), 'width')} of ${px(stage(), 'width')}`);
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
    /*
     * ⚠️ THE NUMBERS, NOT "IT IS SET". This asked for non-empty strings and for a `--hud-fs`
     * at least 9 — which read back what the line above it had just written, and passed for the
     * whole time `--ui-fs` was half what it should have been. A 1500x760 window at a ratio of 1
     * holds a 720 board in a 1280 stage, so the two values are decided and can be named.
     */
    const vars = stage()!;
    expect(vars.style.getPropertyValue('--tap')).toBe('44px');
    expect(vars.style.getPropertyValue('--ui-fs')).toBe('32px');
  });
});

describe('[Missing] a page without the elements is not a crash', () => {
  it('returns null rather than throwing when there is no stage to lay out', () => {
    // `applyLayout` runs on every resize, from a shell that may be mid-teardown.
    document.body.replaceChildren();
    expect(applyLayout({ doc: document, win: win(1) })).toBeNull();
  });
});
