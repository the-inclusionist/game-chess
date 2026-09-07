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
import { matchesShape } from '../app/js/teach/lesson.ts';
import { catchesPawn } from '../app/js/endgame/geometry.ts';
import { fromAlgebraic, toAlgebraic, type Square } from '../app/js/chess/types.ts';

const at = (name: string): Square => {
  const square = fromAlgebraic(name);
  if (!square) throw new Error(`no such square: ${name}`);
  return square;
};

/**
 * The step's own position, with its asked-for move played.
 *
 * ⚠️ FOUND BY THE SHAPE, NOT BY `from`/`to`, and the first version got this wrong. A `play` goal is
 * a `MoveShape` — `{ promotion: 'n' }` is a perfectly good one and names no squares at all, which
 * is the entire point of the model. Reading `want.from!` worked for as long as every goal in the
 * table happened to name its squares, and crashed on the first one that did not.
 */
function afterStep(lessonId: string, step: number) {
  const lesson = lessonById(lessonId)!;
  const task = lesson.steps[step]!.task;
  if (task.kind !== 'play') throw new Error(`${lessonId}[${step}] is not a play`);
  const rules = createRules(lesson.steps[step]!.fen!);
  for (const candidate of rules.allMoves()) {
    const played = rules.move(candidate.from, candidate.to, candidate.promotion ?? 'q');
    if (played && matchesShape(task.want, played)) return { rules, played };
    if (played) rules.undo();
  }
  throw new Error(`${lessonId}[${step}] asks for a move nothing legal satisfies`);
}

describe('[Fundamentals] the mates are mate, and the rules say so', () => {
  it('⚠️ every lesson whose name promises a mate ends in one', () => {
    /*
     * The whole lesson is worthless if the last move is merely a check: a child told "give mate"
     * who gives check, and is told they are right, has learned the wrong word for the rest of
     * their life. And nothing else in the suite would notice — the move is legal, the position
     * builds, the goal matches.
     *
     * ⚠️ WRITTEN OVER THE TABLE RATHER THAN OVER TWO NAMED LESSONS, and that is not tidiness. The
     * book has thirty-three sections and arrives a few at a time; a test that names its cases
     * covers whatever was there the day it was written and silently stops covering the rest. The
     * property is "a lesson called a mate ends in mate", and it is the property that has to be
     * asserted.
     */
    const mates = FUNDAMENTALS.filter((lesson) => lesson.id.startsWith('mate'));
    expect(mates.length).toBeGreaterThanOrEqual(3);
    for (const lesson of mates) {
      const last = lesson.steps.length - 1;
      expect(`${lesson.id}: last step is a move`).toBe(
        `${lesson.id}: ${lesson.steps[last]!.task.kind === 'play' ? 'last step is a move' : 'not'}`,
      );
      const { rules, played } = afterStep(lesson.id, last);
      expect(`${lesson.id}: ${played.checkmate}`).toBe(`${lesson.id}: true`);
      expect(`${lesson.id}: ${rules.isCheckmate()}`).toBe(`${lesson.id}: true`);
    }
  });

  /*
   * ========================= ⚠️ A TEST THAT WAS HERE AND IS DELIBERATELY GONE =========================
   * It said "every step before the last leaves a position somebody can still play", and the
   * back-rank lesson broke it correctly: that lesson gives mate on its second step of three, and
   * its third step carries its OWN FEN, so the board is rebuilt rather than continued.
   *
   * Restating it precisely — only a step whose SUCCESSOR has no FEN of its own can be hurt by
   * ending the game — turned out to have no instances at all: across all fifty-one steps in the
   * syllabus there is not one such pair. Counted, not assumed.
   *
   * So it was green and checked nothing, which is worse than not existing: it reads like coverage.
   * And the failure it was really about — a step whose own position is ALREADY over, which killed
   * four lessons once — is asserted properly in `teach-table.node.test.ts`, which builds a
   * `GameState` for every step and demands the phase be `idle`.
   *
   * Written down rather than quietly deleted, because the next person to notice the gap should
   * find out it was looked at.
   */
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

  it('⚠️ puts no spare pawn in a MATE position, where one would change the answer', () => {
    /*
     * ⚠️ THIS ASSERTION USED TO COVER THE WHOLE FILE, AND THAT WAS A COINCIDENCE DRESSED AS A RULE.
     * It said no lesson here has a pawn in it — true of the three mates, and false the moment §2
     * arrived, whose lesson is ABOUT a pawn and needs a second one as ballast so that winning the
     * queen does not leave king and knight against king.
     *
     * What was actually meant: a mate lesson needs no ballast, because king and rook, king and
     * queen and king and two bishops all mate on their own — and a stray pawn in one of those
     * positions would quietly change what the marked sets mean.
     */
    for (const lesson of FUNDAMENTALS.filter((l) => l.id.startsWith('mate'))) {
      for (const step of lesson.steps) {
        const pieces = createRules(step.fen!).placements().map((p) => p.piece.type);
        expect(`${lesson.id}: ${pieces.includes('p')}`).toBe(`${lesson.id}: false`);
      }
    }
  });
});

describe('[Fundamentals] the breakthrough works for the reason the course already taught', () => {
  /*
   * ⚠️ THE FIRST PLACE IN THIS COURSE WHERE ONE LESSON IS THE ANSWER TO ANOTHER. Why the third
   * pawn cannot be caught is exactly the rule of the square, which ships as a lesson of its own and
   * whose closed form was raced against every position on the board in
   * `tests/endgame-geometry.node.test.ts`.
   *
   * So the claim is re-derived from that module rather than asserted by me — and if the two ever
   * disagreed, one of them would be teaching a child something false.
   */
  it('⚠️ leaves a pawn the black king provably cannot catch', () => {
    const lesson = lessonById('breakthrough')!;
    const { rules, played } = afterStep('breakthrough', lesson.steps.length - 1);

    /*
     * ⚠️ THE PAWN THIS STEP PUSHED, taken from the move that was played — not one found on the
     * board by looking for a white pawn on the a-file. The first version did exactly that, and a
     * mutation that pushed a DIFFERENT pawn on the h-file, right beside the black king, passed:
     * the untouched a-pawn was still there to be found, and the assertion happily proved something
     * true about a pawn the lesson no longer moved.
     *
     * Follow the causal chain. `played.to` is where the pawn this lesson is about actually ended.
     */
    expect(played.piece.type).toBe('p');
    const king = rules.placements().find((p) => p.piece.type === 'k' && p.piece.side === 'b');
    expect(king).toBeDefined();

    // Black to move, and still cannot get there: the square rule, applied to the lesson it decides.
    expect(rules.turn()).toBe('b');
    expect(catchesPawn(played.to, 'w', king!.square, 'b')).toBe(false);
  });

  it('⚠️ starts from a position that looks level, which is the whole hook', () => {
    /*
     * Three pawns against three and no king in reach. If the material were ever edited to be
     * unequal the lesson would still "work" and would have stopped being surprising, which is the
     * only thing it has going for it.
     */
    const first = lessonById('breakthrough')!.steps[0]!;
    const rules = createRules(first.fen!);
    const pawns = rules.placements().filter((p) => p.piece.type === 'p');
    expect(pawns.filter((p) => p.piece.side === 'w')).toHaveLength(3);
    expect(pawns.filter((p) => p.piece.side === 'b')).toHaveLength(3);

    // Neither king is anywhere near: both on the h-file, seven files from where it happens.
    for (const king of rules.placements().filter((p) => p.piece.type === 'k')) {
      expect(toAlgebraic(king.square)[0]).toBe('h');
    }
  });
});
