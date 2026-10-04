// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHY THIS RUNS IN NODE =========================
// `boot/drag-to-move.ts` takes two numbers and answers questions. It never touches the DOM, never
// asks a renderer anything, and never looks at a canvas — which is the point of it being a module
// at all, and is why the gesture can be tested without one.
//
// What is asserted here is the GESTURE, not the chess: that a press on a piece with somewhere to
// go becomes a carry, that a press on anything else does not, that the carry claims the pointer so
// the camera cannot also have it, and that letting go on a square plays the move once.
import { describe, expect, it } from 'vitest';
import { createDragToMove, type DragToMoveDeps } from '../app/js/boot/drag-to-move.ts';
import type { Rules } from '../app/js/chess/rules.ts';
import type { Square } from '../app/js/chess/types.ts';

const sq = (x: number, y: number): Square => ({ x, y } as Square);
const at = (x: number, y: number) => ({ clientX: x, clientY: y });

/** A board that is only as real as this module can tell: a lookup of square -> where it may go. */
function harness(options: {
  readonly board: ReadonlyMap<string, Square[]>;
  /** Where each client point lands, in order of the points the test uses. */
  readonly squareAt: (point: { clientX: number; clientY: number }) => Square | null;
  readonly selection?: Square | null;
}) {
  const log: string[] = [];
  let selection = options.selection ?? null;

  const rules = {
    legalTargets: (from: Square) => options.board.get(`${from.x},${from.y}`) ?? [],
  } as unknown as Rules;

  const deps: DragToMoveDeps = {
    squareAt: options.squareAt,
    rules: () => rules,
    selection: () => selection,
    activate: (square) => { log.push(`activate ${square.x},${square.y}`); selection = square; },
    focus: (square) => log.push(`focus ${square.x},${square.y}`),
    // ⚠️ Recorded, not ignored: "the piece is in your hand" is half the gesture, and a carry that
    // forgot to put it down would leave a board lying about where its pieces are.
    carry: (from, at) => log.push(from && at ? `carry ${from.x},${from.y}` : 'carry none'),
    cancelHold: () => log.push('cancelHold'),
  };
  return { drag: createDragToMove(deps), log };
}

/** A board where only e2 (4,6) may move, to d4 (3,4). */
const ONE_MOVER = new Map<string, Square[]>([['4,6', [sq(3, 4)]]]);

describe('[Carry] a press on a piece that can move becomes a carry', () => {
  it('⚠️ does nothing until the pointer has travelled, so a click stays a click', () => {
    const { drag, log } = harness({ board: ONE_MOVER, squareAt: () => sq(4, 6) });
    drag.down(at(100, 100));
    // Two pixels is a hand on a trackpad, not a decision.
    expect(drag.move(at(102, 101)), 'a tremor is not a carry').toBe(false);
    expect(drag.carrying()).toBeNull();
    expect(log, 'and nothing was acted on').toEqual([]);
  });

  it('picks the piece up once the travel is a decision, and claims the pointer', () => {
    const { drag, log } = harness({ board: ONE_MOVER, squareAt: () => sq(4, 6) });
    drag.down(at(100, 100));
    expect(drag.move(at(130, 100)), 'the carry claims the pointer').toBe(true);
    expect(drag.carrying()).toEqual(sq(4, 6));
    // ⚠️ The hold timer is called off: the press is the piece's now, not the camera's.
    expect(log).toContain('cancelHold');
    expect(log).toContain('activate 4,6');
  });

  it('⚠️ refuses a square with nowhere to go, and hands the press back to the camera', () => {
    /*
     * The gate is "has somewhere to go", which covers an empty square, the wrong side's turn and a
     * piece pinned solid — all three without this module knowing any chess. And it must have NO
     * side effects: a gate that called `activate` to find out would put down a piece the player
     * was already holding just to answer the question.
     */
    const { drag, log } = harness({ board: ONE_MOVER, squareAt: () => sq(0, 0) });
    drag.down(at(100, 100));
    expect(drag.move(at(140, 100)), 'the camera may have the press').toBe(false);
    expect(drag.carrying()).toBeNull();
    expect(log, 'nothing touched').toEqual([]);
    // And it stays refused for the rest of the press, rather than re-asking on every pixel.
    expect(drag.move(at(180, 100))).toBe(false);
    expect(log).toEqual([]);
  });

  it('does not pick up a piece that is already in hand, which would put it down', () => {
    // Clicking a piece selects it. Dragging the same piece a moment later must not call
    // `activate` again — the second call is what the shell reads as "put it down".
    const { drag, log } = harness({
      board: ONE_MOVER, squareAt: () => sq(4, 6), selection: sq(4, 6),
    });
    drag.down(at(100, 100));
    expect(drag.move(at(130, 100))).toBe(true);
    expect(log.filter((l) => l.startsWith('activate')), 'not activated again').toEqual([]);
  });
});

