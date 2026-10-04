// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/drag-to-move — press a piece, move, let go on a square. The gesture every other board has.
//
// ========================= WHY THIS EXISTS =========================
// The Dev, 2026-10-04: "alem do virtualController da engine para controlar as pecas, deve-se
// permitir o controle com o mouse como se fosse um aplicativo comum".
//
// Clicking already worked everywhere — press a piece, press a square, the move is played. What was
// missing is the gesture anybody who has used a board on a screen reaches for first: picking the
// piece UP. A game that refuses it does not feel broken in a way you could report; it feels like
// it is not listening.
//
// ========================= WHY IT IS A MODULE AND NOT TWO COPIES =========================
// The projected board and the solid board already carry two parallel pointer implementations, each
// with its own hold-to-turn timer, its own slop and its own way of turning a point into a square.
// Writing the carry twice would be a third parallel pair — and this repository has the receipts on
// what that costs: the panel's focus selector was written out in two places and the SAME hole got
// dug in it twice, a year apart.
//
// So the views keep what is genuinely theirs (how a point becomes a square, how the camera turns)
// and hand it here. ⚠️ Nothing in this file touches the DOM or either renderer: it takes two
// numbers and answers questions, which is also what makes it testable without a canvas.
//
// ========================= ⚠️ THE GESTURE IT HAS TO SHARE THE POINTER WITH =========================
// On both canvases a press held for a second turns the board. That is a deliberate feature with
// its own long note in `render/camera.ts`, and a carry must not break it. The two are told apart
// by WHEN the pointer moves rather than by how far:
//
//   · moved early, off a piece that has somewhere to go  -> a carry
//   · held still, then moved                             -> the camera
//   · moved early, off an empty square or a piece that cannot move -> the camera, as before
//
// A carry therefore cancels the hold timer, and the view must not orbit while `move()` says a
// piece is in hand.

import type { Rules } from '../chess/rules.ts';
import type { Square } from '../chess/types.ts';

/** A point in client coordinates. Only these two fields are read, which is what tests exploit. */
export interface Point {
  readonly clientX: number;
  readonly clientY: number;
}

export interface DragToMoveDeps {
  /** The square under a client point, or null off the board. The view's own picking. */
  squareAt(point: Point): Square | null;
  rules(): Rules;
  /** The square currently held, so a carry does not deselect a piece that was already picked up. */
  selection(): Square | null;
  /** The shell's one entry point for a player action — the same funnel a click uses. */
  activate(square: Square): void;
  /** Moves the cursor without acting, which is what gives the carry its live feedback. */
  focus(square: Square): void;
  /**
   * Lifts the piece off its square and draws it under the pointer, or puts it back.
   *
   * ⚠️ CALLED WITH `null` ON EVERY ENDING, including the refused drop and the abandoned press.
   * A piece left in the air is a position the board is lying about.
   */
  carry(from: Square | null, at: Point | null): void;
  /** Cancels the view's hold-to-turn timer once a carry has started. */
  cancelHold(): void;
  /**
   * Client pixels of travel before a press becomes a carry.
   *
   * ⚠️ BIGGER THAN A CLICK'S SLOP, deliberately. A click tolerates a few pixels of tremor; a carry
   * has to be a decision. Equal thresholds would make every slightly unsteady click a drag that
   * lands on the square it started on — harmless, but it would select and deselect under a hand
   * that never meant to move.
   */
  readonly slop?: number;
}

export interface DragToMove {
  /** A press began. Records where, and nothing else: a press is not yet a carry. */
  down(point: Point): void;
  /**
   * The pointer moved. Returns true while a piece is in hand, and the view must then NOT orbit —
   * the pointer belongs to the piece for the rest of this press.
   */
  move(point: Point): boolean;
  /**
   * The press ended. Returns true if this was a carry, which the view must then not also read as
   * a click: the drop has already been acted on.
   */
  up(point: Point): boolean;
  /** The press was taken over by something else (the wheel, the hold timer, a cancel). */
  abandon(): void;
  /** The square a piece is being carried from, or null. */
  carrying(): Square | null;
  /**
   * Whether this press landed on a piece with somewhere to go, answered at `down()`.
   *
   * ⚠️ THE TWO GESTURES HAVE TO BE DISJOINT, and this is what makes them so. The Dev, 2026-10-04:
   * "deixar apertado o botao do mouse sobre uma peca faz o mouse pegar a peca", and "caso o drag
   * seja feito FORA de uma peca... ele deve continuar servindo para rotacionar o tabuleiro".
   *
   * Before this, holding a press for a second armed the camera WHEREVER it was — so holding on a
   * piece and then moving turned the board instead of picking the piece up, which is the opposite
   * of the sentence above. A view asks this at `pointerdown` and simply does not arm its hold when
   * the answer is yes: a press on a piece belongs to the piece for its whole life.
   */
  grabbable(): boolean;
}

