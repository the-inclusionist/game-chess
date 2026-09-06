// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest';
import type { Piece, PieceType } from '../app/js/chess/types.ts';
import { DARK_OUTLINE_SCALE, HIGH_CONTRAST_PALETTE, LIGHT_PIECES, STROKE } from '../app/js/render/palette.ts';
import { buildPiece, createPiecesLayer } from '../app/js/render/pieces/index.ts';
import { PIECE_SPECS } from '../app/js/render/pieces/geometry.ts';
import { pieceDesign } from '../app/js/render/pieces/sets.ts';
import { CAMERA, createZdogStage, type ZdogStage } from '../app/js/render/zdog-stage.ts';
import { LOGICAL_H, LOGICAL_W } from '../app/js/render/resolution.ts';

/** Where the board's origin lands on the canvas: centre, shifted by the camera offset. */
const ORIGIN_X = Math.round(LOGICAL_W / 2 + CAMERA.offsetX * CAMERA.zoom);
const ORIGIN_Y = Math.round(LOGICAL_H / 2);

let stage: ZdogStage | null = null;
afterEach(() => { stage?.destroy(); stage = null; });

const ALL: PieceType[] = ['p', 'r', 'n', 'b', 'q', 'k'];
const white = (type: PieceType): Piece => ({ type, side: 'w' });

function pixels(s: ZdogStage): Uint8ClampedArray {
  const ctx = s.canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  return ctx.getImageData(0, 0, s.canvas.width, s.canvas.height).data;
}

function paintedCount(s: ZdogStage): number {
  const d = pixels(s);
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
}

function pixelAt(s: ZdogStage, x: number, y: number): [number, number, number, number] {
  const ctx = s.canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
}

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
];

describe('[Queen] a ball, not a sticker', () => {
  // She was a flat disc: a single-point Shape with a large stroke, which draws a filled circle
  // that always faces the camera. It was cheap and it read as a sticker — a circle painted on the
  // piece rather than an object sitting on it. Two Hemispheres, apex up and apex down, make a
  // ball; Zdog gives Hemisphere its own sort value so the pair behaves as one solid.
  it('fills its centre with a face colour rather than the outline', () => {
    stage = createZdogStage();
    // Only the ball: no boxes, so nothing else can be under the sample point.
    buildPiece(stage.root, { boxes: [], sphere: { diameter: 60, y: 0 } }, LIGHT_PIECES);
    stage.render();

    const [r, g, b, a] = pixelAt(stage, ORIGIN_X, ORIGIN_Y);
    expect(a).toBe(255);
    expect([r, g, b]).not.toEqual(rgb(LIGHT_PIECES.stroke));
  });

  it('is SHADED — a column through it crosses more than one fill', () => {
    // Written first with two magic sample points, which both landed in the LIT half: looking down
    // at 57 degrees the top hemisphere covers most of the silhouette and the shadow is a thin
    // crescent along the bottom. Scanning the whole column says what the test means to say —
    // "this ball is not one flat colour" — without depending on where the terminator falls.
    stage = createZdogStage();
    buildPiece(stage.root, { boxes: [], sphere: { diameter: 60, y: 0 } }, LIGHT_PIECES);
    stage.render();

    const outline = rgb(LIGHT_PIECES.stroke).join(',');
    const fills = new Set<string>();
    for (let dy = -80; dy <= 80; dy++) {
      const [r, g, b, a] = pixelAt(stage, ORIGIN_X, ORIGIN_Y + dy);
      if (a < 255) continue;
      const key = [r, g, b].join(',');
      if (key !== outline) fills.add(key);
    }
    // Antialiasing contributes blends, so require the two PALETTE colours specifically.
    expect(fills.has(rgb(LIGHT_PIECES.top).join(','))).toBe(true);
    expect(fills.has(rgb(LIGHT_PIECES.side).join(',')) || fills.has(rgb(LIGHT_PIECES.face).join(',')))
      .toBe(true);
  });

  it('reads against its background by its FILL, because there is no outline', () => {
    // Written first as "is outlined", and it failed — which is how the absence was found. Zdog's
    // `setFace` gives each face `color = <that face's colour>`, and `Shape` uses `color` for the
    // stroke as well as the fill. There is no separate stroke colour anywhere in Zdog, so the
    // `stroke:` we pass a Box is only a WIDTH: every face is outlined in its own colour, which
    // means it is not outlined at all. Measured on a full board: 65 pixels out of 76,495 carry
    // either stroke colour, and those are antialiasing coincidences.
    //
    // What actually gives a piece its form is the SHADING between faces, which is why widening it
    // from 1.18 to 1.72 mattered so much more than it looked like it should.
    stage = createZdogStage();
    buildPiece(stage.root, { boxes: [], sphere: { diameter: 60, y: 0 } }, LIGHT_PIECES);
    stage.render();

    const centro = pixelAt(stage, ORIGIN_X, ORIGIN_Y);
    const fora = pixelAt(stage, ORIGIN_X + 120, ORIGIN_Y);
    expect(centro[3]).toBe(255);
    expect(fora[3]).toBe(0);
  });
});

