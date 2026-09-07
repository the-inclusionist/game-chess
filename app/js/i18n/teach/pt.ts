// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/teach/pt — the lessons in Portuguese (Brazil). The base: the other two fall back to this.
//
// ========================= ⚠️ THE GENDER RULE APPLIES HERE TOO =========================
// `i18n/pt.ts` states it and it is not stylistic: the catalogue carries grammatical gender for the
// piece NOUN and for nothing else, so a sentence that would have to agree with a piece has to be
// rewritten rather than given a second gender table.
//
// The lessons obey it the easy way: not one sentence below interpolates `{piece}`. A lesson knows
// which piece it teaches — it chose the position — so it writes "este peão" and "a torre" into the
// prose, and the agreement is settled once, by a person, in the language it belongs to. That is
// the difference between a lesson and the game's running commentary, which cannot know.
//
// ========================= WHY THE SENTENCES ARE SHORT =========================
// Every one of these goes to `#sr-status` as well as to the screen. A blind child hears the whole
// sentence before the board is theirs again, so a paragraph is a wait, not a help. The nudge is
// the second half, given only after a wrong answer, and that is where the longer explanation goes.

import type { TeachStrings } from './index.ts';

export const pt: TeachStrings = {
  /* ------------------------------- reading the board ------------------------------- */
  'teach.notation.files':
    'Cada coluna tem uma letra, de a até h. Cada linha tem um número, de 1 a 8. O nome de uma '
    + 'casa é a letra com o número. Toque em e4.',
  'teach.notation.files.nudge':
    'Conte as colunas da esquerda: a, b, c, d, e. Depois suba até a linha 4.',
  'teach.notation.ranks': 'Agora toque em c6.',
  'teach.notation.ranks.nudge': 'Terceira coluna, sexta linha.',
  'teach.notation.name': 'Uma casa está marcada no tabuleiro. Qual é o nome dela?',
  'teach.notation.name.nudge': 'Primeiro a letra da coluna, depois o número da linha.',
  'teach.notation.together': 'Toque em b7 e depois em g2.',
  'teach.notation.together.nudge': 'São duas casas, e a ordem não importa.',

  /* ------------------------------- what a piece is worth ------------------------------- */
  'teach.values.pawn': 'Na hora de trocar peças, cada uma vale um tanto. Quanto vale um peão?',
  'teach.values.one': '1 ponto',
  'teach.values.three': '3 pontos',
  'teach.values.five': '5 pontos',
  'teach.values.nine': '9 pontos',
  'teach.values.everything': 'Não tem preço',
  'teach.values.rook': 'E a torre, quanto vale?',
  'teach.values.rook.nudge': 'A torre vale mais que o bispo e menos que a dama.',
  'teach.values.queen': 'E a dama, a peça mais forte do tabuleiro?',
  'teach.values.king': 'E o rei?',
  'teach.values.king.nudge':
    'O rei nunca é capturado. Sem ele não há jogo, então nenhum número serve.',

  /* ------------------------------- how each piece moves ------------------------------- */
  'teach.pawn.reach':
    'O peão anda para a frente, uma casa por vez. Na primeira vez que sai do lugar, pode andar '
    + 'duas. Marque onde este peão pode chegar.',
  'teach.pawn.reach.nudge': 'São duas casas: uma à frente e duas à frente.',
  'teach.pawn.double': 'Leve o peão duas casas, até e4.',
  'teach.pawn.double.nudge':
    'O salto de duas casas só vale quando o peão ainda não saiu do lugar.',
  'teach.pawn.capture': 'O peão anda reto, mas captura na diagonal. Capture o peão preto.',
  'teach.pawn.capture.nudge':
    'A casa da frente está livre, mas não é lá que se captura. Olhe na diagonal.',

  'teach.rook.reach':
    'A torre anda em linha reta, pela coluna e pela linha, quantas casas quiser. Marque tudo '
    + 'onde ela pode chegar.',
  'teach.rook.reach.nudge':
    'Suba, desça, vá para a esquerda e para a direita, cada lado até a borda.',
  'teach.rook.play': 'Leve a torre até d8.',

  'teach.bishop.reach':
    'O bispo anda só na diagonal, quantas casas quiser. Marque tudo onde ele pode chegar.',
  'teach.bishop.reach.nudge': 'Quatro diagonais saem desta casa. Siga cada uma até a borda.',
  'teach.bishop.colour':
    'Este bispo está numa casa escura. Em que cor de casa ele vai estar depois de dez lances?',
  'teach.bishop.light': 'Sempre em casa clara',
  'teach.bishop.dark': 'Sempre em casa escura',
  'teach.bishop.both': 'Ora clara, ora escura',
  'teach.bishop.colour.nudge':
    'Uma diagonal nunca muda de cor. O bispo passa a partida inteira na cor em que começou.',

  'teach.knight.reach':
    'O cavalo anda em L: duas casas para um lado e uma virando. Marque as oito casas onde ele '
    + 'pode chegar.',
  'teach.knight.reach.nudge': 'Duas casas numa direção, depois uma casa para o lado.',
  'teach.knight.jumps': 'Agora o cavalo está cercado. Marque onde ele pode chegar assim mesmo.',
  'teach.knight.jumps.nudge': 'O cavalo é a única peça que pula. Nada no caminho o segura.',

  'teach.queen.reach':
    'A dama anda em linha reta e na diagonal, quantas casas quiser. Marque tudo onde ela pode '
    + 'chegar.',
  'teach.queen.reach.nudge': 'Oito direções saem desta casa. Siga cada uma até a borda.',
  'teach.queen.sum': 'A dama anda como quais duas peças juntas?',
  'teach.queen.rookBishop': 'Torre e bispo',
  'teach.queen.rookKnight': 'Torre e cavalo',
  'teach.queen.twoRooks': 'Duas torres',

  'teach.king.reach':
    'O rei anda uma casa por vez, em qualquer direção. Marque onde ele pode chegar.',
  'teach.king.reach.nudge': 'São oito casas: todas as vizinhas, em volta.',
  'teach.king.slow': 'Mova o rei para qualquer casa vizinha.',

  /* ------------------------------- the three special rules ------------------------------- */
  'teach.promotion.reach':
    'Um peão que chega à última linha vira outra peça. Marque a casa onde este peão chega.',
  'teach.promotion.reach.nudge': 'É uma casa só: a da frente, na última linha.',
  'teach.promotion.play': 'Leve o peão até a última linha e escolha a dama.',
  'teach.promotion.play.nudge':
    'O peão pode virar dama, torre, bispo ou cavalo. A dama é quase sempre a melhor escolha.',

  'teach.enpassant.reach':
    'O peão preto acabou de saltar duas casas e passou bem ao lado do peão branco. Marque onde o '
    + 'peão branco pode chegar.',
  'teach.enpassant.reach.nudge':
    'São duas: a casa da frente e a casa onde o peão preto teria parado se tivesse andado só uma.',
  'teach.enpassant.play':
    'Capture en passant: leve o peão até d6, e o peão preto sai do tabuleiro.',
  'teach.enpassant.play.nudge':
    'Este direito dura um lance só. Jogando outra coisa agora, ele se perde para sempre.',

  'teach.castling.reach':
    'O rei e a torre podem trocar de lugar num lance só. Marque onde este rei pode chegar.',
  'teach.castling.reach.nudge':
    'Além das casas vizinhas há duas mais longe, uma de cada lado, onde está a torre.',
  'teach.castling.short': 'Faça o roque pequeno: o rei vai até g1.',
  'teach.castling.short.nudge': 'O rei anda duas casas na direção da torre mais próxima.',
  'teach.castling.long': 'Agora o roque grande: o rei vai até c1.',
  'teach.castling.long.nudge':
    'Do outro lado o rei também anda duas casas, e a torre pula por cima dele.',

  /* --------------------------- the endgame, which is geometry --------------------------- */
  'teach.square.can':
    'Um peão passado corre para a promoção. Trace um quadrado do peão até a última linha: se o rei '
    + 'conseguir entrar nele, alcança o peão. Este rei alcança?',
  'teach.square.can.nudge':
    'O peão está na quarta linha: faltam quatro casas. Conte quantas o rei precisa para chegar à '
    + 'casa de promoção.',
  'teach.square.yes': 'Sim, alcança',
  'teach.square.no': 'Não, o peão promove',
  'teach.square.cannot': 'E agora? O peão avançou uma casa e o rei ficou uma coluna mais longe.',
  'teach.square.cannot.nudge':
    'Um tempo vale exatamente uma coluna de quadrado. O rei ficou de fora, e correr não adianta.',
  'teach.square.take':
    'A regra fala de uma corrida, mas o rei não precisa correr. O peão está ao lado dele: capture.',
  'teach.square.take.nudge':
    'Contar a corrida até a casa de promoção diria que não dá. Olhe para o peão, não para a '
    + 'oitava linha.',

  'teach.opposition.who':
    'Os reis estão frente a frente com uma casa no meio: isso é a oposição. Quem a tem é quem NÃO '
    + 'precisa jogar. As brancas jogam. Quem tem a oposição?',
  'teach.opposition.who.nudge':
    'Quem joga tem que sair da frente. A oposição é de quem espera.',
  'teach.opposition.white': 'As brancas',
  'teach.opposition.black': 'As pretas',
  'teach.opposition.take':
    'Agora há duas casas entre os reis, e ninguém tem a oposição. Um lance a toma. Jogue-o.',
  'teach.opposition.take.nudge':
    'Ande com o rei para a frente, na mesma coluna, até sobrar uma casa entre os dois.',

  /* --------------------------- the book: a game played through --------------------------- */
  'teach.book.opera.n5':
    'As brancas abrem o centro. Cada lance até aqui desenvolveu uma peça ou abriu uma linha: esse '
    + 'é o plano inteiro.',
  'teach.book.opera.n6':
    'As pretas prendem o cavalo, mas ainda não tiraram nenhuma peça do lugar. Prender não é '
    + 'desenvolver.',
  'teach.book.opera.n11':
    'O bispo aponta para f7, a casa mais fraca do outro lado: só o rei a defende.',
  'teach.book.opera.n17':
    'Outro prego: o bispo prende o cavalo contra a dama. As pretas agora têm duas peças que não '
    + 'podem sair do lugar.',
  'teach.book.opera.n19':
    'Um cavalo por um peão. Morphy não está contando material, está contando tempo.',
  'teach.book.opera.n23':
    'O roque tira o rei do centro e joga a torre na coluna d, onde está o cavalo preso. Um lance, '
    + 'dois serviços.',
  'teach.book.opera.n25': 'Tire quem defende. A torre come o cavalo que segurava tudo.',
  'teach.book.opera.n31': 'A dama de graça. O mate já está lá; ela só está atrapalhando.',
  'teach.book.opera.n33': 'Mate, com duas peças, contra um exército que nunca saiu de casa.',
  'teach.book.nudge':
    'Não foi este o lance da partida. Leia a nota de novo: ela diz o que este lance estava '
    + 'tentando fazer.',

  /* ------------- Capablanca I.1: the elementary mates ------------- */
  'teach.materook.cut':
    'A torre sozinha não dá mate, mas corta. Ponha-a na sétima linha: o rei preto nunca mais a '
    + 'atravessa.',
  'teach.materook.cut.nudge':
    'Suba a torre pela coluna a até a linha 7. Nada está no caminho.',
  'teach.materook.walk':
    'Agora traga o seu rei. A torre prende, mas quem dá o mate são os dois juntos.',
  'teach.materook.walk.nudge': 'Um passo do rei para a frente, para e2.',
  'teach.materook.mate':
    'Os reis estão frente a frente com uma casa no meio: é a oposição, e o rei preto não tem para '
    + 'onde fugir. Dê o mate com a torre.',
  'teach.materook.mate.nudge':
    'A torre vai para a oitava linha. O seu rei já toma todas as casas de fuga.',

  'teach.matequeen.cut':
    'A dama faz o mesmo que a torre, e mais depressa. Corte a sétima linha.',
  'teach.matequeen.cut.nudge': 'Suba a dama pela coluna a até a linha 7.',
  'teach.matequeen.trap':
    'Cuidado: com a dama é fácil demais tirar TODAS as casas do rei preto. Se as brancas jogassem '
    + 'Dg6 agora, o que aconteceria?',
  'teach.matequeen.trap.nudge':
    'Conte as casas do rei preto depois de Dg6. Se não sobra nenhuma e ele não está em xeque, a '
    + 'partida acaba empatada.',
  'teach.matequeen.stalemate': 'Empate por afogamento',
  'teach.matequeen.checkmate': 'Xeque-mate',
  'teach.matequeen.nothing': 'Nada de especial',
  'teach.matequeen.mate':
    'Com o rei ao lado, a dama não precisa chegar perto. Dê o mate na oitava linha.',
  'teach.matequeen.mate.nudge':
    'A dama sobe para a oitava linha. O seu rei cobre as casas de fuga.',

  'teach.matebishops.corner':
    'Dois bispos também dão mate, mas há uma diferença. O rei preto já está na borda. Isso basta?',
  'teach.matebishops.corner.nudge':
    'Com torre ou dama, a borda basta. Com dois bispos, não: eles não alcançam a casa ao lado da '
    + 'que atacam.',
  'teach.matebishops.needcorner': 'Não: é preciso levá-lo até um canto',
  'teach.matebishops.edgeisenough': 'Sim, a borda basta',
  'teach.matebishops.impossible': 'Dois bispos nunca dão mate',
  'teach.matebishops.diagonal':
    'Um bispo tira uma diagonal inteira. Marque todas as casas a que este bispo chega.',
  'teach.matebishops.diagonal.nudge':
    'Ele anda só na diagonal, para os dois lados, até o fim do tabuleiro.',
  'teach.matebishops.mate':
    'O rei preto está no canto e o seu rei toma a7 e b7. Um bispo entra na diagonal comprida e '
    + 'acaba.',
  'teach.matebishops.mate.nudge':
    'Leve o bispo até g2. Dali ele vê o canto a8 em linha reta.',
};
