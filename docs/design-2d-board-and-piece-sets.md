# The 2D board, the piece sets, and which of the two modes is actually the cheap one

Status: **specification agreed; the two measurements it waited on are done.** The 2D weight is
settled (§2) and the outline budget is settled (§5). No piece set is built yet.

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

## 5. The piece sets, and the budget that decides what they can be

### ⚠️ The measurement that has to come first

A figurative piece is not one solid; it is a dozen or two stacked and joined. Zdog outlines **every
solid** and has no way not to — the outline here is a second body of identical geometry with
`fill: false`, because Zdog's `stroke` is a WIDTH and a shape's `color` paints its fill and its
stroke alike. So before drawing six pieces six times, the question was how much detail survives its
own outline.

Measured in `tests/outline-budget.browser.test.ts`, on one envelope sliced ever more finely so the
silhouette and the volume are held constant and only the seams multiply:

| slice | line px | filling px | painted px |
|---|---|---|---|
| 11.00 u | 348 | 352 | 867 |
| 5.50 u | 397 | 288 | 867 |
| **3.67 u** | 426 | **208** | 867 |
| 2.75 u | 490 | 208 | 867 |
| 1.38 u | 419 | 208 | 867 |
| 0.69 u | 262 | 208 | 867 |

Two readings, and the second is the one that decides the design:

- The painted silhouette is **867 pixels at every slice height**. Nothing about the shape changes;
  only how much of it is line rather than filling. That is the control.
- The filling **floors at 208 — 24% of the piece — from 3.67 units down**, and never falls again
  however fine the slicing gets. Past that point the outline has eaten everything it can eat, and
  further detail is invisible. It costs painter-sort time and draws nothing new.

The stroke is 1.5 units, so the floor sits at about **2.4 stroke widths**. Stated as a rule:

> **A feature must be roughly two and a half stroke widths across to survive its own outline** —
> 3.7 Zdog units, which is 23% of a 16-unit square. An eleven-unit-tall piece has room for about
> **three stacked features**, and no more.

### What that means for the sets that were asked for

It means **none of them can be figurative, and all of them can be distinctive.** A knight cannot be
a knight on a horse; it can be a horse's head in profile, which is what Staunton settled on in 1849
for the same reason — the shape has to survive being small. An archer on a tower cannot be an
archer; it can be a crenellated drum with a notch in it. An elephant cannot be an elephant; it can
be a domed body with the curve of a trunk.

That is not a retreat to Hartwig by another route. Hartwig's answer was to abandon representation
entirely and encode the MOVE; these sets keep representation and spend their three features on
silhouette. Both are legible at fourteen pixels, and they look nothing like each other, which is
the point of offering them.

It also means the piece count per set is bounded, and the frame budget stays intact: spike 0
measured 450 sorted shapes at 1.44 ms, and a three-feature set outlined doubles to roughly 12
shapes per piece — 384 for the pieces plus 64 squares, the same order of magnitude.

### The catalogue

**European, turned (abstract).** All three are lathe profiles, which is exactly the vocabulary
`Zdog.Cylinder` and `Zdog.Cone` provide — declared in `types/zdog.d.ts` now, and confirmed by test
to accept the same outline trick a Box does.

| Set | Period | Licence position |
|---|---|---|
| A pattern in the 1849 manner, **unnamed** | 1849 | shapes long out of copyright; the NAME is a live trademark and is not used |
| Régence | French, early 19th c. | out of copyright |
| St George | English, early 19th c. | out of copyright |

**Figurative, by silhouette.**

| Set | Basis | Licence position |
|---|---|---|
| European medieval | armoured infantry, archer on the tower, rider, mitre, crown | iconography, not an author's work |
| Maharaja / Rajasthani | the chaturanga lineage: elephant, camel, horse, chariot | traditional design; modelled here, never traced |
| Sikh Empire | 19th-century Punjab | historic patterns only — ⚠️ modern makers' sets carry their own rights |
| Lewis | 12th-century Norse, British Museum | the objects are ancient; ⚠️ the museum's photographs and 3D scans are not — model from proportions, never from a file |
| Cangaceiros | Lampião-era Northeastern Brazil | ⚠️ the cleanest of all: a cultural type, not an author's work. Drawn here, owned by the Município, and the only set with a local tie |

**⚠️ And one that was asked for and cannot be made.** A simplified Harry Potter set is not a
calendar question like Hartwig. It is Warner Bros. and J.K. Rowling property, actively enforced,
and the Wizard's Chess set of the first film is a specific protected design. For software owned by
a município and distributed in public schools that is copyright and trademark infringement at once,
and "simplified" is not a defence — a recognisable derivative is still a derivative. The nearest
thing that CAN be built is a generic medieval-romantic set, which is what the European medieval row
above is, and it was accepted in place of it.

## 6. A third view — Three.js — and the 465 KB it uncovered

