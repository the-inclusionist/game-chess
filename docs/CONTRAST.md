<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# Contraste medido, tabuleiro a tabuleiro

Este documento é a resposta a uma pergunta só: **um professor escolhendo um tabuleiro para uma
criança com baixa visão consegue ver o que está escolhendo?**

Ele já esteve na tela, sobreposto ao tabuleiro enquanto a lista de paletas estava aberta. Saiu de
lá porque as pessoas para quem estes números são úteis são quem **configura** o jogo — quem prepara
uma sala, quem mexe numa tinta — e essas leem documentação. Uma criança escolhendo uma cor no meio
de uma partida não está decidindo sobre razões de contraste, e seis colunas delas estavam no
caminho.

## A regra, e o que ela não é

O piso é o da **WCAG 1.4.11**: 3:1 para contraste não textual. Mas a norma fala de uma
**fronteira** ser perceptível, e duas cores que nunca se encontram não têm fronteira nenhuma entre
si. Neste tabuleiro:

| se tocam | não se tocam |
| --- | --- |
| as duas casas, ao longo de toda aresta de toda casa | o **preenchimento** de uma peça contra uma casa |
| a **silhueta** contra cada casa — é a tinta de fora da peça | o **traço interno** contra uma casa |
| o preenchimento contra a silhueta | |
| o traço interno contra o preenchimento | |

Na tabela abaixo, as linhas marcadas **(encosta)** têm de passar. As outras podem ficar abaixo: a
silhueta está desenhada entre elas.

> ⚠️ **Não é possível ter tudo em 3:1.** Cada peça teria de estar a 3:1 das duas casas, e as casas a
> 3:1 uma da outra — três vãos de 3, ou seja 27. O intervalo inteiro do branco ao preto vale 21.
> Não é uma paleta que ninguém achou; ela não existe.

## A vista projetada tem uma tinta a menos

O tabuleiro plano desenha três tintas por peça e é a **silhueta** que encosta na casa. O Zdog não
desenha silhueta: lá o **contorno** é a tinta de fora, e é ele que tem de passar contra as duas
casas — o que só um quase-preto consegue. Por isso, em 2.5D, toda peça escura é contornada em preto
com o preenchimento levantado o suficiente para ficar a 3:1 dele, e a peça escura aparece cinza ou
violeta lá e preta no tabuleiro plano.

## A tabela

<!-- GERADO: nao edite a mao -->

| par | cb.js | Wiki | XB | José | P&B | A&A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| peça clara × peça escura **(encosta)** | 21.00 | 21.00 | 21.00 | 8.91 | 21.00 | 19.56 |
| casa clara × casa escura **(encosta)** | 3.01 | 3.06 | 3.03 | 3.07 | 3.00 | 3.00 |
| contorno × casa clara **(encosta)** | 13.65 | 13.00 | 10.21 | 13.52 | 9.14 | 9.14 |
| contorno × casa escura **(encosta)** | 4.54 | 4.24 | 3.37 | 4.40 | 3.04 | 3.04 |
| Traço interno claro × peça clara **(encosta)** | 21.00 | 21.00 | 21.00 | 10.67 | 21.00 | 19.56 |
| Traço interno escuro × peça escura **(encosta)** | 21.00 | 21.00 | 21.00 | 3.18 | 21.00 | 7.00 |
| peça clara × casa clara | 1.37 · | 1.44 · | 1.83 · | 1.12 · | 2.30 · | 2.14 · |
| peça clara × casa escura | 4.13 | 4.41 | 5.56 | 3.45 | 6.90 | 6.42 |
| peça escura × casa clara | 15.30 | 14.57 | 11.45 | 7.93 | 9.14 | 9.14 |
| peça escura × casa escura | 5.09 | 4.76 | 3.78 | 2.58 · | 3.04 | 3.04 |

<!-- FIM DO GERADO -->

Legenda: `·` abaixo do piso num par que **não** encosta, o que é permitido; `**<**` abaixo do piso
num par que encosta, o que não é.

## Como atualizar

```bash
WRITE_DOCS=1 npx vitest run tests/contrast-doc.node.test.ts
```

A tabela é gerada de `app/js/ui/contrast-report.ts` e um teste falha se este documento e o código
discordarem. Uma tabela digitada à mão seria uma segunda cópia de números que este repositório já
viu ficarem defasados — foi exatamente assim que a paleta de alto contraste passou meses com as
casas em 2,13:1 enquanto todo comentário à volta dizia o contrário.
