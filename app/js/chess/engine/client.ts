// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/engine/client — asking the opponent for a move, from the page's side.
//
// ========================= WHY A WORKER AND NOT A setTimeout =========================
// Measured: depth 3 costs 443 ms. On the main thread that is 443 ms in which the frame loop does
// not tick, the camera does not turn, and — worse — the screen reader's live region does not
// update. Chopping the search into timeslices would fix the frame rate and keep every other
// problem, at the price of a search that has to be written inside out. A worker is the smaller
// change and the honest one.
//
// ========================= STALE REPLIES =========================
// Every request carries an id and only the newest is honoured. Without it, a player who takes a
// move back, restarts, or changes difficulty mid-search gets an answer computed for a position
// that no longer exists — a legal-looking move that is simply wrong, with nothing to indicate it.

import type { LegalMove } from '../rules.ts';
import type { SearchReply, SearchRequest } from './protocol.ts';

export interface EngineMove {
  readonly move: LegalMove;
  readonly score: number;
  readonly nodes: number;
  readonly depth: number;
}

export interface EngineClient {
  /** Resolves with the opponent's move, or null when the position has none. */
  requestMove(fen: string, depth: number): Promise<EngineMove | null>;
  /** Abandons any search in flight. Its reply, if it arrives, is dropped. */
  cancel(): void;
  destroy(): void;
}

/** The worker factory, injectable so a test can supply a stub instead of a real thread. */
export type WorkerFactory = () => Worker;

const defaultWorker: WorkerFactory = () =>
  new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });

export function createEngineClient(makeWorker: WorkerFactory = defaultWorker): EngineClient {
  const worker = makeWorker();
  let nextId = 1;
  let pending: {
    id: number;
    resolve: (value: EngineMove | null) => void;
    reject: (reason: Error) => void;
  } | null = null;

  worker.onmessage = (event: MessageEvent<SearchReply>): void => {
    const reply = event.data;
    // Not the search we are waiting for: the position moved on. Dropping it is the point.
    if (!pending || pending.id !== reply.id) return;

    const settle = pending;
    pending = null;
    if (reply.error) settle.reject(new Error(reply.error));
    else if (!reply.move) settle.resolve(null);
    else {
      settle.resolve({
        move: reply.move, score: reply.score, nodes: reply.nodes, depth: reply.depth,
      });
    }
  };

  worker.onerror = (event: ErrorEvent): void => {
    // A worker that fails and says nothing leaves the game on "thinking" forever.
    if (!pending) return;
    const settle = pending;
    pending = null;
    settle.reject(new Error(event.message || 'engine worker failed'));
  };

  return {
    requestMove(fen, depth) {
      // One search at a time. A second request supersedes the first rather than queueing behind
      // it, because the only position anyone cares about is the current one.
      if (pending) pending.resolve(null);

      const id = nextId++;
      const request: SearchRequest = { id, fen, depth };
      return new Promise<EngineMove | null>((resolve, reject) => {
        pending = { id, resolve, reject };
        worker.postMessage(request);
      });
    },

    cancel() {
      if (!pending) return;
      const settle = pending;
      pending = null;
      settle.resolve(null);
    },

    destroy() {
      pending = null;
      worker.terminate();
    },
  };
}
