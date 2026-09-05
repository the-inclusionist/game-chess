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

**3. Piece geometry had to shrink ~25 %.** The first pass overflowed the square and
neighbouring pieces on the back rank ran into each other.

⚠️ **Correction (2026-09-05).** This section originally blamed the bishop, claiming
slabs of 13 units turned 45° span 13·√2 ≈ 18.4. **The arithmetic is backwards.**
Turning a THIN slab by 45° makes it *narrower* on the axis, not wider: the extent is
`w·cos θ + d·sin θ`, which is less than `w` when `d` is small. What gains extent by
turning is a roughly CUBIC box, whose diagonal reaches `s·√2` — the king's finial.

The diagnosis was right and the explanation was wrong: every piece was simply too
big. Both directions are now pinned by tests in `tests/piece-geometry.node.test.ts`,
and `pieceFootprint` measures the rotated bounding box rather than guessing.

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
| Pawn | cube 6 | 6 |
| Rook | cube 9 | 9 |
| Knight | 4 × cube 4.6 in an L: two side by side, two stacked on the left | 13.8 |
| Bishop | 2 slabs 10×11.5×3.4, rotated `y = ±π/4` | 11.5 |
| Queen | cube 8.5 + `Zdog.Shape` dot, stroke 7.5, at `y = -11.5` | 15.25 |
| King | cube 10 + cube 7.5 rotated `y = π/4` at `y = -13.75` | 17.5 |

Final values, after the pawn/rook ratio was widened to 1.5×. The authority is
`app/js/render/pieces/geometry.ts`; this table is a summary.

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

- ~~**Pawn and rook are both plain cubes**, at 1.31×.~~ **DONE (2026-09-05):**
  widened to exactly 1.5× (6 vs 9) and asserted in the geometry tests. Faithful to
  Hartwig, who gave both pieces the cube because both move at right angles to the
  edge; the DOM mirror and screen reader carry the accessibility case regardless.
- Zdog `Illustration` must have `pixelRatio` forced to 1 and `setSize(320, 180)`
  called explicitly; the constructor's element measurement uses CSS size, which
  is the upscaled size and would produce a 4× backing store.
