// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THREE RENDERERS DRAW THIS, AND NONE OF THEM CHECKS IT =========================
// `render/hint-arrows.ts` is the one piece of geometry all three boards share: the flat board
// strokes it as SVG, the projected board as Zdog, the solid board as a `THREE.Group`. It has no
// imports at all, which is what lets the flat page use it without loading a renderer — and it had
// no test, which meant the only thing holding its arithmetic up was three views agreeing to look
// equally wrong.
//
// It has since become load-bearing for TEACHING as well: `show.arrows` is the teacher's answer in
// a lesson, and every step of an annotated game carries one. An arrow that points somewhere else
// is a wrong answer given confidently.
//
// ⚠️ THE ASSERTIONS ARE ABOUT SHAPE, NOT ABOUT COORDINATES. Checking that the tail of an e2-e4
// arrow is at some particular number would pin the constants rather than the properties, and would
// have to be rewritten the next time an inset is tuned. What must hold whatever the constants are:
// the arrow lies on the line between the squares, it points from one to the other, it starts
// outside the piece it is talking about, and its barbs are behind the head and symmetric about it.
import { describe, expect, it } from 'vitest';
import { arrowBetween, arrowFor, arrowWidth, type Point } from '../app/js/render/hint-arrows.ts';

const TILE = 10;
const at = (x: number, y: number): Point => ({ x, y });

/** How far a point is from the infinite line through `a` and `b`. Zero means it is on it. */
function offLine(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / Math.hypot(dx, dy);
}

const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * How far along `a`→`b` a point sits, as a fraction: 0 at `a`, 1 at `b`, negative BEHIND `a`.
 *
 * ⚠️ THE SIGN IS THE WHOLE REASON THIS EXISTS. The first version of the test below asked how FAR
 * the tail was from the origin square, which is a distance and has no direction in it — so moving
 * the tail to the wrong side of that square passed every assertion in this file. Found by making
 * that exact change and watching nothing go red.
 */
function along(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
}

describe('[Arrow] it lies on the move it is describing', () => {
  it('⚠️ puts tail and head on the line between the two squares, at every angle', () => {
    /*
     * Swept over the whole board rather than sampled, because the failure this catches is a sign
     * flipped on one axis: an arrow that is right for a rook and mirrored for a bishop looks
     * plausible in a screenshot of one move.
     */
    const from = at(0, 0);
    let checked = 0;
    for (let x = -7; x <= 7; x += 1) {
      for (let y = -7; y <= 7; y += 1) {
        if (x === 0 && y === 0) continue;
        const to = at(x * TILE, y * TILE);
        const arrow = arrowBetween(from, to, TILE)!;
        expect(arrow, `${x},${y}`).not.toBeNull();
        expect(`${x},${y} tail off line: ${offLine(from, to, arrow.tail) < 1e-9}`)
          .toBe(`${x},${y} tail off line: true`);
        expect(`${x},${y} head off line: ${offLine(from, to, arrow.head) < 1e-9}`)
          .toBe(`${x},${y} head off line: true`);
        checked += 1;
      }
    }
    expect(checked).toBe(224);
  });

  it('⚠️ points FROM the origin TO the destination, and not the other way', () => {
    // The one mistake that leaves every other property intact: swap the two ends and the arrow is
    // still on the line, still the right length, still symmetric — and tells the reader to play
    // the move backwards.
    const from = at(0, 0);
    const to = at(4 * TILE, 0);
    const arrow = arrowBetween(from, to, TILE)!;
    expect(arrow.tail.x).toBeLessThan(arrow.head.x);
    expect(dist(from, arrow.tail)).toBeLessThan(dist(from, arrow.head));
    expect(dist(to, arrow.head)).toBeLessThan(dist(to, arrow.tail));
  });

  it('⚠️ starts OUTSIDE the piece it is talking about', () => {
    /*
     * The tail is inset much further than the head, and that is the whole reason the two insets
     * differ: an arrow beginning at the exact centre of its own square is drawn straight through
     * the piece the reader has to identify.
     */
    const from = at(0, 0);
    const to = at(0, 5 * TILE);
    const arrow = arrowBetween(from, to, TILE)!;
    expect(dist(from, arrow.tail)).toBeGreaterThan(dist(to, arrow.head));
    // And it does not overshoot into the far square either.
    expect(dist(from, arrow.tail)).toBeLessThan(TILE / 2);
    expect(dist(to, arrow.head)).toBeLessThan(TILE / 2);
  });

  it('⚠️ keeps BOTH ends between the two squares, on the near side of each', () => {
    /*
     * The assertion above is about distance, and a distance has no direction: moving the tail to
     * the far side of its own square — pointing the arrow out of the back of the piece — leaves
     * every number in it unchanged. Verified by making that change and watching nothing fail.
     *
     * What was meant all along is that the arrow's body lies ON the segment: some way along it
     * from the origin, and not yet at the destination.
     */
    for (const [x, y] of [[5, 0], [0, 5], [-5, 0], [0, -5], [3, 4], [-6, 2]]) {
      const from = at(0, 0);
      const to = at(x * TILE, y * TILE);
      const arrow = arrowBetween(from, to, TILE)!;
      const tail = along(from, to, arrow.tail);
      const head = along(from, to, arrow.head);
      expect(`${x},${y} tail in front: ${tail > 0 && tail < 1}`).toBe(`${x},${y} tail in front: true`);
      expect(`${x},${y} head short: ${head > tail && head < 1}`).toBe(`${x},${y} head short: true`);
    }
  });
});

