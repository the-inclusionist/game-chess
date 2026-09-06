// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n — this game's own dictionary, as a FACTORY.
//
// ========================= WHY A FACTORY AND NOT A SINGLETON =========================
// No module-level mutable state anywhere in this repo: `createI18n()` returns an instance and the
// composition root owns it. The cost is one parameter threaded through; the payoff is that a test
// can hold three locales at once without them fighting over a global, which is exactly what the
// catalogue-completeness test does.
//
// ========================= WHY ALL THREE ARE IMPORTED STATICALLY =========================
// The engine lazy-loads `en` and `es` as separate chunks, and it is right to: its catalogues carry
// 253 keys for a fourteen-year-old platformer. Ours carry 25. Three objects of a couple of
// kilobytes do not earn a code-split and the loading state that comes with it. Revisit if this
// dictionary ever grows an order of magnitude.
//
// ⚠️ AND IT DID — SO THE REVISIT HAPPENED, AND IT LANDED NEXT DOOR RATHER THAN HERE. The lessons
// are seventy-three keys of prose per language against these twenty-five of labels, so they live
// in `i18n/teach/`, are fetched on demand, and arrive through `extend()`. This file stayed as it
// is because the condition was about SIZE, and the twenty-five keys every page needs at boot are
// still twenty-five. Splitting what everybody needs would have bought a loading state and nothing.
//
// The fallback chain is locale built-in → locale added → pt built-in → pt added → the key itself.
// A missing key surfaces as the key, which is ugly on screen and therefore gets fixed — silence
// would not. `teach/lessons.ts` then leans on that last link deliberately: see `t()`.

import type { Piece } from '../chess/types.ts';
import type { Catalog, Gender, LocaleCode } from './types.ts';
import { en } from './en.ts';
import { es } from './es.ts';
import { pt } from './pt.ts';

const CATALOGS: Readonly<Record<LocaleCode, Catalog>> = { pt, en, es };
const FALLBACK: LocaleCode = 'pt';
const LOCALES: readonly LocaleCode[] = ['pt', 'en', 'es'];

/** Structurally identical to the engine contract's `Speakable`, so it plugs straight into `nameAt`. */
export interface Speakable {
  readonly text: string;
  readonly gender: Gender;
  readonly plural: boolean;
}

export interface I18n {
  t(key: string, params?: Readonly<Record<string, string | number>>): string;
  /** A piece's spoken name, with the colour adjective agreeing with the noun's gender. */
  describePiece(piece: Piece): Speakable;
  setLocale(code: LocaleCode): void;
  getLocale(): LocaleCode;
  /** BCP 47 tag for `lang=` and for speech synthesis. */
  bcp47(): string;
  /**
   * Adds strings for one locale, on this instance.
   *
   * ⚠️ THE LOCALE IS A PARAMETER RATHER THAN "THE CURRENT ONE", and that is the whole design.
   * Extras are filed under the language they are written in, so `setLocale()` keeps working with
   * nothing to remember: a lesson loaded in Portuguese and then switched to Spanish falls back
   * through the ordinary chain until the Spanish file arrives. Had `extend` written into a single
   * current-language slot, changing language mid-lesson would have left a child reading the old
   * one — and nothing would have failed.
   *
   * Used by `i18n/teach`, which is loaded on demand precisely so that a player who never opens a
   * lesson never downloads one. Calling it twice for the same locale merges; a later call wins.
   */
  extend(locale: LocaleCode, strings: Readonly<Record<string, string>>): void;
}

export function isLocale(code: string): code is LocaleCode {
  return (LOCALES as readonly string[]).includes(code);
}

export function availableLocales(): readonly LocaleCode[] {
  return LOCALES;
}

/** Picks the best supported locale for a browser language tag. `pt-BR` → `pt`, `de` → `pt`. */
export function preferredLocale(navigatorLanguage: string | undefined): LocaleCode {
  const base = (navigatorLanguage ?? '').toLowerCase().split('-')[0];
  return isLocale(base) ? base : FALLBACK;
}

function interpolate(template: string, params?: Readonly<Record<string, string | number>>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole);
}

export function createI18n(initial: LocaleCode = FALLBACK): I18n {
  let locale: LocaleCode = initial;
  /** Per-locale strings added by `extend`. Empty until somebody opens a lesson. */
  const extra: Record<LocaleCode, Record<string, string>> = { pt: {}, en: {}, es: {} };

  return {
    t(key, params) {
      /*
       * FOUR LINKS, AND THE ORDER IS DELIBERATE:
       *
       *   1. this locale's built-in catalogue    3. the fallback's built-in catalogue
       *   2. this locale's added strings         4. the fallback's added strings
       *
       * ⚠️ BUILT-IN BEATS ADDED WITHIN A LOCALE, so no loaded catalogue can shadow a string the
       * game itself depends on. The lesson keys are namespaced under `teach.` and collide with
       * nothing today, but "nothing collides today" is not a rule — this is.
       *
       * ⚠️ AND THE CURRENT LOCALE IS EXHAUSTED BEFORE THE FALLBACK IS TRIED, so a Spanish reader
       * whose lesson file has not arrived yet reads Portuguese for a moment, not a mixture.
       *
       * The last link is the key itself, and it is a documented contract rather than a
       * consolation: `teach/lessons.ts` relies on it, letting a `pick` option be the literal
       * `'d4'` and another be `'teach.values.one'` under one rule and no union type.
       */
      const s = CATALOGS[locale].strings[key]
        ?? extra[locale][key]
        ?? CATALOGS[FALLBACK].strings[key]
        ?? extra[FALLBACK][key]
        ?? key;
      return interpolate(s, params);
    },

    extend(code, strings) {
      if (isLocale(code)) Object.assign(extra[code], strings);
    },

    describePiece(piece) {
      const cat = CATALOGS[locale];
      const noun = cat.pieces[piece.type];
      const adjective = cat.sides[piece.side][noun.gender];
      const text = cat.pieceNamePattern
        .replace('{piece}', noun.text)
        .replace('{side}', adjective);
      return { text, gender: noun.gender, plural: false };
    },

    setLocale(code) {
      if (isLocale(code)) locale = code;
    },

    getLocale() { return locale; },
    bcp47() { return CATALOGS[locale].bcp47; },
  };
}
