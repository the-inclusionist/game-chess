// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/player-strip — each player at their own end of the board, and the position between them.
//
// ========================= WHY IT IS NOT IN THE PANEL =========================
// The panel already carries a score table, and it is the right place to STUDY the numbers: two
// players, three figures each, headed and navigable. It is the wrong place to glance at them.
// A player deciding on a move is looking at the board, and a number they have to look away to
// read is a number they do not read.
//
// So the same facts appear again across the top of the board: what each player has taken, how
// many mistakes they have made, and — between them, where neither player owns it — what the
// engine makes of the position.
//
// This is a SECOND VIEW of one state and not a second copy of it. Everything here is computed
// from `rules` and the reviewer on every refresh, so the two cannot disagree.
//
// ========================= WHY THE EVALUATION IS IN THE MIDDLE =========================
// ⚠️ It was two numbers, one per player, and that was wrong twice over. It made an evaluation
// look like a possession — a thing White has and Black has — when it is one fact about one
// position with a sign on it. And putting it beside each player invites reading only your own,
// which is the opposite of what an evaluation is for.
//
// One number, in the middle, positive for White and negative for Black. That is the convention
// every engine and every broadcast uses, and it is the shortest possible way to say "this is
// about the position, not about you".

import { capturedGlyphs } from '../chess/captured.ts';
import type { Rules } from '../chess/rules.ts';
import type { Side } from '../chess/types.ts';
import type { I18n } from '../i18n/index.ts';
import { formatPawns } from './scoreboard.ts';

export interface PlayerStripDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  readonly rules: Rules;
  /** The engine's evaluation in centipawns FROM WHITE, or null while it has none. */
  evaluation(): number | null;
  /** How many moves of this side's the engine has marked as a mistake or worse. */
  mistakes(side: Side): number;
  /**
   * ========================= THE CLOCK, IN FRONT OF THE NAME =========================
   * The Dev, 2026-10-04: "adicione um relógio marcado 5:00 na frente de BRANCAS e um outro igual
   * na frente de PRETAS no topo da parte da tela onde está o tabuleiro."
   *
   * Absent on a board that has no clock — a lesson, a position being studied — and the strip then
   * draws exactly what it drew before.
   */
  clock?: {
    /** `m:ss` for this side. */
    readonly text: (side: Side) => string;
    /** Which clock is draining, if either. */
    readonly running: () => Side | null;
    readonly flagged: (side: Side) => boolean;
  };
}

export interface PlayerStrips {
  readonly root: HTMLElement;
  refresh(): void;
}

export function createPlayerStrips(deps: PlayerStripDeps): PlayerStrips {
  const { doc, i18n, rules } = deps;

  const root = doc.createElement('div');
  root.className = 'board-players';
  // A picture of things said elsewhere in words: the panel's score table carries the evaluation
  // and the mistake count with headers, and the move list carries the captures. Twice is noise.
  root.setAttribute('aria-hidden', 'true');

  const make = (side: Side) => {
    const box = doc.createElement('div');
    box.className = 'player-strip';
    box.dataset.side = side;

    /*
     * ⚠️ IN FRONT OF THE NAME ON BOTH SIDES, not mirrored outward like the capture counter. The
     * counter is mirrored because it must stay put as a row of glyphs grows beside it; a clock is
     * a fixed five characters and never moves, and «5:00 BRANCAS … PRETAS 5:00» reads as one
     * sentence from either end of the board, which is what two people sharing it need.
     */
    const clock = doc.createElement('b');
    clock.className = 'player-clock';

    const name = doc.createElement('p');
    name.className = 'player-name';

    const row = doc.createElement('p');
    row.className = 'player-row';
    const count = doc.createElement('b');
    count.className = 'player-mistakes';
    const taken = doc.createElement('span');
    taken.className = 'player-taken';
    // ⚠️ The counter goes on the OUTSIDE — left of the captures on the left, right of them on the
    // right — so it stays put as the row of glyphs grows. Put it on the inside and a queen taken
    // on move thirty pushes the number a centimetre across the board.
    if (side === 'w') row.append(count, taken);
    else row.append(taken, count);

    const head = doc.createElement('p');
    head.className = 'player-head';
    head.append(clock, name);

    box.append(head, row);
    return { side, box, name, count, taken, clock };
  };

  const white = make('w');
  const black = make('b');

  const evaluation = doc.createElement('p');
  evaluation.className = 'board-eval';

  root.append(white.box, evaluation, black.box);

  function refresh(): void {
    /*
     * ========================= WHOSE TURN, AROUND THE WORD =========================
     * The Dev, 2026-10-04: "um indicador diz de quem é a vez em volta das palavras BRANCAS ou
     * PRETAS acima do tabuleiro, na tela."
     *
     * ⚠️ AROUND THE WORD AND NOT BESIDE IT, which is his word — «em volta» — and the better
     * answer: a dot or an arrow beside a label is one more thing on a crowded strip, while a ring
     * around the name points at the name without adding anything to read. It is a SHAPE, so it
     * survives greyscale and every colour-vision correction (1.4.1), and the running clock beside
     * it says the same thing a second way.
     *
     * ⚠️ NOBODY'S TURN WHEN THE GAME IS OVER. A ring left around a name after checkmate would be
     * telling a child to move in a game that has ended.
     */
    const onMove = rules.isGameOver() ? null : rules.turn();
    for (const s of [white, black]) {
      s.name.textContent = i18n.t(`turn.${s.side}`);
      s.box.dataset.turn = String(onMove === s.side);

      const mistakes = deps.mistakes(s.side);
      s.count.textContent = String(mistakes);
      // Bands rather than a scale: three states a person can name, and the number itself is
      // always there beside them, so nothing here is carried by colour alone (1.4.1).
      s.count.dataset.level = mistakes >= 5 ? 'high' : mistakes >= 2 ? 'mid' : 'low';

      // ⚠️ The pieces THIS player has taken, which are the OTHER side's. Getting this backwards
      // reads perfectly and is silently wrong — the classic version of this display shows a
      // player their own losses and nobody notices for a week.
      s.taken.textContent = capturedGlyphs(rules, s.side === 'w' ? 'b' : 'w');

      /*
       * ⚠️ `data-state` AND NOT COLOUR ALONE (1.4.1). Three states a person can name — the clock
       * that is draining, the one that is waiting, and one that has run out — and the running one
       * is also the answer to "whose turn is it", which is why the turn row could leave the panel.
       */
      const clock = deps.clock;
      s.clock.hidden = !clock;
      if (clock) {
        s.clock.textContent = clock.text(s.side);
        s.clock.dataset.state = clock.flagged(s.side)
          ? 'flagged'
          : clock.running() === s.side ? 'running' : 'waiting';
      }
    }

    const score = deps.evaluation();
    // A dash, not a nought: the engine has an opinion or it does not, and writing 0.0 while it is
    // still thinking would be inventing one and then quietly replacing it a second later.
    evaluation.textContent = score === null ? '—' : formatPawns(score);
    evaluation.dataset.lead = score === null || Math.abs(score) < 5
      ? 'level'
      : score > 0 ? 'white' : 'black';
  }

  refresh();
  return { root, refresh };
}
