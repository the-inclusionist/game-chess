// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/layout — how big the game region is, in whole physical pixels.
//
// ========================= WHY THIS IS NOT THE ENGINE'S layout() =========================
// It was, and it had to stop being. The engine's `ui/layout` derives the base size from
// `screenBaseSize(numJogadores)` — 320×180 for one player, 640×180 for two, 640×360 for three or
// four. That conflates two different questions: HOW MANY PLAYERS share the screen, and WHAT
// RESOLUTION this game draws at. A game with its own source resolution has no way to say so, and
// the only way to get 640×360 out of it is to claim three players, which would be a lie the rest
// of the engine would then act on.
//
// So the arithmetic below is the engine's, deliberately: ADR-001, integer PHYSICAL pixels, the ≤5
// logical pixels of tolerated crop per side (the −10), and the same floor. Only the base changes.
// If the engine ever separates those two questions, this file should go away.
//
// ========================= WHAT THE UI VARIABLES MEAN HERE =========================
// `--ui-fs` and `--tap` are sized against the ENGINE's 320-wide base, not against ours. A tap
// target is 44 CSS pixels because a finger is a finger; it must not shrink just because this game
// happens to rasterise at twice the density. So the scale for UI is the region's size relative to
// 320, and it comes out identical to what the engine would have produced.

import { LOGICAL_H, LOGICAL_W } from '../render/resolution.ts';

/** The engine's own base width. UI sizes are expressed against this so they match its games. */
const ENGINE_BASE_W = 320;

/**
 * Smallest region we will draw into, in CSS pixels: the engine's k=2 floor, chosen so a 2×2 grid
 * fits a 1366×768 government Chromebook. Ours is a single screen, but the floor is about how small
 * the art may get, not about the grid.
 */
const MIN_REGION_W = 640;

/**
 * ========================= THE STAGE IS SIXTEEN UNITS BY NINE =========================
 * Specified: nine units of it are a PERFECT SQUARE for the board, the remaining seven are the side
 * panel, and nothing may be drawn outside it — the pause menu included.
 *
 * At the floor that is 640x360, which is the engine's 320x180 doubled: a 360x360 board and a
 * 280x360 panel. One unit is 40 pixels there, and every ratio in the spec falls out of it —
 * 9 x 40 = 360, 7 x 40 = 280, 16 x 40 = 640.
 *
 * ⚠️ AND IT GROWS BY DOUBLING, NOT BY EVERY MULTIPLE OF 320x180. The board's raster is 360x360 and
 * must scale by whole PHYSICAL pixels, so the stage's height has to stay a multiple of 360: 360,
 * 720, 1080. A stage of 960x540 — a perfectly good multiple of 320x180 — would put the board at
 * 1.5x and stop it being pixel art. So the ladder is 640x360, 1280x720, 1920x1080, which is every
 * EVEN multiple of the engine's base.
 *
 * ⚠️ THE PREVIOUS SHAPE WAS 2:1 IN UNITS OF 360x180, and it is worth saying why it went. A 2:1
 * stage cannot hold a square board of nine units out of sixteen: the board would have been bound
 * by the height and the panel would have taken everything else, which is exactly the "board adrift
 * beside an enormous panel" that was reported from the screen.
 */
const STAGE_COLS = 16;
/** Of the sixteen columns, nine are the board — which makes it square, since the stage is 16:9. */
const BOARD_COLS = 9;

/*
 * ⚠️ `MIN_COLUMN_W` AND `MAX_COLUMN_W` LIVED HERE AND ARE GONE. They bounded the side panel at 300
 * and 360 px, and both existed only because the panel WAS a remainder: a 2:1 stage with a square
 * board handed it everything the board did not take, which came out as wide as the board itself
 * and had to be clamped back.
 *
 * The panel is seven of the stage's sixteen columns now. A proportion does not need bounds, and
 * keeping them would have fought the proportion at exactly the sizes they were written for.
 */
export interface LayoutHost {
  readonly doc: Document;
  readonly win: Window;
}

export interface LayoutResult {
  /** Region size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Source pixels to physical pixels. A whole number, always. */
  readonly scaleDevice: number;
}

