// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= A RULE THAT CAN BE RACED IS A RULE THAT CAN BE CHECKED =========================
// The rule of the square is a closed form: compare two numbers and you have the answer without
// playing anything. That is exactly what makes it teachable, and exactly what makes it easy to get
// subtly wrong — an off-by-one in the tempo, or forgetting the pawn's double step, produces a rule
// that is right most of the time and wrong in the positions a learner is most likely to meet.
//
// ⚠️ SO EVERY POSITION ON THE BOARD IS RACED, and the closed form is required to agree with the
// race. The race is a different computation — step the pawn, step the king, alternate, see who
// arrives — rather than the same arithmetic written twice, which is the only way a cross-check is
// worth having.
import { describe, expect, it } from 'vitest';
import {
  catchesPawn, everySquare, kingMoves, opposition, pawnMoves, promotionSquare,
} from '../app/js/endgame/geometry.ts';
import { RANKS, type Side, type Square } from '../app/js/chess/types.ts';

const at = (name: string): Square => ({
  x: 'abcdefgh'.indexOf(name[0]!),
  y: RANKS - Number(name[1]),
});

/**
 * Plays the race out, one move at a time.
 *
 * The pawn walks; the king walks at it. Neither is doing anything clever, because in a bare
 * king-and-pawn race there is nothing clever to do: the pawn's path is fixed and the king's best
 * is straight at the square the pawn is going to.
 */
function race(pawn: Square, pawnSide: Side, king: Square, toMove: Side): boolean {
  const goal = promotionSquare(pawn, pawnSide);
  const step = pawnSide === 'w' ? -1 : 1;
  const home = pawnSide === 'w' ? RANKS - 2 : 1;
  let p = { ...pawn };
  let k = { ...king };
  let turn = toMove;
  let first = true;

  for (let ply = 0; ply < 64; ply += 1) {
    if (turn === pawnSide) {
      // The king standing on the square in front of the pawn stops it dead; standing ON the pawn
      // has taken it. Either way the pawn is not promoting.
      if (k.x === p.x && k.y === p.y + step) return true;
      if (k.x === p.x && k.y === p.y) return true;
      p = { x: p.x, y: p.y + (first && p.y === home ? step * 2 : step) };
      first = false;
      if (p.y === goal.y) return false;             // promoted, uncaught
    } else {
      if (kingMoves(k, goal) === 0) return true;    // sitting on the queening square
      k = {
        x: k.x + Math.sign(goal.x - k.x),
        y: k.y + Math.sign(goal.y - k.y),
      };
      // Caught it on the way, or got there first.
      if (k.x === p.x && k.y === p.y) return true;
    }
    turn = turn === 'w' ? 'b' : 'w';
  }
  return true;
}

describe('[Square rule] the closed form agrees with the race, everywhere', () => {
  it('⚠️ on every legal pawn, every king square, and both sides to move', () => {
    let checked = 0;
    for (const side of ['w', 'b'] as const) {
      for (const pawn of everySquare()) {
        // A pawn cannot stand on the first or last rank.
        if (pawn.y === 0 || pawn.y === RANKS - 1) continue;
        for (const king of everySquare()) {
          if (king.x === pawn.x && king.y === pawn.y) continue;
          for (const toMove of ['w', 'b'] as const) {
            const said = catchesPawn(pawn, side, king, toMove);
            const ran = race(pawn, side, king, toMove);
            expect(`${side} p${pawn.x},${pawn.y} k${king.x},${king.y} ${toMove}: ${said}`)
              .toBe(`${side} p${pawn.x},${pawn.y} k${king.x},${king.y} ${toMove}: ${ran}`);
            checked += 1;
          }
        }
      }
    }
    // A guard on the guard: roughly 2 sides x 48 pawn squares x 63 kings x 2 turns.
    expect(checked).toBeGreaterThan(10_000);
  });
});

