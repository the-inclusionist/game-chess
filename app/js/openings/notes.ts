// SPDX-License-Identifier: AGPL-3.0-or-later
// openings/notes — WHY anyone plays the line the player has just walked into.
//
// ========================= THE HALF THE NAME DOES NOT GIVE =========================
// `openings/opening.ts` answers "where am I": the deepest named line the game began with. A
// beginner reads "Ruy Lopez" and is exactly as informed as before, because a name is a label on a
// door and not a reason to walk through it. This module answers the other half — what the line is
// FOR — in two or three sentences, for the openings a beginner actually meets.
//
// ========================= ⚠️ THE FAMILY, NOT THE VARIATION =========================
// The book has 2,833 lines in 148 families. Writing prose for 2,833 of them is not a project, it is
// a lifetime; and it would be the wrong prose anyway, because what a child needs to know about the
// Najdorf at move six is what the SICILIAN is for. So the note is keyed on the family — the part of
// the name before the first colon — and a Najdorf, a Dragon and a Scheveningen all read the same
// paragraph about why Black answers 1.e4 with 1...c5.
//
// ⚠️ AND IT IS A LONGEST-PREFIX WALK ANYWAY, not a straight `split(':')[0]`, which is the same
// shape `nameOpening` uses one module over. The reason is the day a variation earns its own
// paragraph — the King's Gambit Accepted is already a different story from the Declined, and the
// tables spell those as two families, but the next such pair may well arrive as a colon. Walking
// from the most specific name down to the family costs one loop and means that day needs a table
// row, not a redesign.
//
// ========================= ⚠️ THE PROSE IS OURS, AND THAT IS NOT AN ACCIDENT =========================
// The plan named Staunton's *Blue Book of Chess* (1874) as the source, and it stays named because
// it is where the classical repertoire a beginner meets was first written down for amateurs. But
// the sentences below the fold are written here, in all three languages, for the same three reasons
// `app/js/teach/fundamentals.ts` sets out for Capablanca:
//
//   · no chess classic exists in Brazilian Portuguese, so pt-BR and es were always new work;
//   · half of this list — the Nimzo-Indian, the King's Indian, the Grünfeld, the Benoni — postdates
//     Staunton's death by fifty years, so no 1874 book could have an opinion about them;
//   · and a sentence written for a Victorian adult is not the sentence a nine-year-old needs, when
//     every string in this repository is also read out loud.
//
// What is Staunton's, and is credited as such in `docs/LICENSES.md`, is the IDEA of the list: that
// a learner is served by a short account of a few classical openings rather than a complete one.

import type { LocaleCode } from '../i18n/types.ts';

/**
 * The families a note is written for, as the tables spell them, to the slug its key uses.
 *
 * ⚠️ THE KEY SIDE IS COPIED FROM `app/data/openings.json` AND MUST STAY SPELLED ITS WAY. The
 * tables are the Lichess ECO tables (CC0-1.0) and they are not always the spelling a chess book
 * uses: "Petrov's Defense" is the Petroff or the Russian Game elsewhere, "Queen's Pawn Game" is a
 * catch-all no book names at all, and the accents on "Réti" and "Grünfeld" are real characters in
 * the data. A row whose left side is "nearly right" matches nothing and fails SILENTLY — the note
 * simply never appears — which is why `tests/opening-notes.node.test.ts` checks every row of this
 * table against the real book rather than trusting the list.
 *
 * ⚠️ AND `as const` IS LOAD-BEARING. The slugs on the right are what `OpeningSlug` below is derived
 * from, which is what makes a missing translation a TYPE ERROR in `i18n/openings/{pt,en,es}.ts`
 * instead of a key rendered raw on screen to a child.
 */
