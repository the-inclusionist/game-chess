// SPDX-License-Identifier: AGPL-3.0-or-later
// teach/lessons — the syllabus, as data.
//
// ========================= ⚠️ EVERY POSITION HERE WAS COMPUTED, NOT GUESSED =========================
// The square sets below are what `rules.legalTargets()` actually returns from these exact FENs, and
// `tests/teach-table.node.test.ts` re-derives every one of them. That is not belt and braces:
// a `mark` step that lists a square the piece cannot reach is unanswerable, and the person who
// discovers it is a child who has done nothing wrong.
//
// ========================= ⚠️ WHERE THE KINGS GO IS PART OF THE LESSON =========================
// chess.js refuses a board without both kings — "Invalid FEN: missing white king" — so a lesson
// that wants an empty board cannot have one. The kings are therefore parked, and WHERE they park
// changes the answer:
//
//   · A bishop on d5 reaches thirteen squares. On `k7/…/7K` it reaches TWELVE, because the white
//     king is standing on h1, which is on its long diagonal. The bishop and queen lessons put the
//     kings on a1 and h8 for exactly that reason; the rook and knight lessons can leave them on a8
//     and h1, because neither piece travels through those.
//   · So a1, h1, a8 and h8 are never `mark` targets. The notation lesson works in the middle of the
//     board, which is also where a beginner needs the names most.
//
// ========================= HOW THE SYLLABUS IS ORDERED =========================
// By `after`, naming lessons rather than by position in this array. A lesson inserted in the middle
// does not silently reorder everything after it, and the ordering can be checked for cycles.

import type { Lesson } from './lesson.ts';

/*
 * ========================= ⚠️ THE LONE PAWNS ARE LEAD BALLAST, NOT DECORATION =========================
 * Four positions here carry one spare pawn that no lesson ever mentions — h7 in `CORNERS` and in
 * the knight's first step, h5 in the bishop's, a7 in the king's. They are there because WITHOUT
 * THEM THOSE FOUR LESSONS CANNOT BE ANSWERED AT ALL, and the way that failed is worth keeping.
 *
 * Two lone kings is insufficient material. So is king and bishop against king, and king and knight
 * against king. `Rules.isGameOver()` is therefore true before a child has touched anything;
 * `chess/state.ts` settles the phase to `over`; and `activate()` answers every square with
 * `{kind:'ignored', reason:'over'}`. The board simply stops responding, with nothing on screen to
 * say why.
 *
 * ⚠️ AND THE TABLE TEST DID NOT SEE IT, because it asks `Rules` and the tutor is answered by
 * `GameState`. `legalTargets()` reports a knight's eight squares perfectly happily in a position
 * no one is allowed to move in. `tests/teach-table.node.test.ts` now builds a `GameState` for
 * every position for exactly this reason.
 *
 * A pawn is the cheapest fix that is also true: any pawn can promote, so its side is never short of
 * material. Each one is parked off the taught piece's lines — h5 is on neither of the bishop's
 * diagonals, and a knight does not care — so no answer set moves. THEY ARE NOT CLUTTER TO BE
 * TIDIED AWAY.
 */

/** Two kings in opposite corners of the LONG diagonal, for pieces that do not travel on it. */
const CORNERS = 'k7/7p/8/8/8/8/8/7K w - - 0 1';

