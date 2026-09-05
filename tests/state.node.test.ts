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

// ========================= WHY A TAKE-BACK IS TWO PLIES =========================
// Undoing one ply against an opponent hands the position back with the OPPONENT to move — so the
// engine would immediately play again, and from the player's chair the button would look like it
// did nothing but change the computer's mind. Against an opponent the unit of a take-back is the
// pair: your move and the reply to it, leaving you to move again. In a hot seat there is no reply
// to undo, so the unit is one ply.
//
// Both directions are refused mid-animation. A piece in flight is drawn from a move the rules have
// already applied; pulling that move out from under the animation would leave the renderer holding
// a destination that no longer exists.

describe('[History] take back and advance', () => {
  const played = (game: ReturnType<typeof versus>, from: string, to: string) => {
    game.activate(sq(from));
    game.activate(sq(to));
    game.animationDone();
  };

  it('offers nothing to take back or advance at the start', () => {
    const game = versus();
    expect(game.canTakeBack()).toBe(false);
    expect(game.canReplay()).toBe(false);
    expect(game.takeBack()).toBe(false);
    expect(game.replay()).toBe(false);
  });

  it('takes back your move AND the reply, leaving you to move', () => {
    const game = versus();
    played(game, 'e2', 'e4');
    // The opponent answers; against a real client this arrives from the worker.
    game.applyOpponentMove(sq('e7'), sq('e5'));
    game.animationDone();
    expect(game.rules.history()).toHaveLength(2);

    expect(game.takeBack()).toBe(true);
    expect(game.rules.history()).toHaveLength(0);
    expect(game.rules.turn()).toBe('w');
    expect(game.phase()).toBe('idle');
    expect(game.selection()).toBeNull();
  });

  it('advances the same pair back onto the board', () => {
    const game = versus();
    played(game, 'e2', 'e4');
    game.applyOpponentMove(sq('e7'), sq('e5'));
    game.animationDone();
    const fen = game.rules.fen();

    game.takeBack();
    expect(game.canReplay()).toBe(true);
    expect(game.replay()).toBe(true);
    expect(game.rules.fen()).toBe(fen);
    expect(game.phase()).toBe('idle');
  });

  it('advancing your move alone leaves the opponent to think', () => {
    // Your move was taken back before the reply existed: putting it forward puts the position
    // back on the opponent, and the phase has to say so or nobody will ask them to move.
    const game = versus();
    played(game, 'e2', 'e4');
    expect(game.takeBack()).toBe(true);
    expect(game.replay()).toBe(true);
    expect(game.rules.history()).toHaveLength(1);
    expect(game.phase()).toBe('thinking');
  });

  it('takes back exactly one ply in a hot seat', () => {
    const game = solo();
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    game.animationDone();
    game.activate(sq('e7'));
    game.activate(sq('e5'));
    game.animationDone();

    expect(game.takeBack()).toBe(true);
    expect(game.rules.history()).toHaveLength(1);
    expect(game.rules.turn()).toBe('b');
  });

  it('refuses while a piece is in flight', () => {
    const game = versus();
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    expect(game.phase()).toBe('animating');
    expect(game.canTakeBack()).toBe(false);
    expect(game.takeBack()).toBe(false);
    expect(game.rules.history()).toHaveLength(1);
  });

  it('takes a checkmate back, and the game is on again', () => {
    // Fool's mate, one move short — a hot seat so both sides are played from this board.
    const game = solo('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2');
    game.activate(sq('d8'));
    game.activate(sq('h4'));
    game.animationDone();
    expect(game.phase()).toBe('over');
    expect(game.outcome()).toEqual({ kind: 'checkmate', winner: 'b' });

    expect(game.canTakeBack()).toBe(true);
    expect(game.takeBack()).toBe(true);
    expect(game.phase()).toBe('idle');
    expect(game.outcome()).toBeNull();
  });

  it('clears a selection when the position moves under it', () => {
    const game = versus();
    played(game, 'e2', 'e4');
    game.applyOpponentMove(sq('e7'), sq('e5'));
    game.animationDone();
    game.activate(sq('d2'));
    expect(game.selection()).not.toBeNull();
    game.takeBack();
    expect(game.selection()).toBeNull();
    expect(game.legalTargets()).toEqual([]);
  });
});

