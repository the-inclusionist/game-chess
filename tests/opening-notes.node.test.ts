// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE FAILURE THIS FILE EXISTS FOR IS SILENT =========================
// `i18n/openings/index.ts` already carries the strongest gate in this feature, and it is the TYPE:
// `OpeningStrings` is `Record<OpeningNoteKey, string>` derived from `OPENING_FAMILIES`, so a family
// added without its Spanish is `TS2741` and names the key. Mutation-checked on 2026-10-04 by
// deleting `opening.benoni` from `es.ts`.
//
// ⚠️ THAT GATE GUARDS ONE SIDE OF THE TABLE AND THIS FILE GUARDS THE OTHER. `tsc` knows the slugs
// on the right; it has no opinion whatever about the family names on the LEFT, which are copied
// from a 2,833-line JSON file written by somebody else. A row reading `"Kings Indian Defense"`
// — no apostrophe — compiles perfectly, satisfies every type, matches NOTHING in the book, and the
// paragraph simply never appears on screen. Nobody would find that by playing, because not seeing
// an explanation looks exactly like the 116 families that correctly have none.
//
// So every key of that table is checked against the shipped book, and the lookup is checked against
// real names the book really returns.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  OPENING_FAMILIES,
  OPENING_NOTE_KEYS,
  openingNoteKey,
  loadOpeningNotes,
} from '../app/js/openings/notes.ts';
import { availableLocales, createI18n } from '../app/js/i18n/index.ts';
import type { OpeningBook } from '../app/js/openings/opening.ts';
import type { LocaleCode } from '../app/js/i18n/types.ts';

const book = JSON.parse(readFileSync('app/data/openings.json', 'utf8')) as OpeningBook;
/** Every family the book actually has: the part of a name before the first colon. */
const familiesInBook = new Set(
  Object.values(book.book).map(([, name]) => name.split(':')[0].trim()),
);
const families = Object.keys(OPENING_FAMILIES);

