// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE TEST THAT MAKES THE TABLE SAFE TO GROW =========================
// Every square set in `teach/lessons.ts` is re-derived here from the position it belongs to. The
// table says what the answer is; this says whether the answer is reachable. That division is the
// same one `render/pieces/geometry.ts` and its test use — data in one file, the invariant in the
// other — and it is what lets a lesson be added without a person having to hold a board in their
// head to check it.
//
// ⚠️ WITHOUT THIS, THE PERSON WHO FINDS THE MISTAKE IS A CHILD. A `mark` step that lists a square
// the piece cannot reach cannot be completed, and nothing on screen would explain why: the board
// would simply refuse to move on, and the natural conclusion is that the child is wrong.
import { describe, expect, it } from 'vitest';
import { LESSONS, lessonById } from '../app/js/teach/lessons.ts';
import { asSquareSet, isSquareName, matchesShape, type Step } from '../app/js/teach/lesson.ts';
import { createRules, type Rules } from '../app/js/chess/rules.ts';
import { fromAlgebraic, toAlgebraic } from '../app/js/chess/types.ts';

/**
 * Walks a lesson, carrying the board from step to step exactly as the tutor will.
 *
 * ⚠️ A STEP WITHOUT A FEN CONTINUES THE LAST ONE, which is what makes "take the knight to f3, now
 * to g5" one lesson. So the table cannot be checked step by step in isolation: the position a step
 * asks about is the position the steps before it left behind.
 */
function walk(lessonId: string, visit: (step: Step, rules: Rules, where: string) => void): void {
  const lesson = lessonById(lessonId);
  if (!lesson) throw new Error(`no lesson: ${lessonId}`);
  let rules: Rules | null = null;
  lesson.steps.forEach((step, index) => {
    if (step.fen) rules = createRules(step.fen);
    if (!rules) throw new Error(`${lessonId} step ${index} has no position and none before it`);
    visit(step, rules, `${lessonId}[${index}]`);
    // The board moves on the way a student would move it: play the first move that satisfies the
    // goal, so the next step starts where this one ended.
    if (step.task.kind === 'play') {
      const played = rules.allMoves().find((m) => {
        const move = rules!.move(m.from, m.to, m.promotion ?? 'q');
        if (move && matchesShape(step.task.kind === 'play' ? step.task.want : {}, move)) return true;
        if (move) rules!.undo();
        return false;
      });
      if (!played) throw new Error(`${lessonId}[${index}] has no move that satisfies its goal`);
    }
  });
}

describe('[Table] every lesson is playable as written', () => {
  it('constructs every position it names', () => {
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        if (!step.fen) continue;
        expect(() => createRules(step.fen)).not.toThrow();
      }
      expect(`${lesson.id} first step has a position: ${Boolean(lesson.steps[0]?.fen)}`)
        .toBe(`${lesson.id} first step has a position: true`);
    }
  });

  it('names only real squares, everywhere', () => {
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        const named = [
          ...(step.task.kind === 'mark' ? step.task.want : []),
          ...(step.show?.squares ?? []),
          ...(step.show?.arrows ?? []).flat(),
          ...(step.task.kind === 'play'
            ? [step.task.want.from, step.task.want.to].filter((s): s is string => Boolean(s))
            : []),
        ];
        for (const name of named) {
          expect(`${lesson.id} ${name} ${isSquareName(name)}`).toBe(`${lesson.id} ${name} true`);
        }
      }
    }
  });

  it('asks for a move that exists in the position it asks it from', () => {
    for (const lesson of LESSONS) {
      walk(lesson.id, (step, rules, where) => {
        if (step.task.kind !== 'play') return;
        const want = step.task.want;
        const possible = rules.allMoves().some((candidate) => {
          const move = rules.move(candidate.from, candidate.to, candidate.promotion ?? 'q');
          if (!move) return false;
          const fits = matchesShape(want, move);
          rules.undo();
          return fits;
        });
        expect(`${where} is playable: ${possible}`).toBe(`${where} is playable: true`);
      });
    }
  });

  it('⚠️ marks exactly what the rules say the piece can reach', () => {
    /*
     * THE ASSERTION THIS WHOLE FILE IS FOR, and it is TOTAL: every `mark` step that declares whose
     * reach it is gets re-derived, rather than a hand-written map of lesson ids getting it for the
     * steps somebody remembered. The first version of this test WAS such a map, it covered only
     * each lesson's first step, and the knight's second step was wrong underneath it — b4 and b6
     * for a knight standing on d4, which are the squares it would reach from d5.
     *
     * The comparison is by SET. `legalTargets` on a promotion square returns a8 four times, once
     * per piece the pawn may become, and no child is going to touch it four times.
     */
    let checked = 0;
    for (const lesson of LESSONS) {
      walk(lesson.id, (step, rules, where) => {
        if (step.task.kind !== 'mark' || !step.task.reachOf) return;
        const from = fromAlgebraic(step.task.reachOf);
        expect(`${where} stands on a real square: ${from !== null}`)
          .toBe(`${where} stands on a real square: true`);
        const actual = rules.legalTargets(from!).map(toAlgebraic);
        expect(`${where}: ${asSquareSet(step.task.want)}`).toBe(`${where}: ${asSquareSet(actual)}`);
        checked++;
      });
    }
    // A guard on the guard: if `reachOf` were dropped from the table, this test would pass by
    // checking nothing at all.
    expect(checked).toBeGreaterThanOrEqual(10);
  });

  it('puts a piece on every square a reach is claimed for', () => {
    // `legalTargets` of an empty square is an empty list, and an empty list equals an empty want.
    // So a `reachOf` pointing at nothing would make the assertion above vacuously true.
    for (const lesson of LESSONS) {
      walk(lesson.id, (step, rules, where) => {
        if (step.task.kind !== 'mark' || !step.task.reachOf) return;
        const piece = rules.pieceAt(fromAlgebraic(step.task.reachOf)!);
        expect(`${where} has a piece to move: ${piece !== null}`)
          .toBe(`${where} has a piece to move: true`);
      });
    }
  });

  it('never marks a square a king is parked on', () => {
    // The corollary of the above, stated on its own because it is the mistake that will be made:
    // a lesson author reaches for the textbook count and forgets the two pieces the FEN had to
    // carry.
    for (const lesson of LESSONS) {
      walk(lesson.id, (step, rules, where) => {
        if (step.task.kind !== 'mark') return;
        for (const name of step.task.want) {
          const piece = rules.pieceAt(fromAlgebraic(name)!);
          expect(`${where} ${name} holds a king: ${piece?.type === 'k'}`)
            .toBe(`${where} ${name} holds a king: false`);
        }
      });
    }
  });

  it('offers a choice whose answer is one of the options', () => {
    for (const lesson of LESSONS) {
      for (const [index, step] of lesson.steps.entries()) {
        if (step.task.kind !== 'pick') continue;
        const { options, answer } = step.task;
        expect(`${lesson.id}[${index}] options: ${options.length >= 2}`)
          .toBe(`${lesson.id}[${index}] options: true`);
        expect(`${lesson.id}[${index}] answer in range: ${answer >= 0 && answer < options.length}`)
          .toBe(`${lesson.id}[${index}] answer in range: true`);
        // Two identical options make one of them unanswerably wrong.
        expect(`${lesson.id}[${index}] distinct: ${new Set(options).size === options.length}`)
          .toBe(`${lesson.id}[${index}] distinct: true`);
      }
    }
  });
});