describe('[Carry] ⚠️ the piece is in your HAND, and the two gestures are disjoint', () => {
  it('says at the press whether this one can be picked up, so the camera knows to stay out', () => {
    /*
     * The Dev, 2026-10-04: holding the button on a piece picks the piece up, and a drag OFF a
     * piece goes on turning the board. Before this the one-second hold armed the camera wherever
     * the press was — so holding on a piece and then moving turned the board instead of carrying,
     * which is the opposite of the sentence. The views ask this at `pointerdown` and simply do not
     * arm their hold when it is true.
     */
    const onPiece = harness({ board: ONE_MOVER, squareAt: () => sq(4, 6) });
    onPiece.drag.down(at(100, 100));
    expect(onPiece.drag.grabbable(), 'a piece with somewhere to go').toBe(true);

    const onEmpty = harness({ board: ONE_MOVER, squareAt: () => sq(0, 0) });
    onEmpty.drag.down(at(100, 100));
    expect(onEmpty.drag.grabbable(), 'bare board: the camera may have it').toBe(false);
  });

  it('⚠️ asks that question ONCE, so the gesture cannot change hands mid-press', () => {
    // A board that answers differently on a second look — a move played elsewhere, an animation
    // settling — must not turn a carry into a camera drag under the player's hand.
    let where = sq(4, 6);
    const { drag } = harness({ board: ONE_MOVER, squareAt: () => where });
    drag.down(at(100, 100));
    where = sq(0, 0);
    expect(drag.grabbable()).toBe(true);
    expect(drag.move(at(140, 100)), 'still a carry').toBe(true);
  });

  it('lifts the piece as soon as it is taken, and puts it down before the move is tried', () => {
    let under = sq(4, 6);
    const { drag, log } = harness({ board: ONE_MOVER, squareAt: () => under });
    drag.down(at(100, 100));
    drag.move(at(130, 100));
    expect(log.filter((l) => l.startsWith('carry'))).toEqual(['carry 4,6', 'carry 4,6']);

    under = sq(3, 4);
    drag.up(at(160, 140));
    /*
     * ⚠️ THE ORDER IS THE ASSERTION, not the contents. `activate` repaints the position, so a
     * piece still marked as carried would be drawn in the air over the new one — and on a REFUSED
     * drop putting it down is the whole of "the piece goes back", because the board never changed.
     */
    const down = log.lastIndexOf('carry none');
    const played = log.lastIndexOf('activate 3,4');
    expect(down, 'put down at all').toBeGreaterThan(-1);
    expect(played, 'the move was played').toBeGreaterThan(-1);
    expect(`down at ${down} before played at ${played}? ${down < played}`)
      .toBe(`down at ${down} before played at ${played}? true`);
  });

  it('⚠️ puts it down when the press is abandoned, rather than leaving it in the air', () => {
    // The wheel and the hold timer both take a press over. A piece left floating is a position
    // the board is lying about.
    const { drag, log } = harness({ board: ONE_MOVER, squareAt: () => sq(4, 6) });
    drag.down(at(100, 100));
    drag.move(at(130, 100));
    drag.abandon();
    expect(log[log.length - 1]).toBe('carry none');
  });
});

