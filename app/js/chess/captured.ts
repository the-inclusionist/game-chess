// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/captured — what each side has taken off the board.

import type { Rules } from './rules.ts';
import type { PieceType, Side } from './types.ts';

/** Heaviest first, so a captured queen is not buried behind six pawns. */
export const CAPTURE_ORDER: readonly PieceType[] = ['q', 'r', 'b', 'n', 'p'];

/** Figurine letters. NOT the piece name — that is the screen reader's job, and it is spoken. */
export const CAPTURE_GLYPH: Readonly<Record<PieceType, string>> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
};

/**
 * The pieces of `side` that have been taken, heaviest first.
 *
 * ⚠️ Read out of the HISTORY rather than kept as a running tally. One source of truth, and a
 * taken-back move corrects the list for free instead of needing an undo path of its own — which
 * is exactly the kind of second bookkeeping that drifts silently and is noticed a game later.
 */
export function capturedFrom(rules: Rules, side: Side): PieceType[] {
  const taken: PieceType[] = [];
  for (const move of rules.history()) {
    if (move.captured && move.captured.side === side) taken.push(move.captured.type);
  }
  taken.sort((a, b) => CAPTURE_ORDER.indexOf(a) - CAPTURE_ORDER.indexOf(b));
  return taken;
}

/** The same, as the row of glyphs a board shows beside a player. */
export function capturedGlyphs(rules: Rules, side: Side): string {
  return capturedFrom(rules, side).map((type) => CAPTURE_GLYPH[type]).join('');
}
