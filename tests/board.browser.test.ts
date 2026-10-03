// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest';
import { fromAlgebraic } from '../app/js/chess/types.ts';
import { createBoard, markersFor, SQUARE_COUNT } from '../app/js/render/board.ts';
import { squareFromIndex, squareIndex } from '../app/js/render/board-geometry.ts';
import { pickTopmost, quadArea, type Point2, type Quad } from '../app/js/render/picking.ts';
import { CAMERA, createZdogStage, type ZdogStage } from '../app/js/render/zdog-stage.ts';
import { LOGICAL_H, LOGICAL_W } from '../app/js/render/resolution.ts';

// ========================= WHAT THIS PROVES =========================
// The node tests prove the picking ARITHMETIC against fixtures. They cannot prove the claim the
// whole design rests on: that `pathCommands[i].endRenderPoint` really is the projected corner the
// renderer is about to draw. That is undocumented on zzz.dog — read out of the 1.1.3 source — and
// only a real illustration can confirm it. Everything below runs against actual Zdog projection.

const centroid = (q: Quad): Point2 => ({
  x: (q.corners[0].x + q.corners[1].x + q.corners[2].x + q.corners[3].x) / 4,
  y: (q.corners[0].y + q.corners[1].y + q.corners[2].y + q.corners[3].y) / 4,
});

const sq = (name: string) => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

let stage: ZdogStage | null = null;

function build() {
  stage = createZdogStage();
  const board = createBoard(stage.root);
  stage.update();
  return { stage, board };
}

afterEach(() => { stage?.destroy(); stage = null; });

describe('[Stage] the resolution invariant survives a real Illustration', () => {
  it('keeps the logical backing store despite Zdog defaulting pixelRatio to devicePixelRatio', () => {
    const { stage: s } = build();
    expect(s.canvas.width).toBe(LOGICAL_W);
    expect(s.canvas.height).toBe(LOGICAL_H);
  });

  it('reports its viewport for picking', () => {
    const { stage: s } = build();
    expect(s.viewport()).toEqual({ width: LOGICAL_W, height: LOGICAL_H, zoom: CAMERA.zoom });
  });
});

describe('[Projection] the corners picking reads are the ones Zdog draws', () => {
  it('gives every square four corners', () => {
    const { board } = build();
    const quads = board.quads();
    expect(quads).toHaveLength(SQUARE_COUNT);
    for (const q of quads) expect(q.corners).toHaveLength(4);
  });

  it('projects every square to a real area at the default pitch', () => {
    const { board } = build();
    for (const [i, q] of board.quads().entries()) {
      // A 16-unit square seen at −1 rad keeps well over a tenth of its face-on area.
      expect(quadArea(q.corners), `square ${i}`).toBeGreaterThan(20);
    }
  });

  it('gives 64 DISTINCT centres — a collapsed graph would stack them', () => {
    const { board } = build();
    const seen = new Set(board.quads().map((q) => {
      const c = centroid(q);
      return `${c.x.toFixed(3)},${c.y.toFixed(3)}`;
    }));
    expect(seen.size).toBe(SQUARE_COUNT);
  });
});

describe('[Picking] every square hits itself, and only itself', () => {
  // The strongest single assertion in this file. It fails on a wrong corner index, on reversed
  // winding, on a broken depth tie-break, and on any drift between what is projected and what
  // is read — none of which would be visible by looking at the board.
  it('picks square i from the centre of square i, for all 64', () => {
    const { board } = build();
    const quads = board.quads();
    for (let i = 0; i < SQUARE_COUNT; i++) {
      expect(pickTopmost(quads, centroid(quads[i])), `square ${i}`).toBe(i);
    }
  });

  it('still holds after the camera turns', () => {
    const { stage: s, board } = build();
    s.setCamera(-0.6, 0.45);
    s.update();
    const quads = board.quads();
    for (let i = 0; i < SQUARE_COUNT; i++) {
      expect(pickTopmost(quads, centroid(quads[i])), `square ${i}`).toBe(i);
    }
  });

  it('actually reprojects when the camera turns, rather than caching', () => {
    const { stage: s, board } = build();
    const before = centroid(board.quads()[squareIndex(sq('a1'))]);
    s.setCamera(-0.6, 0.9);
    s.update();
    const after = centroid(board.quads()[squareIndex(sq('a1'))]);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(1);
  });

  it('misses everything far off the board', () => {
    const { board } = build();
    expect(pickTopmost(board.quads(), { x: 9999, y: 9999 })).toBeNull();
  });

  it('orients the board so a1 and h8 are on opposite diagonals', () => {
    const { board } = build();
    const quads = board.quads();
    const a1 = centroid(quads[squareIndex(sq('a1'))]);
    const h8 = centroid(quads[squareIndex(sq('h8'))]);
    const a8 = centroid(quads[squareIndex(sq('a8'))]);
    // a1 is near-left, h8 is far-right: opposite in both axes.
    expect(a1.x).toBeLessThan(h8.x);
    expect(a1.y).toBeGreaterThan(h8.y);
    // a8 shares a1's file, so it sits on the same side horizontally.
    expect(Math.abs(a8.x - a1.x)).toBeLessThan(Math.abs(h8.x - a1.x));
  });
});

