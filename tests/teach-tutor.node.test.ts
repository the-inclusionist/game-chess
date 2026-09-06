// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= A LESSON IS MARKED WITHOUT A BOARD ON SCREEN =========================
// The tutor has no `Rules`, no `GameState`, no i18n and no DOM, so every claim about whether an
// answer was right holds in the node project. That is the point of the data model, and this file is
// where it is collected.
//
// ⚠️ BUT THE ACTIVATIONS ARE REAL. They are produced by driving `chess/state.ts` over the lessons'
// own positions rather than being written out by hand, because a hand-built `Activation` can say
// things `activate()` would never say — and every interesting case below is one where the shape
// that arrives is not the shape the plan expected.
import { describe, expect, it } from 'vitest';
import { createTutor, type Reaction } from '../app/js/teach/tutor.ts';
import { lessonById } from '../app/js/teach/lessons.ts';
import type { Lesson } from '../app/js/teach/lesson.ts';
import { createGameState, type GameState } from '../app/js/chess/state.ts';
import { createRules } from '../app/js/chess/rules.ts';
import { fromAlgebraic, type Square } from '../app/js/chess/types.ts';

const sq = (name: string): Square => {
  const square = fromAlgebraic(name);
  if (!square) throw new Error(`no such square: ${name}`);
  return square;
};

const lesson = (id: string): Lesson => {
  const found = lessonById(id);
  if (!found) throw new Error(`no lesson: ${id}`);
  return found;
};

/**
 * A board for one step, in the shape a lesson runs on.
 *
 * ⚠️ `opponent: false` IS THE WHOLE OF "A LESSON IS A HOT SEAT". `chess/state.ts` only enters
 * `thinking` when there is an opponent whose turn it is, so with this off the phase settles to
 * `idle` after every move and no engine is ever consulted. It is also why none of this needs the
 * 6.98 MB of Stockfish.
 */
function board(fen: string): GameState {
  return createGameState({ rules: createRules(fen), opponent: false });
}

/** Plays a touch through the real state machine and hands the tutor what came back. */
function touch(game: GameState, tutor: ReturnType<typeof createTutor>, name: string): Reaction {
  const square = sq(name);
  return tutor.saw(square, game.activate(square));
}

