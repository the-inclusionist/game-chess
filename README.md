# Inclusionist Chess — Hartwig's Bauhaus set, a flat board, and a course

A chess game with an opponent that also **teaches chess**, in **three views of one game**:

- **2.5D** — the board and the 32 pieces drawn with **Zdog** at **360×360**, upscaled by an integer
  factor in physical pixels.
- **2D** — the same game as a flat board of glyphs in the DOM, in the conventions a learner has
  already met.
- **3D** — the same set through **Three.js**, with a camera you can turn.

All three teach. The title screen offers **JOGAR** and **APRENDER**, and everything below the game
— the screen reader, the sonar, the remappable input, the colour-vision correction — is the same
in all three because it is composed once, in `app/js/boot/game-shell.ts`.

The doubling is measured, not aesthetic: a board drawn in projected 3D has no axis-aligned edges,
because the camera is pitched, and diagonals are the one thing low-resolution pixel art handles
worst. The staircase step is one source pixel, so it grows with the screen — five physical pixels
at a 1600-wide window. Drawing at twice the engine's base halves it while keeping the art
integer-scaled. See `app/js/render/resolution.ts`.

⚠️ **The raster is SQUARE, and it was 640×360 until the layout was specified.** A chess board in a
16:9 raster can only use the height: the projected board measured 258×217 inside 640×360, forty per
cent of the width, with the rest letterboxed. That was invisible while the HUD was drawn in the
same canvas and filled the right 27.5% of it — when the teaching mode moved the HUD out to the DOM,
the letterbox was all that was left there.

## The stage: sixteen units by nine

The board, the side panel and the two bands that belong to the board share one box whose sides are
in the ratio 16:9. Nine of those units are a **perfect square for the board**, seven are the panel.
At the floor that is a 640×360 stage — the engine's 320×180 doubled — holding a 360×360 board and a
280×360 panel, which makes one unit 40 pixels.

**Nothing is drawn outside it.** `#stage` clips, so that holds by construction rather than by every
child remembering it, and a test sweeps every visible element to prove none is relying on the clip
to hide a mistake. The player names, the blunder bar and the engine's thinking line live inside the
board's nine units — above it and below it — and the keyboard reference lives in the pause menu.

⚠️ **Which sizes exist depends on the screen.** The board's raster must land on whole PHYSICAL
pixels, so the ladder is "how many real pixels does one art pixel get" and the stage is whatever
that makes: 640×360, 1280×720, 1920×1080 at a device ratio of 1, with the intermediate steps
appearing at a ratio of 2, where 540 CSS pixels are 1080 real ones.

⚠️ **The flat board shrinks for those two bands and the other two do not.** The flat grid is in
flow, so they take 96 pixels from it; the projected and solid canvases fill the whole region and
ride under them, because a player can zoom those two and cannot zoom the flat one.

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

## Teaching, and why it is data rather than script

A child who opens a chess board for the first time cannot read the game's own instructions: the
hint says "move the Knight to f3" to somebody who has never heard of f3. So the first lesson is
**algebraic notation**, and the course runs from there through the value of the pieces, each
piece's move, the three special rules, and two endgame ideas.

**A lesson is a table, not a routine** — `app/js/teach/lesson.ts`. A step is a FEN, a sentence, and
one of three tasks: `play` a move, `mark` a set of squares, or `pick` an answer. A move is asked for
by *what has to be true of it*, so "castle short" is `{castle:'king'}` rather than a string match on
`O-O`, and "capture en passant" is a flag the rules already set. That is what makes the whole
syllabus checkable by a test rather than by playing it: `tests/teach-table.node.test.ts` builds
every position, plays every asked-for move, and re-derives every marked square from the rules.

The same shape carries the other content. A tactic from the Lichess database is a lesson whose steps
are `play` (`app/js/puzzles/`); the two endgame lessons are generated from geometry
(`app/js/endgame/geometry.ts`) rather than quoted from a book, and their multiple-choice answers are
re-computed in the test instead of trusted — the one number in a syllabus that can be typed in
wrongly and still pass everything.

And a book is the same shape a third time (`app/js/teach/game-lesson.ts`): an annotated game is a
list of steps whose asked-for move is the one the master played and whose sentence is the note on
it. Only the ANNOTATED moves become steps — the annotator's choice of where to stop is what a book
is — and the student plays both sides, because that is how a game is studied. The one shipped today
is Morphy's Opera Game with our own notes; the moves of a game are facts, the notes are not, and
`docs/LICENSES.md` says which books are old enough for theirs to be usable.

