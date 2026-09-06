// SPDX-License-Identifier: AGPL-3.0-or-later
// render/pieces/sets — the drawings the projected board can use.
//
// ⚠️ THE DEFAULT IS AND STAYS HARTWIG. It is the set this game is a reimplementation OF, the one
// whose geometry the whole of `geometry.ts` argues for, and the only one whose shapes are the
// movement of the pieces rather than a decoration on them. The three European patterns are
// alternatives offered to a player, not a replacement for the reason this project exists.
//
// They are also, unlike Hartwig, APPROXIMATIONS and say so: a Staunton bishop is a carved object
// and this is a stack of circles that reads like one at twenty pixels. The names avoid claiming
// otherwise — "à maneira de 1849" rather than the name of a pattern still in trade.

import type { PieceType } from '../../chess/types.ts';
import { PIECE_SPECS, type PieceSpec } from './geometry.ts';
import { SET_1849, SET_REGENCE, SET_ST_GEORGE } from './turned.ts';

export interface PieceDesign {
  readonly key: string;
  /** i18n key for the name shown in the panel. */
  readonly name: string;
  readonly specs: Readonly<Record<PieceType, PieceSpec>>;
  /**
   * How thick this drawing's line is, as a multiple of `STROKE`.
   *
   * ========================= ⚠️ WHY HARTWIG IS THE ONE THAT KEEPS THE FULL LINE =========================
   * A Hartwig piece is between one and four flat faces at this size, and the line is what makes
   * each face an edge rather than a change of shade: it IS the drawing. A turned piece is the
   * opposite — a stack of six to nine circles, so the same line is drawn six to nine times over a
   * shape that is barely twenty pixels tall, and the piece silts up into a dark blob with the
   * colour pushed out to a rim.
   *
   * ⚠️ It scales the SOLID's stroke as well as the outline's, and it has to. Zdog centres a
   * stroke on its path, so a filled shape already reaches `stroke/2` past its own surface; an
   * outline narrower than that sits INSIDE the silhouette and stops being an edge at all. Halving
   * one without the other does not thin the line, it hides it.
   */
  readonly line: number;
}

export const PIECE_DESIGNS: readonly PieceDesign[] = [
  { key: 'hartwig', name: 'design.hartwig', specs: PIECE_SPECS, line: 1 },
  { key: 's1849', name: 'design.s1849', specs: SET_1849, line: 0.5 },
  { key: 'regence', name: 'design.regence', specs: SET_REGENCE, line: 0.5 },
  { key: 'stgeorge', name: 'design.stgeorge', specs: SET_ST_GEORGE, line: 0.5 },
];

export const DEFAULT_DESIGN = 'hartwig';

/** The named design, or Hartwig for a key that no longer exists. */
export function pieceDesign(key: string): PieceDesign {
  return PIECE_DESIGNS.find((d) => d.key === key) ?? PIECE_DESIGNS[0];
}
