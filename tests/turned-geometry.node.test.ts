// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE FIVE HISTORIC PATTERNS =========================
// Hartwig's set is stereometry — a cube per movement — and every other pattern here is a shape
// TURNED ON A LATHE: a stack of circles, plus a carved head for the knight because a horse cannot
// be turned. These are five of those, held to exactly the invariants Hartwig is: a piece fits its
// square, stands on the board, and the six heights read in the order a player expects. A drawing
// that breaks those is not a style, it is a fault.
//
// ⚠️ WHAT THIS FILE USED TO ASSERT WAS WRONG, and wrong in a way that passed. The profiles were
// written from prose — an adjective per pattern — and these tests were written from the same prose,
// so they agreed with each other and with nothing else. They said Sikh finishes in a point and
// Régence stands on the narrowest foot and Selenus crowns every piece; the reference named in
// `render/pieces/turned.ts` says none of those. A test authored from the same guess as the code
// tests the guess.
import { describe, expect, it } from 'vitest';
import {
  MAX_TAPER_SPAN, flatDiameter, pieceFootprint, pieceHeight, restsOnBoard, tooThinToOutline,
  turnedWidth,
} from '../app/js/render/pieces/geometry.ts';
import { STROKE } from '../app/js/render/palette.ts';
import { DEFAULT_DESIGN, PIECE_DESIGNS, pieceDesign } from '../app/js/render/pieces/sets.ts';
import { TILE } from '../app/js/render/resolution.ts';
import type { PieceType } from '../app/js/chess/types.ts';

const ALL: PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k'];
const TURNED = ['s1849', 'regence', 'stgeorge', 'selenus', 'sikh'];

/*
 * Boxes that are the piece's FOOT rather than anything carved on top of it. Only Regence has any:
 * its plinth is square, so it cannot be turned and has to be built from boxes like the knight's
 * head is. Counting carvings without subtracting it would say a Regence pawn is carved.
 */
const PLINTH: Record<string, number> = { regence: 2 };
const carved = (key: string, type: PieceType) =>
  pieceDesign(key).specs[type].boxes.slice(PLINTH[key] ?? 0);

/*
 * ⚠️ HARTWIG ASCENDS IN A DIFFERENT ORDER FROM THE REST, and it is not a liberty. Hartwig's knight
 * is a column of three cubes with a fourth at its foot and his bishop is a cross cut from one cube:
 * the knight is taller BY CONSTRUCTION, and there is no way to make the bishop pass it without
 * abandoning the geometry that is the whole design.
 *
 * Every turned pattern goes the other way, because every real set does: a Staunton bishop stands
 * over its knight by about half a centimetre, and so does a Régence one, and a Selenus one. This
 * file asserted the Hartwig order for all six, which quietly required five historic patterns to be
 * drawn wrong in the one proportion a player checks by eye.
 */
const ORDER: Record<string, PieceType[]> = {
  hartwig: ['p', 'r', 'b', 'n', 'q', 'k'],
};
const TURNED_ORDER: PieceType[] = ['p', 'r', 'n', 'b', 'q', 'k'];

