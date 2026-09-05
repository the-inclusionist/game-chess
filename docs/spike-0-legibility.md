# Spike 0 — Hartwig silhouettes at 320×180

**Verdict: GO.** Run 2026-09-04. Throwaway page kept at `spike/legibility.html`.

The question this spike had to answer: at the engine's fixed 320×180 logical
viewport, a chess square projects to roughly 16 px and a piece stands roughly
14 px tall. Does the Hartwig set stay readable at that size, and is there room
left for a HUD?

## What was measured

| | |
|---|---|
| Backing store | 320×180, `pixelRatio` forced to 1 — Zdog's default `devicePixelRatio` must be overridden |
| Flat shapes sorted per frame | **450** (64 squares + 32 pieces) |
| Full frame: `updateGraph` + painter sort + Canvas2D raster | **1.44 ms** (mean of 60) |
| Headroom against a 16.7 ms budget | **8.6 % used** |

## Findings

**1. The silhouettes hold.** All six pieces read as distinct shapes at final
scale: small cube (pawn), larger cube (rook), four-cube hook (knight), crossed
slabs (bishop), circle on cube (queen), 45°-turned cube on cube (king). Hartwig's
premise — distinguish by *shape of movement*, not by figure — is exactly the
property that survives low resolution. A figurative set would not have.

**2. Performance is a non-issue, so the plan's "render on demand" should be
dropped.** The design proposed re-rendering only when the scene is dirty, to
hedge against per-frame cost. At 1.44 ms per frame that hedge buys nothing and
costs a dirty-tracking mechanism across camera, animation and selection. Render
every frame. *(This retires risk #1 of the plan and simplifies §Arquitetura.)*

**3. Piece geometry had to shrink ~25 %.** The first pass overflowed the square:
bishop slabs of 13 units turned 45° span 13·√2 ≈ 18.4 in a 16-unit square. The
locked sizes below keep every piece inside its square — the widest footprint is
the bishop at 10·√2 ≈ 14.1.

**4. The HUD budget closes.** With the board pushed left (`x = -42`) at
`zoom 1.15` and `rotate.x = -1.0 rad`, the board occupies the left ~232 px and
leaves an **88×180 right column** — verified by drawing it: turn indicator,
two rows of captured pieces, and 11 move-list rows all fit.

## Locked values

Square `S = 16` (== engine `TILE`). Zdog's Y axis points **down**; "up" is
negative Y. Every piece is built from `Zdog.Box` composed under an `Anchor`,
except the queen's finial.

| Piece | Geometry | Height |
|---|---|---|
| Pawn | cube 6.5 | 6.5 |
| Rook | cube 8.5 | 8.5 |
| Knight | 4 × cube 4.4 in an L: two side by side, two stacked on the left | 13.2 |
| Bishop | 2 slabs 10×11×3.4, rotated `y = ±TAU/8` | 11 |
| Queen | cube 8 + `Zdog.Shape` dot, stroke 7, at `y = -10.5` | 14 |
| King | cube 8.5 + cube 6.5 rotated `y = TAU/8` at `y = -11.75` | 15 |

Camera defaults: `rotate.x = -1.0`, `zoom = 1.15`, board offset `x = -42`.
Stroke 0.9 — thick enough to read as Zdog, thin enough not to swallow a 4 px face.

The queen's finial uses the canonical Zdog idiom for a ball: a `Shape` with a
single point and a large `stroke`, which renders as a filled disc that always
faces the camera. One draw call, and faithful to Hartwig's own wording — "a
circle on the queen's top".

## Palette

Light `#FFD97D` / `#E8A72E` / `#F7C55A`, stroke `#3B2A12`.
Dark `#9179DA` / `#4E3499` / `#6F52C4`, stroke `#241640`.
Squares `#DCD6C8` and `#8D8677`.

Yellow against purple was chosen for the **luminance** gap, not the hue gap.
Hue-based pairs fail under one or another colour-vision deficiency; a large
luminance separation survives all of them, and it also survives the engine's
CVD simulation filters.

## Carried forward

- **Pawn and rook are both plain cubes**, differing only in size — at 6.5 vs 8.5
  the ratio is 1.31×, which is ~4 px vs ~6 px on screen. This is faithful to
  Hartwig, who gave both pieces the cube because both move at right angles to
  the edge. Widen to 1.5× (6.0 vs 9.0) during piece implementation and re-check.
  The DOM mirror and screen reader carry the accessibility case regardless.
- Zdog `Illustration` must have `pixelRatio` forced to 1 and `setSize(320, 180)`
  called explicitly; the constructor's element measurement uses CSS size, which
  is the upscaled size and would produce a 4× backing store.
