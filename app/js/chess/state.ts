// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/state — whose turn it is, what is selected, and what is allowed right now.
//
// ========================= ONE DOOR IN =========================
// `activate(square)` is the ONLY way a player affects the game, and both the pointer and the
// keyboard go through it. That is not tidiness: the DOM grid mirror at step 7 has to behave
// identically to a click, and the surest way to guarantee that is to leave it no other path.
//
// It returns a description of WHAT HAPPENED rather than mutating and staying silent. The renderer
// reads it to place markers; the announcer reads it to speak; a test reads it to assert. A method
// that returned void would force all three to re-derive the same fact from the new state.
//
// ========================= THE PHASES ARE ABOUT INPUT, NOT ABOUT CHESS =========================
// `idle → selected → animating → thinking → over`. Chess itself has no notion of "animating"; the
// phase exists because a piece in flight must not accept another click, and because the engine's
// frame loop needs to know when it is allowed to move something.
//
// No module-level state: `createGameState()` returns an instance and the composition root owns it.

import type { MoveResult, Rules } from './rules.ts';
import type { Side, Square } from './types.ts';

export type Phase = 'idle' | 'selected' | 'animating' | 'thinking' | 'over';

export type Activation =
  | { readonly kind: 'selected'; readonly square: Square; readonly targets: readonly Square[] }
  | { readonly kind: 'deselected' }
  | { readonly kind: 'moved'; readonly move: MoveResult }
  | { readonly kind: 'illegal'; readonly square: Square }
  | {
      readonly kind: 'ignored';
      readonly reason: 'empty' | 'not-your-turn' | 'busy' | 'over';
    };

/**
 * One ply of a walk through the score sheet, handed to a caller that draws it.
 *
 * ========================= WHY A CALLER NEEDS THE PLIES ONE AT A TIME =========================
 * `takeBack()` moves the whole unit — your move and the reply to it — and that is the right unit
 * for a button. It is the wrong unit for an ANIMATION: applying both plies and then drawing them
 * means the second piece stands on its destination from the moment the button is pressed, and
 * only starts travelling once the first has landed. It teleports, then flies.
 *
 * So the position moves one ply at a time, and `more` says whether the unit is finished. The
 * policy — two plies against an opponent, one in a hot seat — stays here; only the clock belongs
 * to whoever is drawing.
 */
export interface HistoryStep {
  /** The move that left the board, or arrived on it. */
  readonly move: MoveResult;
  /** True while the unit is unfinished: step again once this one has been drawn. */
  readonly more: boolean;
}

export type Outcome =
  | { readonly kind: 'checkmate'; readonly winner: Side }
  | { readonly kind: 'stalemate' }
  | { readonly kind: 'draw' };

export interface GameStateOptions {
  readonly rules: Rules;
  /** Which side the human plays. Only consulted when there is an opponent. */
  readonly playerSide?: Side;
  /** false = hot seat: both sides are driven from the same board. Default true. */
  readonly opponent?: boolean;
}

export interface GameState {
  readonly rules: Rules;
  phase(): Phase;
  selection(): Square | null;
  legalTargets(): readonly Square[];
  /** The move currently in flight, for the renderer to animate. */
  animating(): MoveResult | null;
  /** Where the king under attack stands, or null. Drives the check marker and the alert. */
  kingInCheck(): Square | null;
  outcome(): Outcome | null;
  /** The single entry point for a player action, from pointer or keyboard alike. */
  activate(square: Square): Activation;
  /** The renderer says the piece has arrived. Also settles the phase if nothing was in flight. */
  animationDone(): void;
  /** The opponent's chosen move. Only accepted while thinking; never throws. */
  applyOpponentMove(from: Square, to: Square, promotion?: MoveResult['promotion']): MoveResult | null;

  /**
   * ========================= WHY A TAKE-BACK IS TWO PLIES =========================
   * Undoing ONE ply against an opponent hands the position back with the opponent to move, so the
   * engine immediately plays again — from the player's chair the button would look like it did
   * nothing except change the computer's mind. Against an opponent the unit is the pair: your move
   * and the reply to it, leaving you to move again. In a hot seat there is no reply, so it is one.
   *
   * Both directions are refused mid-animation. A piece in flight is drawn from a move the rules
   * have already applied; pulling that move out from under it would leave the renderer holding a
   * destination that no longer exists. `thinking` is NOT refused — a player who has changed their
   * mind should not have to wait for the search, and cancelling it belongs to whoever owns the
   * worker, not here.
   */
  canTakeBack(): boolean;
  canReplay(): boolean;
  /** Returns whether anything moved, so the caller knows whether to redraw and speak. */
  takeBack(): boolean;
  replay(): boolean;
  /** The same two operations, one ply at a time, for a caller that animates them. */
  takeBackStep(): HistoryStep | null;
  replayStep(): HistoryStep | null;
}

