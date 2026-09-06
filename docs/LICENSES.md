# Licences and ownership

## This software

Licensed **AGPL-3.0-or-later**. The full text is in [`LICENSE`](../LICENSE).

Every source file carries one line and only one line:

```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
```

**No copyright notice appears in any source file, and that is deliberate.** It matches the
engine's 135 files exactly, and it avoids asserting in code something the executive branch has
not yet granted — publication under AGPL is the object of a *requerimento*, not a decision of
whoever wrote the code.

## Ownership

⚠️ **Economic ownership belongs to the MUNICÍPIO, not to the developer.** Software produced in
the exercise of one's duties belongs to the employer (Lei nº 9.609/1998, art. 4º), which is why
AGPL publication is a petition to the executive branch rather than a developer's call.

**That fact is stated HERE, and deliberately not in the package name.** The scope was
`@pm-monte` when this repository was scaffolded, and the engine's ADR-0071 (2026-09-05) retired
it: a scope has to be the hosting organisation — GitHub Packages requires it and does not accept
dots — and, more to the point, ADR-0066 §2 had already decided that an ownership claim belongs
inside a repository rather than in a name, *because a name is read by strangers who will not open
the repository*. A scope named for the Prefeitura, published to a registry by a servidor before
the ato, is a public claim on an institution's name.

The cost is worth stating: whoever reads only the dependency line now learns nothing about the
Município. That is the same price the engine accepted, and this file is where the fact lives
instead.

This mirrors the engine's own `docs/LICENSES.md`. Nothing here changes that arrangement; this
repository is a consumer of the engine and inherits its position.

## Dependencies

| | Licence | Note |
|---|---|---|
| `@the-inclusionist/engine` | AGPL-3.0-or-later | Same owner. Linked with `file:`; this repo is its first external consumer. |
| `zdog` 1.1.3 | MIT | © 2020 Metafizzy. Pseudo-3D geometry, projection and depth sort. |
| `chess.js` | BSD-2-Clause | Rules, legality, FEN, algebraic notation. |
| `vite`, `vitest`, `typescript`, `playwright` | MIT / Apache-2.0 | Build and test only; not shipped. |

## The historic piece patterns — names, and what they cover

The projected board offers five patterns besides Hartwig, and each is named for a historic design.
What follows is the reasoning behind using those names. ⚠️ **It is not a legal opinion**, and the
same Município review this document already calls for on Hartwig is where it should be confirmed.

- **Staunton** — the design is 1849, attributed to Nathaniel Cooke and registered by Jaques of
  London; the British registered design lapsed in the 1850s. The pattern has been manufactured
  freely for over a century and a half, and the FIDE Laws of Chess require pieces "of the Staunton
  pattern", which is the opposite of a name under anyone's control. What Jaques holds is a mark on
  **Jaques**, not on the shape. The drawing here is in any case a stack of circles read from the
  silhouette, not a reproduction of any manufacturer's model.
- **Régence** — the French pattern of the eighteenth and nineteenth centuries, named for the Café
  de la Régence. No proprietor.
- **St George** — the English pattern that preceded Staunton, early nineteenth century.
- **Selenus** — named for *Gustavus Selenus*, the pen name Augustus the Younger, Duke of
  Brunswick-Lüneburg, put on *Das Schach- oder König-Spiel* (1616). Seventeenth century.
- **Império Sikh** — ⚠️ **the one that is not a historic pattern at all**, and the code says so
  where the geometry is. There is no catalogued nineteenth-century Punjabi playing pattern in the
  sense that Régence and Selenus are catalogued. What the name means today is a set carved in
  Amritsar and sold under it: a **Staunton form**, taller and more slender, whose king carries the
  **Khanda** where a Staunton king carries a cross. That is what is drawn, and it is drawn from the
  sellers' own descriptions of the piece shapes rather than from any one object.

None of these drawings traces a photograph. They are proportions expressed as frusta, cylinders,
cones and domes — which is what "out of copyright answers a question about the OBJECT and not about
a picture of it" is meant to guard against.

### The reference the profiles were drawn from

⚠️ Recorded because it was **used**, not because it creates an obligation. Reading a proportion off
a photograph and expressing it as a stack of turned solids is not a derivative of the photograph:
the shape belongs to a public-domain design of the eighteenth or nineteenth century, and what the
photographer holds is copyright in the photograph. The list is here so the next person can check
the drawing instead of trusting it.

