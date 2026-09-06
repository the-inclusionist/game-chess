// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= GOING BACK IS THE HARD DIRECTION =========================
// Forward, the board is already there: a step without a FEN continues from where the last one left
// it, which is what makes "take the knight to f3, now to g5" ONE lesson. Backward, that history is
// exactly what has been thrown away.
//
// ⚠️ AND THE OBVIOUS SHORTCUT WOULD PASS TODAY. Resetting to the nearest preceding FEN works for
// every lesson currently in the table, because no lesson yet has two moves in a row. It would break
// silently on the first one that does — the second step asked from the position before the first
// move, where its own goal is unreachable — and the person who found out would be a child.
import { describe, expect, it } from 'vitest';
import { positionFor } from '../app/js/teach/position.ts';
import { LESSONS, lessonById, lessonIndex, syllabus } from '../app/js/teach/lessons.ts';
import { matchesShape, type Lesson } from '../app/js/teach/lesson.ts';
import { createRules } from '../app/js/chess/rules.ts';
import { createGameState } from '../app/js/chess/state.ts';

const lesson = (id: string): Lesson => {
  const found = lessonById(id);
  if (!found) throw new Error(`no lesson: ${id}`);
  return found;
};

describe('[Position] every step of every lesson has a board to start from', () => {
  it('computes one for each, and it is a legal position', () => {
    for (const l of LESSONS) {
      l.steps.forEach((_step, index) => {
        const fen = positionFor(l, index);
        expect(`${l.id}[${index}] has a position: ${fen !== null}`)
          .toBe(`${l.id}[${index}] has a position: true`);
        expect(() => createRules(fen!)).not.toThrow();
      });
    }
  });

  it('is a position the board will actually accept a touch in', () => {
    // The same check the table test makes of the DECLARED positions, extended to the REPLAYED
    // ones — a replay can walk into checkmate or a draw just as easily as a typo can.
    for (const l of LESSONS) {
      l.steps.forEach((_step, index) => {
        const rules = createRules(positionFor(l, index)!);
        const game = createGameState({ rules, opponent: false });
        expect(`${l.id}[${index}] phase: ${game.phase()}`).toBe(`${l.id}[${index}] phase: idle`);
      });
    }
  });

  it('agrees with the step own FEN wherever the step declares one', () => {
    // A declared FEN is the answer by definition; anything else would mean the replay had drifted.
    for (const l of LESSONS) {
      l.steps.forEach((step, index) => {
        if (!step.fen) return;
        expect(`${l.id}[${index}]: ${positionFor(l, index)}`)
          .toBe(`${l.id}[${index}]: ${createRules(step.fen).fen()}`);
      });
    }
  });

  it('⚠️ leaves every step ANSWERABLE from the position it computes', () => {
    /*
     * THE ASSERTION THIS FILE EXISTS FOR. A replayed position that is legal, and settles to `idle`,
     * and still cannot satisfy the step's own goal, is exactly the failure that going back would
     * produce — and it looks like nothing at all until a child is asked for a move that is not
     * there to play.
     */
    let checked = 0;
    for (const l of LESSONS) {
      l.steps.forEach((step, index) => {
        if (step.task.kind !== 'play') return;
        const want = step.task.want;
        const rules = createRules(positionFor(l, index)!);
        const possible = rules.allMoves().some((candidate) => {
          const move = rules.move(candidate.from, candidate.to, candidate.promotion ?? 'q');
          if (!move) return false;
          const fits = matchesShape(want, move);
          rules.undo();
          return fits;
        });
        expect(`${l.id}[${index}] playable: ${possible}`).toBe(`${l.id}[${index}] playable: true`);
        checked += 1;
      });
    }
    expect(checked).toBeGreaterThanOrEqual(8);
  });

  it('⚠️ REPLAYS an earlier move rather than resetting to the last FEN', () => {
    /*
     * The claim the shortcut would fail, made against a lesson built HERE rather than taken from
     * the table — so it keeps holding when the table changes, and so it tests the thing no current
     * lesson happens to exercise: two moves in a row, with only the first carrying a position.
     */
    const chain: Lesson = {
      id: 'chain',
      title: 'x',
      steps: [
        {
          fen: 'k7/7p/8/8/8/8/8/6NK w - - 0 1',
          say: 'a',
          task: { kind: 'play', want: { from: 'g1', to: 'f3' } },
        },
        { say: 'b', task: { kind: 'play', want: { from: 'f3', to: 'g5' } } },
      ],
    };
    // Step 1 is asked from a board where the knight has ALREADY reached f3.
    const after = createRules(positionFor(chain, 1)!);
    expect(after.pieceAt({ x: 5, y: 5 })?.type).toBe('n');
    expect(after.pieceAt({ x: 6, y: 7 })).toBeNull();
  });

  it('answers null for an index nobody has', () => {
    expect(positionFor(lesson('rook'), -1)).toBeNull();
    expect(positionFor(lesson('rook'), 99)).toBeNull();
  });
});

describe('[Syllabus] the order is derived from `after`, not from the array', () => {
  it('lists every lesson exactly once', () => {
    const order = syllabus();
    expect(order).toHaveLength(LESSONS.length);
    expect(new Set(order.map((l) => l.id)).size).toBe(LESSONS.length);
  });

  it('never places a lesson before something it depends on', () => {
    const order = syllabus();
    const at = new Map(order.map((l, i) => [l.id, i]));
    for (const l of order) {
      for (const before of l.after ?? []) {
        expect(`${l.id} after ${before}: ${at.get(before)! < at.get(l.id)!}`)
          .toBe(`${l.id} after ${before}: true`);
      }
    }
  });

  it('starts with notation, because everything else names a square', () => {
    expect(syllabus()[0]?.id).toBe('notation');
  });

  it('finds where a lesson sits, and says -1 for one nobody wrote', () => {
    expect(lessonIndex('notation')).toBe(0);
    expect(lessonIndex('a-lesson-nobody-wrote')).toBe(-1);
  });
});
