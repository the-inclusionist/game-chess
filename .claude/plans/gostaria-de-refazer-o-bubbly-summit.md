# Modo de ensino e modo livro — `the-inclusionist/game-chess`

> **O plano anterior está concluído.** Refazer `juliangarnier/3D-Hartwig-chess-set`
> em Zdog + Three.js, sobre a engine Inclusionist, foi executado: três vistas
> jogáveis, 534 testes, seis desenhos de peças históricos, alto contraste resolvido
> numericamente. O registro está nos commits e em `docs/`. O texto abaixo do
> separador preserva aquele plano como histórico; **o plano vivo é este**.

## Contexto

O jogo hoje ensina a *jogar* — tem oponente, dicas, modo protegido e anotação
automática de lances. Não ensina *xadrez*. Uma criança que abre o tabuleiro pela
primeira vez não sabe como o cavalo anda, não sabe o que é roque, e — o mais
imediato — **não consegue ler as próprias instruções do jogo**: a dica diz "Mova o
Cavalo para f3" para quem nunca ouviu falar em f3.

Este plano acrescenta duas coisas:

1. **Modo de ensino** — aulas guiadas: valor das peças, movimento de cada uma,
   regras especiais (roque, *en passant*, promoção) e **notação algébrica**.
2. **Modo livro** — estudo acompanhado de obras em domínio público e de bancos de
   exercícios livres (Lichess, CC0).

Resultado pretendido: o mesmo tabuleiro, a mesma pilha de acessibilidade e o mesmo
motor servem tanto para jogar quanto para aprender, sem uma segunda aplicação.

---

## ⚠️ Verificação de domínio público — o que se sustenta e o que não

Feita em 2026-09-06. **Não é parecer jurídico**; é a mesma diligência que
`docs/LICENSES.md` já pratica para o desenho de Hartwig, e deve passar pela mesma
revisão do Município antes de publicação.

Critério: **Brasil, Lei 9.610/1998 art. 41 — vida do autor + 70 anos**, contados de
1º de janeiro do ano seguinte à morte. Tradução é obra derivada com prazo próprio,
contado da morte do **tradutor** (art. 7º §3º). Usar o original elimina esse
segundo prazo — mas não ajuda quando o autor original ainda está protegido.

| Obra | Autor † | PD no Brasil | Observação |
|---|---|---|---|
| Philidor, *Analyse du jeu des Échecs* / *Studies of Chess* | 1795 | ✅ | PG 78804; tradução inglesa de 1803, tradutor também PD |
| Ruy López de Segura, *Libro de la invención liberal…* (1561) | 1580 | ✅ | Digitalizado (Internet Archive, LoC). Espanhol do séc. XVI — valor **histórico**, não didático |
| Staunton, *The Blue Book of Chess* | 1874 | ✅ | PG 16377 |
| Bird, *Chess History and Reminiscences* | 1908 | ✅ | PG 4902 — matéria-prima do módulo de história |
| Edge, *Paul Morphy* | 1882 | ✅ | PG 34180 |
| Young, *Chess Generalship* | 1931 | ✅ | PG 55278 |
| Capablanca, *Chess Fundamentals* (1921) | 1942 | ✅ desde 2013 | PG 33870. **Escrito em inglês pelo próprio autor** — sem camada de tradutor |
| Tarrasch, *Das Schachspiel* (1931) | 1934 | ✅ desde 2005 — **só o alemão** | A tradução inglesa (1935) é de G. E. Smith e T. G. Bone, prazo próprio, e **não está no Gutenberg**. Usável só traduzindo nós do alemão |
| Em. Lasker, *Lehrbuch des Schachspiels* (1925) | 1941 | ✅ desde 2012 — **só o alemão** | A edição inglesa de 1947 é editada por Fred Reinfeld († 1964 → 2035) |
| **Ed. Lasker, *Chess Strategy* (1915)** | **1981** | ❌ **até 2052** | **Não usar.** Não é o campeão mundial — é outro Lasker. Escreveu em inglês, então o idioma original não salva. Está no Gutenberg porque os EUA usam publicação+95 para obras anteriores a 1929. O mesmo vale para *Chess and Checkers* (PG 4913) |
| Fishburne, *Checkmates for Three/Four Pieces* | vivo | ⚠️ parcial | PG 4542 / 4656. O conteúdo é **lista de FEN**, e posição de xadrez é fato, não expressão — segura como dado. A **seleção e ordem** do livro é que podem ter proteção de compilação: extrair posições, nunca copiar o conjunto em bloco |
| **Lichess** — 6.057.356 puzzles, 394M avaliações, PGN mensais | — | ✅ **CC0** | `database.lichess.org`. Sem condição alguma, compatível com AGPL |
| `lichess-org/chess-openings` — 3.500 aberturas em TSV | — | ✅ **CC0-1.0** | Verificado pela API do GitHub |
| chess.com — despejo em massa | — | ❌ | **Não existe.** A Published-Data API é por jogador, sem licença aberta, e o próprio texto pede respeito à PI deles |

**Dois princípios que atravessam tudo isto:**

- **Lance é fato; comentário é expressão.** O PGN de Capablanca–Marshall 1918 pode
  vir de qualquer lugar. O que exigia Capablanca em domínio público são as *notas*
  dele. Isso desanuvia todo o material de partidas.
- **Nossa tradução é nossa.** pt-BR e es de textos ingleses são obra derivada que
  *nós* criamos e licenciamos em AGPL. Custo de produção, não impedimento legal.

**Sem fonte em domínio público:** não foi encontrado clássico de xadrez em
**português**. Para pt-BR o texto didático nasce nosso. Para **espanhol**, o único
material PD é Ruy López (1561) — histórico, não didático.

⚠️ **Henrique Mecking está vivo.** Fatos biográficos e partidas não são
protegidos; o texto de qualquer biografia e as fotografias são. Escrever do zero,
sem imagem sem licença.

---

## Decisões tomadas com o usuário (2026-09-06)

| Questão | Decisão |
|---|---|
| Onde o modo mora | **Extrair o núcleo comum das três raízes primeiro**, e o modo entra uma vez |
| Primeira etapa | **Regras elementares + notação algébrica** |
| Dados de exercício | **Subconjunto curado versionado no repositório**, gerado por script reproduzível |
| Idiomas do livro | **Inglês verbatim + tradução nossa** para pt-BR e es |

---

## Etapa 0 — Extrair o núcleo comum das três raízes ✅ CONCLUÍDA (2026-09-06)

> Seis itens, seis commits, **553 testes**. `main.ts` 1.103 → 35, `main-2d.ts` 661 → 45,
> `main-3d.ts` 610 → 35, contra 733 linhas de invólucro e 760 nas três vistas.
> Cinco defeitos que só existiam por a fiação estar escrita três vezes foram
> corrigidos no caminho: `6a317f5` oponente morto no 3D · `3f962e6` ajuste de uma
> vista apagando o de outra · `defd1aa` anúncio em SAN cru · `1af4a4d` os quatro
> desvios de acessibilidade da raiz sólida · `3bdce5e` `playerSide` nunca passado.
> Peso final contra a linha de base: `2d.html` **−0,16%**, `index.html` +0,25%,
> `3d.html` +0,20%.
>
> **Etapa 1 — passos 1 a 5 ✅ CONCLUÍDOS** (2026-09-06), **621 testes**.
> `77df279` o vocabulário · `dd19c5c` as onze aulas + o teste que as rededuz ·
> `071c888` os três catálogos + `I18n.extend()` · `078d9a0` o tutor ·
> `7841e35` `Progress` em canal durável.
>
> **Depois do passo 4 a Etapa 1 está funcionalmente completa e inteiramente
> testada, com zero trabalho de renderização feito** — que era a aposta do modelo
> de dados, e ela se pagou. Quatro defeitos que só apareceram porque os testes
> foram escritos: a segunda etapa do cavalo listava as casas de d5 estando em d4;
> **quatro das onze aulas eram injogáveis** (rei sozinho, rei+bispo e rei+cavalo
> são material insuficiente, então `isGameOver()` já era verdade e `activate()`
> recusava tudo com `ignored/over`); uma tarefa `mark` pode virar LANCE, porque as
> casas a marcar são exatamente as casas para onde a peça pega vai; e `pick` tem
> tabuleiro por baixo, onde uma criança empurra um peão enquanto lê.
>
> **Passo 6 ✅ CONCLUÍDO** — `a1b8422`, **634 testes**. ⚠️ **O requisito de
> contraste do plano era impossível:** nenhuma cor faz 3:1 contra `#DCD6C8` (exige
> luminância ≤ 0,193) *e* contra o `#5A5A5A` do alto contraste (exige ≥ 0,407, ou
> ≤ 0,0007, que é preto). Sem interseção — é a mesma parede do `HINT_RAMP`, vinda
> do outro lado. A fronteira passou a ser um **halo preto** (14,50 · 5,81 · 9,14 ·
> 3,04 no pior caso) e o âmbar só precisa ler contra o halo (11,70). E a mesma
> medição diz que **os cinco marcadores existentes não fazem 3:1 contra casa
> escura nenhuma** — 1,38 / 1,13 / 1,20 / 1,37 / 1,21. Registrado em `palette.ts`
> como dívida do jogo, sem teste que a fixe.
>
> **`a2c1ebf` — mudança quebrada da engine, absorvida.** Outra sessão publicou
> `topology()` como método (ADR-0084) e `world()` obrigatório (ADR-0087), citando
> `game-chess` pelo nome. O mundo aqui é `#game-region` inteiro, não a canvas: a
> página plana não tem canvas nenhuma, e nas outras duas o HUD e a lista de lances
> são DOM ao lado dela.
>
> **Passo 7 ✅ CONCLUÍDO** — `362ba82`, **652 testes**. O painel é definido pelo
> que RECUSA fazer: nada de `alertdialog`, nada de roubar foco (exceto num `pick`,
> onde a resposta não está no tabuleiro), nada de `aria-live` no texto do passo (o
> invólucro já o diz por `srSay`), e nada nunca em `#sr-alert`. ⚠️ **Um defeito
> real:** a primeira versão reconstruía os botões a cada desenho, então mostrar a
> dica após um erro **removia o botão que tinha o foco** e o navegador jogava o
> foco no `<body>` — quem respondia de teclado era expulso do painel, em silêncio.
> Não chamar `.focus()` e não destruir o foco são promessas diferentes.
>
> **Passo 8 ✅ CONCLUÍDO** — `af0157e` (acessores), `85c27ab` (`newGame`,
> `setTaught`, a guarda do `saveGame`), `dee0cf8` (`boot/lesson-mode.ts`, que junta
> tudo). **672 testes.** A ordem de construção da Etapa 1 está inteira.
>
> Defeitos reais encontrados ao escrever, não ao ler: `newGame()` sem FEN dava
> **tabuleiro novo em vez do jogo do jogador**, então sair de uma aula descartava a
> partida em curso; o conjunto `taught` vivia em **dois lugares** e `newGame`
> limpava só um, deixando a marca do passo anterior no tabuleiro plano; e a aula
> **terminava sumindo** — `view()` precisa de um passo e `tutor.step()` é nulo no
> fim, então o estado "concluída" virava `panel.show(null)`. A metade falada
> continuava certa, então só quem olhava para a tela perceberia.
>
> **A PORTA ✅** — `3bc852c`, **673 testes**. Select de aulas + botão no HUD, nas
> duas páginas que sabem desenhar marca de aula; `3d.html` não recebe as deps e o
> controlo não existe lá. Painel, tutor e driver são import dinâmico
> (`lesson-panel` 1,96 kB · `lesson-mode` 3,31 kB · prosa pt 5,55 kB); só a TABELA
> é estática, porque o menu lista onze nomes no arranque — **+2,0 kB comprimidos**
> no pedaço partilhado, medido e registado.
>
> ⚠️ **Dois defeitos, nenhum apanhado por teste.** `boot.browser.test.ts` apanhou
> um `ReferenceError` de zona morta temporal — a terceira vez neste repo, e três
> edições depois de eu ter escrito um comentário sobre as duas anteriores.
> E **olhar para a página a correr** apanhou o outro: o menu listava
> `teach.notation.title` onze vezes, porque os TÍTULOS estavam do lado errado da
> divisão prosa/moldura. Teste nenhum apanharia: todo teste carrega a prosa
> primeiro, porque quem o escreve sabe que ela existe.
>
> **Etapa 1 CONCLUÍDA.** Verificado em `2d.html` contra o `dist/`: menu com
> títulos reais, aula abre, setas andam com o foco no tabuleiro, activação avança
> o passo, `#sr-alert` nunca escrito. ⚠️ **Entrada de teclado real ao nível do SO
> não pôde ser exercitada** — o painel do navegador reporta `innerHeight: 0`, a
> mesma limitação de painel recolhido já documentada quando o tabuleiro 3D saiu
> preto. A activação foi feita pelo `click()` da própria célula, que é o que um
> Enter real num `<button>` faz nativamente.
>
> **Etapa 2 — dados ✅** (`d930832`, **685 testes**). 200 puzzles, 40 por tema,
> 439–1100. ⚠️ **A armadilha do plano era real e o teste que a resolve não é
> nenhum dos óbvios:** as verificações de consistência passariam igualmente com
> um ply de desvio — posição legal, lances legais, lados alternados. O que a
> fixa é exigir que um `mateIn1` seja mate depois de UM lance. Oitenta puzzles de
> mate, todos mate no ply que declaram.
>
> ⚠️ Duas surpresas do dump, registadas em `docs/LICENSES.md`: ele **abre com um
> *skippable frame* de zstd** que o descompressor do Node recusa
> (`ZSTD_error_prefix_unknown`) num ficheiro que o `zstd` de linha de comando lê
> sem comentar; e o ficheiro entregue hoje vem de um **prefixo de 32 MB** dos 304,
> com `--allow-truncated` explícito e o campo `sampled` a dizê-lo.
>
> ---
>
> ## REDESENHO PEDIDO PELO USUÁRIO (2026-09-06) — ✅ CONCLUÍDO, **733 testes**
>
> Sete itens, todos verificados no navegador contra o `dist/`:
>
> · `18e1e35` **casa tocada responde azul/vermelho** e segura 800 ms antes de
>   avançar. ⚠️ Azul e vermelho medem **1,06:1** um contra o outro — medido antes
>   de escolher —, então a FORMA carrega: certo é quadrado cheio, errado é anel
>   vazado, e o rótulo diz «certo»/«errado».
> · `6d08745` **`teach/position.ts`**: voltar um passo REPRODUZ os lances, porque
>   o atalho (repor o último FEN) passaria hoje e quebraria em silêncio na
>   primeira aula com dois lances seguidos.
> · `f881d4f` **menu lateral próprio** (lista real, não dropdown), **professor
>   como toggle travado até três erros** — a trava mora no MODO, não no
>   `disabled` —, e **START abre o menu de pausa**, que é por onde se sai.
>   ⚠️ Nem todo `show` é dica: `show.squares` É a pergunta (a aula de notação
>   pergunta «que casa é esta?»), então o professor só destranca as SETAS.
> · `32d5227` **as seis opções de exibição** saíram do painel para a pausa —
>   movidas, não copiadas: o HUD ainda as constrói e atualiza.
>   ⚠️ **Foram SETE, e a sétima voltou a 2026-09-11 (`d84c045`).** O mesmo commit
>   levou também o seletor de vista (2D / 2,5D / 3D), pelo mesmo argumento — coisas
>   que se escolhem uma vez. O Dev reportou os três botões como sumidos: não
>   estavam partidos, estavam arquivados atrás de um menu que só abre com uma
>   tecla, o que dá no mesmo. Voltaram para a coluna lateral, **debaixo da barra de
>   acessibilidade** e como irmãos do painel, não filhos — logo uma aula não os
>   leva com ela. As outras seis ficam na pausa: a diferença não é a frequência com
>   que se tocam, é o que fazem — mudar de vista é olhar para a mesma posição de
>   outra maneira, mais perto do sonar do que de uma preferência de cor.
> · `f02da15` **JOGAR / APRENDER** na tela inicial. APRENDER retoma onde parou.
> · `724b61b` **action1–4**. ⚠️ `action2` precisa de `preventDefault`: o motor liga
>   Space a `action2` E o `<button>` ativa nativamente — sem isso todo Space
>   jogava DUAS vezes. E `action4` focava um botão **desativado**.
> · `047bd20` **a aula mudou-se para a coluna da direita** (decisão sua, e melhor
>   que as três opções que ofereci): sem terceiro painel, sem os 157 px que ele
>   tirava da altura do tabuleiro.
> · `21e368b` + `6e890c4` **o palco 2:1**. `#stage` = 1080×540 (razão 2,000),
>   `#game-region` = só o tabuleiro, `#side-column` = 440 px — **era 176**.
>   ⚠️ O piso é k=3 e não o k=2 pedido: o tabuleiro é 640×360 lógico e escala em
>   números inteiros, então sobram 80 px de um palco de 720. E ⚠️ `CAMERA.offsetX`
>   era **-96,6 pixels de dispositivo** (−42 × zoom 2,3) — deslocamento
>   FRACIONÁRIO, que suavizava toda aresta num renderizador cujo ponto é não
>   suavizar. A zero, o raster cai em pixels inteiros; mudou a razão traço/preenchimento
>   das seis peças, e é assim que foi notado.
> · `world()` passou de `#game-region` para `#stage`, e **tinha de passar**: com o
>   painel fora da região, uma cegueira simulada apagaria o tabuleiro e deixaria a
>   lista de lances legível — o defeito exato do ADR-0087.
>
> ---
>
> **Próximo: o MODO de puzzle (Etapa 2).** Os dados estão prontos e validados. O
> driver de aula já é quase a forma certa — um puzzle é um passo com FEN e
> objetivo `play` — mas há três escolhas de desenho que são do usuário, e o plano
> diz «não desenhar agora» para as etapas 2+:
>
> 1. O adversário responde sozinho entre os lances do aluno, ou o aluno joga os
>    dois lados?
> 2. Lance errado: desfaz-se como numa aula, ou recomeça o puzzle?
> 3. A entrada mora onde? (Agora que existe o padrão lista-na-coluna, o natural
>    seria uma segunda seção ao lado das aulas.)
>
> ---
>
> **Etapas 2, 4 e 5 concluídas; Etapa 3 tem o MECANISMO, e falta só o conteúdo.**
> **811 testes.** `1e5e7e9` o canal de marcadores do 3D (a dívida mais antiga do
> plano) · `4345f66` a linha de teclas · `c6c5d7a` o benchmark · `afb0202` o README
> · `a2d488b` os acentos · `1d572f2` o modo livro.
>
> **`1d572f2` — o modo livro.** O plano escreveu este módulo numa frase e ela foi
> tomada ao pé da letra. Três decisões, todas registradas no arquivo: **só os
> lances comentados viram passos** (o livro É a escolha do anotador de onde parar;
> os lances entre duas notas dobram-se no FEN do passo seguinte); **não há campo
> `side`** (estuda-se um livro jogando os dois lados — um puzzle precisa de
> adversário porque a posição é um problema posto a um lado, um livro não tem
> adversário, tem partida); e **os comentários são chaves i18n**, sob `teach.`,
> porque o prefixo significa «isto está na prosa de import dinâmico» e uma lista de
> namespaces permitidos é o tipo de verificação que se alarga até não valer nada.
>
> ⚠️ **`rulesFromPgn`, `positions()`, `commentAt()` e a correção do `reviewer.ts`
> não tinham consumidor nenhum.** Metade da Etapa 3 estava no código sem fazer
> nada, e é isso que este commit termina. Falta o CONTEÚDO: Capablanca está livre
> (morreu em 1942, PD no Brasil desde 2013, escreveu em inglês) e à espera de uma
> decisão editorial — quais capítulos, e quem escreve o pt-BR e o es ao lado do
> inglês dele. `gameLesson()` recebe as partidas dele sem mudar uma linha.
>
> **Setima volta — 876 testes. ✅ A DECISAO EDITORIAL FOI TOMADA e a Etapa 3 comecou.**
>
> Escopo: **o livro inteiro, dividido em sessoes**; as tres linguas escritas por mim.
>
> ⚠️ **O CURRICULO E DELE E A PROSA E NOSSA**, e isso e decisao e nao atalho. Duas
> das tres linguas sempre foram nossas — nao existe classico de xadrez em portugues,
> entao pt-BR e es eram obra nova de qualquer forma. O ingles junta-se por dois
> motivos que apontam ao mesmo lado: uma explicacao de 1921 dirigida a um adulto nao
> e a frase de que uma crianca precisa, e cada string aqui e lida em voz alta; e as
> POSICOES e a tecnica sao factos — ninguem e dono da observacao de que rei e torre
> dao mate cortando o rei linha a linha, tal como ninguem e dono da regra do
> quadrado. **Isto nao e uma transcricao e nao pode ser descrito como tal.**
>
> ⚠️ **E um achado pratico que moldou o acima:** duas tentativas de obter o texto
> verbatim do livro pela ferramenta daqui foram recusadas por «direitos de autor» —
> erradamente, porque a obra e de dominio publico, mas o efeito e o mesmo. Registado
> para ninguem planear trabalho a assumir que o texto original esta a mao.
>
> **Feito nesta sessao:** Capitulo I §1, os mates elementares — torre e dama.
> `teach/fundamentals.ts` e fronteira de FONTE e nao segundo mecanismo: e espalhado
> na tabela unica `LESSONS`, entao `syllabus()`, `lessonIndex`, a coluna, o teste de
> alcance e o teste de tabela recebem-no sem saber de onde veio.
>
> ⚠️ **As afirmacoes sao re-derivadas, nao acreditadas.** Eu fiz estas posicoes a
> mao, que e exatamente a razao para nao acreditar em mim: o teste pergunta as
> regras se cada mate e mate e nao apenas xeque — uma crianca a quem se diz «de o
> mate», que da xeque e e elogiada, aprendeu a palavra errada para o resto da vida —
> e se Dg6 na licao da dama e mesmo afogamento, que e a resposta do `pick` e portanto
> o unico numero num curriculo que pode ser mal escrito e passar tudo.
>
> **Ordem de execucao.** Parte I sao 6 capitulos e 33 secoes, que viram LICOES;
> Parte II sao 14 partidas anotadas, que caem direto no `gameLesson()`.
>
> ✅ **§1 Mates elementares** (torre, dama, dois bispos) · ✅ **§2 Promocao** (a metade
> verificavel: nem sempre a dama) · ✅ **§3 Finais de Peao** (a ruptura, que e forcada
> e portanto conferivel) · ✅ **§4 Meio-jogo** (a ultima linha — escolhida por ser o
> unico padrao que as cinco tematicas de tatica NAO cobrem, e por ter defesa) ·
> ✅ **§5 Valor relativo** (tres nem sempre e tres: o cavalo alcanca 2 casas no canto,
> 6 um lance depois, 8 no meio — ⚠️ escolhido DEPOIS de ler `values` e `knight` e ver
> que a tabela de pontos e o alcance central ja estavam cobertos).
>
> ⚠️ **A LINHA QUE SE APRENDEU A NAO CRUZAR:** o `chess.js` resolve legalidade, mate
> e afogamento; **nao** resolve «este final esta ganho», e a nossa busca tambem nao a
> profundidade nenhuma que uma licao possa esperar. Por isso §2 e §3 ensinam a parte
> que e um FACTO sobre a posicao a frente, e as ideias que decidem esses finais — a
> regra do quadrado e a oposicao — ja vinham geradas pela geometria.
>
> **A seguir:** §6 Estrategia geral da abertura, §7 Controlo do centro, §8 Armadilhas.
> Capitulo I vai em 5 de 8.
>
> ⚠️ **Conferir sobreposicao ANTES de escrever** continua a ser a regra: foi assim que
> o §5 deixou de ser a tabela de pontos outra vez. §6 e §7 correm o mesmo risco entre
> si — «desenvolver» e «controlar o centro» sao a mesma frase dita duas vezes se nao
> se decidir o que cada um ensina.

> **Sexta volta — 864 testes, tres corridas completas verdes.** A varredura de
> modulos sem teste desceu de dez para sete, e os sete restantes ou sao
> exercitados pelo invólucro (as duas vistas, o menu de licao, o placar, o
> «pensando») ou nao tem o que testar (`protection.ts` e uma constante; `zdog.d.ts`
> e uma declaracao de tipos).
>
> **A contagem de pecas capturadas** — como uma crianca responde «estou ganhando?»
> antes de saber ler uma avaliacao. A afirmacao que valia a pena verificar e que a
> lista e DERIVADA do historico e nao mantida a parte, entao desfazer um lance
> corrige-a de graca; um teste so para a frente nunca chega a essa metade da frase.
> Os dois casos onde uma contagem costuma estar errada estao la: **en passant** (o
> peao capturado nao esta na casa onde o outro aterra) e **peca promovida
> capturada** (partiu peao e morre dama).
> ⚠️ **Dois desses testes nao testavam o que diziam** antes de eu os reescrever: o
> da ordenacao construia uma posicao, ignorava-a, e afirmava que uma dama capturada
> voltava como uma dama capturada — o que e verdade sem ordenacao nenhuma.
>
> **A barra de download** que voce pediu por palavras suas. O `preload.ts` recebe um
> `fetcher` injetavel que existe exatamente para isto, e ninguem tinha passado por
> essa costura. Uma barra de progresso e so casos extremos: um `content-length` com
> que um proxy discorda (sem o limite, a barra passa do proprio fim), um HEAD que
> nao responde (cada fracao seria divisao por zero) e um fetch que rebenta (a
> promessa TEM de resolver, porque ha um botao desativado atras dela).
>
> Todos verificados por mutacao, nao por passarem.

> **Quinta volta — 848 testes.** Dois modulos nao eram importados por teste nenhum
> — uma varredura das 78 fontes contra a suite encontrou dez, e oito dessas sao
> exercitadas pelo invólucro. Os dois que nao eram sao os que mais custam.
>
> `592354e` **O menu de pausa.** As duas metades estavam bem testadas em separado —
> o `hud.browser.test.ts` monta o `hud.settings` ele proprio, o
> `pause-menu.browser.test.ts` constroi um dialogo de fixture — e as duas passam com
> o invólucro nunca a por uma dentro da outra. O sintoma seria um menu de pausa com
> nada la dentro a nao ser a saida, que e o que a build parecia ANTES da mudanca.
> ⚠️ E a primeira falha foi da fixture, nao do codigo: o `fakeView` nao fornecia o
> conjunto de pecas, que e da VISTA.
>
> `f52c4a3` **`ui/layout.ts` nao tinha teste nenhum** — e carrega o numero que voce
> pediu duas vezes (multiplos inteiros de 360x180) e a invariante de pixel art
> (ADR-001: um pixel de origem e um numero inteiro de pixels FISICOS). Doze testes,
> varrendo a viewport de 700 a 2400 e cinco racios de pixel incluindo 1,25 e 1,5 que
> esta maquina nao produz.
>
> `?` **As setas de dica** — a unica geometria que as tres vistas partilham, e agora
> tambem a resposta do professor em cada licao e em cada passo de livro.
> ⚠️ **Uma mutacao sobreviveu a primeira versao do teste:** negar o recuo da cauda,
> pondo a seta a sair pelas COSTAS da peca, passava os onze testes — a asercao
> perguntava a que DISTANCIA a cauda estava da origem, e distancia nao tem direcao.
> A propriedade que eu queria era «o corpo assenta no segmento», que precisa da
> projecao e do sinal dela.

