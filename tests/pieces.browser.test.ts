// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest';
import type { Piece, PieceType } from '../app/js/chess/types.ts';
import { LIGHT_PIECES } from '../app/js/render/palette.ts';
import { buildPiece, createPiecesLayer } from '../app/js/render/pieces/index.ts';
import { PIECE_SPECS } from '../app/js/render/pieces/geometry.ts';
import { createZdogStage, type ZdogStage } from '../app/js/render/zdog-stage.ts';

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

describe("[Queen] the circle is a disc, not a ring", () => {
  // The queen is drawn as two stacked single-point Shapes: a larger one in the outline colour
  // and a smaller one in the face colour on top, so her circle carries the same outline as every
  // other face. They share a position and therefore a sort value, and the whole thing rests on
  // Array.prototype.sort being stable. If it were not, the outline would land in FRONT and the
  // queen would read as an empty ring — which is exactly what it looked like on screen.
  it('fills the centre with the face colour, not the outline colour', () => {
    stage = createZdogStage();
    // Only the discs: no boxes, so nothing else can be under the sample point.
    buildPiece(stage.root, { boxes: [], disc: { diameter: 40, y: 0 } }, LIGHT_PIECES);
    stage.render();

    const [r, g, b, a] = pixelAt(stage, 160 + Math.round(-42 * 1.15), 90);
    expect(a).toBe(255);
    expect([r, g, b]).toEqual(rgb(LIGHT_PIECES.top));
  });

  it('still shows the outline at the rim', () => {
    stage = createZdogStage();
    buildPiece(stage.root, { boxes: [], disc: { diameter: 40, y: 0 } }, LIGHT_PIECES);
    stage.render();

    const cx = 160 + Math.round(-42 * 1.15);
    // Just inside the outer disc but outside the inner one.
    const [r, g, b] = pixelAt(stage, cx + Math.round((40 / 2 + 0.5) * 1.15), 90);
    expect([r, g, b]).not.toEqual(rgb(LIGHT_PIECES.top));
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

describe('[Queen] the disc holds up near and far, alone and in a crowd', () => {
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

  it('fills the disc with the face colour in a FULL position, near rank included', () => {
    // The lone-queen case below already passes, so if this one fails the cause is interaction
    // with the neighbouring pieces rather than the disc itself.
    stage = createZdogStage();
    const solo = createPiecesLayer(stage.root);
    solo.setPosition([{ piece: white('q'), square: { x: 3, y: 7 } }]);
    const at = discPixel(solo, stage);

    stage.destroy();
    stage = createZdogStage();
    const full = createPiecesLayer(stage.root);
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
