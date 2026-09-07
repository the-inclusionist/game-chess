// SPDX-License-Identifier: AGPL-3.0-or-later
// teach/fundamentals — Capablanca's curriculum, taught with our own words.
//
// ========================= WHAT IS HIS AND WHAT IS OURS =========================
// *Chess Fundamentals* (1921) is in the public domain in Brazil: Capablanca died in 1942, and he
// wrote it in English himself, so there is no translator's separate term to clear. Its CURRICULUM
// — which ideas come in which order, starting from the elementary mates — is a fact about the book
// and is what this file follows.
//
// ⚠️ THE PROSE HERE IS OURS, IN ALL THREE LANGUAGES, AND THAT WAS A DECISION RATHER THAN A
// SHORTCUT. Two of them always were: the plan settled long ago that pt-BR and es would be new work
// of ours, because no chess classic exists in Portuguese at all. The English is ours as well, for
// two reasons that point the same way:
//
//  · A 1921 explanation addressed to an adult reader is not the sentence a child needs. Every
//    string in this game goes to `#sr-status` and is read out loud; the catalogues say why they
//    are short.
//  · The positions and the technique are FACTS. Nobody owns the observation that a rook and a king
//    mate a lone king by cutting it off rank by rank, any more than anybody owns the rule of the
//    square — `endgame/geometry.ts` makes that argument at length, and it is the same argument.
//
// So this is not a transcription and must not be described as one. `docs/LICENSES.md` carries the
// distinction; the README says what it is.
//
// ========================= WHY A SEPARATE FILE AND NOT A SEPARATE TABLE =========================
// One table, `LESSONS`, is what makes `syllabus()`, `lessonIndex`, the column, the reach test and
// the table test all work without knowing where a lesson came from. So these are spread into it
// rather than kept apart — the file is a source boundary, not a second mechanism. The book has
// thirty-three sections and fourteen games; it will not fit in `lessons.ts`, and it does not have
// to be anywhere else either.

import type { Lesson } from './lesson.ts';

/**
 * Chapter I, §1 — the elementary mates.
 *
 * ⚠️ EVERY POSITION HERE IS DELIBERATELY SUFFICIENT MATERIAL, which is not automatic and cost this
 * repository four dead lessons once already: king and rook, king and queen and king and two
 * bishops all mate, so `isGameOver()` is false and the board answers. The lessons that needed a
 * spare pawn as ballast are the ones teaching a piece that cannot mate on its own.
 */
