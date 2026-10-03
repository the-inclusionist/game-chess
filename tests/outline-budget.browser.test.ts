// SPDX-License-Identifier: AGPL-3.0-or-later
import Zdog from 'zdog';
import { afterEach, describe, expect, it } from 'vitest';
import { HIGH_CONTRAST_PALETTE, STROKE } from '../app/js/render/palette.ts';
import { TILE } from '../app/js/render/resolution.ts';
import { createZdogStage, type ZdogStage } from '../app/js/render/zdog-stage.ts';

// ========================= THE QUESTION THIS ANSWERS =========================
// Six more piece sets have been asked for, three of them FIGURATIVE — an archer on a tower, a
// knight on a horse, an elephant. A figurative piece is not one box; it is a dozen or two solids
// stacked and joined. Before drawing six pieces six times, one thing has to be known:
//
//   Zdog outlines EVERY SOLID, and it has no way not to.
//
// The outline in this project is a second Box of identical geometry with `fill: false` and every
// face set to the outline colour, because Zdog's `stroke` is a WIDTH and a shape's `color` paints
// its fill and its stroke alike. That works beautifully for one box. For a piece assembled from
// twenty, it draws twenty outlines — including every seam where two parts meet, which is a line
// the fill does not show, because coplanar faces of one colour merge.
//
// It was already measured on the SIX pieces that exist: stroke against filling runs 0.87 for the
// rook (one compact cube) up to 4.94 for the bishop (three thin boxes, almost all edge). The
// pattern is obvious and it points somewhere: ink is proportional to EDGE LENGTH, and edge length
// grows with part count while volume does not.
//
// So this measures where that ends. It is a budget, and it decides what can be drawn.

let stage: ZdogStage | null = null;
afterEach(() => { stage?.destroy(); stage = null; });

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
];

/** Every pixel the renderer put down, whatever colour it ended up. */
function painted(s: ZdogStage): number {
  const ctx = s.canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const d = ctx.getImageData(0, 0, s.canvas.width, s.canvas.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
  return n;
}

/** Counts pixels near each colour over the whole canvas. */
function inkCount(s: ZdogStage, colours: readonly string[]): number[] {
  const ctx = s.canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const d = ctx.getImageData(0, 0, s.canvas.width, s.canvas.height).data;
  const targets = colours.map(rgb);
  const counts = targets.map(() => 0);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    targets.forEach(([r, g, b], k) => {
      if (Math.abs(d[i] - r) < 18 && Math.abs(d[i + 1] - g) < 18 && Math.abs(d[i + 2] - b) < 18) {
        counts[k]++;
      }
    });
  }
  return counts;
}

const FILL = HIGH_CONTRAST_PALETTE.darkPieces.top;      // #000000
const LINE = HIGH_CONTRAST_PALETTE.darkPieces.stroke;   // #0099FF

/**
 * A piece of `parts` stacked boxes filling the same envelope, so VOLUME is held constant and only
 * the number of internal seams changes. That isolates the one variable that matters.
 */
function stack(parts: number, outlined: boolean): ZdogStage {
  const s = createZdogStage();
  const HEIGHT = 11;
  const WIDTH = TILE * 0.55;
  const anchor = new Zdog.Anchor({ addTo: s.root });
  const slice = HEIGHT / parts;
  for (let i = 0; i < parts; i++) {
    const y = -(i + 0.5) * slice;
    for (const [colour, fill] of [[FILL, true], [LINE, false]] as const) {
      if (!fill && !outlined) continue;
      new Zdog.Box({
        addTo: anchor,
        width: WIDTH, height: slice, depth: WIDTH,
        translate: { y },
        stroke: STROKE,
        fill,
        color: colour,
        topFace: colour, bottomFace: colour, leftFace: colour,
        rightFace: colour, frontFace: colour, rearFace: colour,
      });
    }
  }
  s.render();
  return s;
}

