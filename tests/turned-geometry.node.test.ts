// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE THREE EUROPEAN PATTERNS =========================
// Hartwig's set is stereometry — a cube per movement — and every other European pattern is a shape
// TURNED ON A LATHE: a stack of circles, plus a carved head for the knight because a horse cannot
// be turned. These are three of those, and they are held to exactly the invariants Hartwig is:
// a piece fits its square, stands on the board, and the six heights read in the order a player
// expects. A drawing that breaks those is not a style, it is a fault.
import { describe, expect, it } from 'vitest';
import { pieceFootprint, pieceHeight, restsOnBoard } from '../app/js/render/pieces/geometry.ts';
import { DEFAULT_DESIGN, PIECE_DESIGNS, pieceDesign } from '../app/js/render/pieces/sets.ts';
import { TILE } from '../app/js/render/resolution.ts';
import type { PieceType } from '../app/js/chess/types.ts';

const ALL: PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k'];

describe('[Designs] every drawing keeps the promises Hartwig makes', () => {
  it('offers Hartwig plus the three European patterns, Hartwig first', () => {
    // ⚠️ The default is and stays Hartwig: it is the set this game is a reimplementation OF, and
    // the only one whose shapes are the movement of the pieces rather than a decoration on them.
    expect(PIECE_DESIGNS.map((d) => d.key)).toEqual(['hartwig', 's1849', 'regence', 'stgeorge']);
    expect(DEFAULT_DESIGN).toBe('hartwig');
  });

  it('falls back to Hartwig for a key that no longer exists', () => {
    // A saved setting outlives the design it names.
    expect(pieceDesign('a-design-nobody-wrote').key).toBe('hartwig');
  });

  for (const design of PIECE_DESIGNS) {
    describe(design.key, () => {
      it('uses the square without crowding its neighbour', () => {
        for (const type of ALL) {
          const width = pieceFootprint(design.specs[type]);
          expect(`${type} ${width < TILE}`).toBe(`${type} true`);
          // And is not so small that it rattles about in the middle of it.
          expect(`${type} ${width > TILE * 0.15}`).toBe(`${type} true`);
        }
      });

      it('stands ON the board, not above or below it', () => {
        // A piece that floats does not read as an error, only as a slightly wrong drawing.
        for (const type of ALL) {
          expect(`${type} ${restsOnBoard(design.specs[type])}`).toBe(`${type} true`);
        }
      });

      it('ascends pawn, rook, bishop, knight, queen, king', () => {
        const order: PieceType[] = ['p', 'r', 'b', 'n', 'q', 'k'];
        const heights = order.map((t) => pieceHeight(design.specs[t]));
        for (let i = 1; i < heights.length; i++) {
          expect(`${order[i]} ${heights[i] > heights[i - 1]}`).toBe(`${order[i]} true`);
        }
      });

      it('keeps every piece shorter than two squares, so none hides the one behind it', () => {
        for (const type of ALL) {
          const tall = pieceHeight(design.specs[type]);
          expect(`${type} ${tall < TILE * 1.2}`).toBe(`${type} true`);
        }
      });
    });
  }
});

describe('[Designs] the three differ where a player can actually see it', () => {
  // ⚠️ THE BOARD IS 232 LOGICAL PIXELS WIDE. A square is 29 and a piece stands about 20 pixels
  // tall — a mitre slit is not a pixel. What survives at that size is the SILHOUETTE, so that is
  // what these three are authored to differ in, and this is where the difference is asserted
  // rather than asserted in prose.
  const foot = (key: string, type: PieceType): number => {
    const spec = pieceDesign(key).specs[type];
    return Math.max(...(spec.turned ?? []).map((t) => t.d), 0);
  };

  it('gives 1849 the broadest foot and Régence the narrowest', () => {
    expect(foot('s1849', 'k')).toBeGreaterThan(foot('regence', 'k'));
    expect(foot('stgeorge', 'k')).toBeGreaterThan(foot('s1849', 'k'));
  });

  it('makes Régence the thinnest in the middle', () => {
    // The neck is the narrowest turned part above the base, and it is what makes that pattern
    // read as a line rather than as a body.
    const waist = (key: string): number => {
      const parts = pieceDesign(key).specs.q.turned ?? [];
      return Math.min(...parts.slice(2).map((t) => t.d));
    };
    expect(waist('regence')).toBeLessThan(waist('s1849'));
    expect(waist('regence')).toBeLessThan(waist('stgeorge'));
  });

  it('gives every European knight a carved head and every other piece none', () => {
    // The one thing on a lathe-turned board that is not turned.
    for (const key of ['s1849', 'regence', 'stgeorge']) {
      const specs = pieceDesign(key).specs;
      expect(`${key} ${specs.n.boxes.length > 0}`).toBe(`${key} true`);
      for (const type of ['p', 'r', 'b', 'q'] as PieceType[]) {
        expect(`${key} ${type} ${specs[type].boxes.length}`).toBe(`${key} ${type} 0`);
      }
      // The king keeps a cross, which is two little boxes and not a carving.
      expect(`${key} ${specs.k.boxes.length}`).toBe(`${key} 2`);
    }
  });
});

describe('[Designs] how much line each drawing gets', () => {
  it('gives Hartwig the full line and every turned pattern half of it', () => {
    // ⚠️ A Hartwig piece is between one and four flat faces at this size, and the line is what
    // makes each face an EDGE rather than a change of shade: it is the drawing. A turned piece is
    // a stack of six to nine circles, so the same line is drawn six to nine times over a shape
    // barely twenty pixels tall, and the piece silts up into a dark blob with its colour pushed
    // out to a rim.
    expect(pieceDesign('hartwig').line).toBe(1);
    for (const key of ['s1849', 'regence', 'stgeorge']) {
      expect(`${key} ${pieceDesign(key).line}`).toBe(`${key} 0.5`);
    }
  });

  it('never lets a line fall below where it stops being an edge', () => {
    // Zdog centres a stroke on its path, so a filled shape already reaches stroke/2 past its own
    // surface. Below half, an outline sits ENTIRELY inside the silhouette and draws nothing —
    // which is why the solid's stroke is scaled with the outline rather than apart from it.
    for (const design of PIECE_DESIGNS) {
      expect(`${design.key} ${design.line >= 0.5}`).toBe(`${design.key} true`);
    }
  });
});
