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
import { bestMoves, rankMoves, search } from './search.ts';

self.onmessage = (event: MessageEvent<SearchRequest>): void => {
  const { id, fen, depth, kind } = event.data;

  let reply: SearchReply;
  try {
    if (kind === 'hint') {
      // A different search, not the same search read differently — see `rankMoves`. Alpha-beta
      // returns bounds for every root move after the first, so a list of ties taken from it would
      // be a list of moves that merely failed to be proved worse.
      const ranked = rankMoves(createRules(fen), depth);
      const ties = ranked ? bestMoves(ranked) : [];
      reply = {
        id,
        move: ties[0]?.move ?? null,
        ties: ties.map((entry) => entry.move),
        score: ties[0]?.score ?? 0,
        nodes: ranked?.nodes ?? 0,
        depth,
      };
      self.postMessage(reply);
      return;
    }

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