export function createGameState(options: GameStateOptions): GameState {
  const { rules } = options;
  const playerSide: Side = options.playerSide ?? 'w';
  const hasOpponent = options.opponent ?? true;

  let phase: Phase = 'idle';
  let selection: Square | null = null;
  let targets: readonly Square[] = [];
  let inFlight: MoveResult | null = null;

  /** Works out which phase the position implies, once nothing is in flight. */
  function settle(): void {
    selection = null;
    targets = [];
    inFlight = null;
    if (rules.isGameOver()) phase = 'over';
    else if (hasOpponent && rules.turn() !== playerSide) phase = 'thinking';
    else phase = 'idle';
  }

  function select(square: Square): Activation {
    selection = square;
    targets = rules.legalTargets(square);
    phase = 'selected';
    return { kind: 'selected', square, targets };
  }

  function play(from: Square, to: Square): MoveResult | null {
    const move = rules.move(from, to);
    if (!move) return null;
    selection = null;
    targets = [];
    inFlight = move;
    phase = 'animating';
    return move;
  }

  /**
   * Is the board still the opponent's after the ply just moved? That is the whole rule, and it is
   * why a take-back is two plies against an opponent and one in a hot seat: the unit ends when the
   * player is on move again.
   */
  const unfinished = (canContinue: boolean): boolean =>
    hasOpponent && canContinue && rules.turn() !== playerSide;

  function stepBack(): HistoryStep | null {
    if (phase === 'animating' || !rules.canUndo()) return null;
    const history = rules.history();
    const move = history[history.length - 1];
    rules.undo();
    const more = unfinished(rules.canUndo());
    // Settled only when the unit is complete. Half a take-back is not a position anyone may play
    // from, and settling into it would hand the board back mid-rewind.
    if (!more) settle();
    return { move, more };
  }

  function stepForward(): HistoryStep | null {
    if (phase === 'animating' || !rules.canRedo()) return null;
    if (!rules.redo()) return null;
    const history = rules.history();
    const move = history[history.length - 1];
    const more = unfinished(rules.canRedo());
    // If the redo stack ran out on the opponent's turn, `settle` says `thinking` and the
    // composition root asks them to move. That is the right answer, not an edge case.
    if (!more) settle();
    return { move, more };
  }

  settle();

  return {
    rules,
    phase: () => phase,
    selection: () => selection,
    legalTargets: () => targets,
    animating: () => inFlight,

    kingInCheck() {
      if (!rules.isCheck()) return null;
      const side = rules.turn();
      const king = rules.placements()
        .find((p) => p.piece.type === 'k' && p.piece.side === side);
      return king ? king.square : null;
    },

    outcome() {
      if (rules.isCheckmate()) {
        // The side to move is the one that has been mated, so the winner is the other.
        return { kind: 'checkmate', winner: rules.turn() === 'w' ? 'b' : 'w' };
      }
      // Order matters: chess.js counts stalemate as a draw, and stalemate is the more specific
      // thing to say — "afogamento" is not the same news as "empate".
      if (rules.isStalemate()) return { kind: 'stalemate' };
      if (rules.isDraw()) return { kind: 'draw' };
      return null;
    },

    activate(square) {
      if (phase === 'over') return { kind: 'ignored', reason: 'over' };
      if (phase === 'animating' || phase === 'thinking') {
        return { kind: 'ignored', reason: 'busy' };
      }

      if (selection && selection.x === square.x && selection.y === square.y) {
        selection = null;
        targets = [];
        phase = 'idle';
        return { kind: 'deselected' };
      }

      const piece = rules.pieceAt(square);

      // Your own piece, whichever phase: pick it up, or move the selection to it.
      if (piece && piece.side === rules.turn()) return select(square);

      if (phase === 'selected' && selection) {
        const move = play(selection, square);
        if (move) return { kind: 'moved', move };
        return { kind: 'illegal', square };
      }

      return { kind: 'ignored', reason: piece ? 'not-your-turn' : 'empty' };
    },

    animationDone() {
      settle();
    },

    canTakeBack: () => phase !== 'animating' && rules.canUndo(),
    canReplay: () => phase !== 'animating' && rules.canRedo(),

    takeBackStep: stepBack,
    replayStep: stepForward,

    takeBack() {
      let step = stepBack();
      if (!step) return false;
      while (step.more) {
        const next = stepBack();
        if (!next) { settle(); break; }
        step = next;
      }
      return true;
    },

    replay() {
      let step = stepForward();
      if (!step) return false;
      while (step.more) {
        const next = stepForward();
        if (!next) { settle(); break; }
        step = next;
      }
      return true;
    },

    applyOpponentMove(from, to, promotion) {
      if (phase !== 'thinking') return null;
      const move = rules.move(from, to, promotion ?? undefined);
      if (!move) return null;
      inFlight = move;
      phase = 'animating';
      return move;
    },
  };
}
