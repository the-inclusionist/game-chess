// SPDX-License-Identifier: AGPL-3.0-or-later
// render/pieces — turning the geometry table into Zdog nodes.
//
// ========================= REBUILT ON A MOVE, NOT POOLED =========================
// Zdog's `updateGraph()` calls `updateFlatGraph()`, which rebuilds the flat graph from the tree
// EVERY frame. Structural changes are therefore picked up on their own, and a pool with hidden
// spares would buy nothing but bookkeeping — plus the awkward fact that `Anchor` has no `visible`
// (only `Shape` does), so hiding a piece means walking its faces.
//
// So the layer is rebuilt from the position. That happens on a MOVE, a handful of times a minute,
// never per frame. Counted rather than guessed, a full board of pieces is 92 shapes for Hartwig and
// 368 to 520 for the turned patterns — Regence is the dearest, because a Regence king carries
// four disc tiers and a square plinth. The whole frame with board and markers measured 1.44 ms at
// 450 shapes, so the busiest of these lands near 2 ms with the board on top.

import Zdog, { type Anchor } from 'zdog';
import type { Piece, Square } from '../../chess/types.ts';
import { squareCenter } from '../board-geometry.ts';
import {
  DARK_OUTLINE_SCALE, DEFAULT_PALETTE, STROKE, type Palette, type SidePalette,
} from '../palette.ts';
import { TILE } from '../resolution.ts';
import { flatDiameter, tooThinToOutline, type PieceSpec } from './geometry.ts';
import { DEFAULT_DESIGN, pieceDesign } from './sets.ts';

export interface PiecePlacement {
  readonly piece: Piece;
  readonly square: Square;
}

export interface PiecesLayer {
  readonly anchor: Anchor;
  /** Replaces every piece on the board. Call on a move, not on a frame. */
  setPosition(placements: readonly PiecePlacement[]): void;
  /**
   * The one piece currently crossing the board, or null. Held apart from the others because it
   * moves EVERY frame: rebuilding 32 pieces per frame to shift one of them would throw away the
   * whole point of rebuilding only on a move. Setting a translate costs nothing.
   */
  setTravelling(piece: Piece | null): void;
  /** Where that piece is right now, in board units. `y` is the lift, and negative is up. */
  moveTravelling(x: number, y: number, z: number): void;
  /** How many pieces are currently on the board, the traveller excluded. */
  count(): number;
  /** Recolours by rebuilding, because the colours are baked into the Zdog nodes. */
  setPalette(palette: Palette): void;
  /** Turns the outline on or off. Rebuilds, for the same reason. */
  setOutline(on: boolean): void;
  /**
   * Swaps the drawing — Hartwig or one of the three European patterns. Rebuilds, like everything
   * else here, because the geometry is baked into the Zdog nodes when a piece is built.
   */
  setDesign(key: string): void;
}

export function sideColours(piece: Piece, palette: Palette = DEFAULT_PALETTE): SidePalette {
  return piece.side === 'w' ? palette.lightPieces : palette.darkPieces;
}

/** Builds one piece under `parent`, standing on the board plane at the origin. */
export interface BuildOptions {
  /**
   * Draw a real outline in this colour, or omit for none.
   *
   * ========================= WHY THIS NEEDS A SECOND BOX =========================
   * Zdog has no separate stroke colour. `Box.setFace` assigns `color = <that face's colour>` and
   * `Shape` uses `color` for the stroke as well as the fill, so the `stroke:` passed to a Box is a
   * WIDTH and every face ends up outlined in its own colour — which is to say not outlined.
   *
   * So the outline is a SECOND Box of identical geometry with `fill: false`, every face set to the
   * outline colour. Identical geometry means identical sort values, and a stable sort keeps the
   * fill face ahead of its own outline face wherever the two tie — so each face is outlined over
   * itself, and the pair still sorts against the rest of the board as one surface.
   */
  readonly outline?: string;
  /**
   * How wide that outline is, in Zdog units. Defaults to the piece's own stroke, which is what
   * makes the outline exactly cover the fill's stroke expansion; narrower than that and it sits
   * inside the silhouette instead of edging it.
   */
  readonly outlineWidth?: number;
  /**
   * How thick this drawing's line is, as a multiple of `STROKE`. Scales the SOLID's stroke and the
   * outline together — see `line` in `pieces/sets.ts` for why they cannot be scaled apart.
   */
  readonly line?: number;
}

