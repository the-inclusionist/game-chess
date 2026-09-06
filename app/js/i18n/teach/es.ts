// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/teach/es — the lessons in Spanish.
//
// ⚠️ SPANISH IS NOT PORTUGUESE WITH DIFFERENT ACCENTS, AND THE PIECES ARE WHERE THAT BITES. The
// six nouns happen to carry the same grammatical gender in both languages, which is a trap rather
// than a convenience: it makes the two catalogues look interchangeable when the WORDS are not.
// The bishop is "o bispo" and "el alfil"; the pawn is "o peão" and "el peón"; a square is "casa"
// and "casilla"; the move is "roque" and "enroque". Translating one file by transliterating the
// other produces Portuguese with Spanish spelling, and a child reading it would know.
//
// As in the other two, nothing here interpolates `{piece}`: every sentence names its piece in full,
// so the article and the adjective are written by a person in the language they belong to. The
// gender rule of `i18n/pt.ts` is therefore satisfied here the same way — by never needing it.

import type { TeachStrings } from './index.ts';

export const es: TeachStrings = {
  /* ------------------------------- reading the board ------------------------------- */
  'teach.notation.title': 'Leer el tablero',
  'teach.notation.files':
    'Cada columna tiene una letra, de la a a la h. Cada fila tiene un número, del 1 al 8. El '
    + 'nombre de una casilla es la letra con el número. Toca e4.',
  'teach.notation.files.nudge':
    'Cuenta las columnas desde la izquierda: a, b, c, d, e. Después sube hasta la fila 4.',
  'teach.notation.ranks': 'Ahora toca c6.',
  'teach.notation.ranks.nudge': 'Tercera columna, sexta fila.',
  'teach.notation.name': 'Hay una casilla marcada en el tablero. ¿Cómo se llama?',
  'teach.notation.name.nudge': 'Primero la letra de la columna, después el número de la fila.',
  'teach.notation.together': 'Toca b7 y después g2.',
  'teach.notation.together.nudge': 'Son dos casillas, y el orden no importa.',

  /* ------------------------------- what a piece is worth ------------------------------- */
  'teach.values.title': 'Cuánto vale cada pieza',
  'teach.values.pawn': 'Al cambiar piezas, cada una vale algo. ¿Cuánto vale un peón?',
  'teach.values.one': '1 punto',
  'teach.values.three': '3 puntos',
  'teach.values.five': '5 puntos',
  'teach.values.nine': '9 puntos',
  'teach.values.everything': 'No tiene precio',
  'teach.values.rook': '¿Y la torre?',
  'teach.values.rook.nudge': 'La torre vale más que el alfil y menos que la dama.',
  'teach.values.queen': '¿Y la dama, la pieza más fuerte del tablero?',
  'teach.values.king': '¿Y el rey?',
  'teach.values.king.nudge':
    'El rey nunca se captura. Sin él no hay partida, así que ningún número sirve.',

  /* ------------------------------- how each piece moves ------------------------------- */
  'teach.pawn.title': 'El peón',
  'teach.pawn.reach':
    'El peón avanza de a una casilla. La primera vez que sale de su sitio puede avanzar dos. '
    + 'Marca adónde puede llegar este peón.',
  'teach.pawn.reach.nudge': 'Son dos casillas: una adelante y dos adelante.',
  'teach.pawn.double': 'Lleva el peón dos casillas, hasta e4.',
  'teach.pawn.double.nudge':
    'El salto de dos casillas solo vale mientras el peón no se haya movido.',
  'teach.pawn.capture': 'El peón avanza recto, pero captura en diagonal. Captura el peón negro.',
  'teach.pawn.capture.nudge':
    'La casilla de adelante está libre, pero ahí no se captura. Mira en diagonal.',

  'teach.rook.title': 'La torre',
  'teach.rook.reach':
    'La torre se mueve en línea recta, por su columna y por su fila, todas las casillas que '
    + 'quiera. Marca todo adonde puede llegar.',
  'teach.rook.reach.nudge': 'Sube, baja, ve a la izquierda y a la derecha, cada lado hasta el borde.',
  'teach.rook.play': 'Lleva la torre hasta d8.',

  'teach.bishop.title': 'El alfil',
  'teach.bishop.reach':
    'El alfil se mueve solo en diagonal, todas las casillas que quiera. Marca todo adonde puede '
    + 'llegar.',
  'teach.bishop.reach.nudge': 'De esta casilla salen cuatro diagonales. Sigue cada una hasta el borde.',
  'teach.bishop.colour':
    'Este alfil está en una casilla oscura. ¿En qué color de casilla estará dentro de diez jugadas?',
  'teach.bishop.light': 'Siempre en casilla clara',
  'teach.bishop.dark': 'Siempre en casilla oscura',
  'teach.bishop.both': 'Unas veces clara, otras oscura',
  'teach.bishop.colour.nudge':
    'Una diagonal nunca cambia de color. El alfil pasa toda la partida en el color donde empezó.',

  'teach.knight.title': 'El caballo',
  'teach.knight.reach':
    'El caballo se mueve en L: dos casillas hacia un lado y una girando. Marca las ocho casillas '
    + 'adonde puede llegar.',
  'teach.knight.reach.nudge': 'Dos casillas en una dirección, después una casilla al costado.',
  'teach.knight.jumps': 'Ahora el caballo está rodeado. Marca adónde puede llegar igual.',
  'teach.knight.jumps.nudge': 'El caballo es la única pieza que salta. Nada en el camino lo detiene.',

  'teach.queen.title': 'La dama',
  'teach.queen.reach':
    'La dama se mueve en línea recta y en diagonal, todas las casillas que quiera. Marca todo '
    + 'adonde puede llegar.',
  'teach.queen.reach.nudge': 'De esta casilla salen ocho direcciones. Sigue cada una hasta el borde.',
  'teach.queen.sum': '¿La dama se mueve como qué dos piezas juntas?',
  'teach.queen.rookBishop': 'Torre y alfil',
  'teach.queen.rookKnight': 'Torre y caballo',
  'teach.queen.twoRooks': 'Dos torres',

  'teach.king.title': 'El rey',
  'teach.king.reach':
    'El rey se mueve de a una casilla, en cualquier dirección. Marca adónde puede llegar.',
  'teach.king.reach.nudge': 'Son ocho casillas: todas las vecinas, alrededor.',
  'teach.king.slow': 'Mueve el rey a cualquier casilla vecina.',

  /* ------------------------------- the three special rules ------------------------------- */
  'teach.promotion.title': 'La promoción',
  'teach.promotion.reach':
    'Un peón que llega a la última fila se convierte en otra pieza. Marca la casilla adonde llega '
    + 'este peón.',
  'teach.promotion.reach.nudge': 'Es una sola casilla: la de adelante, en la última fila.',
  'teach.promotion.play': 'Lleva el peón hasta la última fila y elige la dama.',
  'teach.promotion.play.nudge':
    'El peón puede volverse dama, torre, alfil o caballo. La dama casi siempre es lo mejor.',

  'teach.enpassant.title': 'La captura al paso',
  'teach.enpassant.reach':
    'El peón negro acaba de saltar dos casillas y pasó justo al lado del peón blanco. Marca '
    + 'adónde puede llegar el peón blanco.',
  'teach.enpassant.reach.nudge':
    'Son dos: la casilla de adelante y la casilla donde el peón negro habría parado si hubiera '
    + 'avanzado solo una.',
  'teach.enpassant.play':
    'Captura al paso: lleva el peón hasta d6, y el peón negro sale del tablero.',
  'teach.enpassant.play.nudge':
    'Este derecho dura una sola jugada. Si juegas otra cosa ahora, se pierde para siempre.',

  'teach.castling.title': 'El enroque',
  'teach.castling.reach':
    'El rey y la torre pueden cambiar de lugar en una sola jugada. Marca adónde puede llegar este '
    + 'rey.',
  'teach.castling.reach.nudge':
    'Además de las casillas vecinas hay dos más lejos, una de cada lado, donde están las torres.',
  'teach.castling.short': 'Haz el enroque corto: el rey va hasta g1.',
  'teach.castling.short.nudge': 'El rey avanza dos casillas hacia la torre más cercana.',
  'teach.castling.long': 'Ahora el enroque largo: el rey va hasta c1.',
  'teach.castling.long.nudge':
    'De ese lado el rey también avanza dos casillas, y la torre salta por encima de él.',
};
