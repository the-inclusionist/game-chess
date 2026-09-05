// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/engine/uci — Stockfish, spoken to in its own protocol.
//
// ========================= WHY A SECOND ENGINE AT ALL =========================
// The negamax in `search.ts` is ours, it is two kilobytes, and it cannot be asked to play at a
// given strength: it has a depth and that is the whole dial. A game meant for a classroom needs a
// number a child can recognise — "1200" means something to someone who has a rating, and "medium"
// does not — and needs a hint that is worth taking, which means a hint from something much
// stronger than the opponent it is hinting against.
//
// ⚠️ THREE ENGINES WERE CONSIDERED AND ONLY ONE QUALIFIES. Lozza and tomitankChess are both real,
// both strong (3167 and 3067 CCRL), and both were read rather than looked up: Lozza's UCI options
// are `Hash` and `MultiPV`, tomitankChess's is `Hash`. NEITHER implements `UCI_LimitStrength` or
// `UCI_Elo`, so neither can be told to play at 1400. That eliminated them before size was even
// consulted — and the size, when it was, went the other way from the guess: Stockfish's smallest
// browser build is 381 KB against Lozza's 640 KB.
//
// This one is bigger, and deliberately: `stockfish-18-lite-single` is 6.98 MB and needs no
// cross-origin isolation, where the 381 KB build needs `COOP`/`COEP` headers a school's proxy may
// not send. An engine that cannot start is not economical.
//
// It is a DYNAMIC import behind a choice, which is the same arrangement the engine already uses
// for the 26 MB of neural voice: deploy weight, not load weight. A player who never asks for
// Stockfish never fetches it.
//
// ========================= WHAT UCI IS, IN ONE PARAGRAPH =========================
// Lines of text in, lines of text out. `uci` asks what it is and it answers with its options and
// `uciok`. `isready` / `readyok` is the handshake that means "I have finished the last thing".
// `position fen <FEN>` sets the board, `go depth N` or `go nodes N` starts a search, `info ...`
// lines stream while it thinks, and `bestmove e2e4` ends it. Nothing is a promise: an engine may
// send `info` lines it likes, in any order, and a parser that requires them is a parser that will
// break on the next version.

/** One `info` line, parsed into the parts worth showing. Every field is optional by protocol. */
export interface Thought {
  readonly depth?: number;
  readonly nodes?: number;
  /** Centipawns from the side to move's view, or a mate distance. */
  readonly score?: number;
  readonly mate?: number;
  /** The line it is considering, in long algebraic: `e2e4 e7e5 g1f3`. */
  readonly line?: readonly string[];
  /** 1 for the best line, 2 for the second, and so on. Only sent with MultiPV. */
  readonly rank?: number;
}

export interface UciOptionSpin {
  readonly min: number;
  readonly max: number;
  readonly value: number;
}

/**
 * Reads `option name UCI_Elo type spin default 1320 min 1320 max 3190` — the engine telling us
 * what it can do. ⚠️ Asked rather than assumed: the floor differs between Stockfish versions, and
 * a hard-coded 1320 would be wrong on the first engine that moved it.
 */
export function parseSpinOption(line: string, name: string): UciOptionSpin | null {
  const pattern = new RegExp(
    `^option name ${name} type spin default (-?\\d+) min (-?\\d+) max (-?\\d+)`,
  );
  const found = pattern.exec(line.trim());
  if (!found) return null;
  return { value: Number(found[1]), min: Number(found[2]), max: Number(found[3]) };
}

/**
 * Reads one `info` line. Unknown tokens are skipped rather than rejected, because an engine is
 * free to add its own and a parser that insists on a shape it has seen before is a parser that
 * breaks on an upgrade.
 */
export function parseInfo(line: string): Thought | null {
  const parts = line.trim().split(/\s+/);
  if (parts[0] !== 'info') return null;

  const out: {
    depth?: number; nodes?: number; score?: number; mate?: number;
    line?: string[]; rank?: number;
  } = {};

  for (let i = 1; i < parts.length; i++) {
    switch (parts[i]) {
      case 'depth': out.depth = Number(parts[++i]); break;
      case 'nodes': out.nodes = Number(parts[++i]); break;
      case 'multipv': out.rank = Number(parts[++i]); break;
      case 'score':
        // `score cp 34` or `score mate -3`. Both exist and they are not the same quantity.
        if (parts[i + 1] === 'cp') { out.score = Number(parts[i + 2]); i += 2; }
        else if (parts[i + 1] === 'mate') { out.mate = Number(parts[i + 2]); i += 2; }
        break;
      case 'pv':
        // `pv` is last by convention: everything after it is the line.
        out.line = parts.slice(i + 1);
        i = parts.length;
        break;
      default: break;
    }
  }

  return Object.keys(out).length ? out : null;
}

/** `bestmove e7e8q ponder ...` → `e7e8q`, or null for `bestmove (none)` in a finished position. */
export function parseBestMove(line: string): string | null {
  const found = /^bestmove\s+(\S+)/.exec(line.trim());
  if (!found || found[1] === '(none)') return null;
  return found[1];
}

/**
 * ========================= HOW A RATING BELOW THE ENGINE'S FLOOR IS HONOURED =========================
 * `UCI_Elo` stops at the engine's own minimum — 1320 in Stockfish 18, read from its `uci` output
 * rather than assumed. Below that the strength has to come from somewhere else, and the honest
 * somewhere is the SEARCH: an engine given a few hundred positions to look at plays badly because
 * it has not seen enough, which is how a beginner plays badly. Asking it to "pretend" would mean
 * random blunders between good moves, which is how nobody plays.
 *
 * The counts are a curve, not a calibration: 1000 gets very little and 1200 gets more. They are
 * labelled as approximate in the panel for that reason.
 */
export function limitFor(elo: number, floor: number): { elo?: number; nodes?: number } {
  if (elo >= floor) return { elo };
  // Roughly doubling per 100 points below the floor, bottoming out where a search is barely a
  // search at all. 1000 lands near 200 nodes; 1200 near 3,000.
  const under = floor - elo;
  const nodes = Math.max(120, Math.round(20000 / 2 ** (under / 100)));
  return { nodes };
}
