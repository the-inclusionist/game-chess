// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHAT THIS PROVES, AND WHAT IT REPLACES =========================
// The teacher's arrows used to be Zdog shapes on the projected board, and `tests/board.browser
// .test.ts` asserted that each suggestion added four of them and left their paths open. Both
// assertions were TRUE the whole time the Dev was looking at arrows cut in half.
//
// They were true because they asked about the arrow REQUESTED. Zdog is a painter: every shape
// gets one sort value, so a shaft crossing several squares is entirely in front of or entirely
// behind each one, and the squares nearer the camera are painted after it — over the tail. The
// geometry was right, the graph was right, and the picture was wrong.
//
// So these ask about the arrow DRAWN: does the path that exists reach from one square to the
// other, and does it stay there when the board turns. That is a question an overlay can answer
// and a shape inside the painter could not.
import { afterEach, describe, expect, it } from 'vitest';
import { createBoard } from '../app/js/render/board.ts';
import { createZdogStage, type ZdogStage } from '../app/js/render/zdog-stage.ts';
import { createHintOverlay, type HintOverlay } from '../app/js/ui/hint-overlay.ts';
import { squareIndex } from '../app/js/render/board-geometry.ts';
import type { Square } from '../app/js/chess/types.ts';

const sq = (name: string): Square => ({
  x: 'abcdefgh'.indexOf(name[0]!), y: 8 - Number(name[1]),
} as Square);

let stage: ZdogStage | null = null;
let overlay: HintOverlay | null = null;

afterEach(() => {
  overlay?.destroy();
  stage?.destroy();
  stage = null;
  overlay = null;
  document.body.replaceChildren();
});

function build() {
  stage = createZdogStage();
  const board = createBoard(stage.root);
  overlay = createHintOverlay({ doc: document });
  document.body.appendChild(overlay.root);
  return { stage, board, overlay };
}

