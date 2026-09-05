// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createI18n, availableLocales, preferredLocale, isLocale } from '../app/js/i18n/index.ts';
import { en } from '../app/js/i18n/en.ts';
import { es } from '../app/js/i18n/es.ts';
import { pt } from '../app/js/i18n/pt.ts';
import type { Catalog } from '../app/js/i18n/types.ts';
import type { PieceType } from '../app/js/chess/types.ts';

const CATALOGS: [string, Catalog][] = [['pt', pt], ['en', en], ['es', es]];
const PIECE_TYPES: PieceType[] = ['p', 'r', 'n', 'b', 'q', 'k'];

describe('[Completeness] the three catalogues stay in step', () => {
  // The drift this catches is silent: a key added to pt and forgotten in es shows up as
  // Portuguese text inside a Spanish sentence, which reads as a typo rather than a bug.
  it('every catalogue carries exactly the same string keys', () => {
    const reference = Object.keys(pt.strings).sort();
    for (const [name, cat] of CATALOGS) {
      expect(Object.keys(cat.strings).sort(), `${name} differs from pt`).toEqual(reference);
    }
  });

  it('every catalogue names all six pieces', () => {
    for (const [name, cat] of CATALOGS) {
      for (const t of PIECE_TYPES) {
        expect(cat.pieces[t]?.text.trim(), `${name}.pieces.${t}`).toBeTruthy();
      }
    }
  });

  it('no string is left empty — an empty string is silence in a live region', () => {
    for (const [name, cat] of CATALOGS) {
      for (const [key, value] of Object.entries(cat.strings)) {
        expect(value.trim(), `${name}.${key}`).toBeTruthy();
      }
    }
  });

  it('every side adjective is filled in all three genders', () => {
    for (const [name, cat] of CATALOGS) {
      for (const side of ['w', 'b'] as const) {
        for (const g of ['m', 'f', 'n'] as const) {
          expect(cat.sides[side][g].trim(), `${name}.sides.${side}.${g}`).toBeTruthy();
        }
      }
    }
  });

  it('the name pattern uses both slots, so neither language loses a word', () => {
    for (const [name, cat] of CATALOGS) {
      expect(cat.pieceNamePattern, name).toContain('{piece}');
      expect(cat.pieceNamePattern, name).toContain('{side}');
    }
  });
});

describe('[Gender] the adjective agrees with the noun', () => {
  it('pt inflects: a torre branca, o cavalo preto', () => {
    const i18n = createI18n('pt');
    expect(i18n.describePiece({ type: 'r', side: 'w' })).toEqual(
      { text: 'torre branca', gender: 'f', plural: false });
    expect(i18n.describePiece({ type: 'n', side: 'b' })).toEqual(
      { text: 'cavalo preto', gender: 'm', plural: false });
    expect(i18n.describePiece({ type: 'q', side: 'b' }).text).toBe('dama preta');
  });

  it('es inflects on its own genders, not on Portuguese ones', () => {
    const i18n = createI18n('es');
    expect(i18n.describePiece({ type: 'r', side: 'w' }).text).toBe('torre blanca');
    expect(i18n.describePiece({ type: 'b', side: 'b' }).text).toBe('alfil negro');
  });

  it('en puts the adjective first and stays neutral', () => {
    const i18n = createI18n('en');
    expect(i18n.describePiece({ type: 'r', side: 'w' })).toEqual(
      { text: 'white rook', gender: 'n', plural: false });
  });
});

describe('[Lookup] interpolation and fallback', () => {
  it('fills named slots', () => {
    const i18n = createI18n('pt');
    expect(i18n.t('move.plain', { piece: 'peão branco', from: 'e2', to: 'e4' }))
      .toBe('peão branco de e2 para e4');
  });

  it('leaves a slot alone when no value is given, rather than printing undefined', () => {
    const i18n = createI18n('en');
    expect(i18n.t('move.plain', { from: 'e2' })).toBe('{piece} e2 to {to}');
  });

  it('returns the key itself when nothing has it — visible, not silent', () => {
    expect(createI18n('pt').t('nope.not.here')).toBe('nope.not.here');
  });

  it('switches locale, and ignores an unsupported one', () => {
    const i18n = createI18n('pt');
    i18n.setLocale('es');
    expect(i18n.getLocale()).toBe('es');
    expect(i18n.bcp47()).toBe('es');
    i18n.setLocale('de' as never);
    expect(i18n.getLocale()).toBe('es');
  });

  it('pt-BR is the tag handed to speech synthesis, bare codes for the others', () => {
    expect(createI18n('pt').bcp47()).toBe('pt-BR');
    expect(createI18n('en').bcp47()).toBe('en');
  });
});

describe('[Negotiation] browser language to catalogue', () => {
  it('maps a regional tag to its base language', () => {
    expect(preferredLocale('pt-BR')).toBe('pt');
    expect(preferredLocale('en-GB')).toBe('en');
    expect(preferredLocale('es-419')).toBe('es');
  });

  it('falls back to pt for anything unsupported or absent', () => {
    expect(preferredLocale('de-DE')).toBe('pt');
    expect(preferredLocale(undefined)).toBe('pt');
    expect(preferredLocale('')).toBe('pt');
  });

  it('reports the three-language floor', () => {
    expect([...availableLocales()].sort()).toEqual(['en', 'es', 'pt']);
    expect(isLocale('pt')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });
});
