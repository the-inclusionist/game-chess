// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/engine/stockfish-client — the same EngineClient interface, backed by Stockfish.
//
// ========================= WHY IT WEARS THE SAME INTERFACE =========================
// The composition roots ask an engine for a move and for a hint and know nothing else about it.
// Making Stockfish satisfy `EngineClient` rather than teaching the roots a second vocabulary is
// what keeps the choice of engine a SETTING and not a fork in the game: `requestMove` and
// `requestHint` mean the same things, the stale-reply id matching works the same way, and every
// caller is unchanged.
//
// ========================= THE ONE THING THIS ADDS =========================
// `onThought` — the `info` lines as they arrive. Our own negamax is silent until it answers; a UCI
// engine narrates, and that narration is the panel below the board. It is a callback rather than
// part of the promise because it happens MANY times per search, and a promise resolves once.

import type { LegalMove } from '../rules.ts';
import { fromAlgebraic, type PieceType } from '../types.ts';
import type { EngineClient, EngineMove } from './client.ts';
import { HINT_LIMIT, sameLevel } from './same-level.ts';
import { limitFor, parseBestMove, parseInfo, parseSpinOption, type Thought } from './uci.ts';

/** Where the vendored build lives, served from this origin. */
const ENGINE_URL = '/vendor/engine/stockfish-18-lite-single.js';
const WASM_URL = '/vendor/engine/stockfish-18-lite-single.wasm';

/** How long the opponent thinks, and how long a hint thinks. Milliseconds. */
const MOVE_MS = 600;
const HINT_MS = 2400;

/** Long algebraic — `e2e4`, `e7e8q` — into this game's own move shape. */
export function toMove(token: string): LegalMove | null {
  const from = fromAlgebraic(token.slice(0, 2));
  const to = fromAlgebraic(token.slice(2, 4));
  if (!from || !to) return null;
  const promotion = token.length > 4 ? (token[4] as PieceType) : null;
  return { from, to, promotion };
}

export interface StockfishOptions {
  /** Called for every `info` line the engine sends, in order. */
  onThought?(thought: Thought): void;
  /** Injected so a test can drive the protocol without loading seven megabytes of WebAssembly. */
  load?: () => Promise<UciEngine>;
}

/** The shape the Stockfish build exposes: lines in, lines out. */
export interface UciEngine {
  postMessage(command: string): void;
  addMessageListener(listener: (line: string) => void): void;
  terminate?(): void;
}

export interface StockfishClient extends EngineClient {
  /** Elo the engine is asked to play at. Clamped to what it says it supports. */
  setStrength(elo: number): void;
  /** What the engine declared it can do, once it has said `uciok`. */
  ready(): Promise<{ minElo: number; maxElo: number }>;
}

/**
 * ========================= IT IS A WORKER SCRIPT, NOT A MODULE =========================
 * ⚠️ Read from the file rather than assumed, after a first attempt to `import()` it produced
 * nothing at all: this build is written to be RUN as a Web Worker. It reads the WebAssembly's URL
 * out of its own `location.hash`, installs an `onmessage`, and answers by `postMessage`. There is
 * no ESM export to import.
 *
 * Which turns out better than the import would have been, on two counts. The 6.98 MB never touches
 * the bundler — it is fetched at run time, by the worker, from `/vendor/`, so a player who never
 * chooses Stockfish never asks for a byte of it. And the search runs off the main thread for free,
 * which is the same reason `engine.worker.ts` exists for our own negamax: a search on the main
 * thread is a frame loop that stops and a live region that does not update.
 *
 * The hash defaults to the script's own path with `.wasm` in place of `.js`, which is exactly
 * where the file sits — so it is passed explicitly anyway, because relying on a default that
 * happens to match is how a file move becomes a silent failure.
 */
const defaultLoad = async (): Promise<UciEngine> => {
  const worker = new Worker(`${ENGINE_URL}#${WASM_URL}`);
  const listeners: ((line: string) => void)[] = [];
  worker.onmessage = (event: MessageEvent<string>): void => {
    const line = typeof event.data === 'string' ? event.data : String(event.data);
    for (const listener of [...listeners]) listener(line);
  };
  return {
    postMessage: (command) => worker.postMessage(command),
    addMessageListener: (listener) => { listeners.push(listener); },
    terminate: () => worker.terminate(),
  };
};

