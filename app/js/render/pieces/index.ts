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

  if (spec.disc) {
    // Two discs, outer then inner, so the queen's circle carries the same outline as every other
    // face. They share a position and therefore a sort value; Array.prototype.sort is stable in
    // every engine this ships to, so insertion order decides — outer behind, inner in front.
    // `diameter + STROKE`, not `+ STROKE * 2`. A dot's stroke IS its diameter, so this leaves a
    // rim of STROKE/2 on each side — the same apparent weight as a box edge, which is drawn with
    // width STROKE centred on the edge. Doubling it made the rim 24% of the disc against the 11%
    // the cube faces carry, and the queen read as an empty ring at final scale.
    new Zdog.Shape({
      addTo: anchor,
      stroke: spec.disc.diameter + STROKE,
      color: colours.stroke,
      translate: { y: spec.disc.y },
    });
    new Zdog.Shape({
      addTo: anchor,
      stroke: spec.disc.diameter,
      color: colours.top,
      translate: { y: spec.disc.y },
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