describe('[Designs] every drawing keeps the promises Hartwig makes', () => {
  it('offers Hartwig plus five historic patterns, Hartwig first', () => {
    // ⚠️ The default is and stays Hartwig: it is the set this game is a reimplementation OF, and
    // the only one whose shapes are the movement of the pieces rather than a decoration on them.
    expect(PIECE_DESIGNS.map((d) => d.key))
      .toEqual(['hartwig', 's1849', 'regence', 'stgeorge', 'selenus', 'sikh']);
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

      it('ascends in the order its own construction allows', () => {
        const order = ORDER[design.key] ?? TURNED_ORDER;
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

/*
 * ========================= THE FINIAL IS THE PATTERN =========================
 * What names each of these sets is what stands on top of the king, and in one case that is the
 * whole documented difference between two of them. These are the assertions that would have caught
 * the drawing being wrong, and they are written against the reference rather than against prose.
 */
describe('[Designs] the finial is the pattern', () => {
  const finial = (key: string): number => carved(key, 'k').length;

  it('gives the Staunton king a cross, an upright and a bar', () => {
    const boxes = carved('s1849', 'k');
    expect(boxes.length).toBe(2);
    // One is taller than it is wide and the other is the other way round. That IS a cross.
    expect(boxes[0].h > boxes[0].w).toBe(true);
    expect(boxes[1].w > boxes[1].h).toBe(true);
  });

  it('gives the St George king a BALL and no carving at all', () => {
    /*
     * ⚠️ THIS IS THE WHOLE PATTERN. St George is the English playing set with the cross REPLACED by
     * a ball — the modification the club asked for, and the reason the set has a name of its own.
     * Every version of this drawing before the reference was read gave it a cross, which made it a
     * slightly wider Staunton with a different label.
     */
    expect(finial('stgeorge')).toBe(0);
    const parts = pieceDesign('stgeorge').specs.k.turned ?? [];
    const last = parts.slice(-2);
    expect(last.map((t) => t.shape)).toEqual(['dome', 'dome']);
    expect(last[0].down).toBe(true);
    expect(last[1].down).toBeUndefined();
    // And the queen's bulb is the larger of the two, which is also documented.
    const queen = (pieceDesign('stgeorge').specs.q.turned ?? []).slice(-1)[0];
    expect(queen.d).toBeGreaterThan(last[1].d);
  });

  it('gives the Régence king a crenellated crown and the Sikh king the Khanda', () => {
    // Four blocks round a rim in one case; a blade, its chakram and two kirpans in the other.
    expect(finial('regence')).toBe(4);
    expect(finial('sikh')).toBe(4);
    // The Khanda is not a crown: its blade is the tallest box and it stands on the axis.
    const khanda = carved('sikh', 'k');
    const blade = [...khanda].sort((a, b) => b.h - a.h)[0];
    expect(blade.x ?? 0).toBe(0);
    expect(blade.h).toBeGreaterThan(blade.w * 2);
    // A Régence crenellation stands OFF the axis, which is what makes four of them a ring.
    expect(carved('regence', 'k').every((b) => (b.x ?? 0) !== 0 || (b.z ?? 0) !== 0)).toBe(true);
  });

  it('gives the Selenus king a segmented spire and no carving', () => {
    // Six diminishing discs and a point, which is nearly a third of the piece and the reason a
    // Selenus king is recognisable across a room.
    expect(finial('selenus')).toBe(0);
    const parts = pieceDesign('selenus').specs.k.turned ?? [];
    expect(parts.slice(-1)[0].shape).toBe('cone');
    const spire = parts.slice(-7, -1);
    expect(spire.every((t) => t.shape === 'cylinder')).toBe(true);
    for (let i = 1; i < spire.length; i++) {
      expect(`disc ${i} ${spire[i].d < spire[i - 1].d}`).toBe(`disc ${i} true`);
    }
  });

  it('carves the knight, battlements the rook, and leaves the rest to the lathe', () => {
    for (const key of TURNED) {
      expect(`${key} knight ${carved(key, 'n').length > 0}`).toBe(`${key} knight true`);
      /*
       * ⚠️ FOUR CRENELLATIONS EVERYWHERE EXCEPT SELENUS. They are named in the description of the
       * English and French patterns and they cannot be turned — they are sawn into the cap after
       * the lathe is done with it. The German set does not have them: its rook is a plain banded
       * drum, which is what the photograph shows and what makes it the only parallel-sided section
       * on a Selenus board. Asserting four for all five would have forced a tower onto the one
       * pattern whose rook is not one.
       */
      expect(`${key} rook ${carved(key, 'r').length}`)
        .toBe(`${key} rook ${key === 'selenus' ? 0 : 4}`);
      // Everything else is turned and nothing else is carved.
      for (const type of ['p', 'b', 'q'] as PieceType[]) {
        expect(`${key} ${type} ${carved(key, type).length}`).toBe(`${key} ${type} 0`);
      }
    }
  });
});

describe('[Designs] the proportions are the patterns', () => {
  const foot = (key: string): number => pieceFootprint(pieceDesign(key).specs.k);
  const vertical = (key: string): number =>
    pieceHeight(pieceDesign(key).specs.k) / foot(key);

  it('stands St George on the widest foot, and the two continental sets on the narrowest', () => {
    // St George is bulbous on a broad disc, and it is the widest thing on the page. Regence and
    // Selenus are the light-footed pair: a square plinth and a small flared skirt, both carrying a
    // piece far taller than the foot is wide.
    for (const key of ['s1849', 'regence', 'sikh', 'selenus']) {
      expect(`${key} ${foot('stgeorge') > foot(key)}`).toBe(`${key} true`);
    }
    for (const narrow of ['regence', 'selenus']) {
      for (const broad of ['s1849', 'sikh', 'stgeorge']) {
        expect(`${narrow} < ${broad} ${foot(narrow) < foot(broad)}`)
          .toBe(`${narrow} < ${broad} true`);
      }
    }
  });

  it('makes St George the least vertical of the five', () => {
    // ⚠️ ONLY THIS END OF THE RANKING IS ASSERTED. The other end depends on how a SQUARE foot is
    // measured — Regence occupies 8 by 8 along the axes and reaches 11.3 across its diagonal — and
    // an assertion that flips with the metric is testing the metric. St George is widest and
    // shortest by both.
    for (const key of ['s1849', 'regence', 'sikh', 'selenus']) {
      expect(`${key} ${vertical('stgeorge') < vertical(key)}`).toBe(`${key} true`);
    }
  });

  it('draws Sikh as a Staunton made taller and thinner, piece for piece', () => {
    /*
     * ⚠️ THE ONLY PAIR ON THIS PAGE THAT IS MEANT TO BE CLOSE. "Sikh Empire" does not name a
     * catalogued historic pattern; it names a set carved in Amritsar and sold today, and that set
     * IS a Staunton form — taller, more slender, with the Khanda where the cross goes. Drawing it
     * as something else would be more distinctive and less true.
     */
    for (const type of ALL) {
      const sikh = pieceDesign('sikh').specs[type];
      const staunton = pieceDesign('s1849').specs[type];
      expect(`${type} taller ${pieceHeight(sikh) > pieceHeight(staunton)}`)
        .toBe(`${type} taller true`);
      expect(`${type} thinner ${pieceFootprint(sikh) < pieceFootprint(staunton)}`)
        .toBe(`${type} thinner true`);
    }
  });

  it('stands Régence alone on a square plinth', () => {
    // The one foot on the page that is not a circle, and at twenty pixels a square corner against
    // a square board is the fastest thing on the piece to recognise.
    for (const type of ALL) {
      const plinth = pieceDesign('regence').specs[type].boxes
        .slice(0, 2).filter((b) => (b.y ?? 0) > -2 && b.w > 5 && b.w === b.d);
      expect(`${type} ${plinth.length}`).toBe(`${type} 2`);
    }
    for (const key of ['s1849', 'stgeorge', 'selenus', 'sikh']) {
      const first = (pieceDesign(key).specs.p.turned ?? [])[0];
      expect(`${key} ${first.shape}`).toBe(`${key} taper`);
    }
  });
});

describe('[Designs] Selenus crowns its king and queen, and nobody else', () => {
  // ⚠️ THE PHOTOGRAPH SETTLES THIS. This file used to assert a countable coronet on every Selenus
  // piece — one disc for a pawn, four for a king — and call the count the pattern's identity. The
  // set at the Max Euwe-Centrum has a crown of petals on the king and the queen and nothing on the
  // other four. A prose description that says "tiers resembling crowns" is describing those two.
  const crown = (type: PieceType): number =>
    (pieceDesign('selenus').specs[type].turned ?? [])
      .filter((t) => t.shape === 'taper' && (t.dTop ?? 0) - t.d >= 2.5).length;

  it('opens a cup on the king and the queen', () => {
    expect(crown('k')).toBe(1);
    expect(crown('q')).toBe(1);
  });

  it('leaves the pawn, rook, knight and bishop uncrowned', () => {
    for (const type of ['p', 'r', 'n', 'b'] as PieceType[]) {
      expect(`${type} ${crown(type)}`).toBe(`${type} 0`);
    }
  });

  it('gives the rook the only parallel-sided drum in the set', () => {
    // Nothing else in a Selenus set has a straight section, which is what makes the rook findable
    // at any size — including twenty pixels, where the profile is all there is.
    const drum = (type: PieceType): number =>
      (pieceDesign('selenus').specs[type].turned ?? [])
        .filter((t) => t.shape === 'cylinder' && t.h > 1.5).length;
    expect(drum('r')).toBe(1);
    for (const type of ['p', 'n', 'b', 'q', 'k'] as PieceType[]) {
      expect(`${type} ${drum(type)}`).toBe(`${type} 0`);
    }
  });
});

describe('[Designs] the lathe speaks in frusta', () => {
  it('gives every turned pattern tapers and Hartwig none', () => {
    // ⚠️ THE SHAPE THAT DID NOT EXIST. Before the frustum, a body that narrows from a wide foot to
    // a neck could only be said as a stack of drums, and five patterns authored that way came out
    // as five variations on one shape. Hartwig has none because nothing about him is turned.
    const tapers = (key: string): number => ALL.reduce((n, type) =>
      n + (pieceDesign(key).specs[type].turned ?? []).filter((t) => t.shape === 'taper').length, 0);
    for (const key of TURNED) expect(`${key} ${tapers(key) > 12}`).toBe(`${key} true`);
    expect(tapers('hartwig')).toBe(0);
  });

  it('never opens a taper wider than the flat board can step', () => {
    /*
     * ⚠️ THE ONE PLACE THE TWO RENDERERS DISAGREE. Three builds the true frustum; Zdog has no shape
     * that changes width, so it steps. The step count is capped, so past `MAX_TAPER_SPAN` the steps
     * get coarser rather than more numerous and the flat silhouette drifts from the solid one.
     * This is the budget, asserted against every drawing rather than trusted to authoring care.
     */
    for (const design of PIECE_DESIGNS) {
      for (const type of ALL) {
        for (const part of design.specs[type].turned ?? []) {
          if (part.shape !== 'taper') continue;
          const span = Math.abs(part.d - (part.dTop ?? part.d));
          expect(`${design.key} ${type} ${span <= MAX_TAPER_SPAN}`)
            .toBe(`${design.key} ${type} true`);
        }
      }
    }
  });

  it('stands one cylinder in for a frustum, at its mean', () => {
    // The flat renderer has no frustum, so it draws the middle of one. Both ends are then wrong by
    // an eighth of the span in radius, which `MAX_TAPER_SPAN` keeps under a pixel.
    expect(flatDiameter({ shape: 'taper', d: 8, dTop: 2, h: 3, y: -1.5 })).toBe(5);
    // Everything else already has one diameter and is drawn at it.
    expect(flatDiameter({ shape: 'cylinder', d: 5, h: 2, y: -1 })).toBe(5);
    expect(flatDiameter({ shape: 'cone', d: 5, h: 2, y: -1 })).toBe(5);
    expect(flatDiameter({ shape: 'dome', d: 5, h: 2.5, y: -1.25 })).toBe(5);
    // ...but its FOOTPRINT is its wider end, whichever that is, or a collar quietly overhangs.
    expect(turnedWidth({ shape: 'taper', d: 3, dTop: 7, h: 2, y: -1 })).toBe(7);
    expect(turnedWidth({ shape: 'taper', d: 7, dTop: 3, h: 2, y: -1 })).toBe(7);
    expect(turnedWidth({ shape: 'cylinder', d: 5, h: 2, y: -1 })).toBe(5);
  });

  it('refuses to outline a part shorter than the line that would outline it', () => {
    /*
     * ⚠️ THE FAILURE THIS EXISTS TO STOP, and it was caught on screen rather than here. Zdog
     * centres a stroke on its path, so a turned set's 0.75-unit line covers 0.375 above a part and
     * 0.375 below it. A tier disc 0.4 units tall is shorter than its own outline, and ten of those
     * up a piece turn it into a black-and-white striped cone with its colour pushed out to a rim.
     */
    const line = STROKE * 0.5;
    expect(tooThinToOutline({ shape: 'cylinder', d: 5, h: 0.4, y: -0.2 }, line)).toBe(true);
    expect(tooThinToOutline({ shape: 'cylinder', d: 5, h: 3.0, y: -1.5 }, line)).toBe(false);
    // Hartwig draws at the full line, so the bar he can clear is higher.
    expect(tooThinToOutline({ shape: 'cylinder', d: 5, h: 1.6, y: -0.8 }, STROKE)).toBe(true);
  });

  it('leaves every body thick enough to be outlined', () => {
    // The rule above is for collars and ribs. If it ever caught a piece's BODY the silhouette would
    // start coming apart, so the tallest part of every piece has to clear the line comfortably.
    const line = STROKE * 0.5;
    for (const design of PIECE_DESIGNS) {
      for (const type of ALL) {
        const parts = design.specs[type].turned ?? [];
        if (parts.length === 0) continue;
        const tallest = [...parts].sort((a, b) => b.h - a.h)[0];
        expect(`${design.key} ${type} ${tooThinToOutline(tallest, line)}`)
          .toBe(`${design.key} ${type} false`);
      }
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
    for (const key of TURNED) {
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

describe('[Designs] a dome has no height of its own', () => {
  it('declares every dome at exactly half its diameter', () => {
    // ⚠️ THE INVARIANT THE THREE.JS BUILDER NEEDS AND NOBODY HAD WRITTEN DOWN. Zdog's
    // `Hemisphere` IS half a ball: its height is its radius and there is no way to say otherwise.
    // The table lets a dome carry an `h` of its own, so a value that is not d/2 would draw one
    // way in the flat renderer and another way in the solid one — two pictures of one piece, with
    // nothing failing.
    for (const design of PIECE_DESIGNS) {
      for (const type of ALL) {
        for (const part of design.specs[type].turned ?? []) {
          if (part.shape !== 'dome') continue;
          expect(`${design.key} ${type} ${part.h}`).toBe(`${design.key} ${type} ${part.d / 2}`);
        }
      }
    }
  });
});