export const OPENING_FAMILIES = {
  /* ---------------- 1.e4 e5, the open games: where almost everybody starts ---------------- */
  "King's Pawn Game": 'kingpawn',
  'Italian Game': 'italian',
  'Ruy Lopez': 'ruylopez',
  'Four Knights Game': 'fourknights',
  'Scotch Game': 'scotch',
  'Vienna Game': 'vienna',
  "Bishop's Opening": 'bishops',
  'Center Game': 'center',
  "King's Gambit Accepted": 'kgaccepted',
  "King's Gambit Declined": 'kgdeclined',
  "Petrov's Defense": 'petrov',
  'Philidor Defense': 'philidor',

  /* ---------------- 1.e4 answered otherwise: the semi-open defences ---------------- */
  'Sicilian Defense': 'sicilian',
  'French Defense': 'french',
  'Caro-Kann Defense': 'carokann',
  'Scandinavian Defense': 'scandinavian',
  'Alekhine Defense': 'alekhine',
  'Pirc Defense': 'pirc',
  'Modern Defense': 'modern',

  /* ---------------- 1.d4: the closed games and the Indian defences ---------------- */
  "Queen's Pawn Game": 'queenpawn',
  "Queen's Gambit Declined": 'qgd',
  "Queen's Gambit Accepted": 'qga',
  'Slav Defense': 'slav',
  'Semi-Slav Defense': 'semislav',
  'Nimzo-Indian Defense': 'nimzo',
  "King's Indian Defense": 'kingsindian',
  "Queen's Indian Defense": 'queensindian',
  'Grünfeld Defense': 'grunfeld',
  'Benoni Defense': 'benoni',
  'Dutch Defense': 'dutch',

  /* ---------------- neither pawn in the centre on move one ---------------- */
  'English Opening': 'english',
  'Réti Opening': 'reti',
} as const;

/** The slugs, as a union, derived from the table above rather than written twice. */
export type OpeningSlug = (typeof OPENING_FAMILIES)[keyof typeof OPENING_FAMILIES];

/** The i18n key of a note. `opening.sicilian`, and there is no other shape. */
export type OpeningNoteKey = `opening.${OpeningSlug}`;

/** Every key the three catalogues owe, so a catalogue can be typed by it. */
export const OPENING_NOTE_KEYS: readonly OpeningNoteKey[] =
  Object.values(OPENING_FAMILIES).map((slug) => `opening.${slug}` as OpeningNoteKey);

/**
 * The i18n key of the note for an opening name, or null when none is written.
 *
 * ⚠️ NULL IS THE ORDINARY ANSWER AND NOT A FAILURE. 116 of the book's 148 families have no note,
 * on purpose — the Pterodactyl Defense has 33 lines in the tables and no business being explained
 * to somebody learning what the centre is for. The panel hides itself; the NAME still shows, as it
 * always did, from `openings/opening.ts`.
 *
 * @param name A name exactly as the book returns it, e.g. `Sicilian Defense: Najdorf Variation`.
 */
export function openingNoteKey(name: string): OpeningNoteKey | null {
  const parts = name.split(':').map((part) => part.trim());
  for (let depth = parts.length; depth > 0; depth -= 1) {
    const candidate = parts.slice(0, depth).join(': ');
    const slug = (OPENING_FAMILIES as Readonly<Record<string, OpeningSlug>>)[candidate];
    if (slug) return `opening.${slug}`;
  }
  return null;
}

/**
 * Fetches the notes for one language.
 *
 * ⚠️ A DYNAMIC IMPORT, FOR THE SAME REASON THE BOOK IS ONE, and it is paid for at the same moment:
 * `game-shell` asks for the notes when it asks for `loadOpenings()`, on the first move of the first
 * game. Somebody who opens the page and leaves downloads neither.
 *
 * ⚠️ AND ONE LANGUAGE AT A TIME, which is what `i18n.extend(locale, …)` is shaped for: the strings
 * are filed under the language they are written in, so switching language mid-game falls back
 * through the ordinary chain until the new file lands instead of leaving a child reading the old one.
 */
export async function loadOpeningNotes(
  locale: LocaleCode,
): Promise<Readonly<Record<string, string>>> {
  switch (locale) {
    case 'en': return (await import('../i18n/openings/en.ts')).en;
    case 'es': return (await import('../i18n/openings/es.ts')).es;
    default: return (await import('../i18n/openings/pt.ts')).pt;
  }
}
