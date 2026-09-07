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
];
