// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE ASSERTION `i18n.node.test.ts` CANNOT MAKE =========================
// The existing catalogue test compares the three languages against each other: same keys, no
// blanks, no leftovers. That is a real check and it has a real blind spot — it does not know what
// the game ASKS FOR. Three catalogues can agree perfectly on a key nothing uses, and disagree with
// the code by lacking one everything uses, and it would pass both times.
//
// The lessons close that hole because they are data. `teach/lessons.ts` names every string it will
// ever need — `title`, `say`, `nudge`, and the `pick` options that are keys — so the demand side
// can be READ rather than remembered, and this file asks the supply side to meet it exactly.
//
// ⚠️ THIS IS WHERE A TYPO STOPS BEING SILENT. `teach-table.node.test.ts` checks only the SHAPE of a
// key: that `teach.rook.reach` names its own lesson. It has no idea whether anyone wrote it.
// Without the file you are reading, a mistyped key renders on screen as `teach.rook.raech` — the
// documented behaviour of `t()`, correct in every other respect, and useless to a child.
import { describe, expect, it } from 'vitest';
import { LESSONS } from '../app/js/teach/lessons.ts';
import { availableLocales, createI18n } from '../app/js/i18n/index.ts';
import { loadTeach } from '../app/js/i18n/teach/index.ts';
import type { LocaleCode } from '../app/js/i18n/types.ts';

/**
 * Every string the syllabus will ask `t()` for.
 *
 * ⚠️ `pick` OPTIONS ARE FILTERED BY THE DOT, and that is not a heuristic dressed up as a rule — it
 * is the rule `teach/lesson.ts` documents. An option is either an i18n key or a literal that
 * passes through untranslated, and the notation lesson depends on the second: its options are the
 * square names `'f3'`, `'c3'`, `'f6'`, `'h3'`, which must NOT be demanded of the catalogues.
 */
function keysAsked(): readonly string[] {
  const keys: string[] = [];
  for (const lesson of LESSONS) {
    keys.push(lesson.title);
    for (const step of lesson.steps) {
      keys.push(step.say);
      if (step.nudge) keys.push(step.nudge);
      if (step.task.kind === 'pick') {
        for (const option of step.task.options) if (option.includes('.')) keys.push(option);
      }
    }
  }
  return [...new Set(keys)];
}

const CATALOGUES = new Map<LocaleCode, Readonly<Record<string, string>>>();
for (const locale of availableLocales()) CATALOGUES.set(locale, await loadTeach(locale));

describe('[Reach] every sentence a lesson asks for exists in all three languages', () => {
  it('asks for a non-trivial number of them, so the checks below cannot be empty', () => {
    // The guard on the guards. A `keysAsked` that returned nothing would make every assertion in
    // this file pass while proving nothing at all.
    expect(keysAsked().length).toBeGreaterThanOrEqual(60);
  });

  it('⚠️ resolves every key, in every locale, to something other than itself', () => {
    /*
     * THE ASSERTION THIS FILE EXISTS FOR. `t()` returns the key when nobody has it — deliberately,
     * so a gap is visible rather than silent — which means "the key came back" is exactly the
     * failure this catches, and it is indistinguishable from success unless somebody looks.
     */
    for (const locale of availableLocales()) {
      const i18n = createI18n(locale);
      i18n.extend(locale, CATALOGUES.get(locale)!);
      for (const key of keysAsked()) {
        const said = i18n.t(key);
        expect(`${locale} ${key}: ${said === key ? 'MISSING' : 'present'}`)
          .toBe(`${locale} ${key}: present`);
      }
    }
  });

  it('says something in each, rather than an empty string that would announce silence', () => {
    // `srSay('')` is not an announcement, it is a pause. A blank value passes a key-presence check
    // and fails the child.
    for (const locale of availableLocales()) {
      const strings = CATALOGUES.get(locale)!;
      for (const key of keysAsked()) {
        expect(`${locale} ${key} blank: ${strings[key]!.trim().length === 0}`)
          .toBe(`${locale} ${key} blank: false`);
      }
    }
  });

  it('carries the same keys in all three, with nothing spare', () => {
    /*
     * The mirror of the check above, and it catches the opposite mistake: prose written for a
     * lesson that was renamed or dropped. Dead strings are not harmless — they are the reason a
     * translator's next pass is longer than it needs to be, and they read as requirements.
     */
    const asked = new Set(keysAsked());
    for (const locale of availableLocales()) {
      const spare = Object.keys(CATALOGUES.get(locale)!).filter((k) => !asked.has(k)).sort();
      expect(`${locale} spare: ${spare.join(' ')}`).toBe(`${locale} spare: `);
    }
  });
});

