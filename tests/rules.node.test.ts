// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { fromAlgebraic, toAlgebraic, type Square } from '../app/js/chess/types.ts';
import { createRules } from '../app/js/chess/rules.ts';

const sq = (name: string): Square => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

const names = (squares: readonly Square[]): string[] => squares.map(toAlgebraic).sort();

describe('[Position] the opening position, in our own vocabulary', () => {
  it('places 32 pieces', () => {
    expect(createRules().placements()).toHaveLength(32);
  });

  it('reads a piece back at the square it stands on', () => {
    const rules = createRules();
    expect(rules.pieceAt(sq('e2'))).toEqual({ type: 'p', side: 'w' });
    expect(rules.pieceAt(sq('e1'))).toEqual({ type: 'k', side: 'w' });
    expect(rules.pieceAt(sq('d8'))).toEqual({ type: 'q', side: 'b' });
    expect(rules.pieceAt(sq('e4'))).toBeNull();
  });

  it('starts with white to move', () => {
    expect(createRules().turn()).toBe('w');
  });

  it('loads a position from FEN', () => {
    const rules = createRules('8/8/8/8/8/8/8/K6k w - - 0 1');
    expect(rules.placements()).toHaveLength(2);
    expect(rules.pieceAt(sq('a1'))).toEqual({ type: 'k', side: 'w' });
  });
});

describe('[Legality] what a piece may do', () => {
  it('gives a pawn its two opening squares', () => {
    expect(names(createRules().legalTargets(sq('e2')))).toEqual(['e3', 'e4']);
  });

  it('gives a knight its two openings', () => {
    expect(names(createRules().legalTargets(sq('b1')))).toEqual(['a3', 'c3']);
  });

  it('gives a blocked piece nothing', () => {
    expect(createRules().legalTargets(sq('c1'))).toEqual([]);
  });

  it('gives an empty square nothing', () => {
    expect(createRules().legalTargets(sq('e4'))).toEqual([]);
  });

  it("gives the opponent's piece nothing while it is not their turn", () => {
    expect(createRules().legalTargets(sq('e7'))).toEqual([]);
  });

  it('refuses a move that would leave the king in check', () => {
    // White king e1, white bishop e2 pinned by black rook e8.
    const rules = createRules('4r2k/8/8/8/8/8/4B3/4K3 w - - 0 1');
    expect(names(rules.legalTargets(sq('e2')))).toEqual([]);
  });
});