The proposal is three ways of seeing the same game: 2D glyphs, Zdog's pseudo-3D, and real lit 3D
through Three.js. Three.js sounds expensive, so it was measured (`spike/three-weight/`) rather than
assumed — a WebGLRenderer, a perspective camera, 64 board meshes, the four primitive geometries the
piece specs already speak in, two lights and soft shadows, tree-shaken by the real bundler.

| Build | raw | gzip |
|---|---|---|
| 2D only — DOM glyphs, no renderer | 104.17 KB | 36.70 KB |
| **Zdog board and pieces, no compositor** | **137.07 KB** | **45.61 KB** |
| Zdog + PixiJS — what ships today | 601.90 KB | 183.55 KB |
| Three.js alone — no engine, no chess | 508.75 KB | 125.97 KB |
| Three.js + engine + chess (arithmetic) | ~613 KB | ~163 KB |

**Three.js costs about what we already ship.** 613 against 602. That was not the expected answer,
and the reason is that PixiJS *is* a full WebGL renderer: we are already paying for one.

### ⚠️ Which is the finding that matters, and it is not about Three.js

**PixiJS costs 465 KB raw and 138 KB gzipped in this game, and its whole job is to draw one canvas
into another canvas.** `render/pixi-surface.ts` uses exactly four things: an `Application`, a
`Texture.from(zdogCanvas)`, a `Sprite`, and a `Container` for a HUD that has been DOM since step 8.
The colour-vision correction everyone assumes is a Pixi filter is `region.style.filter` — a CSS
filter on the whole region, applied in `boot/main.ts`. There is not one Pixi filter in the game.

The measurement arrived at 465 KB independently of the engine's own 467 kB figure for PixiJS, from
a different direction, which is about as good as this kind of confirmation gets.

**So the Zdog view is 4.4× heavier than the picture it draws requires**, and removing the
compositor is worth more than any of the three views is worth. It is also not free: `startLoop`
takes a ticker, the engine's layer constants come from `core/layers`, and the plan's fallback —
rasterising Zdog into `PIXI.Graphics` through a Canvas2D shim — was written on the assumption that
Pixi stays. Those are real threads to pull, and they belong in their own change.

### What Three.js actually buys, and what it actually costs

**It buys the thing §5 says Zdog cannot give.** The outline budget — three stacked features, 3.7
units minimum — is a Zdog artefact, not a chess one. Zdog outlines every solid because it has no
depth buffer and no notion of a silhouette. Three.js has both: an inverted-hull pass or an edge
post-process outlines the SILHOUETTE of a piece, not each of its parts. Every figurative set in §5
becomes possible as a figure rather than as a silhouette.

**And the specs already carry over.** `PIECE_SPECS` is pure data in boxes, cylinders, cones and
spheres; Three.js has `BoxGeometry`, `CylinderGeometry`, `ConeGeometry`, `SphereGeometry`. The
abstract sets — Hartwig and the three European patterns — would render in both views from one
description, with the invariants already proved in the node project. That splits the catalogue
cleanly: **specs render everywhere; meshes render only in Three.**

**What it costs, stated:**

1. ⚠️ **"Detailed" is the models, not the library.** 509 KB is Three.js with primitive geometry.
   Authored meshes for the figurative sets are a separate weight — glTF, per set, per piece — and
   they carry their own licence questions in a way primitives never can.
2. ⚠️ **A lit scene fights high contrast.** `palette.ts` already records the arithmetic: for a
   shaded face to clear 3:1 against a light square its luminance would have to exceed 0.93, which
   is why high contrast is flat. A real-3D view must therefore be able to switch its own lighting
   off, or high contrast is a mode it cannot honour.
3. ⚠️ **Hardware.** WebGL2 with shadows on 32 pieces is not demanding, but it is a different
   reliability profile from a 2D canvas on a government Chromebook, and it needs a stated fallback.
4. It must be its own entry point, not a mode. 613 KB against the Zdog view's 137 is the same
   argument §2 already settled for 2D, four times over.

## Open decisions

1. ~~**Mode or game?**~~ **SETTLED by measurement**: one repository, two entry points. A 2D-only
   build is 104 KB against 600 KB, so a 2D board offered as a mode inside the 3D bundle would ask a
   school's connection for 496 KB it never uses. What remains is engineering, not a decision.
2. **Pecita.** Not on Google Fonts, obtained from `pecita.eu`, SIL OFL — so subsetting and shipping
   is permitted if the licence is confirmed. Until it is, it belongs in the catalogue with the
   engine's own `off:` marker, which exists for exactly this state.
3. **Which sets to build first.** Nine are catalogued in §5 and the budget in that section says
   what each of them can be in Zdog. Order is a scheduling question, not a design one.
4. **Does the compositor go?** §6 measures PixiJS at 465 KB for drawing one canvas into another,
   with no filter of its own in use. Removing it is worth more than any single view. It touches
   `startLoop`, `core/layers` and the plan's own Canvas2D-shim fallback, so it is its own change.
5. **Is the third view specs or meshes?** Three.js renders `PIECE_SPECS` for free and lifts the
   outline budget; authored meshes are what "detailed" actually means, and they are a different
   order of weight and of licensing.