describe('[Carry] the square under the pointer lights the whole way', () => {
  it('moves the cursor on a change of square, and not on every pixel', () => {
    let under = sq(4, 6);
    const { drag, log } = harness({ board: ONE_MOVER, squareAt: () => under });
    drag.down(at(100, 100));
    drag.move(at(130, 100));

    under = sq(4, 5);
    drag.move(at(130, 120));
    drag.move(at(131, 121));
    drag.move(at(132, 122));
    under = sq(3, 4);
    drag.move(at(160, 140));

    expect(log.filter((l) => l.startsWith('focus')))
      .toEqual(['focus 4,5', 'focus 3,4']);
  });
});

describe('[Carry] letting go', () => {
  it('⚠️ plays the move once, and tells the view not to read a click as well', () => {
    let under = sq(4, 6);
    const { drag, log } = harness({ board: ONE_MOVER, squareAt: () => under });
    drag.down(at(100, 100));
    drag.move(at(130, 100));
    under = sq(3, 4);

    expect(drag.up(at(160, 140)), 'the view must not also read a click').toBe(true);
    expect(log.filter((l) => l.startsWith('activate'))).toEqual(['activate 4,6', 'activate 3,4']);
    expect(drag.carrying(), 'and the hand is empty again').toBeNull();
  });

  it('⚠️ leaves the piece in hand when it is dropped on itself', () => {
    /*
     * The player has already seen the legal squares light up. Putting the piece back because they
     * let go in the wrong place would punish the gesture that was asking the question — and
     * clicking elsewhere is still the ordinary way to put it down.
     */
    const { drag, log } = harness({ board: ONE_MOVER, squareAt: () => sq(4, 6) });
    drag.down(at(100, 100));
    drag.move(at(130, 100));
    drag.up(at(131, 101));
    expect(log.filter((l) => l.startsWith('activate')), 'picked up, not put down')
      .toEqual(['activate 4,6']);
  });

  it('does the same when it is dropped off the board entirely', () => {
    let under: Square | null = sq(4, 6);
    const { drag, log } = harness({ board: ONE_MOVER, squareAt: () => under });
    drag.down(at(100, 100));
    drag.move(at(130, 100));
    under = null;
    drag.up(at(9000, 9000));
    expect(log.filter((l) => l.startsWith('activate'))).toEqual(['activate 4,6']);
  });

  it('⚠️ a drop that is not a MOVE does nothing but put the piece back', () => {
    /*
     * The Dev's rule, 2026-10-04: "onde ela soltar e a jogada, desde que seja permitida, senao a
     * peca volta para o lugar inicial." Nothing else — and "nothing else" is the part worth
     * pinning, because `activate` is a rich funnel: an empty square that is not a target would
     * become a chosen DESTINATION, arming the other order of operations behind the player's back.
     */
    let under = sq(4, 6);
    const { drag, log } = harness({ board: ONE_MOVER, squareAt: () => under });
    drag.down(at(100, 100));
    drag.move(at(130, 100));
    under = sq(7, 0);                       // a square the pawn cannot reach
    drag.up(at(400, 20));

    expect(log.filter((l) => l.startsWith('activate')), 'picked up, never put anywhere')
      .toEqual(['activate 4,6']);
    expect(log[log.length - 1], 'and the piece is back on the board').toBe('carry none');
  });

  it('a release with no carry is not a carry, so the view keeps its own click', () => {
    const { drag } = harness({ board: ONE_MOVER, squareAt: () => sq(4, 6) });
    drag.down(at(100, 100));
    expect(drag.up(at(101, 100)), 'the view handles this press').toBe(false);
  });

  it('⚠️ abandon drops the carry without playing anything', () => {
    // The wheel and the hold timer both take the press over mid-gesture. Whatever was in hand has
    // to stay where it is: a camera gesture must not move a piece.
    let under = sq(4, 6);
    const { drag, log } = harness({ board: ONE_MOVER, squareAt: () => under });
    drag.down(at(100, 100));
    drag.move(at(130, 100));
    drag.abandon();
    under = sq(3, 4);

    expect(drag.carrying()).toBeNull();
    expect(drag.up(at(160, 140)), 'nothing left to settle').toBe(false);
    expect(log.filter((l) => l.startsWith('activate')), 'the piece was not moved')
      .toEqual(['activate 4,6']);
  });
});