const same = (a: Square, b: Square): boolean => a.x === b.x && a.y === b.y;

export function createDragToMove(deps: DragToMoveDeps): DragToMove {
  const slop = deps.slop ?? 6;

  let origin: Point | null = null;
  let from: Square | null = null;
  let takeable = false;
  let carried: Square | null = null;
  /** The square the cursor was last moved to, so the carry does not redraw on every pixel. */
  let over: Square | null = null;

  const reset = (): void => {
    origin = null;
    from = null;
    takeable = false;
    carried = null;
    over = null;
  };

  return {
    carrying: () => carried,
    grabbable: () => takeable,

    down(point) {
      reset();
      origin = { clientX: point.clientX, clientY: point.clientY };
      from = deps.squareAt(point);
      // ⚠️ ASKED ONCE, HERE, rather than on every move. The answer decides which gesture owns the
      // press, and a question whose answer could change halfway through a press would make the
      // board switch from carrying to turning under the player's hand.
      takeable = from !== null && deps.rules().legalTargets(from).length > 0;
    },

    move(point) {
      if (origin === null) return false;

      if (carried === null) {
        const travelled = Math.hypot(point.clientX - origin.clientX, point.clientY - origin.clientY);
        if (travelled < slop) return false;
        /*
         * ⚠️ THE GATE IS "HAS SOMEWHERE TO GO", NOT "IS A PIECE". `legalTargets` is empty for an
         * empty square, for the wrong side's turn and for a piece that is pinned solid — so this
         * one question covers all three without this file knowing anything about chess, and it has
         * NO SIDE EFFECTS, which matters: a gate that had to call `activate` to find out would
         * deselect a piece the player was already holding just to answer the question.
         */
        if (!takeable || from === null) {
          // Not a carry. The press is the camera's now, and the view's own hold decides when.
          origin = null;
          return false;
        }
        deps.cancelHold();
        carried = from;
        deps.carry(from, point);
        /*
         * ⚠️ ONLY IF IT IS NOT ALREADY IN HAND. Clicking a piece selects it; dragging the same
         * piece a moment later must not call `activate` again, because the second call is what the
         * shell reads as "put it down".
         */
        const held = deps.selection();
        if (held === null || !same(held, carried)) deps.activate(carried);
        over = carried;
      }

      // Live feedback: the cursor follows the pointer, so the square you are about to drop on is
      // lit the whole way there. Only on a CHANGE of square — this runs on every pointer move.
      // ⚠️ EVERY MOVE, not only on a change of square: this is the half the player feels. The
      // cursor below is the one that only moves square to square, because each of those is a
      // redraw of the whole marker layer.
      deps.carry(carried, point);
      const under = deps.squareAt(point);
      if (under && (over === null || !same(under, over))) {
        over = under;
        deps.focus(under);
      }
      return true;
    },

    up(point) {
      const held = carried;
      const started = origin !== null;
      reset();
      if (held === null) return false;
      /*
       * ⚠️ PUT DOWN BEFORE THE MOVE IS TRIED, not after. `activate` repaints the position, and a
       * piece still marked as carried would be drawn in the air over the new one. And when the
       * drop is refused this IS the whole of "the piece goes back": the board never changed, so
       * putting the carried piece down restores exactly what was there.
       */
      deps.carry(null, null);

      const to = deps.squareAt(point);
      /*
       * ========================= ⚠️ A DROP ACTS ONLY IF IT IS A MOVE =========================
       * The Dev's rule, 2026-10-04: "onde ela soltar e a jogada, desde que seja permitida, senao
       * a peca volta para o lugar inicial." Nothing else — and "nothing else" is the part that
       * needed writing down, because `activate` is a rich funnel and every other outcome it has
       * would be a surprise here:
       *
       *   · an empty square that is not a target would become a chosen DESTINATION, so a failed
       *     drag would silently arm the other order of operations;
       *   · another of your own pieces would get picked up, so a failed drag would hand you a
       *     different piece than the one you were holding.
       *
       * Both are right for a CLICK, where each press is its own decision. A drag is one decision,
       * and it either lands or it does not. Putting the piece down above is the whole of "volta
       * para o lugar inicial": the board never changed.
       */
      const legal = to !== null && !same(to, held)
        && deps.rules().legalTargets(held).some((t) => same(t, to));
      if (legal && to) deps.activate(to);
      return started;
    },

    abandon() {
      // The wheel or the hold timer took the press over. Whatever was in hand goes back.
      if (carried) deps.carry(null, null);
      reset();
    },
  };
}
