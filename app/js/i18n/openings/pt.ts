// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/openings/pt — por que alguém joga cada abertura. Português do Brasil, a língua base.
//
// ========================= POR QUE AS FRASES SÃO CURTAS =========================
// Cada uma destas vai também para a leitura em voz alta, como toda string deste repositório. Duas
// ou três frases curtas são um aviso; um parágrafo é uma espera. A primeira frase diz o que a
// abertura FAZ, a segunda por que alguém faria isso, e quando há uma terceira ela é o preço — toda
// abertura tem um, e esconder isso seria ensinar que existe lance sem troco.
//
// ⚠️ OS LANCES ESTÃO EM NOTAÇÃO INGLESA (`Nf3`, `Bb5`) de propósito, e não por desleixo: é o que a
// lista de lances do painel imprime, vinda do `chess.js`. Escrever `Cf3` aqui mandaria a criança
// procurar um lance que não existe na tela. O raciocínio completo está em `i18n/openings/index.ts`.

import type { OpeningStrings } from './index.ts';

export const pt: OpeningStrings = {
  /* ---------------- 1.e4 e5 ---------------- */
  'opening.kingpawn':
    'O peão do rei abre caminho para o bispo e para a rainha de uma vez, e é por isso que 1.e4 é o '
    + 'primeiro lance mais jogado da história. Quem joga assim quer as peças na rua depressa.',
  'opening.italian':
    'O bispo vai para c4 e aponta direto para f7, a casa mais fraca do início. É a abertura mais '
    + 'antiga que ainda se joga em torneio, e a melhor para aprender: tudo que acontece nela é '
    + 'visível. Em troca, o adversário sabe exatamente o que esperar.',
  'opening.ruylopez':
    'O bispo vai para b5 e ataca o cavalo que defende o peão de e5. Não é para ganhar o peão agora '
    + '— é para incomodar o defensor dele pelo resto da partida. Chamam de «a abertura espanhola», '
    + 'e é a favorita dos campeões há quatrocentos anos.',
  'opening.fourknights':
    'Os quatro cavalos saem antes de qualquer outra coisa. É simétrico, é sólido e quase não tem '
    + 'armadilha: quem está aprendendo consegue entender cada lance. Partidas assim se decidem mais '
    + 'tarde, no meio-jogo, e não na abertura.',
  'opening.scotch':
    'As brancas abrem o centro no terceiro lance com d4 e trocam logo o peão. O tabuleiro fica '
    + 'aberto e as peças ganham espaço, mas a rainha costuma sair cedo e quem sai cedo leva susto.',
  'opening.vienna':
    'O cavalo vai para c3 primeiro, guardando a ideia de empurrar f4 depois. É uma maneira calma de '
    + 'preparar um ataque violento, e por isso engana: parece devagar e não é.',
  'opening.bishops':
    'O bispo mira f7 no segundo lance, antes de qualquer cavalo. É direto e dá às brancas muitos '
    + 'caminhos possíveis. O preço é que o centro fica sem apoio por alguns lances.',
  'opening.center':
    'As brancas abrem o centro imediatamente e aceitam tirar a rainha para recapturar. Ganha-se '
    + 'tempo e espaço; perde-se a tranquilidade, porque a rainha exposta vira alvo dos cavalos.',
  'opening.kgaccepted':
    'As brancas ofereceram o peão de f2 e as pretas aceitaram. Agora as brancas têm o centro e uma '
    + 'coluna aberta para a torre, e as pretas têm um peão a mais e um rei com menos abrigo. É a '
    + 'abertura mais romântica do século dezenove, e a mais perigosa para os dois lados.',
  'opening.kgdeclined':
    'As pretas recusaram o peão e preferiram segurar o centro. É a resposta madura: quem não aceita '
    + 'o presente não precisa devolver depois. A partida fica menos selvagem e mais longa.',
  'opening.petrov':
    'As pretas respondem atacando em vez de defender: o cavalo vai para f6 e cobra o peão de e4. '
    + 'Trocar no centro simplifica tudo, o que é ótimo para quem está atrás no relógio e chato para '
    + 'quem queria uma partida complicada.',
  'opening.philidor':
    'As pretas defendem o peão de e5 com d6, de peão. É sólido e foi a recomendação de Philidor, o '
    + 'primeiro grande teórico do jogo. O defeito é o espaço: o bispo de f8 fica preso atrás do '
    + 'próprio peão por um bom tempo.',

  /* ---------------- 1.e4, respondido de outra maneira ---------------- */
  'opening.sicilian':
    'As pretas não respondem no centro: jogam c5, de lado, e já ameaçam trocar um peão de flanco por '
    + 'um peão do centro. É a defesa mais jogada do mundo porque não procura empate — procura '
    + 'desequilíbrio. Em troca, o rei preto demora mais para ficar seguro.',
  'opening.french':
    'As pretas preparam d5 com e6 e aceitam que o bispo de c8 fique trancado por enquanto. A troca é '
    + 'clara: menos espaço agora, uma estrutura muito difícil de quebrar depois. Quem gosta de '
    + 'defender adora esta defesa.',
  'opening.carokann':
    'Mesma ideia da francesa — chegar a d5 — mas preparada com c6, e assim o bispo de c8 continua '
    + 'livre. É a escolha de quem quer solidez sem pagar com uma peça presa. O custo é tempo: c6 não '
    + 'desenvolve nenhuma peça.',
  'opening.scandinavian':
    'As pretas vão a d5 no primeiro lance e trocam no centro imediatamente. É fácil de aprender e '
    + 'não tem variantes para decorar. Mas a rainha preta sai muito cedo, e as brancas ganham '
    + 'tempos atacando ela.',
  'opening.alekhine':
    'O cavalo vai para f6 logo, convidando os peões brancos a persegui-lo. A ideia é deixar as '
    + 'brancas avançarem demais e depois atacar essa parede de peões por baixo. É uma aposta: se a '
    + 'parede aguentar, as pretas ficam sem espaço.',
  'opening.pirc':
    'As pretas entregam o centro de propósito e constroem uma casa para o rei com g6 e o bispo em '
    + 'g7. Esse bispo olha para o tabuleiro inteiro pela diagonal grande. O risco é conhecido: se o '
    + 'contra-ataque não vier, sobra só o aperto.',
  'opening.modern':
    'A mesma ideia da Pirc, mas sem compromisso: g6 primeiro, e o cavalo decide depois onde fica. '
    + 'Dá flexibilidade máxima às pretas e também a maior liberdade às brancas no centro.',

  /* ---------------- 1.d4 ---------------- */
  'opening.queenpawn':
    'O peão da rainha avança já protegido pela própria rainha, e é essa a diferença entre 1.d4 e '
    + '1.e4. As partidas tendem a ser mais fechadas e a se decidir por planos, não por táticas '
    + 'imediatas.',
  'opening.qgd':
    'As brancas oferecem o peão de c4 e as pretas recusam, sustentando d5 com e6. É a abertura das '
    + 'partidas de campeonato do mundo: pouca sorte, muito plano. O bispo de c8 paga a conta, como '
    + 'na francesa.',
  'opening.qga':
    'As pretas pegam o peão de c4, sabendo que não vão ficar com ele. O lucro é outro: elas trocam '
    + 'um peão do centro por liberdade para as peças. Quem joga assim aceita ficar com menos centro '
    + 'em nome de não ficar apertado.',
  'opening.slav':
    'As pretas seguram d5 com c6 em vez de e6, e assim o bispo de c8 sai pela casa f5 ou g4. É a '
    + 'maneira sólida de enfrentar o gambito da rainha sem trancar nada. O preço é que o peão de c6 '
    + 'ocupa a casa do próprio cavalo.',
  'opening.semislav':
    'As pretas jogam c6 E e6, pegando o melhor dos dois mundos e também o pior: a estrutura fica '
    + 'muito firme, e o bispo de c8 fica muito preso. Daqui saem algumas das posições mais difíceis '
    + 'e mais estudadas do xadrez.',
  'opening.nimzo':
    'O bispo vai para b4 e prende o cavalo de c3, o cavalo que as brancas precisam para empurrar e4. '
    + 'É a defesa mais respeitada contra 1.d4 — ela não disputa o centro com peões, disputa com '
    + 'peças. As pretas costumam entregar esse bispo pelo cavalo, e isso é parte do plano.',
  'opening.kingsindian':
    'As pretas deixam as brancas tomarem o centro, abrigam o rei com g6 e o bispo em g7, e só depois '
    + 'batem com e5 ou c5. É contra-ataque puro, e é a abertura favorita de quem joga para ganhar. '
    + 'Também é a que mais castiga quem não sabe o plano.',
  'opening.queensindian':
    'As pretas põem o bispo em b7 e passam a vigiar o centro pela diagonal grande, de longe. É '
    + 'sólido, flexível e quase impossível de atacar cedo. Em compensação, dá empate com facilidade.',
  'opening.grunfeld':
    'As pretas respondem no centro com d5 e convidam as brancas a tomar tudo com peões. A ideia é '
    + 'que essa parede branca enorme também é um alvo enorme, e será atacada pelos lados. Precisa de '
    + 'coragem e de precisão.',
  'opening.benoni':
    'As pretas enfrentam d4 com c5, de lado, e aceitam ficar com menos espaço em troca de uma coluna '
    + 'aberta e de um avanço com e5 ou b5 mais tarde. É afiada: dá partidas decisivas e poucos '
    + 'empates.',
  'opening.dutch':
    'As pretas jogam f5 e apontam para o lado do rei branco desde o primeiro lance. É agressivo e '
    + 'raro. O preço é imediato e permanente: a casa e6 e a diagonal do próprio rei ficam mais '
    + 'fracas para sempre.',

  /* ---------------- sem peão central no primeiro lance ---------------- */
  'opening.english':
    'As brancas começam pelo flanco com c4 e combatem o centro de longe. Dá para transformar isso em '
    + 'quase qualquer outra abertura depois, e é por isso que tantos campeões a usam: ela esconde o '
    + 'plano.',
  'opening.reti':
    'O cavalo sai antes de qualquer peão central, e as brancas decidem o centro só depois de ver o '
    + 'que as pretas fazem. É a ideia que mudou o xadrez nos anos vinte: ocupar o centro com peças '
    + 'em vez de peões.',
};
