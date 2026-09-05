// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/engine/search — negamax with alpha-beta pruning.
//
// ========================= NEGAMAX, NOT MINIMAX =========================
// Same algorithm, half the code: because `evaluate` is antisymmetric, one side's best is exactly
// the other's worst, so a single recursive case covers both players. The whole trick is the
// `-negamax(...)` on the way back up, and it is only sound because the evaluation really is
// antisymmetric — which is why that property has its own test rather than being assumed here.
//
// ========================= WHY THE UNPRUNED VERSION SHIPS TOO =========================
// `searchWithoutPruning` exists to be compared against. Alpha-beta is only correct if it returns
// the SAME score as a full search at the same depth, and a mistake in the window does not crash
// or throw — it quietly makes the engine play worse. The equivalence test is the only thing that
// would catch it, and it needs something to compare to.
//
// It costs one small function that never runs in the game, and it buys the one assurance that
// matters about a pruning search.
//
// ========================= PLY IN THE MATE SCORE =========================
// Mate is scored `MATE - ply`, so a mate in one beats a mate in three. Without it the engine
// finds a mate and then wanders, because every mating line scores identically.

import type { LegalMove, Rules } from '../rules.ts';
import { evaluateMaterial, MATE } from './evaluate.ts';

export interface SearchResult {
  readonly move: LegalMove;
  /** Centipawns, from the point of view of the side to move at the root. */
  readonly score: number;
  readonly depth: number;
  /** Positions visited. Only meaningful against another search of the same position. */
  readonly nodes: number;
}

interface Counter { nodes: number }

function negamax(
  rules: Rules,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  counter: Counter,
  prune: boolean,
): number {
  counter.nodes++;

  if (depth === 0) return evaluateMaterial(rules, rules.turn());

  // Generating the moves settles the terminal cases for free: an empty list is mate if the king
  // is attacked and stalemate otherwise. Asking `isCheckmate()` and `isDraw()` separately would
  // generate the same moves again, and `isDraw()` measures 38 us on its own.
  const moves = rules.searchMoves();
  if (moves.length === 0) return rules.isCheck() ? -MATE + ply : 0;

  let best = -Infinity;
  for (const token of moves) {
    rules.searchPlay(token);
    const score = -negamax(rules, depth - 1, -beta, -alpha, ply + 1, counter, prune);
    rules.searchUndo();

    if (score > best) best = score;
    if (score > alpha) alpha = score;
    // The cut: this line is already better than the opponent will ever allow, so the rest of it
    // cannot change the result above. Skipping it is what makes the search affordable.
    if (prune && alpha >= beta) break;
  }
  return best;
}

function run(rules: Rules, depth: number, prune: boolean): SearchResult | null {
  if (depth < 1) return null;

  const moves = rules.allMoves();
  if (moves.length === 0) return null;

  const counter: Counter = { nodes: 0 };
  let bestMove: LegalMove | null = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;

  // The ROOT is the only place that needs to know what a move is, so it is the only place that
  // pays for `allMoves()`. Everything below it works with opaque tokens.
  for (const move of moves) {
    rules.move(move.from, move.to, move.promotion ?? undefined);
    const score = -negamax(rules, depth - 1, -Infinity, -alpha, 1, counter, prune);
    rules.undo();

    // Strictly greater, so the FIRST move of an equal-scoring set wins and the engine is
    // deterministic. A tie broken at random would make the equivalence test flap.
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (score > alpha) alpha = score;
  }

  return bestMove ? { move: bestMove, score: bestScore, depth, nodes: counter.nodes } : null;
}

