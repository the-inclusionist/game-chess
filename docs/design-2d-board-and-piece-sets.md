# The 2D board, the piece sets, and which of the two modes is actually the cheap one

Status: **specification agreed, three decisions still open.** Nothing here is built yet.

This document exists because two of the questions behind it have answers that are the opposite of
what they sound like, and both were measured rather than assumed.

## 1. What is being specified

A second way of drawing the same game: an **8×8 board of glyphs in the DOM**, instead of Zdog
geometry rasterised through PixiJS. Same rules, same opponent, same declaration, same screen
reader, same keyboard.

The piece drawings become a **choice**, not a constant. At least:

| Set | Source | Weight | Note |
|---|---|---|---|
| Hartwig silhouettes | drawn here, in CSS or SVG | none | the same six shapes, flat |
| Unicode chess symbols | STIX Two Math | subset | U+2654–U+265F |
| Unicode chess symbols | Noto Sans Symbols 2 | subset | same block, different hand |
| Emoji | the reader's OWN system font | none | not the symbol block — a different set of pictures |
| Handwritten | Pecita | subset | ⚠️ not on Google Fonts; licence to confirm |

**Fonts are vendored, never fetched at runtime.** That is the engine's existing practice and it is
not a preference: `app/public/vendor/fonts/` holds **36 `.woff2` files, 928 KB for eighteen
families**, declared in `vendor/fonts.css` with fourteen `unicode-range` blocks for on-demand
loading, and there is not one request to `googleapis` or `gstatic` anywhere in that repository.
Three reasons, in order of weight:

1. **Offline.** The engine is a PWA and the destination is a school. A runtime link to a CDN means
   a board with no pieces the moment the connection drops.
2. **LGPD.** A runtime font request sends a child's IP address to a third party. In software owned
   by a município that is not a detail.
3. **Size.** 928 KB for eighteen complete families is what subsetting buys. A board needs **twelve
   codepoints**; the two symbol fonts cut to those should be a few KB each — to be measured, not
   assumed.

**Emoji is the exception, and the engine already decided it.** `app/css/style.css` carries exactly
one `@font-face`: `src: local('Noto Color Emoji')` — the system font, no download, with the comment
*"o .woff2 nunca existiu"*. So the emoji set draws with whatever the device has: Segoe UI Emoji on
Windows, Noto on ChromeOS. It therefore looks different from machine to machine, and the label has
to say so.

**Changing the set changes nothing a screen reader hears.** The meaning of a square lives in the
`aria-label` of `ui/grid-mirror.ts`, not in what is drawn. A glyph goes in as `aria-hidden`
decoration. That is what makes this a cheap legibility control rather than a risk.

## 2. ⚠️ Which mode is the light one — and the answer depends on a decision not yet taken

The question was "is 2D the simpler one with less to load, or is 3D?". Measured, it is **both, on
different axes**, and the download axis is decided by something else entirely.

**At runtime, 2D is cheaper and it is not close.** The 3D board runs `updateGraph` + painter sort +
Canvas2D raster every frame: **1.44 ms for 450 sorted shapes**, measured over 60 frames in
`spike-0-legibility.md`. A DOM board paints when something changes and is idle the rest of the
time. On a school Chromebook that is battery, not benchmark.

**At download, it depends on whether 2D is a MODE or a GAME:**

- **As a mode inside this game**, 2D saves nothing and costs the fonts. The bundle already carries
  PixiJS because the 3D board needs it, and a mode does not remove it. Current build: **600 KB
  minified, 190 KB gzipped**.
- **As its own game, it drops PixiJS entirely** — and that is the large number. ⚠️ This paragraph
  used to end with an estimate by subtraction and a note saying arithmetic on two measured numbers
  is not a measured build. **The build was made** (`spike/2d-weight/`): one entry importing
  everything a DOM-only chess needs — `createGame`, the rules, the state machine, the search
  client, the declaration, the grid mirror, the HUD, the layout, i18n — and nothing from `render/`
  beyond the pure geometry the mirror already reaches for.

  |  | raw | gzip |
  |---|---|---|
  | 3D — Zdog + PixiJS | 600.21 KB | 182.97 KB |
  | 2D — DOM only | **104.17 KB** | **36.70 KB** |

  **5.8× smaller raw, 5.0× gzipped**, and `grep` finds zero occurrences of `pixi` or `zdog` in the
  2D bundle: the bundler was not persuaded to leave them out, it was never given a reason to
  include them. The estimate said "roughly 130 KB before fonts" and was conservative on the right
  side. The dynamically imported chunks — the ONNX runtime and the Piper voice behind the engine's
  neural TTS — are byte-identical in both builds and gated on a user choice, so they are deploy
  weight in both and not part of this comparison.