describe('[Judging] a move is played, then judged, and sometimes taken back', () => {
  it('accepts the move the step asked for and leaves it on the board', () => {
    /*
     * ⚠️ A RIGHT `play` NEVER UNDOES, and that is what makes a multi-step lesson possible: the
     * pawn lesson's third step continues from where the second left the board.
     */
    const lesson2 = lesson('pawn');
    // Step 1 carries no FEN of its own: it continues from where step 0 left the board, which is
    // the whole reason `fen` is optional.
    const game = board(lesson2.steps[0]!.fen!);
    const tutor = createTutor(lesson2, { from: 1 });

    expect(touch(game, tutor, 'e2')).toEqual({ kind: 'ignored', undo: false });
    expect(touch(game, tutor, 'e4')).toEqual({ kind: 'right', done: false, undo: false });
  });

  it('⚠️ takes the wrong move back, because the child has to see it happen first', () => {
    /*
     * The argument `ui/blunder-bar.ts` makes for the game applies to the lesson: a child who moved
     * the piece wrongly needs to see it standing on the wrong square. A predicate that refused the
     * move would teach nothing. So `undo` is true and the SHELL puts it back.
     */
    const lesson2 = lesson('pawn');
    const tutor = createTutor(lesson2, { from: 1 });
    const game = board(lesson2.steps[0]!.fen!);

    game.activate(sq('e2'));
    const reaction = tutor.saw(sq('e3'), game.activate(sq('e3')));
    expect(reaction).toEqual({ kind: 'wrong', undo: true, nudge: 'teach.pawn.double.nudge' });
  });

  it('⚠️ does not ask for an undo after an ILLEGAL move, because nothing was played', () => {
    /*
     * `chess/rules.ts` turns an illegal move from an exception into a value — the reason given
     * there is that a throw inside a click handler would take the frame loop down — and the
     * consequence here is that `activate` reports `illegal` having changed nothing. An undo would
     * roll back the move BEFORE this one, which in a lesson is the previous step's answer.
     */
    const lesson2 = lesson('pawn');
    const tutor = createTutor(lesson2, { from: 1 });
    const game = board(lesson2.steps[0]!.fen!);

    game.activate(sq('e2'));
    const reaction = tutor.saw(sq('e5'), game.activate(sq('e5')));
    expect(reaction).toEqual({ kind: 'wrong', undo: false, nudge: 'teach.pawn.double.nudge' });
  });

  it('says the nudge once and then stops saying it', () => {
    /*
     * A hint repeated at every attempt is nagging. The second wrong answer is still wrong; it is
     * just no longer news.
     *
     * ⚠️ AND `animationDone()` IS NOT DECORATION HERE — IT IS THE UNDO WORKING AT ALL. A move
     * leaves the phase on `animating`, and `canTakeBack()` refuses in that phase deliberately: a
     * piece in flight is being drawn from a move the rules have already applied, so pulling the
     * move out from under it leaves the renderer holding a destination that no longer exists.
     *
     * So the SHELL owes the same order when it acts on `undo`: let the piece land, then take it
     * back. This test was written without it and failed by silently not undoing — the second
     * attempt came back `ignored/busy`, which is a lesson that has quietly stopped accepting
     * answers.
     */
    const lesson2 = lesson('pawn');
    const tutor = createTutor(lesson2, { from: 1 });
    const game = board(lesson2.steps[0]!.fen!);

    game.activate(sq('e2'));
    const first = tutor.saw(sq('e3'), game.activate(sq('e3')));
    expect(first.kind === 'wrong' && first.nudge).toBe('teach.pawn.double.nudge');
    game.animationDone();
    expect(game.takeBack()).toBe(true);

    game.activate(sq('e2'));
    const second = tutor.saw(sq('e3'), game.activate(sq('e3')));
    expect(second.kind === 'wrong' && second.nudge).toBe(null);
  });

  it('offers the nudge again on the next step, which has its own', () => {
    const lesson2 = lesson('castling');
    const tutor = createTutor(lesson2);
    const game = board(lesson2.steps[0]!.fen!);
    tutor.saw(sq('a3'), game.activate(sq('a3')));
    expect(tutor.advance()?.say).toBe('teach.castling.short');

    game.activate(sq('e1'));
    const reaction = tutor.saw(sq('e2'), game.activate(sq('e2')));
    expect(reaction).toEqual({ kind: 'wrong', undo: true, nudge: 'teach.castling.short.nudge' });
  });

  it('matches the special rules by their flags, through the real state machine', () => {
    // The three the model exists to teach. Each is satisfied by a move nobody described as a pair
    // of squares — which is the argument `teach/lesson.ts` makes, played out.
    for (const [id, from, to] of [
      ['castling', 'e1', 'g1'], ['enpassant', 'e5', 'd6'], ['promotion', 'a7', 'a8'],
    ] as const) {
      const l = lesson(id);
      // In all three the second step is the one that asks for the move, and it continues from the
      // first step's position rather than naming one of its own.
      const tutor = createTutor(l, { from: 1 });
      const game = board(l.steps[0]!.fen!);
      game.activate(sq(from));
      const reaction = tutor.saw(sq(to), game.activate(sq(to)));
      expect(`${id}: ${reaction.kind}`).toBe(`${id}: right`);
    }
  });
});