export const LESSONS: readonly Lesson[] = [
  /* ============================ READING THE BOARD ============================ */
  {
    id: 'notation',
    title: 'teach.notation.title',
    steps: [
      {
        // ⚠️ Two kings and nothing else. They sit on a8 and h1, so neither is ever asked for.
        fen: CORNERS,
        say: 'teach.notation.files',
        task: { kind: 'mark', want: ['e4'] },
        nudge: 'teach.notation.files.nudge',
      },
      {
        say: 'teach.notation.ranks',
        task: { kind: 'mark', want: ['c6'] },
        nudge: 'teach.notation.ranks.nudge',
      },
      {
        // The other direction: the board is shown, the NAME is the answer. This is the half a
        // player who cannot see the board still gets, because the marked cell's label says `f3`.
        say: 'teach.notation.name',
        show: { squares: ['f3'] },
        task: { kind: 'pick', options: ['f3', 'c3', 'f6', 'h3'], answer: 0 },
        nudge: 'teach.notation.name.nudge',
      },
      {
        say: 'teach.notation.together',
        task: { kind: 'mark', want: ['b7', 'g2'] },
        nudge: 'teach.notation.together.nudge',
      },
    ],
  },

  /* ============================ WHAT A PIECE IS WORTH ============================ */
  {
    id: 'values',
    title: 'teach.values.title',
    after: ['notation'],
    steps: [
      {
        // The opening position, because the question is about the pieces a player can see.
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        say: 'teach.values.pawn',
        task: { kind: 'pick', options: ['teach.values.one', 'teach.values.three', 'teach.values.five'], answer: 0 },
      },
      {
        say: 'teach.values.rook',
        task: { kind: 'pick', options: ['teach.values.three', 'teach.values.five', 'teach.values.nine'], answer: 1 },
        nudge: 'teach.values.rook.nudge',
      },
      {
        say: 'teach.values.queen',
        task: { kind: 'pick', options: ['teach.values.five', 'teach.values.nine', 'teach.values.one'], answer: 1 },
      },
      {
        // ⚠️ The king is worth nothing on this scale and that is the lesson, not an omission: it is
        // never captured, so counting it would add the same number to both sides in every position
        // that has ever been played. See `chess/material.ts`.
        say: 'teach.values.king',
        task: { kind: 'pick', options: ['teach.values.nine', 'teach.values.everything', 'teach.values.three'], answer: 1 },
        nudge: 'teach.values.king.nudge',
      },
    ],
  },

  /* ============================ HOW EACH PIECE MOVES ============================ */
  {
    id: 'pawn',
    title: 'teach.pawn.title',
    after: ['notation'],
    steps: [
      {
        fen: 'k7/8/8/8/8/8/4P3/7K w - - 0 1',
        say: 'teach.pawn.reach',
        task: { kind: 'mark', reachOf: 'e2', want: ['e3', 'e4'] },
        nudge: 'teach.pawn.reach.nudge',
      },
      {
        say: 'teach.pawn.double',
        task: { kind: 'play', want: { from: 'e2', to: 'e4' } },
        show: { arrows: [['e2', 'e4']] },
        nudge: 'teach.pawn.double.nudge',
      },
      {
        // ⚠️ A pawn takes DIAGONALLY and moves straight, which is the one rule every beginner has
        // to be told twice. Two squares available, and only one of them is a capture.
        fen: 'k7/8/8/3p4/4P3/8/8/7K w - - 0 1',
        say: 'teach.pawn.capture',
        task: { kind: 'play', want: { captures: 'p' } },
        nudge: 'teach.pawn.capture.nudge',
      },
    ],
  },

  {
    id: 'rook',
    title: 'teach.rook.title',
    after: ['pawn'],
    steps: [
      {
        // Kings on a8 and h1: a rook on d5 travels only on the fifth rank and the d file, so
        // neither is in its way.
        fen: 'k7/8/8/3R4/8/8/8/7K w - - 0 1',
        say: 'teach.rook.reach',
        task: {
          kind: 'mark',
          reachOf: 'd5',
          want: ['a5', 'b5', 'c5', 'd1', 'd2', 'd3', 'd4', 'd6', 'd7', 'd8', 'e5', 'f5', 'g5', 'h5'],
        },
        nudge: 'teach.rook.reach.nudge',
      },
      {
        say: 'teach.rook.play',
        task: { kind: 'play', want: { piece: 'r', to: 'd8' } },
        show: { arrows: [['d5', 'd8']] },
      },
    ],
  },

  {
    id: 'bishop',
    title: 'teach.bishop.title',
    after: ['rook'],
    steps: [
      {
        // ⚠️ Kings on a1 and h8, NOT a8 and h1. A bishop on d5 runs through h1, and a king standing
        // there costs it the thirteenth square — which would make the set below unanswerable.
        fen: '7k/8/8/3B3p/8/8/8/K7 w - - 0 1',
        say: 'teach.bishop.reach',
        task: {
          kind: 'mark',
          reachOf: 'd5',
          want: ['a2', 'a8', 'b3', 'b7', 'c4', 'c6', 'e4', 'e6', 'f3', 'f7', 'g2', 'g8', 'h1'],
        },
        nudge: 'teach.bishop.reach.nudge',
      },
      {
        say: 'teach.bishop.colour',
        task: { kind: 'pick', options: ['teach.bishop.light', 'teach.bishop.dark', 'teach.bishop.both'], answer: 1 },
        nudge: 'teach.bishop.colour.nudge',
      },
    ],
  },

  {
    id: 'knight',
    title: 'teach.knight.title',
    after: ['bishop'],
    steps: [
      {
        fen: 'k7/7p/8/3N4/8/8/8/7K w - - 0 1',
        say: 'teach.knight.reach',
        task: { kind: 'mark', reachOf: 'd5', want: ['b4', 'b6', 'c3', 'c7', 'e3', 'e7', 'f4', 'f6'] },
        nudge: 'teach.knight.reach.nudge',
      },
      {
        // The one piece that does not care what is in the way. Same eight squares, a full board.
        fen: 'k7/8/8/2ppp3/2pNp3/2ppp3/8/7K w - - 0 1',
        say: 'teach.knight.jumps',
        task: { kind: 'mark', reachOf: 'd4', want: ['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5'] },
        nudge: 'teach.knight.jumps.nudge',
      },
    ],
  },

  {
    id: 'queen',
    title: 'teach.queen.title',
    after: ['rook', 'bishop'],
    steps: [
      {
        // Kings on a1 and h8 again: the queen inherits the bishop's diagonals.
        fen: '7k/8/8/3Q4/8/8/8/K7 w - - 0 1',
        say: 'teach.queen.reach',
        task: {
          kind: 'mark',
          reachOf: 'd5',
          want: [
            'a2', 'a5', 'a8', 'b3', 'b5', 'b7', 'c4', 'c5', 'c6', 'd1', 'd2', 'd3', 'd4', 'd6',
            'd7', 'd8', 'e4', 'e5', 'e6', 'f3', 'f5', 'f7', 'g2', 'g5', 'g8', 'h1', 'h5',
          ],
        },
        nudge: 'teach.queen.reach.nudge',
      },
      {
        say: 'teach.queen.sum',
        task: { kind: 'pick', options: ['teach.queen.rookBishop', 'teach.queen.rookKnight', 'teach.queen.twoRooks'], answer: 0 },
      },
    ],
  },

  {
    id: 'king',
    title: 'teach.king.title',
    after: ['queen'],
    steps: [
      {
        // The white king is the piece being taught, so the black one goes to the far corner.
        fen: '8/p7/8/3K4/8/8/8/7k w - - 0 1',
        say: 'teach.king.reach',
        task: { kind: 'mark', reachOf: 'd5', want: ['c4', 'c5', 'c6', 'd4', 'd6', 'e4', 'e5', 'e6'] },
        nudge: 'teach.king.reach.nudge',
      },
      {
        say: 'teach.king.slow',
        task: { kind: 'play', want: { piece: 'k' } },
      },
    ],
  },

  /* ============================ THE THREE SPECIAL RULES ============================ */
  {
    id: 'promotion',
    title: 'teach.promotion.title',
    after: ['pawn', 'queen'],
    steps: [
      {
        fen: '7k/P7/8/8/8/8/8/7K w - - 0 1',
        say: 'teach.promotion.reach',
        // ⚠️ ONE SQUARE, and `legalTargets` returns it FOUR TIMES — once per piece the pawn may
        // become. That is why a marked set is a SET: comparing the arrays would ask a child to
        // touch a8 four times.
        task: { kind: 'mark', reachOf: 'a7', want: ['a8'] },
        nudge: 'teach.promotion.reach.nudge',
      },
      {
        say: 'teach.promotion.play',
        task: { kind: 'play', want: { promotion: 'q' } },
        show: { arrows: [['a7', 'a8']] },
        nudge: 'teach.promotion.play.nudge',
      },
    ],
  },

  {
    id: 'enpassant',
    title: 'teach.enpassant.title',
    after: ['pawn'],
    steps: [
      {
        /*
         * ⚠️ THE FEN CARRIES THE EN PASSANT SQUARE, `d6`, and without it this lesson is impossible
         * to express: the right to take en passant exists for exactly one move and belongs to the
         * POSITION, not to the pieces on it. Black has just played d7-d5 past the white pawn.
         */
        fen: 'k7/8/8/3pP3/8/8/8/7K w - d6 0 1',
        say: 'teach.enpassant.reach',
        task: { kind: 'mark', reachOf: 'e5', want: ['d6', 'e6'] },
        nudge: 'teach.enpassant.reach.nudge',
      },
      {
        // Matched by the FLAG, never by the pair of squares — the pawn taken is on d5 and the
        // mover lands on d6, which is the whole strangeness of the rule.
        say: 'teach.enpassant.play',
        task: { kind: 'play', want: { enPassant: true } },
        show: { arrows: [['e5', 'd6']] },
        nudge: 'teach.enpassant.play.nudge',
      },
    ],
  },

  {
    id: 'castling',
    title: 'teach.castling.title',
    after: ['king', 'rook'],
    steps: [
      {
        fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
        say: 'teach.castling.reach',
        // The king's seven squares here include BOTH castles — c1 and g1 — beside its ordinary
        // steps, which is a good way to see that a castle is a king move.
        task: { kind: 'mark', reachOf: 'e1', want: ['c1', 'd1', 'd2', 'e2', 'f1', 'f2', 'g1'] },
        nudge: 'teach.castling.reach.nudge',
      },
      {
        say: 'teach.castling.short',
        task: { kind: 'play', want: { castle: 'king' } },
        show: { arrows: [['e1', 'g1']] },
        nudge: 'teach.castling.short.nudge',
      },
      {
        // A fresh position, because the first castle spent the right.
        fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
        say: 'teach.castling.long',
        task: { kind: 'play', want: { castle: 'queen' } },
        show: { arrows: [['e1', 'c1']] },
        nudge: 'teach.castling.long.nudge',
      },
    ],
  },
  /* ============================ THE ENDGAME, WHICH IS GEOMETRY ============================ */
  /*
   * ⚠️ THESE TWO POSITIONS ARE OURS, AND THAT IS THE POINT. The plan's endgame stage ran into a
   * licence wall — the book it named is by EDWARD Lasker, protected until 2052 — and wrote down
   * the way through: the geometric ideas "são matemática, não texto de ninguém". Nobody owns the
   * observation that a king catches a pawn by stepping inside a square, so a position built from
   * the rule is ours to ship and the prose around it is ours to write.
   *
   * ⚠️ AND THE ANSWERS ARE NOT TYPED IN. `tests/teach-endgame.node.test.ts` recomputes every one of
   * them from `endgame/geometry.ts` — the same file whose own rule was raced against all twelve
   * thousand positions on the board. A `pick` is the one task the table test cannot check, because
   * "which option is right" is a fact about chess rather than about data; this is what closes that.
   */
  {
    id: 'square',
    title: 'teach.square.title',
    after: ['king', 'pawn'],
    steps: [
      {
        // Black king d5, white pawn h4, Black to move: inside the square, and it catches.
        fen: '8/8/8/3k4/7P/8/8/K7 b - - 0 1',
        say: 'teach.square.can',
        task: { kind: 'pick', options: ['teach.square.yes', 'teach.square.no'], answer: 0 },
        nudge: 'teach.square.can.nudge',
      },
      {
        // The same idea one file further away and one rank further on: outside, and it does not.
        fen: '8/8/8/k6P/8/8/8/K7 b - - 0 1',
        say: 'teach.square.cannot',
        task: { kind: 'pick', options: ['teach.square.yes', 'teach.square.no'], answer: 1 },
        nudge: 'teach.square.cannot.nudge',
      },
      {
        /*
         * ⚠️ AND THE RULE AS USUALLY TAUGHT GETS THIS ONE WRONG. "Can the king reach the queening
         * square in time" says no — a6 to a8 is two moves and the pawn needs one. The king does not
         * have to race: it takes the pawn. Racing every position on the board is what found it.
         */
        fen: '8/P7/k7/8/8/8/8/7K b - - 0 1',
        say: 'teach.square.take',
        task: { kind: 'play', want: { from: 'a6', to: 'a7', captures: 'p' } },
        show: { arrows: [['a6', 'a7']] },
        nudge: 'teach.square.take.nudge',
      },
    ],
  },

  {
    id: 'opposition',
    title: 'teach.opposition.title',
    after: ['square'],
    steps: [
      {
        // Kings on e4 and e6 with White to move: Black holds it, because White must give way.
        fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1',
        say: 'teach.opposition.who',
        task: {
          kind: 'pick',
          options: ['teach.opposition.white', 'teach.opposition.black'],
          answer: 1,
        },
        nudge: 'teach.opposition.who.nudge',
      },
      {
        // Two squares between: nobody has it, and one move takes it.
        fen: '8/8/4k3/8/8/4K3/1P6/8 w - - 0 1',
        say: 'teach.opposition.take',
        task: { kind: 'play', want: { from: 'e3', to: 'e4' } },
        show: { arrows: [['e3', 'e4']] },
        nudge: 'teach.opposition.take.nudge',
      },
    ],
  },
];

