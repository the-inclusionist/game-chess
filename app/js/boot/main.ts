// SPDX-License-Identifier: AGPL-3.0-or-later
// Spike 1 — proves the engine can be consumed from OUTSIDE its own repository.
//
// Three things are being tested here, and only these:
//   1. `file:../SP-the-inclusionist-tracer` resolves, and Vite transforms the engine's raw `.ts`
//      sources through a symlink in node_modules (they are not pre-bundled — linked deps never are).
//   2. The engine's own internal imports, written as `'../core/i18n.js'` against files that are
//      actually `.ts`, still resolve when the importer sits inside node_modules.
//   3. `createGame()` boots against a chess-shaped GameDeclaration, and the seven fields carry
//      chess semantics without a single line of chess logic yet.
//
// There is no board, no renderer and no rules here on purpose. Those come after this passes.

import { createGame } from '@pm-monte/inclusionist-engine';
import {
  conformanceProblems,
  distance,
  type Focus,
  type GameDeclaration,
  type Objective,
  type Role,
  type Speakable,
  type Spot,
} from '@pm-monte/inclusionist-engine/core/contract.ts';

/* ============================ a posição, e nada além dela ============================ */

type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
interface Piece { readonly type: PieceType; readonly white: boolean }

const BACK_RANK: readonly PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

/** `board[rank][file]`. Rank 0 é a fileira de trás das pretas; rank 7, a das brancas. */
function startingPosition(): (Piece | null)[][] {
  const rows: (Piece | null)[][] = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
  for (let f = 0; f < 8; f++) {
    rows[0][f] = { type: BACK_RANK[f], white: false };
    rows[1][f] = { type: 'p', white: false };
    rows[6][f] = { type: 'p', white: true };
    rows[7][f] = { type: BACK_RANK[f], white: true };
  }
  return rows;
}

const board = startingPosition();
const CURSOR: Spot = { x: 4, y: 6 };   // e2

const at = (s: Spot): Piece | null =>
  (s.y >= 0 && s.y < 8 && s.x >= 0 && s.x < 8) ? board[s.y][s.x] : null;

/* ============================ os nomes, e por que o gênero existe ============================ */

const NAMES: Record<PieceType, { readonly text: string; readonly gender: 'm' | 'f' }> = {
  p: { text: 'peão',   gender: 'm' },
  r: { text: 'torre',  gender: 'f' },
  n: { text: 'cavalo', gender: 'm' },
  b: { text: 'bispo',  gender: 'm' },
  q: { text: 'dama',   gender: 'f' },
  k: { text: 'rei',    gender: 'm' },
};

// A moldura CONCORDA com o conteúdo: "a torre branca" e "o cavalo preto" são a mesma
// frase com o mesmo parâmetro. Sem o campo `gender` do contrato, metade sai errada.
function speakPiece(p: Piece): Speakable {
  const n = NAMES[p.type];
  const colour = p.white
    ? (n.gender === 'f' ? 'branca' : 'branco')
    : (n.gender === 'f' ? 'preta' : 'preto');
  return { text: `${n.text} ${colour}`, gender: n.gender, plural: false };
}

/* ============================ os sete campos, em semântica de xadrez ============================ */

const declaration: GameDeclaration = {
  // A métrica de grade do contrato é Chebyshev — que é, literalmente, o passo do rei.
  topology: { kind: 'grid', cols: 8, rows: 8 },
  tick: 'player',

  roleAt(s: Spot): Role {
    const p = at(s);
    if (!p) return 'free';
    if (p.white) return 'structure';   // peça própria: cenário que bloqueia
    if (p.type === 'k') return 'goal'; // rei adversário: o que a rodada pede
    return 'key';                      // peça adversária: capturável
  },

  nameAt(s: Spot): Speakable | null {
    const p = at(s);
    return p ? speakPiece(p) : null;
  },

  focusOf(playerIndex: number): Focus | null {
    return playerIndex === 0 ? { id: 'cursor', at: CURSOR, heading: 'n' } : null;
  },

  objectiveOf(): Objective {
    return { name: { text: 'xeque-mate', gender: 'm', plural: false }, have: 0, need: 1 };
  },

  // Destinos legais do peão de e2. Na versão real virá de chess.js; aqui é fixo de propósito.
  targetsOf(playerIndex: number): readonly Spot[] {
    return playerIndex === 0 ? [{ x: 4, y: 5 }, { x: 4, y: 4 }] : [];
  },
};

/* ============================ boot, e o relatório ============================ */

const rows: [string, string, boolean?][] = [];
const push = (k: string, v: string, ok?: boolean): void => { rows.push([k, v, ok]); };

const problems = conformanceProblems(declaration);
push('conformanceProblems', problems.length ? problems.join('; ') : 'conforme (lista vazia)', !problems.length);

let engine: ReturnType<typeof createGame> | null = null;
let bootError = '';
try {
  engine = createGame({
    declaration,
    host: { doc: document, win: window, cvdHost: document.getElementById('cvd') },
    // Declinar não é mentir: um xadrez não tem fases nem pad mapeável, e diz isso
    // em vez de devolver null de um getter e torcer.
    declines: { semMenuDePausa: true, semAssistenteDePad: true, semAtorDePausa: true },
  });
} catch (e) {
  bootError = e instanceof Error ? e.message : String(e);
}

push('createGame()', bootError || 'bootou', !bootError);

if (engine) {
  push('engine.problems', engine.problems.length ? engine.problems.join('; ') : 'nenhum', !engine.problems.length);
  push('engine.cvdFilters', String(engine.cvdFilters) + ' filtros de daltonismo montados', engine.cvdFilters > 0);
  for (const k of ['tts', 'overlays', 'nav', 'keyboard', 'sonar', 'cenas'] as const) {
    push('engine.' + k, typeof engine[k], engine[k] != null);
  }

  // O sonar de navegação cega, alimentado só pelos sete campos.
  const targets = declaration.targetsOf(0);
  const d = targets.length ? distance(declaration.topology, CURSOR, targets[0]) : -1;
  push('distance(e2, e3)', String(d) + ' (Chebyshev: 1 passo de rei)', d === 1);

  push('nameAt(e2)', declaration.nameAt({ x: 4, y: 6 })?.text ?? 'null');
  push('nameAt(a8)', declaration.nameAt({ x: 0, y: 0 })?.text ?? 'null');
  push('nameAt(b8)', declaration.nameAt({ x: 1, y: 0 })?.text ?? 'null');
  push('roleAt(e8) rei preto', declaration.roleAt({ x: 4, y: 0 }));
  push('roleAt(e4) vazia', declaration.roleAt({ x: 4, y: 4 }));

  engine.cenas.push({
    nome: 'spike',
    draw: () => { /* sem renderizador ainda: a pilha de cenas só precisa existir */ },
  });
  push('cenas.nomes', engine.cenas.nomes().join(', '));
}

const html = [
  '<h2>Resultado</h2><table>',
  ...rows.map(([k, v, ok]) => {
    const cls = ok === undefined ? 'k' : (ok ? 'ok' : 'fail');
    const mark = ok === undefined ? '' : (ok ? '✓ ' : '✗ ');
    return `<tr><td>${k}</td><td class="${cls}">${mark}${v}</td></tr>`;
  }),
  '</table>',
].join('');
document.getElementById('out')!.innerHTML = html;

// Deixa o resultado legível por script, para a verificação automatizada não depender de captura.
(window as unknown as { __spike1: unknown }).__spike1 = {
  ok: !bootError && !problems.length && !!engine && engine.problems.length === 0,
  bootError, problems, rows,
};