describe('[Square rule] the positions a learner is actually shown', () => {
  it('⚠️ counts the double step, which is where this is taught wrongly', () => {
    /*
     * A white pawn on h2 is six ranks from promoting and needs FIVE moves, because its first may
     * be a double. A rule that forgot that would draw the square one file too small and tell a
     * child their king was safe when it was not.
     */
    expect(pawnMoves(at('h2'), 'w')).toBe(5);
    expect(pawnMoves(at('h3'), 'w')).toBe(5);
    expect(pawnMoves(at('h7'), 'w')).toBe(1);
    expect(pawnMoves(at('a7'), 'b')).toBe(5);
    expect(pawnMoves(at('a2'), 'b')).toBe(1);
  });

  it('⚠️ a tempo is worth exactly one file of square', () => {
    // The same position, twice, differing only in whose move it is — which is every position where
    // the rule looks wrong to a learner.
    const pawn = at('h4');
    const king = at('d5');
    expect(catchesPawn(pawn, 'w', king, 'b')).toBe(true);
    expect(catchesPawn(pawn, 'w', king, 'w')).toBe(false);
  });

  it('catches a pawn it is already standing in front of', () => {
    expect(catchesPawn(at('e5'), 'w', at('e6'), 'w')).toBe(true);
    expect(catchesPawn(at('e5'), 'w', at('e6'), 'b')).toBe(true);
  });

  it('cannot catch one that is too far away, whoever moves', () => {
    expect(catchesPawn(at('h5'), 'w', at('a5'), 'b')).toBe(false);
    expect(catchesPawn(at('h5'), 'w', at('a5'), 'w')).toBe(false);
  });
});

describe('[Opposition] whoever does not have to move', () => {
  it('names the direct opposition, and gives it to the side NOT to move', () => {
    // e4 against e6: one square between, and White to move must give way.
    const held = opposition(at('e4'), at('e6'), 'w');
    expect(held).toEqual({ kind: 'direct', holder: 'b' });
    expect(opposition(at('e4'), at('e6'), 'b')).toEqual({ kind: 'direct', holder: 'w' });
  });

  it('names the distant one, which is the same idea further apart', () => {
    expect(opposition(at('e2'), at('e8'), 'w')?.kind).toBe('distant');
    expect(opposition(at('a4'), at('e4'), 'w')?.kind).toBe('distant');
  });

  it('names the diagonal one', () => {
    expect(opposition(at('c3'), at('e5'), 'w')?.kind).toBe('diagonal');
    expect(opposition(at('b2'), at('f6'), 'b')?.kind).toBe('diagonal');
  });

  it('⚠️ counts the squares BETWEEN, not the distance', () => {
    /*
     * Opposition is an ODD number of squares between, which is an EVEN distance. Getting the
     * parity backwards gives a rule that is confidently wrong half the time — and it looks right
     * whenever it is checked on a single example, which is how it survives.
     */
    expect(opposition(at('e4'), at('e7'), 'w')).toBeNull();   // two between: not opposition
    expect(opposition(at('e4'), at('e6'), 'w')).not.toBeNull(); // one between: it is
    expect(opposition(at('e2'), at('e8'), 'w')).not.toBeNull(); // five between: it is
  });

  it('refuses kings that are not aligned at all', () => {
    expect(opposition(at('e4'), at('f7'), 'w')).toBeNull();
    expect(opposition(at('a1'), at('c4'), 'b')).toBeNull();
  });

  it('⚠️ refuses adjacent kings, which are not a position', () => {
    // Two kings cannot stand beside each other: they would be attacking one another. A rule that
    // answered anyway would be answering about a board that cannot exist.
    expect(opposition(at('e4'), at('e5'), 'w')).toBeNull();
    expect(opposition(at('e4'), at('f5'), 'w')).toBeNull();
    expect(opposition(at('e4'), at('e4'), 'w')).toBeNull();
  });
});