/**
 * The lessons in the order they should be taken.
 *
 * ⚠️ DERIVED FROM `after`, NOT FROM THE ARRAY ORDER, which is the whole reason `after` exists: a
 * lesson inserted in the middle of the table must not silently reorder everything below it. The
 * sort is stable within a level, so the table's own order still decides between two lessons that
 * are equally ready — `values` and `pawn` both follow `notation` and both keep their place.
 *
 * A cycle would leave lessons unplaced. `tests/teach-table.node.test.ts` proves there is none, so
 * the leftovers are appended rather than dropped: a syllabus that quietly lost a lesson would be
 * worse than one that ends in a slightly odd order.
 */
export function syllabus(): readonly Lesson[] {
  const left = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
  const done = new Set<string>();
  const order: Lesson[] = [];
  let moved = true;
  while (moved && left.size > 0) {
    moved = false;
    for (const [id, lesson] of [...left]) {
      if (!(lesson.after ?? []).every((before) => done.has(before))) continue;
      order.push(lesson);
      done.add(id);
      left.delete(id);
      moved = true;
    }
  }
  return [...order, ...left.values()];
}

/** Where a lesson sits in that order, or -1. */
export function lessonIndex(id: string): number {
  return syllabus().findIndex((lesson) => lesson.id === id);
}

/** A lesson by id, or null. The panel takes a name from storage and storage outlives a rename. */
export function lessonById(id: string): Lesson | null {
  return LESSONS.find((lesson) => lesson.id === id) ?? null;
}
