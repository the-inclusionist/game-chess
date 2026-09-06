// SPDX-License-Identifier: AGPL-3.0-or-later
// teach/games — the annotated games, as PGN with keys in the comments.
//
// ========================= WHY THIS GAME, AND WHY OURS =========================
// The plan's book stage names Capablanca's *Chess Fundamentals* as the first title, and it is
// waiting on an editorial decision that is not this file's to make: which chapters, and who writes
// the pt-BR and es beside his English. Nothing here forecloses it — `gameLesson` takes his games
// unchanged the day they are chosen.
//
// What this is instead is the shortest complete argument for playing a game through with somebody
// explaining it: Morphy at the Paris opera in 1858, seventeen moves, every one of them a beginner's
// lesson about development. It is the game that gets taught first almost everywhere, and it earns
// that: nothing in it is deep, and every move is a consequence of the move before.
//
// ⚠️ THE SCORE IS A FACT AND THE NOTES ARE OURS. A game's moves are not anybody's expression —
// `docs/LICENSES.md` makes that argument at length, and it is why the moves can come from anywhere.
// The nine notes here were written for this file, in three languages, and are AGPL like the rest of
// it. That is the whole reason this game rather than an annotated one: it needs no permission and
// no opinion, so the mechanism can ship while the book is still being chosen.

import type { AnnotatedGame } from './game-lesson.ts';

/*
 * ⚠️ THE COMMENTS ARE i18n KEYS, and they are numbered by PLY rather than by move. `n17` is the
 * seventeenth half-move, which is 9.Bg5 — and the number is traceable straight back to the game
 * without counting whose turn it was. Numbering by move needs a rule for the side, and the rule is
 * wrong half the time; `rules.commentAt()` states the same thing about its own index.
 *
 * Nine of the thirty-three plies carry one. That is the book being a book: the annotator stops
 * where there is something to say, and `game-lesson.ts` makes exactly those the steps.
 */
const OPERA = `[Event "Paris Opera"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Morphy, Paul"]
[Black "Duke of Brunswick and Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 {teach.book.opera.n5} Bg4 {teach.book.opera.n6} 4. dxe5 Bxf3 5. Qxf3
dxe5 6. Bc4 {teach.book.opera.n11} Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 {teach.book.opera.n17} b5
10. Nxb5 {teach.book.opera.n19} cxb5 11. Bxb5+ Nbd7 12. O-O-O {teach.book.opera.n23} Rd8
13. Rxd7 {teach.book.opera.n25} Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ {teach.book.opera.n31}
Nxb8 17. Rd8# {teach.book.opera.n33} 1-0`;

export const GAMES: readonly AnnotatedGame[] = [
  { id: 'opera', title: 'teach.book.opera.title', pgn: OPERA },
];

/** One game by its bare id, for the shell resolving a `book:` id back to a lesson. */
export function gameById(id: string): AnnotatedGame | undefined {
  return GAMES.find((game) => game.id === id);
}