export function createStockfishClient(options: StockfishOptions = {}): StockfishClient {
  const load = options.load ?? defaultLoad;

  let engine: UciEngine | null = null;
  let limits = { minElo: 1320, maxElo: 3190 };
  let elo = 1320;

  let nextId = 1;
  let pending: {
    id: number;
    resolve: (value: EngineMove | null) => void;
    reject: (reason: Error) => void;
    /** A hint collects every MultiPV line; a move only needs the last `bestmove`. */
    readonly hint: boolean;
    best: Map<number, { move: string; score: number }>;
    depth: number;
    nodes: number;
  } | null = null;

  const send = (command: string): void => { engine?.postMessage(command); };

  function onLine(line: string): void {
    const spin = parseSpinOption(line, 'UCI_Elo');
    if (spin) limits = { minElo: spin.min, maxElo: spin.max };

    const info = parseInfo(line);
    if (info) {
      // ⚠️ Only the FIRST line reaches the panel. With MultiPV the engine reports four, and the
      // last one to arrive is the fourth-best — so the panel was showing a line the engine had
      // just decided against while the announcement named the move it had chosen. Rank 1 is what
      // "it is thinking about this" means; the rest are for the tie list and nothing else.
      if ((info.rank ?? 1) === 1) options.onThought?.(info);
      if (pending) {
        if (info.depth !== undefined) pending.depth = info.depth;
        if (info.nodes !== undefined) pending.nodes = info.nodes;
        // MultiPV numbers its lines; without it every `pv` is the current best.
        if (info.line?.length) {
          pending.best.set(info.rank ?? 1, {
            move: info.line[0],
            // ⚠️ A mate carries its DISTANCE. Flattening every mate to the same 100000 was fine
            // while ties were exact matches and useless the moment they became a margin: mate in
            // one and mate in seven would have arrived as "the same level", which is the one
            // place a hint must not shrug. A thousand a move puts them far outside the margin
            // while leaving mates of equal length tied, which they are.
            score: info.score ?? (info.mate !== undefined
              ? Math.sign(info.mate) * (100000 - Math.abs(info.mate) * 1000)
              : 0),
          });
        }
      }
      return;
    }

    if (!line.startsWith('bestmove') || !pending) return;

    const settle = pending;
    pending = null;
    const token = parseBestMove(line);
    const best = token ? toMove(token) : null;
    if (!best) { settle.resolve(null); return; }

    // ⚠️ WITHIN A MARGIN, not equal to. Stockfish's MultiPV lines essentially never carry the
    // same number, so filtering on equality gave a hint that showed one move and called it the
    // only idea. `SAME_LEVEL_CP` is shared with our own engine so the two mean the same thing by
    // "the same level" — see the note on it for why thirty, and why it is not a third of a pawn.
    //
    // What "the same" means is still the ENGINE'S opinion at the depth it reached, which is
    // exactly what the panel below the board says out loud.
    const ranked = [...settle.best.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    const top = ranked[0]?.score;
    const ties = settle.hint && top !== undefined
      ? sameLevel(ranked, HINT_LIMIT)
        .map((entry) => toMove(entry.move))
        .filter((move): move is LegalMove => move !== null)
      : [];

    settle.resolve({
      move: best,
      score: top ?? 0,
      nodes: settle.nodes,
      depth: settle.depth,
      ties,
    });
  }

  let started: Promise<{ minElo: number; maxElo: number }> | null = null;

  const start = (): Promise<{ minElo: number; maxElo: number }> => {
    started ??= (async () => {
      engine = await load();
      engine.addMessageListener(onLine);
      send('uci');
      await new Promise<void>((resolve) => {
        const wait = (line: string): void => { if (line.trim() === 'uciok') resolve(); };
        engine?.addMessageListener(wait);
        // Some builds have already sent `uciok` by the time a second listener is added.
        setTimeout(resolve, 3000);
      });
      return limits;
    })();
    return started;
  };

  async function ask(fen: string, hint: boolean): Promise<EngineMove | null> {
    await start();
    if (pending) { pending.resolve(null); pending = null; }

    const id = nextId++;
    // A hint is FULL STRENGTH, always. It is the one thing in the game that should not be as weak
    // as the opponent: a hint from a 1000-rated engine is worse than no hint.
    const limit = hint ? { elo: limits.maxElo } : limitFor(elo, limits.minElo);

    send(`setoption name UCI_LimitStrength value ${hint || limit.elo === undefined ? 'false' : 'true'}`);
    if (limit.elo !== undefined && !hint) send(`setoption name UCI_Elo value ${limit.elo}`);
    send(`setoption name MultiPV value ${hint ? 4 : 1}`);
    send(`position fen ${fen}`);

    // ========================= TIME, NOT DEPTH =========================
    // ⚠️ The `depth` this method is handed comes from OUR difficulty ladder, where 3 is a real
    // opponent. Handed to Stockfish it is nothing at all — the first hint came back at depth 2,
    // which is not what "full strength" means to anybody.
    //
    // For this engine the strength is `UCI_Elo` and the search should simply be long enough for
    // that dial to mean something. Time is the honest bound in a classroom, too: a move arrives
    // when it is promised to, on whatever laptop the school has.
    //
    // A hint gets four times as long AND no limiter, because a hint from an opponent as weak as
    // the opponent is worse than no hint.
    if (limit.nodes !== undefined && !hint) send(`go nodes ${limit.nodes}`);
    else send(`go movetime ${hint ? HINT_MS : MOVE_MS}`);

    return new Promise<EngineMove | null>((resolve, reject) => {
      pending = { id, resolve, reject, hint, best: new Map(), depth: 0, nodes: 0 };
    });
  }

  return {
    requestMove(fen) { return ask(fen, false); },
    requestHint(fen) { return ask(fen, true); },

    setStrength(next) { elo = next; },
    ready: start,

    cancel() {
      if (!pending) return;
      const settle = pending;
      pending = null;
      send('stop');
      settle.resolve(null);
    },

    destroy() {
      send('quit');
      engine?.terminate?.();
      engine = null;
      started = null;
    },
  };
}
