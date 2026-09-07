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

  'teach.rook.reach':
    'A rook moves in a straight line, along its column and its row, as far as it likes. Mark '
    + 'everywhere it can go.',
  'teach.rook.reach.nudge': 'Up, down, left and right, each way to the edge.',
  'teach.rook.play': 'Take the rook to d8.',

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

  'teach.knight.reach':
    'A knight moves in an L: two squares one way, then one square to the side. Mark the eight '
    + 'squares it can reach.',
  'teach.knight.reach.nudge': 'Two squares in one direction, then one square across.',
  'teach.knight.jumps': 'Now the knight is surrounded. Mark where it can go anyway.',
  'teach.knight.jumps.nudge': 'The knight is the only piece that jumps. Nothing in the way stops it.',

  'teach.queen.reach':
    'A queen moves in a straight line and on the diagonal, as far as she likes. Mark everywhere '
    + 'she can go.',
  'teach.queen.reach.nudge': 'Eight directions leave this square. Follow each one to the edge.',
  'teach.queen.sum': 'A queen moves like which two pieces put together?',
  'teach.queen.rookBishop': 'Rook and bishop',
  'teach.queen.rookKnight': 'Rook and knight',
  'teach.queen.twoRooks': 'Two rooks',

  'teach.king.reach':
    'A king moves one square at a time, in any direction. Mark where he can go.',
  'teach.king.reach.nudge': 'Eight squares: every neighbour, all the way round.',
  'teach.king.slow': 'Move the king to any neighbouring square.',

  /* ------------------------------- the three special rules ------------------------------- */
  'teach.promotion.reach':
    'A pawn that reaches the far row turns into another piece. Mark the square this pawn reaches.',
  'teach.promotion.reach.nudge': 'Just one square: straight ahead, on the far row.',
  'teach.promotion.play': 'Take the pawn to the far row and choose the queen.',
  'teach.promotion.play.nudge':
    'A pawn may become a queen, a rook, a bishop or a knight. The queen is nearly always best.',

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

  /* --------------------------- the endgame, which is geometry --------------------------- */
  'teach.square.can':
    'A passed pawn runs for promotion. Draw a square from the pawn to the last row: if the king can '
    + 'step inside it, it catches the pawn. Does this king catch it?',
  'teach.square.can.nudge':
    'The pawn is on the fourth row and has four squares to go. Count how many the king needs to '
    + 'reach the promotion square.',
  'teach.square.yes': 'Yes, it catches it',
  'teach.square.no': 'No, the pawn promotes',
  'teach.square.cannot':
    'And now? The pawn has moved one square and the king is one file further away.',
  'teach.square.cannot.nudge':
    'A tempo is worth exactly one file of square. The king is outside it, and running will not help.',
  'teach.square.take':
    'The rule talks about a race, but the king does not have to race. The pawn is right beside it: '
    + 'take it.',
  'teach.square.take.nudge':
    'Counting the race to the promotion square would say it cannot be done. Look at the pawn, not '
    + 'at the eighth row.',

  'teach.opposition.who':
    'The kings face each other with one square between: that is the opposition. It belongs to '
    + 'whoever does NOT have to move. White to play. Who has it?',
  'teach.opposition.who.nudge':
    'Whoever moves has to give way. The opposition belongs to the one who waits.',
  'teach.opposition.white': 'White',
  'teach.opposition.black': 'Black',
  'teach.opposition.take':
    'Now there are two squares between the kings and nobody has the opposition. One move takes it. '
    + 'Play it.',
  'teach.opposition.take.nudge':
    'Walk the king forward, on the same file, until one square is left between them.',

  /* --------------------------- the book: a game played through --------------------------- */
  'teach.book.opera.n5':
    'White opens the centre. Every move so far has developed a piece or opened a line, and that is '
    + 'the entire plan.',
  'teach.book.opera.n6':
    'Black pins the knight, but has still not brought a single piece into play. Pinning is not '
    + 'developing.',
  'teach.book.opera.n11':
    'The bishop points at f7, the weakest square the other side has: only the king defends it.',
  'teach.book.opera.n17':
    'A second pin: the bishop holds the knight against the queen. Black now has two pieces that '
    + 'cannot move at all.',
  'teach.book.opera.n19':
    'A knight for a pawn. Morphy is not counting material, he is counting time.',
  'teach.book.opera.n23':
    'Castling takes the king off the centre and drops the rook on the d-file, where the pinned '
    + 'knight stands. One move, two jobs.',
  'teach.book.opera.n25': 'Take away the defender. The rook eats the knight that was holding it together.',
  'teach.book.opera.n31': 'The queen for nothing. The mate is already there; she is only in the way.',
  'teach.book.opera.n33': 'Mate, with two pieces, against an army that never left home.',
  'teach.book.nudge':
    'That is not the move that was played. Read the note again: it says what this move '
    + 'was trying to do.',

  /* ------------- Capablanca I.1: the elementary mates ------------- */
  'teach.materook.cut':
    'A rook cannot mate on its own, but it can cut. Put it on the seventh rank: the black king '
    + 'never crosses it again.',
  'teach.materook.cut.nudge': 'Take the rook up the a-file to rank 7. Nothing is in the way.',
  'teach.materook.walk':
    'Now bring your king. The rook does the fencing; the mate takes both of them.',
  'teach.materook.walk.nudge': 'One step forward with the king, to e2.',
  'teach.materook.mate':
    'The kings face each other with one square between them — the opposition — and the black king '
    + 'has nowhere to go. Give mate with the rook.',
  'teach.materook.mate.nudge':
    'The rook goes to the eighth rank. Your king already covers every escape.',

  'teach.matequeen.cut':
    'A queen does what the rook did, and sooner. Cut the seventh rank.',
  'teach.matequeen.cut.nudge': 'Take the queen up the a-file to rank 7.',
  'teach.matequeen.trap':
    'Careful: with a queen it is easy to take away ALL of the black king\'s squares. If White '
    + 'played Qg6 now, what would happen?',
  'teach.matequeen.trap.nudge':
    'Count the black king\'s squares after Qg6. If none is left and he is not in check, the game '
    + 'is drawn.',
  'teach.matequeen.stalemate': 'A draw by stalemate',
  'teach.matequeen.checkmate': 'Checkmate',
  'teach.matequeen.nothing': 'Nothing in particular',
  'teach.matequeen.mate':
    'With the king beside her the queen need not come close. Give mate on the eighth rank.',
  'teach.matequeen.mate.nudge': 'The queen goes to the eighth rank. Your king covers the escapes.',

  'teach.matebishops.corner':
    'Two bishops mate as well, but with a difference. The black king is already on the edge. Is '
    + 'that enough?',
  'teach.matebishops.corner.nudge':
    'With a rook or a queen the edge is enough. With two bishops it is not: they cannot reach the '
    + 'square beside the one they attack.',
  'teach.matebishops.needcorner': 'No — he has to be driven into a corner',
  'teach.matebishops.edgeisenough': 'Yes, the edge is enough',
  'teach.matebishops.impossible': 'Two bishops can never mate',
  'teach.matebishops.diagonal':
    'A bishop takes a whole diagonal away. Mark every square this one reaches.',
  'teach.matebishops.diagonal.nudge':
    'It travels on the diagonal only, both ways, to the edge of the board.',
  'teach.matebishops.mate':
    'The black king is in the corner and your king holds a7 and b7. One bishop steps onto the long '
    + 'diagonal and it is over.',
  'teach.matebishops.mate.nudge':
    'Take the bishop to g2. From there it sees the corner a8 in a straight line.',
};
