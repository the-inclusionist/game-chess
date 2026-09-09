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
} from '@the-inclusionist/engine/core/contract.js';
import type { Rules } from '../chess/rules.ts';
import type { GameState } from '../chess/state.ts';
import type { Square } from '../chess/types.ts';
import type { I18n } from '../i18n/index.ts';

export interface DeclarationDeps {
  /**
   * ⚠️ ACCESSORS, NOT OBJECTS, AND THAT IS WHAT KEEPS THE FOCUS ON THE BOARD.
   *
   * A lesson step with a new position is a new `Rules` and a new `GameState` — `chess/rules.ts`
   * only takes a FEN at construction, and giving it a `setFen` would make `startFen()` lie about
   * the game `session.describe()` rebuilds from. So the shell swaps the objects, and everything
   * downstream has to ask rather than remember.
   *
   * Held as a value, this consumer would have to be TORN DOWN AND REBUILT on every step that
   * changes the board — which throws away the focused cell and the roving tabindex, and dumps a
   * keyboard reader at the top of the page once per step.
   */
  rules(): Rules;
  state(): GameState;
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
    /*
     * ⚠️ A METHOD SINCE THE ENGINE'S ADR-0084. It was a value, and the asymmetry had already been
     * patched in two places before anybody named it: the sonar door always asked for
     * `() => Topology`. A chess board is 8x8 forever, so this one really does return a constant —
     * but a shape that never changes is not a reason to be the one declaration in the catalogue
     * that answers differently from the rest.
     *
     * ⚠️ AND THE SHAPE CHANGED AGAIN: `cols`/`rows` became `size`, and `move` and `frame` are now
     * required. That is a better contract rather than churn — "grid" never was one thing, and the
     * two new fields are exactly the two questions the sonar had been answering by assumption:
     *
     *  · `move: 'diagonal'` is L-infinity, Chebyshev — and the engine's own comment names this
     *    game for it. It is the KING'S step, which is the unit a player already counts in, so
     *    "two squares away" means the same thing to the sonar and to the person hearing it.
     *  · `frame: 'compass'` is north/south/east/west rather than clock directions, which is what a
     *    board seen from above has. `clock` is for a 2D side view, and would have had the sonar
     *    telling a child their rook was at four o'clock.
     *
     * ⚠️ FOUND BY `tsc` AND BY A BOOT THAT THREW, not by a changelog: the engine is a linked
     * dependency shared with another session, and the suite went from green to red between two
     * runs half an hour apart with nothing of ours changed in between.
     */
    topology: () => ({ kind: 'grid', size: [8, 8], move: 'diagonal', frame: 'compass' }),

    /**
     * ⚠️ THE WHOLE REGION, NOT THE CANVAS — and for this game that distinction is the point of the
     * field. The engine's own root made the world its PixiJS canvas, which is right for a game
     * drawn in PixiJS and wrong here twice over: the flat page has NO canvas board at all, and on
     * the other two pages the HUD, the move list and the coordinate labels are DOM sitting beside
     * it. A blindness simulation aimed at the canvas would black out the board and leave the score
     * sheet perfectly legible, which simulates nothing.
     *
     * `#stage` is everything that is "the game as seen" — the board AND the panel beside it. It
     * was `#game-region`, which stopped being enough the day the panel moved out of the board: a
     * blindness aimed at the region would have blacked the board and left the move list and the
     * lesson perfectly readable, which is the very defect ADR-0087 was written about. The engine's
     * menus and dialogs live outside it, which is what keeps a simulated blindness from locking a
     * child inside the mode.
     *
     * And `none` would be a lie here for a reason the engine states better than this file could:
     * blindfold chess exists, so a game whose board is DOM is not a game where empathy makes no
     * sense — it is one where it asks more of whoever writes it.
     */
    world: () => ({ kind: 'element', selector: '#stage' }),

    /*
     * ⚠️ ONE, AND CHESS IS THE CLEANEST CASE THE ENGINE'S ADR-0104 COULD HAVE ASKED FOR. Nothing here is ever
     * held down: you land on a square, you confirm, the piece moves. There is no run-and-jump, no aim-while-
     * moving, no chord of any kind — every command arrives on its own, and the next one waits.
     *
     * That number is not a shrug, it is the strongest answer in the catalogue. A game that holds ONE position
     * at a time is playable on EVERY transport the engine offers and on every one it will offer later: a
     * two-point phone, a single switch, a gaze tracker, a breath sensor. The mandatory field exists so that
     * this fact is DECLARED rather than accidental — «não declarar é ter a acessibilidade programada no
     * controle pro sorte» — and here declaring it is also a claim worth making out loud.
     */
    holdsAtOnce: () => 1,

    /*
     * FALSE — and this board is the cleanest example of why the engine needed a SECOND field (ADR-0115).
     *
     * ⚠️ THE NUMBER ABOVE LOOKS LIKE IT ANSWERS THIS AND DOES NOT. `holdsAtOnce` counts positions held at the
     * same INSTANT, and the contract refuses zero because that number feeds the reachability arithmetic. So a
     * game that holds nothing still declares 1 — this one does, right above, with a paragraph explaining why
     * ONE is the strongest answer in the catalogue. Both are true and they answer different questions.
     *
     * 📌 Nothing on a chess board is HELD. The cursor moves by taps and a square is chosen by a tap; there is
     * no direction to keep pressed. Latching — press once to walk, press again to stop — exists for a child
     * who cannot keep a key down, and here it would have nothing to hold back. Declaring `false` makes the
     * control ABSENT from this game's accessibility bar and panel instead of present and inert: a child who
     * depends on latching does not find a switch that does nothing and conclude the adjustment is broken.
     *
     * ⚠️ AND ABSENT IS NOT DISABLED-WITH-A-REASON. That other shape belongs to ADR-0113 clause 3, where the
     * DEVICE requires latching and it must not be switched off; there the control stays reachable so she can
     * read why. Here there is no reason that would help her.
     */
    seguraTeclas: () => false,

    tick: 'player',

    roleAt(at: Spot): Role {
      const square = at as Square;
      const piece = rules().pieceAt(square);
      if (!piece) return rules().isAttackedBy(square, theirs) ? 'hazard' : 'free';
      if (piece.side === mine) return 'structure';
      return piece.type === 'k' ? 'goal' : 'key';
    },

    nameAt(at: Spot): Speakable | null {
      const piece = rules().pieceAt(at as Square);
      return piece ? i18n.describePiece(piece) : null;
    },

    focusOf(playerIndex: number): Focus | null {
      // One human. A second player index is not "no focus yet", it is a player who does not
      // exist, and null is the contract's own way of saying so.
      if (playerIndex !== 0) return null;
      return { id: 'cursor', at: state().selection() ?? deps.cursor(), heading: 'none' };
    },

    objectiveOf(): Objective {
      const outcome = state().outcome();
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
      if (playerIndex !== 0 || rules().turn() !== mine) return [];
      const selected = state().selection();
      if (selected) return state().legalTargets();

      const seen = new Set<number>();
      const out: Spot[] = [];
      for (const move of rules().allMoves()) {
        const key = move.to.y * 8 + move.to.x;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(move.to);
      }
      return out;
    },
  };
}
