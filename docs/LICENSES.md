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

## The original project

`juliangarnier/3D-Hartwig-chess-set` (MIT) is the **inspiration and the reference for feature
parity**. No code is copied from it: that project renders with CSS 3D transforms on DOM nodes,
and this one renders with Zdog geometry rasterised through PixiJS. Credit is due and given in
the README regardless.