/** Every point in a drawn path, in the overlay's own pixel space. */
function pointsOf(path: SVGPathElement): { x: number; y: number }[] {
  return [...(path.getAttribute('d') ?? '').matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
}

/** Where the board itself puts a square's centre, in the same space. */
function centreOf(board: ReturnType<typeof createBoard>, stage: ZdogStage, square: Square) {
  const c = board.quads()[squareIndex(square)]!.corners;
  const view = stage.viewport();
  return {
    x: ((c[0].x + c[1].x + c[2].x + c[3].x) / 4) * view.zoom + view.width / 2,
    y: ((c[0].y + c[1].y + c[2].y + c[3].y) / 4) * view.zoom + view.height / 2,
  };
}

describe('[Hints] one path per suggestion, and none without one', () => {
  it('draws a path per move and clears to nothing', () => {
    const { stage: z, board, overlay: o } = build();
    z.render();

    o.setMoves([
      { from: sq('g1'), to: sq('f3'), behind: 0 },
      { from: sq('e2'), to: sq('e4'), behind: 0 },
    ]);
    o.place(board.quads(), z.viewport(), 1);
    expect(o.root.children).toHaveLength(2);

    o.setMoves([]);
    o.place(board.quads(), z.viewport(), 1);
    expect(o.root.children, 'nothing left behind').toHaveLength(0);
  });

  it('is aria-hidden, because the suggestion is already spoken', () => {
    const { overlay: o } = build();
    expect(o.root.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('[Hints] ⚠️ the arrow that is DRAWN reaches from one square to the other', () => {
  /*
   * The question the old tests could not ask. An arrow is inset at both ends on purpose — it
   * starts outside the piece it is about, so the piece stays legible — so the test is not that the
   * path touches the centres, but that it SPANS most of the way between them and points the right
   * way. Half an arrow fails this; so does an arrow drawn somewhere else entirely.
   */
  it('spans the distance between the two squares, less the insets at each end', () => {
    const { stage: z, board, overlay: o } = build();
    z.render();
    o.setMoves([{ from: sq('e2'), to: sq('e4'), behind: 0 }]);
    o.place(board.quads(), z.viewport(), 1);

    const [shaftStart, shaftEnd] = pointsOf(o.root.children[0] as SVGPathElement);
    const from = centreOf(board, z, sq('e2'));
    const to = centreOf(board, z, sq('e4'));
    const full = Math.hypot(to.x - from.x, to.y - from.y);
    const drawn = Math.hypot(shaftEnd.x - shaftStart.x, shaftEnd.y - shaftStart.y);

    // TAIL_INSET 0.34 + HEAD_INSET 0.10 of ONE square, and this arrow is two squares long: the
    // shaft must keep about 78% of the distance. Generous bounds — the point is that it is not a
    // stub and not a line across the whole board.
    expect(drawn / full).toBeGreaterThan(0.6);
    expect(drawn / full).toBeLessThan(0.95);

    // And it starts at the piece's end, not the destination's.
    expect(Math.hypot(shaftStart.x - from.x, shaftStart.y - from.y))
      .toBeLessThan(Math.hypot(shaftStart.x - to.x, shaftStart.y - to.y));
  });

  it('puts the barbs at the DESTINATION end, so the arrow points where the move goes', () => {
    const { stage: z, board, overlay: o } = build();
    z.render();
    o.setMoves([{ from: sq('e2'), to: sq('e4'), behind: 0 }]);
    o.place(board.quads(), z.viewport(), 1);

    // One path carries the shaft and the barbs: M tail L head M wing0 L head L wing1.
    const points = pointsOf(o.root.children[0] as SVGPathElement);
    expect(points, 'shaft and barbs in one path').toHaveLength(5);
    const head = points[1];
    const to = centreOf(board, z, sq('e4'));
    const from = centreOf(board, z, sq('e2'));
    expect(Math.hypot(head.x - to.x, head.y - to.y))
      .toBeLessThan(Math.hypot(head.x - from.x, head.y - from.y));
  });

  it('⚠️ follows the board when the camera turns — it is drawn ON it, not beside it', () => {
    /*
     * The reason the arrows are an overlay rather than a lift: raising Zdog shapes above every
     * square makes them whole and makes them FLOAT, and the parallax offset changes with the
     * camera. An overlay read from the projection cannot drift, and this is what says so.
     */
    const { stage: z, board, overlay: o } = build();
    const move = { from: sq('e2'), to: sq('e4'), behind: 0 };

    for (const [pitch, yaw] of [[-1, 0], [-0.6, 0.8], [-1.2, -1.4]] as const) {
      z.setCamera(pitch, yaw);
      z.render();
      o.setMoves([move]);
      o.place(board.quads(), z.viewport(), 1);

      const points = pointsOf(o.root.children[0] as SVGPathElement);
      const from = centreOf(board, z, sq('e2'));
      const to = centreOf(board, z, sq('e4'));
      const full = Math.hypot(to.x - from.x, to.y - from.y);

      // The shaft's ends stay within a fraction of a square of the two centres, at every angle.
      expect(Math.hypot(points[0].x - from.x, points[0].y - from.y) / full)
        .toBeLessThan(0.3);
      expect(Math.hypot(points[1].x - to.x, points[1].y - to.y) / full)
        .toBeLessThan(0.3);
    }
  });

  it('scales with the upscale factor it is handed, like the labels beside it', () => {
    const { stage: z, board, overlay: o } = build();
    z.render();
    o.setMoves([{ from: sq('e2'), to: sq('e4'), behind: 0 }]);

    o.place(board.quads(), z.viewport(), 1);
    const at1 = pointsOf(o.root.children[0] as SVGPathElement)[0];
    o.place(board.quads(), z.viewport(), 3);
    const at3 = pointsOf(o.root.children[0] as SVGPathElement)[0];

    expect(at3.x).toBeCloseTo(at1.x * 3, 1);
    expect(at3.y).toBeCloseTo(at1.y * 3, 1);
  });
});

describe('[Hints] the distance from the best move is still carried by width and hue', () => {
  it('draws a move further behind thinner than the best one', () => {
    // `render/hint-arrows.ts` ramps the width by how far behind the move scored, and the overlay
    // must keep that: it is the one channel that says these are not all the same idea.
    const { stage: z, board, overlay: o } = build();
    z.render();
    o.setMoves([
      { from: sq('e2'), to: sq('e4'), behind: 0 },
      { from: sq('d2'), to: sq('d4'), behind: 28 },
    ]);
    o.place(board.quads(), z.viewport(), 1);

    const width = (i: number) =>
      Number((o.root.children[i] as SVGPathElement).getAttribute('stroke-width'));
    expect(width(1)).toBeLessThan(width(0));
    expect((o.root.children[0] as SVGPathElement).getAttribute('stroke'))
      .not.toBe((o.root.children[1] as SVGPathElement).getAttribute('stroke'));
  });
});
