// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/types — the shape of one language.
//
// ========================= WHY THIS IS NOT A FLAT STRING MAP =========================
// A flat `Record<string, string>` cannot say "a torre branca". Two things break it:
//
//  · GRAMMATICAL GENDER. In Portuguese and Spanish the colour adjective AGREES with the piece
//    noun. "Torre" is feminine, "cavalo" is masculine, and the same engine sentence has to come
//    out as "a torre branca" and "o cavalo branco". The engine's own `Speakable` carries a
//    `gender` field for exactly this reason — the catalogue is where that gender is known.
//
//  · WORD ORDER. English puts the adjective first ("white rook"); Portuguese and Spanish put it
//    after ("torre branca"). Hardcoding either order into the composer would make one language
//    the default and the others a workaround, which is the failure mode i18n exists to prevent.
//    `pieceNamePattern` makes the order data.
//
// The engine's own catalogues are a single flat namespace, and its second consumer measured the
// cost: "a second game inherits 253 keys of which it uses a handful" (achado 2). Demos D10 fixes
// that by giving each game its own dictionary in its own chunk. This is that dictionary.

import type { PieceType } from '../chess/types.ts';

/** Matches the engine contract's `Gender`. `n` = neutral, which is what English uses throughout. */
export type Gender = 'm' | 'f' | 'n';

export interface Noun {
  readonly text: string;
  readonly gender: Gender;
}

/** A colour adjective in every gender the language inflects. English fills all three the same. */
export interface Adjective {
  readonly m: string;
  readonly f: string;
  readonly n: string;
}

export interface Catalog {
  /** BCP 47 tag handed to the screen reader and to speech synthesis. */
  readonly bcp47: string;
  readonly pieces: Readonly<Record<PieceType, Noun>>;
  readonly sides: { readonly w: Adjective; readonly b: Adjective };
  /** `'{piece} {side}'` in pt/es, `'{side} {piece}'` in en. */
  readonly pieceNamePattern: string;
  readonly strings: Readonly<Record<string, string>>;
}

export type LocaleCode = 'pt' | 'en' | 'es';
