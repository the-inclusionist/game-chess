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

  'teach.rook.reach':
    'La torre se mueve en línea recta, por su columna y por su fila, todas las casillas que '
    + 'quiera. Marca todo adonde puede llegar.',
  'teach.rook.reach.nudge': 'Sube, baja, ve a la izquierda y a la derecha, cada lado hasta el borde.',
  'teach.rook.play': 'Lleva la torre hasta d8.',

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

  'teach.knight.reach':
    'El caballo se mueve en L: dos casillas hacia un lado y una girando. Marca las ocho casillas '
    + 'adonde puede llegar.',
  'teach.knight.reach.nudge': 'Dos casillas en una dirección, después una casilla al costado.',
  'teach.knight.jumps': 'Ahora el caballo está rodeado. Marca adónde puede llegar igual.',
  'teach.knight.jumps.nudge': 'El caballo es la única pieza que salta. Nada en el camino lo detiene.',

  'teach.queen.reach':
    'La dama se mueve en línea recta y en diagonal, todas las casillas que quiera. Marca todo '
    + 'adonde puede llegar.',
  'teach.queen.reach.nudge': 'De esta casilla salen ocho direcciones. Sigue cada una hasta el borde.',
  'teach.queen.sum': '¿La dama se mueve como qué dos piezas juntas?',
  'teach.queen.rookBishop': 'Torre y alfil',
  'teach.queen.rookKnight': 'Torre y caballo',
  'teach.queen.twoRooks': 'Dos torres',

  'teach.king.reach':
    'El rey se mueve de a una casilla, en cualquier dirección. Marca adónde puede llegar.',
  'teach.king.reach.nudge': 'Son ocho casillas: todas las vecinas, alrededor.',
  'teach.king.slow': 'Mueve el rey a cualquier casilla vecina.',

  /* ------------------------------- the three special rules ------------------------------- */
  'teach.promotion.reach':
    'Un peón que llega a la última fila se convierte en otra pieza. Marca la casilla adonde llega '
    + 'este peón.',
  'teach.promotion.reach.nudge': 'Es una sola casilla: la de adelante, en la última fila.',
  'teach.promotion.play': 'Lleva el peón hasta la última fila y elige la dama.',
  'teach.promotion.play.nudge':
    'El peón puede volverse dama, torre, alfil o caballo. La dama casi siempre es lo mejor.',

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

  /* --------------------------- the endgame, which is geometry --------------------------- */
  'teach.square.can':
    'Un peón pasado corre hacia la promoción. Traza un cuadrado del peón hasta la última fila: si '
    + 'el rey puede entrar en él, alcanza al peón. ¿Este rey lo alcanza?',
  'teach.square.can.nudge':
    'El peón está en la cuarta fila: le faltan cuatro casillas. Cuenta cuántas necesita el rey '
    + 'para llegar a la casilla de promoción.',
  'teach.square.yes': 'Sí, lo alcanza',
  'teach.square.no': 'No, el peón promociona',
  'teach.square.cannot':
    '¿Y ahora? El peón avanzó una casilla y el rey quedó una columna más lejos.',
  'teach.square.cannot.nudge':
    'Un tiempo vale exactamente una columna de cuadrado. El rey quedó fuera, y correr no sirve.',
  'teach.square.take':
    'La regla habla de una carrera, pero el rey no tiene que correr. El peón está a su lado: '
    + 'captúralo.',
  'teach.square.take.nudge':
    'Contar la carrera hasta la casilla de promoción diría que no se puede. Mira el peón, no la '
    + 'octava fila.',

  'teach.opposition.who':
    'Los reyes están frente a frente con una casilla en medio: eso es la oposición. La tiene quien '
    + 'NO debe jugar. Juegan las blancas. ¿Quién la tiene?',
  'teach.opposition.who.nudge':
    'Quien juega tiene que apartarse. La oposición es de quien espera.',
  'teach.opposition.white': 'Las blancas',
  'teach.opposition.black': 'Las negras',
  'teach.opposition.take':
    'Ahora hay dos casillas entre los reyes y nadie tiene la oposición. Una jugada la toma. Hazla.',
  'teach.opposition.take.nudge':
    'Avanza el rey por la misma columna hasta que quede una casilla entre los dos.',

  /* --------------------------- the book: a game played through --------------------------- */
  'teach.book.opera.n5':
    'Las blancas abren el centro. Cada jugada hasta aquí desarrolló una pieza o abrió una línea: '
    + 'ese es todo el plan.',
  'teach.book.opera.n6':
    'Las negras clavan el caballo, pero todavía no sacaron ninguna pieza. Clavar no es desarrollar.',
  'teach.book.opera.n11':
    'El alfil apunta a f7, la casilla más débil del otro lado: solo el rey la defiende.',
  'teach.book.opera.n17':
    'Otra clavada: el alfil sujeta al caballo contra la dama. Las negras ya tienen dos piezas que '
    + 'no pueden moverse.',
  'teach.book.opera.n19':
    'Un caballo por un peón. Morphy no cuenta material, cuenta tiempo.',
  'teach.book.opera.n23':
    'El enroque saca al rey del centro y pone la torre en la columna d, donde está el caballo '
    + 'clavado. Una jugada, dos trabajos.',
  'teach.book.opera.n25': 'Quita al defensor. La torre se come al caballo que lo sostenía todo.',
  'teach.book.opera.n31': 'La dama regalada. El mate ya está ahí; ella solo estorba.',
  'teach.book.opera.n33': 'Mate, con dos piezas, contra un ejército que nunca salió de casa.',
  'teach.book.nudge':
    'Esa no es la jugada de la partida. Lee otra vez la nota: dice qué estaba '
    + 'intentando esta jugada.',
};