describe('[Silhouettes] the six pieces are told apart by shape', () => {
  // Hartwig's whole premise, asserted: the pieces differ by FORM. If two of them painted the
  // same number of pixels from the same viewpoint they would be reading as the same silhouette,
  // which at 14 px tall is the only channel a sighted player has.
  it('paints a different amount of ink for each piece', () => {
    const counts = new Map<PieceType, number>();
    for (const type of ALL) {
      stage?.destroy();
      stage = createZdogStage();
      buildPiece(stage.root, PIECE_SPECS[type], LIGHT_PIECES);
      stage.render();
      counts.set(type, paintedCount(stage));
    }
    const values = [...counts.values()];
    expect(new Set(values).size, JSON.stringify([...counts])).toBe(ALL.length);
  });

  it('draws every piece — none comes out empty', () => {
    for (const type of ALL) {
      stage?.destroy();
      stage = createZdogStage();
      buildPiece(stage.root, PIECE_SPECS[type], LIGHT_PIECES);
      stage.render();
      expect(paintedCount(stage), type).toBeGreaterThan(60);
    }
  });
});

describe('[Layer] the position replaces, it does not accumulate', () => {
  it('reports what it placed', () => {
    stage = createZdogStage();
    const layer = createPiecesLayer(stage.root);
    layer.setPosition([
      { piece: white('k'), square: { x: 4, y: 7 } },
      { piece: white('q'), square: { x: 3, y: 7 } },
    ]);
    expect(layer.count()).toBe(2);
  });

  it('drops the old pieces instead of stacking new ones on top', () => {
    stage = createZdogStage();
    const layer = createPiecesLayer(stage.root);

    layer.setPosition([{ piece: white('r'), square: { x: 0, y: 7 } }]);
    stage.render();
    const one = paintedCount(stage);

    // Same single piece, set twice. Accumulating would leave two rooks in the same place and
    // paint no more ink — so the count is taken against a DIFFERENT position as well.
    layer.setPosition([{ piece: white('r'), square: { x: 0, y: 7 } }]);
    stage.render();
    expect(paintedCount(stage)).toBe(one);
    expect(layer.count()).toBe(1);

    layer.setPosition([]);
    stage.render();
    expect(paintedCount(stage)).toBe(0);
    expect(layer.count()).toBe(0);
  });

  it('places a full set without throwing', () => {
    stage = createZdogStage();
    const layer = createPiecesLayer(stage.root);
    const all = ALL.flatMap((type, i) => ([
      { piece: { type, side: 'w' as const }, square: { x: i, y: 7 } },
      { piece: { type, side: 'b' as const }, square: { x: i, y: 0 } },
    ]));
    expect(() => { layer.setPosition(all); stage!.render(); }).not.toThrow();
    expect(layer.count()).toBe(12);
    expect(paintedCount(stage)).toBeGreaterThan(500);
  });
});

