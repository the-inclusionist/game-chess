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

  it('⚠️ takes an empty square as a DESTINATION when a piece could reach it', () => {
    /*
     * The Dev, 2026-10-04: "o contrario (clicar na casa e depois clicar na peca) tambem deve ser
     * possivel". This used to answer `{ ignored: empty }`, which is what made piece-first the
     * only order the game understood.
     */
    const game = solo();
    const result = game.activate(sq('e4'));
    expect(result.kind).toBe('aimed');
    expect(toAlgebraic(game.destination()!)).toBe('e4');
    // ⚠️ `targets` is MIRRORED here: the pieces that can COME, not the squares one piece can go
    // to. Only the e-pawn reaches e4 at the opening — the knights do not, which is worth stating
    // because the first draft of this test assumed they did.
    expect(game.legalTargets().map(toAlgebraic)).toEqual(['e2']);
    // Aiming is not a phase: the board is idle, it is merely remembering a square.
    expect(game.phase()).toBe('idle');
  });

  it('⚠️ names EVERY piece that can reach it, which is the point of the gesture', () => {
    /*
     * The order exists for the position where the destination is obvious and the piece is not.
     * f3 at the opening is reachable by the f-pawn and by the king's knight, and answering "which
     * of mine can get there" is the whole reason a destination carries a list at all.
     */
    const game = solo();
    const result = game.activate(sq('f3'));
    expect(result.kind).toBe('aimed');
    expect(game.legalTargets().map(toAlgebraic).sort()).toEqual(['f2', 'g1']);
  });

  it('still ignores an empty square that NOTHING can reach, and says why', () => {
    // The guard that keeps aiming from becoming a mode the player cannot see or leave.
    const game = solo();
    expect(game.activate(sq('e5'))).toEqual({ kind: 'ignored', reason: 'empty' });
    expect(game.destination()).toBeNull();
  });

  it('plays the move when the piece is chosen second', () => {
    const game = solo();
    game.activate(sq('e4'));
    const result = game.activate(sq('e2'));
    expect(result.kind).toBe('moved');
    expect(game.destination()).toBeNull();
  });

  it('⚠️ picks the piece up instead when it cannot reach the chosen square', () => {
    // The player changed their mind about where to go, rather than asked for the impossible.
    const game = solo();
    game.activate(sq('e4'));
    const result = game.activate(sq('a1'));   // a rook, boxed in at the opening
    expect(result.kind).toBe('selected');
    expect(game.destination(), 'the old destination is let go').toBeNull();
  });

  it('lets go of the destination when it is chosen a second time', () => {
    const game = solo();
    game.activate(sq('e4'));
    expect(game.activate(sq('e4'))).toEqual({ kind: 'unaimed' });
    expect(game.destination()).toBeNull();
    expect(game.legalTargets()).toEqual([]);
  });

  it('does not aim at all when the board says not to', () => {
    // A lesson's `mark` step is answered by touching empty squares; see `GameStateOptions.aiming`.
    const game = createGameState({ rules: createRules(), opponent: false, aiming: false });
    expect(game.activate(sq('e4'))).toEqual({ kind: 'ignored', reason: 'empty' });
    expect(game.destination()).toBeNull();
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

/*
 * ========================= ⚠️ HANDED, NOT ASSUMED (2026-10-04) =========================
 * Every test in this block used to end its setup at `animationDone()` and expect `thinking`,
 * because `settle()` read `playerSide` and declared the opponent's turn for itself. The Dev
 * changed the rule: "se 2 Jogadores estiver desligado, após o humano jogar será sempre a vez da
 * engine, seja o lance feito pelas brancas ou pelas pretas", and "seja onde parar, o relógio fica
 * pausado aguardando o jogador humano jogar."
 *
 * So the board goes to the opponent when somebody HANDS it over, and `think()` is that somebody.
 * The extra line in each setup is the composition root's `handOver`, written out.
 */
describe('[Opponent] handing the turn over', () => {
  it('⚠️ settles IDLE after your move, and thinks only when handed the board', () => {
    const game = versus();
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    game.animationDone();
    // The line that used to say `thinking`. Whose turn it is and who moves next are two questions.
    expect(game.phase()).toBe('idle');
    game.think();
    expect(game.phase()).toBe('thinking');
  });

  it('accepts nothing while the opponent thinks', () => {
    const game = versus();
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    game.animationDone();
    game.think();
    expect(game.activate(sq('d2'))).toEqual({ kind: 'ignored', reason: 'busy' });
  });

  it('⚠️ `stop()` ends a game the RULES still consider playable — a clock running out', () => {
    /*
     * The Dev, 2026-10-04: "é para terminar, com partida perdida caso o contador chegue a zero."
     *
     * ⚠️ IT IS NOT `settle()`. `settle` asks `rules.isGameOver()`, and a position whose clock has
     * run out is a perfectly legal position — chess.js has nothing to say about it and should not.
     * So the phase is set from outside, and every guard that already refuses input on `over`
     * refuses it here with no new branch, which is what this asserts.
     */
    const game = versus();
    expect(game.phase()).toBe('idle');
    expect(game.rules.isGameOver()).toBe(false);
    game.stop();
    expect(game.phase()).toBe('over');
    expect(game.activate(sq('e2'))).toEqual({ kind: 'ignored', reason: 'over' });
    // The position is untouched: a game lost on time is still the game that was played.
    expect(game.rules.isGameOver()).toBe(false);
  });

  it('⚠️ and `think()` on a finished game is a no-op, so nobody is asked to answer a mate', () => {
    const game = createGameState({
      rules: createRules('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'),
      opponent: true,
    });
    expect(game.phase()).toBe('over');
    game.think();
    expect(game.phase()).toBe('over');
  });

  it("plays the opponent's move and animates it too", () => {
    const game = versus();
    game.activate(sq('e2'));
    game.activate(sq('e4'));
    game.animationDone();
    game.think();

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
    game.think();
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
  // ⚠️ `think()` IS THE COMPOSITION ROOT, WRITTEN OUT. A human move no longer hands the board over
  // by itself — see the note above `[Opponent]` — and these tests are about what happens AFTER the
  // reply, so the setup has to hand it over the way `game-shell.ts` does.
  const played = (game: ReturnType<typeof versus>, from: string, to: string) => {
    game.activate(sq(from));
    game.activate(sq(to));
    game.animationDone();
    game.think();
  };

  it('offers nothing to take back or advance at the start', () => {
    const game = versus();
    expect(game.canTakeBack()).toBe(false);
    expect(game.canReplay()).toBe(false);
    expect(game.takeBack()).toBe(false);
    expect(game.replay()).toBe(false);
  });

  it('⚠️ takes back ONE ply, where it used to take back your move AND the reply', () => {
    /*
     * The Dev, 2026-10-04: "avançar e voltar devem passar a «andar» um lance por vez e não dois
     * como têm feito até agora." The two-ply unit existed to protect the player from a half-
     * rewound board being handed straight back to the engine — which cannot happen now that the
     * engine moves only when it is handed the board.
     */
    const game = versus();
    played(game, 'e2', 'e4');
    // The opponent answers; against a real client this arrives from the worker.
    game.applyOpponentMove(sq('e7'), sq('e5'));
    game.animationDone();
    expect(game.rules.history()).toHaveLength(2);

    expect(game.takeBack()).toBe(true);
    expect(game.rules.history().map((m) => m.san)).toEqual(['e4']);
    expect(game.rules.turn()).toBe('b');
    // ⚠️ AND IT STAYS THE HUMAN'S. Black is on move and nothing asks the engine for it.
    expect(game.phase()).toBe('idle');
    expect(game.selection()).toBeNull();
  });

  it('advances the same ply back onto the board', () => {
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

  it('⚠️ advancing your move alone leaves the board IDLE, waiting for a person', () => {
    /*
     * This said `thinking`, and the comment under it said "the phase has to say so or nobody will
     * ask them to move". That was true while the walk ended in `askOpponent()`. The Dev's rule of
     * 2026-10-04 is the opposite: "seja onde parar, o relógio fica pausado aguardando o jogador
     * humano jogar" — a walk that stops on the engine's colour stops there, and «CPU joga!» is
     * the button for anyone who wants the engine to take that move.
     */
    const game = versus();
    played(game, 'e2', 'e4');
    expect(game.takeBack()).toBe(true);
    expect(game.replay()).toBe(true);
    expect(game.rules.history()).toHaveLength(1);
    expect(game.phase()).toBe('idle');
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
// So the position moves one ply per drawn leg.
//
// ⚠️ `more` IS ALWAYS FALSE SINCE 2026-10-04 and the field is kept rather than deleted. It carried
// a POLICY — two plies against an opponent, one in a hot seat — and the Dev retired the policy:
// "avançar e voltar devem passar a «andar» um lance por vez". The field stays because the shape of
// the walk (step, draw, ask again) is what the renderer is built on, and a unit of more than one
// ply may come back as a «take back the whole move» button without the drawing loop changing.

describe('[History] one ply at a time, so it can be drawn honestly', () => {
  const play = (game: ReturnType<typeof versus>, from: string, to: string) => {
    game.activate(sq(from));
    game.activate(sq(to));
    game.animationDone();
    game.think();   // the composition root's `handOver`, written out
  };

  const opened = () => {
    const game = versus();
    play(game, 'e2', 'e4');
    game.applyOpponentMove(sq('e7'), sq('e5'));
    game.animationDone();
    return game;
  };

  it('⚠️ moves exactly ONE ply and says the unit is FINISHED', () => {
    // `more` was true here: the unit was "until you are on move again". It is the ply now.
    const game = opened();
    const step = game.takeBackStep();
    expect(step?.move.san).toBe('e5');
    expect(step?.more).toBe(false);
    // The half-rewound position: your move is still on the board, which is the whole point.
    expect(game.rules.history().map((m) => m.san)).toEqual(['e4']);
    expect(game.rules.pieceAt(sq('e4'))).toEqual({ type: 'p', side: 'w' });
    expect(game.rules.pieceAt(sq('e5'))).toBeNull();
  });

  it('settles after every step, because every step is a whole unit', () => {
    const game = opened();
    const first = game.takeBackStep();
    expect(first?.more).toBe(false);
    expect(game.phase()).toBe('idle');
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

  it('steps forward the same way, one ply at a time, and stays idle', () => {
    const game = opened();
    game.takeBack();
    game.takeBack();
    const first = game.replayStep();
    expect(first?.move.san).toBe('e4');
    expect(first?.more).toBe(false);
    expect(game.phase()).toBe('idle');
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

/*
 * ========================= ⚠️ `playerSide` NO LONGER DECIDES WHO MAY MOVE =========================
 * This block said a player who chose black starts on `thinking` and may not touch a white piece.
 * The Dev, 2026-10-04: "após o humano jogar será sempre a vez da engine, SEJA O LANCE FEITO PELAS
 * BRANCAS OU PELAS PRETAS" — one person may move either colour, and the engine answers whichever
 * one they moved. `playerSide` stays on the options because the DECLARATION still needs to know
 * which way the board faces for a blind player; `chess/state.ts` no longer reads it.
 */
describe('[Side] the board faces one way and belongs to whoever is on move', () => {
  it('⚠️ starts IDLE even when the board faces black, where it used to start thinking', () => {
    const game = createGameState({ rules: createRules(), playerSide: 'b', opponent: true });
    expect(game.phase()).toBe('idle');
  });

  it('⚠️ lets a player whose board faces black move the white pieces', () => {
    const game = createGameState({ rules: createRules(), playerSide: 'b', opponent: true });
    expect(game.activate(sq('e2')).kind).toBe('selected');
  });

  it('takes back ONE ply whichever way the board faces', () => {
    /*
     * ⚠️ THIS TEST ONCE PROVED AN ASYMMETRY THAT NO LONGER EXISTS, and the asymmetry is worth
     * keeping on the record: the unit used to be "until you are on move again", which is two plies
     * for the side that moves first and one for the other. White at 1.e4 e5 had to unwind the
     * reply AND the move it answered; black only its own e5. The Dev retired the unit on
     * 2026-10-04 — "um lance por vez" — so both sides unwind one ply and the asymmetry is gone
     * along with the rule that produced it.
     */
    const game = createGameState({ rules: createRules(), playerSide: 'b', opponent: true });
    game.think();
    game.applyOpponentMove(sq('e2'), sq('e4'));
    game.animationDone();
    expect(game.phase()).toBe('idle');
    game.activate(sq('e7'));
    game.activate(sq('e5'));
    game.animationDone();

    expect(game.takeBack()).toBe(true);
    expect(game.rules.history().map((m) => m.san)).toEqual(['e4']);
    expect(game.rules.turn()).toBe('b');
    expect(game.phase()).toBe('idle');
  });
});