> **Quarta volta — 821 testes.** Continuando pela mesma pergunta, e desta vez ela
> apanhou uma falha de acessibilidade a serio.
>
> `01e113a` A lista de aulas era a **outra metade da mesma chaveta** do commit
> anterior — `deps.lessons` e `deps.onHint` sao independentes, um hot seat tem
> curso e nao tem motor — e so a abertura tinha teste. Os dois foram verificados
> contra o HUD de antes da correcao: dois vermelhos.
>
> `a68bb7e` ⚠️ **AS TECLAS DE CAMERA QUE A LINHA DE DICAS PROMETE NUNCA CHEGAVAM A
> CAMERA NENHUMA.** «⇧ + WASD gira o tabuleiro» esta impresso debaixo do tabuleiro
> nas duas vistas que tem camera. O `grid-mirror.handleKey` nao olhava para
> modificadores, entao a engine resolvia `Shift+ArrowLeft` para o intent `left`
> tal como uma seta nua: o cursor andava, a funcao devolvia true, e o invólucro —
> que so oferece a vista aquilo que mais ninguem quis — parava ali. Dois gestos,
> um deles a fazer o trabalho do outro.
>
> ⚠️ **E A VISTA SOLIDA NAO TINHA CAMERA DE TECLADO NENHUMA.** Orbita com arrasto e
> aproxima com roda, e nada disso tinha equivalente alcancavel do teclado — falha
> lisa de WCAG 2.1.1 na única vista cujo argumento de venda e poder andar a volta
> do tabuleiro, e o item 4 da propria lista de verificacao deste plano diz «o que o
> ponteiro faz, uma tecla faz». A vista projetada tinha a sua metade desde que a
> camera foi escrita; esta recebeu a do ponteiro e nunca a outra.
>
> ⚠️ **E a primeira versao da correcao partiu um atalho enquanto consertava outro:**
> como early return, a guarda de modificadores levava o `Ctrl+Home` e o `Ctrl+End`
> — o salto para o canto — que leem `ctrlKey` de proposito trinta linhas abaixo. A
> suíte existente apanhou, que e o argumento inteiro para a ter.

> **Terceira volta — 817 testes, e a mais produtiva das tres.** A pergunta que
> continua a pagar e «que metade desta funcionalidade nao foi implantada?».
>
> `fc573a2` **APRENDER so retomava o curso.** `rememberPlace` grava qualquer aula —
> o driver nao distingue curso de tatica de livro, e nao deve — mas o retomar
> distinguia: `order.some(l => l.id === at.lesson)` e verdadeiro so para as treze do
> currículo. Quem fechava a aba a meio de uma tatica carregava em APRENDER e voltava
> a lição de notação, com o lugar guardado corretamente todo o tempo, lido e
> deitado fora. A guarda estava certa quando foi escrita — nada mais era resolvível
> entao. Ha duas etapas que nao protege nada.
>
> `de57e63` **`lessonIndex` devolve -1 para o que nao esta no currículo**, entao o
> numero significa duas coisas: «nao encontrado» e «antes do primeiro». `=== 0`
> oferecia «‹ Anterior» no primeiro passo de todos os puzzles e livros.
>
> `9b5ff12` ⚠️ **A ENGINE MUDOU O `Topology` OUTRA VEZ, E O JOGO DEIXOU DE ARRANCAR.**
> `cols`/`rows` viraram `size`, e `move` e `frame` passaram a obrigatorios. Terceira
> absorcao depois do ADR-0084 e do ADR-0087. Descoberto por um boot que atirou meia
> hora depois de uma corrida verde, sem nada nosso mudar no meio — a engine e
> dependencia ligada partilhada com outra sessao, e o chao mexe-se sem aviso deste
> lado. Xadrez e `move: 'diagonal'` (Chebyshev, o passo do REI — o comentario da
> propria engine nomeia este jogo) e `frame: 'compass'`.
>
> `6c889b3` ⚠️ **TRES FUNCIONALIDADES DESLIGADAS POR UMA CHAVETA.** A lista de aulas,
> o seletor de idioma e o nome da abertura estavam dentro de `if (deps.onHint)` — um
> nivel a mais. E o invólucro **retem `onHint` num jogo de dois jogadores**, de
> propósito: nao ha motor para perguntar, logo nao ha botao de dica. Entao num
> tabuleiro partilhado por duas pessoas — um pai e uma crianca no mesmo ecra, que e
> um modo pelo qual este jogo existe — a abertura nunca era nomeada, o dropdown de
> aulas nunca era preenchido e o seletor de idioma nunca seguia a troca. Cada um dos
> tres ja tinha a sua propria guarda, que e o que tornava o aninhamento invisível.
>
> **Encontrado por escrever o teste que faltava.** `openings.node.test.ts` e
> minucioso sobre o LIVRO — as 2.833 linhas jogam, a busca vai do mais fundo — e
> todas essas afirmacoes podem valer enquanto o nome nunca chega ao ecra, porque
> nenhuma delas toca no invólucro nem no HUD. E a mesma forma exata do defeito em
> que o menu listava `teach.notation.title` onze vezes: logica certa, entrega
> partida, nenhum teste capaz de ver.
>
> ⚠️ E **«um fetch, para sempre» era um comentario e nao uma guarda**: onze pedidos
> dos mesmos 230 kB numa abertura de cinco lances, porque `openings` so e definido
> quando o livro ATERRA.

> **Segunda volta do loop — 813 testes.** `2b7e8bd` a suíte falhava **uma corrida em
> três**, em ficheiros que ninguém tinha tocado: o padrão de espera errado em três
> pontos (esperar que um CONTROLO exista não é a funcionalidade estar pronta) e o
> teste das aberturas a viver dentro de 12% do tempo limite — 4.426 ms de 5.000, e
> caía sempre que o chromium corria ao lado. Elevado para 20 s **com as quatro
> medições escritas na configuração**, porque tornar estes testes mais baratos é
> verificar menos dos dados que eles existem para verificar.
>
> `26565cf` e `de57e63` vieram de perguntar como é o CAMINHO DO ERRO, e não o do
> acerto: um lance errado no livro era respondido com **silêncio** (todas as outras
> aulas dizem algo); e `lessonIndex` devolve -1 para o que não está no currículo, o
> que faz o número significar duas coisas — «não encontrado» e «antes do primeiro» —
> de modo que `=== 0` oferecia o botão «‹ Anterior» no primeiro passo de **todos os
> puzzles e de todos os livros**, onde ele não fazia nada.
>
> ⚠️ E mais **português europeu em texto pt-BR**: `splash.slow` dizia «O motor está
> a demorar», na tela inicial, na frase que explica por que os botões ainda estão
> desativados.
>
> ⚠️ **Três defeitos encontrados sem os procurar**, e nenhum deles apanhado por
> teste até serem: as duas aulas de final foram publicadas **sem acentos** em
> português E em espanhol (e o espanhol sem os `¿` de abertura) — assinatura de
> prosa que entrou por heredoc; `a11y.gridHint`, que é a cauda do `aria-label` do
> tabuleiro, ainda dizia **«Enter seleciona»**, exatamente onde quem lê não tem
> outra forma de descobrir; e dois testes **intermitentes**, um a esperar que um
> CONTROLO existisse em vez de a funcionalidade estar pronta (o menu monta-se antes
> do `await start()`, e corretamente), o outro a esgotar o tempo por gastar 1,8 s
> dos 5 s do orçamento — agora 828 ms, ordenando os candidatos sem os filtrar.

> **~~Dívida registrada e não corrigida~~ — ✅ FECHADA, ver o fim do documento:** o jogo **não tinha troca de idioma**.
> `setLocale` nunca é chamado em produção — a língua é decidida no arranque por
> `navigator.language`. Os três catálogos existem e o painel sabe recarregar-se;
> falta só o controlo. É lacuna do jogo inteiro, não do modo de ensino.


**Pré-requisito, não faxina.** Sem isto, cada aula precisa ser escrita três vezes,
como já acontece com dica, modo protegido e escolha de lado.

Hoje: `boot/main.ts` 1.172 linhas, `boot/main-2d.ts` 723, `boot/main-3d.ts` 615.
O que difere entre elas é **só como uma posição vira pixels**. Tudo o mais é cópia.

### ⚠️ A exploração encontrou três defeitos que a duplicação vinha escondendo

Não são deste plano — são de hoje. Estão aqui porque **a extração conserta os três
de graça**, e porque isso deixa de ser argumento de elegância e vira argumento de
defeito.

**1. O oponente nunca joga na vista 3D. Verificado no navegador.** Em `1 jog.
brancas`, joguei `e4` e esperei 14 segundos: o motor buscou até profundidade 14,
achou `e7e5`, avaliou −0,35 em 8.706 posições — e **o lance nunca entrou no
tabuleiro**. A lista continuou com `e4`, e `#sr-status` ficou vazio.

A causa: `main-3d.ts:481-484` aplica a resposta com
`game.activate(from)` + `game.activate(to)`, mas `askOpponent` só roda com
`phase === 'thinking'`, e `state.ts:208-210` devolve `{kind:'ignored',
reason:'busy'}` para **qualquer** `activate` nessa fase. Então
`result.kind !== 'selected'` é sempre verdade e a função retorna calada.
`applyOpponentMove` — o único método que aceita lance durante `thinking`
(`state.ts:265`) — é chamado em `main.ts:770` e `main-2d.ts:610` e **em lugar
nenhum de `main-3d.ts`**. Nenhum teste sobe `boot3d`.

**2. Trocar tema apaga a escolha de outra vista.** `saveSettings` (`session.ts:187`)
escreve o objeto inteiro, e cada raiz espalha um `currentSettings()` só com as
chaves que ela conhece: `main.ts:466` não tem `set`, `main-3d.ts:192` não tem `set`
**e fixa `coordinates: false`**. Mexer em qualquer coisa no 3D apaga o interruptor
de coordenadas; mudar o tema no 2,5D apaga a fonte de peças do tabuleiro plano.

⚠️ **Este não deveria esperar pelo plano.** É um defeito em produção, de três linhas:
trocar as duas chamadas de `activate` por `applyOpponentMove`, como as outras duas
raízes fazem, e acrescentar o `describe` de `boot3d` que faltava. Vale um commit
separado, **antes** da Etapa 0.

**3. Quatro desvios de acessibilidade só no 3D.** O canvas nunca recebe
`aria-hidden` (compare `main.ts:275`) e o espelho é anexado **depois** dele
(`main-3d.ts:294`, contra o `insertBefore` deliberado de `main.ts:292`) — um leitor
de tela encontra primeiro um canvas sem rótulo. O espelho não recebe
`resolveAction`, então tecla remapeada não anda no tabuleiro. Não há tecla de sonar,
mas `3d.html:1091` **anuncia `K sonar` mesmo assim** (e `2d.html` também). E o lance
é anunciado como SAN cru (`status.played`) em vez de frase.

### O que nasce

`app/js/boot/core.ts` — `createGameCore(deps: GameCoreDeps): GameCore`, e com ele a
interface que cada vista implementa:

```ts
export interface ViewAdapter {
  mount(region: HTMLElement): void;
  syncPosition(): void;
  /** ⚠️ O ÚNICO ponto onde as três vistas discordam de verdade. Ver abaixo. */
  animateMove(from: Square, to: Square, opts: { reducedMotion: boolean; hide?: readonly Square[] }): Promise<void>;
  setHintArrows(moves: readonly HintMove[]): void;
  setMarkers(markers: ReadonlyMap<number, Marker>): void;
  relayout(): void;
  destroy(): void;
}
```

### ⚠️ A costura difícil, e por que ela é mais fácil do que parece

O passeio pela história (`walkHistory`) está escrito de **três** formas:

- **2,5D** (`main.ts:819–882`) — máquina de estados dirigida pelo laço de quadros:
  `beginWalkLeg` monta `walking`/`walkMore`/`walkDirection`, o `frame` avança a
  animação, `continueWalk` pega o próximo lance.
- **2D** (`main-2d.ts:661–695`) — `async function` com `while (step)` e
  `await board.animate(...)`.
- **3D** — **não existe**. `onTakeBack: () => { game.takeBack(); afterMove(); }`
  (`main-3d.ts:287`). Salta.

A forma do 2D já é a forma certa. `animateMove` devolvendo `Promise<void>` unifica
as três: o adaptador 2D delega a `grid-mirror.animate` (que já devolve promessa,
`grid-mirror.ts:413`); o 3D devolve `Promise.resolve()` — exatamente o que o
movimento reduzido já faz; e o 2,5D embrulha a animação de quadros numa promessa
resolvida onde hoje está `continueWalk`. **Toda a maquinaria de `walking`,
`walkMore`, `walkDirection`, `beginWalkLeg` e `continueWalk` desaparece**, e
`walkHistory` passa a ser a versão do 2D, uma vez, no núcleo.

### Ordem, mantendo os testes verdes a cada passo

A boa notícia é estrutural: **nada fora de `tests/boot.browser.test.ts` importa
`app/js/boot/`**. 524 dos 534 testes não conseguem perceber esta refatoração.

0. **A rede, antes de qualquer coisa se mexer.** Acrescentar um `describe` de
   `boot3d` a `tests/boot.browser.test.ts` — sobe sem lançar, 64 `gridcell`, um
   `.hud`. Passa como está (`tests/scene3d.browser.test.ts` já prova que
   `createScene3d` roda em chromium headless) e prende a forma atual do DOM.
1. **`patchSettings(patch)`** em `session.ts` — mescla em vez de substituir. Mata o
   defeito 2 e apaga três closures `currentSettings()` e ~14 chamadas. Teste: gravar
   `{set, coordinates}`, aplicar `{theme}`, exigir que os dois sobrevivam.
2. **`boot/narration.ts`** — `moveSentence` e os anúncios. Pura, sem DOM, e hoje
   **sem teste nenhum** (nenhum arquivo em `tests/` a menciona). O 3D troca
   `status.played` por frase de verdade.
3. **`boot/view.ts` + `boot/game-shell.ts`, ligados só ao `main-2d.ts`.** O plano
   começa pelo tabuleiro plano de propósito: o `travel` dele **já é promessa**, então
   a costura é exercitada sem a ponte de quadros. O `describe` do 2D em
   `boot.browser.test.ts` tem de passar **sem ser alterado** — é o teste de aceitação
   desta etapa.
4. **`boot/view-zdog.ts`** — a etapa de risco: laço de quadros, câmera, seleção por
   ponteiro e teclas saem de `main.ts`.
5. **`boot/view-solid.ts`** — e os defeitos 1 e 3 se resolvem sozinhos, porque o
   invólucro passa a ser dono dos cinco pontos. Estender o `describe` do 3D com as
   duas afirmações que o do 2,5D já faz (canvas `aria-hidden`, espelho antes do
   canvas): **falham antes desta etapa e passam depois**, que é a forma certa de
   aterrissar uma correção.
6. **`playerSide` na declaração** — um argumento, e um caso novo em
   `tests/declaration.node.test.ts`. Hoje todo jogador cego ouve o tabuleiro do ponto
   de vista das brancas, tenha escolhido o que tiver.

### Duas coisas mecânicas que custam um build se esquecidas

- **`Marker` precisa mudar de casa.** Mora em `render/board.ts:47`, que importa Zdog.
  `import type` é apagado com `isolatedModules`, então é *seguro* — mas está a uma
  tecla de puxar 146 KB para o pacote do tabuleiro plano. Mover a união para
  `render/board-geometry.ts` (folha: só importa `chess/types.ts`) e reexportar.
- **`noUnusedParameters: true`.** O `drawPosition(_hidden, _travelling)` do plano e o
  `drawMarks(_markers, hints)` do sólido precisam do sublinhado, ou `tsc` reprova
  módulos corretos.

### Decisões desta etapa

- **`SceneStack` da engine: não adotar, e por um motivo concreto.** Ela está
  construída sem uso (`engine.cenas`) e "aula desenhada sobre o tabuleiro ainda
  visível" é literalmente o que `draw` de baixo para cima existe para fazer. Mas o
  contrato dela é `update(dt)` no topo e `draw()` de baixo para cima — e **`main-2d.ts`
  não chama `startLoop` nem `createFrameTicker`: não tem relógio nenhum**, por
  medição (104 KB contra 146 KB). Adotá-la ou força um laço de quadros na entrada que
  foi construída para não ter um, ou usa um terço da interface e deixa dois terços de
  cerimônia morta em toda página.

  **Não fechar a porta, que custa zero:** manter `activate(square)` como porta única,
  e transformar a tecla de sonar no **único** `region.addEventListener('keydown')` do
  invólucro, resolvendo por `engine.keyboard.actionOf`. Inserir
  `if (cenas.input(intent)) return;` no topo dele é depois uma mudança de duas linhas.
  Escrever isso **onde o keydown mora**, para que o adiamento seja decisão registrada
  e não omissão. Quando houver duas coisas a empilhar — aula sobre jogo, puzzle sobre
  aula — adotar `cenas` **só para roteamento de entrada e ciclo `enter`/`exit`**, e
  dizer no mesmo commit por que `draw()` fica sem uso.
- **As ~1.060 linhas de CSS repetidas: deixar em paz nesta etapa, e fazer na
  seguinte.** Eixo diferente, e a extração muda quais classes existem em qual página
  (o canvas 3D ganha `aria-hidden`, o espelho passa na frente dele) — convém a marcação
  assentar antes de consolidar as regras que a endereçam. ⚠️ E há uma propriedade a
  não quebrar por acidente: o `<style>` embutido faz o splash **pintar no primeiro
  quadro**, que é o ponto dele, porque o oponente é um download de 6,98 MB. Quando
  fizer: as regras de `#splash` (~60 linhas) **ficam embutidas** nos três `<head>`; o
  resto vai para `app/css/board.css`, importado dos três módulos de entrada. Os três
  HTML caem de ~1.104 para ~50 linhas.

### O teste que precisa nascer

`tests/shell.browser.test.ts`, contra uma `BoardView` falsa que só registra o que
lhe pedem. Três afirmações, e cada uma cobre uma falha que `tsc` e o build não veem:

1. Um desfazer de dois lances viaja **dois** trechos, na ordem inversa.
2. Depois do passeio, `canTakeBack()` volta a ser verdadeiro — pega a promessa
   órfã, cujo único sintoma é dois botões que emudecem para sempre, sem erro.
3. `drawPosition` recebe `[origem, casa da captura]` num desfazer de captura, e `[]`
   ao final — pega a regressão da lista `hide`, cujo único sintoma é uma peça
   capturada desenhada por baixo de outra que está voando para longe dela.

Some-se a isso um `makeOpponent` injetável no invólucro: hoje **não há como testar o
caminho do oponente sem baixar 6,98 MB de Stockfish**, que é exatamente por que o
defeito 1 sobreviveu.

### Riscos

⚠️ **`tsc` e os 534 testes não pegam o que quebra aqui.** `tests/boot.browser.test.ts`
existe exatamente por isso: dois `ReferenceError` de zona morta temporal em
`main.ts` passaram por `tsc`, 375 testes e o build, porque "todo outro teste importa
os módulos que `main.ts` compõe **sem compô-los**". Extrair um núcleo acrescenta uma
terceira ordem de inicialização a errar. Manter os **três** testes de boot e rodá-los
a cada passo.

⚠️ **O risco que falha em silêncio e só numa conexão ruim: peso de pacote.** `tsc` é
cego a isso e o vitest nunca empacota. Se `game-shell.ts` importar um **valor** de
`render/board.ts`, `render/zdog-stage.ts`, `render/pieces/**`, `render/animation.ts`
ou `render3d/**`, a entrada plana passa a carregar um renderizador que nunca desenha
— desfazendo a medição que justifica as três entradas (`vite.config.ts:21-25`: 104 KB
plano contra 146 KB projetado). O conjunto seguro do invólucro é `chess/**`, `ui/**`,
`i18n/**`, `declaration/**`, a engine, e as três folhas `board-geometry.ts`,
`hint-arrows.ts` e `palette.ts` — que `grid-mirror.ts` já puxa para o pacote plano, e
portanto não custam nada. **Lista de permissão comentada no topo do arquivo**, e uma
conferência de tamanho de `dist/` depois da etapa 5.

Outros dois, menores mas do mesmo tipo: um `travel` que nunca resolve deixa
`walking` preso para sempre (por isso o `finally`); e inverter a ordem de
`drawPosition` e `travel` faz o tabuleiro plano não voar nada — `grid-mirror.ts:418`
retorna cedo quando o glifo não está lá, **em silêncio**.

---

## Etapa 1 — Modo de ensino: regras elementares e notação

### A aula é DADO, não roteiro

O repositório tem uma preferência forte e provada por isto — `render/pieces/geometry.ts`
é uma **tabela** lida por dois renderizadores, e a Etapa "peças" mostrou o custo de
não ser. Uma aula segue o mesmo princípio:

**O modelo inteiro se apoia num fato que já existe:** `MoveResult` (`rules.ts:28-41`)
já carrega `castle`, `enPassant`, `promotion` e `captured` como campos de primeira
classe. Roque não se reconhece analisando `"O-O"`; *en passant* não se reconhece
comparando casas. **Esse vocabulário já é o vocabulário das aulas** — e o objetivo de
um passo é esse mesmo registro com todo campo opcional.

```ts
// app/js/teach/lesson.ts  — folha: importa só chess/types.ts
/**
 * Um lance descrito pelo que precisa ser VERDADE nele. Todo campo presente tem de
 * casar; ausente é "tanto faz". Uma conjunção de igualdades sobre MoveResult —
 * ⚠️ NÃO uma função-predicado, porque função na tabela é linguagem de script e não
 * pode ser conferida por teste.
 */
export interface MoveShape {
  readonly from?: SquareName; readonly to?: SquareName;
  readonly piece?: PieceType; readonly captures?: PieceType | true;
  readonly castle?: 'king' | 'queen';
  readonly enPassant?: true;
  readonly promotion?: PieceType | true;
  /** A saída de emergência, e a última. Prefira as bandeiras: elas dizem POR QUÊ. */
  readonly san?: string;
}

export type Task =
  | { kind: 'play'; want: MoveShape }
  /** Aponte um CONJUNTO de casas. A ordem não importa; o conjunto importa. */
  | { kind: 'mark'; want: readonly SquareName[] }
  /** Escolha uma resposta escrita. Chaves i18n, ou texto literal onde não faz falta. */
  | { kind: 'pick'; options: readonly string[]; answer: number };

export interface Step {
  /**
   * ⚠️ AUSENTE significa "continue de onde o passo anterior deixou o tabuleiro" — é
   * o que faz de "leve o cavalo a f3, agora a g5" uma aula e não duas.
   * ⚠️ O FEN também diz de quem é a vez. Não há campo `side` de propósito: um
   * segundo lugar para dizer a mesma coisa é um segundo lugar para ela estar errada.
   */
  readonly fen?: string;
  readonly say: string;                 // chave i18n; vai para #sr-status
  readonly task: Task;
  readonly show?: { squares?: readonly SquareName[];
                    arrows?: readonly (readonly [SquareName, SquareName])[] };
  readonly nudge?: string;              // chave i18n, dita uma vez após erro
}

export interface Lesson {
  readonly id: string; readonly title: string;
  readonly steps: readonly Step[];
  /** Aulas que vêm antes. Mantém o currículo DADO, não índice de vetor. */
  readonly after?: readonly string[];
}

/** Todo campo presente do objetivo confere. ~15 linhas, puro, o coração do modelo. */
export function matchesShape(shape: MoveShape, move: MoveResult): boolean;
```

| Pedido | Vira |
|---|---|
| "Leve o cavalo de g1 a f3" | `{kind:'play', want:{from:'g1', to:'f3'}}` |
| "Faça o roque pequeno" | `{kind:'play', want:{castle:'king'}}` |
| "Capture *en passant*" | `{kind:'play', want:{enPassant:true}}` |
| "Promova este peão" | `{kind:'play', want:{promotion:'q'}}` |
| "Ache todas as casas que este bispo alcança" | `{kind:'mark', want:['c6','b7',…]}` |
| "Toque em e4" | `{kind:'mark', want:['e4']}` |
| "Que casa é esta?" / "Qual vale mais?" | `{kind:'pick', options:[…], answer:1}` |

Valor das peças usa a tabela que **já existe** — `PIECE_VALUE` em
`chess/material.ts:30`, na escala 1/3/3/5/9 de livro de iniciante, com o comentário
que explica por que ela *não* é a do motor. **Não criar uma segunda.**

⚠️ **chess.js recusa um FEN sem reis.** `new Chess('8/8/…/8 w - - 0 1')` lança
`Invalid FEN: missing white king` (verificado). **Toda posição de aula carrega dois
reis**, enfiados em cantos opostos — inclusive a aula de notação, que não é sobre
peça nenhuma. Consequência a registrar na tabela: com os reis em `a8`/`h1`, `a8` e
`h1` não podem ser alvo de `mark`.

⚠️ **Não vire linguagem de script.** Quando um passo precisar de condição, ramo ou
variável, a resposta certa é uma quarta `Task` nomeada, não um interpretador.

### Como um passo é corrigido

`state.ts` **não tem gancho antes do lance**: `activate` (`:206`) chama `play`
(`:135`) que chama `rules.move` direto. Três saídas foram consideradas:

| | |
|---|---|
| Adicionar um predicado a `GameStateOptions` | Mexe no módulo mais testado do jogo para servir um caso que não é dele |
| Jogar e desfazer | **Escolhida.** É o padrão do modo protegido (`main.ts:495–537`), já provado, já anunciado, e já é o que o aluno precisa ver: o lance errado *acontece*, e desfazê-lo é a lição |
| Um driver de aula sem `state.ts` | Perde declaração, sonar, espelho DOM e teclado de uma vez |

