// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/engine/engine.worker — the opponent, on its own thread.
//
// It holds no state between messages: every request carries a FEN and the position is rebuilt
// from it. That costs a fraction of a millisecond against a search measured in hundreds, and it
// removes the whole class of bug where the worker's board and the page's board drift apart.
//
// Vite compiles this from `new Worker(new URL('./engine.worker.ts', import.meta.url), {type:'module'})`.

import { createRules } from '../rules.ts';
import type { SearchReply, SearchRequest } from './protocol.ts';
import { search } from './search.ts';

self.onmessage = (event: MessageEvent<SearchRequest>): void => {
  const { id, fen, depth } = event.data;

  let reply: SearchReply;
  try {
    const best = search(createRules(fen), depth);
    reply = best
      ? { id, move: best.move, score: best.score, nodes: best.nodes, depth: best.depth }
      : { id, move: null, score: 0, nodes: 0, depth };
  } catch (error) {
    // A worker that dies quietly leaves the game stuck on "thinking" forever. Reporting the
    // failure lets the client reject, and lets the page say so out loud.
    reply = {
      id,
      move: null,
      score: 0,
      nodes: 0,
      depth,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  self.postMessage(reply);
};
