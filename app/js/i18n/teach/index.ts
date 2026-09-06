// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/teach — the lesson prose, loaded only by someone taking a lesson.
//
// ========================= WHY THIS IS A SEPARATE CATALOGUE, AND WHY IT IS LAZY =========================
// `i18n/index.ts` argues its own three catalogues into the main bundle and gives the condition for
// revisiting it: "Revisit if this dictionary ever grows an order of magnitude." Eleven lessons is
// that order of magnitude — the core catalogue carries a couple of dozen strings and this one
// carries seventy-three, in prose rather than in labels.
//
// And the repository has already measured the principle it is applying. `vite.config.ts:21-25`
// splits the three pages so that nobody downloads a renderer they will not draw with. By the same
// argument, somebody who only wants to play a game should not download the lessons.
//
// ⚠️ SO THE IMPORTS BELOW ARE DYNAMIC ON PURPOSE, AND THEY ARE WRITTEN AS LITERALS ON PURPOSE.
// A computed specifier — `import(`./${locale}.ts`)` — would make the bundler ship all three to
// every page, or fail to find them at all. Three literal arrow functions in a record is what makes
// three chunks. It looks like it wants to be a loop; it must not become one.
//
// ========================= WHAT THIS DELIBERATELY IS NOT =========================
// Not a `Catalog`. `i18n/types.ts` earns its shape from grammatical gender and adjective order,
// which exist because the game composes a piece's name at runtime out of parts it is handed. A
// lesson composes nothing: it knows which piece it teaches, so it writes the whole sentence, and a
// flat string map is the honest shape for that.

import type { LocaleCode } from '../types.ts';

/** A flat map of namespaced keys to sentences. Every key here starts with `teach.`. */
export type TeachStrings = Readonly<Record<string, string>>;

/**
 * ⚠️ LITERAL SPECIFIERS, ONE PER LOCALE. See the note above: this is the code-splitting boundary,
 * and it stops being one the moment the path is built from a variable.
 */
const LOADERS: Readonly<Record<LocaleCode, () => Promise<TeachStrings>>> = {
  pt: () => import('./pt.ts').then((m) => m.pt),
  en: () => import('./en.ts').then((m) => m.en),
  es: () => import('./es.ts').then((m) => m.es),
};

/**
 * Fetches one language's lessons.
 *
 * ⚠️ THERE IS NO FALLBACK HERE, AND THAT IS THE POINT. An earlier sketch had this resolve the
 * fallback at load time and hand back a single merged object — which would have meant a locale
 * change had to remember to reload, and a forgotten reload leaves a child reading the wrong
 * language with nothing failing. Instead each locale is stored under its own name by
 * `I18n.extend()`, and the fallback happens in `t()` where it already happens for everything else.
 * One fallback chain in the codebase, not two.
 */
export async function loadTeach(locale: LocaleCode): Promise<TeachStrings> {
  return LOADERS[locale]();
}