describe('[Queen] the ball holds up near and far, alone and in a crowd', () => {
  // These began as a hunt for a defect that turned out not to exist. On screen at 2x, an 8.6 px
  // disc with a 1 px rim read as a RING, and the misreading survived two plausible theories
  // (unstable sort, occlusion by a neighbour) before either was measured. Both cases below pass.
  // They are kept because the disc is the only piece feature drawn from stacked shapes, so it is
  // the only one where a sort-order change would actually break something — and because the rim
  // proportion WAS wrong, which is what the eye had really caught.
  const topPixels = (s: ZdogStage): number => {
    const [tr, tg, tb] = rgb(LIGHT_PIECES.top);
    const d = pixels(s);
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] === tr && d[i + 1] === tg && d[i + 2] === tb) n++;
    }
    return n;
  };

  /** Where the queen's inner disc lands on the canvas, read from Zdog's own projection. */
  const discPixel = (layer: ReturnType<typeof createPiecesLayer>, s: ZdogStage) => {
    s.update();
    const holder = layer.anchor.children[0];
    const piece = holder.children[0];
    const inner = piece.children[piece.children.length - 1] as unknown as
      { pathCommands: { endRenderPoint: { x: number; y: number } }[] };
    const p = inner.pathCommands[0].endRenderPoint;
    const v = s.viewport();
    return { x: Math.round(p.x * v.zoom + v.width / 2), y: Math.round(p.y * v.zoom + v.height / 2) };
  };

  it('fills the ball with the lit colour in a FULL position, near rank included', () => {
    // The lone-queen case below already passes, so if this one fails the cause is interaction
    // with the neighbouring pieces rather than the disc itself.
    stage = createZdogStage();
    const solo = createPiecesLayer(stage.root, undefined, false);
    solo.setPosition([{ piece: white('q'), square: { x: 3, y: 7 } }]);
    const at = discPixel(solo, stage);

    stage.destroy();
    stage = createZdogStage();
    // No outline: this test is about the ball's FILL, and the outline draws the equator ellipse
    // straight through the sample point. Isolating the thing under test beats moving the probe.
    const full = createPiecesLayer(stage.root, undefined, false);
    const back: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    full.setPosition([
      ...back.map((type, x) => ({ piece: { type, side: 'w' as const }, square: { x, y: 7 } })),
      ...Array.from({ length: 8 }, (_, x) => ({ piece: white('p'), square: { x, y: 6 } })),
    ]);
    stage.render();

    expect(pixelAt(stage, at.x, at.y).slice(0, 3)).toEqual(rgb(LIGHT_PIECES.top));
  });

  it('paints the same amount of face colour whether near or far', () => {
    stage = createZdogStage();
    let layer = createPiecesLayer(stage.root);
    layer.setPosition([{ piece: white('q'), square: { x: 3, y: 0 } }]);   // far rank
    stage.render();
    const far = topPixels(stage);

    stage.destroy();
    stage = createZdogStage();
    layer = createPiecesLayer(stage.root);
    layer.setPosition([{ piece: white('q'), square: { x: 3, y: 7 } }]);   // near rank
    stage.render();
    const near = topPixels(stage);

    // A RELATIVE tolerance, not an absolute one. The first version allowed a single pixel,
    // which was calibrated to one stroke width and broke the moment the stroke changed — a
    // test measuring the wrong thing. What matters is that neither position loses the disc:
    // the defect this guards against (the outline sorting in FRONT of the face) would leave
    // one side near zero, not 10 % adrift from sub-pixel placement of an antialiased rim.
    const desvio = Math.abs(near - far) / Math.max(near, far);
    expect(desvio, `near ${near} vs far ${far}`).toBeLessThan(0.2);
    expect(Math.min(near, far)).toBeGreaterThan(25);
  });
});


// ========================= WHOSE PIECE IS THAT, COUNTED =========================
// High contrast used to draw the dark side as black filling under a WHITE outline, and it was
// reported as making things worse rather than better. Counting settled it: 4,439 white pixels
// against 2,527 of filling, 1.76 to one. The stroke is 1.5 Zdog units and a bishop's arm is 3.3
// wide, so the outline is not a line around the piece at this scale — it is most of the piece.
//
// Which means the rule is not "pick a nice outline colour". It is that the ink which COVERS a
// piece has to be the ink that NAMES it, and the only way to know which one covers is to count.

