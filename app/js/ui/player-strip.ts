// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/player-strip — how each player is doing, at their own end of the board.
//
// ========================= WHY IT IS NOT IN THE PANEL =========================
// The panel already carries a score table, and it is the right place to STUDY the numbers: two
// players, three figures each, headed and navigable. It is the wrong place to glance at them.
// A player deciding on a move is looking at the board, and a number they have to look away to
// read is a number they do not read.
//
// So the same facts appear again at the two top corners of the board, in the form every chess
// program has settled on: whose pieces, how far ahead, what they have taken. This is a SECOND
// VIEW of one state and not a second copy of it — everything here is computed from `rules` and
// the reviewer on every refresh, so the two cannot disagree.
//
// ========================= THE RISK BAR =========================
// The one number in this game that only goes up. It is the winning chance a player has given away
// across the whole game, added up — not how they stand now. Someone can be winning comfortably
// and have thrown away thirty points getting there, and that is the thing a learner needs shown:
// the result flatters them and the bar does not.
//
// ⚠️ It is a `meter` with a real `aria-valuenow`, and the figure is written out beside it. A bar
// whose only content is its own width says nothing to a screen reader and nothing on a projector
// with the contrast wound down (1.4.1).

import { capturedGlyphs } from '../chess/captured.ts';
import type { Rules } from '../chess/rules.ts';
import type { Side } from '../chess/types.ts';
import type { I18n } from '../i18n/index.ts';
import { formatPawns } from './scoreboard.ts';
import { leadFor, material } from '../chess/material.ts';

/**
 * Points of winning chance at which the bar is full.
 *
 * ⚠️ A hundred would be the tidy answer and the useless one: a whole game's worth of mistakes is
 * a bar that never moves in a normal game. Sixty is about three outright blunders, which is a
 * scale on which an ordinary game's ordinary slips are actually visible.
 */
export const RISK_FULL = 60;

export interface PlayerStripDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  readonly rules: Rules;
  /** The engine's evaluation in centipawns FROM WHITE, or null while it has none. */
  evaluation(): number | null;
  /** Winning chance given away by this side, in percentage points. */
  risk(side: Side): number;
}

export interface PlayerStrips {
  readonly root: HTMLElement;
  refresh(): void;
}

export function createPlayerStrips(deps: PlayerStripDeps): PlayerStrips {
  const { doc, i18n, rules } = deps;

  const root = doc.createElement('div');
  root.className = 'board-players';
  // A picture of things said elsewhere in words: the panel's score table carries the same numbers
  // with headers, and the move list carries the captures. Announcing them twice is noise.
  root.setAttribute('aria-hidden', 'true');

  const sides = (['w', 'b'] as const).map((side) => {
    const box = doc.createElement('div');
    box.className = 'player-strip';
    box.dataset.side = side;

    const name = doc.createElement('p');
    name.className = 'player-name';

    const score = doc.createElement('p');
    score.className = 'player-score';
    const lead = doc.createElement('b');
    const engine = doc.createElement('span');
    engine.className = 'player-engine';
    score.append(lead, engine);

    const riskRow = doc.createElement('p');
    riskRow.className = 'player-risk';
    const bar = doc.createElement('span');
    bar.className = 'player-risk-bar';
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(RISK_FULL));
    const fill = doc.createElement('span');
    fill.className = 'player-risk-fill';
    bar.appendChild(fill);
    const riskValue = doc.createElement('span');
    riskValue.className = 'player-risk-value';
    riskRow.append(bar, riskValue);

    const taken = doc.createElement('p');
    taken.className = 'player-taken';

    box.append(name, score, riskRow, taken);
    root.appendChild(box);
    return { side, box, name, lead, engine, bar, fill, riskValue, taken };
  });

  function refresh(): void {
    const count = material(rules);
    const evaluation = deps.evaluation();

    for (const s of sides) {
      s.name.textContent = i18n.t(`turn.${s.side}`);

      // Material, which is the figure every chess program puts here, and which a player can check
      // by looking at the board. The engine's opinion sits beside it, smaller, because it cannot.
      const ahead = leadFor(count, s.side);
      s.lead.textContent = ahead > 0 ? `+${ahead}` : ahead < 0 ? `−${Math.abs(ahead)}` : '·';
      s.lead.dataset.lead = ahead > 0 ? 'ahead' : ahead < 0 ? 'behind' : 'level';
      s.engine.textContent = evaluation === null
        ? '—'
        : formatPawns(s.side === 'w' ? evaluation : -evaluation);

      const risk = deps.risk(s.side);
      const share = Math.min(1, risk / RISK_FULL);
      s.fill.style.width = `${(share * 100).toFixed(1)}%`;
      // Bands rather than a gradient: three states a person can name — and can still tell apart
      // when the colour is gone, because the bar's LENGTH is the same fact said twice.
      s.fill.dataset.level = share >= 0.66 ? 'high' : share >= 0.33 ? 'mid' : 'low';
      s.riskValue.textContent = String(Math.round(risk));
      s.bar.setAttribute('aria-valuenow', String(Math.round(risk)));
      s.bar.setAttribute('aria-label',
        `${i18n.t('score.risk')}: ${i18n.t(`turn.${s.side}`)}`);

      // ⚠️ The pieces THIS player has taken, which are the OTHER side's. Getting this backwards
      // reads perfectly and is silently wrong — the classic version of this display shows a
      // player their own losses and nobody notices for a week.
      s.taken.textContent = capturedGlyphs(rules, s.side === 'w' ? 'b' : 'w');
    }
  }

  refresh();
  return { root, refresh };
}