describe('[Marks] touching squares, in any order, without moving anything', () => {
  it('waits while a set is incomplete and reports how far along it is', () => {
    const l = lesson('king');
    const tutor = createTutor(l);
    const game = board(l.steps[0]!.fen!);

    expect(touch(game, tutor, 'c4')).toEqual({ kind: 'waiting', marked: 1, wanted: 8, undo: false });
    expect(touch(game, tutor, 'e6')).toEqual({ kind: 'waiting', marked: 2, wanted: 8, undo: false });
  });

  it('counts a square touched twice once, and does not go backwards', () => {
    const l = lesson('king');
    const tutor = createTutor(l);
    const game = board(l.steps[0]!.fen!);

    touch(game, tutor, 'c4');
    expect(touch(game, tutor, 'c4')).toEqual({ kind: 'waiting', marked: 1, wanted: 8, undo: false });
    expect(tutor.marked()).toEqual(['c4']);
  });

  it('does not care what order the squares come in', () => {
    const l = lesson('pawn');
    const forwards = createTutor(l);
    const backwards = createTutor(l);
    const a = board(l.steps[0]!.fen!);
    const b = board(l.steps[0]!.fen!);

    touch(a, forwards, 'e3');
    const first = touch(a, forwards, 'e4');
    touch(b, backwards, 'e4');
    const second = touch(b, backwards, 'e3');
    expect(first).toEqual(second);
    expect(first.kind).toBe('right');
  });

  it('⚠️ counts a square reached BY MOVING, and asks for the move to be taken back', () => {
    /*
     * THE CASE THE PLAN DID NOT COVER, and the one this file was written to find. The squares a
     * lesson asks to be marked are the squares the taught piece can REACH — which are exactly the
     * squares a child who has already picked the piece up will move it to. Touch the rook on d5,
     * touch d8, and the rook is standing on d8.
     *
     * d8 is a correct answer, arrived at by the other of the two gestures the board offers, so it
     * counts. But the remaining thirteen squares are the rook's reach FROM d5, so the board has to
     * go back or the step becomes unanswerable halfway through, with the child holding the pieces.
     */
    const l = lesson('rook');
    const tutor = createTutor(l);
    const game = board(l.steps[0]!.fen!);

    expect(game.activate(sq('d5')).kind).toBe('selected');
    const reaction = tutor.saw(sq('d8'), game.activate(sq('d8')));
    expect(reaction).toEqual({ kind: 'waiting', marked: 1, wanted: 14, undo: true });
    expect(tutor.marked()).toEqual(['d8']);
  });

  it('⚠️ asks for the undo even when that move COMPLETED the set', () => {
    // The same hazard on the last square rather than the first. Being right does not make the
    // board correct, and a lesson whose next step carries no FEN continues from this position.
    const l = lesson('promotion');
    const tutor = createTutor(l);
    const game = board(l.steps[0]!.fen!);

    game.activate(sq('a7'));
    const reaction = tutor.saw(sq('a8'), game.activate(sq('a8')));
    expect(reaction).toEqual({ kind: 'right', done: false, undo: true });
  });

  it('⚠️ does not treat picking a piece up as a wrong answer', () => {
    /*
     * Seeing the legal targets is how a sighted child checks their thinking and how a keyboard
     * child hears it at all. A lesson that scolded them for it would be punishing the very move it
     * is teaching — and the taught piece's own square is never in the answer set, so this WOULD
     * have counted as wrong without the guard.
     */
    const l = lesson('rook');
    const tutor = createTutor(l);
    const game = board(l.steps[0]!.fen!);

    expect(touch(game, tutor, 'd5')).toEqual({ kind: 'ignored', undo: false });
    expect(touch(game, tutor, 'd5')).toEqual({ kind: 'ignored', undo: false });
    expect(tutor.marked()).toEqual([]);
  });

  it('calls a square outside the set wrong, and nudges', () => {
    const l = lesson('knight');
    const tutor = createTutor(l);
    const game = board(l.steps[0]!.fen!);
    // d4 is not a knight's move from d5, and it is empty, so nothing is played.
    expect(touch(game, tutor, 'd4'))
      .toEqual({ kind: 'wrong', undo: false, nudge: 'teach.knight.reach.nudge' });
  });
});

