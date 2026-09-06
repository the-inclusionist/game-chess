// SPDX-License-Identifier: AGPL-3.0-or-later
//
// scripts/build-openings — turns the Lichess ECO tables into the book of names we ship.
//
// ========================= WHAT THIS IS FOR =========================
// Naming what a player has just walked into. "You are in the Ruy Lopez" is the single cheapest
// piece of chess education there is: it costs one line of screen, it needs no engine, and it turns
// a sequence of moves a beginner made by feel into a thing with a name they can look up.
//
// ========================= LICENCE =========================
// `lichess-org/chess-openings` is CC0-1.0 — a public-domain dedication with no conditions —
// verified through the GitHub API rather than assumed from a mirror. Recorded in docs/LICENSES.md.
//
// ========================= ⚠️ WHY IT STOPS AT TWELVE PLIES =========================
// The full tables are 3,810 openings and 351 kB. Twelve plies — six moves each side — keeps 2,833
// of them at 229 kB, and drops only variations a learner's game does not reach. It costs nothing
// when it does: the lookup takes the LONGEST KNOWN PREFIX, so a game that walks past the end of
// the book is still named by the last line the book knew. Somebody twenty moves into a Najdorf is
// told they are in a Najdorf, which is the true and useful answer either way.
//
// Usage:
//   node scripts/build-openings.mjs <dir-with-a.tsv..e.tsv> [--out app/data/openings.json]
//
// The tables: https://github.com/lichess-org/chess-openings

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Six moves each side. See the note above. */
const MAX_PLIES = 12;

const [, , input, ...rest] = process.argv;
if (!input) {
  console.error('usage: node scripts/build-openings.mjs <dir> [--out FILE]');
  process.exit(2);
}
const outIndex = rest.indexOf('--out');
const output = outIndex === -1 ? 'app/data/openings.json' : rest[outIndex + 1];

/** ECO's five volumes. Each is a TSV of `eco`, `name`, `pgn`. */
const VOLUMES = ['a', 'b', 'c', 'd', 'e'];

const book = {};
let seen = 0;
let dropped = 0;

for (const volume of VOLUMES) {
  const path = join(input, `${volume}.tsv`);
  const lines = readFileSync(path, 'utf8').split('\n');
  const header = lines[0]?.split('\t');
  // ⚠️ Checked rather than assumed: a column inserted upstream would shift every field, and the
  // first sign would be a book full of openings named after their own move lists.
  if (header?.[0] !== 'eco' || header?.[1] !== 'name' || header?.[2]?.trim() !== 'pgn') {
    console.error(`unexpected columns in ${path}: ${header?.join(',')}`);
    process.exit(1);
  }

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [eco, name, pgn] = line.split('\t');
    seen += 1;
    /*
     * ⚠️ THE MOVE NUMBERS COME OUT. They are punctuation, not moves — and keeping them would mean
     * the lookup had to reproduce them exactly, including the `3...` form that only appears when a
     * line starts on Black. The key is the moves themselves, which is what a game actually is.
     */
    const moves = pgn.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (moves.length === 0 || moves.length > MAX_PLIES) { dropped += 1; continue; }
    book[moves.join(' ')] = [eco, name];
  }
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify({
  source: 'https://github.com/lichess-org/chess-openings',
  licence: 'CC0-1.0',
  note: `Keyed by SAN move sequence. Truncated at ${MAX_PLIES} plies; the lookup takes the longest known prefix.`,
  maxPlies: MAX_PLIES,
  book,
}, null, 0)}\n`);

console.error(`read ${seen} openings, kept ${Object.keys(book).length}, dropped ${dropped} over ${MAX_PLIES} plies -> ${output}`);
