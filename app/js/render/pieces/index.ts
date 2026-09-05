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
// never per frame. Building 32 pieces is roughly 300 Rects; the whole frame with board and markers
// measured 1.44 ms at 450 shapes, and this brings the total to about 800.

import Zdog, { type Anchor } from 'zdog';
import type { Piece, Square } from '../../chess/types.ts';
import { squareCenter } from '../board-geometry.ts';
import { DEFAULT_PALETTE, type Palette, type SidePalette, STROKE } from '../palette.ts';
import { TILE } from '../resolution.ts';
import { PIECE_SPECS, type PieceSpec } from './geometry.ts';

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
}

export function sideColours(piece: Piece, palette: Palette = DEFAULT_PALETTE): SidePalette {
  return piece.side === 'w' ? palette.lightPieces : palette.darkPieces;
}

/** Builds one piece under `parent`, standing on the board plane at the origin. */
export function buildPiece(parent: Anchor, spec: PieceSpec, colours: SidePalette): Anchor {
  const anchor = new Zdog.Anchor({ addTo: parent });

  for (const box of spec.boxes) {
    new Zdog.Box({
      addTo: anchor,
      width: box.w,
      height: box.h,
      depth: box.d,
      translate: { x: box.x ?? 0, y: box.y ?? 0, z: box.z ?? 0 },
      rotate: { y: box.rotY ?? 0 },
      stroke: STROKE,
      color: colours.stroke,
      topFace: colours.top,
      bottomFace: colours.side,
      leftFace: colours.side,
      rightFace: colours.side,
      frontFace: colours.face,
      rearFace: colours.face,
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
    const half = { diameter: spec.sphere.diameter, stroke: STROKE, translate: { y: spec.sphere.y } };
    new Zdog.Hemisphere({
      ...half, addTo: anchor, rotate: { x: Zdog.TAU / 4 },
      color: colours.top, backface: colours.face,
    });
    new Zdog.Hemisphere({
      ...half, addTo: anchor, rotate: { x: -Zdog.TAU / 4 },
      color: colours.side, backface: colours.face,
    });
  }

  return anchor;
}

export function createPiecesLayer(
  parent: Anchor,
  initial: Palette = DEFAULT_PALETTE,
): PiecesLayer {
  const layer = new Zdog.Anchor({ addTo: parent });
  const travelling = new Zdog.Anchor({ addTo: parent });
  let palette = initial;
  let placed = 0;
  let current: readonly PiecePlacement[] = [];

  return {
    anchor: layer,
    count: () => placed,

    setTravelling(piece) {
      for (const child of [...travelling.children]) child.remove();
      travelling.translate.set({ x: 0, y: 0, z: 0 });
      if (piece) buildPiece(travelling, PIECE_SPECS[piece.type], sideColours(piece, palette));
    },

    moveTravelling(x, y, z) {
      travelling.translate.set({ x, y, z });
    },

    setPosition(placements) {
      for (const child of [...layer.children]) child.remove();

      for (const { piece, square } of placements) {
        const { x, z } = squareCenter(square, TILE);
        const holder = new Zdog.Anchor({ addTo: layer, translate: { x, z } });
        buildPiece(holder, PIECE_SPECS[piece.type], sideColours(piece, palette));
      }

      current = placements;
      placed = placements.length;
    },

    setPalette(next) {
      palette = next;
      this.setPosition(current);
    },
  };
}
