// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE EVIDENCE UNDER THE SEARCH'S FAST PATH =========================
// `chess/rules.ts` keeps a second, uglier move interface — `searchMoves` / `searchPlay` /
// `searchUndo`, which pass opaque tokens and build no `MoveResult` at all — and the comment there
// justifies it with two numbers. This is where those numbers come from.
//
// ⚠️ IT USED TO BE `bench.tmp.mjs` IN THE ROOT, referenced by nothing and named as throwaway. The
// numbers it produced are load-bearing: they are the whole argument for a duplicated interface in
// the most-tested module in the game. A measurement whose only surviving form is a number typed
// into a comment cannot be re-checked, and this one has an expiry date — chess.js builds a `before`
// and an `after` FEN for every move it reports verbosely, and the day a release stops doing that,
// the fast path becomes complexity with nothing behind it.
//
// So it is runnable, and it says what it is for:
//
//     node scripts/bench-chess-js.mjs
//
// What the profile found, and it contradicted the guess: the cost was NOT in the terminal tests.
// `isCheckmate()` is 0.32 us. It was in asking for moves the expensive way, fourteen times over.
import { Chess } from 'chess.js';

/** The Italian after 3.Bc4 — a middling branching factor, neither an empty board nor a tactic. */
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1';
const N = 3000;

function time(label, fn) {
  // A fresh game per measurement: `move+undo` would otherwise leave history for the next one.
  const game = new Chess(FEN);
  const started = performance.now();
  for (let i = 0; i < N; i += 1) fn(game);
  const us = ((performance.now() - started) / N) * 1000;
  console.log(`${label.padEnd(30)} ${us.toFixed(2).padStart(8)} us`);
}

time('moves()', (g) => g.moves());
time('moves({verbose:true})', (g) => g.moves({ verbose: true }));
time('isCheck()', (g) => g.isCheck());
time('isCheckmate()', (g) => g.isCheckmate());
time('isDraw()', (g) => g.isDraw());
time('board()', (g) => g.board());
/*
 * The search's hot loop, in the slow spelling. d3 rather than e5: this position has WHITE to move
 * and a white pawn already on e4, so the original line of this benchmark threw `Invalid move` and
 * the row never printed -- for as long as the file existed, because nobody ran it twice.
 */
time('move+undo', (g) => { g.move('d3'); g.undo(); });