describe('[Markers] shape carries the meaning, not only colour', () => {
  it('shows nothing by default and clears back to nothing', () => {
    const { stage: s, board } = build();
    // Render FIRST: the baseline is the board with no markers, not a blank canvas.
    s.render();
    const paintedBefore = imageSignature(s);

    board.setMarkers(markersFor([[sq('e4'), 'move'], [sq('e2'), 'selected']]));
    s.render();
    expect(imageSignature(s)).not.toBe(paintedBefore);

    board.clearMarkers();
    s.render();
    expect(imageSignature(s)).toBe(paintedBefore);
  });

  it('accepts a marker on every square without throwing', () => {
    const { stage: s, board } = build();
    const all = new Map<number, 'move'>();
    for (let i = 0; i < SQUARE_COUNT; i++) all.set(i, 'move');
    expect(() => { board.setMarkers(all); s.render(); }).not.toThrow();
  });

  it('ignores an out-of-range index instead of throwing', () => {
    const { board } = build();
    expect(() => board.setMarkers(new Map([[64, 'move'], [-1, 'move']]))).not.toThrow();
  });

  /** Every shape under the board, however deeply nested — which is what Zdog actually sorts. */
  const shapeCount = (board: ReturnType<typeof createBoard>): number => {
    const walk = (node: { children?: unknown[] }): number =>
      1 + (node.children ?? []).reduce<number>((n, c) => n + walk(c as { children?: unknown[] }), 0);
    return walk(board.anchor as unknown as { children?: unknown[] });
  };

  it('draws the lesson mark on demand and leaves nothing behind', () => {
    /*
     * ⚠️ THE SAME BARGAIN THE HINT ARROWS MAKE, and more so. A lesson lights two or three squares
     * at a time; two hidden shapes on all sixty-four would add 128 to a graph Zdog re-flattens and
     * re-sorts every frame, to draw at most six of them.
     *
     * TWO shapes per square, not one: the amber and the black halo behind it. The halo is what
     * satisfies 1.4.11 — no hue clears 3:1 against both the light square and the high-contrast
     * dark grey — so a count of one here would mean the mark had quietly lost its contrast.
     */
    const { board } = build();
    const before = shapeCount(board);

    board.setMarkers(markersFor([[sq('e4'), 'lesson'], [sq('d5'), 'lesson']]));
    expect(shapeCount(board)).toBe(before + 4);

    board.clearMarkers();
    expect(shapeCount(board)).toBe(before);
  });

  it('⚠️ lets a lesson mark and a legal move share a square', () => {
    /*
     * The reason the lesson is a third FORM rather than a third colour. A child picks the taught
     * piece up while the square they were told to look at is still lit, so the two coincide by
     * design — and the marker map holds one kind per square, so the two channels have to be
     * different shapes drawn from different places.
     */
    const { stage: s, board } = build();
    board.setMarkers(markersFor([[sq('e4'), 'lesson']]));
    s.render();
    const lessonOnly = imageSignature(s);

    board.setMarkers(markersFor([[sq('e4'), 'lesson'], [sq('e2'), 'move']]));
    s.render();
    expect(imageSignature(s)).not.toBe(lessonOnly);
  });

  it('draws an arrow per suggested move, and nothing at all without one', () => {
    const { board } = build();
    const before = shapeCount(board);

    board.setHintArrows([{ from: sq('g1'), to: sq('f3'), behind: 0 }, { from: sq('e2'), to: sq('e4'), behind: 0 }]);
    expect(shapeCount(board)).toBe(before + 4);   // a shaft and a pair of barbs, per move

    // ⚠️ Costs NOTHING when no hint is showing. Zdog re-sorts every shape in the graph each
    // frame, so a suggestion that left its geometry behind would be a permanent tax on a
    // drawing nobody asked for.
    board.setHintArrows([]);
    expect(shapeCount(board)).toBe(before);
  });

  it('leaves the arrow open, so it is an arrow and not a triangle', () => {
    // Zdog closes every path it is not told to leave open — the barbs would join into a solid
    // wedge, and the shaft into a line doubled back on itself.
    const { board } = build();
    board.setHintArrows([{ from: sq('g1'), to: sq('f3'), behind: 0 }]);
    const all: { closed?: boolean; path?: unknown[]; children?: unknown[] }[] = [];
    const walk = (node: { children?: unknown[] }): void => {
      for (const child of node.children ?? []) {
        all.push(child as { closed?: boolean; path?: unknown[] });
        walk(child as { children?: unknown[] });
      }
    };
    walk(board.anchor as unknown as { children?: unknown[] });
    // The squares are closed paths too, so count the OPEN ones: exactly the shaft and the barbs.
    const open = all.filter((child) => Array.isArray(child.path) && child.closed === false);
    expect(open).toHaveLength(2);

    board.setHintArrows([]);
    const after: { closed?: boolean; path?: unknown[] }[] = [];
    const walkAgain = (node: { children?: unknown[] }): void => {
      for (const child of node.children ?? []) {
        after.push(child as { closed?: boolean; path?: unknown[] });
        walkAgain(child as { children?: unknown[] });
      }
    };
    walkAgain(board.anchor as unknown as { children?: unknown[] });
    expect(after.filter((c) => c.closed === false)).toHaveLength(0);
  });
});