The reasoning behind all of this — why a lesson is a table, why a puzzle has an opponent and a book
does not, and what the model cost to get right — is [`docs/design-teaching.md`](docs/design-teaching.md).

⚠️ **Four of the thirteen lessons were unplayable when first written**, and no amount of reading
would have found it: two lone kings, king and bishop, and king and knight are insufficient material,
so `isGameOver()` was already true and the board refused every square before the first step. Each of
those positions now carries one spare pawn, and the table test asserts the phase is `idle`.

## One entry, three views, one game

⚠️ **This was three PAGES until 2026-09-11** — `index.html`, `2d.html` and `3d.html`, one per view,
switched by links. The measurement that justified them still stands and it is worth keeping: from
`spike/2d-weight/`, a flat board needs 104 KB and the Zdog one 146, so a single bundle with a
runtime switch would have made every player download the renderer they were not looking at.

What changed is the mechanism, not the arithmetic. Each renderer is a dynamic `import()` now, so it
is a chunk nobody parses unless they choose that view:

| | built |
|---|---|
| `view-flat` — the flat board, no renderer | **0.8 KB** |
| `view-zdog` — the projected board | **38.2 KB** |
| `view-solid` — Three.js | **540.7 KB** |

That is *better* than three pages, where opening `3d.html` loaded Three.js eagerly whatever you did
next. And the reason it had to change is not weight at all: a game is becoming a cartridge inside a
platform, and there a second HTML entry is a second URL rather than a second bundle.

What every view shares is the larger half: rules, search, declaration, HUD, i18n and the whole
teaching driver. The lesson prose, the puzzles and the 2,833 opening names are dynamic imports too,
so nobody who only wants a game carries them.

Changing view is a **button** now, not a link, and the choice is remembered in the session — the
address used to remember it, and one document showing all three leaves it nowhere else to live.

**There is no compositor.** Zdog draws straight into the canvas in the document. It used to go
through a PixiJS texture and sprite, which cost **465 KB raw and 138 KB gzipped** — measured from
two directions — to draw one canvas into another; the HUD had been DOM since step 8 and the
colour-vision correction was always a CSS filter on the region. `render/frame-ticker.ts` replaces
the only part that was load-bearing: the clock.

The game survives a change of view. `chess/session.ts` writes the **moves**, not a FEN — a FEN is
the position and would lose the score sheet, the captured tally that is read from it, and both
directions of the take-back.

## The controls

Movement is arrows **or** WASD; the rest are the engine's remappable intents, so a saved remapping
travels. The hint line lives in the **pause menu's footer** — a control list belongs beside the
controls, and under the board it sat outside the sixteen-by-nine stage.

**The line is derived, not typed.** Both halves of it: the words come from the catalogue and follow
a change of language, and the keys come from `kbFor(0)` — the same object a remapping writes into —
so a player who moves the pause key to P is told to press P. It printed seven fixed letters until
2026-09-11, which meant a remapped game had a line politely translated into a lie.

⚠️ **The sonar is the exception, and it is a gap rather than a design.** `L` is a literal in the
code, because the intent it used to ride (`especial`) is not in engine 8's vocabulary at all — the
name survives there in one comment, listing what was replaced. So it is the one control here that
cannot be remapped, which is worth knowing precisely because it is the key a player who cannot see
the board depends on.

| | |
|---|---|
| arrows / **W A S D** | move the cursor |
| **J** *(or Space)* | select · confirm |
| **K** | cancel |
| **U** | teacher on / off |
| **I** | switch between the board and the side panel |
| **L** | sonar |
| **H** *(or Enter, or Escape)* | pause menu — display settings, and the way out of a lesson |
| ⇧ + WASD · ⇧ + **+** / **−** | turn and zoom the camera (2.5D and 3D) |

The teacher is a **toggle**, and in a lesson it stays locked until the third mistake on a step —
help that arrives before anyone has tried is not help. What it reveals is the *arrows*, never the
squares: `show.squares` can be the question itself ("which square is this?"), so revealing it would
answer the exercise.

## Accessibility

Everything below the game comes from `@the-inclusionist/engine` through a single `createGame()`
call: screen reader, colour-vision filters, remappable input as intent, dialog stack, menu
navigation, typography, text-to-speech, and blind-navigation sonar.

**The accessibility bar sits at the top of the side panel**, and the engine mounts it: blind mode,
text-to-speech, Libras, and a calm mode, as labelled buttons in the tab order. It is a sibling of
the panel rather than a child, so a lesson hiding the panel cannot take it away — a control that
disappears while a child is being asked to concentrate is worse than no control.

