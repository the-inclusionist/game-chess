// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/rules — the only module in this repository that knows chess.js exists.
//
// ========================= WHY A WRAPPER AT ALL =========================
// Not ceremony. Three concrete jobs, and each of them would otherwise be repeated at every call
// site:
//
//  · TRANSLATION. chess.js addresses squares as `"e4"` and pieces as `{type, color}`. This game
//    addresses them as `{x, y}` and `{type, side}`, with y counted from black so that screen
//    space, the engine's grid topology and the board array all agree. Converting once, here,
//    means the rank flip lives in `chess/types` and nowhere else.
//
//  · AN ILLEGAL MOVE IS A VALUE, NOT AN EXCEPTION. chess.js 1.x THROWS when handed an illegal
//    move. A throw inside a click handler would reach the frame loop, and the engine's loop stops
//    on the first error by design — so one misclick would freeze the game. `move()` returns null.
//
//  · ONE PLACE TO REPLACE. If chess.js is ever swapped, this file is the whole surface.
//
// The wrapper is deliberately thin: it adds no rules of its own and holds no state that chess.js
// does not already hold.

import { Chess, type Color, type PieceSymbol, type Square as AlgebraicSquare } from 'chess.js';
import type { PiecePlacement } from '../render/pieces/index.ts';
import {
  fromAlgebraic, type Piece, type PieceType, type Side, type Square, toAlgebraic,
} from './types.ts';

export interface MoveResult {
  readonly from: Square;
  readonly to: Square;
  readonly piece: Piece;
  /** The piece removed from the board, including the pawn taken en passant. */
  readonly captured: Piece | null;
  /** Standard algebraic notation, which is what the screen reader announces. */
  readonly san: string;
  readonly promotion: PieceType | null;
  readonly castle: 'king' | 'queen' | null;
  readonly enPassant: boolean;
  readonly check: boolean;
  readonly checkmate: boolean;
}

export interface Rules {
  /** Every piece on the board, in the shape the renderer wants. */
  placements(): PiecePlacement[];
  pieceAt(square: Square): Piece | null;
  turn(): Side;
  /** Where the piece on `from` may legally go. Empty for an empty square or the wrong turn. */
  legalTargets(from: Square): Square[];
  /** Plays the move, or returns null if it is not legal. Never throws. */
  move(from: Square, to: Square, promotion?: PieceType): MoveResult | null;
  isCheck(): boolean;
  isCheckmate(): boolean;
  isStalemate(): boolean;
  isDraw(): boolean;
  isGameOver(): boolean;
  /** Does `side` cover this square? Becomes the contract's `hazard` role, and the sonar's warning. */
  isAttackedBy(square: Square, side: Side): boolean;
  fen(): string;
  history(): readonly MoveResult[];
  undo(): void;
}

const algebraic = (square: Square): AlgebraicSquare => toAlgebraic(square) as AlgebraicSquare;

function toSquare(name: string): Square {
  const square = fromAlgebraic(name);
  if (!square) throw new Error(`chess.js returned a square we cannot read: ${name}`);
  return square;
}

const toPiece = (type: PieceSymbol, color: Color): Piece =>
  ({ type: type as PieceType, side: color as Side });

export function createRules(fen?: string): Rules {
  const game = fen ? new Chess(fen) : new Chess();
  const played: MoveResult[] = [];

  function describe(move: {
    from: string; to: string; piece: PieceSymbol; color: Color; san: string;
    captured?: PieceSymbol; promotion?: PieceSymbol; flags: string;
  }): MoveResult {
    // chess.js reports the taken piece's TYPE but not its colour: it is always the mover's
    // opponent, which is the one thing the caller cannot reconstruct from `captured` alone.
    const captured = move.captured
      ? toPiece(move.captured, (move.color === 'w' ? 'b' : 'w') as Color)
      : null;

    return {
      from: toSquare(move.from),
      to: toSquare(move.to),
      piece: toPiece(move.piece, move.color),
      captured,
      san: move.san,
      promotion: move.promotion ? (move.promotion as PieceType) : null,
      castle: move.flags.includes('k') ? 'king' : move.flags.includes('q') ? 'queen' : null,
      enPassant: move.flags.includes('e'),
      check: game.isCheck(),
      checkmate: game.isCheckmate(),
    };
  }

  return {
    placements(): PiecePlacement[] {
      const out: PiecePlacement[] = [];
      // `board()` comes back rank 8 first, which is exactly our y order — no flip needed here.
      game.board().forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell) out.push({ piece: toPiece(cell.type, cell.color), square: { x, y } });
        });
      });
      return out;
    },

    pieceAt(square) {
      const cell = game.get(algebraic(square));
      return cell ? toPiece(cell.type, cell.color) : null;
    },

    turn: () => game.turn() as Side,

    legalTargets(from) {
      // `verbose` is what makes this a list of destinations rather than a list of notation.
      return game
        .moves({ square: algebraic(from), verbose: true })
        .map((m) => toSquare(m.to));
    },

    move(from, to, promotion = 'q') {
      try {
        const made = game.move({
          from: algebraic(from),
          to: algebraic(to),
          promotion,
        });
        const result = describe(made);
        played.push(result);
        return result;
      } catch {
        // Illegal. Not exceptional — a player clicked a square they cannot reach.
        return null;
      }
    },

    isCheck: () => game.isCheck(),
    isCheckmate: () => game.isCheckmate(),
    isStalemate: () => game.isStalemate(),
    isDraw: () => game.isDraw(),
    isGameOver: () => game.isGameOver(),

    isAttackedBy: (square, side) => game.isAttacked(algebraic(square), side as Color),

    fen: () => game.fen(),
    history: () => played,

    undo() {
      if (game.undo()) played.pop();
    },
  };
}
