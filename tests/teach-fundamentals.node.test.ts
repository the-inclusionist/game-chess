// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE CLAIM A TABLE TEST CANNOT MAKE, AGAIN =========================
// `teach-table.node.test.ts` proves a great deal about every lesson: the position builds, the board
// accepts a touch in it, the asked-for move is playable, the `pick` answer indexes its own options.
// All of that is about DATA.
//
// "This move is CHECKMATE" is not. Neither is "playing Qg6 here would be stalemate" — and that one
// is the answer to a multiple choice, which `teach-endgame.node.test.ts` already names as the one
// number in a syllabus that can be typed in wrongly and pass everything.
//
// ⚠️ FOR THESE LESSONS IT DOES NOT HAVE TO BE. Every claim below is computable by the same rules
// the game is played with, so they are RE-DERIVED here rather than trusted. I worked these
// positions out by hand; that is exactly the reason not to take my word for them.
import { describe, expect, it } from 'vitest';
import { lessonById } from '../app/js/teach/lessons.ts';
import { FUNDAMENTALS } from '../app/js/teach/fundamentals.ts';
import { createRules } from '../app/js/chess/rules.ts';
import { fromAlgebraic, type Square } from '../app/js/chess/types.ts';

const at = (name: string): Square => {
  const square = fromAlgebraic(name);
  if (!square) throw new Error(`no such square: ${name}`);
  return square;
};

/** The step's own position, with its asked-for move played. */
function afterStep(lessonId: string, step: number) {
  const lesson = lessonById(lessonId)!;
  const task = lesson.steps[step]!.task;
  if (task.kind !== 'play') throw new Error(`${lessonId}[${step}] is not a play`);
  const rules = createRules(lesson.steps[step]!.fen!);
  const played = rules.move(at(task.want.from!), at(task.want.to!));
  if (!played) throw new Error(`${lessonId}[${step}] asks for an illegal move`);
  return { rules, played };
}

describe('[Fundamentals] the mates are mate, and the rules say so', () => {
  it('⚠️ the rook lesson ends in checkmate, not in check', () => {
    /*
     * The whole lesson is worthless if the last move is merely a check: a child told "give mate"
     * who gives check, and is told they are right, has learned the wrong word for the rest of
     * their life. And nothing else in the suite would notice — the move is legal, the position
     * builds, the goal matches.
     */
    const { rules, played } = afterStep('materook', 2);
    expect(played.checkmate).toBe(true);
    expect(rules.isCheckmate()).toBe(true);
  });

  it('⚠️ the queen lesson ends in checkmate too', () => {
    const { rules, played } = afterStep('matequeen', 2);
    expect(played.checkmate).toBe(true);
    expect(rules.isCheckmate()).toBe(true);
  });

  it('⚠️ every step before the last leaves a position somebody can still play', () => {
    /*
     * The failure four lessons had once: a position that is already over answers every square with
     * `ignored/over` and the board simply stops responding. Here the risk runs the other way — a
     * mate arriving a step EARLY would end the lesson before its last step, which reads as the
     * lesson being broken.
     */
    for (const lesson of FUNDAMENTALS) {
      for (const [index, step] of lesson.steps.entries()) {
        if (step.task.kind !== 'play' || index === lesson.steps.length - 1) continue;
        const { rules } = afterStep(lesson.id, index);
        expect(`${lesson.id}[${index}]: ${rules.isGameOver()}`).toBe(`${lesson.id}[${index}]: false`);
      }
    }
  });
});

describe('[Fundamentals] the stalemate trap really is a stalemate', () => {
  it('⚠️ Qg6 in that position draws, which is what the answer says', () => {
    /*
     * THE ONE NUMBER THAT COULD BE TYPED IN WRONGLY AND PASS EVERYTHING. The step asks what would
     * happen after Qg6 and offers three answers; `answer: 0` is "a draw by stalemate". Re-derived
     * from the rules rather than believed, because a multiple choice about chess is a claim about
     * chess and the table test has no way to check one.
     */
    const lesson = lessonById('matequeen')!;
    const step = lesson.steps[1]!;
    const task = step.task;
    expect(task.kind).toBe('pick');
    if (task.kind !== 'pick') throw new Error('unreachable');

    const rules = createRules(step.fen!);
    // The position the child is looking at must itself be playable, or there is nothing to answer
    // about — a stalemated board could not be a step at all.
    expect(rules.isGameOver()).toBe(false);

    expect(rules.move(at('f5'), at('g6'))).not.toBeNull();
    expect(rules.isStalemate()).toBe(true);
    expect(rules.isCheckmate()).toBe(false);

    // And the option that index names is the one that says so, so a rename cannot invert it.
    expect(task.options[task.answer]).toBe('teach.matequeen.stalemate');
  });

  it('⚠️ the two wrong answers are wrong, which is the other half of a multiple choice', () => {
    // An option nobody could pick by mistake teaches nothing. These two are the mistakes a child
    // actually makes — reading "no moves left" as mate, or as nothing at all.
    const task = lessonById('matequeen')!.steps[1]!.task;
    if (task.kind !== 'pick') throw new Error('unreachable');
    expect(task.options).toHaveLength(3);
    expect(task.options).toContain('teach.matequeen.checkmate');
    expect(task.options).toContain('teach.matequeen.nothing');
  });
});

describe('[Fundamentals] the curriculum is chained into the course, not bolted beside it', () => {
  it('comes after the lessons it depends on', () => {
    /*
     * The rook mate ends with the two kings in opposition and says so, so meeting the opposition
     * on its own has to come first. `after` is what keeps that a fact about the data rather than
     * about the order somebody happened to type the table in.
     */
    expect(lessonById('materook')!.after).toContain('opposition');
    expect(lessonById('matequeen')!.after).toContain('materook');
  });

  it('⚠️ is reachable through the ONE table, so every other mechanism gets it free', () => {
    // `lessonById` reads `LESSONS`. If the spread were ever removed these would still typecheck,
    // still be exported, and simply never appear anywhere in the game.
    for (const lesson of FUNDAMENTALS) {
      expect(`${lesson.id}: ${lessonById(lesson.id) !== null}`).toBe(`${lesson.id}: true`);
    }
  });

  it('promises no piece it does not put on the board', () => {
    // Every position here mates, so none of them needs the spare pawn the earlier lessons carry —
    // and a stray pawn in one of these would change what the answer sets mean.
    for (const lesson of FUNDAMENTALS) {
      for (const step of lesson.steps) {
        const pieces = createRules(step.fen!).placements().map((p) => p.piece.type).sort();
        expect(`${lesson.id}: ${pieces.includes('p')}`).toBe(`${lesson.id}: false`);
      }
    }
  });
});