// ========================= WHY THE PLIES COME OUT ONE AT A TIME =========================
// Reported, and visible from across the room: pressing back showed the pieces already standing on
// their destination squares, and only THEN animated them arriving there from where they had left.
//
// The cause was not in the animation. `takeBack()` moved both plies before anything was drawn, so
// the second piece was on its destination from the moment the button was pressed and simply
// waited its turn to fly there. Whatever the renderer did with that was going to be a lie.
//
// So the position moves one ply per drawn leg. `more` carries the policy — two plies against an
// opponent, one in a hot seat — without the caller having to know what the policy is.

describe('[History] one ply at a time, so it can be drawn honestly', () => {
  const play = (game: ReturnType<typeof versus>, from: string, to: string) => {
    game.activate(sq(from));
    game.activate(sq(to));
    game.animationDone();
  };

  const opened = () => {
    const game = versus();
    play(game, 'e2', 'e4');
    game.applyOpponentMove(sq('e7'), sq('e5'));
    game.animationDone();
    return game;
  };

  it('moves exactly ONE ply and says the unit is unfinished', () => {
    const game = opened();
    const step = game.takeBackStep();
    expect(step?.move.san).toBe('e5');
    expect(step?.more).toBe(true);
    // The half-rewound position: your move is still on the board, which is the whole point.
    expect(game.rules.history().map((m) => m.san)).toEqual(['e4']);
    expect(game.rules.pieceAt(sq('e4'))).toEqual({ type: 'p', side: 'w' });
    expect(game.rules.pieceAt(sq('e5'))).toBeNull();
  });

  it('finishes on the second ply and settles there', () => {
    const game = opened();
    game.takeBackStep();
    const second = game.takeBackStep();
    expect(second?.move.san).toBe('e4');
    expect(second?.more).toBe(false);
    expect(game.rules.history()).toHaveLength(0);
    expect(game.phase()).toBe('idle');
  });

  it('hands back the move that LEFT the board, which is what has to be drawn', () => {
    const game = opened();
    const step = game.takeBackStep();
    // Travelling backwards means flying from the move's destination to its origin.
    expect(toAlgebraic(step!.move.from)).toBe('e7');
    expect(toAlgebraic(step!.move.to)).toBe('e5');
    expect(step!.move.piece).toEqual({ type: 'p', side: 'b' });
  });

  it('carries the captured piece on the step, so the restore can be held back', () => {
    const game = versus();
    play(game, 'e2', 'e4');
    game.applyOpponentMove(sq('d7'), sq('d5'));
    game.animationDone();
    play(game, 'e4', 'd5');
    game.applyOpponentMove(sq('d8'), sq('d5'));
    game.animationDone();

    const step = game.takeBackStep();
    expect(step?.move.captured).toEqual({ type: 'p', side: 'w' });
    // Already back on the board as far as the rules are concerned — which is exactly why the
    // renderer has to know to hide it until the traveller lands.
    expect(game.rules.pieceAt(sq('d5'))).toEqual({ type: 'p', side: 'w' });
  });

  it('is one ply and finished in a hot seat', () => {
    const game = solo();
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    game.animationDone();
    const step = game.takeBackStep();
    expect(step?.more).toBe(false);
    expect(game.phase()).toBe('idle');
  });

  it('steps forward the same way, and leaves the opponent to think at the end', () => {
    const game = opened();
    game.takeBack();
    const first = game.replayStep();
    expect(first?.move.san).toBe('e4');
    expect(first?.more).toBe(true);
    const second = game.replayStep();
    expect(second?.move.san).toBe('e5');
    expect(second?.more).toBe(false);
    expect(game.phase()).toBe('idle');
  });

  it('says there is nothing to step when there is nothing', () => {
    const game = versus();
    expect(game.takeBackStep()).toBeNull();
    expect(game.replayStep()).toBeNull();
  });

  it('refuses to step while a piece is in flight', () => {
    const game = versus();
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    expect(game.phase()).toBe('animating');
    expect(game.takeBackStep()).toBeNull();
  });

  it('agrees with the whole-unit take-back it is built from', () => {
    const stepwise = opened();
    let step = stepwise.takeBackStep();
    while (step?.more) step = stepwise.takeBackStep();

    const atOnce = opened();
    atOnce.takeBack();

    expect(stepwise.rules.fen()).toBe(atOnce.rules.fen());
    expect(stepwise.phase()).toBe(atOnce.phase());
  });
});