describe('[Picks] the answer is in the panel, and the board is scenery', () => {
  it('accepts the right option and refuses the others without touching the position', () => {
    const l = lesson('values');
    const tutor = createTutor(l);
    expect(tutor.chose(0)).toEqual({ kind: 'right', done: false, undo: false });

    const again = createTutor(l);
    expect(again.chose(2)).toEqual({ kind: 'wrong', undo: false, nudge: null });
  });

  it('⚠️ puts the board back if a child moves a piece while reading the question', () => {
    /*
     * The values lesson sits on the opening position and nothing stops a pawn being pushed while
     * the question is being read. That is not a wrong answer and must not be nudged — but the
     * position would otherwise drift out from under a lesson that never mentioned it.
     */
    const l = lesson('values');
    const tutor = createTutor(l);
    const game = board(l.steps[0]!.fen!);

    game.activate(sq('e2'));
    expect(tutor.saw(sq('e4'), game.activate(sq('e4')))).toEqual({ kind: 'ignored', undo: true });
  });

  it('ignores a pick offered during a step that is not one', () => {
    const tutor = createTutor(lesson('rook'));
    expect(tutor.chose(0)).toEqual({ kind: 'ignored', undo: false });
  });
});

describe('[Walking] the lesson advances, ends, and can be resumed', () => {
  it('hands back each step in turn and then null', () => {
    const l = lesson('notation');
    const tutor = createTutor(l);
    expect(tutor.step()?.say).toBe('teach.notation.files');
    for (let i = 1; i < l.steps.length; i += 1) {
      expect(tutor.advance()?.say).toBe(l.steps[i]!.say);
    }
    expect(tutor.advance()).toBeNull();
    expect(tutor.finished()).toBe(true);
  });

  it('says `done` only on the last step', () => {
    const l = lesson('rook');
    const tutor = createTutor(l);
    const game = board(l.steps[0]!.fen!);
    for (const name of l.steps[0]!.task.kind === 'mark' ? l.steps[0]!.task.want : []) {
      touch(game, tutor, name);
    }
    tutor.advance();
    game.activate(sq('d5'));
    const last = tutor.saw(sq('d8'), game.activate(sq('d8')));
    expect(last).toEqual({ kind: 'right', done: true, undo: false });
  });

  it('forgets the marks and the nudge when it moves on', () => {
    // Otherwise the second step of a two-mark lesson starts half-answered, and its nudge is
    // already spent.
    const l = lesson('knight');
    const tutor = createTutor(l);
    const game = board(l.steps[0]!.fen!);
    touch(game, tutor, 'b4');
    touch(game, tutor, 'd4');
    expect(tutor.marked()).toEqual(['b4']);

    tutor.advance();
    expect(tutor.marked()).toEqual([]);
    const next = board(l.steps[1]!.fen!);
    expect(tutor.saw(sq('d3'), next.activate(sq('d3'))))
      .toEqual({ kind: 'wrong', undo: false, nudge: 'teach.knight.jumps.nudge' });
  });

  it('starts where stored progress says, and shrugs off an index nobody has', () => {
    // `from` is how a lesson is resumed after a reload. Storage outlives a lesson being shortened,
    // so an index past the end has to land somewhere sane rather than off the board.
    expect(createTutor(lesson('rook'), { from: 1 }).step()?.say).toBe('teach.rook.play');
    expect(createTutor(lesson('rook'), { from: 99 }).stepIndex()).toBe(0);
    expect(createTutor(lesson('rook'), { from: -1 }).stepIndex()).toBe(0);
  });

  it('ignores everything once the lesson is over', () => {
    const l = lesson('rook');
    const tutor = createTutor(l);
    tutor.advance();
    tutor.advance();
    const game = board(l.steps[0]!.fen!);
    expect(tutor.saw(sq('d5'), game.activate(sq('d5')))).toEqual({ kind: 'ignored', undo: false });
    expect(tutor.chose(0)).toEqual({ kind: 'ignored', undo: false });
  });
});

