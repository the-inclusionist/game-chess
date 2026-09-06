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
import { flatDiameter, type PieceSpec } from './geometry.ts';
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
   * All of them run along local Z, so a part standing on the board takes the same quarter turn
   * about X that the board's own Rects take.
   *
   * ⚠️ `rotate: { x: +TAU/4 }` sends local +Z to −y, which is UP — the same sign the queen's ball
   * relies on, and the same sign that made her look flat when it was wrong. A cone's apex and a
   * dome's crown both point along +Z, so `down` is the OPPOSITE turn rather than a different shape.
   *
   * ================= ⚠️ ZDOG CANNOT STROKE A CYLINDER, AND SAYING IT COULD COST MONTHS =========
   * The outline used to be a second copy with `fill: false`, which is the trick the boxes use and
   * which the comment here claimed worked. Read `CylinderGroup.renderCylinderSurface` in
   * `zdog.dist.js` and it does not:
   *
   *     renderer.stroke( ctx, elem, true, this.color, strokeWidth );
   *
   * The `true` is a LITERAL. A cylinder's wall is not a stroked path at all — it is one fat line
   * from one base to the other, painted at `diameter * scale + lineWidth`, in `this.color`,
   * whatever `fill` says. So the "outline" copy of every drum was an OPAQUE BAR of outline ink
   * the full width of the part, laid over the piece. On a turned pattern with eight or ten parts
   * that is most of the piece, which is why they came out as striped cones with their colour
   * pushed to a rim, and why adding more parts made it worse rather than better.
   *
   * A cone and a dome are honest — `Cone.renderConeSurface` and `Hemisphere.renderDome` both pass
   * `this.stroke` and `this.fill` through, so an unfilled copy of either really is a contour.
   *
   * ================= SO THE OUTLINE IS A LARGER COPY, DRAWN FIRST =================
   * The same trick `render3d/pieces.ts` plays with an inverted hull, and for the same reason: the
   * renderer has no outline primitive worth the name. A copy `outlineWidth` wider all round, filled
   * entirely in the ink, added to the anchor BEFORE the solid. Every part of it is then covered by
   * the solid except a rim exactly where the silhouette is.
   *
   * ⚠️ THE DIAMETER GROWS AND THE LENGTH DOES NOT. A copy longer than its original reaches into
   * the part above and below it, and what shows there is a disc of ink across a junction — which
   * is the banding this whole change exists to remove. Growing only the diameter keeps the rim on
   * the sides, where a silhouette is, and leaves the horizontal junctions to the parts themselves.
   *
   * ================= ⚠️ AND THE PAIR GOES IN A GROUP, WHICH IS NOT OPTIONAL =================
   * "Identical geometry means identical sort values, and a stable sort keeps the pair together"
   * — the old comment here said that, and it is false twice over. The hull is NOT identical
   * geometry, and even for a true copy the sort value is the MEAN Z OF THE PATH POINTS: a sum of
   * offsets that cancel in arithmetic and do not cancel in floating point. The two copies land a
   * few ulps apart, in whichever direction the rounding happens to go, so the hull sorted in front
   * of its own solid on about half the parts. On screen that is a dark piece with pale rings, which
   * is what the first attempt at this looked like and is worse than no outline at all.
   *
   * `Zdog.Group` with `updateSort: false` renders its children in INSERTION order and still sorts
   * as one object against everything else. Hull first, solid second, no tie to lose.
   *
   * ⚠️ A DOME NEEDS THE GROUP MOST OF ALL. `Hemisphere.updateSortValue` puts the centroid three
   * eighths of the way to the APEX and the apex sits at `diameter / 2`, so a wider dome sorts
   * genuinely differently from its original — not by a rounding error but by design, and in the
   * direction that puts the ink in front whenever the crown points at the camera, which for the
   * ball on top of a piece is always. Inside a group that stops being a question.
   *
   * It could have kept a stroked copy — `renderDome` passes `fill` through honestly, unlike the
   * cylinder — but a centred stroke of 0.75 units on a ball 2.4 units across is most of the ball.
   * The hull is the lighter line, and it is the same line every other part gets.
   */
  for (const part of spec.turned ?? []) {
    const up = part.down ? -Zdog.TAU / 4 : Zdog.TAU / 4;
    const diameter = flatDiameter(part);
    const width = options.outlineWidth ?? lineWidth;

    const hulled = Boolean(options.outline);
    // One group per part when it has a hull, so insertion order decides and the sort cannot.
    const into = hulled
      ? new Zdog.Group({ addTo: anchor, updateSort: false, translate: { y: part.y } })
      : anchor;
    const offset = into === anchor ? { y: part.y } : { y: 0 };

    const shape = (extra: Record<string, unknown>): void => {
      const common = {
        addTo: into,
        translate: offset,
        rotate: { x: up },
        ...extra,
      };
      if (part.shape === 'dome') new Zdog.Hemisphere(common);
      else if (part.shape === 'cone') new Zdog.Cone({ ...common, length: part.h });
      else new Zdog.Cylinder({ ...common, length: part.h });
    };

    if (hulled) {
      shape({
        // ⚠️ HALF THE WIDTH, because a hull is not a stroke. Zdog centres a stroke on its path,
        // so `outlineWidth` has always meant "half of me shows outside the shape". A hull shows
        // ALL of itself, so growing the diameter by the full width draws a line twice the weight
        // the boxes get — which on a twenty-pixel piece is the difference between an edge and a
        // band. Grown by the width means `width / 2` on each side, which is exactly the old line.
        diameter: diameter + width,
        stroke: lineWidth,
        color: options.outline,
        fill: true,
        backface: options.outline,
        frontFace: options.outline,
        backFace: options.outline,
      });
    }

    shape({
      diameter,
      stroke: lineWidth,
      color: colours.face,
      fill: true,
      backface: colours.side,
      frontFace: colours.top,
      backFace: colours.side,
    });

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
