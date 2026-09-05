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
// The fallback chain is locale → pt → the key itself. A missing key surfaces as the key, which is
// ugly on screen and therefore gets fixed — silence would not.

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

  return {
    t(key, params) {
      const s = CATALOGS[locale].strings[key] ?? CATALOGS[FALLBACK].strings[key] ?? key;
      return interpolate(s, params);
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
