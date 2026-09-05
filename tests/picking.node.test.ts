// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  containsPoint, pickTopmost, quadArea, toIllustrationSpace,
  type Point2, type Quad,
} from '../app/js/render/picking.ts';

/** Corners in the order Zdog's Rect emits them: top-left, top-right, bottom-right, bottom-left. */
const square = (cx: number, cy: number, half: number): Quad['corners'] => ([
  { x: cx - half, y: cy - half },
  { x: cx + half, y: cy - half },
  { x: cx + half, y: cy + half },
  { x: cx - half, y: cy + half },
]);

/** What a board square actually looks like after projection: a sheared parallelogram. */
const parallelogram = (cx: number, cy: number): Quad['corners'] => ([
  { x: cx - 10, y: cy - 4 },
  { x: cx + 6, y: cy - 8 },
  { x: cx + 10, y: cy + 4 },
  { x: cx - 6, y: cy + 8 },
]);

const quad = (corners: Quad['corners'], depth = 0): Quad => ({ corners, depth });

describe('[Hit test] an axis-aligned square', () => {
  const s = square(0, 0, 10);

  it('contains its centre', () => {
    expect(containsPoint(s, { x: 0, y: 0 })).toBe(true);
  });

  it('rejects points outside on every side', () => {
    for (const p of [{ x: 11, y: 0 }, { x: -11, y: 0 }, { x: 0, y: 11 }, { x: 0, y: -11 }]) {
      expect(containsPoint(s, p), JSON.stringify(p)).toBe(false);
    }
  });

  it('counts the boundary as inside — a click on a shared edge must hit something', () => {
    expect(containsPoint(s, { x: 10, y: 0 })).toBe(true);   // edge
    expect(containsPoint(s, { x: 10, y: 10 })).toBe(true);  // corner
  });

  it('rejects a point just past the corner diagonally', () => {
    expect(containsPoint(s, { x: 10.001, y: 10.001 })).toBe(false);
  });
});

describe('[Hit test] a sheared quad, which is what projection actually produces', () => {
  const p = parallelogram(0, 0);

  it('contains its centre', () => {
    expect(containsPoint(p, { x: 0, y: 0 })).toBe(true);
  });

  it('rejects a point inside the bounding box but outside the shape', () => {
    // (-10, -8) sits in the box corner, well clear of the sheared edge.
    expect(containsPoint(p, { x: -10, y: -8 })).toBe(false);
  });

  it('works the same whichever way round the corners are wound', () => {
    const reversed = [...p].reverse() as unknown as Quad['corners'];
    expect(containsPoint(reversed, { x: 0, y: 0 })).toBe(true);
    expect(containsPoint(reversed, { x: -10, y: -8 })).toBe(false);
  });
});

describe('[Degenerate] an edge-on board must not swallow every click', () => {
  // With the camera pitched flat, every square projects to a line. A naive convex test
  // reports "inside" for ANY point, because no cross product is ever non-zero — so the
  // board would answer every click with a square that is not visible.
  const collapsed: Quad['corners'] = [
    { x: -10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: -10, y: 0 },
  ];

  it('reports zero area', () => {
    expect(quadArea(collapsed)).toBeCloseTo(0, 10);
  });

  it('contains nothing', () => {
    expect(containsPoint(collapsed, { x: 0, y: 0 })).toBe(false);
    expect(containsPoint(collapsed, { x: 5, y: 0 })).toBe(false);
  });

  it('measures a real square correctly', () => {
    expect(quadArea(square(0, 0, 10))).toBeCloseTo(400, 6);
  });
});

describe('[Depth] overlapping squares resolve to the nearest', () => {
  // Zdog sorts flatGraph ascending by sortValue and renders in that order, so a HIGHER
  // sortValue is drawn later and is therefore nearer the viewer.
  const quads: Quad[] = [
    quad(square(0, 0, 10), -5),  // far
    quad(square(4, 4, 10), 12),  // near, overlapping
    quad(square(40, 40, 10), 3), // elsewhere
  ];

  it('picks the nearer of two that both contain the point', () => {
    expect(pickTopmost(quads, { x: 2, y: 2 })).toBe(1);
  });

  it('picks the only one that contains the point', () => {
    expect(pickTopmost(quads, { x: -8, y: -8 })).toBe(0);
    expect(pickTopmost(quads, { x: 40, y: 40 })).toBe(2);
  });

  it('returns null when the pointer is off the board', () => {
    expect(pickTopmost(quads, { x: 500, y: 500 })).toBeNull();
  });

  it('returns null for an empty board', () => {
    expect(pickTopmost([], { x: 0, y: 0 })).toBeNull();
  });

  it('ignores degenerate quads even when they would contain the point', () => {
    const withCollapsed: Quad[] = [
      quad(square(0, 0, 10), 0),
      quad([{ x: -50, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 0 }, { x: -50, y: 0 }], 99),
    ];
    expect(pickTopmost(withCollapsed, { x: 0, y: 0 })).toBe(0);
  });
});

describe('[Space] screen pixels to illustration units', () => {
  // Zdog draws with the origin centred and scaled by zoom:
  //   screen = point * (pixelRatio * zoom) + (width/2, height/2) * pixelRatio
  // Picking inverts that once, rather than projecting 64 squares to screen every frame.
  const viewport = { width: 320, height: 180, zoom: 1.15 };

  it('maps the canvas centre to the origin', () => {
    expect(toIllustrationSpace({ x: 160, y: 90 }, viewport)).toEqual({ x: 0, y: 0 });
  });

  it('undoes the zoom', () => {
    const p = toIllustrationSpace({ x: 160 + 11.5, y: 90 - 23 }, viewport);
    expect(p.x).toBeCloseTo(10, 10);
    expect(p.y).toBeCloseTo(-20, 10);
  });

  it('round-trips against the forward transform', () => {
    const original: Point2 = { x: -42, y: 17.5 };
    const screen = {
      x: original.x * viewport.zoom + viewport.width / 2,
      y: original.y * viewport.zoom + viewport.height / 2,
    };
    const back = toIllustrationSpace(screen, viewport);
    expect(back.x).toBeCloseTo(original.x, 10);
    expect(back.y).toBeCloseTo(original.y, 10);
  });
});