| Pattern | Reference | Licence |
|---|---|---|
| Régence | Wikimedia Commons, `File:RegenceChessPcs2.jpg` — the plate from the *Encyclopédie Méthodique* | public domain |
| Selenus | Wikimedia Commons, `File:Selenus2.jpg` — a set of the Schaakmuseum Max Euwe-Centrum, Amsterdam | public domain |
| Selenus | Wikimedia Commons, `File:Selenus chess set.jpg` — KADUN workshop | CC BY-SA 3.0 |
| St George | the pattern's documented piece-by-piece description (ribbed crown and ball finial, large bulb queen, split mitre, four crenellations) | prose, not an image |
| Staunton | the 1849 Jaques pattern, universally figured | — |
| Sikh Empire | current sellers' descriptions of the Amritsar set | prose, not an image |

### ⚠️ Why there are no imported 3D models

A search was made, in September 2026, for ready-made 3D models of these five patterns under a
licence compatible with AGPL-3.0-or-later. **Four of the five have none.**

- **Staunton** — `github.com/clarkerubber/Staunton-Pieces` (STL and SolidWorks, **MIT**) and
  `github.com/quaternionmedia/scad-chess` (OpenSCAD plus SVG profiles, **CC BY 4.0**) are both
  usable. The second is a modern generic set rather than the 1849 pattern.
- **Régence, St George, Selenus, Sikh Empire** — nothing under a compatible licence was found.
  What exists sits on TurboSquid, CGTrader, MakerWorld and Cults, whose terms are royalty-free
  proprietary or "personal use": **NC** breaks freedom 0, **ND** forbids the modification the
  pipeline requires, and "do not redistribute" is incompatible with the whole project.

Compatible would have meant CC0, MIT, BSD, Apache-2.0, CC BY 4.0 with attribution preserved, or
CC BY-SA 4.0 under its one-way compatibility with GPLv3.

It would not have helped much even so. The pieces are a **shared table** read by two renderers, and
an imported mesh can only be used by the WebGL one — so a named pattern would look like one thing on
the flat board and another in 3D, the invariants that keep a piece inside its square would stop
covering the solid view, and the cost is real: one MIT Staunton king is 948 kB of STL against 45 kB
for the entire application bundle. These patterns are **turned on a lathe**, and a lathe profile is
exactly what the table already speaks. The representation was never the problem; the profiles were.

## The Hartwig chess set — ⚠️ OPEN, AND TIME-SENSITIVE

The piece geometry reproduces **Josef Hartwig's Bauhaus chess set, model XVI (1923–1924)**.

**Hartwig was born in Munich on 19 March 1880 and died in Frankfurt am Main in 1956.**

Under Lei nº 9.610/1998, art. 41, economic rights run for 70 years counted from 1 January of the
year following the author's death. For a 1956 death that period runs from 1957-01-01 and ends
**2026-12-31**. The same arithmetic applies in Germany and the rest of the EU (70 years *post
mortem auctoris*, counted from the end of the year of death).

**So the design enters the public domain on 1 January 2027 — roughly four months from now, and
not before.** This document is written in September 2026.

That is the calendar. The legal question it raises is *not* settled here, and this file does not
attempt to settle it:

- A chess set is applied art. Whether these particular shapes attract authorial protection, or
  fall on the functional/idea side, is a question for counsel — not for a build document.
- The set is actively commercialised under licence (Naef, bauhaus-movement.com), and "Bauhaus"
  carries trademark considerations independent of copyright.
- Julian Garnier's `3D-Hartwig-chess-set` has depicted the same design publicly under MIT since
  2013. That is context, not permission.

**This needs the Município's legal opinion before public release.** Three shapes the decision
could take, for whoever reviews it:

1. **Wait.** Ship after 2027-01-01 and the calendar question disappears.
2. **Get an opinion.** Counsel rules on whether the geometry is protected expression at all.
3. **Change the set.** The engine's needs are met by any set whose pieces differ by silhouette;
   Hartwig is the best fit, not the only possible one.

Recorded here rather than assumed, because the deliverable is municipally-owned software
destined for public schools.

## The tactics — Lichess puzzle database (CC0-1.0)

