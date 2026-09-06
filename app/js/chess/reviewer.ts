// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/reviewer — the engine watching the game go by, one ply behind.
//
// ========================= ONE SEARCH PER PLY, AND WHY IT IS ENOUGH =========================
// Three features want the same thing: the advantage readout wants what the position is worth, the
// score sheet wants a mark beside each move, and protected mode wants to know a blunder happened.
// All three are answered by evaluating every position once, in order, and comparing neighbours.
//
// A move is judged from the evaluation of the position BEFORE it and the one AFTER it. Both of
// those are positions this game passes through anyway, so nothing is searched twice — the verdict
// on White's move and the verdict on Black's reply share the evaluation of the position between
// them.
//
// ⚠️ THE SIGN. UCI reports from the side to move's point of view, and the side to move changes
// across a move. So the evaluation after has to be NEGATED to be about the player who moved.
// Getting that wrong does not throw and does not look like a bug: it produces a score sheet that
// calls every good move a blunder, which reads as a harsh opinion rather than as an error.
//
// ========================= WHY IT RUNS BEHIND AND NOT AHEAD =========================
// The review of the position the player is looking at runs while they think, which costs nothing
// anybody notices. The review of the position they have just made runs after their move and does
// delay the opponent's reply — by `REVIEW_MS`, once. That is the price of a score sheet that
// marks a move while the move is still the one on the player's mind, and it is paid in the one
// moment where a short pause reads as the machine considering rather than as the machine stuck.

import type { EngineClient } from './engine/client.ts';
import { judge, type Mark, type Verdict } from './review.ts';
import type { Rules } from './rules.ts';
import { type PieceType, type Side, type Square, toAlgebraic } from './types.ts';

/** What the engine thought of one position. Scores are from that position's side to move. */
interface Seen {
  readonly score: number;
  /** Long algebraic, `e2e4` — the one form the engine and the score sheet can both produce. */
  readonly best: string | null;
  /** Best minus second best, in centipawns. Zero when there was only one line. */
  readonly gapToSecond: number;
}

export interface ReviewerDeps {
  readonly rules: Rules;
  readonly engine: EngineClient;
  /** Called whenever a move has been judged, or the evaluation has moved. */
  onChange?(): void;
  /** Called once per move that earns a mark, as soon as it is known. */
  onVerdict?(entry: ReviewedMove): void;
}

export interface ReviewedMove {
  /** How many plies had been played BEFORE this move — its index in `rules.history()`. */
  readonly ply: number;
  readonly side: Side;
  readonly mark: Mark;
  readonly lost: number;
}

export interface Reviewer {
  /**
   * Tell the reviewer the position has changed. Cheap and idempotent: it works out for itself
   * what is new, what it already knows, and what a take-back has undone.
   */
  observe(): void;
  /** The mark beside the move played at this ply, or null while it is still being worked out. */
  markAt(ply: number): Mark;
  /**
   * Whether this ply has been judged. Protected mode waits on it: a warning that arrived after
   * the opponent had replied would be about a position two plies old, and taking the move back
   * would mean unpicking somebody else's move as well.
   */
  judged(ply: number): boolean;
  /** What the engine makes of the position now, in centipawns FROM WHITE. Null until it knows. */
  evaluation(): number | null;
  /** How many outright blunders this side has played in this game. */
  blunders(side: Side): number;
  /**
   * How many of this side's moves the engine has marked as a mistake or worse — `?` and `??`, not
   * `?!`.
   *
   * ⚠️ A COUNT, and it only ever goes up. A player can be winning comfortably and still have
   * played four bad moves getting there; the result flatters them and this does not. Inaccuracies
   * are left out on purpose: a counter that ticks on every slightly imprecise move is a counter
   * nobody looks at twice.
   */
  mistakes(side: Side): number;
  destroy(): void;
}

/**
 * `e2e4`, `e7e8q`. ⚠️ Squares are objects, and comparing two of them by identity or by `String()`
 * both fail silently — the first is always false, the second always `[object Object]` and so
 * always true. Text is the one form the engine and the score sheet can both produce.
 */
const longAlgebraic = (move: { from: Square; to: Square; promotion?: PieceType | null }): string =>
  `${toAlgebraic(move.from)}${toAlgebraic(move.to)}${move.promotion ?? ''}`;