describe('[Syllabus] the order is data, and it is acyclic', () => {
  it('names only lessons that exist', () => {
    const ids = new Set(LESSONS.map((l) => l.id));
    for (const lesson of LESSONS) {
      for (const before of lesson.after ?? []) {
        expect(`${lesson.id} after ${before}: ${ids.has(before)}`)
          .toBe(`${lesson.id} after ${before}: true`);
      }
    }
  });

  it('has no two lessons with the same id', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('can be walked from the start without ever waiting on itself', () => {
    // A topological sort that must consume every lesson. A cycle leaves some behind, and a
    // syllabus with a cycle is one a student can never begin.
    const left = new Map(LESSONS.map((l) => [l.id, new Set(l.after ?? [])]));
    const done = new Set<string>();
    let moved = true;
    while (moved) {
      moved = false;
      for (const [id, needs] of left) {
        if ([...needs].every((n) => done.has(n))) {
          done.add(id);
          left.delete(id);
          moved = true;
        }
      }
    }
    expect([...left.keys()]).toEqual([]);
    expect(done.size).toBe(LESSONS.length);
  });

  it('starts with notation, because everything else names a square', () => {
    const first = LESSONS.find((l) => !l.after?.length);
    expect(first?.id).toBe('notation');
  });
});

describe('[Table] the keys a lesson asks for are the keys it will be looked up by', () => {
  it('gives every lesson and every step a namespaced key', () => {
    // ⚠️ The catalogues arrive in the next step, and THAT is where a missing key becomes a failure.
    // What is checked here is the shape: a key that does not name its own lesson will be filed
    // under the wrong heading by whoever translates it.
    for (const lesson of LESSONS) {
      expect(`${lesson.id} title: ${lesson.title}`)
        .toBe(`${lesson.id} title: teach.${lesson.id}.title`);
      for (const [index, step] of lesson.steps.entries()) {
        expect(`${lesson.id}[${index}] say: ${step.say.startsWith(`teach.${lesson.id}.`)}`)
          .toBe(`${lesson.id}[${index}] say: true`);
        if (step.nudge) {
          expect(`${lesson.id}[${index}] nudge: ${step.nudge.startsWith(`teach.${lesson.id}.`)}`)
            .toBe(`${lesson.id}[${index}] nudge: true`);
        }
      }
    }
  });

  it('finds a lesson by id, and answers null for one that has been renamed away', () => {
    expect(lessonById('rook')?.id).toBe('rook');
    expect(lessonById('a-lesson-nobody-wrote')).toBeNull();
  });
});
