// SPDX-License-Identifier: AGPL-3.0-or-later
// openings/opening — naming what a player has just walked into.
//
// ========================= THE CHEAPEST CHESS EDUCATION THERE IS =========================
// "You are in the Ruy Lopez" costs one line of screen, needs no engine, and turns a sequence of
// moves a beginner made by feel into a thing with a NAME — which is the difference between a game
// they cannot talk about and one they can look up, ask about, or recognise the next time.
//
// ========================= ⚠️ THE LONGEST PREFIX, NOT THE EXACT MATCH =========================
// A game leaves the book almost immediately and never comes back: after ten moves nobody is in a
// named line any more. Looking for an exact match would therefore answer "no opening" for the vast
// majority of every game ever played, including the part of it that WAS an opening.
//
// So the name is the deepest line the book knows that the game began with. It only ever grows more
// specific as the moves go on — Sicilian, then Sicilian Defense: Najdorf Variation — and it stops
// growing when the game leaves theory, holding the last true thing rather than going blank.

import type { LocaleCode } from '../i18n/types.ts';

export interface Opening {
  /** The ECO code, `A00` to `E99`. Kept because it is how a book is indexed. */
  readonly eco: string;
  /** English, as published. See `docs/LICENSES.md`: the names are the tables', not ours. */
  readonly name: string;
  /** How many plies of the game the name accounts for. */
  readonly plies: number;
}

export interface OpeningBook {
  readonly source: string;
  readonly licence: string;
  readonly note: string;
  readonly maxPlies: number;
  /** SAN move sequence, space separated, to `[eco, name]`. */
  readonly book: Readonly<Record<string, readonly [string, string]>>;
}

/**
 * Fetches the book.
 *
 * ⚠️ A DYNAMIC IMPORT, like the puzzles and the lesson prose. It is 230 kB of names, and somebody
 * who never looks at the move list should not carry them.
 */
export async function loadOpenings(): Promise<OpeningBook> {
  const module = await import('../../data/openings.json');
  return module.default as unknown as OpeningBook;
}

/**
 * The deepest named line this game began with, or null before it is in one.
 *
 * ⚠️ SEARCHED FROM THE DEEPEST END BACKWARDS, and it stops at the first hit. Walking forwards
 * would find the SHALLOWEST — every Najdorf would be announced as "Sicilian Defense", which is
 * true and is the answer a player already had two moves in.
 */
export function nameOpening(
  moves: readonly string[],
  book: OpeningBook,
): Opening | null {
  const deepest = Math.min(moves.length, book.maxPlies);
  for (let plies = deepest; plies > 0; plies -= 1) {
    const found = book.book[moves.slice(0, plies).join(' ')];
    if (found) return { eco: found[0], name: found[1], plies };
  }
  return null;
}

/**
 * i18n key for the label beside the name.
 *
 * ⚠️ THE NAME ITSELF IS NOT TRANSLATED, and that is deliberate rather than lazy. "Ruy Lopez" is
 * what it is called in Portuguese, in Spanish and in English; the ones that do differ — the French,
 * the Sicilian — differ in ways a learner meets in books that are themselves in one language or
 * another. Inventing our own translations of three thousand of them would make this game the only
 * place they are spelled that way, which is the opposite of what a name is for.
 */
export function openingLabelKey(_locale?: LocaleCode): string {
  return 'hud.opening';
}
