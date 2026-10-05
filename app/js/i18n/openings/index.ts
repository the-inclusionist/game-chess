// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/openings — the opening notes, in three languages, fetched on demand.
//
// ========================= WHY A FOLDER OF ITS OWN, BESIDE `teach/` =========================
// `i18n/index.ts` states the rule it was written under: the twenty-five labels every page needs at
// boot stay static, and anything that grew an order of magnitude moves next door and arrives
// through `extend()`. The lessons did that first, with seventy-three keys of prose per language.
// These are thirty-two paragraphs per language — the same shape, the same reason, and a SECOND
// folder rather than more of `teach/` because the two are fetched at completely different moments:
// `teach/` lands when somebody opens APRENDER, these when somebody makes a first move. Putting
// them in one file would mean every player who never opens a lesson downloads all of them.
//
// ========================= ⚠️ THE TYPE IS THE GATE =========================
// `OpeningStrings` is derived from `OPENING_FAMILIES` in `openings/notes.ts`, so adding a family to
// that table and forgetting its Spanish is a TYPECHECK FAILURE, not a key rendered raw on screen.
// This is the one gate `t()`'s fallback chain cannot give us: a missing key falls back to
// Portuguese and then to the key itself, both of which are "working" as far as any test of
// behaviour can tell.
//
// ⚠️ AND THE MOVES ARE WRITTEN IN THE NOTATION THE SCREEN PRINTS, which is English SAN — `Nf3`,
// `Bb5` — in all three languages. Brazilian books write `Cf3` for the knight and Spanish ones
// `Cf3` too, and both are correct; but the move list in the panel renders `history[ply].san`
// straight from `chess.js`, so a note that said `Cf3` would be pointing at a move a child cannot
// find three centimetres away. Same decision as the opening NAMES, and for the same reason:
// `openings/opening.ts` sets it out.

import type { OpeningNoteKey } from '../../openings/notes.ts';

/** Every note, in one language. Typed by the key union, so none can be left out. */
export type OpeningStrings = Readonly<Record<OpeningNoteKey, string>>;