export function buildPiece(
  parent: Anchor,
  spec: PieceSpec,
  colours: SidePalette,
  options: BuildOptions = {},
): Anchor {
  const anchor = new Zdog.Anchor({ addTo: parent });
  const lineWidth = STROKE * (options.line ?? 1);

  for (const box of spec.boxes) {
    new Zdog.Box({
      addTo: anchor,
      width: box.w,
      height: box.h,
      depth: box.d,
      translate: { x: box.x ?? 0, y: box.y ?? 0, z: box.z ?? 0 },
      rotate: { x: box.rotX ?? 0, y: box.rotY ?? 0, z: box.rotZ ?? 0 },
      stroke: lineWidth,
      color: colours.stroke,
      topFace: colours.top,
      bottomFace: colours.side,
      leftFace: colours.side,
      rightFace: colours.side,
      frontFace: colours.face,
      rearFace: colours.face,
    });
  }


  /*
   * ========================= THE TURNED PARTS =========================
   * A lathe-cut piece is a stack of circles, and Zdog has shipped `Cylinder` and `Cone` all along.
   * Both run along local Z, so a part standing on the board takes the same quarter turn about X
   * that the board's own Rects take.
   *
   * ⚠️ `rotate: { x: +TAU/4 }` sends local +Z to −y, which is UP — the same sign the queen's ball
   * relies on, and the same sign that made her look flat when it was wrong. A cone's apex and a
   * dome's crown both point along +Z, so `down` is the OPPOSITE turn rather than a different shape.
   *
   * ⚠️ AND IT IS DRAWN TWICE, exactly as a Box is. `Cylinder` takes one `color` and uses it for
   * the wall AND for the stroke, so painting the stroke in the outline ink paints the whole
   * barrel in it too — which is what the first version did, and every piece came out a stack of
   * near-black rings with a coloured rim. The fix is the one already proven on the boxes: the
   * solid first, then the same geometry again with `fill: false` in the outline ink. Identical
   * geometry means identical sort values, and a stable sort keeps the pair together.
   */
  for (const part of spec.turned ?? []) {
    const up = part.down ? -Zdog.TAU / 4 : Zdog.TAU / 4;

    const draw = (
      colour: string, filled: boolean, faces: boolean, diameter: number, length: number, y: number,
    ): void => {
      const common = {
        addTo: anchor,
        diameter,
        stroke: filled ? lineWidth : (options.outlineWidth ?? lineWidth),
        color: colour,
        fill: filled,
        backface: filled ? colours.side : colour,
        translate: { y },
        rotate: { x: up },
      };
      if (part.shape === 'dome') {
        new Zdog.Hemisphere(common);
      } else if (part.shape === 'cone') {
        new Zdog.Cone({ ...common, length });
      } else {
        new Zdog.Cylinder({
          ...common,
          length,
          frontFace: faces ? colours.top : colour,
          backFace: faces ? colours.side : colour,
        });
      }
    };

    const diameter = flatDiameter(part);
    draw(colours.face, true, true, diameter, part.h, part.y);
    /*
     * ⚠️ NOT EVERY PART GETS AN OUTLINE, and the ones that do not are the ones that could only be
     * ink — see `tooThinToOutline`. A collar shorter than the stroke that would edge it is drawn
     * solid and left unedged; the silhouette is carried across it by its neighbours.
     */
    const width = options.outlineWidth ?? lineWidth;
    if (options.outline && !tooThinToOutline(part, width)) {
      draw(options.outline, false, false, diameter, part.h, part.y);
    }
  }

  if (spec.sphere) {
    // ========================= A BALL, NOT A STICKER =========================
    // Two Hemispheres, apex up and apex down. Zdog gives Hemisphere its own `updateSortValue` —
    // the centroid sits 3/8 of the way from origin to apex, not at the mean of the path points —
    // which is exactly what lets a pair of them sort against each other, and against the rest of
    // the board, as one solid ball would.
    //
    // Zdog's Y points DOWN and a Hemisphere's apex points along +z. Rotating the apex (0,0,d/2)
    // about X by +TAU/4 sends it to y = -d/2, which is UP. Getting that sign backwards puts the
    // lit half underneath, and the ball comes out looking flat again — which is exactly what the
    // shading test caught.
    //
    // The two halves take DIFFERENT colours, and that is the whole reason this beats the flat disc
    // it replaced: a single-colour sphere reads as a circle from every angle. Lit from above is the
    // same convention the box faces already use.
    const half = { diameter: spec.sphere.diameter, stroke: lineWidth, translate: { y: spec.sphere.y } };
    new Zdog.Hemisphere({
      ...half, addTo: anchor, rotate: { x: Zdog.TAU / 4 },
      color: colours.top, backface: colours.face,
    });
    new Zdog.Hemisphere({
      ...half, addTo: anchor, rotate: { x: -Zdog.TAU / 4 },
      color: colours.side, backface: colours.face,
    });
  }

  if (options.outline) {
    const line = options.outline;
    const width = options.outlineWidth ?? lineWidth;
    for (const box of spec.boxes) {
      new Zdog.Box({
        addTo: anchor,
        width: box.w,
        height: box.h,
        depth: box.d,
        translate: { x: box.x ?? 0, y: box.y ?? 0, z: box.z ?? 0 },
        rotate: { y: box.rotY ?? 0 },
        stroke: width,
        fill: false,
        color: line,
        topFace: line,
        bottomFace: line,
        leftFace: line,
        rightFace: line,
        frontFace: line,
        rearFace: line,
      });
    }

    if (spec.sphere) {
      const half = {
        diameter: spec.sphere.diameter,
        stroke: width,
        fill: false,
        color: line,
        backface: line,
        translate: { y: spec.sphere.y },
      };
      new Zdog.Hemisphere({ ...half, addTo: anchor, rotate: { x: Zdog.TAU / 4 } });
      new Zdog.Hemisphere({ ...half, addTo: anchor, rotate: { x: -Zdog.TAU / 4 } });
    }
  }

  return anchor;
}