O tutor fica **entre a raiz e o estado**: a raiz já chama `game.activate(square)` e
examina a `Activation`. Com `createGameState({ rules, opponent: false })` — o modo
hot seat que já existe (`state.ts:65`: "os dois lados são conduzidos do mesmo
tabuleiro") — `settle()` nunca entra em `thinking` e o motor jamais responde.

E a pedagogia concorda com a arquitetura. O cabeçalho de `blunder-bar.ts` já
argumenta: *"quem está sendo avisado de que o lance entregou o jogo precisa estar
olhando para a posição enquanto decide"*. Um aluno que moveu o bispo como torre
**precisa ver o bispo parado na casa errada** antes de ele voltar. Um predicado
antes do lance recusaria o movimento e não ensinaria nada.

```ts
// app/js/teach/tutor.ts — sem DOM, sem motor, sem texto (só chaves)
/**
 * ⚠️ A CASA VEM JUNTO COM O RESULTADO, e é a única coisa que este desenho pede ao
 * resto do jogo. `Activation` diz `{kind:'ignored', reason:'empty'}` sem dizer QUAL
 * casa — correto para um jogo, onde casa vazia é não-evento, e inútil para a aula
 * de notação, onde a casa vazia É a resposta. Passar a casa custa um parâmetro e
 * deixa `chess/state.ts` intocado.
 */
saw(square: Square, result: Activation): Reaction;
chose(option: number): Reaction;   // um `pick` respondido no painel
advance(): Step | null;
```

`Reaction` tem quatro formas: `right` (com `done`), `wrong` (com `undo`), `waiting`
(3 de 7 casas marcadas — nem certo nem errado ainda) e `ignored`.

Três consequências que merecem comentário no código:

- **Lance ilegal não precisa de desfazer.** `activate` devolve `{kind:'illegal'}` e
  nada foi jogado — "um lance ilegal é valor, não exceção" (`rules.ts`) paga direto.
- **Uma tarefa `mark` nunca muda a posição.** Ativar peça própria devolve `selected`
  (inofensivo, e até útil: o aluno vê os destinos legais); ativar casa vazia devolve
  `ignored/empty`. Os dois são registrados por casa e nenhum joga.
- **`judge()` fica de fora da Etapa 1, de propósito.** É pura e reusável
  (`review.ts:86`), mas resposta de aula é certa ou errada por construção, e ligar um
  motor para avaliar "leve o cavalo a f3" seria mentir sobre o que está sendo medido.
  É costura da Etapa 2, onde puzzle tem grau.

### Montar a posição

`rules.ts` só aceita FEN **na construção** (`:124–127`). `chess.js` 1.4.0 tem
`load(fen)`, hoje atrás do invólucro. Duas escolhas, e a menor honesta é a segunda:

- `rules.setFen(fen)` — uma linha, mas **mente sobre `startFen()`**, que é
  justamente de onde `session.describe()` reconstrói o jogo salvo. E `GameState`
  precisaria de um `resync()`, porque guarda `phase`, `selection` e `inFlight`. Dois
  módulos ganham ciclo de vida para servir a um modo.
- **O núcleo troca o objeto `Rules`: `newGame(fen?)`.** Não é operação de xadrez — é
  a capacidade que `chooseMode` vem fingindo com `location.reload()` desde sempre.
  Cada passo de aula com FEN novo é um `Rules` novo e um `GameState` novo.

A conta dessa escolha, pequena e mecânica: **`rules` e `state` passam a ser
acessores** (`rules(): Rules`) em `GridMirrorDeps`, `HudDeps` e `DeclarationDeps` —
uns 30 pontos em três arquivos. **É isso que mantém o foco no tabuleiro** quando um
passo troca a posição: reconstruir o espelho jogaria fora a célula focada e a
tabulação rotativa, e um aluno de teclado seria despejado no topo da página a cada
passo.

⚠️ **`syncPieces()` não pode chamar `saveGame(rules)` enquanto uma aula roda.** Sem
essa guarda, abrir uma aula **sobrescreve o jogo real do jogador** em
`sessionStorage`, e a perda só aparece quando ele troca de vista. O comentário
pertence à chamada de `saveGame`, porque ali o código parece incondicionalmente
correto e é o último lugar onde alguém vai procurar.

**Se a Etapa 0 atrasar**, a Etapa 1 não fica bloqueada: um passo com FEN novo grava
`{lesson, step}` no canal durável e chama `location.reload()` — o mesmo truque de
`chooseMode`, inclusive o `incl_chess_switching` para o splash sair da frente. É
pior (perde foco e pisca), por isso é a saída de emergência e não o desenho.

### Mostrar onde olhar

**Seta não custa nada.** `arrowFor` (`hint-arrows.ts:116`, zero imports) já alimenta
`board.setHintArrows`, `mirror.setHints` e o `THREE.Group` do 3D. `Step.show.arrows`
vira `HintMove` com `behind: 0` e desenha hoje, nas três vistas.

**Destaque de casa precisa de forma nova, e a razão é precisa.** Meu primeiro
palpite foi que as marcas existentes bastavam. Erradas: `board.ts` diz que as três
marcas que **coincidem num turno** se distinguem por FORMA, e abre exceção só para
`check`, "que nunca coincide com `capture` para o lado em xeque". Um destaque de aula
**coincide** com `selected` e `move` — o aluno pega o cavalo enquanto a casa-alvo
está acesa. Um segundo anel em outra cor seria falha de 1.4.1 justamente no modo cuja
razão de existir é ensinar.

Então: **um membro na união e uma terceira forma**, não um terceiro anel.

- `Marker` ganha `'lesson'`; o tabuleiro ganha um terceiro vetor de 64 — um `Rect`
  **interno menor** (`TILE*0.52`) dentro do anel de `TILE*0.84`, que se lê como forma
  diferente em qualquer tamanho e em qualquer paleta.
- `syncMarkers()` continua reconstruindo do estado a cada chamada. Ganha **um laço,
  colocado primeiro**, para que seleção, destino legal e xeque ainda ganhem a casa —
  e o cursor continue por último, sob a regra que já tem: *"a aula fala primeiro para
  o jogo poder falar por cima: uma casa que é 'olhe aqui' e 'você pode capturar aqui'
  é mais util sendo a segunda coisa."*
- No tabuleiro plano, `grid-mirror` ganha `setTaught(squares)` e `labelFor()` ganha
  mais um extra ao lado de `a11y.cellMove` — porque a regra do arquivo é literal:
  *"Nunca só cor: um lance legal é uma célula marcada E nomeada."* A frase tem de
  fugir de concordância: `'nesta casa'`, nunca `'{piece} marcada'`.
- `MARKER_LESSON` entra em `palette.ts`. ⚠️ `tests/palette.node.test.ts` **não mede
  tinta de marcador nenhum hoje** — mede par peça/casa. A tinta nova não quebra nada,
  e o honesto é acrescentar o caso que falta em vez de herdar o buraco: 3:1 contra
  `squareLight` e `squareDark`, na paleta padrão e na de alto contraste (1.4.11).

⚠️ **O 3D fica fora do destaque, e isso é dito em vez de fingido.** `render3d/scene.ts`
não tem canal de marcador nenhum (ver Dívidas), e construir um é trabalho maior que a
Etapa 1 inteira. O 3D recebe as setas (que funcionam hoje) e os rótulos do espelho
(idem); **a entrada do modo de ensino aparece só nas páginas 2D e 2,5D**. Escrever
isso é melhor do que entregar um destaque que silenciosamente não faz nada numa das
três páginas.

### A aula de notação

**Não precisa de forma nova, e esse é o teste que o modelo passa.** As duas direções
de ensinar a1–h8 já estão cobertas:

- **Nome → tabuleiro** (`mark`): *"Toque em e4."* É a direção que se paga, porque é
  **o mesmo gesto que a instrução do próprio jogo vai pedir**: quem responde "toque
  em e4" consegue ler "Mova o Cavalo para f3". Funciona igual do clique e das setas
  do espelho, porque `activate()` é a porta única — nada novo a ligar.
- **Tabuleiro → nome** (`pick`): *"Que casa é esta?"*, com a casa acesa pelo marcador
  `lesson` e três ou quatro nomes como botões no painel. É a direção que **quem não
  enxerga o tabuleiro também recebe**, porque o `aria-label` da célula já diz `e4` e
  o extra novo diz que é aquela a perguntada.

Posição: dois reis em cantos distantes e nada mais — `k7/8/8/8/8/8/8/7K w - - 0 1`.

⚠️ Opções de `pick` passam por `i18n.t()`, que **devolve a própria chave quando
ninguém a tem** — contrato já documentado em `i18n/index.ts`. Então `'d4'` atravessa
intacto e `'piece.r'` é traduzido: uma regra só, sem tipo-união. O risco de erro de
digitação se fecha com teste, não com tipo (ver Testes).

### Onde mora o texto

⚠️ **Não no catálogo principal.** Ele tem 132 chaves e ~7 KB por idioma, os três são
importados estaticamente, e `i18n/index.ts:10–17` diz para revisitar isso "se este
dicionário crescer uma ordem de grandeza". Umas 10 a 14 aulas de 5 a 8 passos
atravessam essa linha com folga.

E há o argumento medido do próprio repositório: `vite.config.ts:21–25` separa as
páginas justamente para que ninguém baixe o renderizador que não vai usar. Pela mesma
lógica, quem só quer jogar não deve baixar a prosa das aulas.

Só a Etapa 1 já são ~130–180 chaves novas (25 passos × `say` + `nudge`, mais títulos
e moldura do painel) — **ela dobra o catálogo sozinha**, e a Etapa 3 cruza a linha com
folga. Então a divisão chega **agora, antes da prosa**, e não depois.

- `app/js/i18n/teach/{pt,en,es}.ts` — mapa de strings simples, **sem** `pieces`,
  `sides` nem `pieceNamePattern`: esses existem e a prosa os reusa por
  `i18n.describePiece()`.
- `loadTeach(locale)` faz o recuo para pt **no carregamento**, então há um objeto só
  e nenhuma segunda cadeia de busca.
- `I18n` ganha exatamente um método: `extend(strings)`. Por instância, como todo o
  resto ali — sem estado de módulo, e um teste pode segurar um `I18n` puro e um com
  aulas lado a lado. `t()` vira `base ?? extra ?? recuo ?? a própria chave`, três
  linhas, e **o contrato "chave ausente aparece como a chave" fica preservado** — que
  é justamente o que faz o truque do nome de casa literal em `pick` funcionar.
- Teste próprio, com as mesmas três afirmações de `tests/i18n.node.test.ts:16–21`.
- ⚠️ **A regra de gênero vale igual** (`pt.ts:4–8`): o catálogo carrega gênero só
  para o **substantivo da peça**; toda outra frase é escrita para não concordar.
  "Leve {piece} até {square}", nunca "{piece} selecionada". Onde a frase exigiria
  concordância, **reescrever a frase**.

### Progresso

`session.ts` dá a razão do `sessionStorage` e ela é boa (`:21–27`): *"`localStorage`
ressuscitaria um jogo pela metade dias depois, numa máquina de escola compartilhada,
diante de quem sentasse em seguida."*

⚠️ **Esse argumento não atravessa — ele se inverte.** Uma lista de aulas concluídas é
justamente aquilo por que a criança volta. Não carrega posição, não carrega nome, não
diz nada sobre quem ela é, e perdê-la a cada aba fechada torna um curso impossível de
terminar. **Dois canais, duas respostas diferentes, e a diferença é o ponto.**

`session.ts` ganha ~35 linhas e nenhum tipo novo — `SessionStore` já é uma interface
estrutural que `localStorage` satisfaz sem mudança: `durableStore()` (com a mesma
sondagem de escrita de `defaultStore()`, `:59`), `Progress { done: string[]; at?:
{lesson, step} }`, `loadProgress`, `saveProgress`, chave `incl_chess_learned`. O
campo `at` é o que torna possível a saída de emergência por recarga.

**Nada mais entra aí. Nem a posição, nem os lances, nem um nome.**

### Testes

⚠️ **Depois do passo 4 da ordem de construção, a Etapa 1 está funcionalmente completa
e inteiramente testada com zero trabalho de renderização feito.** Esse é o argumento
do modelo de dados, e é assim que se sabe que ele está no lugar certo.

**node** (a grande maioria, por desenho):
- `[Shape] um objetivo é conjunção, não script` — `matchesShape` contra `MoveResult`
  reais: roque casa pela bandeira `castle` e não por SAN; *en passant* por
  `enPassant`; promoção por `promotion`. Objetivo vazio casa com tudo.
- `[Table] toda aula é jogável como está` — percorre `LESSONS`: todo `fen` constrói;
  todo `play` é satisfeito por **pelo menos um** lance de `rules.allMoves()` naquela
  posição; todo alvo de `mark` é casa real e não está sob um rei que o passo não quis;
  todo `pick.answer` indexa as próprias `options`. **É o teste que torna a tabela
  segura de crescer** — o mesmo argumento de `piece-geometry.node.test.ts`.
- `[Table] os conjuntos-resposta concordam com as regras que os produziram` — onde um
  `mark` é o alcance de uma peça, ele é igual a `rules.legalTargets(from)`. Dado na
  tabela, invariante no teste, como em `geometry.ts`.
- `[Reach] toda frase que uma aula pede existe nos três idiomas` — coleta `title`,
  `say`, `nudge` e as `options` que parecem chave (têm ponto) e exige que resolvam.
  **É a afirmação que o teste de i18n atual não consegue fazer**, porque hoje nenhum
  dado aponta para o catálogo; é ela que fecha o buraco do "erro de digitação
  renderiza como a chave".
- `[Judging]` no tutor: resposta errada devolve `{wrong, undo:true}`; ativação
  **ilegal** devolve `{wrong, undo:false}`, porque nada foi jogado.
- `[Nothing replies] uma aula é hot seat` — depois de um lance certo a fase é `idle`,
  nunca `thinking`.

**browser** (só o que precisa de foco, CSS e região viva de verdade):
- `[Teaching] uma aula se conclui só com o teclado` (2.5.7).
- `[Teaching] o foco fica no tabuleiro quando um passo troca a posição` — **o caso
  mais valioso daqui**: se `newGame()` reconstruir o espelho em vez de re-rotulá-lo,
  só este falha.
- `[Teaching] o destaque é forma E palavra` — `dataset.mark === 'lesson'` **e** o
  `aria-label` carrega o extra. A afirmação de 1.4.1, afirmada em vez de descrita.
- `[Teaching] errar não é emergência` — o texto vai para `#sr-status` (educado) e
  `#sr-alert` **não é tocado**. Só xeque e mate são assertivos, e uma aula não pode
  treinar criança a ouvir o próprio erro como alarme.

### Ordem de construção

1. `teach/lesson.ts` + `matchesShape` + teste. Puro, sem dependência, sem risco.
2. `teach/lessons.ts` — a tabela, com os FEN, e o teste de tabela verde.
3. `i18n/teach/*` + `I18n.extend()` + teste de completude.
4. `teach/tutor.ts` + teste. **Ainda sem DOM nenhum.**
5. `Progress` em `session.ts`.
6. `Marker.'lesson'`, `MARKER_LESSON`, `setTaught`, `a11y.cellLesson`, o caso de
   contraste que falta.
7. `ui/lesson-panel.ts` — modelado em `blunder-bar.ts` (sob o tabuleiro, para a
   posição continuar visível enquanto se lê). ⚠️ Mas **não** `role="alertdialog"` e
   **não** rouba foco a cada passo: o texto sai por `srSay` e o foco fica no
   tabuleiro. Só uma tarefa `pick` move o foco, e só porque é lá que está a resposta.
8. Ligar ao núcleo: `newGame(fen?)`, os acessores, a guarda do `saveGame`, o conjunto
   `taught`. **Só este passo depende da Etapa 0.**

### As costuras para as etapas seguintes

Nomeadas agora, **não desenhadas**:

- **`Step.fen` + `newGame(fen)`** serve puzzles táticos e treinos de final sem
  conceito novo: um puzzle é um passo com FEN e objetivo `play`.
- **`MoveShape.san`** serve o modo livro e as árvores de abertura — partida comentada
  é lista de passos cujo `want` é `{san}` e cujo `say` é a anotação. ⚠️ Mas
  `rules.searchPlay(token)` (`rules.ts:208`) **lança** em token ilegal; o modo livro
  vai precisar de um caminho de SAN que não lance. Nomear agora faz isso chegar como
  trabalho previsto, não como surpresa.
- **PGN não existe em lugar nenhum.** `chess.js` tem `loadPgn`, `getComment`,
  `getComments` atrás do invólucro. A Etapa 3 os expõe; a **Etapa 1 não deve** —
  método não usado em `Rules` é promessa que ninguém pediu.
- **`Lesson.after`** serve o currículo e, depois, a ordem de uma árvore de aberturas.
- **`Progress.done`** serve colecionáveis e história: ganha um campo irmão, mesma
  chave, mesmo canal.
- **`Task`** serve um módulo de história **sem tabuleiro nenhum** — um conjunto de
  `pick` já é expressável, que é um bom sinal de que a união está na altura certa.

## ⚠️ ESCOPO DO LOOP, a partir de 2026-09-06

⚠️ **ATUALIZADO no mesmo dia: o Capablanca TAMBÉM parou.** Decisão do usuário: é mais
urgente **revisar a interface**, que ficou cheia de problemas depois de o modo de
aprendizagem entrar. Toda a criação de aulas e livros está agora nas *issues*:

| Etapa | Onde foi parar |
|---|---|
| 4 — texto explicativo das aberturas (Staunton) | [issue #1](https://github.com/the-inclusionist/game-chess/issues/1) |
| 6 — história e cultura (Bird, Edge, Ruy López; ⚠️ Mecking vivo) | [issue #2](https://github.com/the-inclusionist/game-chess/issues/2) |
| 5 — posições de final (Philidor, Fishburne; ⚠️ Ed. Lasker até 2052) | [issue #3](https://github.com/the-inclusionist/game-chess/issues/3) |

| Capablanca — Cap. I §§6–8, Caps. II–VI, e as 14 partidas da Parte II | [issue #4](https://github.com/the-inclusionist/game-chess/issues/4) |

**Entregue antes de parar:** Capítulo I §§1–5 — os três mates elementares, a
subpromoção, a ruptura, a última linha e o valor relativo. Sete lições, três
idiomas, todas re-derivadas das regras.

O que **fica** no loop: **revisão da interface**. As quatro issues são
autocontidas — cada uma carrega a fonte, o estado de domínio público, a armadilha e
as convenções — porque uma issue que precisa desta conversa para ser lida é um
recado para ninguém. As seções abaixo ficam **como registro do levantamento**, e não
como fila de trabalho.

## ✅ REVISÃO DA INTERFACE — feita em 2026-09-06, à noite

Motivo dado pelo usuário: depois de o modo de aprendizagem entrar, a interface
**ficou cheia de problemas**. Estava certo, e a raiz era quase toda a mesma.

### A causa comum: uma coluna de HUD que já não existe

`render/resolution.ts` reservava **27,5% da canvas** — 176 de 640 px — para um HUD
desenhado DENTRO dela. O modo de ensino mudou o HUD para irmão DOM em
`#side-column` e ninguém remediu. A fração sobreviveu em **cinco sítios
independentes**: aquelas constantes (mortas, lidas por nada), o enquadramento do
`render/camera.ts`, o `right: 27.5%` das tiras de jogador, o `BOARD_SHARE = 0.725`
do `boot/view-solid.ts` e o `width: 72.5%` do `.stage-3d`.

⚠️ **Os dois últimos são o par instrutivo:** a cena 3D era redimensionada a 72,5%
da região **e depois disposta a 72,5% outra vez**. Corrigir um deixou uma canvas de
261×261 numa região de 360×360 e **parecia um defeito diferente**. É assim que uma
constante duplicada se defende: cada cópia faz a outra parecer a história toda.

### O palco, como você especificou

**16×9 unidades**: nove para um tabuleiro quadrado, sete para a barra. Piso 640×360
(o dobro de 320×180), tabuleiro 360×360, barra 280×360, unidade = 40 px. A canvas
passou a **quadrada** — um tabuleiro de xadrez numa raster 16:9 só pode usar a
altura, e media 258×217 dentro de 640×360.

⚠️ **A escada é a escala inteira em pixels FÍSICOS, e o tamanho CSS decorre dela.**
Escolher um degrau em CSS e exigir escala inteira parece a mesma regra: a um rácio
de 1,25 **não existe resposta legal nenhuma**. Consequência a julgar: num ecrã de
rácio 1 o degrau a seguir a 640×360 é 1280×720, portanto uma janela de 1116 desenha
o jogo pequeno. Num rácio 2 os degraus intermédios existem.

### O que mais foi encontrado por OLHAR

- **O HUD nunca saía do ecrã numa lição.** `hidden` estava a `true` e lia-se `true`;
  `.hud` define `display: flex`, que ganha ao `[hidden]` da folha do navegador. A
  armadilha era conhecida — sete elementos têm a guarda, o único que o modo de
  ensino esconde não tinha.
- ⚠️ **A suíte de navegador corria sem a folha de estilos do jogo**, portanto toda
  asserção de «está escondido?» era sobre uma PROPRIEDADE, nunca sobre o ecrã.
- **Alvos de toque**: eu próprio quebrei-os (25 px) ao tornar a raster quadrada. E o
  botão «Começar» **nunca** teve 44 — o piso estava aplicado classe a classe.
  Agora graduado: **AA (24) a 360, 34 a 540, AAA (44) a partir de 720**.
- ⚠️ **WCAG, corrigido por você:** 2.5.8 Minimum é **AA, 24×24**; 2.5.5 Enhanced é
  **AAA, 44×44**. O 44 é da norma (coincide com a HIG da Apple, daí a confusão), e o
  22 que estava no código não era limiar nenhum — era a unidade da engine.

### Nada fora do palco

`#stage` recorta agora, e uma varredura verifica que nenhum filho se apóia nisso.
As tiras foram para o topo das nove unidades, o `#below-board` para o rodapé delas,
a linha de teclas para o menu de pausa. O tabuleiro plano encolhe (264 quadrado); a
2.5D e a 3D não, porque a canvas delas é `inset: 0` e o jogador pode dar zoom.

**882 testes.** Verificado nas três páginas, em jogo e em lição.

### ⚠️ O painel medido, e o que a medição desmente

Feita a 2026-09-07, 00h30, no palco de piso: painel 280×360, jogo de um jogador,
`--ui-fs` 16 px, `--tap` 24 px.

| Bloco | px |
|---|---|
| Vez de jogar | 20 |
| **Lances** (título + janela de 8,5em) | **161** |
| Aulas | 63 |
| Professor | 24 |
| Quem joga | 45 |
| Pontuação | 66 |
| Força do adversário | 39 |
| Rodapé (‹ ›) | 20 |
| espaços + recheio | 49 |
| **total** | **487 em 360** |

⚠️ **COM A LISTA DE LANCES VAZIA JÁ SÃO 365**, portanto o painel não cabe antes de
se jogar um lance. É isso que responde «as fontes estão grandes demais?»: **não**.
Os 16 px são a escala do próprio motor neste degrau (8 lógicos × 2, porque 640 é o
dobro da base de 320), e descer para 12 px encolhe só o que é texto — o que existe
por causa do alvo de 24 px não desce — e aterra por volta dos 400. Continuaria a
rolar, com letra pequena.

⚠️ **E A LINHA QUE ESTAVA AQUI ANTES ERA UMA AFIRMAÇÃO POR MEDIR.** Dizia que «o
painel duplicou de largura e o tipo não acompanhou»: a largura passou mesmo de
176 → 440 → 280 px enquanto `--ui-fs` ficou preso ao palco, mas isso não é defeito
nenhum — no piso o tipo está na escala do motor. O que a queixa da primeira captura
descreve é outra coisa: a escada salta de 16 px (palco 640) direto para 32 px
(palco 1280), sem degrau entre eles, porque a escala tem de ser inteira em pixels
FÍSICOS. Numa janela de 1116 a rácio 1 o jogo inteiro desenha no tamanho do piso
dentro de um ecrã grande.

### ✅ DECIDIDO por si, 2026-09-07: **nada sai — o painel mantém-se rolando**

Perguntado com as três saídas e as consequências medidas de cada uma, a resposta
foi a mesma das duas vezes: **nada sai do painel**. A alternativa oferecida era
mudar os cinco controlos de preparação (idioma, aulas, professor, quem joga, força
do adversário — 164 px com os espaços) para o menu de pausa, o que deixaria 294 em
360; a terceira, encolher só a janela de lances, foi registada com a conta que
mostra que sozinha não resolve (~397, ainda acima de 360).

**Não há trabalho a fazer por esta decisão, e é isso que a torna a resposta certa
de registar:** o `.hud` já é `overflow-y: auto` desde que o painel deixou de
esconder o que não cabia, e `cbe9316` passou essa propriedade de comentário a
asserção — o teste força a caixa a 200 px, exige que haja conteúdo além do pé e
que rolar até ao fim traga o último controlo para dentro. O que ele impede de
voltar não é cosmético: com `overflow: hidden` a força do adversário fica na
página, focável e anunciada, e inalcançável com o ponteiro.

⚠️ **Consequência a assumir, não a esconder:** a 640×360 há sempre entre 5 e 127 px
de painel fora de vista, conforme a lista de lances esteja vazia ou cheia.

**A revisão da interface fecha aqui.** O que resta no repositório é conteúdo, e
está nas issues #1–#4 por decisão sua.

## ⚠️ ENGINE 9.0.0 — estudada em 2026-09-11, e traz um defeito NOSSO à superfície

Publicada às 22h19, já como `latest`. Comparei a superfície inteira contra a 8.0.0:
**`exports`, *peers* e o CONTRATO (`core/contract`) estão intactos** — a declaração
deste jogo não precisa de mudar uma linha. Mudou **um** ficheiro dos que
consumimos: o `boot/create-game`.

### 1. `mount` / `unmount` — o ADR-0142 aterrou

`engine.mount(declaration, ganchos?)` e `engine.unmount()`. O `problems` e o
`alcance` passam a ser **derivados**, logo deixam de descrever o cartucho errado no
modo plataforma. O `mount` **lança** numa declaração malformada em vez de a pôr em
`problems` — contrato é pré-condição, não diagnóstico. O `unmount` põe os
mapeamentos a `null`, retira o aviso de alcance e esvazia a pilha de cenas com
`pop()`, para os `exit()` correrem. **Um jogo não precisa de fazer nada por isto.**

### 2. 🔴 `getPauseActs` — e é aqui que há defeito NOSSO, hoje

O campo faltava, e o comentário da engine diz que a falta **alcançava todos os
consumidores de uma vez**: nenhum jogo montado por `createGame` conseguia ligar um
item do cartão de pausa, porque não havia por onde o passar.

⚠️ **E o custo maior não era o cartão, era a BARRA** — a que eu montei hoje em
`b75c807`. O `entrarNaBarra` chama `acts.resume?.()` para sair do cartão antes de
entregar as direções à barra de acessibilidade; com a tabela vazia esse `resume` é
`undefined`, o cartão fica por cima do jogo, e o item 7 do ADR-0044 — **o
direcional a conduzir a barra** — era inalcançável a partir de qualquer jogo.

📌 Ou seja: a barra que este jogo passou a ter navega-se por `Tab` e por ponteiro,
e **não** pelo modo direcional que a engine desenhou para ela. Não era defeito meu
nem estava no `problems`; estava nesta lacuna. **Passar `getPauseActs` — nem que
seja só um `resume` — é o item de maior valor da lista inteira.**

### 3. `setTemaDoJogador` / `setCorrecaoDoJogador`

São os *setters* cuja ausência eu registei quando montei a barra: sem eles os
ícones de **contraste** e de **daltonismo** nunca são montados. Este jogo tem os
dois controlos (paleta e correção de visão) no menu de pausa, portanto pode agora
oferecê-los também na barra, que é onde uma criança os procura primeiro.

### 4. `declines` É DO JOGO — a pergunta em aberto foi respondida

O `MetadeDoJogo` da 9.0.0 tem **quinze** campos, e o comentário diz porquê: a
primeira versão do ADR-0139 contou dez e deixou de fora `declines`,
`getPauseActs`, `setPauseActor`, `setTemaDoJogador` e `setCorrecaoDoJogador`; a
errata de 2026-09-11 corrigiu a lista pelo teste do próprio registo.

⚠️ **O `boot/standalone.ts` deste jogo põe o `declines` do lado do HOSPEDEIRO**, com
um comentário a dizer que a direção estava em aberto e que se devia ler a
implementação antes de a mover. A implementação chegou: é do jogo, e passa para os
`hooks`.

### 5. `GanchosDoCartucho` existe, e o meu `Pick` passa a ser cópia

A engine exporta `GanchosDoCartucho = Omit<MetadeDoJogo, 'declaration'>`. O
`ChessCartridge.hooks` está tipado com um `Pick` escrito à mão — que era o certo
enquanto a engine não nomeava o tipo, e passa a ser **uma cópia que diverge em
silêncio** agora que nomeia. Trocar.

### Adaptações, em ordem de valor — ✅ AS SEIS FEITAS

⚠️ **Estava escrita sem marcadores, portanto lia-se como fila.** Conferida no código
em 2026-09-11, à noite, não no registo de commits — os sete ganchos estão todos no
objeto `hooks`, tipado pelo `GanchosDoCartucho` da engine.

1. ✅ **`getPauseActs`** com `resume: () => engine.pausa.esconder(0)`.
2. ✅ `^9.0.0` em `peerDependencies` **e** `devDependencies`.
3. ✅ `declines` está nos `hooks`, do lado do jogo.
4. ✅ `hooks` tipado por `GanchosDoCartucho`; o `Pick` à mão desapareceu.
5. ✅ **`setCorrecaoDoJogador`** — e ⚠️ **`setTemaDoJogador` continua deliberadamente
   de fora**, com a razão escrita no código: o eixo `padrao|hc3|hc45|hc7` não se
   mapeia honestamente nas sete paletas nomeadas deste jogo, porque o
   `render/palette.ts` regista cinco das sete abaixo de 3:1.
6. ✅ `mount`/`unmount` não pediam nada ao jogo.

📏 **Verificado na página, não só no código:** a barra passou de sete ícones para
**oito** — apareceu o de *correção de daltonismo* —, o `engine.pausa.esconder` é
função (portanto o ato `resume` não é referência morta) e `engine.problems` está
vazio. Não há ícone de contraste, que é o resultado esperado do ponto 5.

⚠️ **O que NÃO ficou provado:** que o modo direcional da barra se conduz mesmo pelo
direcional. O `entrarNaBarra` é interno da engine e não há porta para o acionar de
fora; o que está provado é que o `resume` que ele precisa existe e é chamável.

## ⚠️ O TRABALHO SEGUINTE: este jogo vira CARTUCHO (lido em 2026-09-11)

### De onde vem, e quem manda

Estudados a pedido seu: `the-inclusionist-site/docs/{cartridge-brief,cartridge-contract,architecture}.md`,
o `README.md` do índice de ADRs, e os registos **ADR-0117**, **ADR-0139**, **ADR-0140**, **ADR-0141**.

⚠️ **O ADR-0142 não existia quando li, e passou a existir às 17h07 do mesmo dia** — «the engine mounts
and unmounts a cartridge». Lido: paga a dívida que o 0139 §5 declarou. A engine ganha
`mount(declaration, hooks)` e `unmount()`, e as leituras antecipadas passam a ser **derivadas** em vez
de fixadas no arranque, portanto `engine.problems` e `engine.alcance` deixam de descrever o cartucho
errado. O 0139 falava em **nove** dessas leituras; o 0142 mede **oito**, porque o `seguraTeclas` sai
para uma questão própria da engine — ele **já é função** no contrato, e o que está congelado é o
contexto dos ícones de pausa, que é defeito e não decisão.

📌 **E o 0142 diz, nas consequências neutras, que «nenhum repositório de jogo tem de mudar por este
registo».** O que este jogo tem a fazer continua a ser o do 0139/0140/0141 — a fila abaixo não se
altera com ele.

📌 **A hierarquia é explícita e vale contra este plano também:** os ADRs decidem, os documentos do
site são «a leitura longa» deles, e o próprio *brief* manda segui-los **quando o brief estiver
errado**. Já há um caso disso, ver «os três HTML» abaixo.

### O que um cartucho é (ADR-0139)

O `createGame` divide-se em duas metades, e a divisão **lê-se** em vez de se inventar — o teste é se
uma PÁGINA consegue responder ao campo sem saber que jogo está a correr.

| Metade do hospedeiro | Metade do jogo |
|---|---|
| `host` (`doc`, `win`, `cvdHost`, `a11yBarHost`, `pauseHost`), `carregarVozNeural`, `baixarPesados`, `aoProgredirPesados`, `disponibilidade` | `declaration`, `isNavigable`, `comIndice`, `naBarraDe`, `navBar`, `players`, `setPhase`, `sonarPlayers`, `isBlindMode`, `preset` |

Logo: **um cartucho não recebe `CreateGameOptions` — fornece metade dela**, e **nunca chama
`createGame`**. Quem chama é a casca, uma vez. O que volta, o `Engine`, é o que o cartucho consome.

- `Cartridge { slug, declaration, dicts, hooks, create(ctx) }`
- `GameInstance { update(dt /* QUADROS */), teardown() }`
- `GameCtx { engine, region, rng, t, params }` — os três últimos existem porque tirá-los traz de volta
  um defeito com nome: sem `region` o *teardown* é promessa; sem `rng` dois cartuchos partilham
  corrente; sem `params` um jogo lê a *query string* de outro.
- **O laço é da casca.** Um cartucho nunca chama `startLoop`.

### O que este repositório já cumpre, e o que não — RE-MEDIDO em 2026-09-11, à noite

⚠️ **A coluna da direita era o estado de quando a tabela foi escrita, e nove das onze
linhas mudaram desde então.** Conferida ficheiro a ficheiro, não pelo registo de
commits — uma lista de pendências que já não pendem manda o próximo leitor refazer
trabalho pronto, que é o defeito que esta tabela tinha.

| Regra | Xadrez |
|---|---|
| Não importar `rnd`/`randInt`/`shuffle`/`reseed` de `core/rng` (ADR-0141) | ✅ zero ocorrências |
| Sem `let` ao nível do módulo (D14) | ✅ zero em `boot/` |
| Engine a par | ✅ `^9.0.0`, *peer* **e** *dev* |
| Não chamar `startLoop` | ✅ `852c640` — o laço é da casca, as vistas expõem `frame(dt)` |
| Não ler `location.search` | ✅ `f72770f` — `params` entregue; a casca é quem lê o endereço |
| `private: false`, `exports`, `files` | ✅ os três |
| Engine/`zdog`/`three` como *peer* **e** *dev* | ✅ com uma correção ao enunciado — ver abaixo |
| Não chamar `createGame` | ✅ só `boot/standalone.ts:57` |
| PWA no modo autónomo | ✅ `vite-plugin-pwa`, com `check-precache` a prová-lo |
| Exportar os dicionários i18n | ✅ `src/index.ts` |
| `main.ts` como fábrica, sem arrancar ao importar | ✅ para o CARTUCHO — ver abaixo |

⚠️ **A LINHA DO `three` ESTAVA MAL ENUNCIADA, e a medição corrige-a em vez de a
cumprir.** A regra pedia os três como *peer*; o `vite.config.ts` decidiu por escrito
que o Three fica DENTRO do pacote, por não haver partilha a ganhar — é o único jogo
do catálogo que desenha com ele. Medido no artefacto emitido: `dist-lib` importa
exatamente dois nomes, `zdog` e a engine. O `three` não aparece como import nenhum,
porque está embutido nos 659 KB do pedaço `view-solid`.

📌 Logo ele não é dependência de execução e nunca podia ser *peer*: a entrada em
`dependencies` pedia a cada consumidor que instalasse ~620 KB que nada do que ele
corre chega a carregar. Passou a `devDependencies` (`4aa2e2b`), e
`scripts/check-cartridge.mjs` passou a exigir que **todo nome emitido seja um *peer*
declarado, e todo *peer* declarado seja um nome emitido** — as duas metades vivem em
ficheiros diferentes e são mudas quando discordam. O mesmo gate cobre a entrega:
`dist-lib` não pode conter `.wasm`, fonte nem voz (ADR-0117), que foi o defeito de
7,1 MB do primeiro build de biblioteca.

📌 **`main.ts` arranca ao importar, e isso está certo.** A linha da tabela era sobre
a porta do CARTUCHO, e essa é `src/index.ts`, que é fábrica pura. O
`app/js/boot/main.ts` é o *script* de uma página HTML: arrancar ao ser carregado é o
que um `<script type="module">` existe para fazer.

### O que resta do ADR-0139, nomeado membro a membro

O `create()` recebe o motor onde o §4 tem um `GameCtx` inteiro —
`{ engine, region, rng, t, params }`:

- **`params`** ✅ entregue, mas na CONSTRUÇÃO e não no `create`. A partida não é
  descuido: o `?debug=true` é lido enquanto o painel está a ser montado, e o painel
  tem de existir antes do `createGame` — o motor recebe `a11yBarHost`, que vive lá
  dentro. Um cartucho cujos hospedeiros são o seu próprio DOM não pode esperar pelo
  motor para saber com que argumentos foi aberto.
- **`region`** ✅ **feito, em duas metades e por esta ordem.**

  ✅ **DECIDIDO POR SI, 2026-09-11:** «o tabuleiro + menu lateral constituem o
  game-region». O que era `#stage` tomou o id; o tabuleiro passou a `#chess-board`
  (`246355c`). Não é um renome — decide qual é a RAIZ deste cartucho, e o
  `cartridge-contract.md` é literal sobre o que uma raiz significa: um cartucho «may
  write inside it and nothing outside it». O xadrez escrevia em três sítios, porque a
  sua região era um nono do que ele desenha; os três estão agora dentro de um só
  elemento.

  📏 **A medição que levou à pergunta:** a casca lia o documento por id sete vezes, e
  só uma era o jogo — `#stage`, `#side-column`, `#stage-wrap` e `#splash` são mobília
  da PÁGINA. Entregar cinco elementos obrigaria a plataforma a reproduzir a marcação
  exata do xadrez para hospedar um jogo; por isso a pergunta era de desenho.

  🔴 **E a mudança trouxe à superfície dois defeitos reais, os dois medidos na página
  a correr e corrigidos em `8e2edb3`:**

  · **A tela de título não cobria o teclado.** Com o splash levantado, o tabuleiro
    estava `inert` e o `#side-column` não: **22 controlos alcançáveis por Tab** por
    baixo de um ecrã que os tapa, a começar pelos quatro botões da barra de
    acessibilidade. `fixed` e `z-index` escondem do olho; só `inert` esconde do
    teclado.
  · **O alto contraste nunca chegava ao painel.** São 32 regras sob
    `[data-contrast="high"]` e cerca de vinte nomeiam `.chess-hud`, `.hud-*` ou
    `.theme-report`. O atributo era escrito no TABULEIRO e um seletor descendente não
    atravessa para um irmão — logo essas vinte não casavam com nada, em paleta
    nenhuma, desde que o painel saiu do tabuleiro. ⚠️ A intenção já estava escrita a
    três linhas do defeito: «deixar o painel sem o contraste seria uma mentira que a
    caixa contou». Contou.

  ✅ **A outra metade — a porta — feita em `88bce94`.** O `GameShellDeps.region`
  passa a dizer QUAL é o elemento; a procura por id sobrevive como omissão, porque a
  página autónoma também é hospedeiro e `#game-region` é o id da marcação dela (e é a
  marcação exigida pela engine). O tabuleiro e a coluna são pedidos **à região** e
  **construídos quando ela não os tem** — o mesmo argumento que o `#below-board` já
  fazia dez linhas abaixo: «markup that exists only to be filled in by this module
  belongs to this module». Um hospedeiro que entregue um `<div>` vazio recebe um jogo
  a funcionar em vez de uma lista de divs para copiar da nossa página, que era a
  objeção a dar cinco elementos em vez de uma raiz.

  📏 Leituras do documento: de **sete para três**, e cada sobrevivente com a razão
  escrita — a omissão da raiz, o recuo da linha de teclas, e o `#splash`, que é
  mobília do hospedeiro e está guardado por existência.

  ⚠️ **E a suíte a passar não provava nada do ramo novo:** todas as fixtures escrevem
  a marcação da página, portanto «construir quando não há» nunca corria. Dois testes
  entregam um `<div>` nu com o id de outra pessoa — um pergunta se o jogo sobe e
  joga, o outro se alguma coisa escapou para o nível de topo. Os dois morrem quando
  os divs são acrescentados ao `body`.

### ✅ A lista do ADR-0139 está completa

Onze linhas, todas ✅. O que resta do registo não é deste repositório: o `GameCtx`
completo pede um `rng` que este jogo não usa e um `t` que o registo permite que seja
o nosso, e o `create()` continua a receber o motor em vez do contexto inteiro — o que
só faz diferença no dia em que uma plataforma existir para o passar.

📌 **O conteúdo continua nas issues #1–#4, por decisão sua.** Não há mais item de
cartucho na ordem.

### ✅ `teardown()` — feito em `8753779`, e com ele fecha o `GameInstance`

O ADR-0139 nomeia o `teardown` ao lado do `update`, e o contrato acrescenta que a
casca **esvazia a `region`** a seguir. Era fácil ler isso como suficiente e escrever
um teardown que não faz nada: pareceria certo, tudo passaria, e a fuga chegaria no
dia em que dois cartuchos partilhassem página.

📏 **Medido em vez de assumido. Quatro coisas sobrevivem a uma região esvaziada, e
cada uma é uma fuga de espécie diferente:**

| O quê | Porque não é alcançado |
|---|---|
| O `resize` na `window` | Não está na região de todo |
| O `keydown` do menu de pausa | Registado **em captura no DOCUMENTO** — tirava teclas ao que corresse a seguir, e primeiro |
| O `keydown` da própria casca | Está no ELEMENTO região, e o hospedeiro guarda-o: só os filhos são esvaziados |
| O oponente | Um Web Worker com 6,98 MB de WebAssembly, que operação de DOM nenhuma toca |

A vista é destruída também, e aí o custo é memória de GPU: o Three não liberta uma
geometria quando a malha sai da cena. ⚠️ **Todos estes componentes já expunham
`destroy()` e a casca não chamava nenhum** — o teardown é sobretudo ligação.

📌 **E paga a dívida que eu criei em `852c640`:** a suíte constrói ~30 cascas num
ficheiro e ficava com trinta relógios a bater. Custou uma corrida — o teste do sonar
falhou por tempo (24 s contra 157 ms sozinho) e passou na repetição. A suíte agora
desmonta cada casca, o que de passagem exercita o `teardown` sobre todas elas, no
estado em que cada teste as deixou.

⚠️ **O que NÃO foi mexido, e porquê:** o `tests/boot.browser.test.ts` arranca doze
jogos por `bootChess`, que devolve `Promise<void>` e não dá alça nenhuma. Conferido
antes de decidir: essas doze cascas já vazavam **antes** desta série, porque cada
vista construía o seu próprio relógio e ninguém o destruía — hoje é um relógio por
casca em vez de um por vista, portanto é melhor e não pior. Mudar o tipo de retorno
do `bootChess` serviria só os testes, e o hospedeiro de plataforma não o chama.
- **`rng`** — este jogo não tira um número aleatório. Não há o que receber.
- **`t`** — é o seu, que o registo permite: utilitário sem estado importa-se em vez
  de se entregar, e o catálogo deste jogo não é o da engine.

### ⚠️ O QUE FALTA DAS VISTAS É UMA PEÇA INDIVISÍVEL — e é por isso que não foi fatiada

Feito: `46b5f36` — `shell.switchView(kind)` troca o renderizador sem navegar, com os
sete controlos da vista **delegados** em vez de copiados, e o contorno escondido
onde a vista corrente não empresta nenhum.

⚠️ **E a medição seguinte inverteu a ordem que eu ia seguir.** Ia trocar os três
*links* por botões; o teste que os fixa explica por que são *links*: «usa links a
sério, para a plataforma devolver o que um botão tiraria» — abrir noutro separador.
**Enquanto `2d.html` e `3d.html` existirem isso é uma afordância verdadeira**, e
trocá-la por botões antes de as páginas saírem é perder sem ganhar.

📌 Logo o que falta é **um só movimento**, e cada parte dele só faz sentido com as
outras:

| Parte | Tamanho |
|---|---|
| `vite.config`: três entradas → uma | pequena |
| Apagar `app/2d.html` e `app/3d.html` | pequena |
| `check-precache.mjs`: deixa de exigir os dois nomes | pequena |
| Painel: *links* → botões que chamam o `switchView` | média |
| `HudDeps.view` passa a acessor (hoje é valor capturado, e o botão marcado ficaria preso) | pequena |
| Guardar a vista escolhida — o URL deixa de a carregar | pequena |
| `main-2d.ts` / `main-3d.ts` deixam de existir; uma raiz lê a vista lembrada | média |
| Testes de arranque `boot2d`/`boot3d` e os cinco de `[Views]` | **grande** |

⚠️ **Não a comecei em cauda de volta**, e a razão é que ela não tem ponto de paragem
seguro a meio: apagar as páginas antes de o painel as substituir deixa o jogo sem
como trocar de vista, e trocar o painel primeiro deixa botões a apontar para páginas
que ainda são a forma certa de lá chegar. Precisa de uma volta inteira e termina
verde ou reverte-se.

### ⚠️ A segunda metade das vistas: medida, com a pergunta que ela esconde

Feito em `16714fb`: o cartucho é dono dos três renderizadores, cada um o seu pedaço
(`view-solid` 540,7 KB · `view-zdog` 38,2 KB · `view-flat` 0,8 KB), obtidos por
`import()` só quando a vista é escolhida. **Falta trocar de vista sem navegar** e
colapsar as três entradas HTML numa só.

📏 **Medido antes de começar:** o invólucro tem **onze** referências a `view.`, e o
contrato já traz `destroy()`. Dez delas são diretas e trocáveis — `applyTheme`,
`onKey`, `relayout`, `drawMarks`, `drawPosition`, `travel` (duas), `debug`.

⚠️ **A décima primeira é a que decide o desenho:** `...view.hudControls`, espalhado
na construção do HUD. O desenho de peça, o contorno e as coordenadas **são da
vista**, e o painel captura-os uma vez. Uma troca em execução deixaria o painel a
falar com uma vista destruída — e o sintoma seria um seletor de peças que não faz
nada, não um erro.

**Duas saídas, e a escolha é de desenho:**

1. **Tornar `hudControls` preguiçoso** — o HUD passa a receber acessores que leem a
   vista corrente. É o conserto certo e muda a forma de sete campos do `HudDeps`.
2. **Reconstruir o HUD na troca** — mais simples de escrever e pior de usar: perde
   o foco, a posição de rolagem e o estado aberto do menu de aulas.

📌 Inclino-me para (1) e **não a comecei a meio de uma volta longa**, porque mexe no
contrato do painel e merece a sua própria verificação. O resto do item — os botões
no lugar dos três *links*, a entrada única no `vite.config`, o `check-precache` que
hoje exige `2d.html` e `3d.html`, e onde fica guardada a vista escolhida agora que
o URL deixa de a carregar — pendura tudo nessa decisão.

### Os três HTML: **decidido**, ao contrário do que o brief diz

O *brief* lista o xadrez em «não decidido — não invente uma resposta». O `architecture.md` e o
ADR-0139 dizem o contrário e são a autoridade: **as três entradas viram três VISTAS de tabuleiro
escolhidas em execução**, porque dentro da plataforma uma segunda entrada HTML é um segundo URL e não
um segundo pacote. O raciocínio que separou as entradas sobrevive — o tabuleiro plano foi separado
para não carregar um renderizador que nunca desenha — e o `import()` dinâmico compra a mesma poupança:
a vista Three.js passa a ser um pedaço que ninguém analisa sem a escolher, **melhor do que hoje**, em
que o `3d.html` carrega 743,9 KB à cabeça.

### ⚠️ A ordem: este jogo ESPERA

`ADR-0068` §6 exige que **um** jogo vá de ponta a ponta antes dos outros, e o escolhido é o
**whackwhack** — a build mais pequena (344 KB contra os 8,4 MB deste), já em engine 8, com CI. O brief
é literal: *se não é o whackwhack, espere o contrato voltar com os buracos tapados*.

**Portanto isto não começa agora.**

⚠️ **E A FRASE QUE ESTAVA AQUI ANTES ERA MINHA E ESTAVA ERRADA.** Dizia que «cada linha ❌ é trabalho
que vale por si mesmo no modo autónomo e não depende do contrato assentar», o que dava licença para
começar por qualquer uma delas. Conferido item a item: **nenhuma das oito é defeito hoje.** Ler
`location.search` é o comportamento certo num jogo que tem o seu próprio endereço; chamar `startLoop`
é certo em quem é dono do laço; `private: true` é certo em quem não publica; a engine em
`dependencies` é certo em quem não é consumido por ninguém. Todas as oito são preparação para um
hospedeiro que ainda não existe — que é precisamente o que o `ADR-0068` §6 sequencia atrás do
whackwhack, para que os buracos do contrato sejam descobertos uma vez e não seis.

📌 E o PWA autónomo, que era o candidato mais solto da lista, também não é urgente **aqui**: o
`ADR-0140` conta entre as consequências o `game-2048`, cujo README promete «offline as a PWA» sobre
uma build sem *service worker*. O README deste jogo **não faz promessa nenhuma de offline** —
conferido —, portanto não há falsidade a corrigir, só trabalho a fazer na sua vez.

**A lista fica como inventário medido, não como fila.** Quando o whackwhack voltar com o contrato
fechado, ela é por onde se começa, e nessa altura já estará conferida.

### 📌 O que o trabalho de hoje já pagou, e o que ele deve

As sete etapas da engine 8 caem todas na **metade do jogo** da tabela, portanto viram `hooks` sem
reescrita: `isNavigable`, `sonarPlayers`, `preset`, e a declaração inteira.

⚠️ **E o que fiz hoje aparece nomeado nas listas de leituras ANTECIPADAS dos dois registos**: o
`preset` (`:518`), o `alcance` (`:523`) e o registo do `mapeamentoDoTeclado` (`:392`). Não é trabalho
perdido — está certo no modo autónomo, que é o único que existe — e deixa de ser dívida **quando o
mount do ADR-0142 for construído**, porque é exatamente o que ele volta a derivar a cada troca.
(O `seguraTeclas`, que o 0139 contava, saiu da lista no 0142: já é função no contrato.)

⚠️ **UMA MEDIÇÃO DO ADR-0142 FICOU DESATUALIZADA POR MINHA CAUSA, e o Dev deve sabê-lo.** O §3 diz,
a justificar que o `unmount()` é seguro: «medido: nenhum dos seis jogos regista um mapeamento
próprio, portanto nada além do registo da própria engine é apagado». **Este jogo passou a registar
um**, hoje, em `20a9161` — `mapeamentoDoTeclado` a pôr o sonar em `leftTrigger`/`KeyL`. O commit
**ainda não foi empurrado**, portanto quem escreveu o registo não tinha como o ver.

📌 **A decisão não muda, e é por isso que isto é errata e não objeção:** no `unmount()` o mapeamento
do xadrez é apagado, o que é o comportamento certo numa troca, e no `mount()` seguinte a declaração
volta a registá-lo, porque `:392` é uma das oito que o registo manda re-derivar. O que envelheceu é
só a prova entre parênteses — «nada além do registo da engine» deixou de ser verdade.

### Aberto, e o registo diz para não inventar

- A forma exata de `GameCtx` para lá dos cinco membros; se `Dict` e `Translate` são tipos exportados
  da engine hoje — é leitura, não decisão.
- Se `declines` é do hospedeiro ou do jogo. Lê-se como afirmação sobre o JOGO, mas o `createGame`
  devolve um `declines` resolvido: a direção tira-se da implementação.
- A política de semente: quem a escolhe, e se uma corrida é reprodutível entre cascas.
- O `mount` da engine, que é mudança na engine e pede registo próprio escrito de um estudo.

## ✅ PASSAR A USAR A ENGINE 8 — CONCLUÍDO em 2026-09-11

> **As sete etapas e a verificação estão feitas**, em nove commits, cada um com uma
> mutação a provar que o teste morde. **890 testes**, `tsc` limpo, `vite build` limpo.
>
> `e345fa7` o descarregamento pesado · `161e2d7` o cartão fora do tabuleiro ·
> `a84f4f7` o painel passou a `chess-hud` · `4c0a223` a folha da engine ·
> `b75c807` **a barra de acessibilidade** · `f43b28a` `isNavigable` ·
> `b345be8` a tecla de pausa resolvida + `needsPointer` · `e54a3ce` a correção abaixo.
>
> **Verificado nas três páginas**, fora da suíte: barra com sete ícones
> (`blind`, `tts`, `libras`, `tea`, `face`, `eyes`, `voice`), painel 264×331,
> palco 640×360, tabuleiro 360×360, canvas 360×360 no sólido, cartão da engine
> escondido no contentor próprio, `KeyH` a resolver para `start`, menu a abrir nele
> e a fechar no `Escape`, e `problems` VAZIO — a linha «sem barra de acessibilidade
> na primeira tela» desapareceu, que era o teste final desta passagem.
>
> ⚠️ **Duas medições viraram o plano do avesso, e as duas na mesma direção:**
> a etapa 7 previa DECLARAR `mapeamentoDoTeclado` para o `start` deixar de estar
> nomeado à mão — mas a engine 8.0.0 **já liga** `start: ['KeyH', 'Enter']`, portanto
> o que havia era uma segunda fonte de verdade a impor uma tecla que um remapeamento
> não conseguiria desligar. E o modo cego **não apaga o painel**: `body.blind-mode`
> é escrito pelo `ui/shell`, que o `createGame` não monta, então metade da
> justificação que eu tinha escrito para o renome era falsa. O renome continua certo
> pela outra metade, que não depende de classe nenhuma: `max-width:1000px` com
> `flex-wrap:wrap` e `gap:24px` numa coluna de 264.

## ✅ A LINHA DE TECLAS — FEITA em 2026-09-11, `def4375`

> A derivação ficou em `ui/key-hints.ts`, pura, com testes próprios: **esquema
> remapeado produz linha remapeada**, e **ação ligada a nada não é anunciada**.
> Na página sai idêntica à de antes — é o resultado certo, porque os literais
> coincidiam com o esquema; o que mudou é que já não podem divergir.
>
> ⚠️ **O `especial` estava morto e ninguém tinha reparado.** O comentário do sonar
> guardava-o «para o dia em que a engine o ligar»; na 8.0.0 esse nome aparece em
> todo o `core/actions` embarcado **uma vez**, num comentário a listar os nomes
> SUBSTITUÍDOS (`jump`, `run`, `swap`, `especial`). O ramo saiu e a tecla passou a
> constante única, lida pelo tratador e pela linha — o par que já divergiu aqui.
>
> ### ✅ O sonar remapeável — feito em `20a9161`, e a pergunta era minha e estava errada
>
> Este bloco dizia «Aberto, e é decisão sua», com o argumento de que o nome do slot
> é o que uma criança lê no ecrã de remapeamento. **Conferido em vez de assumido:**
> `ActionWord.label` é texto livre fornecido pelo JOGO — o comentário da engine
> nesse tipo diz «NUNCA `action2` — nome abstrato que chega a uma pessoa é defeito»
> — e esta raiz nem sequer constrói esse tradutor: lê o `preset` só para CONTAR.
> A premissa era minha e era falsa, portanto a escolha era minha.
>
> O sonar vive em `leftTrigger`, ligado a `KeyL` pelo `mapeamentoDoTeclado` do
> assento 0 — escolha **arbitrária entre quatro**, dita em vez de justificada com
> uma razão inventada. Para quem joga nada muda; o que muda é que a engine passou a
> conhecer a tecla, logo ela remapeia-se como as outras. E o sonar **não tinha teste
> nenhum**, o que passou a pesar no instante em que deixou de ser literal: um
> mapeamento que não aterrasse deixá-lo-ia mudo em silêncio.
>
> ### ✅ O `preset` e a tabela única — `bd219f6` e `4fbc807`
>
> Sem `preset` o `createGame` nunca mostra o aviso de alcance (`if
> (acoesDoJogo.length)`), portanto a criança num aparelho de dois botões não era
> avisada: descobria carregando contra um tabuleiro que não responde. Declaradas
> **dez posições** — a contagem honesta e não a lisonjeira.
>
> ⚠️ E a lista existia duas vezes (linha de teclas + `preset`). O item que eu tinha
> anotado era «testar que concordam»; a resposta certa era **não haver duas**, pelo
> padrão do `geometry.ts`. Um teste de concordância passa no dia em que alguém edita
> as duas — o dia em que menos faz falta.
>
> 📌 **Por provar:** que o cartão de alcance aparece mesmo num aparelho curto. O
> `disponibilidade` é opção do `createGame` que este invólucro não passa, e criar
> essa costura só para o teste seria pior do que a lacuna. Provado está o número que
> abre a porta: `alcance.pedidas` passou de 0 a 10.
>
> ### ⚠️ Uma corrida vermelha não identificada
>
> Uma falhou enquanto isto aterrava; as sete seguintes passaram 896. Perdi a saída
> por correr de novo antes de a ler — erro meu, não do teste. Se voltar, a primeira
> suspeita é a que o `vite.config` já documenta: dependência descoberta a meio de
> uma corrida do modo navegador, que recarrega a página sob a suíte.

## ~~O PRÓXIMO ITEM: a linha de teclas mente assim que alguém remapeia~~ — feito

Achado ao fazer a etapa 7, e é peça própria e não remate dela. `refreshKeyHints()`
em `boot/game-shell.ts` imprime uma **tabela de letras escritas à mão** —
`WASD`, `J`, `K`, `U`, `I`, `L`, `H` — enquanto o jogo resolve as ações por um
esquema remapeável da engine.

⚠️ **É o mesmo defeito que este repositório já corrigiu uma vez** (`4345f66`, quando
a linha anunciava `Enter seleciona` e `K sonar` depois do remapeamento), e voltou por
outro caminho: da última vez a linha estava em português fixo, desta vez está em
teclas fixas.

O conserto tem forma conhecida: `engine.keyboard.kbFor(0)` devolve o `KeyScheme`
real, portanto a linha lê-se dele. Falta uma função de código→rótulo (`KeyH` → `H`,
`ArrowRight` → `→`, `Space` → a palavra), que **não existe exportada na engine** —
conferido — logo nasce aqui, pura, com teste próprio.

📌 E há uma decisão pequena dentro: o `L` do sonar resolve para `null` (medido),
porque é a ação `especial` e o esquema solo não a liga. Ou a linha deixa de o
anunciar, ou o jogo declara `mapeamentoDoTeclado` só para ela — que é exatamente o
campo que a etapa 7 dispensou para o `start`.

### Contexto

A dependência já mudou (`3ac4df4`, `aafcfd3`): o `file:../SP-the-inclusionist-tracer`
tinha deixado de resolver — a pasta foi renomeada —, o repositório não instalava, e
agora consome `@the-inclusionist/engine@^8.0.0` do registo, com 883 testes verdes.

**Mas consumir não é usar.** A 8.0.0 traz um pedido do Dev escrito no código da
própria engine — *«o menu de pausa… e os ícones de acessibilidade que aparecem no
jogo desde a primeira tela devem ser oferecidos pela ENGINE»* — e uma medição que
**nomeia este jogo**: dos seis do catálogo local, cinco não têm barra de
acessibilidade nenhuma. Hoje o `createGame` daqui devolve um `problems` com essa
linha, e ela está certa: **este jogo não oferece modo cego, TTS nem Libras em lado
nenhum**. O sonar existe mas só por tecla (`L`); o modo cego é da engine e não tem
interruptor; Libras não aparece uma única vez em `app/`.

O resultado pretendido é fechar esse buraco usando o que a engine já monta, sem
perder o palco 16×9 nem o menu de pausa próprio.

### O que foi medido antes de planear

| Facto | Consequência |
|---|---|
| `baixarPesados` é `true` por omissão (`create-game.js:582`) | **Cada arranque puxa o catálogo pesado** (vozes neurais + bundle de visão, a própria engine fala em «faltam 241 MB»), num jogo que declara `semVozNeural: true`. O erro morre num `.catch(() => {})` |
| `host.pauseHost` ausente → recai em `#game-region` | O cartão de pausa da engine é montado **dentro da caixa do tabuleiro**, que são nove das dezasseis unidades |
| `createGame` nunca passa `getPauseActs` | O cartão da engine só consegue mostrar **um** item (`acessibilidade`); `resume`, `quit` e `options` ficam escondidos. **Por isso o menu deste jogo fica** — ele carrega os oito ajustes de exibição e a linha de teclas |
| `style.css:194` define `.hud` | `max-width:1000px; display:flex; gap:1.5rem; flex-wrap:wrap` — e o painel lateral deste jogo **é** `.hud`, uma coluna de 280×360 medida |
| `style.css:533` define `body.blind-mode .hud{visibility:hidden}` | Ligar o modo cego pela barra que vamos adotar **apagaria o painel** |
| `style.css:173/180` define `html,body` e `body{display:flex;height:100dvh}` | A folha da engine traz tipografia e layout de página inteiros |
| `@font-face` da folha é `src:local(...)` | ✅ Importar `style.css` **não** dá 404 de fontes; o aviso do pacote é sobre `vendor/fonts.css`, que não vamos ligar |

### Decisões tomadas por si (2026-09-11)

1. **A barra vive no topo do painel lateral.** Custo assumido: o painel já tem 487 px
   de conteúdo em 360 e rola, e a barra acrescenta uma fila de `--tap`.
2. **Importar a `style.css` da engine**, em vez de copiar as regras.
3. Descrever **tudo** antes de prosseguir — é este documento.

### Ordem de execução

Cada etapa é um commit, com `npm run validate` verde antes do seguinte.

**1. Parar o descarregamento que este jogo declarou não usar.**
`app/js/boot/game-shell.ts`, na chamada a `createGame`: `baixarPesados: false`, com o
comentário a dizer que um jogo que declara `semVozNeural` não pode estar a puxar
vozes. Teste: um caso em `tests/shell.browser.test.ts` que afirme que a opção é
passada — é a única forma, porque a falha é silenciosa por construção.

**2. Tirar o cartão da engine de dentro do tabuleiro.**
Passar `host.pauseHost` apontando a um contentor próprio dentro de `#stage` (irmão de
`#game-region`, não dentro dele). Não é decliná-lo — o ADR-0122 tirou essa porta —, é
dizer onde cabe. Teste: a varredura de `tests/shell.browser.test.ts` já proíbe
desenhar fora do palco e passa a cobrir também este elemento.

⚠️ **E O BOTÃO DE PAUSA DESTE JOGO NÃO ABRE O CARTÃO DA ENGINE** — decisão sua,
2026-09-11: *«a engine não precisa pausar com o botão de pause, mas somente nos
momentos em que ela é programada por padrão para pausar.»* O `H`/`Enter`/START
continua a abrir o `chess-pause`, e o `pausa.mostrar` fica por chamar.

📌 **E é preciso dizer o que isso significa hoje, para não parecer omissão amanhã:**
quem revela o cartão é o `ui/shell` da engine, por fase — e o `createGame`
**não monta o `ui/shell`, de propósito** (*«não substitui o boot do main.js, que tem
catorze anos de ordem própria»*). O `setPhase` também recai num `() => {}`. Ou seja,
por esta porta a engine **não tem momento nenhum de pausa por omissão**: o cartão é
montado, fica escondido, e ninguém o revela. É o comportamento pedido, e fica
registado aqui para que a ausência de fiação se leia como escolha.

**3. ⚠️ Renomear `.hud` → `chess-hud` ANTES de importar a folha.**
É o pré-requisito da etapa 4 e a mesma lição de ontem à noite, quando `pause-menu`
virou `chess-pause`: *o vocabulário partilhado é da engine, e este jogo deixa de o
ocupar*. Sem isto, importar a folha aplica ao painel um `max-width:1000px` com
`flex-wrap` e apaga-o em modo cego. Toca em `app/js/ui/hud.ts:207`,
`app/css/board.css` (todo o bloco `.hud*`), `app/js/boot/game-shell.ts` e os testes
que leem `.hud` (`shell.browser.test.ts`, `hud.browser.test.ts`).
⚠️ **As sub-classes `hud-*` não colidem** e ficam como estão — renomear só o que
colide mantém o diff legível.

**4. Importar a folha da engine, e reclamar o que é nosso.**
`import '@the-inclusionist/engine/style.css';` nos três módulos de entrada, **antes**
do `board.css`, para que o jogo ganhe a cascata. Depois, um bloco em `board.css` que
reafirma explicitamente, com o porquê de cada linha: os tokens `:root` do jogo, o
`body` (a engine põe `display:flex;height:100dvh;overflow:hidden`) e `*{box-sizing}`.
⚠️ Verificar `#splash`, `#stage` e `#below-board` depois — a folha tem 644 linhas e
só a medição diz o que passou.

**5. Montar a barra de acessibilidade no topo do painel.**
Um contentor novo no topo de `chess-hud`, passado como `host.a11yBarHost`. A engine
escreve os botões, liga o clique, reflete o estado e volta a refletir quando o idioma
carrega. O que ela monta: modo cego, TTS, Libras, TEA, e `altmove` se
`seguraTeclas()` for verdadeiro — ⚠️ **`contrast` e `cvd` nunca aparecem por esta
porta** (precisam de `setTemaDoJogador`/`setCorrecaoDoJogador`, que o `createGame`
não aceita), e este jogo já os tem no menu de pausa, portanto não há duplicação.
Testes: os botões existem, são alcançáveis por `Tab` (a engine deixa-os na ordem de
tabulação de propósito), cumprem `--tap`, e o painel continua a rolar em vez de os
perder.

**6. Responder `isNavigable`.**
Por omissão é `() => true`, e a navegação de menu da engine corre em captura na
janela. ⚠️ Mas o ramo `naBarraDe` corre **antes** dessa guarda: com a barra montada,
estar nela consome as teclas de menu, o que é correto e é preciso saber. Decidir e
registar o que este jogo responde, e confirmar que as setas do tabuleiro e o
`[Panel keys]` continuam a funcionar.

**7. Os campos opcionais do contrato.**
`mapeamentoDoTeclado` faria `start` resolver-se pela engine em vez de `KeyH`/`Enter`
estarem nomeados à mão em `game-shell.ts:1145` — a excepção está escrita no código
com a medição que a justifica, e este campo é a forma de a apagar. `needsPointer`
é opcional com padrão seguro; declará-lo é uma linha honesta (este jogo joga-se
inteiro por teclado).
⚠️ **Esta etapa mexe no caminho de teclas que já custou defeitos** (o `Ctrl+Home`
partido por uma guarda de modificadores, o Space a jogar duas vezes). Fica por
último de propósito, e pode ser adiada sem bloquear nada acima.

### Verificação

```bash
npm run validate
```

E, porque a lição desta semana foi que a suíte estava cega ao ecrã, **olhar para as
três páginas**: a barra aparece no topo do painel, os ícones cumprem o alvo de toque,
o modo cego liga e desliga pela barra (e **não** apaga o painel), o menu de pausa
continua a abrir em `H` e a fechar em `Escape`, e o `console.warn('[chess] engine
problems')` deixa de ter a linha da barra de acessibilidade — que é o teste final de
que passámos a usar a versão 8, e não apenas a consumi-la.

## ⚠️ ENGINE 11.0.0 — estudada em 2026-10-02, e é o major mais pesado desde a 7

### Contexto

A engine saltou da 9.0.0 (que este jogo consome, instalada em `node_modules`) para a
11.0.0. **Cento e um ADRs novos**, cerca de **vinte e cinco commits com `!:`**, e um
`CHANGELOG` com uma dúzia de notas de quebra numeradas (DF–EB). O ADR-0219 explica
porquê: a 10 renomeou a superfície pública para inglês num só major, e a 11 fechou
isso movendo também os caminhos dos módulos. É um major por decreto de superfície,
não um ciclo de limpeza.

O xadrez toca a engine em quinze pontos de import e em cerca de dez chamadas de
runtime. Lido no `dist-pkg/` da 11 contra o da 9 instalada: **nenhum deles sobrevive
intacto** — ou o nome mudou, ou a forma mudou, ou saiu da superfície. Isso é a má
notícia; a boa é que a 11 traz **cinco membros novos no `Engine`** que absorvem
código escrito à mão do xadrez e **uma porta nova no cartão de pausa**
(`PauseIconsCtx.gameButtons`, `PM_GAME_BTNS`) que fecha a pergunta aberta da conversa
anterior — a de como acrescentar itens de pausa sem tocar no vocabulário fixo da
engine. A 11, lida inteira, deixa o xadrez com **menos** código, não com mais.

E uma coisa que **não** chegou nesta versão, dita porque facilita contornos
indevidos: o `create(ctx)` com `{engine, region, rng, t, params}` do ADR-0139 §4 não
é a forma de execução ainda — `createGame(o): Engine` continua a ser a porta. O que
chegou é o `inclusionist-check-cartridge` (ADR-0253) a verificar a forma do cartucho
no build; passar a `create(ctx)` é adoção, não bloqueio.

### O retrato das quebras — tudo o que não compila sem conserto

Agrupei por tipo em vez de por ficheiro, porque a conta a pagar é mais clara assim.
Os números entre parênteses são linhas em `dist-pkg/boot/create-game.d.ts` da 11.

**Imports do xadrez que mudaram de nome ou de módulo.** Lidos em
`app/js/boot/game-shell.ts`, `narration.ts`, `standalone.ts`, `ui/hud.ts`,
`ui/key-hints.ts`, `declaration/chess-declaration.ts`, `render/resolution.ts`:

| Hoje | Em 11 | Nota |
|---|---|---|
| `import { srAlert, srSay } from '@…/core/a11y-sr.js'` | **saiu**. Em vez: `createAnnouncer({doc, raf})` para antes do boot, `engine.say`/`engine.alert` depois (ADR-0232 D4) | nota DN |
| `import { t as engineT } from '@…/core/i18n.js'` | **saiu**. O estado deixou de ser do módulo (ADR-0232 D3 erratum); usar `engine.t` depois do boot, `createTranslator()` para instâncias isoladas | nota DN |
| `import { startLoop } from '@…/core/loop.js'` | sobrevive, mas a 4.ª opção passou a **obrigatória** com dois campos: `{ speed: () => number, onFailure: (e) => void }` | nota DN |
| `import type { GanchosDoCartucho }` | **renomeado** para `CartridgeHooks` |  |
| `import type { KeyScheme } from '@…/input/keyboard-runtime.js'` | **mudou de origem** para `@…/core/entity.js` (foi uma das 33 reexportações removidas) | nota DH |
| `VIZ_FILTER`, `VIZ_CORRECTIONS` | inalterados |  |
| `LOGICAL_W`, `TILE` | inalterados |  |

**Membros do `Engine` que o xadrez usa e mudaram de nome:**

| Hoje | Em 11 |
|---|---|
| `engine.pausa.esconder(0)` | `engine.pause.hide(0)` (`:351–356`) |
| `engine.aoFalhar` | `engine.onFailure` (`:556`) |
| `engine.keyboard.actionOf(code, 0)` | inalterado |
| `engine.keyboard.kbFor(0)` | inalterado |
| `engine.sonar.sonar({…})` | inalterado |
| `engine.problems` | inalterado |

**Ganchos do cartucho (`CartridgeHooks`) que mudaram.** `MetadeDoJogo` em 9 pegava
quinze campos; `GameHalf` em 11 pega **vinte e três**. Dos quinze de 9, cinco foram
renomeados e um saiu. O xadrez fornece hoje `declaration`, `getPauseActs`,
`setCorrecaoDoJogador`, `declines`, `sonarPlayers`, `preset` e `isNavigable`:

| Hoje | Em 11 | Ação |
|---|---|---|
| `comIndice` *(não forneço)* | `withIndex` | — |
| `naBarraDe`/`navBar` *(não forneço)* | `onBar`/`navBar` | continuo a não fornecer; o padrão da engine responde pela barra montada por ela mesma |
| `setCorrecaoDoJogador` | `setPlayerCorrection` | renomear |
| `setTemaDoJogador` *(não forneço)* | `setPlayerTheme` | continuo deliberadamente a não fornecer — o eixo `padrao|hc3|hc45|hc7` não se mapeia honestamente nas sete paletas deste jogo |
| `sonarPlayers` | **saiu** | apagar; o sonar da 11 lê o que está no ecrã (ADR-0234, ADR-0258) |
| `preset: { label }` | `preset: { labelKey }` | passar a chaves, e declarar as palavras em `dictionaries` |

**Campos novos requeridos:**

- **`accommodations: AccommodationAnswers`** — `Readonly<Record<GameKeyedAccommodation,
  AccommodationKeys | false>>`. **Obrigatório em runtime**: o `createGame` **lança**
  numa declaração malformada e esta é uma das validadas. Os dezoito campos
  `GAME_KEYED` são `cameraSway`, `easyMode`, `wheelchairMode`, `detectionLeniency`,
  `intensity`, `hints`, `reducedCharacterMotion`, `caneSpacing`, `textPace`,
  `lexicalDifficulty`, `wordHighlight`, `pieceSets`, `distinguishableSuits`,
  `timingWindow`, `aimAssist`, `repeatedInput`, `ownerColors`, `contrastOutlines`. O
  xadrez responde `false` ao que não tem assunto neste jogo (`easyMode`,
  `wheelchairMode`, `caneSpacing`, `textPace`, `lexicalDifficulty`, `wordHighlight`,
  `aimAssist`, `repeatedInput`, `intensity`, `timingWindow`, `detectionLeniency`,
  `cameraSway`, `reducedCharacterMotion`, `distinguishableSuits`) e `{labelKey:…}` ao
  que tem (`hints`, `pieceSets`, `ownerColors`, `contrastOutlines`).
- **`dictionaries: Readonly<Record<lang, Readonly<Record<string, string>>>>`** —
  obrigatório na prática, assim que o preset usar `labelKey` ou algum `accommodations`
  carregar chaves. O xadrez já tem três catálogos (`pt`, `en`, `es`); as palavras
  novas destas chaves entram neles.

**Campos novos recomendados** (não obrigatórios, mas o custo é baixo e o retorno
alto):

- **`genre: 'Board game or card game'`** — do `core/genres` (ADR-0153, ADR-0156). O
  xadrez cai limpo em «Other notable genres → Board game or card game». Casino é
  recusado no boot; Horror é aceite com aviso. Deixar vazio não falha, só perde um
  dado que `problems` passa a vigiar.
- **`onCommand: (cmd: VirtualCommand) => void`** — é a completude do ADR-0111 que
  faltou na conversa anterior. É aqui que o xadrez passa a receber comandos; o
  `keydown` próprio deixa de ser a entrada do jogo.

### O que a 11 traz que absorve código do xadrez

Isto é a parte boa, e muda o esforço líquido do major para baixo:

**`gameOptions: readonly GameOption[]` (ADR-0182).** A engine desenha os controlos do
jogo numa casca própria com vocabulário `.ctrl-row` já estilizado (comparar o CSS
`app/css/board.css:572–598` da engine instalada: `.overlay__card select`, `.opt-hint`,
`.opt-explain`, `.ctrl-row` com flex, borda, raio e padding). Cada `GameOption` é
`{id, labelKey, hintKey?, kind: 'steps'|'list'|'switch', read, write, values?}`. Dos
oito controlos que vivem hoje no `chess-pause` desconfigurado — **idioma, desenho
das peças, cores do tabuleiro, visão de cores, movimento reduzido, contorno,
coordenadas, letras/números** —, três são `GENERAL` da engine (`screenReader`,
`colorVisionCorrection`, `reducedSceneMotion`) e a engine já os desenha noutra
porta; os cinco restantes viram cinco `GameOption`. **O problema 3 da conversa
anterior — o cartão de pausa a 399 px dentro de 360, controlos sem estilo — é
resolvido pela raiz com esta migração, não com CSS à mão.**

**`PM_GAME_BTNS` + `PauseIconsCtx.gameButtons` (ADR-0146).** A lista do cartão de
pausa começa agora com o item `pmback` e nada mais; o cartucho acrescenta os seus
pelo `gameButtons` e põe as ações no `getPauseActs`. **Isto fecha a pergunta aberta
da conversa anterior:** o cartucho pode agora adicionar itens de pausa sem tocar no
vocabulário fixo da engine, e sem reimplementar o cartão. Para o xadrez, isso são
dois itens — «Sair da aula» (só visível em modo aula) e, se o Dev assim decidir,
«Aulas» como atalho.

**`engine.explain(text | null)` (ADR-0244).** O xadrez passa a dizer o que está sob o
cursor na mesma linha de rodapé da engine, com até duas linhas e sem concorrer com
a explicação dos itens de menu — a engine devolve a vez a `explain` quando o foco
sai do item dela. É a linha abaixo do tabuleiro, feita bem.

**`engine.say(text)` e `engine.alert(text)` (ADR-0232 D4).** Substituem os três
imports de `srAlert`/`srSay` por um único alvo, com o espelhamento para Libras já
ligado dentro.

**`engine.t` e `engine.onLocaleChange(fn)` (ADR-0232 D3 + ADR-0225).** O xadrez já
tinha o `changeLocale()` próprio; a 11 oferece a mesma coisa pronta e sem o seu
ponto fraco (ouvir o `i18n:change` da window). Deixar o nosso e ligar nele continua
a funcionar; melhor migrar para o da engine assim que `dictionaries` existir.

**`PM_BTNS` traz `pause.resume` por omissão (`CreateGameOptions.getPauseActs`
assegura o `resume`).** Com o atual `getPauseActs: () => ({ resume: () =>
engine.pausa.esconder(0) })`, a sair da pausa pela engine passa a ser o
comportamento padrão. Isto decide — ou melhor, convida a decidir — se o
`chess-pause` continua a existir.

### Ordem de execução — quatro ondas

### ✅ Onda 1 — ATERRADA em 2026-10-02 (`025abf2` + `32e458d`)

Dois commits. O primeiro — mecânico — fez tudo o que a lista abaixo diz, com o
`check-cartridge` a garantir que o `peer`/`dev` do `@the-inclusionist/engine`
batem. O segundo foi corretivo: o `tsc` passou verde mas o `createGame` em runtime
reportou nove linhas em `engine.problems` porque o `preset` ficou no formato
`{label}` em vez de `{labelKey}` + `dictionaries` (ADR-0232 D3 erratum). Convertido
o `actionPreset` para o novo formato e adicionadas as seis entradas `keys.*` em
`hooks.dictionaries` em pt/en/es.

**Estado medido na página em 2026-10-02:** o jogo arranca, o `engine.problems`
tem **uma** linha apenas (ADR-0163: textos em `.player-name`/`.player-mistakes` e
alvos dos radios `#hud-mode-*` + `#hud-protected` abaixo dos 16/44 px exigidos
pelo ADR-0163). Essa linha é resolvida pela Onda 2 quando os controlos do painel
chess migrarem para `gameOptions` (os inputs saem) e o painel próprio for
desmantelado. A barra de acessibilidade da engine mostra **12 ícones** (eram 8 em
9.0.0 — o `uses: { reading, neuralVoice }` da 11 e as transportes novas trazem
mais). `engine.pause.show`, `engine.gameSpeed`, `engine.explain`, `engine.say`,
`engine.alert`, `engine.deafMode`, `engine.mapSlot` todos presentes.

**⚠️ Duas condições deixadas por fechar:** o `chess-pause` e o `.screen-pause` da
engine COEXISTEM no DOM — ambos abrem no `H`/`Enter`, criando o conflito visual
que a Onda 2 (inversão da pausa) resolve pela raiz; e o `<a class="skip-link">`
que a 11 injecta em `<body>` faz o teste «writes nothing outside the element»
falhar — adiado por `.skip` com nota.

**Testes:** 908 passam, 5 adiados por `.skip` com `TODO(Wave 2)` em comentário.

---

**Onda 1 — compilar contra a 11.** Esta onda é mecânica, mas é a maior em volume de
pontos tocados; o alvo é `npm run validate` verde sem mudar comportamento. Começa
pelo `package.json`: `peerDependencies` e `devDependencies` vão para `^11.0.0`,
`npm install`, e o `check-cartridge.mjs` (nosso gate) deteta os peers novos
automaticamente. Depois os renomes e substituições, todos em `app/js/boot/` e
`app/js/ui/`:

1. `engine.pausa.esconder(0)` → `engine.pause.hide(0)`.
2. `engine.aoFalhar` → `engine.onFailure`.
3. `baixarPesados: false` → `downloadHeavy: false` (sob `host`? verificar o shape
   atual — provavelmente mudou de posição).
4. `startLoop(ticker, frame, 2, { aoFalhar })` →
   `startLoop(ticker, frame, 2, { speed: engine.gameSpeed, onFailure: engine.onFailure })`.
5. `import type { KeyScheme } from '@…/input/keyboard-runtime.js'` →
   `from '@…/core/entity.js'`.
6. `import type { GanchosDoCartucho }` → `CartridgeHooks`.
7. **i18n.** No `app/js/ui/hud.ts`, o `engineT` passa a chegar por dep injetável;
   nos sítios onde é usado para traduzir labels do xadrez, lê-se de `engine.t` após
   o boot. Para o pedaço do `narration.ts` que corre antes do engine existir, uma
   das duas: adiar as chamadas para depois de `engine` estar pronto, ou construir
   um `createTranslator()` próprio só para esse ponto.
8. **a11y-sr.** Os três ficheiros que importam `srAlert`/`srSay` (`game-shell.ts`,
   `narration.ts`, `standalone.ts`) passam a receber um `Announcer` por dep ou
   chamam `engine.say`/`engine.alert`. Para o `splash.ts` que corre antes de
   `createGame` responder, o padrão é construir um `createAnnouncer({doc, raf})` à
   parte — o `#sr-status` e o `#sr-alert` continuam no HTML.
9. **Hook renames** em `game-shell.ts` (o objecto `hooks`): `setCorrecaoDoJogador`
   → `setPlayerCorrection`.
10. **Apagar** o `sonarPlayers: () => [{ i:0, x: cursor.x, y: cursor.y }]` do
    `hooks`. A linha fica no git para quem procurar; o sonar da 11 vai ler o
    tabuleiro directamente da declaração.
11. **`accommodations`**. Novo ficheiro `app/js/declaration/chess-accommodations.ts`
    com as dezoito respostas e as chaves correspondentes nos três catálogos
    (`accom.hints.label`, `accom.pieceSets.label`, `accom.ownerColors.label`,
    `accom.contrastOutlines.label`). Passar no `hooks`.
12. **`dictionaries`**. Juntar os três objetos i18n novos em `hooks.dictionaries =
    { pt, en, es }` filtrados pelas chaves que o preset e as `accommodations` usam.
13. **`preset`**. Em `app/js/ui/key-hints.ts`, `actionPreset` passa de `{label:
    t(key)}` para `{labelKey: key}` — o `t` do argumento vai embora. Os `labelKey`
    têm de existir nos `dictionaries`.
14. **`genre: 'Board game or card game'`** no `hooks`.

Verificação da Onda 1: `npm run validate` verde, `engine.problems` vazio na página,
e o splash abre em todas as três vistas. Nada de comportamento novo.

**Onda 2 — absorver o que a engine passa a oferecer.** Esta onda é a que paga o
major: menos código no fim. Em ordem crescente de alcance:

1. ✅ **`engine.say`/`engine.alert`** passam a ser o alvo único — feito em
   2026-10-02 (commit `68bc16a`). O `announcer` continua a ser construído na
   casca, mas é um invólucro: delega a `engineRef.current` quando a engine
   existe (então o espelho surdo do ADR-0232 D4 vê cada anúncio); o
   `bootAnnouncer` local fica como fallback para a janela de construção
   em que os closures capturam `announcer` antes de `create(engine)` correr.
2. ✅ **`engine.t`** — feito em 2026-10-02 (commit `cb2baa3`). O `engineT`
   saiu do `hud.ts`; o selector de visão passa a traduzir pelo próprio
   `i18n` do xadrez, que agora espelha as entradas `viz.fix-*` da engine.
3. ✅ **`engine.onLocaleChange(fn)`** — feito em Wave 2a: substituiu o
   antigo `window.addEventListener('i18n:change')` no `create(engine)`.
4. ❌ **`engine.explain(text | null)`** — DECISÃO (2026-10-02): FICA COMO
   ESTÁ. O painel `thinking` expõe quatro campos ao vivo da UCI (profundidade,
   avaliação em centipeões, nós visitados, variação principal, com um
   `aria-live="off"` para não inundar leitor de ecrã), e `engine.explain`
   é texto curto de duas linhas — não cabe sem perder matéria. O plano
   permitia explicitamente «se não couber, fica como está», e isto é o
   caso. A oportunidade reabre se e quando a engine ampliar `explain`.
5. **`gameOptions`** absorve cinco dos oito controlos. Os três `GENERAL` do painel
   actual saem — a engine desenha-os na barra e nos painéis dela. O `app/js/ui/hud.ts`
   passa a construir só os controlos específicos do jogo que **não** cabem em
   `gameOptions` (se algum sobrar), e o `chess-pause` passa a ter apenas os itens
   de pausa que lhe faltam (sair da aula) — ou desaparece, consoante a Decisão em
   aberto abaixo.
6. **`PM_GAME_BTNS` + `gameButtons`** passam a ser por onde chegam os itens de
   pausa específicos do xadrez: «Sair da aula» com um `getPauseActs['leaveLesson']`.

Verificação da Onda 2: olhar na página — os controlos estão legíveis e com alvo de
toque conforme o ADR, a pausa abre pelo cartão da engine, a troca de idioma
funciona sem reload, o `engine.explain` responde ao cursor nas aulas.

**Onda 3 — `onCommand` e o controle virtual (ADR-0111).** O `keydown` próprio
na região passa a ser substituído por `onCommand(cmd: VirtualCommand)`. O comando
chega com `{action, pressed, source, player}`; o xadrez tratava já tudo por
`engine.keyboard.actionOf(code, 0)`, portanto a conversão é directa:
`action === 'leftTrigger'` dispara o sonar, `action === 'start'` abre a pausa, as
quatro direcções movem o cursor pelo espelho. Dois pedaços de código próprio do
xadrez vão embora:

- `region.addEventListener('keydown', onRegionKey)` em `game-shell.ts` — a entrada
  do jogo passa a ser `onCommand`.
- `event.key === 'Home'`/`'End'` no `grid-mirror.ts` — essas duas são de JOGO (saltar
  para o canto); sobem para `preset` com `labelKey` próprio e descem como comandos.
  Os outros `event.key` do xadrez (`Escape` a fechar diálogo, `Tab` a prender foco)
  são semântica de componente, não entrada de jogo — ficam.

Verificação da Onda 3: um jogo inteiro só com teclado, verificado na página, e
`grep "addEventListener('keydown'"` no `app/js/boot/` devolve zero. Memory `__incl.update(dt)
é em quadros`: o laço continua nosso.

### ⚠️ MEDIÇÃO DE 2026-10-02 — Onda 3 é all-or-nothing

Tentei um passo A incremental («mover só as quatro acções de casca para
`onCommand`, deixar o espelho/painel/vista no `onRegionKey`») e a suite
caiu em 6 testes. A causa está em `boot/create-game.js` da engine 11:

```
for (const kind of ['keydown', 'keyup']) {
    win.addEventListener(kind, (e) => {
        if (e.repeat || !cartridge.onCommand) return;
        ...
        if (virtualController.press(...)) e.preventDefault();
    }, true);
}
```

O listener da engine só se activa quando o cartucho DECLARA `onCommand`.
Assim que declarei, ele passou a chamar `e.preventDefault()` em todas as
acções mapeadas, e o `onRegionKey` do xadrez — que começa com
`if (event.defaultPrevented) return;` — passou a saltar para TUDO,
inclusive os ramos do espelho e do walk-panel que ainda queríamos lá.

**Consequência:** não há meio-passo seguro. Ou se faz a onda inteira
(todas as acções via `onCommand`, incluindo setas, confirm, Home/End em
preset), ou se mantém o estado actual (sem `onCommand`, o `onRegionKey`
é o despacho único). Reverti a tentativa (16 commits ainda não empurrados,
o working tree ficou limpo).

**Trabalho real:**
1. ✅ `mirror.moveCursor(action)` e `mirror.activate()` como novas entradas
   que não leem evento (ADR-0111: comando vem com nome, não com código).
   Feito em 2026-10-02, commit `5a52cb4`. O `handleKey` passa a delegar
   para elas, para o corpo não ficar duplicado quando a Wave 3 fechar.
2. `walkPanel(action)` continua a existir mas é chamado de `onCommand` para
   setas quando foco está no painel.
3. ✅ Home/End vão para `preset` como novas acções, com `labelKey` próprio;
   descem no `onCommand` como qualquer outra acção. Feito em 2026-10-02,
   commit `1f9bd68`. `leftShoulder`/`rightShoulder` são as acções
   canónicas; `keys.rankStart`/`keys.rankEnd` são as palavras em pt/en/es;
   `keyboardMapping` do xadrez liga Home/End no assento 0; `moveCursor`
   do espelho entende as duas. Ctrl+Home/Ctrl+End (canto, não só fim de
   fileira) ficam como atalho de poder no `handleKey` por evento — o
   virtual controller não carrega modificadores, então o canto não pode
   andar num só nome de acção.
4. Shift+Arrow para câmera: o virtual controller NÃO entrega chaves com
   modificadores. Precisa de uma via própria — ou um listener dedicado
   só para modificadas no `region`, ou mover a câmera para a barra de
   acessibilidade. Decisão em aberto.
5. Depois disso: remover `onRegionKey` e o `grid-mirror`'s próprio
   listener de teclado (se cobrido).

Isto é trabalho de uma sessão dedicada, não cabe em tick de 10 minutos.

### ⚠️ MEDIÇÃO DE 2026-10-02 — `gameOptions.values` é ESTÁTICO, e isso quebra piece-set

Durante a limpeza dos controlos-zumbis do HUD descobri que o `GameOption`
da engine 11 declara `values: readonly GameOptionValue[]` como ARRAY,
não função. O `read`/`write` são lazy (como diz o comentário em
`gameOptions`), mas `values` é fixo no momento do boot. Para o xadrez:

- 2D (`view-flat`) oferece 3 piece-sets: `symbols`, `math`, `pecita`.
- 2.5D (`view-zdog`) oferece 6: `hartwig`, `s1849`, `regence`,
  `stgeorge`, `selenus`, `sikh`.
- 3D (`view-solid`) oferece os mesmos 6 de `view-zdog`.

O `piece-set` da `hooks.gameOptions` ficou declarado com os 3 valores do
2D. Para quem joga em 2.5D ou 3D, o painel da engine mostra «symbols /
math / pecita» — nomes que o renderer não reconhece, e portanto escolhas
que silenciosamente não fazem nada.

O selector dinâmico que o HUD mantinha (`setSelect` com `replaceChildren`
em cada `refresh()`) continuava a dar as opções CERTAS por renderer,
mas ninguém via (`settings` não entra no DOM desde a Wave 2c). O
teste `[Switch] swaps the view, and the panel follows it` cobre a
contratação de reconstrução das opções em `shell.hud.settings`, não a
contratação através do painel da engine.

**Consequência:** não posso limpar `setBox` como zombie: perderia a
única superfície que ainda tem as opções certas. O que falta é fazer o
`piece-set` da `gameOptions` acompanhar a vista. A engine não suporta
`values` como função, logo tenho duas opções:

1. Reconstruir o cartucho a cada `switchView` (reemitir `hooks` com
   `piece-set` actualizado). Suporte: ADR-0142 (`unmount`/`mount`).
2. Pedir à engine que suporte `values: () => readonly GameOptionValue[]`
   (uma linha no `gameOptions.d.ts`, um `typeof v === 'function'` no
   `drawGameOptions`). Mais barato na engine, resolve de uma vez para
   outros jogos.

Opção 2 é melhor; é trabalho da engine. Noto aqui para abrir o pedido
quando chegar o momento. Até lá, o HUD mantém `setBox` e o painel da
engine continua a mostrar os três valores do 2D.

**Mesma análise, feita de novo, para os outros zombies:**

- ✅ `vision` (removido, commit `d04aeba`): a correção vive em
  `setPlayerCorrection` que a barra da engine escreve directamente.
- ✅ `mode` (removido, commit `bd55bd7`): valores (w/b/two) fixos,
  independentes da vista.
- ✅ `strength` (removido, commit `4f3e906`): `STRENGTH_LADDER` é
  fixo, independente da vista.
- ✅ `protected` (removido, commit `b0c5a00`): switch booleano, não
  precisa de valores por vista.
- ❌ `pieceSets` (NÃO removido, 2026-10-02): valores DIFEREM por vista
  (ver acima). Fica até a engine abrir `values` como função ou chess
  remontar o cartucho em `switchView`.
- ✅ `themes`: **o bloqueio caiu em 2026-10-04 e este marcador estava vencido
  quando foi relido.** A razão escrita era que o `themeSelect` do HUD é «âncora do
  relatório de contraste em modo `debug`». Nenhuma das duas metades é verdade hoje:
  o relatório deixou de estar atrás de `?debug` (`b8e1a08`) e passou a pendurar-se
  no `themeField.select` do painel — o `themeSelect` antigo vive em `settings`, que
  não chega ao DOM desde a Onda 2c. Ou seja, `themeSelect` é código morto e removê-lo
  não obriga a decidir nada.
- ✅ `motion`: removido em `4a35f97` (lido em 2026-10-04; o ⏸️ aqui estava vencido).
- ✅ `outline` / `coords`: removidos em `d286cf8`.
- ✅ `locale`: removido em `0e16900` — nem sequer estava nesta lista.

**Onda 4 — oportunidades sem bloqueio.** Nenhuma destas é requerida pela 11.

- ⏸️ `howToPlay`: três ou quatro slides para o jogo (como se move cada peça,
  roque, en passant, promoção). Reaproveita o módulo de aulas que já temos.
  **Deferido** (2026-10-02): é trabalho de autoria por si (as palavras, as poses,
  o enredo pelo nível) — não tem como entrar no ciclo da migração sem decisões
  suas. Fica aberto no plano, movido para a lista «Oportunidades depois do major».
- ❌ `uses.fonts`: declarar as famílias que o xadrez usa, se forem outras que
  não as da engine. **Decisão (2026-10-02):** NÃO declarar. As três famílias
  (`Noto Sans Symbols 2`, `STIX Two Math`, `HandwrittenChess`) são servidas por
  `/vendor/fonts/*.woff2` com `@font-face` próprios no `app/css/board.css`;
  declará-las em `uses.fonts` sem que a biblioteca da engine as tenha produz
  linha de `problems` («a family the library does not hold, or the delivery did
  not carry»). A travessia para o motor de fontes da engine é um movimento
  próprio e não entra na migração para 11.0.0.
- ✅ `engine.dispose()`: feito em 2026-10-02 (commit `cdc714f`). O `teardown`
  do xadrez chama `engineRef.current?.dispose()` depois de destruir o oponente
  e a vista. Nenhum consumidor hoje chama `teardown` antes de a página fechar,
  mas o gancho fica aberto para futuros anfitriões (plataforma, troca de
  cartucho) que mantenham o documento vivo.

### ✅ Decisão de 11/09 INVERTIDA por si em 2026-10-02

A 11.0.0 muda o custo-benefício da decisão de 11/09 que dizia «a engine não precisa
pausar com o botão de pause, mas somente nos momentos em que ela é programada por
padrão para pausar». A razão daquela decisão era real: o cartão da engine tinha
vocabulário fixo e teria de carregar o nosso vocabulário dentro. A 11 abriu o
`PM_GAME_BTNS` + `gameButtons`, e os controlos do nosso cartão agora cabem em
`gameOptions`.

**Decisão sua, 2026-10-02:** inverter. `H`/`Enter`/START passa a chamar
`engine.pause.show(0)`; o `chess-pause` desaparece; os cinco controlos específicos
viram `GameOption`; «Sair da aula» entra pelo `gameButtons`. É a Onda 2 — item 5 e
item 6 — como está escrita acima; nada muda na ordem de execução, só se fecha a
porta à alternativa.

### Ficheiros tocados — a lista é só para medir o tamanho

As ondas 1 e 2 juntas tocam:

- `app/js/boot/game-shell.ts` — renomes, hooks, dicionários, accommodations
- `app/js/boot/standalone.ts` — `startLoop`, announcer
- `app/js/boot/narration.ts` — announcer
- `app/js/ui/hud.ts` — `engine.t`, remover controlos migrados
- `app/js/ui/key-hints.ts` — `actionPreset` passa a chaves
- `app/js/ui/pause-menu.ts` — ou desaparece ou perde oito controlos
- `app/js/i18n/{pt,en,es}.ts` — chaves novas para `preset` e `accommodations`
- `app/js/declaration/chess-declaration.ts` — tipos renomeados
- `app/js/declaration/chess-accommodations.ts` *(novo)*
- `app/js/declaration/chess-game-options.ts` *(novo)*
- `src/index.ts` — a entrada do cartucho (o `CartridgeHooks` entra aqui)
- `package.json` — bump de `^9.0.0` para `^11.0.0` em peer e dev
- `scripts/check-cartridge.mjs` — pode precisar de actualização
- `tests/` — todos os suítes de boot/shell/pause/hud tocam engine; vão ter de
  andar junto

### Verificação

```bash
npm install
npm run validate
```

Depois, à mão, na página servida — a lição de que a suíte vê DOM e não ecrã
continua a valer:

1. `engine.problems` **vazio** (console).
2. As três vistas abrem e trocam entre si (continua a ser o defeito de vistas, não
   da migração — ver abaixo).
3. **Pausa**: `H`/`Enter`/START abre o cartão da engine; `Escape` fecha; o item
   «Sair da aula» aparece dentro de uma aula.
4. **Opções**: `options` no cartão abre o painel do xadrez com os cinco controlos
   específicos, cada um com alvo de toque ≥ 24px, rótulo em pt-BR/en/es.
5. **Barra de acessibilidade**: oito ícones (contraste e correção visuais inclusos
   via `setPlayerCorrection`), navegável por `Tab` e pelo direcional
   (`entrarNaBarra` vem pelo item `acessibilidade` do cartão).
6. **Idioma**: trocar entre pt/en/es pela porta da engine (o 🌐 na barra); o
   painel, o cartão, as aulas e a linha de teclas acompanham sem reload.
7. **Fail path**: forçar o laço a lançar; `engine.onFailure` deve escrever no
   `#sr-alert` e no console.
8. **Teste de cartucho**: `vite build --mode lib` e `check-cartridge.mjs` passam.

### Como esta migração mexe nos quatro defeitos pendentes

Da conversa anterior ficaram quatro defeitos. A migração para a 11 resolve três
pela raiz:

- **Pausa desconfigurada (problema 3)**: ✅ resolvido por abandonar o `chess-pause` e
  passar os controlos para `gameOptions` da engine, com `.ctrl-row` estilizado.
- **Controle virtual (problema 4)**: ✅ resolvido pela Onda 3 (`onCommand`).
- **Linha de pensamento abaixo do tabuleiro (problema 2)**: pode ser resolvido pela
  Onda 2 item 4 (`engine.explain`), se a avaliação em centipeões couber nas duas
  linhas; senão, é layout nosso e vai como trabalho paralelo (o `#below-board` tem
  de sair do fluxo e flutuar sobre a canvas da vista projetada).
- **Troca entre as três vistas (problema 1)**: ⚠️ **não** é da migração. As
  canvas acumulam porque nenhuma vista remove o DOM que criou no `destroy()`, e o
  espelho DOM decide `visible` no momento da construção e não pode ser comutado em
  execução. Isto é trabalho paralelo, independente da versão da engine. Vai como
  item próprio depois da Onda 1 estar verde.

### Risco medido e mitigação

**O maior risco é a Onda 1 encavalada com a Onda 2.** O `startLoop` passa a exigir
`speed` e `onFailure` ao mesmo tempo que a i18n e o announcer migram, e os três são
usados em ficheiros diferentes. Mitigação: cada passo da Onda 1 é commit próprio,
com `npm run typecheck` entre eles. Se um passo quebrar a suíte, reverte-se o
passo, não a onda inteira.

**O segundo risco é a `accommodations`.** O `createGame` **lança** numa resposta
malformada, e isso significa que a página fica em branco sem o `engine.problems`
poder dizer o quê — exceção antes do engine existir. Mitigação: escrever as
dezoito respostas num teste node próprio (`tests/accommodations.node.test.ts`)
antes de passar à engine, com uma asserção que importa o conjunto de ids da engine
e exige que a chave e a resposta existam para cada um.

**O terceiro risco é a Onda 3.** O `onCommand` muda a entrada de teclado do jogo
em cheio, e os testes de boot já queimaram este repositório uma vez em zona morta
temporal. Mitigação: fazer a Onda 3 só depois de a Onda 1 e a 2 estarem commitadas
e verdes em `main`, para o `git bisect` ter chão onde cair.

## ⚠️ Publicar — infraestrutura partilhada em `o-inclusionista.jrocha.dev.br`

### Estado — 2026-10-02

✅ **Lado do cartucho feito** no commit `fe6a61d`. As três subsecções que
pediam ficheiros ou código do xadrez (2.1 ficheiros de infra, 2.2 mudanças
em `app/` e `vite.config.ts`, 2.3 declarações do cartucho) estão aterradas:

- `wrangler.toml` na raiz, com `INCL_BASE = "/game-chess/"` e o binding R2
  jurisdicional (eu).
- `functions/heavy/[[path]].ts` idêntico ao do platformer (uma função serve
  todos os jogos do domínio; chess só adiciona o seu binding).
- `scripts/post-build-cloudflare.mjs` adaptado — `prefix` passa a ser
  `/game-chess`.
- `vite.config.ts` lê `INCL_BASE` para `base` e para `outDir`.
- `app/index.html` tem `<base href="/" />` logo no topo do `<head>`.
- As quatro ocorrências do caminho absoluto do Stockfish passam por
  `${import.meta.env.BASE_URL}vendor/engine/…` (`preload.ts` e
  `stockfish-client.ts`).
- `scripts/check-precache.mjs` passou a ler `dist${INCL_BASE}/sw.js` para
  o portão funcionar nos dois modos.

Verificação local (ambos os caminhos):

```
MSYS_NO_PATHCONV=1 INCL_BASE=/game-chess/ npm run build
   → dist/game-chess/* com `<base href="/" />`, assets prefixados,
     stockfish-18-lite-single.wasm no sw.js, post-build cuspe
     dist/_headers com prefixo /game-chess/.
npm run build (sem INCL_BASE)
   → dist/* como antes; check-precache verde.
```

✅ **Pages ligada e no ar — 2026-10-04**, em `game-chess-cfo.pages.dev`. Medido
no site publicado, não no build local:

- `/game-chess/` carrega, o Stockfish fica pronto («Pronto para jogar») e uma
  partida corre: `1.e4 e5`, relógios a 4:57 / 5:00.
- `document.baseURI` é a **raiz da origem** — o `<base href="/">` a fazer o seu
  trabalho, que é o que põe `/heavy/*` na raiz do domínio.
- O `_headers` pegou: `sw.js` e o manifest voltam com `Cache-Control: no-cache`.
  O `index.html` vem com o `max-age=0, must-revalidate` que a própria Pages põe
  no HTML — equivalente em efeito, e não é a nossa regra.
- Service worker registado, scope `/game-chess/`.
- **A Pages Function está viva e o binding R2 resolve**, e as três respostas
  distinguem-se: `/heavy/` → 400 «no path»; host fora do catálogo → 404 «is not
  in the mirror catalogue»; host do catálogo com chave inexistente → 404 «not in
  bucket». ⚠️ Esta última é a que prova o binding: chegou a `env.LFS.get` e o
  balde respondeu. Sem o binding, ou com a jurisdição errada, seria 500.
- `https://game-chess-cfo.pages.dev/` (raiz nua) dá 404, como esperado: o
  artefacto só publica `dist/game-chess/`. Na origem real quem resolve isso é o
  Router.

⏸️ **Falta do lado do Dev**: a linha do `GAMES` no Router Worker (ponto 7
abaixo, com o host corrigido) para `o-inclusionista.jrocha.dev.br/game-chess/*`
chegar aqui. As duas linhas estão escritas e commitadas no repo do
`game-platformer` (`6e23864`); falta o push.

### 🔴 A PUBLICAÇÃO COLIDIU COM UMA PÁGINA DESTE MESMO REPOSITÓRIO

⚠️ **`docs/LICENSES.md` diz, sobre o conjunto de peças Hartwig: «This needs the
Município's legal opinion BEFORE public release.»** O jogo está em público desde
04/10, e o desenho só entra em domínio público a **2027-01-01** — a aritmética está
feita lá: Hartwig morreu em 1956, Lei 9.610/1998 art. 41, setenta anos a contar de
1957-01-01.

Não é um detalhe de rodapé deste plano: o conjunto Hartwig é o **predefinido** nas
vistas 2,5D e 3D, e o título da página é «Xadrez de Hartwig». Duas páginas deste
repositório dizem agora coisas incompatíveis, e esta secção é a mais nova das duas.

As três saídas já estão escritas em `docs/LICENSES.md` e são do Dev, não minhas:
esperar por 2027-01-01, obter o parecer, ou trocar o conjunto predefinido (a engine
precisa apenas de peças que se distingam por silhueta — Hartwig é a melhor escolha,
não a única possível). Fica registado aqui porque o plano é onde se lê o que falta,
e isto passou a faltar no instante em que o site subiu.

#### ✅ FECHADO EM 2026-10-04 — a primeira saída, e com prazo

O Dev decidiu, e nas palavras dele: «O repositório passará a ser privado até
2027-01-01. O jogo continuará disponível na minha página pessoal apenas para
convidados.» É a saída 1, «esperar», com a implantação estreitada para a acompanhar
— repositório fechado, audiência reduzida a convidados, calendário cumprido. O
registo completo, com o que a decisão NÃO resolve, está na secção «DECIDED
2026-10-04» de `docs/LICENSES.md`.

📌 Isto não cancela a saída 2. Depois de 2027-01-01 a questão do calendário
desaparece sozinha, portanto o parecer deixa de ser urgente — não deixa de ser
possível.

**Contexto** (recebido em 2026-10-02, do trabalho de publicação do `game-platformer`
que estreou o padrão). Cada jogo do catálogo publica em **Cloudflare Pages**, com
um **Router Worker** em `jrocha.dev.br` a servir **todos os jogos sob UMA mesma
origem**: `o-inclusionista.jrocha.dev.br/<slug>/*`. A razão da origem única é
medida e é a razão inteira: os ~1,2 GiB de ficheiros pesados (vozes neurais,
visão por câmara, reconhecimento, modelos de leitura) são descarregados **uma vez
por criança** em vez de uma por jogo, porque o navegador partilha o balde
`incl-pesados-v2` por origem e não por caminho (ADR-0117).

Este jogo é um dos 300 do catálogo, não um projecto autónomo com domínio próprio.
Portanto o que entra aqui é a parte do xadrez, não a infraestrutura: o Router
Worker, a tabela `GAMES`, o balde R2 `the-inclusionist-lfs` (EU, jurisdicional) e
o secret `CLOUDFLARE_API_TOKEN` são da plataforma e já existem.

### 2.1 Ficheiros de infra a copiar de `game-platformer`

Lista mínima, medida em 02/10. O xadrez copia este conjunto, trocando o `<slug>`
por `game-chess`. Nenhum destes ficheiros existe hoje aqui:

- **`wrangler.toml`** na raiz:
  ```toml
  name = "game-chess"
  compatibility_date = "2024-11-15"
  pages_build_output_dir = "dist"
  [vars]
  INCL_BASE = "/game-chess/"
  [[r2_buckets]]
  binding = "LFS"
  bucket_name = "the-inclusionist-lfs"
  jurisdiction = "eu"
  ```
  📌 Com o `wrangler.toml` presente, o painel do Cloudflare Pages fica
  **somente leitura** para *bindings* — a verdade passa a ser o ficheiro. Isto é
  por desenho e evita que mexer no painel introduza divergência.

  ⚠️ O **`jurisdiction = "eu"`** no binding do R2 é o erro «R2 bucket not found»
  mais comum: o nosso balde é jurisdicional (`.eu.r2.cloudflarestorage.com`) e,
  sem a linha, o Worker procura-o na jurisdição padrão.
- **`functions/heavy/[[path]].ts`** proxia `/heavy/<host><path>` para o R2 com a
  tabela `MIRROR_FOLDERS` da engine **inlined** (o esbuild do CF Pages não
  resolve de forma estável o import do pacote da engine; mais honesto copiar a
  tabela).
- **`scripts/post-build-cloudflare.mjs`** escreve `dist/_headers` com os
  caminhos prefixados por `INCL_BASE`.
- **`.github/workflows/*`**: o workflow do Pages é automático via integração
  GitHub; só precisa de ser copiado o `deploy-router-worker.yml` **se** este
  repositório também mexer no Router Worker (opcional por jogo).

### 2.2 Mudanças dentro de `app/` e no `vite.config.ts` do xadrez

O xadrez hoje tem `root: 'app'` e `outDir: '../dist'` sem `base`, portanto o
`dist` nasce com `href="/"` por omissão. Para o subpath passar a ser servível,
muda-se **isto**:

- **`vite.config.ts`** aceita o subpath:
  ```ts
  base: process.env.INCL_BASE || '/',
  build: {
    outDir: '../dist' + (process.env.INCL_BASE || '').replace(/\/$/, ''),
    emptyOutDir: true,
  },
  ```
- **`app/index.html`** ganha `<base href="/" />` logo no topo do `<head>`. É o
  que leva **qualquer `fetch()` em runtime** a cair na raiz do domínio — fora do
  subpath — para alcançar `/heavy/*`.

🔴 **AS QUATRO OCORRÊNCIAS DE CAMINHO ABSOLUTO DO STOCKFISH TÊM DE RECEBER O
PREFIXO.** Medidas em 02/10, antes de tocar em nada:

- `app/js/chess/engine/preload.ts:21–22` — dois caminhos no array de precache do
  loader.
- `app/js/chess/engine/stockfish-client.ts:23–24` — `ENGINE_URL` e `WASM_URL`.

Com o `<base href="/" />` a resolver `fetch('/x')` para a raiz do domínio em vez
do subpath, estas quatro linhas quebram em silêncio (o service worker não cacheia,
o Worker tenta carregar o motor, 404). A receita é a mesma do platformer, só com
o prefixo `vendor/engine/`:
```ts
const ENGINE_URL = `${import.meta.env.BASE_URL}vendor/engine/stockfish-18-lite-single.js`;
const WASM_URL   = `${import.meta.env.BASE_URL}vendor/engine/stockfish-18-lite-single.wasm`;
```

⚠️ **E o `scripts/check-precache.mjs` (gate deste repositório) tem de aceitar
ambos os prefixos.** Hoje ele exige `stockfish-18-lite-single.wasm` como string
literal no SW; depois da mudança o SW passará a inlinar `/game-chess/vendor/…`.
O gate continua honesto se procurar apenas o nome do ficheiro, não o caminho —
já é assim por desenho. Verificar no instante da mudança.

### 2.3 Dentro de `src/` — o que o cartucho do xadrez já declara

- **`uses`**: hoje o xadrez não declara nenhum. Declina `noNeuralVoice: true` e
  `noPauseActor: true` em `hooks.declines`. Para publicar, a decisão não muda —
  este jogo **não** usa `uses.neuralVoice` (não lê em voz alta uma frase pensada
  para ser lida) nem `uses.reading` (não há escrita a reconhecer). A linha fica
  tal como está; se um dia o modo de ensino ganhar «leia esta palavra», ganha-se
  `reading: true` e os modelos entram em `heavy/`.

- **Palavras do preset**: ✅ **já estão** (commit `32e458d` da Wave 1.5). O
  xadrez tem `hooks.dictionaries` com as seis chaves `keys.move`, `keys.select`,
  `keys.cancel`, `keys.teacher`, `keys.panel`, `keys.sonar` em pt/en/es. A Wave 2
  acrescentou mais ~40 chaves (gameOptions). Portanto o aviso do platformer —
  «sem isso os painéis Mapear teclado abrem vazios sem erro em lugar nenhum» —
  já está respondido para este jogo.

### 2.4 Deploy

- `git push` para `main` dispara o build no Cloudflare Pages via integração do
  GitHub.
- Se o CF Pages constrói o SHA errado (o painel mostra «Retry deployment» com o
  mesmo SHA): empurrar um commit vazio OU «Create deployment» no painel.

### Parte da engine — pedidos que vêm por via indirecta, não por este jogo

A **Decisão (A)** do xadrez de 2026-10-02 (adoptar a pausa e o HUD únicos da
engine) revelou perdas que **não são deste jogo consertar** — a `SettingsStore`
da engine é global, e os painéis que ela monta só editam o assento 0. O xadrez
não sofre com isto hoje porque **é um jogo de um a dois jogadores no mesmo
tabuleiro** (hot seat), não um multiplayer dividido em assentos. Portanto o
pedido do platformer para a sessão da engine não precisa de ser renovado por
aqui; fica registado como *contexto* porque o próximo visitante deste plano verá
no `game-platformer` o retrato completo:

1. **Pausa e HUD por assento numa raiz só** — hoje o cartão `#vp-pause-0` é
   único, e START dos jogadores 2–4 não o abre porque `leadsTheScreen === 0`.
2. **Painéis que editam o assento que `setPauseActor` indicou** — hoje
   `blindMode`, `cbSafe`, `wheelchair`, `oneButton`, `hcOutlineFg`, `letterCase`,
   `captionsOn` são globais. O Dev decidiu em 02/10: «só o jogador 1 pausa, mas
   cada um tem a sua própria configuração» — a engine ainda não cumpre a
   segunda metade.
3. **Cores por papel no painel visual** — `offer: { roles: false }` tira as
   cores da reconfiguração; as da v9 continuam a valer mas já não se mudam.
4. **«Sair» por assento** (hoje só sai do assento 0).
5. **Gamepad no título** cai no anel genérico (perde-se o `◀▶` sobre o número
   de jogadores).
6. **`inclusionist-heavy --base`** não gera o layout que o
   `/heavy/<host><path>` do Pages espera. O espelho é cópia manual de
   `~/Claude/inclusionist-heavy-mirror/heavy/` para o `dist/` até isto decidir.

### Checklist para o xadrez, copia-cola

1. Copiar de `game-platformer`: `wrangler.toml`, `functions/heavy/[[path]].ts`,
   `scripts/post-build-cloudflare.mjs` e, se aplicável, os workflows em
   `.github/workflows/*`. Trocar `<slug>` por `game-chess` e as `[vars]`.
2. **`vite.config.ts`**: `base: process.env.INCL_BASE || '/'` e o `outDir`
   compondo o subpath.
3. **`app/index.html`**: `<base href="/" />` no topo do `<head>`.
4. **Prefixar os quatro caminhos do Stockfish** com `${import.meta.env.BASE_URL}`:
   duas linhas em `preload.ts`, duas em `stockfish-client.ts`.
5. **`uses`**: sem alterações — o xadrez não pede voz neural nem leitura.
6. **Dicionários do preset**: ✅ já aterrados em `32e458d`.
7. **Linha nova em `GAMES`** do Router Worker: `'game-chess':
   'game-chess-cfo.pages.dev'`. Esta mudança é feita no repositório do Worker,
   não neste.

   ⚠️ **`game-chess-cfo`, NÃO `game-chess`** — medido em 04/10 no site já no ar.
   O projeto de Pages ficou com outro nome do que esta linha supunha, e o nome do
   projeto é que decide o `*.pages.dev`. Copiar a linha como estava escrita
   apontaria a rota para um host que não existe, e o sintoma seria um 404 em
   `o-inclusionista.jrocha.dev.br/game-chess/` com o jogo perfeitamente vivo do
   outro lado.
8. **Primeiro `git push`** → Cloudflare Pages cria o projeto automaticamente.
9. **Verificar os quatro gates no instante da mudança**: `check-precache.mjs`
   procura pelo nome do ficheiro (não pelo caminho) — se já procura, continua
   verde; senão, ajustar a lista para aceitar o prefixo.

⚠️ Esta secção é **para quando a Onda 2b estiver fechada**: publicar com um
cartão de pausa duplicado seria publicar o defeito. Primeiro acabar a
retirada do `chess-pause`; depois pôr este jogo no Pages.

## ⚠️ A REVISÃO DE INTERFACE AO VIVO — 2026-10-03 e 04

Esta secção não nasceu do plano: nasceu de o Dev **abrir o jogo e olhar**, relatório
a relatório, durante dois dias. Fica registada aqui porque metade do que ela
encontrou eram defeitos **antigos** que nenhuma medição de DOM tinha apanhado — que
é exactamente a lacuna declarada mais abaixo, em «O TRABALHO ANTERIOR».

### O que foi relatado e fechado

| Relato do Dev | Causa | Commit |
|---|---|---|
| Os botões 2D/2,5D/3D não funcionam | a legenda da barra de a11y era filha flex do painel e empurrava as linhas para baixo entre cliques | `b0e6be6` |
| Mudar de vista deixava o tabuleiro antigo | cada `destroy()` desmontava o conteúdo da cena e deixava o `<canvas>` no DOM; o `view-flat` destruía o espelho PARTILHADO | `c020829` |
| Em 2D nada é desenhado | `visibleMirror` era por arranque, não por vista: arrancar em 2,5D e trocar para 2D encontrava um espelho construído sem glifos | `6c6232d` |
| Pensamento da engine acima do tabuleiro | `#below-board` vivia dentro de `#chess-board` e disputava espaço flex com a tela | `6c6232d` |
| Tabuleiro 2,5D grande demais, bordas fora do ecrã | os recuos de CSS não pegavam: os atributos HTML `width`/`height` que o Zdog escreve ganham de `width: auto` | `03506c1`, `fb69006` |
| Letras e números não cabiam | `CAMERA.zoom` 2.3 → 2.0, e o tabuleiro passou a ter goteira própria | `fb69006` |
| Rótulos não acompanhavam o tabuleiro ao rodar | `.coords` era `inset: 0` de `#chess-board` enquanto `put()` mede a partir da TELA | `3e063eb`, `f035d3b` |

### ⚠️ Os dois defeitos que o conserto dos rótulos trouxe à superfície

Os rótulos de coordenadas foram a primeira coisa neste projecto a **imprimir uma
afirmação sobre a orientação do tabuleiro**. Enquanto não existiam, duas faltas
graves na vista 3D eram invisíveis — um tabuleiro de xadrez sem letras é simétrico
em tudo o que o olho confere.

**1. O tabuleiro 3D estava ESPELHADO — desde que a vista foi escrita** (`1d3c8a9`).

Os eixos da mesa (x direita, y BAIXO, z para o observador) são uma base **canhota**;
o Three.js é destro. O `camera.up.set(0, -1, 0)` acerta a vertical mas **não converte
a mão**: o vector «direita» da câmera sai `up × z_cam = (-1, 0, 0)`, logo o `+x` do
mundo cai na ESQUERDA do ecrã, e a coluna `a` — que vive em x negativo — era desenhada
à direita. As colunas corriam `h..a`.

A conversão passa a acontecer uma vez, em `sceneCenter` (`render3d/scene.ts`), e todo
o consumidor 3D de uma posição passa por lá: casas, marcas, peças, setas de dica e a
projecção de onde os rótulos são postos. As duas luzes são espelhadas junto, para a
iluminação manter a relação com que foi afinada. O `pick` não precisou de nada —
lança raios nas malhas reais.

⚠️ **O ERRO DE MÉTODO QUE PRODUZIU UM SEGUNDO DEFEITO, e que vale mais do que o
conserto:** em `e955ce1` eu aliara os rótulos à câmera **conformando-os a uma medição
do tabuleiro a correr** (clique à esquerda → `g1`, à direita → `b1`) e concluíra «a
convenção desta câmera é h..a». A medição estava certa; a conclusão não — aquilo não
era convenção a seguir, era o defeito. Eu tinha notado a divergência entre 2,5D e 3D
na mesma investigação e arquivara-a como «problema separado que ele não pediu». Era a
causa. Resultado: as letras saíram invertidas e o Dev relatou «arrumou um problema e
criou outro».

**Regra que fica:** antes de alinhar B a uma medição de A, procurar um terceiro ponto
que diga quem tem razão — aqui o 2D e o 2,5D, que põem `a` à esquerda. Divergência
entre caminhos que deviam concordar é achado, nunca ruído.

**2. Os números de fileira caíam SOBRE a coluna b** (`1b9dab0`).

`ui/coordinates.ts` lê um CONTRATO dos quatro cantos de cada casa —
`0 = longe-esquerda, 1 = longe-direita, 2 = perto-direita, 3 = perto-esquerda` — e as
duas filas de rótulos leem **pares diferentes** dele:

- as letras tomam `mid(0,1)` e `mid(2,3)`: uma borda longe e uma perto, e o PONTO MÉDIO
  de um par não muda quando os seus dois membros trocam;
- os números tomam `mid(0,3)` e `mid(1,2)`: as duas bordas LATERAIS, que a troca
  inverte, transformando «empurra para além da borda oeste» em «empurra para leste».

E os cantos estavam trocados: `projectQuads` escrevia o canto `x - half` primeiro — a
ordem óbvia e a errada, porque nesta cena a esquerda do ecrã é `+x`. Isto estava
errado desde que a vista foi escrita e era invisível porque o tabuleiro **também**
estava espelhado: dois defeitos a cancelarem-se, e consertar um expôs o outro.

`projectQuads` saiu do closure de `boot/view-solid.ts` para o módulo
`render3d/project-quads.ts`. Não foi arrumação — **contrato que nenhum teste alcança é
comentário**, e foi por isso que escapou duas vezes.

### Os portões que nasceram com estes dois consertos

- `tests/scene3d.browser.test.ts`: três testes que varrem o `pick` pelo canvas e
  exigem colunas a subir da esquerda para a direita e fileiras a descer 8..1.
  Asseridos pelo `pick` — a função que responde «que casa está debaixo deste ponto do
  ecrã» — e não pela aritmética do `sceneCenter`, porque um teste da fórmula seria uma
  segunda cópia dela e teria CONCORDADO com o defeito.
- `tests/project-quads.browser.test.ts`: seis testes, em duas camadas — o contrato dos
  cantos nas 64 casas, e o sintoma ponta a ponta (cada número à esquerda da SUA PRÓPRIA
  casa, cada letra abaixo da sua).

⚠️ «da sua própria casa», não da caixa envolvente do tabuleiro, e o primeiro rascunho
desse teste errou nisso: esta câmera tem PERSPECTIVA, logo a fileira 1 é desenhada
mais larga que a 8 e o ponto mais à esquerda do tabuleiro pertence a a1. Caixa
envolvente é a pergunta certa para o tabuleiro ortográfico do Zdog e a errada aqui.

Os dois conjuntos foram verificados por mutação: repor o defeito põe vermelho
exactamente os testes que o defeito quebra, e deixa verdes os outros — que é a
assinatura descrita acima e a prova de que olhar para as letras nunca apanharia o
problema dos números.

### ✅ FECHADO — a altura dos botões caía no primeiro clique de vista

Relatado pelo Dev em 2026-10-04: «ao abrir, os botões estão com uma altura; no primeiro
clique para alterar entre os três tipos de tabuleiro a altura de TODOS os botões é
reduzida». Medido no build a correr, 640×360:

| momento | `--tap` inline em `#game-region` | altura do botão |
|---|---|---|
| ecrã de título / arranque | `44px` | 44 px |
| primeiro clique numa vista | `24px` | **24 px** |
| qualquer `resize` da janela | `44px` | 44 px (volta) |

**Causa: `--tap` tem DOIS DONOS, e ganha quem escreveu por último.**

1. A engine 11, em `ui/layout.js` → `applyScale(region, e)`, escreve
   `--tap = minimumTarget(k)` com `minimumTarget(k) = 22 * max(k, 2)` — **nunca abaixo
   de 44** (ADR-0163, e o Dev fixou o número: «44px é o correto, eu errei quando disse
   42px»).
2. O xadrez, em `app/js/ui/layout.ts` → `applyLayout`, escreve `--tap = tapFor(width)`
   com uma escada graduada própria: `>= 720 → 44`, `>= 540 → 34`, senão **24**.

Ambos escrevem em linha no mesmo `#game-region`. No arranque a `applyScale` da engine
corre por último e o valor fica 44. `switchView` chama `relayout()` → `applyLayout`,
e **nada faz a engine recorrer**, por isso os 24 ficam. Um `resize` faz os dois
correrem, a engine por último, e os 44 voltam — que é o «pisca» que se vê.

Sondagem que fixa isto (instrumentar `CSSStyleDeclaration.prototype.setProperty` e
filtrar `--tap`): na troca de vista há duas escritas de `24px` vindas do pacote do
xadrez (a de `vars` e a de `#below-board`); num `resize` há as mesmas duas e depois
uma terceira de `44px` vinda do módulo da engine.

⚠️ **A engine JÁ ESTÁ A DENUNCIAR ISTO** e ninguém leu: a linha que aparece em
`engine.problems` a cada refresh — «the cartridge draws targets under 44 px (button,
button, button, button) in #game-region» — é este defeito, não ruído.

**Isto é uma DECISÃO do Dev, não um conserto meu, porque as duas posições são
defensáveis e incompatíveis:**

- **(A) Ceder à engine.** Apagar `tapFor` e a escrita de `--tap` do `app/js/ui/layout.ts`,
  deixando o `:root { --tap: 44px }` e a `applyScale` da engine como únicos donos.
  Cumpre a ADR-0163 e cala o `problems`. **Custo medido e real:** o comentário no
  próprio `layout.ts` regista que a 640×360 o painel tem 280 px de largura por 360 de
  altura e que **controlos de 44 px com tipo de 16 px não cabem — o HUD passava a
  rolar**. A escada 24/34/44 foi escrita precisamente para isso.
- **(B) Manter a escada do xadrez** e fazer `switchView` reaplicar o `--tap` do xadrez
  de forma determinística (ou deixar de o escrever e pôr a graduação numa variável
  própria, p.ex. `--tap-chess`, que só as classes do painel do xadrez leem). Mantém o
  painel utilizável no palco mínimo, mas assume conscientemente WCAG 2.5.8 (AA, 24 px)
  em vez de 2.5.5 (AAA, 44 px) nesse tamanho — e o `problems` da engine continuará a
  apontar, o que exige uma nota a dizer que é deliberado.

Em qualquer dos casos **o pisca tem de acabar**: a altura não pode depender de quem
correu por último.

**✅ DECIDIDO POR SI, 2026-10-04: opção (B).** «No xadrez o recuo deve seguir a escada
24/34/44. Ou seja, deve seguir a engine em tudo que for possível, menos nesse caso.»
Aterrado em `548e312`:

- `--tap` passa a ser **só da engine**. Nada neste jogo o escreve, e os nós desenhados
  por ela dentro da região (a barra de a11y, `.pi-btn`) continuam a lê-lo a 44.
- `--chess-tap` é **deste jogo** e carrega a escada 24/34/44. As catorze leituras em
  `app/css/board.css` passaram para ele.
- O custo fica **nomeado e não escondido**: o piso dos controlos do xadrez é agora WCAG
  2.5.8 (AA, 24 px) em vez de 2.5.5 (AAA, 44 px) no palco mínimo, deliberadamente, pela
  razão já medida em `ui/layout.ts`. A escada alcança AAA a partir de um tabuleiro de
  720.
- O `problems` da engine continuará a apontar «targets under 44 px». **É esperado.** Não
  é ruído nem regressão: é a engine a declarar a ADR-0163, e a decisão de 04/10 é
  divergir dela neste ponto.

Portões em `tests/layout.browser.test.ts`: que o `applyLayout` **não** escreve `--tap`
(asserido na propriedade EM LINHA, porque a computada responde 44 px vinda do `:root`
tenha a função escrito o que for — leitura que não pode falhar é portão nenhum), e que a
escada é mesmo uma escada (três janelas, monótona, nunca abaixo de 24, chegando a 44, e
com mais de um degrau distinto — escada com um degrau medido é uma constante).

⚠️ **A lacuna de fundo FICA ABERTA e é a mesma do tabuleiro espelhado:** continua a não
haver teste que meça a altura RENDERIZADA de um controlo na página real. O `layout.ts`
já diz isto por escrito a propósito de um defeito de 25 px anterior. Os portões acima
medem a VARIÁVEL e a verificação da altura foi feita à mão no build a correr.

### ✅ A porta do ecrã de título voltou a significar alguma coisa

Relatado em 2026-10-04: «Na primeira tela eu escolho entre jogar ou aulas. Se eu escolho
jogar, não deveria aparecer Aulas, dropdown de seleção de aula, botão Começar.» Aterrado
em `5f30260`.

JOGAR e APRENDER divergiam por exactamente um clique e voltavam a encontrar-se no mesmo
painel, onde a criança que tinha acabado de escolher jogar era convidada a estudar. A
escolha de aulas passa a aparecer só depois de o caminho de ensino abrir de facto
(`lessonsOffered`, levantado dentro de `teach()`).

Duas armadilhas que valem a leitura:

1. **Predicado, não bandeira.** O HUD é construído ANTES de a porta ser escolhida —
   `splash.done` resolve num clique, que é sempre mais tarde do que o painel que faz a
   pergunta.
2. **`lessonsOffered`, NÃO `teaching`.** O nome `teaching` já existia na casca com outro
   sentido — «uma aula ocupa o tabuleiro AGORA», que trava o `saveGame` — e cai para
   falso quando a aula acaba. Pendurar a escolha nele fá-la-ia desaparecer no intervalo
   entre terminar uma aula e escolher a seguinte, que é o único momento para que existe.

⚠️ **E isto expôs um defeito a sério no teclado.** O passeio pelo painel com as setas
contava controlos onde não conseguia pousar: `walkPanel` e a entrada por `action4`
repetiam o mesmo seletor sem filtrar o que não está DESENHADO, e `.focus()` num elemento
oculto é um não-evento silencioso. É **o mesmo buraco cavado uma segunda vez** — a
primeira ronda acrescentou `:not([disabled])` porque o menu de aula abre em «anterior»,
desactivado no primeiro passo. Desactivado não é a única forma de um controlo ser
inalcançável. Agora há um `panelStops()` único, e o literal duplicado — que foi como o
buraco se cavou duas vezes — desapareceu.

### ✅ FECHADO — as teclas de vista não eram alcançáveis pelas setas do painel

O achado, como ficou escrito: «as três teclas de vista vivem em `#side-column` mas
**fora** de `hud.root`, e o `walkPanel` passeia só o `hud.root`.»

⚠️ **Consertado em 2026-10-04 e este marcador estava vencido.** O `walkPanel` passeia
`column`, não `hud.root` — e a mesma correcção fechou um defeito pior que vivia ao lado:
a tecla de sair do painel perguntava `hud.root` enquanto a das setas perguntava `column`,
de modo que com foco numa tecla de vista — na coluna mas fora do HUD — ela concluía «não
estou no painel» e empurrava o foco PARA DENTRO, fazendo o contrário do que prometia.
Duas perguntas que têm de concordar estavam escritas em dois sítios.

### 📌 Correcções a marcadores desactualizados desta página

Os três `⏸️` da lista de zombies do HUD (secção «gameOptions.values é ESTÁTICO»)
estavam vencidos quando foram lidos em 2026-10-04:

- `motion` — **removido** em `4a35f97`.
- `outline` / `coords` — **removidos** em `d286cf8`.
- `locale` — **removido** em `0e16900` (não estava sequer listado).

`themes` continua genuinamente aberto, pela razão escrita lá: o `themeSelect` é a
âncora do relatório de contraste em modo `debug`.

### Onda 2b fechada destrava a publicação

A secção «Publicar» abaixo dizia-se condicionada a «quando a Onda 2b estiver fechada:
publicar com um cartão de pausa duplicado seria publicar o defeito». **Essa condição
está cumprida** — o `.chess-pause` foi retirado em `9a2fa9a`. O que falta da publicação
é inteiramente do lado do Dev (projecto no Cloudflare Pages, linha em `GAMES` do Router
Worker, binding do R2).

## ⚠️ O TRABALHO ANTERIOR: revisar a interface

Motivo dado pelo usuário: depois de o modo de aprendizagem entrar, a interface
**ficou cheia de problemas**.

⚠️ **E isto é exatamente a lacuna que eu venho declarando a cada volta:** toda a
verificação até aqui foi por **medição do DOM**, nunca por olhar para a página
desenhada. Larguras, contrastes e contagens conferem; o que ninguém viu foi o
resultado. É onde este tipo de defeito mora.

## Etapas 2+ — roteiro, não especificação

Cada uma é entregável sozinha e depende só da Etapa 0. **Não desenhar agora**; o que
segue fixa a ordem e as decisões de fonte já verificadas.

### Etapa 2 — Táticas (Lichess, CC0)

O maior valor por esforço: o conteúdo já existe e é livre. Esquema real do CSV
(`database.lichess.org`, verificado):

`PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays, Themes, GameUrl, OpeningTags, DailyDate`

⚠️ **Armadilha que produz exercícios errados em silêncio:** o `FEN` é a posição
**antes do lance do adversário**. O primeiro lance de `Moves` é do adversário; o
aluno joga a partir do segundo. Um leitor que assuma o contrário gera puzzles cuja
"solução" é o lance do outro lado, e nada falha.

- Script gerador em `scripts/` (o repositório ainda não tem essa pasta), lendo o
  CSV e emitindo um JSON versionado — por tema e faixa de rating, com um teto
  explícito de tamanho. Documentar o comando no README para regerar.
- Curadoria infantil: temas `mateIn1`, `mateIn2`, `fork`, `pin`, `hangingPiece`,
  faixa de rating baixa, `Popularity` alta.
- Crédito e licença em `docs/LICENSES.md`.

### Etapa 3 — Modo livro (partidas comentadas)

Primeiro título: **Capablanca, *Chess Fundamentals*** — inglês do próprio autor,
sem camada de tradutor, PD desde 2013.

- `rules.ts` ganha leitura de PGN (`chess.js` 1.4.0 já tem `loadPgn`, `getComment`,
  `getComments` — hoje atrás do invólucro).
- ⚠️ `reviewer.ts` **recusa-se a marcar lances anteriores à sua construção**
  (`base = rules.history().length`, `judged(ply)` trata `ply < base` como julgado).
  Um livro carregado inteiro nasceria sem anotação nenhuma. Isso precisa de
  correção deliberada, não de contorno.
- Texto: inglês verbatim; pt-BR e es como tradução nossa, pela regra do CLAUDE.md
  ("a moldura mora na chave, o conteúdo atravessa por `{param}`").

### Etapa 4 — Aberturas

`lichess-org/chess-openings` (CC0, TSV com ECO + nome + PGN) para nomear o que o
aluno acabou de jogar, e Staunton (*The Blue Book of Chess*, PD) para o texto
explicativo das linhas clássicas.

### Etapa 5 — Finais

⚠️ **A fonte indicada pelo usuário não serve** — Edward Lasker está protegido até
2052. Substitutos: **Philidor** (PD, e é a origem histórica dos finais de torre) e
as posições de **Fishburne** (FEN é fato). Os conceitos geométricos — regra do
quadrado, oposição — são matemática, não texto de ninguém, e viram algoritmo
direto.

### Etapa 6 — História e cultura

Colecionáveis, biografias curtas, curiosidades nas telas de carregamento e no
splash. Fonte PD abundante em inglês: **Bird** (*Chess History and Reminiscences*),
**Edge** (*Paul Morphy*), **Ruy López** (1561, para a identidade em espanhol).
⚠️ Mecking está vivo: fatos e partidas são livres, texto de terceiros e fotografia
não. Escrever do zero.

---

## Verificação

Em cada etapa, e não só ao final:

```bash
npm run validate
```

`typecheck` + os dois projetos de teste + `vite build`. O piso é **811 testes
verdes** (estado em `2b7e8bd`; era 534 em `9933ef2`, quando esta linha foi escrita).

Servidor local já configurado em `.claude/launch.json` do *cwd da sessão* (não o de
dentro do repo, que é ignorado):

```bash
python -m http.server 8195 --directory SP-the-inclusionist-chess/dist
```

Depois, pelo painel Browser, e **em cada uma das três vistas**:

1. A aula abre, avança e conclui só com **teclado**, com foco em `#game-region`.
2. Cada passo é anunciado em `#sr-status`. ⚠️ **E O ERRO NÃO VAI PARA `#sr-alert`** —
   este item contradizia-se a si mesmo, e a decisão certa é a do passo 7: só xeque e
   mate são assertivos, porque *uma aula não pode treinar criança a ouvir o próprio
   erro como alarme*. O teste que fixa isto é `[Teaching] errar não é emergência`.
   Corrigido aqui em vez de no código, que estava certo.
3. Nenhuma marca depende só de cor (WCAG 1.4.1) — a casa destacada também é
   **nomeada** no `aria-label`.
4. Nada exige arraste (WCAG 2.5.7): o que o ponteiro faz, uma tecla faz.
5. Trocar de idioma no meio da aula mantém o progresso e traduz o passo atual.
6. Recarregar a página retoma a aula onde parou (canal de persistência novo, ver
   Etapa 1).
7. `conformanceProblems()` da engine continua devolvendo zero problemas.

⚠️ **Um teste de boot por raiz nova.** `tests/boot.browser.test.ts` existe porque
dois `ReferenceError` de zona morta temporal passaram por `tsc`, 375 testes e o
build — "todo outro teste importa os módulos que `main.ts` compõe **sem compô-los**".
Qualquer raiz nova precisa do mesmo teste raso de "isto sobe".

---

## Dívidas encontradas na exploração — ✅ TODAS FECHADAS

⚠️ **Esta seção era uma lista de tarefas e virou um registro.** Conferida item a
item no código em 2026-09-06, não no log de commits: uma lista de pendências que
já não pendem manda o próximo leitor refazer seis coisas prontas, que é o mesmo
defeito do README que descrevia um jogo de duas vistas.

- ✅ **`playerSide` nunca é passado** a `createChessDeclaration` nas três raízes —
  todo jogador cego ouvia o tabuleiro do ponto de vista das brancas. Fechado na
  Etapa 0; hoje `game-shell.ts:230` calcula-o e passa-o em três pontos, com o
  comentário que conta a história onde ela aconteceu.
- ✅ **`topology` é valor onde a engine quer método** (ADR-0084). Absorvido em
  `a2c1ebf`, junto com o `world()` obrigatório do ADR-0087.
- ✅ **~1.060 linhas de CSS idênticas** nos três HTML. Extraídas para
  `app/css/board.css` (1.315 linhas, com bloco de tokens); os três HTML têm 181
  linhas cada e as regras do splash continuam embutidas, que era a propriedade a
  não quebrar.
- ✅ **A linha de dicas de teclado fixa em português.** `4345f66` — e ela também
  MENTIA: anunciava `Enter seleciona` e `K sonar` depois do remapeamento, e o
  `especial` do sonar não estava ligado a tecla nenhuma.
- ✅ **A vista 3D não marca casa nenhuma.** `1e5e7e9` deu ao `render3d/scene.ts` um
  canal de marcadores (disco = lance, anel = captura, halo preto na marca de aula)
  e ligou `teaches: true` na página. Era a dívida mais antiga do plano.
- ✅ **Sujeira na raiz.** `bench.tmp.mjs` virou `scripts/bench-chess-js.mjs`
  (`c6c5d7a`) — não era lixo, era a única forma reproduzível da medição que
  sustenta a segunda interface de lances do `rules.ts`, e a última linha dela nunca
  tinha corrido. As três pastas `dist-*-probe/` estão no `.gitignore` e nunca
  estiveram no repositório.
- ✅ **O jogo não tem troca de idioma** (registrada mais acima, na Etapa 1).
  `setLocale` agora é chamado em produção: seletor no HUD, escolha persistida em
  `loadSettings().locale`, lida no arranque, e `changeLocale()` recarrega a prosa,
  o painel, o espelho e a linha de teclas. Testado, inclusive **no meio de uma
  aula** — o passo traduz-se e o lugar no curso não se perde.

---
---

# HISTÓRICO — plano anterior, concluído

# Xadrez de Hartwig em Zdog + Pixi, sobre a engine Inclusionist

## Contexto

Refazer `juliangarnier/3D-Hartwig-chess-set` (2013) — um xadrez jogável cujo 3D é
feito inteiramente de `transform: rotateX/translateZ` em `div`s, com `chess.js`
validando regras. A reimplementação troca a técnica de renderização: **Zdog** para
a geometria pseudo-3D, **Pixi** para composição e pós-efeitos.

O projeto não é um exercício solto. O catálogo de minigames em
`SP-the-inclusionist-demos/minigames-catalog-v2.html:856` já declara
"Xadrez / Chess com motor minimax raso" como escopo pretendido, e a engine
`@pm-monte/inclusionist-engine` existe para hospedar exatamente isso. O
resultado é um jogo de verdade — regras completas, oponente, câmera — que
herda a pilha de acessibilidade da engine e roda na resolução dela.

**Por que Zdog e não WebGL 3D:** o set de Josef Hartwig (Bauhaus, 1924) é
estereometria pura. Pela explicação do próprio Hartwig: peão e torre são o
**cubo** (movem em ângulo reto com a borda, diferindo no tamanho); o cavalo são
**quatro cubos combinados em ângulo reto**, desenhando o gancho do movimento; o
bispo é uma **cruz recortada do cubo** (diagonal); o rei é um **cubo menor
apoiado sobre o vértice de um maior**; a dama recebe um **círculo no topo**.
Cinco das seis peças são `Zdog.Box` composto em `Anchor`. Não há uma única
superfície orgânica no set — é provavelmente o único xadrez do mundo que se
desenha em Zdog sem concessão.

## Decisões já tomadas

| Questão | Decisão |
|---|---|
| Casa | **Repo próprio**, `SP-the-inclusionist-chess`, consumindo a engine via `file:` |
| Escopo | **Paridade com o original**: regras completas, oponente com IA, câmera, animação |
| Estética | **Zdog assumido**: traço grosso arredondado, cor chapada saturada |
| Resolução | **320×180** da engine, escala inteira em pixels físicos |
| Licença | **AGPL-3.0-or-later**, cabeçalho SPDX apenas, **sem linha de copyright** |
| Titularidade | Município, declarada em `docs/LICENSES.md`, não no código |

## Achados que fundamentam o desenho

**Não existe parede a quebrar.** `game-api.ts`, `Scene` e `Handle` são
especificação no repo `demos`, sem implementação em nenhum dos dois repos — o
próprio `package.json` da engine admite. A regra D16 ("nenhum tipo PixiJS vaza
para o que um jogo enxerga") está escrita no `ADR-0035` e **não é aplicada por
nada**: não há ESLint no repo, não há `lint:deps`, não há dependency-cruiser. O
contrato real é `createGame(options) → Engine`, e ele é de **acessibilidade, não
de desenho** — `boot/create-game.ts:39-43` diz explicitamente que "não liga
render, física, tiles nem o sonar".

**Já há precedente exato.** `app/js/consumer-quiz/main-quiz.ts` (347 linhas) usa
`createGame`, traz o próprio renderizador (`innerHTML`), e tem um teste que
garante que ele *não* importa PIXI. O xadrez é o segundo consumidor da mesma
forma — desta vez com um renderizador de canvas.

**Objeção registrada no repo, e como respondê-la.** `ADR-0051` aposentou "Libras
em motor zdog à parte", e `docs/research/AVALIACAO-ADVERSARIAL-PREMORTEM.md`
lista o risco #8, "2º motor antes de auditar o 1º". A D6 dos demos prevê a saída:
`meta.renderer: 'pixel' | 'svg' | '3d'` com **`rendererWhy` obrigatório**. O
`rendererWhy` deste jogo é o parágrafo do contexto acima — a geometria *é* o
conteúdo — e deve ser escrito, não pressuposto.

## Arquitetura

### O caminho do pixel

```
Zdog (Anchor graph, projeção, painter sort)
  └─> Canvas2D offscreen 320×180
        └─> PIXI.Texture (SCALE_MODES.NEAREST)
              └─> PIXI.Sprite na pilha Z da engine (core/layers.ts)
                    └─> pós-efeitos (CVD, correção a11y, limite de flash)
                          └─> upscale inteiro em CSS (ui/layout.ts)
```

O passo `Canvas2D → Texture` custa 57.600 pixels por quadro — desprezível — e
compra fidelidade Zdog integral sem fork e sem shim. **Foi escolhido por causa
da baixa resolução**: a 1920×1080 a conta se inverteria e valeria rasterizar o
Zdog direto em `PIXI.Graphics` via um shim Canvas2D.

**Plano B, se o perfil exigir:** um shim Canvas2D sobre `PIXI.Graphics`. É
viável porque o renderer do Zdog é plugável de propósito — `Shape.render(ctx,
renderer)` recebe ambos como parâmetro, e `CanvasRenderer` é um objeto solto de
onze métodos. O Zdog separa construir-caminho de pintar (`renderPath` → `fill`
→ `stroke`), o que casa com o `beginFill`/`endFill` do Pixi v7 se os comandos
forem bufferizados e reexecutados. Mesma interface pública, troca de um arquivo.

**~~Renderização sob demanda~~ — cortada pela Sondagem 0.** A ideia era redesenhar
só quando a cena estivesse suja, para se proteger do custo por quadro. Medido:
**450 formas ordenadas em 1,44 ms**, ou 8,6% do orçamento de 16,7 ms. A proteção
não compra nada e custa rastreamento de sujeira em câmera, animação e seleção.
Redesenha todo quadro. Ver `docs/spike-0-legibility.md`.

### Picking sem raycasting

O Zdog não oferece picking. Não precisamos dele: o tabuleiro é um plano e só
precisamos acertar **casas**, não malhas.

Depois de `updateGraph()`, cada uma das 64 casas tem os 4 cantos com
`renderPoint` já projetado. Teste ponto-em-quadrilátero (dois triângulos, sinal
do produto vetorial) sobre 64 quadriláteros é trivial. Peças são selecionadas
*através* da casa em que estão — que é como uma UI de xadrez deve funcionar de
qualquer modo.

*Caso de borda:* peça alta se sobrepõe visualmente à casa de trás. Desempate
pelo maior z entre as casas atingidas.

### Reuso da engine — o que vem de graça

Tudo abaixo é provado pelo `consumer-quiz`, sem acoplamento de renderizador:

| Módulo | Uso no xadrez |
|---|---|
| `boot/create-game.ts` | `createGame()` — i18n, TTS, leitor de tela, mixer, diálogos, teclado, menus |
| `core/contract.ts` | Os 7 campos + `conformanceProblems()` para testar a declaração |
| `core/a11y-sr.ts` | `srSay` / `srAlert` — anúncio de lance em notação algébrica |
| `core/i18n.ts` | `t()`, `applyDom()`, `setLocale()`; catálogos pt/en/es |
| `core/scenes.ts` | `criarPilha()` — pilha de cenas (título, jogo, pausa, fim) |
| `core/loop.ts` | `startLoop(ticker, frame)` — `Ticker` é tipado estruturalmente, o ticker do Pixi serve |
| `core/constants.ts` | `LOGICAL_W=320`, `LOGICAL_H=180`, `TILE=16` |
| `core/layers.ts` | `Z`, `POST_FX_ORDER` |
| `platform/audio-sonar.ts` | Sonar de navegação cega — funciona só de preencher os 7 campos |
| `platform/tts.ts` | Voz |
| `input/keyboard-runtime.ts`, `input/edges.ts` | Intenção, não keycode; `NavKeys` |
| `input/touch.ts` | `padPxPerMm()` — alvo de toque em milímetros reais |
| `ui/menu-nav.ts`, `ui/settings-panel.ts` | Foco, seleção rotativa, pilha de diálogos |
| `ui/settings-typo.ts`, `ui/settings-motion.ts` | 18 fontes de legibilidade; movimento reduzido por elemento |
| `ui/layout.ts` | Upscale inteiro em pixels físicos |
| `render/cvd-matrices.ts`, `render/viz-modes.ts` | Filtros de daltonismo (SVG/CSS, não usam PIXI) |

### A declaração de xadrez — os 7 campos

O mapeamento é o coração da acessibilidade e deve ser escrito primeiro:

- `topology`: `'grid'`, 8×8. `distance()` já faz Chebyshev — a métrica do rei.
- `tick`: `'player'`.
- `roleAt(spot)`: vazia → `'free'`; peça própria → `'structure'`; peça inimiga →
  `'key'`; **casa atacada pelo adversário → `'hazard'`**; rei inimigo → `'goal'`.
  Isso faz o sonar avisar sobre casas sob ataque sem escrever áudio nenhum.
- `nameAt(spot)`: `Speakable { text, gender, plural }` — o campo `gender` existe
  para o português ("**a** torre branca", "**o** cavalo preto").
- `focusOf(i)`: casa do cursor + `heading`.
- `objectiveOf(i)`: `{ name: t('objective.checkmate'), have, need }`.
- `targetsOf(i)`: destinos legais da peça selecionada.

### Módulos do jogo

```
app/
  index.html                 # exige #game-region, #sr-status, #sr-alert
  js/
    boot/main.ts             # raiz de composição: única a conhecer PIXI concreto
    declaration/             # os 7 campos ← chess/
    chess/
      rules.ts               # invólucro fino sobre chess.js
      engine.worker.ts       # minimax + poda alfa-beta, aprofundamento iterativo
      engine-client.ts       # requestMove(fen, depth) => Promise<Move>
      state.ts               # máquina: idle → selected → animating → thinking → over
    render/
      zdog-surface.ts        # Zdog → Canvas2D offscreen → PIXI.Texture
      board.ts               # 64 casas, realces, marcadores de legalidade
      pieces/                # uma fábrica por peça, devolvendo Zdog.Anchor
      camera.ts              # arraste, pitch travado acima do tabuleiro
      picking.ts             # ponto-em-quadrilátero sobre os cantos projetados
    ui/
      hud.ts                 # turno, capturadas, lista de lances, dificuldade
      grid-mirror.ts         # espelho DOM 8×8 de <button> — ver abaixo
    i18n/                    # pt, en, es — dicionário próprio (D10), não o da engine
```

**Sem estado mutável de módulo.** Tudo `createX()`, instância da raiz de
composição.

### Acessibilidade — a decisão que sustenta o resto

**O canvas não é a fonte de verdade da interação.** A engine já esconde o canvas
do leitor de tela de propósito (`main.ts:591`, `aria-hidden="true"`) porque o jogo
fala pelo DOM. Seguimos o mesmo pilar:

`ui/grid-mirror.ts` mantém uma grade 8×8 de `<button>` visualmente oculta, um por
casa, rotulada em notação algébrica ("e4, peão branco"). Teclado e leitor de tela
dirigem **essa** grade; o canvas é vista. Setas movem o foco, Enter seleciona e
move. O teclado é escutado em `#game-region`, nunca em `window`.

- `srSay` anuncia cada lance; `srAlert` anuncia xeque e xeque-mate.
- Movimento reduzido → colocação instantânea, sem easing de câmera.
- **Nunca cor sozinha** para sinalizar legalidade: casa legal recebe marcador de
  forma (ponto/anel), não só tinta.
- Paridade ponteiro/teclado total — nenhuma ação exige arraste.

*Lacuna herdada:* `render/high-contrast.ts` é orientado a tiles e **não viaja**
para um jogo sem tiles. O alto contraste do xadrez é responsabilidade nossa —
uma variante de paleta própria. A estética "Zdog assumido" (traço grosso, cor
saturada) já empurra nessa direção.

## Riscos e sondagens

| # | Risco | Mitigação |
|---|---|---|
| 1 | ~~**Legibilidade a 320×180.**~~ **RETIRADO** pela Sondagem 0 (2026-09-04). As seis silhuetas se distinguem em escala final; geometria travada em `docs/spike-0-legibility.md`. Sobra um ponto: peão e torre são ambos cubos a 1,31× de razão — abrir para 1,5× na etapa 4. |
| 2 | **`file:` numa engine `private: true` que exporta `.ts` cru** sem condição `types` e sem build. | `optimizeDeps.exclude` do pacote; `moduleResolution: 'bundler'`; `paths` como rede. Nenhum consumidor externo existe hoje — somos o primeiro, e é parte do valor. |
| 3 | **`import.meta.glob('../i18n/*.ts')`** da engine, resolvido dentro de um symlink em `node_modules`. | Verificar cedo na Sondagem 1. Se quebrar, importar os catálogos explicitamente. |
| 4 | ~~Layout: tabuleiro 3D **mais** HUD em 320×180.~~ **RETIRADO** pela Sondagem 0. Tabuleiro nos 232px da esquerda (`zoom 1.15`, `rotate.x -1.0`, deslocamento `x -42`); sobram **88×180** à direita, medidos com turno, capturadas e 11 linhas de lances desenhados. |
| 5 | `aoFalhar` do `startLoop` **nunca é ligado** no jogo real da engine — o laço para e nada anuncia. | Ligar `aoFalhar` na nossa raiz de composição. Criança cega não vê tela congelada. |

## Ordem de construção

0. **Sondagem 0 — legibilidade.** HTML solto, Zdog por CDN, as 6 peças em escala
   final num canvas 320×180 com `image-rendering: pixelated` e escala 4×.
   Decidir go/no-go e a caixa do layout. *Descartável.*
1. **Sondagem 1 — o `file:`.** Repo mínimo, `createGame()` bootando, `t()` e
   `srSay` funcionando, `npm run typecheck` limpo. Prova o risco 2 e o 3.
2. ✅ **Andaime — FEITO** (2026-09-05, 8 commits). Vite 8, TS estrito, Vitest nos dois
   projetos (**34 testes verdes**), `npm run validate` limpo de ponta a ponta, AGPL +
   SPDX, `docs/LICENSES.md`, i18n pt/en/es próprio com gênero como dado, `chess/types`,
   `render/resolution`, README. **O WASM de 26,8 MB foi resolvido sem trabalho**: é
   import dinâmico atrás de escolha do usuário, padrão `webspeech` — fica como está.
   ⚠️ **Achado novo, ver `docs/LICENSES.md`:** Hartwig morreu em **1956**, então o
   desenho só cai em domínio público em **2027-01-01**. Precisa de parecer jurídico do
   Município antes de publicação.
3. ✅ **Superfície de render + câmera + tabuleiro + picking — FEITO** (2026-09-05, 7 commits).
   **100 testes** verdes. Palco Zdog separado do Pixi de propósito (testável sem WebGL);
   picking por ponto-em-quadrilátero com guarda de degenerescência; câmera com trava de
   inclinação e `nudge` de teclado; raiz de composição ligada e **verificada no navegador**
   (fator 2 exato nos dois eixos, clique em c3 anunciado na região viva). `ui/layout` da
   engine adotado em vez de CSS próprio; `aoFalhar` do `startLoop` ligado.
4. ✅ **Geometria das seis peças — FEITO** (2026-09-05, 3 commits). **135 testes** verdes.
   Geometria como **dado puro** (`PIECE_SPECS`), com as invariantes provadas no projeto
   node: cabe na casa, apoia no tabuleiro, hierarquia de altura, "quatro cubos" do cavalo,
   cruz do bispo nas diagonais, cubo do rei virado sobre o vértice, círculo só na dama.
   Razão peão/torre aberta para 1,5×. **Dois erros meus corrigidos:** a conta de rotação da
   Sondagem 0 estava invertida (girar lâmina fina *estreita*, quem alarga é cubo), e o
   contraste lado-contra-lado era **2,60:1** — abaixo do piso da WCAG 1.4.11 — porque eu
   afirmei sem medir; agora **8,46:1**. ⚠️ Fica para o passo 8: as faces do lado claro
   contrastam 1,07:1 com a casa clara e dependem só do contorno.
5. ✅ **Regras + máquina de estado + animação — FEITO** (2026-09-05). **195 testes** verdes,
   60 novos, todos escritos antes do código. `rules.ts` é o único módulo que conhece o
   `chess.js` e converte lance ilegal de **exceção em valor** (a v1.x lança, e um lance
   lançado no manipulador de clique derrubaria o laço). `state.ts` tem **uma porta só**,
   `activate(square)`, para ponteiro e teclado — é o que fará o espelho DOM do passo 7 se
   comportar igual a um clique. `dt` em **quadros**, preso em teste. Verificado no navegador:
   1.e4 e5 2.Cf3 Cc6 3.Cxe5, anunciado com concordância correta.
   ⚠️ **Ambiente:** painel do navegador oculto não dispara `requestAnimationFrame`; o quadro
   do laço é acionável à mão sob `?debug=true`, senão não há como verificar animação.
6. ✅ **Motor + dificuldade — FEITO** (2026-09-05). **234 testes** verdes, 35 novos. Negamax
   com poda alfa-beta em Web Worker; `searchWithoutPruning` embarcado só para o teste de
   equivalência. **Otimização guiada por medição, e a medição derrubou meu palpite:** o
   gargalo não era `isCheckmate()` (0,32 µs) e sim `moves({verbose:true})` a **1.498 µs**
   contra **107 µs** do `moves()` — o chess.js 1.x gera dois FEN por lance. A busca passou a
   jogar **fichas opacas**; profundidade 3 caiu de estourar 5 s para **443 ms**.
   Dificuldade 1/2/3 — **profundidade 4 medida (6.018 ms) e rejeitada**, não omitida.
   Verificado no navegador: 1.e4 Cc6 2.Cf3 Cf6 3.Bc4 Cxe4.
7. ✅ **Declaração + conformidade + sonar + espelho DOM — FEITO** (2026-09-05). **283 testes**
   verdes, 49 novos. Declaração extraída para módulo próprio e submetida ao
   `conformanceProblems()` da engine — **zero problemas**, na abertura e no mate. Espelho DOM
   com 64 botões reais, tabulação rotativa, `aria-selected`, setas travadas na borda, e o
   cursor do teclado espelhado no tabuleiro. Sonar ligado (`sonarCount` sobe ao vivo).
   **Um lance completo jogado só com teclado, verificado no navegador.**
   ⚠️ Para o passo 8: o sonar está numa tecla nua; o certo é passar pela camada de intenção
   remapeável da engine, junto com o painel de ajustes.
8. 🔄 **Em andamento** (2026-09-05). **304 testes** verdes.
   - ✅ **HUD — mas em DOM, não em Pixi.** Correção ao plano: a UI da própria engine é DOM
     (é por isso que `--ui-fs` e `--tap` são escopados ao `#game-region`), e texto de ~7px a
     320×180 é ilegível, não redimensionável e invisível ao leitor de tela. O Pixi segue se
     pagando pela composição e pelos pós-efeitos **do tabuleiro**; só o argumento do texto
     estava errado. Medido: 176px CSS = os 88 lógicos da Sondagem 0; `select` com 44px.
   - ✅ **Alto contraste**, resolvido numericamente: os quatro pares peça/casa ≥ 3:1, com o
     sombreamento sacrificado de propósito (face lateral precisaria de luminância ≥ 0,97).
     `prefers-contrast: more` liga sozinho.
   - ✅ **i18n**: tudo por `t()`, três catálogos, completude testada.
   - ✅ **Movimento reduzido**: semeado do `prefers-reduced-motion`, com interruptor próprio.
     Medido: 20 quadros com animação, 1 sem. Um interruptor só, e não o conjunto por elemento
     da engine — que é a forma certa para plataforma e não tem o que mapear aqui: este jogo
     move exatamente uma coisa.
   - ✅ **Pós-efeitos**: as três **correções** de daltonismo aplicadas à região inteira
     (tabuleiro **e** painel). As *simulações* ficam de fora de propósito — são ferramenta de
     professor, e ao lado da correção de uma criança convidariam a ligar a deficiência no
     mesmo lugar onde ela foi desligar.
   - ✅ **Sonar na camada de intenção.** O `s` nu **colidia** com `down` do esquema padrão da
     engine — exatamente o choque que a ADR-0033 existe para impedir, criado por atalho meu.
     Agora é a ação `especial`, e as setas da grade passam pelo mesmo resolvedor: WASD e
     remapeamento salvo saem de graça.
   - ✅ **README** reescrito para descrever o que existe, com os créditos.

## Estado

**Plano executado.** 28 commits, **310 testes** verdes, `npm run validate` limpo.
Dívidas registradas, não escondidas: parecer jurídico sobre o desenho de Hartwig antes de
publicar (`docs/LICENSES.md`), e as faces do lado claro a 1,07:1 na paleta padrão — legíveis
pelo contorno, com o modo de alto contraste como saída.
9. **README** com crédito a Julian Garnier (MIT) e a Josef Hartwig.

## Verificação

```bash
NODE_OPTIONS=--use-system-ca npm install
npm run validate      # tsc --noEmit && vitest run && vite build
```

O dev server do Vite **não roda no sandbox**. Construir e servir `dist/`:
acrescentar uma entrada em `C:\Users\candi\Claude\.claude\launch.json` — o do
*cwd da sessão*, não o de dentro do repo, que é ignorado — apontando
`python -m http.server 8194 --directory SP-the-inclusionist-chess/dist`.
O arquivo é local e não versionado: **ler antes de escrever, nunca sobrescrever**.

Depois, pelo painel Browser: captura da tela, console limpo, `Tab` percorrendo
as 64 casas do espelho DOM, `aria-live` disparando a cada lance, e um jogo
completo contra a IA até o mate.

Testes:
- **node** — regras, motor (equivalência alfa-beta × minimax na mesma profundidade),
  picking (ponto-em-quadrilátero sobre pontos-fixtura), máquina de estado,
  `conformanceProblems()` da declaração, completude dos catálogos i18n.
- **browser** — a cena monta, o canvas não sai em branco, navegação por teclado
  alcança as 64 casas, `aria-live` anuncia, caminho de movimento reduzido.

## Pontos em aberto

- **Idioma do código.** O `CLAUDE.md` manda artefatos em inglês; a engine é
  nomeada em português (`criarPilha`, `Desenho`, `aoFalhar`). O plano assume
  inglês no repo novo, mantendo verbatim os nomes da API da engine.
- **Domínio público do desenho de Hartwig.** O set é de 1924 e o autor morreu nos
  anos 1950. `docs/LICENSES.md` deve registrar a análise, não pressupô-la.
- ✅ **PWA.** Este ponto dizia «cortado por YAGNI até que offline seja requisito
  declarado», e está vencido: o jogo tem `vite-plugin-pwa`, service worker registado
  (confirmado no site publicado, scope `/game-chess/`), manifesto e um portão próprio
  (`scripts/check-precache.mjs`) que exige as entradas no precache.
