// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE CONVERTER IS WHERE THE PLY OFFSET COULD COME BACK =========================
// `tests/puzzles.node.test.ts` proves the shipped file has the offset right: the student moves
// first, a `mateIn1` is mate after ONE move. All of that can still be thrown away here, by a
// converter that turns the wrong plies into steps — and the result would be a lesson that asks a
// child to play the opponent's move, from a position they were never shown, with nothing throwing.
//
// So the whole shipped set is converted and re-checked against the rules, rather than a fixture.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isPuzzleId, puzzleId, puzzleLesson } from '../app/js/teach/puzzle-lesson.ts';
import { isStudentMove, type Puzzle, type PuzzleSet } from '../app/js/puzzles/puzzle.ts';
import { positionFor } from '../app/js/teach/position.ts';
import { matchesShape } from '../app/js/teach/lesson.ts';
import { createRules } from '../app/js/chess/rules.ts';
import { createGameState } from '../app/js/chess/state.ts';

const set = JSON.parse(readFileSync('app/data/puzzles.json', 'utf8')) as PuzzleSet;
const lessons = set.puzzles.map((p) => ({ puzzle: p, lesson: puzzleLesson(p) }));

describe('[Convert] every shipped puzzle becomes a lesson', () => {
  it('converts all of them', () => {
    for (const { puzzle, lesson } of lessons) {
      expect(`${puzzle.id}: ${lesson !== null}`).toBe(`${puzzle.id}: true`);
    }
    expect(lessons.length).toBeGreaterThanOrEqual(100);
  });

  it('gives a step per STUDENT move, and not one per ply', () => {
    /*
     * ⚠️ THE OPPONENT ANSWERS BY ITSELF, so its replies are not steps. A converter that made a step
     * per ply would ask a child to play the opponent's move — which is legal, and which the tutor
     * would happily accept, and which is not the puzzle.
     */
    for (const { puzzle, lesson } of lessons) {
      const student = puzzle.solution.filter((_, i) => isStudentMove(i)).length;
      expect(`${puzzle.id}: ${lesson!.steps.length}`).toBe(`${puzzle.id}: ${student}`);
    }
  });

  it('namespaces the id so a puzzle can never be mistaken for a lesson', () => {
    expect(puzzleId(set.puzzles[0]!)).toBe(`puzzle:${set.puzzles[0]!.id}`);
    expect(isPuzzleId(puzzleId(set.puzzles[0]!))).toBe(true);
    expect(isPuzzleId('notation')).toBe(false);
  });
});

describe('[Positions] every step asks its move from the position that move is legal in', () => {
  it('⚠️ carries an explicit FEN on EVERY step, not only the first', () => {
    /*
     * This is what makes going BACKWARDS exact. `teach/position.ts` rebuilds a step by replaying
     * the `play` goals before it, and the opponent's replies are not goals — so a puzzle whose
     * later steps had no FEN would be rebuilt one ply short every time, with the wrong side to
     * move. Cheap to get wrong, invisible until somebody presses "previous".
     */
    for (const { puzzle, lesson } of lessons) {
      lesson!.steps.forEach((step, index) => {
        expect(`${puzzle.id}[${index}] has a position: ${Boolean(step.fen)}`)
          .toBe(`${puzzle.id}[${index}] has a position: true`);
      });
    }
  });

  it('agrees with what `positionFor` rebuilds, which is what going back uses', () => {
    for (const { puzzle, lesson } of lessons) {
      lesson!.steps.forEach((step, index) => {
        expect(`${puzzle.id}[${index}]: ${positionFor(lesson!, index)}`)
          .toBe(`${puzzle.id}[${index}]: ${createRules(step.fen!).fen()}`);
      });
    }
  });

  it('⚠️ asks the STUDENT to move in every one of them', () => {
    // The ply offset, checked on this side of the conversion too. Whose turn it is in a step is
    // the whole difference between a puzzle and a position nobody was shown.
    for (const { puzzle, lesson } of lessons) {
      for (const step of lesson!.steps) {
        expect(`${puzzle.id}: ${createRules(step.fen!).turn()}`)
          .toBe(`${puzzle.id}: ${puzzle.side}`);
      }
    }
  });

  it('is a position the board will accept a touch in', () => {
    // The failure four lessons had: a position already over answers every square with
    // `ignored/over`, and the board simply stops responding.
    for (const { puzzle, lesson } of lessons) {
      lesson!.steps.forEach((step, index) => {
        const game = createGameState({ rules: createRules(step.fen!), opponent: false });
        expect(`${puzzle.id}[${index}]: ${game.phase()}`).toBe(`${puzzle.id}[${index}]: idle`);
      });
    }
  });

  it('⚠️ asks for a move that is actually playable there', () => {
    // The assertion the whole converter exists to earn. A goal nobody can satisfy is a puzzle a
    // child cannot finish, and there is nothing on screen to say why.
    for (const { puzzle, lesson } of lessons) {
      lesson!.steps.forEach((step, index) => {
        if (step.task.kind !== 'play') throw new Error('a puzzle step must ask for a move');
        const want = step.task.want;
        const rules = createRules(step.fen!);
        const possible = rules.allMoves().some((candidate) => {
          const move = rules.move(candidate.from, candidate.to, candidate.promotion ?? 'q');
          if (!move) return false;
          const fits = matchesShape(want, move);
          rules.undo();
          return fits;
        });
        expect(`${puzzle.id}[${index}] playable: ${possible}`)
          .toBe(`${puzzle.id}[${index}] playable: true`);
      });
    }
  });
});

describe('[Teaching] a puzzle answers to everything a lesson does', () => {
  it('names its strings the way a lesson does, so the catalogues can carry them', () => {
    for (const { puzzle, lesson } of lessons) {
      expect(lesson!.title).toBe(`puzzle.theme.${puzzle.theme}`);
      for (const step of lesson!.steps) {
        expect(step.say).toBe(`puzzle.say.${puzzle.theme}`);
        expect(step.nudge).toBe(`puzzle.nudge.${puzzle.theme}`);
      }
    }
  });

  it('⚠️ puts the answer behind the teacher, like every other lesson', () => {
    /*
     * The arrow IS the answer, so it is `show.arrows` rather than `show.squares` — which is the
     * distinction the teacher gate rests on: squares are the question and are always drawn, arrows
     * are the answer and wait for three tries.
     */
    for (const { lesson } of lessons) {
      for (const step of lesson!.steps) {
        expect(step.show?.arrows).toHaveLength(1);
        expect(step.show?.squares).toBeUndefined();
      }
    }
  });

  it('points the arrow at the move it is asking for', () => {
    for (const { lesson } of lessons) {
      for (const step of lesson!.steps) {
        if (step.task.kind !== 'play') continue;
        expect(step.show!.arrows![0]).toEqual([step.task.want.from, step.task.want.to]);
      }
    }
  });

  it('refuses a puzzle whose position it cannot build, instead of throwing', () => {
    const broken: Puzzle = {
      id: 'x', theme: 'fork', fen: 'not a fen', solution: ['e2e4'], side: 'w', rating: 500, url: '',
    };
    expect(puzzleLesson(broken)).toBeNull();

    const unplayable: Puzzle = {
      ...broken, fen: '7k/8/8/8/8/8/8/K7 w - - 0 1', solution: ['e2e4'],
    };
    expect(puzzleLesson(unplayable)).toBeNull();
  });
});
