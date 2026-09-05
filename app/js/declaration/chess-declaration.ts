// SPDX-License-Identifier: AGPL-3.0-or-later
// declaration/chess-declaration — chess, said in the engine's seven fields.
//
// ========================= THIS IS THE ACCESSIBILITY LAYER =========================
// It looks like plumbing and it is not. The engine's whole bargain (ADR-0027) is that a game
// which answers seven questions gets sonar, high contrast, sweeping, the screen reader and Libras
// "without writing a line of them". This file is the answer, and everything a blind player gets
// is decided here rather than in any audio or speech code — of which this game has none.
//
// ========================= THE MAPPING, AND WHY IT IS NOT ARBITRARY =========================
// The contract's role vocabulary was built for a platformer, and it fits chess almost
// embarrassingly well:
//
//   free       an empty square, quietly available
//   hazard     an empty square THE OPPONENT COVERS — the sonar warns about threats for free
//   structure  your own piece: scenery that blocks you, exactly as a wall does
//   key        an enemy piece: something to take
//   goal       the enemy king: what the round is actually asking for
//
// `hazard` is the one that earns its keep. One call to `isAttackedBy` turns the engine's
// blind-navigation sonar into a threat warning, and no audio was written to achieve it.
//
// The other field worth naming is `nameAt`, which returns a `Speakable` carrying GENDER. In
// Portuguese "a torre branca" and "o cavalo preto" are the same engine sentence with the same
// parameter; without the gender, half of them come out wrong.

import type {
  Focus, GameDeclaration, Objective, Role, Speakable, Spot,
} from '@pm-monte/inclusionist-engine/core/contract.ts';
import type { Rules } from '../chess/rules.ts';
import type { GameState } from '../chess/state.ts';
import type { Square } from '../chess/types.ts';
import type { I18n } from '../i18n/index.ts';

export interface DeclarationDeps {
  readonly rules: Rules;
  readonly state: GameState;
  readonly i18n: I18n;
  /** Where the keyboard cursor sits when nothing is selected. */
  cursor(): Square;
  /** Which side the human plays. Roles are always described from this point of view. */
  readonly playerSide?: 'w' | 'b';
}

export function createChessDeclaration(deps: DeclarationDeps): GameDeclaration {
  const { rules, state, i18n } = deps;
  const mine = deps.playerSide ?? 'w';
  const theirs = mine === 'w' ? 'b' : 'w';

  return {
    // Chebyshev distance on a grid IS the king's step, which is the unit a player already counts
    // in — so "two squares away" means the same thing to the sonar and to the person hearing it.
    topology: { kind: 'grid', cols: 8, rows: 8 },
    tick: 'player',

    roleAt(at: Spot): Role {
      const square = at as Square;
      const piece = rules.pieceAt(square);
      if (!piece) return rules.isAttackedBy(square, theirs) ? 'hazard' : 'free';
      if (piece.side === mine) return 'structure';
      return piece.type === 'k' ? 'goal' : 'key';
    },

    nameAt(at: Spot): Speakable | null {
      const piece = rules.pieceAt(at as Square);
      return piece ? i18n.describePiece(piece) : null;
    },

    focusOf(playerIndex: number): Focus | null {
      // One human. A second player index is not "no focus yet", it is a player who does not
      // exist, and null is the contract's own way of saying so.
      if (playerIndex !== 0) return null;
      return { id: 'cursor', at: state.selection() ?? deps.cursor(), heading: 'none' };
    },

    objectiveOf(): Objective {
      const outcome = state.outcome();
      return {
        name: { text: i18n.t('objective.checkmate'), gender: 'm', plural: false },
        have: outcome?.kind === 'checkmate' && outcome.winner === mine ? 1 : 0,
        need: 1,
      };
    },

    /**
     * Where this player may still go. With a piece in hand it is that piece's legal squares;
     * with nothing selected it is every square the player could move SOMETHING to.
     *
     * The empty list is a legitimate answer and means "nowhere to point", not an error — which
     * is exactly the position at checkmate.
     */
    targetsOf(playerIndex: number): readonly Spot[] {
      if (playerIndex !== 0 || rules.turn() !== mine) return [];
      const selected = state.selection();
      if (selected) return state.legalTargets();

      const seen = new Set<number>();
      const out: Spot[] = [];
      for (const move of rules.allMoves()) {
        const key = move.to.y * 8 + move.to.x;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(move.to);
      }
      return out;
    },
  };
}
