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
