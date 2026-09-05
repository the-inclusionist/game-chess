// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/es — Spanish. Inflects like Portuguese: gendered nouns, adjective after. Note that the
// genders are NOT the same as Portuguese — "el alfil" is masculine where "o bispo" is too, but
// "la dama" and "a dama" only agree by luck. Each catalogue states its own.

import type { Catalog } from './types.ts';

export const es: Catalog = {
  bcp47: 'es',

  pieces: {
    p: { text: 'peón',    gender: 'm' },
    r: { text: 'torre',   gender: 'f' },
    n: { text: 'caballo', gender: 'm' },
    b: { text: 'alfil',   gender: 'm' },
    q: { text: 'dama',    gender: 'f' },
    k: { text: 'rey',     gender: 'm' },
  },

  sides: {
    w: { m: 'blanco', f: 'blanca', n: 'blanco' },
    b: { m: 'negro',  f: 'negra',  n: 'negro' },
  },

  pieceNamePattern: '{piece} {side}',

  strings: {
    'objective.checkmate': 'jaque mate',

    'status.check':      'Jaque.',
    'status.checkmate':  'Jaque mate. {side} ganan.',
    'status.stalemate':  'Rey ahogado. Tablas.',
    'status.draw':       'Tablas.',
    'status.thinking':   'Pensando…',
    'status.engineFailed': 'No pude calcular la jugada. Inténtalo de nuevo.',

    'turn.w': 'Blancas',
    'turn.b': 'Negras',

    'hud.turn':       'Turno',
    'hud.captured':   'Capturadas',
    'hud.moves':      'Jugadas',
    'hud.difficulty': 'Dificultad',
    'hud.highContrast': 'Alto contraste',
    'hud.reducedMotion': 'Movimiento reducido',
    'hud.outline':    'Contorno de piezas',
    'hud.vision':     'Visión de color',
    'hud.takeBack':   'Deshacer jugada',
    'hud.replay':     'Rehacer jugada',
    'hud.takeBackShort': 'Deshacer',
    'hud.replayShort':   'Rehacer',
    'hud.movesRegion': 'Lista de jugadas, desplazable',

    'difficulty.easy':   'Fácil',
    'difficulty.medium': 'Medio',
    'difficulty.hard':   'Difícil',

    'move.plain':       '{piece} de {from} a {to}',
    'move.capture':     '{piece} de {from} captura {target} en {to}',
    'move.castleShort': 'Enroque corto',
    'move.castleLong':  'Enroque largo',
    'move.promotion':   'Peón promocionado en {to}: {piece}',

    'square.empty':    '{square}, vacía',
    'square.occupied': '{square}, {piece}',

    'a11y.boardLabel':  'Tablero de ajedrez, 8 por 8',
    'a11y.selected':    'Selección: {piece} en {square}',
    'a11y.noSelection': 'Ninguna pieza seleccionada',
    'a11y.legalMoves':  '{count} jugadas legales',
    'a11y.cellMove': 'jugada posible',
    'a11y.cellCapture': 'captura posible',
    'a11y.cellCheck': 'en jaque',
    'a11y.gridHint': 'Flechas navegan, Enter selecciona',
    'a11y.tookBack': 'Jugada deshecha. Turno de {side}',
    'a11y.replayed': 'Jugada rehecha. Turno de {side}',
    'a11y.nothingToTakeBack': 'Nada que deshacer',
    'a11y.nothingToReplay': 'Nada que rehacer',
  },
};
