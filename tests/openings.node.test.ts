// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE BOOK IS DOWNLOADED, SO IT IS RE-DERIVED =========================
// `app/data/openings.json` was written by a script from five TSVs published by somebody else, in a
// format documented by somebody else. The same reasoning as the puzzles applies: everything about
// that says the contents should be checked here, against the shipped artefact, rather than trusted
// — and checked against the RULES, because an opening whose moves cannot be played is not an
// opening, it is a typo with a name.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { nameOpening, type OpeningBook } from '../app/js/openings/opening.ts';

const book = JSON.parse(readFileSync('app/data/openings.json', 'utf8')) as OpeningBook;
const lines = Object.entries(book.book);

describe('[Book] the shipped openings are what they claim to be', () => {
  it('says where it came from and under what licence', () => {
    // CC0-1.0: a public-domain dedication with no conditions, which is what lets it sit inside an
    // AGPL project without a compatibility argument. Verified at the source, not from a mirror.
    expect(book.source).toContain('lichess-org/chess-openings');
    expect(book.licence).toBe('CC0-1.0');
  });

  it('is a real book, and not an enormous one', () => {
    expect(lines.length).toBeGreaterThanOrEqual(2000);
    // A guard on the download: this is fetched by anyone who watches the move list.
    expect(lines.length).toBeLessThanOrEqual(4000);
  });

  it('keeps nothing deeper than it says it does', () => {
    for (const [moves] of lines) {
      const plies = moves.split(' ').length;
      expect(`${moves}: ${plies <= book.maxPlies}`).toBe(`${moves}: true`);
    }
  });

  it('has an ECO code and a name for every line', () => {
    for (const [moves, [eco, name]] of lines) {
      expect(`${moves} eco: ${/^[A-E]\d\d$/.test(eco)}`).toBe(`${moves} eco: true`);
      expect(`${moves} name: ${name.length > 0}`).toBe(`${moves} name: true`);
    }
  });

  it('⚠️ contains no move numbers, which is what the key is FOR', () => {
    /*
     * The tables publish `1. e4 e5 2. Nf3`, and the numbers are punctuation rather than moves.
     * Left in, the lookup would have had to reproduce them exactly — including the `3...` form
     * that appears only when a line begins on Black — and would have missed every time it did not.
     */
    for (const [moves] of lines) {
      expect(`${moves}: ${/\d/.test(moves.replace(/[NBRQK]?[a-h]?[1-8]/g, ''))}`)
        .toBe(`${moves}: false`);
    }
  });

  it('⚠️ every line is PLAYABLE, from the opening position', () => {
    /*
     * THE ASSERTION THAT MAKES THE FILE SAFE TO SHIP. A key nobody can play is a name that can
     * never be shown — silently, because the lookup simply never matches it. Checking all 2,833
     * against `chess.js` costs a second and removes the whole class.
     */
    let checked = 0;
    for (const [moves] of lines) {
      const board = new Chess();
      let ok = true;
      for (const san of moves.split(' ')) {
        try {
          board.move(san);
        } catch {
          ok = false;
          break;
        }
      }
      expect(`${moves}: ${ok}`).toBe(`${moves}: true`);
      checked += 1;
    }
    expect(checked).toBe(lines.length);
  });
});

describe('[Naming] the deepest line the game began with', () => {
  it('names the openings a beginner actually meets', () => {
    expect(nameOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], book)?.name).toBe('Ruy Lopez');
    expect(nameOpening(['e4', 'c5'], book)?.name).toBe('Sicilian Defense');
    expect(nameOpening(['d4', 'd5', 'c4'], book)?.name).toContain('Queen');
  });

  it('⚠️ gets MORE specific as the game goes on, never less', () => {
    /*
     * Searched from the deepest end backwards, stopping at the first hit. Walking forwards would
     * find the SHALLOWEST match — so every Najdorf would be announced as "Sicilian Defense", which
     * is true, and is the answer the player already had four moves earlier.
     */
    const najdorf = ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'];
    const early = nameOpening(najdorf.slice(0, 2), book)!;
    const late = nameOpening(najdorf, book)!;
    expect(late.plies).toBeGreaterThan(early.plies);
    expect(late.name).toContain('Najdorf');
  });

  it('⚠️ holds the last true thing when the game leaves the book', () => {
    /*
     * A game leaves theory almost immediately and never comes back. An exact match would answer
     * "no opening" for nearly all of every game ever played — including the part of it that WAS an
     * opening — so the answer is the deepest line the game BEGAN with.
     */
    const past = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5'];
    const wandered = [...past, 'Rb1', 'Ra7', 'Kh1', 'Kd8'];
    const named = nameOpening(wandered, book);
    expect(named).not.toBeNull();
    expect(named!.name).toContain('Ruy Lopez');
    // And it never claims more of the game than the book actually accounts for.
    expect(named!.plies).toBeLessThanOrEqual(book.maxPlies);
  });

  it('says nothing before there is anything to say', () => {
    expect(nameOpening([], book)).toBeNull();
    // A first move nobody has named stays unnamed rather than being given the nearest thing.
    expect(nameOpening(['Nh3', 'Nh6', 'Ng1', 'Ng8', 'a3'], book)?.plies).toBeLessThanOrEqual(4);
  });
});