export const FUNDAMENTALS: readonly Lesson[] = [
  {
    id: 'materook',
    title: 'teach.materook.title',
    // After the opposition, because the mate ends with the two kings facing each other and that
    // idea is easier to meet on its own first.
    after: ['opposition'],
    steps: [
      {
        // King and rook against a lone king, from the corner the rook starts in.
        fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
        say: 'teach.materook.cut',
        task: { kind: 'play', want: { from: 'a1', to: 'a7' } },
        show: { arrows: [['a1', 'a7']] },
        nudge: 'teach.materook.cut.nudge',
      },
      {
        /*
         * ⚠️ ITS OWN FEN, because Black's reply is not a goal. `teach/position.ts` rebuilds a step
         * by replaying the `play` goals before it, so a step that only continued would be rebuilt
         * one ply short — with the wrong side to move. The same reason every puzzle step carries
         * one.
         */
        fen: '3k4/R7/8/8/8/8/8/4K3 w - - 0 1',
        say: 'teach.materook.walk',
        task: { kind: 'play', want: { from: 'e1', to: 'e2' } },
        show: { arrows: [['e1', 'e2']] },
        nudge: 'teach.materook.walk.nudge',
      },
      {
        // The kings facing each other with one square between them: the opposition, doing the work.
        fen: '3k4/R7/3K4/8/8/8/8/8 w - - 0 1',
        say: 'teach.materook.mate',
        task: { kind: 'play', want: { from: 'a7', to: 'a8' } },
        show: { arrows: [['a7', 'a8']] },
        nudge: 'teach.materook.mate.nudge',
      },
    ],
  },
  {
    id: 'matequeen',
    title: 'teach.matequeen.title',
    after: ['materook'],
    steps: [
      {
        fen: '4k3/8/8/8/8/8/8/Q3K3 w - - 0 1',
        say: 'teach.matequeen.cut',
        task: { kind: 'play', want: { from: 'a1', to: 'a7' } },
        show: { arrows: [['a1', 'a7']] },
        nudge: 'teach.matequeen.cut.nudge',
      },
      {
        /*
         * ⚠️ THE POSITION IS ONE MOVE BEFORE THE MISTAKE, NOT THE MISTAKE ITSELF. A stalemated
         * board is `isGameOver()`, so a step could not be set in one at all — the phase would
         * settle to `over` and the board would refuse every square. Asking about the move instead
         * teaches the same thing and leaves a position somebody can play from.
         */
        fen: '7k/8/8/5Q2/8/8/8/K7 w - - 0 1',
        say: 'teach.matequeen.trap',
        task: {
          kind: 'pick',
          options: [
            'teach.matequeen.stalemate',
            'teach.matequeen.checkmate',
            'teach.matequeen.nothing',
          ],
          answer: 0,
        },
        nudge: 'teach.matequeen.trap.nudge',
      },
      {
        fen: '4k3/Q7/4K3/8/8/8/8/8 w - - 0 1',
        say: 'teach.matequeen.mate',
        task: { kind: 'play', want: { from: 'a7', to: 'a8' } },
        show: { arrows: [['a7', 'a8']] },
        nudge: 'teach.matequeen.mate.nudge',
      },
    ],
  },
  {
    /*
     * ⚠️ THE ONLY ONE OF THE THREE THAT NEEDS A CORNER, and that is the entire lesson. A rook or a
     * queen mates against any edge; two bishops cannot — the defending king has to be driven all
     * the way into a corner first, which is why this mate takes fourteen moves and the others take
     * ten and under.
     *
     * Taught in three steps rather than played out. Fourteen moves of technique is a lesson nobody
     * finishes, and the thing worth carrying away is not the move order: it is that the edge is
     * not enough.
     */
    id: 'matebishops',
    title: 'teach.matebishops.title',
    after: ['matequeen'],
    steps: [
      {
        // The black king already on the edge, and the answer is still "not yet".
        fen: '4k3/8/8/8/8/8/8/K1BB4 w - - 0 1',
        say: 'teach.matebishops.corner',
        task: {
          kind: 'pick',
          options: [
            'teach.matebishops.needcorner',
            'teach.matebishops.edgeisenough',
            'teach.matebishops.impossible',
          ],
          answer: 0,
        },
        nudge: 'teach.matebishops.corner.nudge',
      },
      {
        /*
         * ⚠️ `reachOf` IS FOR THE TEST, and it is what makes this answer an invariant rather than a
         * list somebody maintains by hand: `teach-table.node.test.ts` re-derives these seven
         * squares from `legalTargets` and would catch a typo the compiler cannot see.
         */
        fen: '4k3/8/8/8/8/8/8/K1BB4 w - - 0 1',
        say: 'teach.matebishops.diagonal',
        task: {
          kind: 'mark',
          want: ['c2', 'b3', 'a4', 'e2', 'f3', 'g4', 'h5'],
          reachOf: 'd1',
        },
        show: { squares: ['d1'] },
        nudge: 'teach.matebishops.diagonal.nudge',
      },
      {
        // The corner reached, the two bishops on neighbouring diagonals, the king holding a7 and
        // b7. One bishop steps onto the long diagonal and there is nowhere left.
        fen: 'k7/2B5/1K6/8/8/7B/8/8 w - - 0 1',
        say: 'teach.matebishops.mate',
        task: { kind: 'play', want: { from: 'h3', to: 'g2' } },
        show: { arrows: [['h3', 'g2']] },
        nudge: 'teach.matebishops.mate.nudge',
      },
    ],
  },
  {
    /*
     * ========================= §2 PAWN PROMOTION, AND WHAT IS PROVABLE IN IT =========================
     * Capablanca's §2 is mostly king-and-pawn against king, and the truth of those positions is
     * "White wins" or "this is drawn" — claims a chess LIBRARY cannot settle. `chess.js` will say
     * whether a move is legal and whether a position is mate; it will not say whether an ending is
     * won, and neither will our own search at any depth a lesson could wait for.
     *
     * ⚠️ SO THIS LESSON TEACHES THE HALF OF §2 THAT IS A FACT ABOUT THE POSITION IN FRONT OF YOU.
     * The rule of the square and the opposition — the two ideas that decide those endings — already
     * ship, generated from `endgame/geometry.ts` and raced against every position on the board.
     * What is left, and is worth a lesson of its own, is that the queen is not automatically the
     * right piece to ask for.
     *
     * Every claim here was checked against the rules before it was written: `c8=N+` is check, and
     * Black's only replies are four king moves, so the queen cannot be saved. `c8=Q` is not check
     * and leaves Black twenty-three.
     */
    id: 'underpromotion',
    title: 'teach.underpromotion.title',
    after: ['promotion', 'knight'],
    steps: [
      {
        /*
         * ⚠️ THE BALLAST PAWN ON h2 IS DOING A JOB. Without it, winning the queen leaves king and
         * knight against king — insufficient material, an immediate draw — and a child would be
         * congratulated on a combination and then told the game was over. It is the same fix, for
         * the same reason, as the spare pawn in the piece lessons.
         */
        fen: '8/k1P1q3/8/8/8/8/7P/6K1 w - - 0 1',
        say: 'teach.underpromotion.always',
        task: {
          kind: 'pick',
          options: ['teach.underpromotion.notalways', 'teach.underpromotion.alwaysqueen'],
          answer: 0,
        },
        nudge: 'teach.underpromotion.always.nudge',
      },
      {
        fen: '8/k1P1q3/8/8/8/8/7P/6K1 w - - 0 1',
        say: 'teach.underpromotion.choose',
        // Any promotion to a knight — there is one pawn, so it is this one.
        task: { kind: 'play', want: { promotion: 'n' } },
        show: { arrows: [['c7', 'c8']] },
        nudge: 'teach.underpromotion.choose.nudge',
      },
      {
        // Black had four king moves and none of them defends e7.
        fen: 'k1N5/4q3/8/8/8/8/7P/6K1 w - - 0 1',
        say: 'teach.underpromotion.take',
        task: { kind: 'play', want: { from: 'c8', to: 'e7' } },
        show: { arrows: [['c8', 'e7']] },
        nudge: 'teach.underpromotion.take.nudge',
      },
    ],
  },
  {
    /*
     * ========================= §3 PAWN ENDINGS, AND THE SAME LINE AS §2 =========================
     * Most of §3 is "this ending is won" and "this one is drawn", which nothing in this repository
     * can settle — see the note on `underpromotion` above. The two ideas that decide those endings
     * already ship, generated from `endgame/geometry.ts`.
     *
     * ⚠️ THE BREAKTHROUGH IS DIFFERENT, AND THAT IS WHY IT IS HERE. It is not a judgement about a
     * position: it is a FORCED SEQUENCE, and every move in it is legal or it is not. Three pawns
     * against three, nobody's king in reach, and White gives away two of them to queen the third.
     *
     * Verified before it was written, and both of Black's captures come to the same thing:
     *   1.b6 axb6 2.c6 bxc6 3.a6 — and the a-pawn runs.
     *   1.b6 cxb6 2.a6 bxa6 3.c6 — the mirror image.
     *
     * ⚠️ AND IT PAYS THE SQUARE LESSON BACK. Why the pawn cannot be caught is exactly the rule the
     * `square` lesson taught, so this is the first place in the course where one lesson is the
     * ANSWER to another. `tests/teach-fundamentals.node.test.ts` re-derives that with
     * `catchesPawn`, rather than my saying so.
     */
    id: 'breakthrough',
    title: 'teach.breakthrough.title',
    after: ['square', 'pawn'],
    steps: [
      {
        // Three against three, and the kings are in the far corner where neither can interfere.
        fen: '7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1',
        say: 'teach.breakthrough.push',
        task: { kind: 'play', want: { from: 'b5', to: 'b6' } },
        show: { arrows: [['b5', 'b6']] },
        nudge: 'teach.breakthrough.push.nudge',
      },
      {
        // Its own FEN: Black's capture is not a goal, so nothing would replay it.
        fen: '7k/1pp5/1p6/P1P5/8/8/8/7K w - - 0 2',
        say: 'teach.breakthrough.again',
        task: { kind: 'play', want: { from: 'c5', to: 'c6' } },
        show: { arrows: [['c5', 'c6']] },
        nudge: 'teach.breakthrough.again.nudge',
      },
      {
        fen: '7k/2p5/1pp5/P7/8/8/8/7K w - - 0 3',
        say: 'teach.breakthrough.run',
        task: { kind: 'play', want: { from: 'a5', to: 'a6' } },
        show: { arrows: [['a5', 'a6']] },
        nudge: 'teach.breakthrough.run.nudge',
      },
    ],
  },
  {
    /*
     * ========================= §4, AND WHAT WAS ALREADY COVERED =========================
     * The two hundred Lichess tactics already ship five themes — mate in one, mate in two, fork,
     * pin, hanging piece. §4 is "some winning positions in the middle-game", and picking a pattern
     * those five already drill would be a lesson that teaches nothing new and a menu entry that
     * repeats itself.
     *
     * The back rank is the one that is missing, and it is the most valuable pattern a beginner can
     * carry: it decides more club games than every combination in the book put together, and it
     * has a DEFENCE that is one quiet move, which is the half nobody teaches.
     *
     * ⚠️ AND THE POSITION CORRECTED THE LESSON I MEANT TO WRITE. I expected the king to have no
     * squares at all. It has two — f8 and h8 — and BOTH ARE ON THE BACK RANK, which is precisely
     * why a rook arriving there is mate rather than check. The first step asks for exactly those
     * two squares, re-derived by `reachOf`.
     */
    id: 'backrank',
    title: 'teach.backrank.title',
    // The book's own order. `after` is prerequisites rather than chapter numbers everywhere else,
    // and here they coincide: this is Chapter I §4 and it follows §3.
    after: ['breakthrough'],
    steps: [
      {
        /*
         * ⚠️ BLACK TO MOVE, so the king's squares are real and `legalTargets` can be asked for
         * them. With White to move `legalTargets('g8')` is empty — correctly, it is not Black's
         * turn — and the marked set would have had nothing to check it against.
         */
        fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1',
        say: 'teach.backrank.boxed',
        task: { kind: 'mark', want: ['f8', 'h8'], reachOf: 'g8' },
        show: { squares: ['g8'] },
        nudge: 'teach.backrank.boxed.nudge',
      },
      {
        fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
        say: 'teach.backrank.mate',
        task: { kind: 'play', want: { from: 'a1', to: 'a8' } },
        show: { arrows: [['a1', 'a8']] },
        nudge: 'teach.backrank.mate.nudge',
      },
      {
        /*
         * The other side of it, and the reason this lesson is worth more than a tactic: the
         * defence. Without the pawn move, Black's Ra1 is mate; with it, Ra1 is a check the king
         * steps out of. Verified both ways.
         */
        fen: 'r5k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1',
        say: 'teach.backrank.air',
        task: { kind: 'play', want: { from: 'h2', to: 'h3' } },
        show: { arrows: [['h2', 'h3']] },
        nudge: 'teach.backrank.air.nudge',
      },
    ],
  },
];