export function applyLayout(host: LayoutHost): LayoutResult | null {
  const wrap = host.doc.getElementById('stage-wrap');
  const region = host.doc.getElementById('game-region');
  const stage = host.doc.getElementById('stage');
  const column = host.doc.getElementById('side-column');
  if (!wrap || !region) return null;

  const dpr = host.win.devicePixelRatio || 1;
  /*
   * ⚠️ WHAT IS UNDER THE BOARD COMES OUT OF THE BOARD'S HEIGHT. The lesson bar and the blunder bar
   * are inside the stage now, so measuring the wrap alone would size a region that does not fit
   * beside them and push one off the bottom of the screen. Measured rather than assumed, because
   * the bar's height depends on how long the step's sentence is.
   *
   * The reserve is read BEFORE the region is resized, so it is the height the panels have with the
   * width they currently have. A relayout follows any change to the panels, which is what keeps
   * that from drifting.
   */
  const below = host.doc.getElementById('below-board');
  const reserved = below ? below.getBoundingClientRect().height : 0;
  const availW = wrap.clientWidth || MIN_REGION_W;
  const availH = Math.max(120, (wrap.clientHeight || (MIN_REGION_W * 9) / 16) - reserved);

  /*
   * ========================= ONE NUMBER DECIDES THE WHOLE STAGE =========================
   * The board is square and is nine of the stage's sixteen columns, so the stage's height IS the
   * board's side. Choose how many whole physical pixels one art pixel gets, and everything else
   * follows: board side, stage height, stage width, panel width.
   *
   * ⚠️ WHOLE PHYSICAL PIXELS, NOT CSS ONES. ADR-001, corrected 2026-07-04: at any device ratio
   * that is not 1 a "clean" CSS scale lands the art on half a physical pixel and every edge in it
   * is resampled, in a renderer whose entire point is not resampling.
   */
  /*
   * ========================= THE LADDER, AND THE TWO RULES IT OBEYS =========================
   * The stage grows in whole multiples of the engine's 320x180 — that is the spec. The board's
   * 360x360 raster must land on whole PHYSICAL pixels — that is ADR-001, and it is not negotiable
   * in a renderer whose point is not resampling.
   *
   * ⚠️ THE TWO DISAGREE AT SOME SIZES, AND THE DEVICE RATIO DECIDES WHICH. A 960x540 stage is a
   * perfectly good multiple of 320x180 and puts the board at 1.5x — fractional at a ratio of 1,
   * and exactly 3x at a ratio of 2, where 540 CSS pixels ARE 1080 physical ones. So the rungs are
   * not fixed: they are every multiple whose board side comes out whole in real pixels, which on a
   * plain screen is every second one and on a retina screen is every one.
   */
  /*
   * ⚠️ THE INTEGER IS THE PHYSICAL SCALE, AND THE CSS SIZE FOLLOWS FROM IT — not the other way
   * round. Choosing a CSS rung first and demanding it come out whole in real pixels sounds like
   * the same rule and is not: at a device ratio of 1.25 no multiple of 180 gives a whole physical
   * scale at all, so there would be no legal size to pick.
   *
   * So the ladder is "how many real pixels does one art pixel get", and the stage is whatever that
   * makes. At a ratio of 1 it lands on 640x360, 1280x720, 1920x1080 — every EVEN multiple of the
   * engine's base, because a 360x360 raster cannot do the odd ones without halving a pixel. At a
   * ratio of 2 the odd ones come back, because 540 CSS pixels are 1080 real ones.
   *
   * The floor is one art pixel per CSS pixel: `round(dpr)`, which is a 360 CSS board and the
   * 640x360 stage the spec names.
   */
  let scaleDevice = Math.max(1, Math.round(dpr));
  for (let next = scaleDevice + 1; ; next += 1) {
    const side = (LOGICAL_W * next) / dpr;
    if ((side * STAGE_COLS) / BOARD_COLS > availW || side > availH) break;
    scaleDevice = next;
  }

  const scale = scaleDevice / dpr;
  const width = LOGICAL_W * scale;
  const height = LOGICAL_H * scale;

  /*
   * The stage from the board, rather than the board from the stage — which is the inversion this
   * whole rewrite is. Sized the other way round, the stage grew smoothly with the window while the
   * board waited for its next whole step, and left it adrift in a box built for a bigger one.
   *
   * ⚠️ A VIEWPORT TOO SMALL FOR THE FLOOR OVERFLOWS rather than shrinking the art, which is what
   * `MIN_REGION_W` has always done here.
   */
  const stageH = height;
  const stageW = (height * STAGE_COLS) / BOARD_COLS;

  if (stage) {
    stage.style.width = `${stageW}px`;
    stage.style.height = `${stageH}px`;
  }
  /*
   * ⚠️ THE REGION IS AS TALL AS WHAT IT MUST CONTAIN, and that differs by page.
   *
   * A canvas page has to be exactly `LOGICAL_H * scale` or the canvas — which is `height: 100%` —
   * stretches and the art stops being an integer multiple of anything. The FLAT page has no canvas
   * at all: its board is DOM, sized as a percentage of this box, so holding it to 360 in a 540-tall
   * stage was leaving 180 px empty and drawing a 338 px board where a 507 px one fits.
   *
   * Asked rather than configured, because the answer is a fact about the document: either there is
   * a canvas in it or there is not.
   */
  /*
   * ⚠️ THE BRANCH THAT USED TO BE HERE IS GONE, and its going is the point. A canvas page was given
   * `LOGICAL_W x LOGICAL_H` and the flat page a square, because one raster was 16:9 and the other
   * board was DOM. The raster is square now, so both pages want the same box and there is nothing
   * left to ask the document about.
   */
  region.style.width = `${width}px`;
  region.style.height = `${height}px`;
  /*
   * The remaining seven of the sixteen columns, exactly — not a remainder to be clamped.
   *
   * ⚠️ `MIN_COLUMN_W` AND `MAX_COLUMN_W` ARE GONE WITH THE CLAMP, and they were only ever there
   * because the panel WAS a remainder: a 2:1 stage with a square board handed it everything left
   * over, which came out as wide as the board itself. Seven units against nine is a proportion,
   * and a proportion does not need bounds.
   */
  if (column) column.style.width = `${stageW - width}px`;

  /*
   * ========================= ⚠️ AGAINST THE STAGE, NOT THE BOARD =========================
   * A 44 px target is 44 px whatever this game rasterises at — that is the promise, and it was
   * broken by making the board's raster square. `width` is the BOARD, and the board used to be the
   * whole interface: 640 CSS pixels at the floor, so `640 / 320` gave 2 and `--tap` came out at 44.
   *
   * The board is nine of sixteen units now and its raster is 360, so the same line produced
   * `360 / 320 = 1.125` and a tap target of 24.75 — buttons 25 pixels tall, well under the floor
   * this game promises and WCAG 2.5.5 asks for. Nothing said so: no test measures a rendered
   * control's height, and the arithmetic reads as correct on the page it was written for.
   *
   * The interface occupies the STAGE, so the stage is what it should be measured against — and the
   * stage at the floor is 640 wide, which restores exactly the numbers this line produced before
   * and keeps them growing with the game rather than with the board's share of it.
   */
  const ui = stageW / ENGINE_BASE_W;
  // ⚠️ ON THE STAGE, NOT ON THE REGION. The panel is a sibling of the board now, so variables set
  // on the board would not reach it — and every control in it is sized from `--tap`.
  const vars = stage ?? region;
  vars.style.setProperty('--ui-fs', `${8 * ui}px`);
  vars.style.setProperty('--tap', `${22 * ui}px`);
  vars.style.setProperty('--hud-fs', `${Math.max(9, Math.round(180 * ui * 0.052))}px`);

  if (below) {
    // Exactly the board and the side menu together — the panels under the board are neither wider
    // nor narrower than the thing they are talking about.
    below.style.width = `${width}px`;
    /*
     * ⚠️ TYPE SIZED AGAINST THE STAGE, WITH A FLOOR. A lesson sentence is prose to be read, not a
     * HUD label to be glanced at, so it tracks the board rather than staying at whatever `body`
     * happens to say — and it never goes below 13 px, because the smallest stage is still a stage
     * somebody has to read from.
     */
    below.style.setProperty(
      '--panel-fs',
      // Floor and ceiling both: 13 px because the smallest stage is still one somebody reads from,
      // and 20 px because a lesson sentence that grows without limit on a projector stops being a
      // caption under a board and becomes the thing the board is under.
      `${Math.min(20, Math.max(13, Math.round(width * 0.022)))}px`,
    );
    below.style.setProperty('--tap', `${22 * ui}px`);
  }

  return { width, height, scaleDevice };
}