describe('[Budget] how much detail survives its own outline', () => {
  it('saturates: below a slice threshold a feature adds line and no filling at all', () => {
    /*
     * Same envelope every time — identical silhouette, identical volume — so the ONLY variable is
     * how finely it is sliced. The RULE (zoom-independent): once the slice is thin enough, the
     * outline eats everything a thinner slice would add; the fill count stops going down and
     * holds steady at a floor. Past that point further detail is invisible: it costs sort time
     * and draws nothing new.
     *
     * ⚠️ THE EXACT SLICE THRESHOLD DEPENDS ON `CAMERA.zoom` (and therefore on the rendered
     * resolution), so the numbers in the previous version of this comment (floor at 3.7 u, fill
     * 208) stopped being right when zoom dropped from 2.3 to 2.0 on 2026-10-03. The test now
     * ASKS WHERE THE FLOOR IS — the smallest slice value whose fill matches the finest slice —
     * instead of hard-coding a threshold.
     *
     * The structural claim stays: A FEATURE MUST BE ROUGHLY TWO AND A HALF STROKE WIDTHS ACROSS
     * TO SURVIVE ITS OWN OUTLINE, and under 24 % of the piece (at any zoom) the fill stops moving.
     */
    const measured: { slice: number; line: number; fill: number; painted: number }[] = [];
    for (const parts of [1, 2, 3, 4, 6, 8, 16]) {
      stage?.destroy();
      stage = stack(parts, true);
      const [line, fill] = inkCount(stage, [LINE, FILL]);
      measured.push({ slice: 11 / parts, line, fill, painted: painted(stage) });
    }

    // The control: the silhouette is the same shape in every row, so any change is about ink.
    const silhouette = measured[0].painted;
    for (const row of measured) expect(row.painted).toBe(silhouette);

    // The floor, and that it IS a floor. "At floor" = fill matches the FINEST slice; the plateau
    // extends through every slice equal or finer than that. Equality of fill in that tail is
    // what makes it a floor; one coarser slice differing is what makes it a THRESHOLD.
    const coarse = measured.find((m) => m.slice > 10)!;
    const floorFill = measured[measured.length - 1].fill;
    const atFloor = measured.filter((m) => m.fill === floorFill);
    expect(atFloor.length, 'the floor is a plateau, not a single row').toBeGreaterThanOrEqual(2);
    expect(floorFill).toBeLessThan(coarse.fill * 0.7);
    // A quarter of the piece is all the filling that is left, whatever is drawn.
    expect(floorFill / silhouette).toBeLessThan(0.3);
  });

  it('is the SEAMS, not the silhouette — an unoutlined stack is one shape', () => {
    // The same eight-part stack with no outline shows no seam at all: coplanar faces of one colour
    // merge, so the fill draws exactly the silhouette. Every line the outline adds is invented,
    // which is why this is a budget on the OUTLINE and not on the modelling.
    stage = stack(8, false);
    const [line, fill] = inkCount(stage, [LINE, FILL]);
    expect(line).toBe(0);

    stage.destroy();
    stage = stack(1, false);
    const [, oneFill] = inkCount(stage, [LINE, FILL]);
    expect(Math.abs(fill - oneFill)).toBeLessThan(fill * 0.05);
  });
});

describe('[Budget] the turned solids Zdog has shipped all along', () => {
  it('builds a cylinder and a cone, and outlines them the same way a box is outlined', () => {
    // The European patterns are LATHE PROFILES — a stack of turned solids — so whether these two
    // accept the outline trick decides whether those sets can have an outline at all.
    stage = createZdogStage();
    const anchor = new Zdog.Anchor({ addTo: stage.root });
    const common = { addTo: anchor, stroke: STROKE, rotate: { x: Zdog.TAU / 4 } };
    new Zdog.Cylinder({ ...common, diameter: 8, length: 6, translate: { y: -3 }, color: FILL, backface: FILL });
    new Zdog.Cone({ ...common, diameter: 7, length: 5, translate: { y: -8.5 }, color: FILL, backface: FILL });
    new Zdog.Cylinder({
      ...common, diameter: 8, length: 6, translate: { y: -3 },
      color: LINE, backface: LINE, fill: false,
    });
    new Zdog.Cone({
      ...common, diameter: 7, length: 5, translate: { y: -8.5 },
      color: LINE, backface: LINE, fill: false,
    });
    stage.render();

    const [line, fill] = inkCount(stage, [LINE, FILL]);
    // Both inks present: the trick carries over, so a turned piece CAN be outlined.
    expect(fill).toBeGreaterThan(0);
    expect(line).toBeGreaterThan(0);
  });
});
