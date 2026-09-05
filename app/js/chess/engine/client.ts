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

/** One of the moves a hint offers, and how far behind the best it scored, in centipawns. */
export interface Suggestion {
  readonly move: LegalMove;
  readonly behind: number;
}

export interface EngineMove {
  readonly move: LegalMove;
  readonly score: number;
  readonly nodes: number;
  readonly depth: number;
  /**
   * For a hint: every move the engine rates at the same level, best first and this one first.
   * Empty for any other kind of search.
   *
   * ⚠️ EACH CARRIES ITS DISTANCE from the best, because the drawing needs it. There is no fixed
   * number of suggestions — it is however many fall inside the margin, two in a sharp position
   * and six in a quiet one — so "which one is this" is not a rank to look up in a list of
   * colours. It is a distance to place on a ramp.
   */
  readonly ties: readonly Suggestion[];
  /**
   * The root moves the engine reported, best first, with the score it gave each. As many as the
   * MultiPV it was asked for — one for an ordinary search.
   *
   * ⚠️ SCORES ARE FROM THE SIDE TO MOVE'S POINT OF VIEW, which is how UCI reports them and the
   * single easiest thing to get wrong here. Comparing the evaluation before a move with the one
   * after it means negating one of them, because the side to move has changed.
   */
  readonly lines: readonly { readonly move: LegalMove; readonly score: number }[];
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
  /**
   * What the engine thinks of a position, at full strength — not a move to play, a verdict on the
   * position. It is the one primitive behind three features: the advantage readout, the mark the
   * score sheet puts beside a move, and the warning that a move was a blunder.
   *
   * ⚠️ Every review uses the SAME settings, and that is the whole reason the numbers can be
   * subtracted from each other. An evaluation at full strength minus one at 1200 Elo is not a
   * measure of anything.
   */
  requestReview(fen: string): Promise<EngineMove | null>;
  /** Abandons any search in flight. Its reply, if it arrives, is dropped. */
  cancel(): void;
  destroy(): void;
}
