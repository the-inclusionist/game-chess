# Inclusionist Chess — Hartwig's Bauhaus set in pseudo-3D

A playable chess game. The board and the 32 pieces are drawn with **Zdog** and composited with
**PixiJS**, at the Inclusionist engine's fixed **320×180** logical resolution, upscaled by an
integer factor in physical pixels.

It is a reimplementation of [`juliangarnier/3D-Hartwig-chess-set`](https://github.com/juliangarnier/3D-Hartwig-chess-set)
(2013, MIT) — which achieved its 3D entirely with CSS transforms on DOM nodes — targeting feature
parity: full rules, an opponent, a draggable camera, move animation, captured pieces.

## Why Zdog for this, of all things

Josef Hartwig's 1924 set is stereometry and nothing else. In his own words: pawn and rook move at
right angles to the edge of the board and are expressed by the **cube**; the knight moves in a hook
over four squares and is **four cubes combined at right angles**; the bishop moves diagonally and is
**a cross cut from the cube**; the king is **a smaller cube turned across the corner of a larger
one**; the queen takes **a circle on top** for her versatility.

Five of the six pieces are `Zdog.Box` composed under an `Anchor`. There is not one organic surface
in the set. It is very likely the only chess set in the world that draws in Zdog without a single
compromise — and, because Hartwig distinguishes pieces by *shape of movement* rather than by figure,
it is also the only one whose silhouettes survive being 14 pixels tall. A figurative set would not.

## Accessibility

Everything below the game comes from `@pm-monte/inclusionist-engine` via a single `createGame()`
call: screen reader, colour-vision filters, remappable input as intent, dialog stack, menu
navigation, typography, text-to-speech, and blind-navigation sonar.

The seven fields of the engine's contract carry chess semantics directly. A square attacked by the
opponent declares itself `hazard`, so the sonar warns about threats with no audio code written
here; the enemy king is the `goal`; `distance` on a grid is Chebyshev, which is the king's step.

The canvas is not the source of truth for interaction. A visually-hidden 8×8 grid of buttons,
labelled in algebraic notation, is what keyboard and screen reader drive; the canvas is a view.

## Running it

```bash
NODE_OPTIONS=--use-system-ca npm install
npm run validate
```

`validate` is `tsc --noEmit` → `vitest run` (both projects) → `vite build`, and all three must be
clean. Node ≥ 24.

**The Vite dev server does not run in the sandbox** — dependency pre-bundling never completes and
the module graph comes up dead. Build first, then serve `dist/` statically. The session's
`.claude/launch.json` carries a `chess-dist` entry on port 8195 for exactly that.

## Layout

```
app/js/chess/      rules, search, state — no renderer, no DOM
app/js/render/     Zdog geometry, the PixiJS surface, camera, picking
app/js/i18n/       this game's own dictionary (pt · en · es)
app/js/boot/       the composition root: the only module that knows PixiJS concretely
tests/             *.node.test.ts (pure logic) · *.browser.test.ts (canvas, DOM, focus)
docs/              design decisions and spike findings
spike/             throwaway probes, kept for their evidence
```

## Credits and licences

AGPL-3.0-or-later. Economic ownership belongs to the Município — see
[`docs/LICENSES.md`](docs/LICENSES.md), which also records an **open, time-sensitive question**
about the Hartwig design's copyright status that needs a legal opinion before public release.

Original demo by Julian Garnier (MIT). Chess set design by Josef Hartwig (1880–1956), Bauhaus
Weimar, 1924. Zdog by Metafizzy (MIT).