describe('[Moving] making a move, and refusing one', () => {
  it('reports the move it made in our own terms', () => {
    const rules = createRules();
    const move = rules.move(sq('e2'), sq('e4'));
    expect(move).not.toBeNull();
    expect(toAlgebraic(move!.from)).toBe('e2');
    expect(toAlgebraic(move!.to)).toBe('e4');
    expect(move!.piece).toEqual({ type: 'p', side: 'w' });
    expect(move!.captured).toBeNull();
    expect(move!.san).toBe('e4');
    expect(rules.turn()).toBe('b');
  });

  it('RETURNS NULL for an illegal move rather than throwing', () => {
    // chess.js 1.x throws on an illegal move. A thrown exception in a click handler would take
    // the frame loop down with it, and the engine's loop stops on the first error by design —
    // so an illegal click has to be a value, not an exception.
    const rules = createRules();
    expect(() => rules.move(sq('e2'), sq('e5'))).not.toThrow();
    expect(rules.move(sq('e2'), sq('e5'))).toBeNull();
    expect(rules.turn()).toBe('w');          // and the position is untouched
    expect(rules.placements()).toHaveLength(32);
  });

  it('names what it captured', () => {
    const rules = createRules('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    const move = rules.move(sq('e4'), sq('d5'));
    expect(move!.captured).toEqual({ type: 'p', side: 'b' });
    expect(move!.san).toBe('exd5');
  });

  it('reports castling as castling, with the side', () => {
    const rules = createRules('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
    const move = rules.move(sq('e1'), sq('g1'));
    expect(move!.castle).toBe('king');
    expect(rules.pieceAt(sq('f1'))).toEqual({ type: 'r', side: 'w' });
    expect(rules.pieceAt(sq('h1'))).toBeNull();
  });

  it('reports en passant, including the pawn it removed', () => {
    const rules = createRules('4k3/8/8/8/4pP2/8/8/4K3 b - f3 0 1');
    const move = rules.move(sq('e4'), sq('f3'));
    expect(move!.enPassant).toBe(true);
    expect(move!.captured).toEqual({ type: 'p', side: 'w' });
    expect(rules.pieceAt(sq('f4'))).toBeNull();
  });

  it('promotes, and defaults to a queen when not told otherwise', () => {
    const rules = createRules('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    const move = rules.move(sq('a7'), sq('a8'));
    expect(move!.promotion).toBe('q');
    expect(rules.pieceAt(sq('a8'))).toEqual({ type: 'q', side: 'w' });
  });

  it('promotes to what it is told', () => {
    const rules = createRules('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    const move = rules.move(sq('a7'), sq('a8'), 'n');
    expect(move!.promotion).toBe('n');
    expect(rules.pieceAt(sq('a8'))).toEqual({ type: 'n', side: 'w' });
  });
});

describe('[Outcome] check, mate and the draws', () => {
  it('sees a check', () => {
    const rules = createRules('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
    rules.move(sq('h1'), sq('h8'));
    expect(rules.isCheck()).toBe(true);
    expect(rules.isCheckmate()).toBe(false);
    expect(rules.isGameOver()).toBe(false);
  });

  it("sees fool's mate", () => {
    const rules = createRules();
    rules.move(sq('f2'), sq('f3'));
    rules.move(sq('e7'), sq('e5'));
    rules.move(sq('g2'), sq('g4'));
    const mate = rules.move(sq('d8'), sq('h4'));
    expect(mate!.san).toBe('Qh4#');
    expect(rules.isCheckmate()).toBe(true);
    expect(rules.isGameOver()).toBe(true);
  });

  it('sees stalemate, and does not call it check', () => {
    // Black king h8; white queen f7 covers g8, g7 and h7; white king g6. Nothing to move.
    const rules = createRules('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(rules.isStalemate()).toBe(true);
    expect(rules.isCheck()).toBe(false);
    expect(rules.isDraw()).toBe(true);
    expect(rules.isGameOver()).toBe(true);
  });

  it('sees insufficient material as a draw', () => {
    const rules = createRules('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(rules.isDraw()).toBe(true);
  });
});

describe('[Threat] which squares the opponent covers', () => {
  // This is what turns into the contract's `hazard` role, and from there into the blind
  // navigation sonar warning about squares under attack — with no audio code written here.
  it('reports a square the opponent attacks', () => {
    const rules = createRules('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
    expect(rules.isAttackedBy(sq('h8'), 'w')).toBe(true);
    expect(rules.isAttackedBy(sq('a8'), 'w')).toBe(false);
  });

  it('counts a pawn as attacking diagonally, not forwards', () => {
    const rules = createRules('4k3/8/8/8/4P3/8/8/4K3 w - - 0 1');
    expect(rules.isAttackedBy(sq('d5'), 'w')).toBe(true);
    expect(rules.isAttackedBy(sq('f5'), 'w')).toBe(true);
    expect(rules.isAttackedBy(sq('e5'), 'w')).toBe(false);
  });
});

describe('[History] taking a move back', () => {
  it('restores the previous position', () => {
    const rules = createRules();
    const before = rules.fen();
    rules.move(sq('e2'), sq('e4'));
    expect(rules.fen()).not.toBe(before);
    rules.undo();
    expect(rules.fen()).toBe(before);
    expect(rules.turn()).toBe('w');
  });

  it('keeps the moves played, in our own terms', () => {
    const rules = createRules();
    rules.move(sq('e2'), sq('e4'));
    rules.move(sq('e7'), sq('e5'));
    const history = rules.history();
    expect(history).toHaveLength(2);
    expect(history.map((m) => m.san)).toEqual(['e4', 'e5']);
    expect(toAlgebraic(history[1].from)).toBe('e7');
  });

  it('does nothing when there is nothing to take back', () => {
    const rules = createRules();
    expect(() => rules.undo()).not.toThrow();
    expect(rules.turn()).toBe('w');
  });
});

describe('[Enumeration] every legal move, for the search to walk', () => {
  it('counts the twenty openings', () => {
    expect(createRules().allMoves()).toHaveLength(20);
  });

  it('gives up nothing when the game is over', () => {
    const rules = createRules('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(rules.allMoves()).toEqual([]);
  });

  it('marks a promotion, and offers all four pieces', () => {
    const rules = createRules('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    const promotions = rules.allMoves().filter((m) => m.promotion);
    expect(promotions.map((m) => m.promotion).sort()).toEqual(['b', 'n', 'q', 'r']);
  });

  it('leaves promotion null on an ordinary move', () => {
    expect(createRules().allMoves().every((m) => m.promotion === null)).toBe(true);
  });
});

// ========================= WHY REDO LIVES HERE AND NOT IN THE HUD =========================
// chess.js can take a move back and cannot put one back: `undo()` returns the move it removed and
// then forgets it. A redo stack therefore has to be held by somebody, and the only honest place is
// the module that already owns the position — anywhere else and two objects would each believe
// they knew the history, which is how the move list and the board drift apart.
//
// The rule that matters is the one every editor has: playing a NEW move discards the future. A
// take-back followed by a different move is a different game, and offering to "advance" into the
// one that was abandoned would put a move on the board that nobody played.

describe('[History] taking a move back and putting it forward again', () => {
  const e4 = () => { const r = createRules(); r.move(sq('e2'), sq('e4')); return r; };

  it('has nothing to take back or advance at the start', () => {
    const rules = createRules();
    expect(rules.canUndo()).toBe(false);
    expect(rules.canRedo()).toBe(false);
  });

  it('takes the last move off the board and off the score sheet', () => {
    const rules = e4();
    expect(rules.canUndo()).toBe(true);
    rules.undo();
    expect(rules.pieceAt(sq('e4'))).toBeNull();
    expect(rules.pieceAt(sq('e2'))).toEqual({ type: 'p', side: 'w' });
    expect(rules.history()).toHaveLength(0);
    expect(rules.turn()).toBe('w');
  });

  it('puts it back exactly where it was, notation included', () => {
    const rules = e4();
    const before = rules.fen();
    rules.undo();
    expect(rules.canRedo()).toBe(true);
    expect(rules.redo()).toBe(true);
    expect(rules.fen()).toBe(before);
    expect(rules.history().map((m) => m.san)).toEqual(['e4']);
    expect(rules.canRedo()).toBe(false);
  });

  it('restores a captured piece on the way back and takes it again on the way forward', () => {
    const rules = createRules();
    rules.move(sq('e2'), sq('e4'));
    rules.move(sq('d7'), sq('d5'));
    rules.move(sq('e4'), sq('d5'));
    expect(rules.history().at(-1)?.captured).toEqual({ type: 'p', side: 'b' });

    rules.undo();
    expect(rules.pieceAt(sq('d5'))).toEqual({ type: 'p', side: 'b' });
    rules.redo();
    expect(rules.pieceAt(sq('d5'))).toEqual({ type: 'p', side: 'w' });
    // Read back from the history, which is where the HUD counts captures from.
    expect(rules.history().at(-1)?.captured).toEqual({ type: 'p', side: 'b' });
  });

  it('unwinds the whole game and rewinds it', () => {
    const rules = createRules();
    for (const [from, to] of [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6']]) {
      rules.move(sq(from), sq(to));
    }
    const end = rules.fen();
    while (rules.canUndo()) rules.undo();
    expect(rules.fen()).toBe(createRules().fen());
    while (rules.canRedo()) rules.redo();
    expect(rules.fen()).toBe(end);
    expect(rules.history()).toHaveLength(4);
  });

  it('DISCARDS the future when a different move is played', () => {
    const rules = e4();
    rules.undo();
    rules.move(sq('d2'), sq('d4'));
    expect(rules.canRedo()).toBe(false);
    expect(rules.history().map((m) => m.san)).toEqual(['d4']);
  });

  it('refuses to advance when there is nothing ahead', () => {
    expect(createRules().redo()).toBe(false);
  });
});