describe('[Render] the canvas is not blank', () => {
  it('paints the board', () => {
    const { stage: s } = build();
    s.render();
    expect(paintedPixels(s)).toBeGreaterThan(2000);
  });

  it('⚠️ SHIFTS the board rightward by `CAMERA.offsetX` so projected coord labels fit in-stage', () => {
    /*
     * ⚠️ AT -42 ONCE, 0 BRIEFLY, +22 NOW (2026-10-03). The side panel used to sit on top of the
     * canvas's right 27.5%, so the camera was pushed left (-42) to keep the board clear. That
     * went away when the panel became a sibling and the comment here said "centred, offset went
     * away" — but on 2026-10-03 the Dev caught the next consequence: with the panel out of the
     * way the board sat centred, and `.coords`'s projected rank numbers (at `OUTSET = 0.72`
     * squares beyond the slanted left edge) landed PAST the stage's own left clip. Shifting the
     * projection right by 22 world units moves the whole board — and therefore the labels — into
     * the visible stage without touching the renderer's own ratios.
     *
     * This test now says WHICH WAY the offset points instead of asserting it is zero: the LEFT
     * margin is bigger than the RIGHT one, by roughly `offsetX * 2` in canvas pixels (the camera
     * zoom doubles each world unit). A reversion to a centred camera would fail here loudly.
     */
    const { stage: s } = build();
    s.render();
    const ctx = s.canvas.getContext('2d')!;
    const data = ctx.getImageData(0, 0, LOGICAL_W, LOGICAL_H).data;

    // The painted extent, rather than two sample strips: a pitched board does not reach the
    // canvas edges, so sampling near them measures nothing and would pass whatever the offset was.
    let first = LOGICAL_W;
    let last = -1;
    for (let y = 0; y < LOGICAL_H; y++) {
      for (let x = 0; x < LOGICAL_W; x++) {
        if (data[(y * LOGICAL_W + x) * 4 + 3]! === 0) continue;
        if (x < first) first = x;
        if (x > last) last = x;
      }
    }
    expect(last).toBeGreaterThan(first);

    const leftMargin = first;
    const rightMargin = LOGICAL_W - 1 - last;
    expect(leftMargin, 'left margin reserved for rank labels').toBeGreaterThan(rightMargin);
    expect(leftMargin - rightMargin, 'offset carried through to a projected margin')
      .toBeGreaterThanOrEqual(30);
  });
});

/**
 * A cheap content hash of the whole canvas.
 *
 * Counting opaque pixels does NOT work for markers: they are drawn on top of squares that are
 * already opaque, so the count is unchanged while the picture is plainly different. Comparing
 * content catches that; comparing coverage does not.
 */
function imageSignature(s: ZdogStage): string {
  const ctx = s.canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const { data } = ctx.getImageData(0, 0, s.canvas.width, s.canvas.height);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < data.length; i++) {
    h1 = Math.imul(h1 ^ data[i], 0x01000193);
    if ((i & 3) === 0) h2 = Math.imul(h2 + data[i], 0x85ebca6b) ^ i;
  }
  return `${h1 >>> 0}:${h2 >>> 0}`;
}

function paintedPixels(s: ZdogStage): number {
  const ctx = s.canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const { data } = ctx.getImageData(0, 0, s.canvas.width, s.canvas.height);
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
  return n;
}

describe('[Geometry] index order matches how the nodes were built', () => {
  it('starts at a8 and ends at h1', () => {
    expect(squareFromIndex(0)).toEqual(sq('a8'));
    expect(squareFromIndex(SQUARE_COUNT - 1)).toEqual(sq('h1'));
  });
});