describe('[Nothing replies] a lesson is a hot seat', () => {
  it('settles to idle after a right answer, never to thinking', () => {
    /*
     * ⚠️ THE ASSERTION THAT KEEPS THE ENGINE OUT. With `opponent: false` the phase after a move is
     * `idle`, so nothing is ever asked to reply. Were it `thinking`, a lesson would sit waiting for
     * a search that the shell has no reason to start — and every activation after it would come
     * back `ignored/busy`, which is a lesson that silently stops accepting answers.
     */
    const l = lesson('pawn');
    const game = board(l.steps[0]!.fen!);
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    game.animationDone();
    expect(game.phase()).toBe('idle');
  });
});

describe('[Walking back] a step can be re-opened, and it forgets what it knew', () => {
  it('moves back one step, and refuses to go before the first', () => {
    const l = lesson('notation');
    const tutor = createTutor(l, { from: 2 });
    expect(tutor.back()?.say).toBe('teach.notation.ranks');
    expect(tutor.back()?.say).toBe('teach.notation.files');
    expect(tutor.back()).toBeNull();
    // And refusing does not move the index off the board.
    expect(tutor.stepIndex()).toBe(0);
  });

  it('⚠️ forgets the marks, the nudge and the mistakes of the step it leaves', () => {
    /*
     * A step re-opened half-answered is a step that completes itself on the first touch, and one
     * whose nudge is already spent. The mistake count matters most: it gates the teacher, so a
     * count that survived would hand out help on a question nobody had tried yet.
     */
    const l = lesson('notation');
    const tutor = createTutor(l);
    const game = board(l.steps[0]!.fen!);
    touch(game, tutor, 'a3');                       // wrong
    touch(game, tutor, 'e4');                       // right
    // ⚠️ STILL ONE. The tutor does not advance itself — the driver does, once it has shown the
    // answer — so a right answer leaves the count standing until the step actually changes.
    expect(tutor.mistakes()).toBe(1);
    tutor.advance();
    expect(tutor.mistakes()).toBe(0);

    const next = board(l.steps[0]!.fen!);
    touch(next, tutor, 'a3');
    expect(tutor.mistakes()).toBe(1);
    tutor.back();
    expect(tutor.mistakes()).toBe(0);
    expect(tutor.marked()).toEqual([]);
  });
});

describe('[Mistakes] the count that gates the teacher', () => {
  it('counts wrong answers on THIS step, and starts at zero', () => {
    const l = lesson('king');
    const tutor = createTutor(l);
    const game = board(l.steps[0]!.fen!);
    expect(tutor.mistakes()).toBe(0);
    touch(game, tutor, 'a1');
    touch(game, tutor, 'h8');
    expect(tutor.mistakes()).toBe(2);
  });

  it('does not count a right answer, nor a touch that was not an answer', () => {
    const l = lesson('rook');
    const tutor = createTutor(l);
    const game = board(l.steps[0]!.fen!);
    touch(game, tutor, 'a5');                       // right
    touch(game, tutor, 'd5');                       // picking the rook up: not an answer
    expect(tutor.mistakes()).toBe(0);
  });

  it('counts a wrong pick too, because a pick can be got wrong', () => {
    const tutor = createTutor(lesson('values'));
    tutor.chose(2);
    tutor.chose(1);
    expect(tutor.mistakes()).toBe(2);
  });

  it('⚠️ reaches three on the third try, which is when help is offered', () => {
    // The gate the teacher toggle waits on. Asserted here rather than in the UI, because it is a
    // fact about answering rather than about a button.
    const l = lesson('king');
    const tutor = createTutor(l);
    const game = board(l.steps[0]!.fen!);
    for (const square of ['a1', 'h8', 'b1']) touch(game, tutor, square);
    expect(tutor.mistakes()).toBe(3);
  });
});