describe('[Barbs] behind the head, and the same on both sides', () => {
  it('⚠️ places both wings behind the head rather than past it', () => {
    // A barb drawn forward of the head is an arrow with a diamond on the end, which reads as a
    // line with a blob and stops saying which way it goes.
    for (const [x, y] of [[5, 0], [0, 5], [-5, 0], [0, -5], [3, 4], [-3, 4], [3, -4]]) {
      const from = at(0, 0);
      const to = at(x * TILE, y * TILE);
      const arrow = arrowBetween(from, to, TILE)!;
      for (const wing of arrow.wings) {
        expect(`${x},${y}: ${dist(from, wing) < dist(from, arrow.head)}`)
          .toBe(`${x},${y}: true`);
      }
    }
  });

  it('⚠️ makes them mirror images about the shaft', () => {
    // Equal distances from the head AND equal-and-opposite offsets from the line: a barb pair that
    // is merely equidistant could both sit on the same side.
    const from = at(0, 0);
    const to = at(6 * TILE, 2 * TILE);
    const arrow = arrowBetween(from, to, TILE)!;
    const [a, b] = arrow.wings;
    expect(dist(arrow.head, a)).toBeCloseTo(dist(arrow.head, b), 9);
    expect(offLine(from, to, a)).toBeCloseTo(offLine(from, to, b), 9);
    // Opposite sides: the signed areas must differ in sign.
    const side = (p: Point): number =>
      (p.x - from.x) * (to.y - from.y) - (p.y - from.y) * (to.x - from.x);
    expect(Math.sign(side(a))).toBe(-Math.sign(side(b)));
  });
});

describe('[Scale] the maths is scale-free, which is why three renderers can share it', () => {
  it('⚠️ produces the same shape at any tile size', () => {
    /*
     * The flat board works in SVG units, the projected board in Zdog ones and the solid board in
     * world units. If any inset were absolute rather than a fraction of the tile, one of the three
     * would draw a different arrow and the difference would look like a rendering quirk.
     */
    const small = arrowBetween(at(0, 0), at(30, 40), 10)!;
    const big = arrowBetween(at(0, 0), at(300, 400), 100)!;
    expect(big.tail.x).toBeCloseTo(small.tail.x * 10, 9);
    expect(big.tail.y).toBeCloseTo(small.tail.y * 10, 9);
    expect(big.head.x).toBeCloseTo(small.head.x * 10, 9);
    expect(big.wings[0].x).toBeCloseTo(small.wings[0].x * 10, 9);
  });
});

describe('[Degenerate] a move with no direction is a value, not a division by zero', () => {
  it('returns null for a square to itself', () => {
    /*
     * Chess has no such move. A take-back caught mid-animation can still ask for one, and the
     * alternative to null is NaN in every coordinate — which draws nothing and reports nothing.
     */
    expect(arrowBetween(at(5, 5), at(5, 5), TILE)).toBeNull();
    expect(arrowFor(at(5, 5), at(5, 5), TILE, 0)).toBeNull();
  });

  it('and produces no NaN anywhere for a real move', () => {
    const arrow = arrowBetween(at(0, 0), at(TILE, TILE), TILE)!;
    const numbers = [
      arrow.tail.x, arrow.tail.y, arrow.head.x, arrow.head.y,
      ...arrow.wings.flatMap((w) => [w.x, w.y]),
    ];
    expect(numbers.every(Number.isFinite)).toBe(true);
  });
});

describe('[Width] thickness is the channel that survives colour blindness', () => {
  it('⚠️ is widest for the best move and narrows with the gap', () => {
    /*
     * The hue ramps too, and cannot be trusted on its own: a red-to-violet ramp is close to one
     * colour for a deuteranope, and no hue in it clears 3:1 against every square this game draws.
     * Thickness survives greyscale, every kind of colour blindness, and a dim projector (1.4.1).
     */
    const band = 200;
    expect(arrowWidth(0, band)).toBeGreaterThan(arrowWidth(100, band));
    expect(arrowWidth(100, band)).toBeGreaterThan(arrowWidth(200, band));
  });

  it('clamps outside the band rather than running away', () => {
    const band = 200;
    // Past the far edge it stays at the narrowest, and a negative gap is still the best move.
    expect(arrowWidth(1000, band)).toBeCloseTo(arrowWidth(200, band), 9);
    expect(arrowWidth(-50, band)).toBeCloseTo(arrowWidth(0, band), 9);
  });

  it('⚠️ treats a band of zero as "they are all the best", not as a division', () => {
    // Every move equal is a real position — one legal move, or several that score identically —
    // and `behind / 0` would be Infinity in the middle of a width.
    expect(Number.isFinite(arrowWidth(0, 0))).toBe(true);
    expect(Number.isFinite(arrowWidth(50, 0))).toBe(true);
    expect(arrowWidth(50, 0)).toBe(arrowWidth(0, 0));
  });
});
