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
    'hud.highContrast': 'Alto contraste',
    'hud.reducedMotion': 'Movimento reduzido',
    'hud.outline':    'Contorno das peças',
    'viz.trichromatic': 'Visão padrão',
    // ⚠️ Mirror the engine's `viz.fix-*` entries so `hud.ts` can translate the vision
    // select's labels through chess's own `i18n` and does not have to reach the engine's
    // dictionary through a lazy ref (Wave 2 item 2, 2026-10-02).
    'viz.fix-protan': 'Correção protanopia',
    'viz.fix-deuter': 'Correção deuteranopia',
    'viz.fix-tritan': 'Correção tritanopia',
    'hud.vision':     'Visão de cores',
    'hud.takeBack':   'Voltar lance',
    'hud.replay':     'Avançar lance',
    'hud.takeBackShort': 'Voltar',
    'hud.replayShort':   'Avançar',
    'hud.movesRegion': 'Lista de lances, rolável',
    'hud.coordinates': 'Letras e números',
    'view.2d':   '2D',
    'view.25d':  '2,5D',
    'view.3d':   '3D',
    'view.go':   'Ver o tabuleiro em {name}',
    'view.soon': 'ainda não disponível',
    'set.off.notVendored': 'fonte ainda não empacotada',
    'elo.1000': 'iniciante',
    'elo.1200': 'classe D (US Chess)',
    'elo.1400': 'classe C',
    'elo.1600': 'classe B',
    'elo.1800': 'classe A',
    'elo.2000': 'expert',
    'elo.2200': 'mestre nacional · candidato a mestre',
    'elo.2300': 'mestre FIDE',
    'elo.2400': 'mestre internacional',
    'elo.2500': 'grande mestre',
    'elo.3000': 'força total',
    'score.risk': 'Risco',
    'score.title': 'Pontuação',
    'score.material': 'Material',
    'score.engine': 'Engine',
    'score.blunders': 'Erros graves',
    'hud.protected': 'Modo protegido',
    'protected.warn': 'Lance fraco: {mark}. Perdeu {lost} pontos de chance de vitória.',
    'protected.teaching': 'O professor fica ligado para ajudar.',
    'protected.takeBack': 'Voltar o lance',
    'protected.continue': 'Continuar assim mesmo',
    'protected.tookBack': 'Lance desfeito. Pense outra vez.',
    'protected.kept': 'Lance mantido.',
    'mark.title': 'Avaliação da engine: {mark}',
    'splash.title': 'Xadrez na web',
    'splash.loading': 'A carregar o motor de xadrez…',
    'splash.ready': 'Pronto para jogar',
    'splash.slow': 'O motor está demorando. Dá para começar; o adversário pode não responder.',
    'splash.failed': 'Não foi possível carregar o motor. O tabuleiro funciona; o adversário não.',
    'splash.downloading': 'Baixando o adversário… {percent}%',
    'splash.play': 'JOGAR',
    'splash.learn': 'APRENDER',
    'hud.strength': 'Força do adversário',
    'hud.thinking': 'Pensamento da engine',
    'think.idle': 'parada',
    'think.searching': 'pensando…',
    'think.depth': 'profundidade',
    'think.nodes': 'posições',
    'think.score': 'avaliação',
    'think.line': 'linha',
    'hud.mode':        'Quem joga',
    'hud.hint':        'Professor',
    'mode.w':          '1 jog.\nbrancas',
    'mode.w.long':     'Um jogador, com as brancas',
    'mode.b':          '1 jog.\npretas',
    'mode.b.long':     'Um jogador, com as pretas',
    'mode.two':        '2 jog.',
    'mode.two.long':   'Dois jogadores no mesmo tabuleiro',
    'a11y.hintOne':    'A engine jogaria {move}',
    'a11y.hintMany':   'A engine jogaria {move}. Para ela, valem o mesmo: {others}',
    'a11y.hintNone':   'Sem lance a sugerir',
    'a11y.hintAsked':  'Procurando uma dica',
    'design.selenus': 'Selenus',
    'design.sikh': 'Império Sikh',
    'design.hartwig': 'Hartwig (Bauhaus)',
    'design.s1849': 'Staunton',
    'design.regence': 'Régence',
    'design.stgeorge': 'St George',
    'hud.pieceSet':    'Desenho das peças',
    'go.pieceSet.hint': 'Mudar a fonte com que o jogo desenha as peças no tabuleiro.',
    'pieceSet.symbols': 'Noto Sans Symbols 2',
    'pieceSet.math': 'STIX Two Math',
    'pieceSet.pecita': 'Pecita',
    'go.boardTheme.hint': 'Mudar as cores das casas e das peças.',
    'go.mode.hint': 'Jogar sozinho (um lado) ou com outra pessoa no mesmo tabuleiro.',
    'go.strength.hint': 'A força do adversário quando se joga sozinho — do iniciante ao Stockfish em potência máxima.',
    'go.outline.hint': 'Contornar as peças com uma linha preta — útil em alto contraste e para quem tem baixa visão.',
    'go.coordinates.hint': 'Mostrar as letras das colunas e os números das linhas em volta do tabuleiro.',
    'go.protected.hint': 'Impede o jogador de jogar lances claramente ruins — nos primeiros três erros, o lance volta e o jogo mostra uma dica. Fica desligado no modo dois jogadores.',
    'a11y.newSide':    'Novo jogo. Você joga com {side}',
    'hud.boardTheme':  'Cores do tabuleiro',
    'theme.wikipedia': 'Wikipédia',
    'theme.brown':     'chessboard.js',
    'contrast.title':      'Contraste medido, tema a tema',
    'contrast.pieces':     'peça clara × peça escura',
    'contrast.rimLight':   'contorno × casa clara',
    'contrast.rimDark':    'contorno × casa escura',
    'contrast.whiteLight': 'peça clara × casa clara',
    'contrast.whiteDark':  'peça clara × casa escura',
    'contrast.blackLight': 'peça escura × casa clara',
    'contrast.blackDark':  'peça escura × casa escura',
    'contrast.innerWhite': 'Traço interno claro × peça clara',
    'contrast.innerBlack': 'Traço interno escuro × peça escura',
    'contrast.squares':    'casa clara × casa escura',
    'contrast.pair':       'par',
    'contrast.floor':      'Piso da WCAG 1.4.11: 3:1. ✓ passa · • abaixo, carregado pelo contorno · ✗ falha',
    'theme.short.brown':     'cb.js',
    'theme.short.wikipedia': 'Wiki',
    'theme.short.xboard':    'XB',
    'theme.short.jose':      'José',
    'theme.short.contrast1': 'P&B',
    'theme.short.contrast2': 'A&A',
    'theme.xboard':    'XBoard',
    'theme.jose':      'José',
    'theme.cbsafe': 'Seguro para daltonismo',
    'theme.short.cbsafe': 'DALT',
    'theme.contrast1': 'Preto & Branco',
    'theme.contrast2': 'Azul & Amarelo',


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
    // ⚠️ NÃO CONCORDA COM A PEÇA. "nesta casa", nunca "{piece} marcada" — o catálogo carrega
    // gênero só para o substantivo da peça, e uma frase que exigisse concordância pediria uma
    // segunda tabela de gênero. Onde a frase exigiria, reescreva a frase.
    'a11y.cellLesson': 'a aula aponta nesta casa',
    // ⚠️ Azul e vermelho medem 1,06:1 um contra o outro. A palavra é o canal que sempre funciona.
    'a11y.cellRight': 'certo',
    'a11y.cellWrong': 'errado',

    /*
     * A MOLDURA DO PAINEL DE AULA. A prosa das aulas mora em `i18n/teach/`, buscada só por quem
     * abre uma; estas quatro existem no instante em que o painel existe e não crescem quando uma
     * aula é acrescentada. `teach.` fica reservado para a prosa.
     */
    'lesson.step': 'Passo {at} de {of}',
    'lesson.found': '{done} de {of} casas',
    'lesson.finished': 'Aula concluída',
    /*
     * ⚠️ IN THE MAIN CATALOGUE, NOT IN `i18n/teach/`. The split there is prose against chrome, and
     * these are FIFTEEN FIXED STRINGS for five themes — they do not grow when a puzzle is added,
     * two hundred tactics share them, and the column lists the five names at boot. The lazy
     * catalogue is also checked for having nothing spare, and a puzzle key is not asked for by any
     * lesson in the table.
     */
    'puzzle.theme.mateIn1': 'Mate em 1',
    'puzzle.theme.mateIn2': 'Mate em 2',
    'puzzle.theme.fork': 'Garfo',
    'puzzle.theme.pin': 'Cravada',
    'puzzle.theme.hangingPiece': 'Peça pendurada',
    'puzzle.say.mateIn1': 'Dê xeque-mate num lance.',
    'puzzle.say.mateIn2': 'Dê xeque-mate em dois lances. Comece pelo primeiro.',
    'puzzle.say.fork': 'Ataque duas peças ao mesmo tempo.',
    'puzzle.say.pin': 'Prenda uma peça: ela não pode sair sem expor outra maior.',
    'puzzle.say.hangingPiece': 'Há uma peça sem defesa. Capture-a.',
    'puzzle.nudge.mateIn1': 'Procure um xeque de que o rei não escape.',
    'puzzle.nudge.mateIn2': 'O primeiro lance costuma ser um xeque, ou um sacrifício.',
    'puzzle.nudge.fork': 'O cavalo e a dama são os que mais atacam duas peças de uma vez.',
    'puzzle.nudge.pin': 'Torre, bispo e dama prendem, porque atacam em linha.',
    'puzzle.nudge.hangingPiece': 'Conte quem ataca e quem defende cada peça do adversário.',
    'hud.opening': 'Abertura: {name}',
    /*
     * The keyboard hint line under the board. One word each, because the line is a reminder rather
     * than a manual -- and because the arrows and WASD both move, which is one fact, not two.
     */
    'keys.move': 'move',
    'keys.select': 'seleciona',
    'keys.cancel': 'cancela',
    'keys.teacher': 'professor',
    'keys.panel': 'muda de painel',
    'keys.sonar': 'sonar',
    'keys.pause': 'pausa',
    'keys.turn': 'gira o tabuleiro',
    'keys.zoom': 'aproxima',
    'hud.language': 'Idioma',
    'hud.lessons': 'Aulas',
    /*
     * ⚠️ OS TÍTULOS SÃO MOLDURA, NÃO PROSA, e por isso moram aqui e não em `i18n/teach/`.
     * O HUD desenha o menu de aulas no arranque, antes de qualquer aula ser aberta — e a prosa é
     * import dinâmico. Verificado no navegador: com os títulos lá, o menu listava
     * `teach.notation.title` onze vezes.
     */
    'teach.notation.title': 'Lendo o tabuleiro',
    'teach.values.title': 'Quanto vale cada peça',
    'teach.pawn.title': 'O peão',
    'teach.rook.title': 'A torre',
    'teach.bishop.title': 'O bispo',
    'teach.knight.title': 'O cavalo',
    'teach.queen.title': 'A dama',
    'teach.king.title': 'O rei',
    'teach.promotion.title': 'A promoção',
    'teach.enpassant.title': 'A captura en passant',
    'teach.castling.title': 'O roque',
    'teach.square.title': 'A regra do quadrado',
    'teach.opposition.title': 'A oposição',
    'teach.book.opera.title': 'A partida da ópera',
    'teach.materook.title': 'Mate com a torre',
    'teach.matequeen.title': 'Mate com a dama',
    'teach.matebishops.title': 'Mate com dois bispos',
    'teach.underpromotion.title': 'Nem sempre a dama',
    'teach.breakthrough.title': 'A ruptura',
    'teach.backrank.title': 'A última linha',
    'teach.knightrim.title': 'Três nem sempre é três',
    'hud.startLesson': 'Começar',
    // ⚠️ O visto vai no TEXTO da opção. Um `<option>` não carrega marca própria que um leitor
    // de tela anuncie, então "aprendida" ou está no nome ou não existe para quem mais precisa
    // saber quais faltam.
    'hud.lessonDone': '{title} ✔',
    'lesson.back': '‹ Anterior',
    'lesson.forward': 'Seguinte ›',
    'lesson.teacher': 'Professor',
    // ⚠️ A razão de estar trancado tem que ser dizível: um controle desativado sem explicação é
    // um controle que não faz nada, e quem não o vê acinzentado só sabe que não está disponível.
    'lesson.teacherLocked': 'Tente três vezes primeiro',
    'pause.title': 'Pausa',
    'pause.resume': 'Voltar ao jogo',
    'pause.leaveLesson': 'Sair da aula',
    'a11y.gridHint': 'Setas navegam, J seleciona',
    'a11y.tookBack': 'Lance desfeito. Vez de {side}',
    'a11y.replayed': 'Lance refeito. Vez de {side}',
    'a11y.nothingToTakeBack': 'Nada a desfazer',
    'a11y.nothingToReplay': 'Nada a refazer',
  },
};
