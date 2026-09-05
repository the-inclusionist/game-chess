// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/engine/client — what the game may ask an engine, and nothing about which engine answers.
//
// ========================= WHY THE INTERFACE OUTLIVED ITS FIRST IMPLEMENTATION =========================
// This file used to carry a negamax in a Web Worker as well as the contract for talking to it.
// The negamax is gone: Stockfish 18 lite can be told a rating, and a rating is the only difficulty
// dial worth having — "1400" means something to a child who has a rating and "medium" does not.
// Two engines meant two ladders that could not be compared, and one of them could not honour a
// rating at all.
//
// ⚠️ WHAT THAT COST, written down rather than discovered later: the game now REQUIRES 6.98 MB of
// WebAssembly to have an opponent at all. There is no offline fallback and no first move before
// the download finishes. On a school connection that is a real wait, and it is the price of the
// rating dial and of a hint that is genuinely full strength.
//
// The interface stayed because it is the right size: the composition roots ask for a move and for
// a hint and know nothing else. `stockfish-client` satisfies it today, and a future engine — a
// smaller build for offline play, say — satisfies the same shape without the roots changing.
//
// ========================= STALE REPLIES =========================
// Every request carries an id and only the newest is honoured. Without it, a player who takes a
// move back, restarts, or changes strength mid-search gets an answer computed for a position that
// no longer exists — a legal-looking move that is simply wrong, with nothing to indicate it.

import type { LegalMove } from '../rules.ts';

export interface EngineMove {
  readonly move: LegalMove;
  readonly score: number;
  readonly nodes: number;
  readonly depth: number;
  /** For a hint: every move the engine rates at the same level, this one first. Empty otherwise. */
  readonly ties: readonly LegalMove[];
}

export interface EngineClient {
  /** Resolves with the opponent's move, or null when the position has none. */
  requestMove(fen: string): Promise<EngineMove | null>;
  /**
   * The same engine asked a different question: which move it would play, and which others it
   * rates at the same level. It goes through the SAME id-matching as a move, so a hint asked for
   * and then abandoned cannot arrive later and mark squares in a position that has moved on.
   *
   * ⚠️ A hint is FULL STRENGTH whatever the opponent is set to. A hint from a 1000-rated engine
   * is worse than no hint: it is wrong advice with the authority of a machine behind it.
   */
  requestHint(fen: string): Promise<EngineMove | null>;
  /** Abandons any search in flight. Its reply, if it arrives, is dropped. */
  cancel(): void;
  destroy(): void;
}
