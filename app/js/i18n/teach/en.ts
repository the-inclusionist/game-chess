// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/teach/en — the lessons in English.
//
// English inflects nothing here, so the gender rule that shapes `pt.ts` and `es.ts` costs this file
// nothing — which is exactly why the rule is written down in the Portuguese file and not in this
// one. A translator working from English alone would never discover it.
//
// ⚠️ THE SQUARE NAMES ARE NOT TRANSLATED, and they are not in this file at all. `e4` is `e4` in
// every language this game speaks; the notation lesson's `pick` options are literals in the table
// and reach the panel through `t()` unchanged, because a key nobody has resolves to itself.

import type { TeachStrings } from './index.ts';

export const en: TeachStrings = {
  /* ------------------------------- reading the board ------------------------------- */
  'teach.notation.title': 'Reading the board',
  'teach.notation.files':
    'Every column has a letter, from a to h. Every row has a number, from 1 to 8. A square is '
    + 'named by its letter and its number. Touch e4.',
  'teach.notation.files.nudge':
    'Count the columns from the left: a, b, c, d, e. Then go up to row 4.',
  'teach.notation.ranks': 'Now touch c6.',
  'teach.notation.ranks.nudge': 'Third column, sixth row.',
  'teach.notation.name': 'One square is marked on the board. What is it called?',
  'teach.notation.name.nudge': 'The column letter first, then the row number.',
  'teach.notation.together': 'Touch b7, then g2.',
  'teach.notation.together.nudge': 'Two squares, and the order does not matter.',

  /* ------------------------------- what a piece is worth ------------------------------- */
  'teach.values.title': 'What each piece is worth',
  'teach.values.pawn': 'When pieces are traded, each one is worth something. What is a pawn worth?',
  'teach.values.one': '1 point',
  'teach.values.three': '3 points',
  'teach.values.five': '5 points',
  'teach.values.nine': '9 points',
  'teach.values.everything': 'Beyond price',
  'teach.values.rook': 'And the rook?',
  'teach.values.rook.nudge': 'A rook is worth more than a bishop and less than a queen.',
  'teach.values.queen': 'And the queen, the strongest piece on the board?',
  'teach.values.king': 'And the king?',
  'teach.values.king.nudge':
    'The king is never captured. Without it there is no game, so no number fits.',

  /* ------------------------------- how each piece moves ------------------------------- */
  'teach.pawn.title': 'The pawn',
  'teach.pawn.reach':
    'A pawn moves forward, one square at a time. The first time it leaves home it may move two. '
    + 'Mark where this pawn can go.',
  'teach.pawn.reach.nudge': 'Two squares: one ahead and two ahead.',
  'teach.pawn.double': 'Move the pawn two squares, to e4.',
  'teach.pawn.double.nudge': 'The two-square jump only counts while the pawn is still at home.',
  'teach.pawn.capture':
    'A pawn moves straight ahead but captures diagonally. Capture the black pawn.',
  'teach.pawn.capture.nudge':
    'The square ahead is empty, but that is not where a pawn takes. Look diagonally.',

  'teach.rook.title': 'The rook',
  'teach.rook.reach':
    'A rook moves in a straight line, along its column and its row, as far as it likes. Mark '
    + 'everywhere it can go.',
  'teach.rook.reach.nudge': 'Up, down, left and right, each way to the edge.',
  'teach.rook.play': 'Take the rook to d8.',

  'teach.bishop.title': 'The bishop',
  'teach.bishop.reach':
    'A bishop moves only on the diagonal, as far as it likes. Mark everywhere it can go.',
  'teach.bishop.reach.nudge': 'Four diagonals leave this square. Follow each one to the edge.',
  'teach.bishop.colour':
    'This bishop stands on a dark square. What colour square will it be on after ten moves?',
  'teach.bishop.light': 'Always a light square',
  'teach.bishop.dark': 'Always a dark square',
  'teach.bishop.both': 'Sometimes light, sometimes dark',
  'teach.bishop.colour.nudge':
    'A diagonal never changes colour. A bishop spends the whole game on the colour it started on.',

  'teach.knight.title': 'The knight',
  'teach.knight.reach':
    'A knight moves in an L: two squares one way, then one square to the side. Mark the eight '
    + 'squares it can reach.',
  'teach.knight.reach.nudge': 'Two squares in one direction, then one square across.',
  'teach.knight.jumps': 'Now the knight is surrounded. Mark where it can go anyway.',
  'teach.knight.jumps.nudge': 'The knight is the only piece that jumps. Nothing in the way stops it.',

  'teach.queen.title': 'The queen',
  'teach.queen.reach':
    'A queen moves in a straight line and on the diagonal, as far as she likes. Mark everywhere '
    + 'she can go.',
  'teach.queen.reach.nudge': 'Eight directions leave this square. Follow each one to the edge.',
  'teach.queen.sum': 'A queen moves like which two pieces put together?',
  'teach.queen.rookBishop': 'Rook and bishop',
  'teach.queen.rookKnight': 'Rook and knight',
  'teach.queen.twoRooks': 'Two rooks',

  'teach.king.title': 'The king',
  'teach.king.reach':
    'A king moves one square at a time, in any direction. Mark where he can go.',
  'teach.king.reach.nudge': 'Eight squares: every neighbour, all the way round.',
  'teach.king.slow': 'Move the king to any neighbouring square.',

  /* ------------------------------- the three special rules ------------------------------- */
  'teach.promotion.title': 'Promotion',
  'teach.promotion.reach':
    'A pawn that reaches the far row turns into another piece. Mark the square this pawn reaches.',
  'teach.promotion.reach.nudge': 'Just one square: straight ahead, on the far row.',
  'teach.promotion.play': 'Take the pawn to the far row and choose the queen.',
  'teach.promotion.play.nudge':
    'A pawn may become a queen, a rook, a bishop or a knight. The queen is nearly always best.',

  'teach.enpassant.title': 'Capturing en passant',
  'teach.enpassant.reach':
    'The black pawn has just jumped two squares and passed right beside the white one. Mark where '
    + 'the white pawn can go.',
  'teach.enpassant.reach.nudge':
    'Two squares: the one straight ahead, and the one the black pawn would have stopped on had it '
    + 'moved only one.',
  'teach.enpassant.play':
    'Capture en passant: take the pawn to d6, and the black pawn leaves the board.',
  'teach.enpassant.play.nudge':
    'This right lasts for one move only. Play anything else now and it is gone for good.',

  'teach.castling.title': 'Castling',
  'teach.castling.reach':
    'The king and a rook can change places in a single move. Mark where this king can go.',
  'teach.castling.reach.nudge':
    'Besides the neighbouring squares there are two further off, one on each side, where the rooks '
    + 'are.',
  'teach.castling.short': 'Castle kingside: the king goes to g1.',
  'teach.castling.short.nudge': 'The king moves two squares towards the nearer rook.',
  'teach.castling.long': 'Now castle queenside: the king goes to c1.',
  'teach.castling.long.nudge':
    'On that side the king also moves two squares, and the rook jumps over him.',
};