describe('[Ink] the colour that covers a piece is the colour that names it', () => {
  const rgbOf = (hex: string): [number, number, number] => rgb(hex);

  /** Counts pixels close to each of the named colours, over the whole rendered canvas. */
  function inkCount(s: ZdogStage, colours: readonly string[]): number[] {
    const d = pixels(s);
    const targets = colours.map(rgbOf);
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

  function render(type: PieceType, side: 'lightPieces' | 'darkPieces'): ZdogStage {
    const s = createZdogStage();
    const colours = HIGH_CONTRAST_PALETTE[side];
    buildPiece(s.root, PIECE_SPECS[type], colours, { outline: colours.stroke });
    s.render();
    return s;
  }

  it('draws a dark bishop mostly in ITS OWN blue, not in a foreign ink', () => {
    stage = render('b', 'darkPieces');
    const dark = HIGH_CONTRAST_PALETTE.darkPieces;
    const [blue, filling, white] = inkCount(stage, [dark.stroke, dark.top, '#FFFFFF']);
    // The complaint, stated as an assertion: the bishop must not carry more of a light foreign
    // ink than of its own colours.
    expect(white).toBe(0);
    // And the ink that covers it is the one that says which side it is.
    expect(blue).toBeGreaterThan(filling);
  });

  it('covers the light side in its own black outline, which is the printed convention', () => {
    stage = render('b', 'lightPieces');
    const light = HIGH_CONTRAST_PALETTE.lightPieces;
    const [stroke, filling] = inkCount(stage, [light.stroke, light.top]);
    expect(stroke).toBeGreaterThan(0);
    expect(filling).toBeGreaterThan(0);
  });

  it('measures the stroke against the filling, piece by piece', () => {
    // Counted at the board's own scale, dark side, high contrast — stroke : filling.
    //
    //   pawn   222 :  99   2.24        bishop 469 :  95   4.94   <- the extreme
    //   rook   297 : 340   0.87        queen  360 : 203   1.77
    //   knight 310 : 144   2.15        king   475 : 362   1.31
    //
    // Five of the six are stroke first, and the ROOK is the exception — one 9-unit cube, the most
    // compact body in the set, is the only shape with enough face to out-cover its own edges. The
    // bishop is the extreme at nearly five to one, which is why it was the piece the outline
    // colour was noticed on: three thin boxes are almost all edge.
    const ratios = new Map<PieceType, number>();
    for (const type of ALL) {
      stage?.destroy();
      stage = render(type, 'darkPieces');
      const dark = HIGH_CONTRAST_PALETTE.darkPieces;
      const [stroke, filling] = inkCount(stage, [dark.stroke, dark.top]);
      ratios.set(type, stroke / filling);
    }

    const strokeFirst = [...ratios.values()].filter((r) => r > 1).length;
    expect(strokeFirst).toBe(5);
    expect(ratios.get('r')).toBeLessThan(1);
    // The bishop is the worst case, and by a wide margin. If a change to STROKE or to the cross
    // ever moves that, the reasoning in palette.ts needs re-reading rather than trusting.
    expect(ratios.get('b')).toBeGreaterThan(3);
    expect(Math.max(...ratios.values())).toBe(ratios.get('b'));
  });
});

// ========================= THE DARK SIDE GETS HALF THE LINE =========================
// An intuition, tried and then measured. The reasoning: a light piece outlined dark reads as a
// light piece with lines on it, because the eye takes the bright interior for the object — but a
// dark piece outlined dark has nothing separating the line from the mass, so the outline only
// thickens it. The two sides may not need the same amount of line.
//
// ⚠️ AND HALVING THE WIDTH DOES NOT HALVE THE INK. It cuts it by about six. Line against filling
// on the dark side, at full width and at half:
//
//   piece    1.50u   0.75u        piece    1.50u   0.75u
//   pawn      1.83    0.29        bishop    5.70    0.91
//   rook      0.88    0.22        queen     1.84    0.33
//   knight    2.12    0.37        king      1.55    0.41
//
// The reason is geometric: Zdog centres a stroke on its path, so a FILL box already reaches
// STROKE/2 = 0.75 units past its faces. A 1.5-wide outline spends 0.75 of itself covering exactly
// that overhang and 0.75 eating into the face. A 0.75-wide one reaches only 0.375 out — no longer
// to the silhouette's edge — and 0.375 in. It loses ink at both ends at once, and the filling wins
// back everything it gives up. So the change is not "a thinner line"; it inverts which ink
// dominates the piece, which is exactly what the ink counts said governs how a piece reads.

describe('[Outline] the two sides are not given the same weight', () => {
  it('draws the two sides with the SAME amount of line, from one board', () => {
    // Through the LAYER, which is where the per-side decision is made — building a piece by hand
    // would test the parameter and not the rule that uses it.
    stage = createZdogStage();
    const pieces = createPiecesLayer(stage.root, HIGH_CONTRAST_PALETTE);
    pieces.setPosition([
      { piece: { type: 'b', side: 'w' }, square: { x: 2, y: 7 } },
      { piece: { type: 'b', side: 'b' }, square: { x: 5, y: 0 } },
    ]);
    stage.render();

    const light = HIGH_CONTRAST_PALETTE.lightPieces;
    const dark = HIGH_CONTRAST_PALETTE.darkPieces;
    const d = stage.canvas.getContext('2d')!
      .getImageData(0, 0, stage.canvas.width, stage.canvas.height).data;
    const count = (hex: string): number => {
      const [r, g, b] = rgb(hex);
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        if (Math.abs(d[i] - r) < 18 && Math.abs(d[i + 1] - g) < 18 && Math.abs(d[i + 2] - b) < 18) n++;
      }
      return n;
    };

    // ⚠️ THE DARK SIDE USED TO GET HALF THE LINE, and this test used to assert exactly that. The
    // argument for halving was about a dark piece outlined in a LIGHT ink, where more outline
    // only thickens an already dark mass. These palettes no longer do that: the projected stroke
    // has to clear 3:1 against both squares, which only a near-black can, so a dark piece is now
    // black-outlined over a lifted filling — where the outline is DRAWING and half of it is half
    // a drawing. Same piece, same size, same amount of line on both sides.
    const lightRatio = count(light.stroke) / count(light.top);
    const darkRatio = count(dark.stroke) / count(dark.top);
    expect(lightRatio).toBeGreaterThan(2);
    expect(darkRatio / lightRatio).toBeGreaterThan(0.8);
    expect(darkRatio / lightRatio).toBeLessThan(1.25);
  });

  it('still turns on the outline width, which is what the constant is for', () => {
    const dark = HIGH_CONTRAST_PALETTE.darkPieces;
    const ratio = (width: number): number => {
      stage?.destroy();
      stage = createZdogStage();
      buildPiece(stage.root, PIECE_SPECS.b, dark, { outline: dark.stroke, outlineWidth: width });
      stage.render();
      const d = stage.canvas.getContext('2d')!
        .getImageData(0, 0, stage.canvas.width, stage.canvas.height).data;
      const near = (i: number, hex: string): boolean => {
        const [r, g, b] = rgb(hex);
        return Math.abs(d[i] - r) < 18 && Math.abs(d[i + 1] - g) < 18 && Math.abs(d[i + 2] - b) < 18;
      };
      let line = 0;
      let fill = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        if (near(i, dark.stroke)) line++;
        else if (near(i, dark.top)) fill++;
      }
      return line / Math.max(1, fill);
    };

    // ⚠️ Measured through the BUILDER rather than through the constant, so the test still says
    // something once the constant is 1: halving the width really does hand the piece back to its
    // filling, which is the fact that made halving worth trying and the fact that made undoing it
    // a visible change rather than a tidy-up.
    const full = ratio(STROKE);
    const half = ratio(STROKE / 2);
    expect(full).toBeGreaterThan(2);
    expect(half).toBeLessThan(1);
    expect(full / half).toBeGreaterThan(4);
    // And the shipped value is the full one: both sides draw the same line.
    expect(DARK_OUTLINE_SCALE).toBe(1);
  });

  it('leaves a piece with an outline at all — the floor is STROKE/2', () => {
    // Zdog centres a stroke, so a fill box already reaches STROKE/2 past its faces. Below that an
    // outline is entirely inside the silhouette and stops being an edge. The scale is 1 now and
    // this is nowhere near the floor, which is exactly the point of keeping the check.
    expect(STROKE * DARK_OUTLINE_SCALE).toBeGreaterThanOrEqual(STROKE / 2);
  });
});