Everything the engine gives stays either way. Its colour-vision corrections are SVG/CSS filters
applied to `#game-region` — `boot/main.ts` sets `region.style.filter` — so a DOM board inherits
them. High contrast, reduced motion, sonar, TTS, i18n and the intent layer are all Pixi-free.

**The resolution that gets both: one repository, two entry points.** `chess/`, `declaration/`,
`ui/` and `i18n/` are shared source — which is most of what is hard to get right — while the 2D
build never imports the renderer and therefore never pays for it. It is not two codebases and it is
not one bundle carrying two renderers.

## 3. Board coordinates, switchable, in both modes

Agreed requirement: the file letters and rank numbers on the edges of the board can be turned on
and off, in 2D and in 3D alike. On by default is the pedagogical choice — the algebraic names are
what the screen reader already speaks, and seeing them is how a sighted learner connects the two.

⚠️ **In 3D this is not free, because Zdog cannot draw text.** It has no text primitive of any kind.
Three ways out, and the recommendation is the first:

1. **A DOM overlay positioned by the projection.** The machinery exists: `boot/main.ts` already
   computes `screenOf(square)` under `?debug=true`, using the same projected corners the picking
   reads. Real text — it scales with `--ui-fs`, honours the reader's own font size, and never meets
   the pixel grid, so it sidesteps the blur this project has already fought twice. It must follow
   the camera, which is recomputed every frame anyway. `aria-hidden`, because the grid mirror
   already names every square.
2. `ctx.fillText` onto the offscreen canvas after `updateRenderGraph()`. Cheap, and it puts text
   back into a 640×360 buffer that is then upscaled — the fight we already know the shape of.
3. Glyphs built out of Zdog shapes. Correct, absurd, and rejected on sight.

## 4. ⚠️ Hartwig cannot ship this year — so what does

`LICENSES.md` records it: Hartwig died in 1956, the design enters the public domain on
**2027-01-01**, and publication before that needs the Município's legal opinion. The set is the
reason this project exists, so it stays; what it needs is a **second 3D set that has no calendar**,
so the game can be published without waiting.

**Recommendation: the Staunton set (1849).** Three reasons, and the third is a pleasant surprise.

- **No calendar.** The design was registered in 1849 by Nathaniel Cooke and marketed by Jaques of
  London. Any design right expired more than a century ago, and the pattern has been reproduced
  freely worldwide ever since. ⚠️ Two cautions that are about naming and copying, not about the
  shapes: a specific *modern* rendering can carry its own rights, so the geometry must be modelled
  here from the classic proportions rather than traced from someone's file; and "Staunton" is a
  trademark of Jaques in some jurisdictions, so the shapes are safe to use and the word needs care
  in branding. Both are for counsel to confirm, in the same opinion that covers Hartwig.
- **It is what a child sees everywhere else.** A learner who plays anywhere but here meets these
  shapes, which makes it the pedagogically neutral default while Hartwig is the one with an
  argument behind it.
- **⚠️ It is a better fit for Zdog than it sounds.** A Staunton piece is a *lathe profile* — a stack
  of turned solids — and Zdog ships exactly that vocabulary: `Cylinder`, `Cone`, `Hemisphere`,
  `Ellipse`, `RoundedRect`, `Polygon`. This repository only declared `Anchor`, `Box`, `Ellipse`,
  `Hemisphere`, `Rect` and `Shape` in `app/js/types/zdog.d.ts` because that is all Hartwig needed;
  the rest are already in the library. The set stays what `PIECE_SPECS` is today — data, with the
  invariants proved in the node project.

**The alternative worth naming, and why it is second:** a geometric set of our own design, owned by
the Município, with no third-party rights of any kind. Legally the strongest answer there is. It
forfeits recognisability, and Hartwig exists precisely because a geometric set that actually reads
is hard — betting on doing it well, quickly, in order to avoid a licence question is a worse bet
than using a design that has been in the public domain since before anyone alive was born.

**For the 2D mode there is a third family of options**: the Cburnett piece SVGs — the set Wikipedia
and Lichess use — are CC-BY-SA 3.0. Usable with attribution, but share-alike is a condition to take
deliberately rather than by accident, and the font route already gives the 2D board what it needs.

## Open decisions

1. ~~**Mode or game?**~~ **SETTLED by measurement**: one repository, two entry points. A 2D-only
   build is 104 KB against 600 KB, so a 2D board offered as a mode inside the 3D bundle would ask a
   school's connection for 496 KB it never uses. What remains is engineering, not a decision.
2. **Pecita.** Not on Google Fonts, obtained from `pecita.eu`, SIL OFL — so subsetting and shipping
   is permitted if the licence is confirmed. Until it is, it belongs in the catalogue with the
   engine's own `off:` marker, which exists for exactly this state.
3. **The figurative sets.** See §5.
