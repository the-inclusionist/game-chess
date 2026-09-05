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
      expect(spec.sphere, t).toBeUndefined();
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
  //
  // Asserted as FOUR CUBES' WORTH OF MATERIAL rather than as four literal boxes. The shape is
  // Hartwig's; the decomposition is a rendering decision, and it changed — four cubes share three
  // internal faces, and coplanar faces tie in a depth sort, which made the hook come apart as the
  // camera turned. Two boxes describe the same solid and touch on one face.
  it('is four cubes of material, in a two-by-three footprint', () => {
    const spec = PIECE_SPECS.n;
    const unit = Math.min(...spec.boxes.map((b) => Math.min(b.w, b.h, b.d)));
    const volume = spec.boxes.reduce((sum, b) => sum + b.w * b.h * b.d, 0);
    expect(volume).toBeCloseTo(4 * unit ** 3, 6);
    expect(pieceFootprint(spec)).toBeCloseTo(2 * unit, 6);
    expect(pieceHeight(spec)).toBeCloseTo(3 * unit, 6);
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
  it('is a cross, and sits off the board axes so the cross reads as DIAGONAL', () => {
    const spec = PIECE_SPECS.b;
    // Every part turned 45° off the axes — that turn is Hartwig's whole reason for the cross.
    for (const b of spec.boxes) {
      expect(Math.abs(b.rotY ?? 0) % (Math.PI / 2)).toBeCloseTo(Math.PI / 4, 6);
    }
    // A cross reaches the same distance both ways: the arms and the slab share a span.
    const spans = spec.boxes.map((b) => Math.max(b.w, b.d));
    expect(Math.max(...spans)).toBeCloseTo(10, 6);
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

  // "A circle on the queen's top, for her versatile movement." — the physical set carries a
  // wooden BALL, and the circle is that ball described in two dimensions.
  it('gives the queen the only ball on the board', () => {
    expect(PIECE_SPECS.q.sphere).toBeDefined();
    for (const t of ALL) {
      if (t !== 'q') expect(PIECE_SPECS[t].sphere, t).toBeUndefined();
    }
  });

  it('puts that ball above the queen, not inside her', () => {
    const spec = PIECE_SPECS.q;
    const sphere = spec.sphere!;
    const base = spec.boxes[0];
    const baseTop = (base.y ?? 0) - base.h / 2;
    expect(sphere.y).toBeLessThan(baseTop);  // Zdog Y points down: smaller is higher
  });

  it('rests the ball ON the cube rather than floating it above', () => {
    const spec = PIECE_SPECS.q;
    const baseTop = (spec.boxes[0].y ?? 0) - spec.boxes[0].h / 2;
    const ballBottom = spec.sphere!.y + spec.sphere!.diameter / 2;
    // Touching, or slightly sunk into the cube — never a gap.
    expect(ballBottom).toBeGreaterThanOrEqual(baseTop - 0.01);
  });
});


describe('[Solidity] no piece contains boxes that pass through each other', () => {
  // The invariant a painter's algorithm needs, and the bug it was written for. Zdog sorts whole
  // FACES by depth: where two boxes interpenetrate, one entire face wins over the other and the
  // piece collapses into something else — the bishop's cross became a notched block, and the
  // effect came and went with the camera angle, which is what makes it so hard to see as a bug.
  //
  // Sampled rather than solved analytically: the boxes carry rotations, and a point test in each
  // box's own frame is exact where a bounding-box test would not be.
  const inside = (b: (typeof PIECE_SPECS)['b']['boxes'][number], p: [number, number, number]) => {
    const t = b.rotY ?? 0;
    const dx = p[0] - (b.x ?? 0);
    const dy = p[1] - (b.y ?? 0);
    const dz = p[2] - (b.z ?? 0);
    // Undo the box's turn about the vertical axis.
    const lx = dx * Math.cos(-t) - dz * Math.sin(-t);
    const lz = dx * Math.sin(-t) + dz * Math.cos(-t);
    const slack = 1e-6;
    return Math.abs(lx) < b.w / 2 - slack
        && Math.abs(dy) < b.h / 2 - slack
        && Math.abs(lz) < b.d / 2 - slack;
  };

  it.each(ALL)('%s is one solid, not overlapping parts', (type) => {
    const boxes = PIECE_SPECS[type].boxes;
    const N = 5;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const t = b.rotY ?? 0;
      for (let ix = 1; ix < N; ix++) {
        for (let iy = 1; iy < N; iy++) {
          for (let iz = 1; iz < N; iz++) {
            const lx = (ix / N - 0.5) * b.w;
            const ly = (iy / N - 0.5) * b.h;
            const lz = (iz / N - 0.5) * b.d;
            const p: [number, number, number] = [
              (b.x ?? 0) + lx * Math.cos(t) - lz * Math.sin(t),
              (b.y ?? 0) + ly,
              (b.z ?? 0) + lx * Math.sin(t) + lz * Math.cos(t),
            ];
            for (let j = 0; j < boxes.length; j++) {
              if (j === i) continue;
              expect(inside(boxes[j], p), `${type}: box ${i} reaches inside box ${j}`).toBe(false);
            }
          }
        }
      }
    }
  });
});