`app/data/puzzles.json` holds 200 puzzles drawn from
[the Lichess puzzle database](https://database.lichess.org/), which its publishers place under
**CC0 1.0** — a public-domain dedication, with no conditions whatsoever. That is what makes it
usable inside an AGPL project without a compatibility argument: there is nothing to be compatible
with. Verified at the source page, not inferred from a mirror.

Each puzzle keeps its Lichess id and `GameUrl`, so any one of them can be traced back to the game
it was taken from. Nothing about a player is copied: no names, no ratings of people, no accounts.

**Regenerating the file** — the dump is 304 MB and is not in this repository:

```
curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
node scripts/build-puzzles.mjs lichess_db_puzzle.csv.zst
```

⚠️ **The file shipped today was built from a 32 MB byte-range PREFIX of that dump, not from the
whole of it** — the dump is ordered by puzzle id, so a prefix is a fair sample, and 33,179 rows was
already more than enough to fill five themes. The `sampled` field in the JSON says so, and
`--allow-truncated` is what the script requires before it will accept a cut-short stream. Running
the two commands above, without the flag, reads the whole file and supersedes it.

⚠️ **Two things about that dump that are not obvious and cost time to find:**

- Its `FEN` is the position **before** the opponent's move, and the first token of `Moves` is that
  opponent move. Taking the FEN at face value produces puzzles that are wrong with nothing
  detecting it. `tests/puzzles.node.test.ts` settles it by requiring a `mateIn1` to be checkmate
  after exactly one move.
- The file opens with a zstd **skippable frame**, which Node's own decompressor refuses
  (`ZSTD_error_prefix_unknown`) even though the `zstd` command reads it without comment. The
  script steps over it.

## The opening names — Lichess ECO tables (CC0-1.0)

`app/data/openings.json` names the opening a game has walked into. It is built from
[`lichess-org/chess-openings`](https://github.com/lichess-org/chess-openings), which its publishers
place under **CC0 1.0** — the same public-domain dedication as the puzzle database, with no
conditions at all.

⚠️ **The names are theirs and are not translated.** "Ruy Lopez" is what it is called in Portuguese,
in Spanish and in English; the ones that genuinely differ between languages differ in ways a
learner meets in books that are themselves in one language or another. Inventing our own spellings
of three thousand of them would make this game the only place they read that way, which is the
opposite of what a name is for. Only the LABEL around the name is translated.

**Regenerating the file:**

```
mkdir -p eco && cd eco
for v in a b c d e; do curl -O "https://raw.githubusercontent.com/lichess-org/chess-openings/master/$v.tsv"; done
cd .. && node scripts/build-openings.mjs eco
```

⚠️ **Truncated at twelve plies** — six moves each side — which keeps 2,833 of the 3,810 lines and
takes the file from 351 kB to 229 kB. It costs nothing when a game goes deeper: the lookup takes
the LONGEST KNOWN PREFIX, so somebody twenty moves into a Najdorf is still told they are in a
Najdorf. `tests/openings.node.test.ts` plays every one of the 2,833 lines through the rules, because
a line that cannot be played is a name that can never appear — and it would fail silently, by
simply never matching.

## The annotated games — the score is a fact, the notes are ours

`app/js/teach/games.ts` carries games as PGN and turns them into lessons. The distinction that
makes the whole stage possible is between the two halves of an annotated game:

- **The moves are facts.** Morphy played 10.Nxb5 at the Paris opera in 1858. That is an event, not
  an expression of anybody's, and a score sheet can come from any source without permission — the
  same reasoning the tactics section applies to a FEN.
- **The notes are expression, and copyright attaches to them.** What a master *said about* a move
  is the thing a chess book actually is.

⚠️ **So the notes shipped today are ours, written for this repository, AGPL like the rest of it.**
The Opera Game (Morphy against the Duke of Brunswick and Count Isouard, Paris 1858) was chosen for
exactly that reason: it is the game beginners are taught first almost everywhere, and using it
needs no permission and no opinion — the mechanism could therefore ship while the book is still
being chosen.

**Still open, and it is an editorial decision rather than a legal one:** the plan names
Capablanca's *Chess Fundamentals* (1921) as the first real title. It is safe to use — Capablanca
died in 1942, so it entered the public domain in Brazil in 2013, and he wrote it in English
himself, which means there is no translator's separate term to clear. What is undecided is *which*
chapters, and who writes the pt-BR and es beside his English, since those translations would be new
work of ours. `gameLesson()` takes his games unchanged the day that is settled.

⚠️ **Two books that look usable and are not**, recorded so nobody re-derives the mistake: Edward
Lasker's *Chess Strategy* (1915) is by the OTHER Lasker, who died in 1981 and is protected in
Brazil until **2052** — it sits on Project Gutenberg only because the United States counts
publication + 95 years for works before 1929. And the English editions of Tarrasch and of Emanuel
Lasker carry translators and editors with terms of their own; only the German originals are clear.

## The original project

`juliangarnier/3D-Hartwig-chess-set` (MIT) is the **inspiration and the reference for feature
parity**. No code is copied from it: that project renders with CSS 3D transforms on DOM nodes,
and this one renders with Zdog geometry straight into a canvas — through PixiJS until the
compositor was measured at 465 KB for drawing one canvas into another, and removed. Credit is due
and given in the README regardless.
