// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import type { PieceType } from '../app/js/chess/types.ts';
import {
  PIECE_SPECS, pieceFootprint, pieceHeight, restsOnBoard,
} from '../app/js/render/pieces/geometry.ts';
import { TILE } from '../app/js/render/resolution.ts';

const ALL: PieceType[] = ['p', 'r', 'n', 'b', 'q', 'k'];

describe('[Fit] every piece stands inside its own square', () => {
  // The prototype overflowed here and neighbouring pieces on the back rank ran into each
  // other. The spike note blamed the bishop and got the arithmetic backwards; the real cause
  // was that every piece was simply too big. See the rotation cases below.
  it.each(ALL)('%s fits within the tile', (type) => {
    expect(pieceFootprint(PIECE_SPECS[type])).toBeLessThan(TILE);
  });

  it('uses the square without crowding its neighbour', () => {
    const widest = Math.max(...ALL.map((t) => pieceFootprint(PIECE_SPECS[t])));
    expect(widest).toBeGreaterThan(TILE * 0.5);
    expect(widest).toBeLessThan(TILE * 0.8);
  });

  it('accounts for rotation — a CUBE turned across the corner reaches past its own side', () => {
    // Worth stating precisely, because the spike 0 note had it backwards. Turning a thin SLAB
    // by 45 degrees makes it NARROWER on the axis ((w·cos + d·sin) < w when d is small); it is
    // a roughly cubic box whose diagonal reaches further. The king's finial is the case.
    const king = PIECE_SPECS.k;
    const widestBox = Math.max(...king.boxes.map((b) => b.w));
    expect(pieceFootprint(king)).toBeGreaterThan(widestBox);
  });

  it('makes a turned slab narrower on the axis, not wider', () => {
    const bishop = PIECE_SPECS.b;
    const slab = bishop.boxes[0];
    expect(pieceFootprint(bishop)).toBeLessThan(slab.w * Math.SQRT2);
  });
});

describe('[Standing] every piece rests on the board, none floats or sinks', () => {
  it.each(ALL)('%s touches the board plane exactly', (type) => {
    expect(restsOnBoard(PIECE_SPECS[type])).toBe(true);
  });
});

describe('[Hierarchy] height reads the same order a player expects', () => {
  it('ascends pawn, rook, bishop, knight, queen, king', () => {
    const order: PieceType[] = ['p', 'r', 'b', 'n', 'q', 'k'];
    const heights = order.map((t) => pieceHeight(PIECE_SPECS[t]));
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i], `${order[i]} vs ${order[i - 1]}`).toBeGreaterThan(heights[i - 1]);
    }
  });

  it('makes the king the tallest piece on the board', () => {
    const tallest = Math.max(...ALL.map((t) => pieceHeight(PIECE_SPECS[t])));
    expect(pieceHeight(PIECE_SPECS.k)).toBe(tallest);
  });

  it('keeps every piece shorter than two squares, so none hides the one behind it', () => {
    for (const t of ALL) expect(pieceHeight(PIECE_SPECS[t])).toBeLessThan(TILE * 1.2);
  });
});

describe('[Hartwig] the shapes are the ones he described, not approximations', () => {
  // "Pawn and rook move at right angles to the edge of the board: expressed by the cube."
  it('makes pawn and rook single cubes', () => {
    for (const t of ['p', 'r'] as const) {
      const spec = PIECE_SPECS[t];
      expect(spec.boxes, t).toHaveLength(1);
      expect(spec.disc, t).toBeUndefined();
      const { w, h, d } = spec.boxes[0];
      expect(w, t).toBe(h);
      expect(h, t).toBe(d);
    }
  });

  it('tells the two cubes apart by half again, not by a hair', () => {
    // Spike 0 had them at 1.31x, which is 4px against 6px on screen. Widened deliberately.
    const ratio = pieceHeight(PIECE_SPECS.r) / pieceHeight(PIECE_SPECS.p);
    expect(ratio).toBeGreaterThanOrEqual(1.5);
  });

  // "The knight moves at right angles in a hook over four squares: four cubes combined at
  //  right angles."
  it('builds the knight from exactly four equal cubes', () => {
    const spec = PIECE_SPECS.n;
    expect(spec.boxes).toHaveLength(4);
    const first = spec.boxes[0];
    for (const b of spec.boxes) {
      expect(b.w).toBe(first.w);
      expect(b.h).toBe(first.h);
      expect(b.d).toBe(first.d);
      expect(b.w).toBe(b.h);
    }
  });

  it('arranges those four as a hook, not a stack or a row', () => {
    const boxes = PIECE_SPECS.n.boxes;
    const xs = new Set(boxes.map((b) => b.x ?? 0));
    const ys = new Set(boxes.map((b) => b.y ?? 0));
    // A hook needs extent in BOTH axes: a column would have one x, a row would have one y.
    expect(xs.size).toBeGreaterThan(1);
    expect(ys.size).toBeGreaterThan(1);
  });

  // "The bishop moves diagonally: a cross cut from the cube."
  it('crosses two slabs at right angles to each other, on the diagonals', () => {
    const boxes = PIECE_SPECS.b.boxes;
    expect(boxes).toHaveLength(2);
    const rotations = boxes.map((b) => b.rotY ?? 0);
    expect(Math.abs(rotations[0] - rotations[1])).toBeCloseTo(Math.PI / 2, 6);
    // Both sit off the board axes, which is what makes the cross read as DIAGONAL movement.
    for (const r of rotations) expect(Math.abs(r) % (Math.PI / 2)).toBeCloseTo(Math.PI / 4, 6);
  });

  // "The king: a smaller cube turned across the corner of a larger one."
  it('turns the king finial across the corner', () => {
    const boxes = PIECE_SPECS.k.boxes;
    expect(boxes).toHaveLength(2);
    const [base, finial] = boxes;
    expect(finial.w).toBeLessThan(base.w);
    expect(Math.abs(finial.rotY ?? 0)).toBeCloseTo(Math.PI / 4, 6);
    expect(base.rotY ?? 0).toBe(0);
  });

  // "A circle on the queen's top, for her versatile movement."
  it('gives the queen the only circle on the board', () => {
    expect(PIECE_SPECS.q.disc).toBeDefined();
    for (const t of ALL) {
      if (t !== 'q') expect(PIECE_SPECS[t].disc, t).toBeUndefined();
    }
  });

  it('puts that circle above the queen, not inside her', () => {
    const spec = PIECE_SPECS.q;
    const disc = spec.disc!;
    const base = spec.boxes[0];
    const baseTop = (base.y ?? 0) - base.h / 2;
    expect(disc.y).toBeLessThan(baseTop);  // Zdog Y points down: smaller is higher
  });
});