export function createPiecesLayer(
  parent: Anchor,
  initial: Palette = DEFAULT_PALETTE,
  outlined = true,
  design = DEFAULT_DESIGN,
): PiecesLayer {
  const layer = new Zdog.Anchor({ addTo: parent });
  const travelling = new Zdog.Anchor({ addTo: parent });
  let palette = initial;
  let outline = outlined;
  let placed = 0;
  let drawing = pieceDesign(design);
  let specs = drawing.specs;
  let current: readonly PiecePlacement[] = [];

  const opts = (piece: Piece): BuildOptions => {
    // ⚠️ The DRAWING chooses the line, not the palette. A Hartwig piece is a handful of flat
    // faces and the line is what makes each one an edge; a turned piece is a stack of six to nine
    // circles, where the same line is drawn six to nine times over twenty pixels and silts the
    // piece up into a blob. See `line` in `pieces/sets.ts`.
    const line = drawing.line * (piece.side === 'b' ? DARK_OUTLINE_SCALE : 1);
    return outline
      ? { outline: sideColours(piece, palette).stroke, line, outlineWidth: STROKE * line }
      : { line };
  };

  return {
    anchor: layer,
    count: () => placed,

    setTravelling(piece) {
      for (const child of [...travelling.children]) child.remove();
      travelling.translate.set({ x: 0, y: 0, z: 0 });
      if (piece) buildPiece(travelling, specs[piece.type], sideColours(piece, palette), opts(piece));
    },

    moveTravelling(x, y, z) {
      travelling.translate.set({ x, y, z });
    },

    setPosition(placements) {
      for (const child of [...layer.children]) child.remove();

      for (const { piece, square } of placements) {
        const { x, z } = squareCenter(square, TILE);
        const holder = new Zdog.Anchor({ addTo: layer, translate: { x, z } });
        buildPiece(holder, specs[piece.type], sideColours(piece, palette), opts(piece));
      }

      current = placements;
      placed = placements.length;
    },

    setPalette(next) {
      palette = next;
      this.setPosition(current);
    },

    setOutline(on) {
      outline = on;
      this.setPosition(current);
    },

    setDesign(key) {
      drawing = pieceDesign(key);
      specs = drawing.specs;
      this.setPosition(current);
    },
  };
}
