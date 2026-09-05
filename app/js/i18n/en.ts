// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/en — English. Every noun is neutral and the adjective precedes it, which is precisely why
// `pieceNamePattern` is data: hardcoding either order would make one language the default.

import type { Catalog } from './types.ts';

export const en: Catalog = {
  bcp47: 'en',

  pieces: {
    p: { text: 'pawn',   gender: 'n' },
    r: { text: 'rook',   gender: 'n' },
    n: { text: 'knight', gender: 'n' },
    b: { text: 'bishop', gender: 'n' },
    q: { text: 'queen',  gender: 'n' },
    k: { text: 'king',   gender: 'n' },
  },

  sides: {
    w: { m: 'white', f: 'white', n: 'white' },
    b: { m: 'black', f: 'black', n: 'black' },
  },

  pieceNamePattern: '{side} {piece}',

  strings: {
    'objective.checkmate': 'checkmate',

    'status.check':      'Check.',
    'status.checkmate':  'Checkmate. {side} wins.',
    'status.stalemate':  'Stalemate. Draw.',
    'status.draw':       'Draw.',
    'status.thinking':   'Thinking…',
    'status.engineFailed': 'I could not work out a move. Please try again.',

    'turn.w': 'White',
    'turn.b': 'Black',

    'hud.turn':       'Turn',
    'hud.captured':   'Captured',
    'hud.moves':      'Moves',
    'hud.difficulty': 'Difficulty',

    'difficulty.easy':   'Easy',
    'difficulty.medium': 'Medium',
    'difficulty.hard':   'Hard',

    'move.plain':       '{piece} {from} to {to}',
    'move.capture':     '{piece} {from} takes {target} on {to}',
    'move.castleShort': 'Kingside castling',
    'move.castleLong':  'Queenside castling',
    'move.promotion':   'Pawn promoted on {to}: {piece}',

    'square.empty':    '{square}, empty',
    'square.occupied': '{square}, {piece}',

    'a11y.boardLabel':  'Chess board, 8 by 8',
    'a11y.selected':    'Selected: {piece} on {square}',
    'a11y.noSelection': 'No piece selected',
    'a11y.legalMoves':  '{count} legal moves',
    'a11y.cellMove': 'move available',
    'a11y.cellCapture': 'capture available',
    'a11y.cellCheck': 'in check',
    'a11y.gridHint': 'Arrows navigate, Enter selects',
  },
};