export function createReviewer(deps: ReviewerDeps): Reviewer {
  const { rules, engine } = deps;

  /**
   * ⚠️ WHERE THIS GAME WAS WHEN THE PAGE LOADED. A game is restored from the score sheet on every
   * reload and on every switch between the 2D and 2.5D views, so `history()` can already be four
   * moves long the first time this runs. Numbering the positions from zero and handing them to
   * `history()[index]` put the mark for the move just played beside the FIRST move of the game —
   * a score sheet that opened with `1. e4??` and blamed the player for it.
   *
   * So the positions below are numbered from here, and `base` is what turns one into the other.
   * Moves played before the page loaded are never marked, which is honest: nothing watched them.
   */
  /**
   * ⚠️ ZERO NOW, AND IT USED TO BE `rules.history().length`. The reason it existed was real: a game
   * is restored from the score sheet on every reload and every change of view, so `history()` can
   * already be four moves long the first time this runs, and numbering the positions from zero put
   * the mark for the move just played beside the FIRST move of the game — a score sheet that
   * opened with `1. e4??` and blamed the player for it.
   *
   * The fix was to stop counting from zero. The COST of that fix was that everything before the
   * page loaded went permanently unmarked: reload mid-game and every annotation vanished, and a
   * book loaded whole would arrive with none at all. The plan called that out as needing "correção
   * deliberada, não de contorno".
   *
   * The deliberate correction is to make the earlier positions KNOWN rather than to renumber
   * around them. `rules.positions()` replays them, so index and ply are the same number again and
   * `base` has nothing left to do.
   */
  const base = 0;
  /** Every position of the game, index 0 being the one before the first move. */
  let fens: string[] = [...rules.positions()];
  const seen = new Map<string, Seen>();
  const marks = new Map<number, ReviewedMove>();
  let inFlight: string | null = null;
  let alive = true;

  /** Whose move it is in a position, read off the FEN rather than tracked in parallel. */
  const turnOf = (fen: string): Side => (fen.split(' ')[1] === 'b' ? 'b' : 'w');

  /** `index` counts positions this reviewer has seen; the ply it judges is `base + index`. */
  function judgePly(index: number): void {
    const ply = base + index;
    if (marks.has(ply)) return;
    const before = seen.get(fens[index]);
    const after = seen.get(fens[index + 1]);
    if (!before || !after) return;

    const move = rules.history()[ply];
    if (!move) return;

    const entry: ReviewedMove = {
      ply,
      side: turnOf(fens[index]),
      ...verdictOf(before, after, longAlgebraic(move)),
    };
    marks.set(ply, entry);
    deps.onVerdict?.(entry);
    deps.onChange?.();
  }

  function verdictOf(before: Seen, after: Seen, played: string): Verdict {
    return judge({
      before: before.score,
      // ⚠️ NEGATED. `after` is scored for whoever is on move in it, which is the other player.
      after: -after.score,
      wasBest: before.best === played,
      gapToSecond: before.gapToSecond,
    });
  }

  function pump(): void {
    if (!alive || inFlight) return;
    // Newest first: the position on the board is the one the readout is about, and the one whose
    // verdict the player is waiting for. Older gaps — after a take-back, say — are filled after.
    const wanted = [...fens].reverse().find((fen) => !seen.has(fen));
    if (!wanted) return;

    inFlight = wanted;
    void engine.requestReview(wanted)
      .then((result) => {
        if (!alive || !result) return;
        const [best, second] = result.lines;
        seen.set(wanted, {
          score: result.score,
          best: best ? longAlgebraic(best.move) : null,
          // No second line means the engine found one legal move, and a compliment for playing
          // the only legal move in the position would be a joke at the player's expense.
          gapToSecond: best && second ? best.score - second.score : 0,
        });
        deps.onChange?.();
        for (let ply = 0; ply < fens.length - 1; ply++) judgePly(ply);
      })
      .catch(() => { /* a search that failed is a mark that does not appear. Nothing else. */ })
      .finally(() => {
        inFlight = null;
        pump();
      });
  }

  return {
    observe() {
      const played = rules.history().length - base;
      // ⚠️ A take-back does not merely shorten the list — it can be followed by a DIFFERENT move,
      // so every position after the new end is no longer this game's. Truncating here is what
      // stops a mark from a line that was abandoned turning up beside the move that replaced it.
      if (fens.length > played + 1) {
        fens = fens.slice(0, played + 1);
        for (const ply of [...marks.keys()]) if (ply >= base + played) marks.delete(ply);
      }
      const fen = rules.fen();
      if (fens[fens.length - 1] !== fen) fens.push(fen);
      pump();
      for (let ply = 0; ply < fens.length - 1; ply++) judgePly(ply);
    },

    markAt: (ply) => marks.get(ply)?.mark ?? null,

    /*
     * ⚠️ NO LONGER "ANYTHING OLD COUNTS AS JUDGED". It used to, because nothing was ever going to
     * mark those plies; now everything will, so the honest answer is whether it HAS been.
     *
     * Nothing waits longer for it. The only caller is protected mode, which asks about the ply
     * just played — and `pump` works NEWEST FIRST precisely because that is the one somebody is
     * waiting on. The backfill happens behind it, one position at a time, on the same queue.
     */
    judged: (ply) => marks.has(ply),

    evaluation() {
      const current = seen.get(fens[fens.length - 1]);
      if (!current) return null;
      // From WHITE, always, so the readout does not flip its own sign every half move.
      return turnOf(fens[fens.length - 1]) === 'w' ? current.score : -current.score;
    },

    mistakes(side) {
      let count = 0;
      for (const entry of marks.values()) {
        if (entry.side === side && (entry.mark === '?' || entry.mark === '??')) count++;
      }
      return count;
    },

    blunders(side) {
      let count = 0;
      for (const entry of marks.values()) if (entry.side === side && entry.mark === '??') count++;
      return count;
    },

    destroy() { alive = false; },
  };
}
