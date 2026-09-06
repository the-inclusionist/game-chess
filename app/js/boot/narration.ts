// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/narration — what the game says out loud, in one place.
//
// ========================= WHY THIS IS A MODULE AND NOT THREE COPIES =========================
// These four functions were written out three times, once per composition root, and were identical
// to the character in two of them. The third had drifted: the solid board announced a move as its
// raw SAN — `srSay('status.played', { move: 'Nxd4' })` — which a screen reader pronounces roughly
// as "en ex dee four" and which teaches a beginner nothing at all.
//
// That drift is the argument for the file. Duplicated code does not stay duplicated; it stays
// duplicated until someone edits one copy, and then it is three behaviours wearing one name.
//
// ========================= POLITE AND ASSERTIVE ARE NOT A STYLE CHOICE =========================
// `srSay` writes `#sr-status` (aria-live polite) and `srAlert` writes `#sr-alert` (assertive). The
// division here is deliberate and consistent:
//
//   · Every move, every selection, every empty square a cursor lands on — POLITE. A screen reader
//     finishes its sentence before saying them, which is what a running commentary needs to be.
//   · Check, checkmate, stalemate and draw — ASSERTIVE. They interrupt, because they are EVENTS:
//     something has changed about whether the game can go on, and hearing it four sentences later
//     is hearing it too late to act.
//
// ⚠️ Nothing here decides WHEN to speak. A caller that announces a move before the piece has
// finished flying and a caller that announces it after are both correct uses of this module, and
// the difference between them belongs to the caller — see `boot/main.ts`, which says the move
// first precisely so a player who cannot see the board does not wait out the animation.

import { srAlert, srSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import type { MoveResult, Rules } from '../chess/rules.ts';
import type { Activation, Outcome } from '../chess/state.ts';
import { toAlgebraic } from '../chess/types.ts';
import type { I18n } from '../i18n/index.ts';

/**
 * A move as a sentence, not as notation.
 *
 * ⚠️ THE CASTLE CASES COME FIRST, and they have to. A castle is one move that shifts two pieces,
 * and describing it as "king from e1 to g1" is describing half of it — the rook, which is the part
 * a beginner is asking about, would go unmentioned. The named phrase is the whole answer.
 *
 * ⚠️ AND `describePiece` IS WHAT CARRIES GENDER. The catalogue holds a gender for the piece noun
 * and for nothing else, so every sentence here is phrased not to inflect on it: "{piece} de {from}
 * para {to}", never "{piece} movida". See the note at the head of `i18n/pt.ts` — where a sentence
 * would have to agree, the sentence is rewritten rather than the table extended.
 */
export function moveSentence(i18n: I18n, move: MoveResult): string {
  if (move.castle === 'king') return i18n.t('move.castleShort');
  if (move.castle === 'queen') return i18n.t('move.castleLong');

  const piece = i18n.describePiece(move.piece).text;
  const from = toAlgebraic(move.from);
  const to = toAlgebraic(move.to);

  if (move.captured) {
    return i18n.t('move.capture', {
      piece, from, to, target: i18n.describePiece(move.captured).text,
    });
  }
  if (move.promotion) {
    return i18n.t('move.promotion', {
      to, piece: i18n.describePiece({ type: move.promotion, side: move.piece.side }).text,
    });
  }
  return i18n.t('move.plain', { piece, from, to });
}

/**
 * Says a move that has been played, and alerts check.
 *
 * ⚠️ CHECKMATE IS NOT ANNOUNCED HERE, and the guard says so: `!move.checkmate && move.check`. Mate
 * is check as well, so without it a player would hear "check" and then, an instant later, "White
 * wins by checkmate" — the first of which is true, useless, and occupies the assertive region that
 * the second one needs. `announceOutcome` owns the ending.
 */
export function announceMove(i18n: I18n, move: MoveResult): void {
  srSay(moveSentence(i18n, move));
  if (!move.checkmate && move.check) srAlert(i18n.t('status.check'));
}

/**
 * Says what `activate` just did.
 *
 * ⚠️ AN IGNORED ACTIVATION SAYS NOTHING, on purpose. `ignored/busy` is the board refusing a click
 * while the opponent thinks, and `ignored/empty` is a cursor crossing an empty square with nothing
 * selected — announcing either would fill the live region with the sound of nothing happening, and
 * a region that talks constantly is a region a player learns to tune out.
 *
 * `illegal` DOES speak, and says what is on the square rather than "illegal": the player already
 * knows the move did not happen, and what they need next is what is there instead.
 */
export function announceActivation(i18n: I18n, rules: Rules, result: Activation): void {
  if (result.kind === 'selected') {
    const piece = rules.pieceAt(result.square);
    const where = toAlgebraic(result.square);
    srSay(piece
      ? `${i18n.t('a11y.selected', { piece: i18n.describePiece(piece).text, square: where })}. `
        + i18n.t('a11y.legalMoves', { count: result.targets.length })
      : i18n.t('square.empty', { square: where }));
    return;
  }

  if (result.kind === 'deselected') {
    srSay(i18n.t('a11y.noSelection'));
    return;
  }

  if (result.kind === 'moved') {
    announceMove(i18n, result.move);
    return;
  }

  if (result.kind === 'illegal') {
    const piece = rules.pieceAt(result.square);
    const square = toAlgebraic(result.square);
    srSay(piece
      ? i18n.t('square.occupied', { square, piece: i18n.describePiece(piece).text })
      : i18n.t('square.empty', { square }));
  }
}

/**
 * Says how the game ended, assertively.
 *
 * ⚠️ IT TAKES THE OUTCOME, NOT THE GAME. One fewer thing to hold, and it makes the whole of this
 * module testable with three plain objects instead of a state machine — which is what "no test has
 * ever covered these sentences" was waiting on.
 *
 * Stalemate is separated from an ordinary draw because they are not the same news: one is a player
 * with no legal move and a king that is not in check, and calling it "draw" hides the very thing a
 * learner most needs explained.
 */
export function announceOutcome(i18n: I18n, outcome: Outcome | null): void {
  if (!outcome) return;
  if (outcome.kind === 'checkmate') {
    srAlert(i18n.t('status.checkmate', { side: i18n.t(`turn.${outcome.winner}`) }));
    return;
  }
  if (outcome.kind === 'stalemate') {
    srAlert(i18n.t('status.stalemate'));
    return;
  }
  srAlert(i18n.t('status.draw'));
}
