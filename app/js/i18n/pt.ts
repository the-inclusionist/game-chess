// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/pt — Portuguese (Brazil). The base language: every other catalogue falls back to this one.
//
// PHRASING RULE, and it is not stylistic. The catalogue carries gender for the piece NOUN, so
// "a torre branca" and "o cavalo preto" both come out right. It cannot carry gender for anything
// else, so every other sentence is phrased to avoid inflecting on the piece: "Seleção: {piece} em
// {square}", never "{piece} selecionada". Where a sentence would have to agree, rewrite the
// sentence — do not add a second gender table.

import type { Catalog } from './types.ts';

export const pt: Catalog = {
  bcp47: 'pt-BR',

  pieces: {
    p: { text: 'peão',   gender: 'm' },
    r: { text: 'torre',  gender: 'f' },
    n: { text: 'cavalo', gender: 'm' },
    b: { text: 'bispo',  gender: 'm' },
    q: { text: 'dama',   gender: 'f' },
    k: { text: 'rei',    gender: 'm' },
  },

  sides: {
    w: { m: 'branco', f: 'branca', n: 'branco' },
    b: { m: 'preto',  f: 'preta',  n: 'preto' },
  },

  pieceNamePattern: '{piece} {side}',

  strings: {
    'objective.checkmate': 'xeque-mate',

    'status.check':      'Xeque.',
    'status.checkmate':  'Xeque-mate. {side} vencem.',
    'status.stalemate':  'Afogamento. Empate.',
    'status.draw':       'Empate.',
    'status.thinking':   'Pensando…',
    'status.engineFailed': 'Não consegui pensar a jogada. Tente novamente.',

    'turn.w': 'Brancas',
    'turn.b': 'Pretas',

    'hud.turn':       'Vez',
    'hud.captured':   'Capturadas',
    'hud.moves':      'Lances',
    'hud.difficulty': 'Dificuldade',
    'hud.highContrast': 'Alto contraste',
    'hud.vision':     'Visão de cores',

    'difficulty.easy':   'Fácil',
    'difficulty.medium': 'Médio',
    'difficulty.hard':   'Difícil',

    'move.plain':       '{piece} de {from} para {to}',
    'move.capture':     '{piece} de {from} captura {target} em {to}',
    'move.castleShort': 'Roque pequeno',
    'move.castleLong':  'Roque grande',
    'move.promotion':   'Peão promovido em {to}: {piece}',

    'square.empty':    '{square}, vazia',
    'square.occupied': '{square}, {piece}',

    'a11y.boardLabel':  'Tabuleiro de xadrez, 8 por 8',
    'a11y.selected':    'Seleção: {piece} em {square}',
    'a11y.noSelection': 'Nenhuma peça selecionada',
    'a11y.legalMoves':  '{count} lances legais',
    'a11y.cellMove': 'lance possível',
    'a11y.cellCapture': 'captura possível',
    'a11y.cellCheck': 'em xeque',
    'a11y.gridHint': 'Setas navegam, Enter seleciona',
  },
};