describe('[Extend] added strings do not disturb the catalogue that was already there', () => {
  it('files them under the language they are written in, so changing locale changes the lesson', () => {
    /*
     * ⚠️ THE CASE THAT JUSTIFIES `extend` TAKING A LOCALE. An earlier sketch resolved the fallback
     * at load time and stored one merged object; under that shape, switching language mid-lesson
     * would have kept reading the old one with nothing failing anywhere.
     */
    const i18n = createI18n('pt');
    for (const [locale, strings] of CATALOGUES) i18n.extend(locale, strings);

    const inPortuguese = i18n.t('teach.rook.title');
    i18n.setLocale('en');
    const inEnglish = i18n.t('teach.rook.title');
    i18n.setLocale('es');
    const inSpanish = i18n.t('teach.rook.title');

    expect(inPortuguese).toBe('A torre');
    expect(inEnglish).toBe('The rook');
    expect(inSpanish).toBe('La torre');
  });

  it('falls back to Portuguese for a locale whose lessons have not been fetched yet', () => {
    // The loader is asynchronous, so there is a moment after a language change when the new file
    // has not landed. The reader gets the base language for that moment — not the key, and not the
    // language they just left.
    const i18n = createI18n('en');
    i18n.extend('pt', CATALOGUES.get('pt')!);
    expect(i18n.t('teach.rook.title')).toBe('A torre');
  });

  it('never lets an added string shadow one the game itself depends on', () => {
    /*
     * The precedence rule, asserted rather than described. `teach.` collides with nothing today;
     * this is what makes that a property of the code instead of a property of today.
     *
     * ⚠️ THE KEY HAS TO BE ONE THE CATALOGUE REALLY HAS, and the first draft of this test proved
     * why by failing: it named `status.turn`, which nobody has. `t()` returned the key — correctly
     * — and `extend` then filled what was genuinely a gap, which reads exactly like a hijack. A
     * fixture that names a missing key cannot tell shadowing from filling.
     */
    const i18n = createI18n('pt');
    const before = i18n.t('hud.turn');
    expect(before).toBe('Vez');
    i18n.extend('pt', { 'hud.turn': 'HIJACKED' });
    expect(i18n.t('hud.turn')).toBe(before);
  });

  it('still returns the key for something nobody has, in any locale', () => {
    // The contract `teach/lessons.ts` leans on for literal `pick` options such as `'f3'`.
    const i18n = createI18n('pt');
    i18n.extend('pt', CATALOGUES.get('pt')!);
    expect(i18n.t('f3')).toBe('f3');
    expect(i18n.t('teach.nobody.wrote.this')).toBe('teach.nobody.wrote.this');
  });
});

describe('[Loading] the prose is fetched, not bundled', () => {
  it('hands back a different object for each language', async () => {
    const [pt, en, es] = await Promise.all([loadTeach('pt'), loadTeach('en'), loadTeach('es')]);
    expect(pt['teach.king.title']).toBe('O rei');
    expect(en['teach.king.title']).toBe('The king');
    expect(es['teach.king.title']).toBe('El rey');
  });

  it('⚠️ does not resolve the fallback for the caller', () => {
    /*
     * Stated as a test because it is the thing a future reader will assume is broken. `loadTeach`
     * returns one language and only that language; the fallback lives in `t()`, where the game's
     * own fallback already lives. Two fallback chains would be two places for a reader to end up
     * in the wrong one.
     */
    const en = CATALOGUES.get('en')!;
    expect(Object.keys(en).every((k) => k.startsWith('teach.'))).toBe(true);
    expect(en['status.turn']).toBeUndefined();
  });
});