⚠️ **It arrived on 2026-09-11, and what it replaced was nothing at all.** Searched before it was
built: this game exposed no switch for blind mode, none for text-to-speech, and the word Libras
appeared nowhere in `app/`. The sonar was reachable only by knowing the `L` key. Every display
setting it did offer was behind a pause menu, which was behind knowing that START opens one — so a
child who needed the screen reader in order to begin could not reach the thing that would read it.
The engine had been reporting the absence by name since 8.0.0; five of the six games in its local
catalogue had the same hole.

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

**Never colour alone**, and the lessons pay for it twice. A square you touched answers blue when you
were right and red when you were wrong — and those two measure **1.06:1** against each other, which
was measured before they were chosen, so the *shape* carries the meaning: right is a filled square,
wrong is a hollow ring, and the label says which. A lesson highlight is a third shape rather than a
third colour, because it can coincide with "selected" and "you may capture here" in the same turn.

Also here: seven named board palettes (one of them colour-blind safe) with **every ratio computed
and shown on screen** while one is being chosen (`ui/contrast-report.ts`); the engine's three
colour-vision **corrections**, applied to board and panel together; a reduced-motion switch;
switchable board coordinates; a choice of side and of piece drawing; and pt · en · es from the first
commit.

**Nothing is clickable until it works.** The opponent is a 7 MB download, and the title screen's two
buttons stay disabled behind a progress bar in the footer until it has finished — because some of
Capablanca's exercises let the student go on playing, and a game that let you start without an
opponent would fail at exactly the point it mattered.

⚠️ The measurements are not all flattering, and none of them is hidden. Five of the seven palettes
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
clean. Node ≥ 24. The floor is **896 tests across 56 files**.

The engine is a published dependency — `@the-inclusionist/engine@^8.0.0` from npm, with `pixi.js`
arriving as its declared peer. It used to be a `file:` link to a sibling checkout, which stopped
resolving the day that directory was renamed: the repository did not install at all until the move
to the registry on 2026-09-11.

**The Vite dev server does not run in the sandbox** — dependency pre-bundling never completes.
Build first, then serve `dist/` statically; the session's `.claude/launch.json` has a `chess-dist`
entry on port 8195.

`?debug=true` exposes `window.__chess` (2.5D), `window.__chess2d` (2D) or `window.__chess3d` (3D) —
the game state, the rules, and `step(dt)`, which drives one frame by hand. A hidden browser pane
never fires `requestAnimationFrame`, so without that an animation can only be advanced by taking a
screenshot, and cannot be verified at all.

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

## Re-checking the search's fast path

`chess/rules.ts` keeps a second move interface that passes opaque tokens, on the strength of one
measurement. It is runnable rather than remembered:

```bash
node scripts/bench-chess-js.mjs
```

## Layout

```
app/index.html         the one page; the view is chosen inside it and remembered
app/css/board.css      one stylesheet, after three byte-identical copies of it
app/js/chess/          rules, state machine, negamax engine + Worker, session — no renderer, no DOM
app/js/declaration/    the engine's seven fields, said in chess
app/js/teach/          the syllabus as data: lesson shapes, the 13 lessons, the tutor, the books
app/js/puzzles/        a Lichess tactic, expressed as a lesson
app/js/endgame/        the square rule and the opposition, as arithmetic — nobody's prose
app/js/openings/       naming the line a game began with
app/js/render/         Zdog geometry, the frame clock, camera, picking, palette
app/js/render3d/       the Three.js scene, and its markers
app/js/ui/             the grid mirror (and 2D board), HUD, splash, pause menu, lesson menu, themes
app/js/i18n/           this game's own dictionary (pt · en · es), with the lesson prose split off
app/js/boot/           one shell (game-shell.ts), three roots, three view adapters
scripts/               the data builders, and the benchmark the fast path rests on
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
by **Josef Hartwig** (1880–1956), Bauhaus Weimar, 1924. **Zdog** by Metafizzy (MIT). **Three.js**
(MIT). **chess.js** by Jeff Hlywa (BSD-2-Clause).

Tactics and opening names from **Lichess** (CC0-1.0), which asks nothing in return and is credited
anyway.

Board palettes are named for where they come from — lichess and chessboard.js (MIT), XBoard (GPL),
Wikipedia's diagram template. A pair of hex values is a fact rather than creative expression, so
none of them needed permission; they are named for credit and so that a player who has met a board
elsewhere can find it again.
