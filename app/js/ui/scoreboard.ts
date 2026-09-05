// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/scoreboard — how each player stands, in pawns.
//
// ========================= TWO NUMBERS, AND THEY ARE ALLOWED TO DISAGREE =========================
// MATERIAL is what is on the board, counted the way a beginner's book counts it: pawn 1, knight
// and bishop 3, rook 5, queen 9. THE ENGINE is what the position is worth, which folds in king
// safety, structure, tempo and a nineteen-ply search.
//
// Showing only the engine's number would be showing a verdict with no working. Showing only the
// material would be teaching that chess is arithmetic. Showing both, side by side, in the same
// unit, is the entire lesson: "you are a rook up and losing" is a sentence a child can act on,
// and neither number can say it alone.
//
// ⚠️ THE UNIT IS THE SAME WORD AND NOT THE SAME THING, which is why the two are never added and
// never shown as one figure. Stockfish has normalised its centipawn since 15.1 — its `+1.00` is
// roughly an even chance of winning rather than a pawn of wood. The table keeps them in separate
// columns for exactly that reason.
//
// ========================= WHY IT IS A TABLE AND WHY IT IS SILENT =========================
// It is tabular: two players, three figures each. A table gives a screen reader row and column
// headers for free, so "Black, engine, minus one point two" is one navigation rather than a
// paragraph to parse.
//
// It does NOT announce. The evaluation moves on every ply of every game, and a live region that
// read it out would talk over the move announcement that actually matters — the one saying what
// was just played. The numbers are here to be looked at, or navigated to, on purpose.

import { leadFor, material } from '../chess/material.ts';
import type { Rules } from '../chess/rules.ts';
import type { Side } from '../chess/types.ts';
import type { I18n } from '../i18n/index.ts';

export interface ScoreboardDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  readonly rules: Rules;
  /** The engine's evaluation in centipawns FROM WHITE, or null while it does not have one. */
  evaluation(): number | null;
  /** How many outright blunders this side has played. Omit and the column is left out. */
  blunders?(side: Side): number;
}

export interface Scoreboard {
  readonly root: HTMLElement;
  refresh(): void;
}

/**
 * Pawns, to one decimal, with the sign always shown.
 *
 * ⚠️ THE SIGN IS THE POINT and `toFixed` will not give it: `+0.4` and `0.4` read differently at a
 * glance, and a column of numbers where only the negative ones are marked is a column that has to
 * be read twice. An exact zero is written `0.0` rather than `+0.0`, because level is not an
 * advantage for anybody.
 */
export function formatPawns(centipawns: number): string {
  const pawns = centipawns / 100;
  if (Math.abs(pawns) < 0.05) return '0.0';
  return `${pawns > 0 ? '+' : '−'}${Math.abs(pawns).toFixed(1)}`;
}

export function createScoreboard(deps: ScoreboardDeps): Scoreboard {
  const { doc, i18n, rules } = deps;

  const root = doc.createElement('table');
  root.className = 'hud-score';

  const caption = doc.createElement('caption');
  const head = doc.createElement('tr');
  const headings = [doc.createElement('td'), doc.createElement('th'), doc.createElement('th'),
    doc.createElement('th')];
  for (const cell of headings) {
    if (cell instanceof HTMLTableCellElement && cell.tagName === 'TH') cell.scope = 'col';
    head.appendChild(cell);
  }

  const rows = (['w', 'b'] as const).map((side) => {
    const row = doc.createElement('tr');
    const name = doc.createElement('th');
    name.scope = 'row';
    const cells = [doc.createElement('td'), doc.createElement('td'), doc.createElement('td')];
    row.append(name, ...cells);
    return { side, row, name, cells };
  });

  const body = doc.createElement('tbody');
  body.append(...rows.map((r) => r.row));
  const thead = doc.createElement('thead');
  thead.appendChild(head);
  root.append(caption, thead, body);

  function refresh(): void {
    caption.textContent = i18n.t('score.title');
    headings[1].textContent = i18n.t('score.material');
    headings[2].textContent = i18n.t('score.engine');
    headings[3].textContent = i18n.t('score.blunders');
    headings[3].hidden = !deps.blunders;

    const count = material(rules);
    const evaluation = deps.evaluation();

    for (const { side, name, cells } of rows) {
      name.textContent = i18n.t(`turn.${side}`);
      cells[0].textContent = formatPawns(side === 'w' ? count.lead : -count.lead);
      // A dash, not a zero: the engine has an opinion or it does not, and writing 0.0 while it
      // is still thinking would be inventing one and then quietly replacing it.
      cells[1].textContent = evaluation === null
        ? '—'
        : formatPawns(side === 'w' ? evaluation : -evaluation);
      cells[2].textContent = deps.blunders ? String(deps.blunders(side)) : '';
      cells[2].hidden = !deps.blunders;
      // Never colour alone (1.4.1): the sign is in the text, and this only reinforces it.
      cells[0].dataset.lead = leadFor(count, side) > 0 ? 'ahead' : leadFor(count, side) < 0 ? 'behind' : 'level';
    }
  }

  refresh();
  return { root, refresh };
}
