# Inclusionist Chess — Hartwig's Bauhaus set in pseudo-3D

A playable chess game with an opponent. The board and the 32 pieces are drawn with **Zdog** and
composited with **PixiJS**, at **640×360** — twice the Inclusionist engine's base — upscaled by an
integer factor in physical pixels.

The doubling is measured, not aesthetic: a board drawn in projected 3D has no axis-aligned edges,
because the camera is pitched, and diagonals are the one thing low-resolution pixel art handles
worst. The staircase step is one source pixel, so it grows with the screen — five physical pixels
at a 1600-wide window. Doubling the source halves it while keeping the art integer-scaled, 16:9,
and recognisably a sibling of the platformer. See `app/js/render/resolution.ts`.

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
the only one whose silhouettes survive being fourteen pixels tall. A figurative set would not.

That claim was tested before anything was built: `docs/spike-0-legibility.md`.

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

Also here: a high-contrast palette solved numerically so all four piece-against-square pairs clear
3:1 (`app/js/render/palette.ts` carries the measured table, including the part that is not
flattering); the engine's three colour-vision **corrections**, applied to board and panel together;
a reduced-motion switch; and pt · en · es from the first commit.

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

`?debug=true` exposes `window.__chess` — the game state, the rules, and `step(dt)`, which drives one
frame by hand. A hidden browser pane never fires `requestAnimationFrame`, so without that an
animation can only be advanced by taking a screenshot, and cannot be verified at all.

## Layout

```
app/js/chess/          rules, state machine, negamax engine + Worker — no renderer, no DOM
app/js/declaration/    the engine's seven fields, said in chess
app/js/render/         Zdog geometry, the PixiJS surface, camera, picking, palette
app/js/ui/             the DOM grid mirror and the HUD
app/js/i18n/           this game's own dictionary (pt · en · es)
app/js/boot/           the composition root: the only module that knows PixiJS concretely
tests/                 *.node.test.ts (pure logic) · *.browser.test.ts (canvas, DOM, focus)
docs/                  design decisions and spike findings
spike/                 throwaway probes, kept for their evidence
```

## What is being considered next

A second way of drawing the same game — an 8×8 board of glyphs in the DOM, with the piece drawing
becoming a choice (Hartwig silhouettes, Unicode symbols, emoji) — plus switchable board
coordinates and a second 3D set that does not have to wait for a calendar. Written down, with the
measurements behind it, in [`docs/design-2d-board-and-piece-sets.md`](docs/design-2d-board-and-piece-sets.md).

## Credits and licences

AGPL-3.0-or-later. Economic ownership belongs to the Município — see
[`docs/LICENSES.md`](docs/LICENSES.md), which also records an **open, time-sensitive question**
about the Hartwig design's copyright status that needs a legal opinion before public release.

Original demo by **Julian Garnier** (MIT) — the reference for feature parity; no code is taken from
it, since that project renders with CSS transforms and this one with Zdog geometry through PixiJS.
Chess set design by **Josef Hartwig** (1880–1956), Bauhaus Weimar, 1924. **Zdog** by Metafizzy
(MIT). **chess.js** by Jeff Hlywa (BSD-2-Clause). **PixiJS** (MIT).
