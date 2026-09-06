# Inclusionist Chess — Hartwig's Bauhaus set, and a flat board beside it

A playable chess game with an opponent, in **two views of one game**:

- **2.5D** — the board and the 32 pieces drawn with **Zdog** at **640×360**, upscaled by an integer
  factor in physical pixels.
- **2D** — the same game as a flat board of glyphs in the DOM, in the conventions a learner has
  already met.

A **3D** view through Three.js is measured and specified but not built; its button is on screen and
says so.

The doubling to 640×360 is measured, not aesthetic: a board drawn in projected 3D has no
axis-aligned edges, because the camera is pitched, and diagonals are the one thing low-resolution
pixel art handles worst. The staircase step is one source pixel, so it grows with the screen — five
physical pixels at a 1600-wide window. Doubling the source halves it while keeping the art
integer-scaled, 16:9, and recognisably a sibling of the platformer. See `app/js/render/resolution.ts`.

It reimplements [`juliangarnier/3D-Hartwig-chess-set`](https://github.com/juliangarnier/3D-Hartwig-chess-set)
(2013, MIT), which achieved its 3D entirely with CSS transforms on DOM nodes, targeting feature
parity: full rules, an opponent, a draggable camera, move animation, captured pieces.

## Why Zdog for this, of all things

Josef Hartwig's 1924 set is stereometry and nothing else. In his own words: pawn and rook move at
right angles to the edge of the board and are expressed by the **cube**; the knight moves in a hook
over four squares and is **four cubes combined at right angles**; the bishop moves diagonally and is
**a cross cut from the cube**; the king is **a smaller cube turned across the corner of a larger
one**; the queen takes **a circle on top** for her versatility.

Five of the six pieces are `Zdog.Box` composed under an `Anchor`. There is not one organic surface
in the set. It is very likely the only chess set that draws in Zdog without a single compromise —
and, because Hartwig distinguishes pieces by *shape of movement* rather than by figure, it is also
the only one whose silhouettes survive being fourteen pixels tall.

That claim was tested before anything was built: `docs/spike-0-legibility.md`.

## Two views, two entry points, one game

Each view is its own page, and that was decided by measurement rather than taste
(`spike/2d-weight/`):

| | raw | gzip |
|---|---|---|
| `2d.html` — flat, no renderer | **110.5 KB** | 39.2 KB |
| `index.html` — Zdog | **148.1 KB** | 50.2 KB |

A flat board offered as a *mode* inside one bundle would have made every player download the
renderer they were not looking at. What they share is the larger half — rules, search, declaration,
HUD, i18n — in one chunk both pages fetch. What differs is about fifty lines.

**There is no compositor.** Zdog draws straight into the canvas in the document. It used to go
through a PixiJS texture and sprite, which cost **465 KB raw and 138 KB gzipped** — measured from
two directions — to draw one canvas into another; the HUD had been DOM since step 8 and the
colour-vision correction was always a CSS filter on the region. `render/frame-ticker.ts` replaces
the only part that was load-bearing: the clock.

The game survives a change of view. `chess/session.ts` writes the **moves**, not a FEN — a FEN is
the position and would lose the score sheet, the captured tally that is read from it, and both
directions of the take-back.

## Accessibility

Everything below the game comes from `@the-inclusionist/engine` through a single `createGame()`
call: screen reader, colour-vision filters, remappable input as intent, dialog stack, menu
navigation, typography, text-to-speech, and blind-navigation sonar.

**The seven fields of the engine's contract carry chess directly** — `app/js/declaration/`. An
empty square the opponent covers declares itself `hazard`, which is what makes the sonar warn about
threats with no audio code written here; your own piece is `structure`, an enemy piece is a `key`,
the enemy king is the `goal`. On the opening board that marks the whole sixth rank, covered
diagonally by black's pawns — which is exactly where danger starts for a white piece.

**The canvas is not the source of truth for interaction.** It is `aria-hidden`, and the board a
screen reader meets is `app/js/ui/grid-mirror.ts`: 64 real buttons in a real grid, labelled in
algebraic notation, ahead of the canvas in the DOM. A whole move can be played by keyboard alone.

**And that grid IS the 2D board.** `visible: true` takes off its `sr-only` and puts a glyph in each
cell — so everything that made it work for a screen reader is what makes it work for a pointer.
Turning the board round for a player with the black pieces is a CSS rotation of the element, which
leaves the rows, the columns, the reading order and the arrow keys exactly as they were.

Also here: seven named board palettes with **every ratio computed and shown on screen** while one is
being chosen (`ui/contrast-report.ts`); the engine's three colour-vision **corrections**, applied to
board and panel together; a reduced-motion switch; switchable board coordinates; a choice of side
and of piece drawing; and pt · en · es from the first commit.

⚠️ The measurements are not all flattering, and none of them is hidden. Four of the seven palettes
have piece fills below the 3:1 floor of WCAG 1.4.11 — that is how the printed convention works, and
what carries them is the rim — so the on-screen table marks those differently from a real failure
instead of pretending. `app/js/render/palette.ts` and `app/js/ui/board-themes.ts` carry the full
tables, including the parts that cost something.

## Running it

```bash
NODE_OPTIONS=--use-system-ca npm install
npm run validate
```

`validate` is `tsc --noEmit` → `vitest run` (node + Chromium) → `vite build`, and all three must be
clean. Node ≥ 24.

**The Vite dev server does not run in the sandbox** — dependency pre-bundling never completes.
Build first, then serve `dist/` statically; the session's `.claude/launch.json` has a `chess-dist`
entry on port 8195.

`?debug=true` exposes `window.__chess` (2.5D) or `window.__chess2d` (2D) — the game state, the
rules, and `step(dt)`, which drives one frame by hand. A hidden browser pane never fires
`requestAnimationFrame`, so without that an animation can only be advanced by taking a screenshot,
and cannot be verified at all.

## Regenerating the tactics

`app/data/puzzles.json` is checked in — 200 curated puzzles from the Lichess database (CC0-1.0),
so a child on a school connection never waits on a third-party download. The 304 MB dump it comes
from is not in this repository. To rebuild it:

```bash
curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
node scripts/build-puzzles.mjs lichess_db_puzzle.csv.zst
```

The curation — which themes, which rating band, how many — is at the top of the script, with the
reasoning. `docs/LICENSES.md` records the licence and two traps the dump sets for whoever reads it
next.

## Regenerating the opening names

`app/data/openings.json` is checked in — 2,833 openings from the Lichess ECO tables (CC0-1.0),
used to name the line a game has walked into. To rebuild it:

```bash
mkdir -p eco && cd eco
for v in a b c d e; do curl -O "https://raw.githubusercontent.com/lichess-org/chess-openings/master/$v.tsv"; done
cd .. && node scripts/build-openings.mjs eco
```

## Layout

```
app/index.html         the 2.5D page          app/2d.html   the 2D page
app/js/chess/          rules, state machine, negamax engine + Worker, session — no renderer, no DOM
app/js/declaration/    the engine's seven fields, said in chess
app/js/render/         Zdog geometry, the frame clock, camera, picking, palette
app/js/ui/             the grid mirror (and 2D board), the HUD, themes, piece sets, coordinates
app/js/i18n/           this game's own dictionary (pt · en · es)
app/js/boot/           two composition roots: main.ts (2.5D) and main-2d.ts (2D)
tests/                 *.node.test.ts (pure logic) · *.browser.test.ts (canvas, DOM, focus)
docs/                  design decisions and spike findings
spike/                 throwaway probes, kept for their evidence
```

## Credits and licences

AGPL-3.0-or-later. Economic ownership belongs to the Município — see
[`docs/LICENSES.md`](docs/LICENSES.md), which also records an **open, time-sensitive question**
about the Hartwig design's copyright status that needs a legal opinion before public release.

Original demo by **Julian Garnier** (MIT) — the reference for feature parity; no code is taken from
it, since that project renders with CSS transforms and this one with Zdog geometry. Chess set design
by **Josef Hartwig** (1880–1956), Bauhaus Weimar, 1924. **Zdog** by Metafizzy (MIT). **chess.js** by
Jeff Hlywa (BSD-2-Clause).

Board palettes are named for where they come from — lichess and chessboard.js (MIT), XBoard (GPL),
Wikipedia's diagram template. A pair of hex values is a fact rather than creative expression, so
none of them needed permission; they are named for credit and so that a player who has met a board
elsewhere can find it again.