/**
 * ========================= WHY A HINT CANNOT USE THE ORDINARY SEARCH =========================
 * A hint has to say "this is best, and these are as good" — which needs a SCORE for every root
 * move, and alpha-beta does not produce one. Narrowing the window is the whole point of the
 * pruning: once `alpha` has risen, every later move that cannot beat it is abandoned early and
 * what comes back is a BOUND, not a value. "All the moves with the same score" read off a pruned
 * search would be a list of moves that merely failed to be proved worse, which is a different and
 * much longer list.
 *
 * So the root here searches every move with a FULL window and only prunes below it. That costs
 * real time — the saving alpha-beta makes at the root is the largest one it makes — and it is
 * affordable precisely because a hint is asked for by hand, once, and not sixty times a minute.
 *
 * ⚠️ AND "THE SAME LEVEL" MEANS THE SAME TO THIS ENGINE AT THIS DEPTH. Two moves tying here are
 * tied in the opinion of a three-ply negamax with a material-and-placement evaluator. That is a
 * fact about the hint, not about chess, and it belongs in what the player is told.
 */
export interface RankedMove {
  readonly move: LegalMove;
  readonly score: number;
}

export interface RankedResult {
  /** Best first. Every root move, with a real score rather than a bound. */
  readonly moves: readonly RankedMove[];
  readonly depth: number;
  readonly nodes: number;
}

export function rankMoves(rules: Rules, depth: number): RankedResult | null {
  if (depth < 1) return null;
  const moves = rules.allMoves();
  if (moves.length === 0) return null;

  const counter: Counter = { nodes: 0 };
  const scored: RankedMove[] = [];

  for (const move of moves) {
    rules.move(move.from, move.to, move.promotion ?? undefined);
    // Full window, every time. This is the line that makes the scores comparable.
    const score = -negamax(rules, depth - 1, -Infinity, Infinity, 1, counter, true);
    rules.undo();
    scored.push({ move, score });
  }

  // Stable by score, so an equal-scoring set keeps the order `allMoves` produced and the same
  // position always gives the same hint.
  scored.sort((a, b) => b.score - a.score);
  return { moves: scored, depth, nodes: counter.nodes };
}

/**
 * ==================== "THE SAME LEVEL" IS A MARGIN, NOT AN EQUALITY ====================
 * This filtered on `score === top`, and the hint it produced almost always showed ONE move.
 * Two moves scoring 34 and 33 are not distinguishable by the function that scored them, but
 * they are not `===`, so the second was thrown away.
 *
 * ⚠️ THIRTY IS NOT A THIRD OF A PAWN, and the coincidence is worth not believing. Stockfish
 * has normalised its centipawn since 15.1: `+1.00` means roughly an even chance of winning
 * from here, not a pawn of material — internally a pawn is about 330 units, rescaled before
 * it reaches the UCI output. So this margin is a small shift in WINNING CHANCE, measured
 * against three things:
 *
 *   1. The evaluation disagrees with itself by more than this between iterations. In a quiet
 *      position the same move is 0.24 at depth 18 and 0.11 at 19. Two moves 0.20 apart are
 *      inside the noise of whatever produced both numbers.
 *   2. Above about 0.30 there is usually something concrete to point at — a pawn structure, a
 *      tempo — and a hint that calls those the same thing is teaching something false.
 *   3. A CONSTANT margin narrows itself where it should. In an opening it opens two or three
 *      ideas. In a position where the best move wins a rook (+5.00) and the next is +0.40 it
 *      shows one — and it shows one because there IS one. A proportional margin would widen
 *      exactly where the answer is least ambiguous.
 */
export const SAME_LEVEL_CP = 30;

/** The moves worth calling equally good, best first. At least one whenever there is a legal move. */
export function bestMoves(result: RankedResult, limit = 3): readonly RankedMove[] {
  const top = result.moves[0]?.score;
  if (top === undefined) return [];
  return result.moves.filter((entry) => top - entry.score <= SAME_LEVEL_CP).slice(0, limit);
}

/** The search the game uses. */
export function search(rules: Rules, depth: number): SearchResult | null {
  return run(rules, depth, true);
}

/** Full minimax, for the equivalence test. Not used in play — see the note at the top. */
export function searchWithoutPruning(rules: Rules, depth: number): SearchResult | null {
  return run(rules, depth, false);
}