// ========================= A TURNED PIECE IS MOSTLY ITSELF =========================
// ⚠️ THE REGRESSION THIS EXISTS TO CATCH, and it stood in the repository for weeks behind a comment
// saying it had been fixed. `CylinderGroup.renderCylinderSurface` in zdog 1.1.3 reads
//
//     renderer.stroke( ctx, elem, true, this.color, strokeWidth );
//
// with `true` as a LITERAL: a cylinder's wall is one fat line painted at the full diameter in
// `this.color`, and `fill: false` never reaches it. So the "outline" copy of every drum was an
// opaque bar of ink laid over the piece, and a pattern with ten turned parts came out as a striped
// cone with its colour pushed out to a rim. The outline is a larger copy drawn BEHIND now — see
// `render/pieces/index.ts` — and this is the assertion that says so in pixels rather than in prose.
describe('[Ink] a turned piece is mostly itself, not mostly its own outline', () => {
  const rgbOf = (hex: string): [number, number, number] => rgb(hex);

  function inkCount(s: ZdogStage, colours: readonly string[]): number[] {
    const d = pixels(s);
    const targets = colours.map(rgbOf);
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

  it('covers every piece of every turned pattern in its own filling', () => {
    /*
     * Line against filling, dark side, high contrast. Twenty-nine of the thirty are filling-first
     * by a distance, most of them four or five to one:
     *
     *   staunton  p 0.17  r 0.61  n 0.37  b 0.22  q 0.20  k 0.23
     *   regence   p 0.58  r 2.06  n 0.90  b 0.42  q 0.42  k 0.89   <- the rook is the exception
     *   stgeorge  p 0.16  r 0.44  n 0.33  b 0.18  q 0.14  k 0.23
     *   selenus   p 0.35  r 0.30  n 0.60  b 0.37  q 0.28  k 0.33
     *   sikh      p 0.22  r 0.68  n 0.45  b 0.26  q 0.20  k 0.29
     *
     * THE REGENCE ROOK is the one piece that carries both things this renderer edges with a CENTRED
     * stroke rather than a hull: the square plinth and four battlements sawn from its cap. Half of
     * that line is spent inside the face it edges, and on boxes about two units across there is not
     * much face to spend. It is bounded rather than excused — before the cylinder fix the same
     * measurement read nine to one, so a ceiling at 2.5 still catches that decisively.
     */
    const dark = HIGH_CONTRAST_PALETTE.darkPieces;
    const heavy: string[] = [];
    for (const key of ['s1849', 'regence', 'stgeorge', 'selenus', 'sikh']) {
      const design = pieceDesign(key);
      for (const type of ALL) {
        stage?.destroy();
        stage = createZdogStage();
        buildPiece(stage.root, design.specs[type], dark, {
          outline: dark.stroke, line: design.line, outlineWidth: STROKE * design.line,
        });
        stage.render();
        const [stroke, filling] = inkCount(stage, [dark.stroke, dark.top]);
        // Both present: a piece with no ink has no edge against its square, and a piece with no
        // filling is the bug this whole block exists to catch.
        expect(`${key} ${type} inked ${stroke > 0}`).toBe(`${key} ${type} inked true`);
        expect(`${key} ${type} filled ${filling > 0}`).toBe(`${key} ${type} filled true`);
        const ceiling = key === 'regence' && type === 'r' ? 2.5 : 1;
        if (stroke / filling > ceiling) heavy.push(`${key} ${type} ${(stroke / filling).toFixed(2)}`);
      }
    }
    expect(heavy).toEqual([]);
  });
});
