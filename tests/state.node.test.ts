// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import { createGameState } from '../app/js/chess/state.ts';
import { fromAlgebraic, toAlgebraic, type Square } from '../app/js/chess/types.ts';

const sq = (name: string): Square => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

const solo = (fen?: string) => createGameState({ rules: createRules(fen), opponent: false });
const versus = (fen?: string) => createGameState({ rules: createRules(fen), opponent: true });

describe('[Selection] picking a piece up and putting it down', () => {
  it('starts idle with nothing selected', () => {
    const game = solo();
    expect(game.phase()).toBe('idle');
    expect(game.selection()).toBeNull();
    expect(game.legalTargets()).toEqual([]);
  });

  it('selects your own piece and offers its destinations', () => {
    const game = solo();
    const result = game.activate(sq('e2'));
    expect(result.kind).toBe('selected');
    expect(game.phase()).toBe('selected');
    expect(toAlgebraic(game.selection()!)).toBe('e2');
    expect(game.legalTargets().map(toAlgebraic).sort()).toEqual(['e3', 'e4']);
  });

  it('lets go when the same square is activated again', () => {
    const game = solo();
    game.activate(sq('e2'));
    expect(game.activate(sq('e2')).kind).toBe('deselected');
    expect(game.phase()).toBe('idle');
    expect(game.selection()).toBeNull();
  });

  it('moves the selection to another of your pieces', () => {
    const game = solo();
    game.activate(sq('e2'));
    const result = game.activate(sq('d2'));
    expect(result.kind).toBe('selected');
    expect(toAlgebraic(game.selection()!)).toBe('d2');
  });

  it('ignores an empty square, and says why', () => {
    const game = solo();
    const result = game.activate(sq('e4'));
    expect(result).toEqual({ kind: 'ignored', reason: 'empty' });
    expect(game.phase()).toBe('idle');
  });

  it("ignores the opponent's piece, and says why", () => {
    const game = solo();
    expect(game.activate(sq('e7'))).toEqual({ kind: 'ignored', reason: 'not-your-turn' });
  });

  it('refuses a destination the piece cannot reach, without losing the selection', () => {
    const game = solo();
    game.activate(sq('e2'));
    const result = game.activate(sq('e5'));
    expect(result.kind).toBe('illegal');
    expect(game.phase()).toBe('selected');
    expect(toAlgebraic(game.selection()!)).toBe('e2');
  });
});

describe('[Moving] a legal destination plays the move', () => {
  it('plays it, reports it, and waits for the animation', () => {
    const game = solo();
    game.activate(sq('e2'));
    const result = game.activate(sq('e4'));
    expect(result.kind).toBe('moved');
    if (result.kind !== 'moved') throw new Error('unreachable');
    expect(result.move.san).toBe('e4');
    expect(game.phase()).toBe('animating');
    expect(game.animating()?.san).toBe('e4');
    expect(game.selection()).toBeNull();
  });

  it('accepts nothing while a piece is in flight', () => {
    const game = solo();
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    expect(game.activate(sq('d7'))).toEqual({ kind: 'ignored', reason: 'busy' });
    expect(game.phase()).toBe('animating');
  });

  it('returns to idle when the animation finishes, with no opponent', () => {
    const game = solo();
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    game.animationDone();
    expect(game.phase()).toBe('idle');
    expect(game.animating()).toBeNull();
    // Hot seat: the other side may now move.
    expect(game.activate(sq('e7')).kind).toBe('selected');
  });
});

describe('[Opponent] handing the turn over', () => {
  it('goes to thinking after your move lands', () => {
    const game = versus();
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    game.animationDone();
    expect(game.phase()).toBe('thinking');
  });

  it('accepts nothing while the opponent thinks', () => {
    const game = versus();
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    game.animationDone();
    expect(game.activate(sq('d2'))).toEqual({ kind: 'ignored', reason: 'busy' });
  });

  it("plays the opponent's move and animates it too", () => {
    const game = versus();
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    game.animationDone();

    const reply = game.applyOpponentMove(sq('e7'), sq('e5'));
    expect(reply?.san).toBe('e5');
    expect(game.phase()).toBe('animating');
    game.animationDone();
    expect(game.phase()).toBe('idle');
    expect(game.rules.turn()).toBe('w');
  });

  it('refuses an opponent move outside its turn', () => {
    const game = versus();
    expect(game.applyOpponentMove(sq('e7'), sq('e5'))).toBeNull();
    expect(game.phase()).toBe('idle');
  });

  it('refuses an illegal opponent move instead of throwing', () => {
    const game = versus();
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    game.animationDone();
    expect(() => game.applyOpponentMove(sq('e7'), sq('e4'))).not.toThrow();
    expect(game.applyOpponentMove(sq('e7'), sq('e4'))).toBeNull();
    expect(game.phase()).toBe('thinking');
  });
});

describe('[Ending] the game stops, and says how', () => {
  it("reaches checkmate and reports the winner", () => {
    const game = solo();
    for (const [from, to] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4']] as const) {
      game.activate(sq(from));
      game.activate(sq(to));
      game.animationDone();
    }
    game.activate(sq('d8'));
    const mate = game.activate(sq('h4'));
    expect(mate.kind).toBe('moved');
    game.animationDone();

    expect(game.phase()).toBe('over');
    expect(game.outcome()).toEqual({ kind: 'checkmate', winner: 'b' });
  });

  it('accepts nothing once it is over', () => {
    const game = solo('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    game.animationDone();  // settle into the terminal phase
    expect(game.phase()).toBe('over');
    expect(game.activate(sq('h8'))).toEqual({ kind: 'ignored', reason: 'over' });
  });

  it('reports stalemate as its own outcome, not as a loss', () => {
    const game = solo('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(game.outcome()).toEqual({ kind: 'stalemate' });
  });

  it('reports a draw by insufficient material', () => {
    const game = solo('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(game.outcome()).toEqual({ kind: 'draw' });
  });

  it('has no outcome while the game is running', () => {
    expect(solo().outcome()).toBeNull();
  });
});

describe('[Check] a check is surfaced on the move that gives it', () => {
  it('flags the move and names the king in trouble', () => {
    const game = solo('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
    game.activate(sq('h1'));
    const result = game.activate(sq('h8'));
    if (result.kind !== 'moved') throw new Error('unreachable');
    expect(result.move.check).toBe(true);
    expect(result.move.checkmate).toBe(false);
    expect(toAlgebraic(game.kingInCheck()!)).toBe('e8');
  });

  it('has no king in check in a quiet position', () => {
    expect(solo().kingInCheck()).toBeNull();
  });
});
