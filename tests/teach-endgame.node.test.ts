// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE ONE THING THE TABLE TEST CANNOT CHECK =========================
// `tests/teach-table.node.test.ts` proves a great deal about every lesson: the position builds, the
// board accepts a touch in it, the marked squares are exactly what the rules say the piece reaches,
// the asked-for move is playable. All of that is about DATA.
//
// A `pick` is not. "Which of these two options is correct" is a fact about CHESS, and a table test
// has no way to know it — so the answer index for a multiple-choice step is the one number in the
// whole syllabus that could be typed in wrongly and pass everything.
//
// ⚠️ FOR THE ENDGAME LESSONS IT DOES NOT HAVE TO BE. Their answers are computable, by the same
// module the lessons are built on — and that module's own rule was raced against every position on
// the board. So the answers are re-derived here rather than trusted, which makes the two endgame
// lessons the only ones whose multiple choices cannot quietly be wrong.
import { describe, expect, it } from 'vitest';
import { lessonById } from '../app/js/teach/lessons.ts';
import { catchesPawn, opposition } from '../app/js/endgame/geometry.ts';
import { createRules } from '../app/js/chess/rules.ts';
import { fromAlgebraic, type Square } from '../app/js/chess/types.ts';

const at = (name: string): Square => {
  const square = fromAlgebraic(name);
  if (!square) throw new Error(`no such square: ${name}`);
  return square;
};

/** The option index a `pick` step declares. */
function answerOf(lessonId: string, step: number): number {
  const task = lessonById(lessonId)!.steps[step]!.task;
  if (task.kind !== 'pick') throw new Error(`${lessonId}[${step}] is not a pick`);
  return task.answer;
}

/** Which option a step offers at an index, so a rename cannot silently invert an answer. */
function optionAt(lessonId: string, step: number, index: number): string {
  const task = lessonById(lessonId)!.steps[step]!.task;
  if (task.kind !== 'pick') throw new Error(`${lessonId}[${step}] is not a pick`);
  return task.options[index]!;
}

describe('[Square] the lesson agrees with the rule it teaches', () => {
  it('⚠️ says the king CATCHES it, and the geometry says so too', () => {
    // Black king d5, white pawn h4, Black to move.
    const lesson = lessonById('square')!;
    expect(lesson.steps[0]!.fen).toContain('3k4');
    expect(catchesPawn(at('h4'), 'w', at('d5'), 'b')).toBe(true);
    expect(optionAt('square', 0, answerOf('square', 0))).toBe('teach.square.yes');
  });

  it('⚠️ says it does NOT, and the geometry says so too', () => {
    // The same idea one file further away and one rank on: outside the square.
    expect(catchesPawn(at('h5'), 'w', at('a5'), 'b')).toBe(false);
    expect(optionAt('square', 1, answerOf('square', 1))).toBe('teach.square.no');
  });

  it('⚠️ teaches the case the CLASSIC rule gets wrong', () => {
    /*
     * "Can the king reach the queening square in time" says no here — a6 to a8 is two moves and
     * the pawn needs one. The king does not have to race: it takes the pawn. That is the whole
     * reason the third step exists, and racing every position on the board is what found it.
     */
    const king = at('a6');
    const pawn = at('a7');
    expect(catchesPawn(pawn, 'w', king, 'b')).toBe(true);
    // And the classic form, written out here so the difference is visible rather than asserted:
    const raceOnly = Math.max(Math.abs(king.x - pawn.x), Math.abs(king.y - 0)) <= 1;
    expect(raceOnly).toBe(false);

    // The move the step asks for is the capture, and it is legal in the position it asks it from.
    const rules = createRules(lessonById('square')!.steps[2]!.fen!);
    const targets = rules.legalTargets(king).map((s) => `${'abcdefgh'[s.x]}${8 - s.y}`);
    expect(targets).toContain('a7');
  });
});

describe('[Opposition] the lesson agrees with the rule it teaches', () => {
  it('⚠️ gives it to the side NOT to move', () => {
    // Kings e4 and e6, White to play: Black holds it, because White must give way.
    const held = opposition(at('e4'), at('e6'), 'w');
    expect(held).toEqual({ kind: 'direct', holder: 'b' });
    expect(optionAt('opposition', 0, answerOf('opposition', 0))).toBe('teach.opposition.black');
  });

  it('⚠️ asks for the move that actually TAKES it', () => {
    /*
     * The step before it is a question; this one is the answer played out. Two squares between the
     * kings is nobody's opposition — an even gap — and one move makes it odd.
     */
    const before = opposition(at('e3'), at('e6'), 'w');
    expect(before).toBeNull();

    const task = lessonById('opposition')!.steps[1]!.task;
    expect(task.kind).toBe('play');
    if (task.kind !== 'play') throw new Error('unreachable');
    expect(task.want).toEqual({ from: 'e3', to: 'e4' });

    // After it, and with Black to move, White holds it.
    const after = opposition(at(task.want.to!), at('e6'), 'b');
    expect(after).toEqual({ kind: 'direct', holder: 'w' });

    // And it is a legal king move in the position the step asks it from.
    const rules = createRules(lessonById('opposition')!.steps[1]!.fen!);
    const targets = rules.legalTargets(at('e3')).map((s) => `${'abcdefgh'[s.x]}${8 - s.y}`);
    expect(targets).toContain('e4');
  });
});
