// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/engine/protocol — what crosses the worker boundary.
//
// A separate module because BOTH sides import it, and a message shape that only one side knows is
// how a worker protocol drifts. Everything here is plain data: a Worker can only carry structured
// clones, so a `Rules` or a `SearchResult` holding methods would not survive the trip.
//
// The `id` is what makes a stale reply harmless. A player who moves again before the opponent has
// answered leaves an in-flight search that is now about the wrong position; the client drops any
// reply whose id it is no longer waiting for, instead of playing a move from a dead branch.

import type { LegalMove } from '../rules.ts';

export interface SearchRequest {
  readonly id: number;
  readonly fen: string;
  readonly depth: number;
}

export interface SearchReply {
  readonly id: number;
  readonly move: LegalMove | null;
  readonly score: number;
  readonly nodes: number;
  readonly depth: number;
  /** Set when the search threw. The client rejects rather than playing nothing in silence. */
  readonly error?: string;
}