describe('[Notes] the families a note is written for are families the book has', () => {
  it('writes notes for a useful number of them, so the checks below cannot be empty', () => {
    // The guard on the guards. An empty table would make every assertion in this file pass.
    expect(families.length).toBeGreaterThanOrEqual(25);
    // And a guard the other way: if this ever approaches 148, the family-level decision in
    // `openings/notes.ts` has quietly been abandoned and the comment there is a lie.
    expect(families.length).toBeLessThanOrEqual(60);
  });

  it('🔴 names every family EXACTLY as the shipped book spells it', () => {
    for (const family of families) {
      // The name is in the message so a failure says WHICH row is wrong, not just that one is.
      expect(`${family}: ${familiesInBook.has(family)}`).toBe(`${family}: true`);
    }
  });

  it('gives each family a distinct slug', () => {
    const slugs = Object.values(OPENING_FAMILIES);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('uses slugs that are one lowercase token, like the lesson ids', () => {
    // Same convention as `teach/lessons.ts`, and for the same reason: the key is `opening.<slug>`
    // and a slug with a dot in it would read as a second level of namespace that nothing handles.
    for (const slug of Object.values(OPENING_FAMILIES)) {
      expect(`${slug}: ${/^[a-z]+$/.test(slug)}`).toBe(`${slug}: true`);
    }
  });

  it('declares one key per family', () => {
    expect(OPENING_NOTE_KEYS.length).toBe(families.length);
  });
});

describe('[Notes] the lookup answers for the names the game will really pass it', () => {
  it('finds the family of a deep variation, which is how it is used', () => {
    expect(openingNoteKey('Sicilian Defense: Najdorf Variation')).toBe('opening.sicilian');
    expect(openingNoteKey('Ruy Lopez: Berlin Defense, Rio Gambit Accepted'))
      .toBe('opening.ruylopez');
    expect(openingNoteKey("King's Indian Defense: Fianchetto Variation"))
      .toBe('opening.kingsindian');
  });

  it('finds a bare family name too', () => {
    expect(openingNoteKey('French Defense')).toBe('opening.french');
    expect(openingNoteKey('Réti Opening')).toBe('opening.reti');
  });

  it('⚠️ answers null for a family with no note, which is the ordinary case', () => {
    // 116 of 148. The Pterodactyl has 33 lines in the tables and no business being explained to
    // somebody learning what the centre is for.
    expect(openingNoteKey('Pterodactyl Defense: Western, Rhamphorhynchus')).toBeNull();
    expect(openingNoteKey('Grob Opening')).toBeNull();
  });

  it('🔴 resolves a real name from every covered family, walked from the book itself', () => {
    /*
     * ⚠️ THE NAMES COME FROM THE BOOK AND NOT FROM A LIST WRITTEN HERE, which is the difference
     * between testing the lookup and testing my own typing twice. If a row of `OPENING_FAMILIES`
     * is spelled wrongly, the test above fails; if the LOOKUP breaks — a changed separator, a
     * trim removed — this one does, on every real name at once.
     */
    const covered = new Set(families);
    const seen = new Set<string>();
    for (const [, name] of Object.values(book.book)) {
      const family = name.split(':')[0].trim();
      if (!covered.has(family)) continue;
      seen.add(family);
      expect(`${name}: ${openingNoteKey(name) !== null}`).toBe(`${name}: true`);
    }
    // And every covered family was actually exercised, or the loop above proved nothing about it.
    expect([...covered].filter((f) => !seen.has(f))).toEqual([]);
  });
});

/* ========================= THE PROSE ========================= */

const CATALOGUES = new Map<LocaleCode, Readonly<Record<string, string>>>();
for (const locale of availableLocales()) CATALOGUES.set(locale, await loadOpeningNotes(locale));

describe('[Notes] every paragraph exists, in all three languages', () => {
  it('loads a catalogue for each of the three', () => {
    expect([...CATALOGUES.keys()].sort()).toEqual(['en', 'es', 'pt']);
  });

  it('⚠️ resolves every key, in every locale, to something other than the key', () => {
    /*
     * ⚠️ THROUGH `t()` AND NOT BY READING THE OBJECT, because `t()` is what the panel calls and
     * `t()` has a four-link fallback chain. Reading the object would pass while a Spanish reader
     * silently got Portuguese — and `ui/opening-note.ts` decides whether to show the panel at all
     * by comparing `t(key)` against `key`, so this assertion is literally the panel's own test.
     */
    for (const locale of availableLocales()) {
      const i18n = createI18n(locale);
      i18n.extend(locale, CATALOGUES.get(locale)!);
      for (const key of OPENING_NOTE_KEYS) {
        expect(`${locale} ${key}: ${i18n.t(key) !== key}`).toBe(`${locale} ${key}: true`);
      }
    }
  });

  it('writes real sentences rather than placeholders', () => {
    for (const [locale, strings] of CATALOGUES) {
      for (const key of OPENING_NOTE_KEYS) {
        const text = strings[key] ?? '';
        /*
         * A floor and a ceiling, both measured rather than guessed. Under 80 characters is not an
         * explanation; over 400 is six lines at the 640 px minimum stage width, which is where `.opening-note`
         * in `board.css` stops being a strip and starts being a page.
         */
        expect(`${locale} ${key} length ${text.length}`)
          .toBe(`${locale} ${key} length ${Math.min(Math.max(text.length, 80), 400)}`);
        expect(`${locale} ${key} ends: ${/[.!?]$/.test(text.trim())}`)
          .toBe(`${locale} ${key} ends: true`);
        /*
         * No key left in the prose by a copy-paste, and no unfilled placeholder.
         *
         * ⚠️ AGAINST THE REAL KEYS AND NOT AGAINST THE SUBSTRING `'opening.'`, which is what this
         * assertion said first and which failed on the English Four Knights note: "decided later,
         * in the middlegame, not in the opening." is a sentence, and a check that cannot tell it
         * from a leaked key is a check that would have had the prose rewritten to suit it.
         */
        const leaked = OPENING_NOTE_KEYS.filter((k) => text.includes(k));
        expect(`${locale} ${key} leaked: ${leaked.join(',')}`).toBe(`${locale} ${key} leaked: `);
        expect(`${locale} ${key} braces: ${text.includes('{')}`)
          .toBe(`${locale} ${key} braces: false`);
      }
    }
  });

  it('⚠️ does not collide with the labels every page loads at boot', () => {
    /*
     * `i18n/index.ts` states the rule: built-in beats added WITHIN a locale, so a collision here
     * would not break the game — it would silently drop the paragraph and keep the label. That is
     * precisely the kind of pass that teaches nothing, so it is checked instead of relied on.
     */
    const i18n = createI18n('pt');
    for (const key of OPENING_NOTE_KEYS) {
      expect(`${key} free: ${i18n.t(key) === key}`).toBe(`${key} free: true`);
    }
  });
});
