// SPDX-License-Identifier: AGPL-3.0-or-later
//
// scripts/build-puzzles — turns the Lichess puzzle dump into the small curated set we ship.
//
// ========================= WHY A SCRIPT AND A CHECKED-IN FILE =========================
// The dump is 304 MB compressed and 6,057,356 puzzles. Fetching it at runtime would put a
// third-party download in front of a child on a school connection; shipping all of it is absurd.
// So this reads the dump once, keeps a few hundred puzzles a beginner can actually solve, and
// writes them into the repository — where they are reviewable, diffable, and offline.
//
// ========================= ⚠️ THE TRAP THAT PRODUCES WRONG PUZZLES IN SILENCE =========================
// THE CSV's `FEN` IS THE POSITION BEFORE THE OPPONENT'S MOVE. The first token of `Moves` is the
// opponent playing INTO the puzzle; the student answers from the second.
//
// A reader who assumes otherwise gets a puzzle whose "solution" is the opponent's move, played by
// the wrong side, from a position the student was never shown. Nothing throws. The puzzle simply
// makes no sense, and the person who discovers that is a child who is told they are wrong.
//
// So this script APPLIES the first move and stores the position the student actually sees, with
// the remaining moves as the solution. `tests/puzzles.node.test.ts` re-derives that from the
// shipped file rather than trusting this comment.
//
// ========================= LICENCE =========================
// database.lichess.org is CC0-1.0 — public domain dedication, no conditions at all, compatible
// with AGPL. Recorded in docs/LICENSES.md. `GameUrl` is kept per puzzle so any one of them can be
// traced back to the game it came from.
//
// Usage:
//   node scripts/build-puzzles.mjs <path-to-lichess_db_puzzle.csv[.zst]> [--out app/data/puzzles.json]
//
// The dump: https://database.lichess.org/lichess_db_puzzle.csv.zst

import { createReadStream, writeFileSync, mkdirSync, openSync, readSync, closeSync } from 'node:fs';
import { createZstdDecompress } from 'node:zlib';
import { createInterface } from 'node:readline';
import { dirname } from 'node:path';
import { Chess } from 'chess.js';

/**
 * What a beginner can be given.
 *
 * ⚠️ THE THEMES ARE THE CURATION, and they are chosen for what a child has been TAUGHT rather than
 * for what is common in the dump. Stage 1 teaches how the pieces move and what they are worth;
 * these are the tactics that follow directly from that and from nothing else. `mateIn3`, `zugzwang`
 * and the endgame themes are deliberately absent — they need ideas nobody has explained yet.
 */
const WANTED = ['mateIn1', 'mateIn2', 'fork', 'pin', 'hangingPiece'];

/** How many of each to keep. Small on purpose: this file is read by every page that offers them. */
const PER_THEME = 40;

/**
 * ⚠️ RATING IS NOT DIFFICULTY FOR A BEGINNER — it is difficulty for somebody who already plays.
 * The floor exists because puzzles below it are often rated low for being obscure rather than for
 * being easy. `Popularity` is the better signal and is why it is filtered too: a puzzle thousands
 * of people liked is one that reads clearly.
 */
const RATING = { min: 400, max: 1100 };
const MIN_POPULARITY = 90;
const MIN_PLAYS = 500;

const [, , input, ...rest] = process.argv;
if (!input) {
  console.error('usage: node scripts/build-puzzles.mjs <lichess_db_puzzle.csv[.zst]> [--out FILE]');
  process.exit(2);
}
const outIndex = rest.indexOf('--out');
const output = outIndex === -1 ? 'app/data/puzzles.json' : rest[outIndex + 1];
/**
 * Accept a deliberately truncated dump.
 *
 * ⚠️ OPT-IN, AND NEVER THE DEFAULT. The full file is 304 MB, and a curated few hundred puzzles do
 * not need all six million rows: a byte-range prefix is a random enough sample, because the dump
 * is ordered by puzzle id. But a truncated zstd stream ends in `ZSTD_error_prefix_unknown`, and
 * swallowing that unconditionally would also swallow a genuinely corrupt download — so the caller
 * has to say they meant it, and the output records that they did.
 */
const truncated = rest.includes('--allow-truncated');

/** The CSV's columns, in the order the dump publishes them. Verified against the live header. */
const COLUMNS = [
  'PuzzleId', 'FEN', 'Moves', 'Rating', 'RatingDeviation', 'Popularity', 'NbPlays',
  'Themes', 'GameUrl', 'OpeningTags', 'DailyDate',
];

/**
 * Where the real compressed data starts.
 *
 * ⚠️ THE OFFICIAL DUMP OPENS WITH A ZSTD *SKIPPABLE FRAME*, and Node's decompressor refuses it —
 * `ZSTD_error_prefix_unknown`, from a file that `zstd` on the command line reads without comment.
 * A skippable frame is part of the format (magic `0x184D2A50`-`0x5F`, then a four-byte little
 * endian length) and a decoder is supposed to step over it; this one does not, so the file is
 * opened past it instead.
 *
 * Found by hexdumping the first sixteen bytes after the error, which is the only way it WOULD be
 * found: the message names a prefix problem in a file whose prefix is perfectly valid.
 */
function compressedStart(path) {
  const fd = openSync(path, 'r');
  try {
    let at = 0;
    const head = Buffer.alloc(8);
    for (;;) {
      if (readSync(fd, head, 0, 8, at) < 8) return 0;
      const magic = head.readUInt32LE(0);
      if (magic < 0x184D2A50 || magic > 0x184D2A5F) return at;
      at += 8 + head.readUInt32LE(4);
    }
  } finally {
    closeSync(fd);
  }
}

function source() {
  if (!input.endsWith('.zst')) return createReadStream(input);
  return createReadStream(input, { start: compressedStart(input) }).pipe(createZstdDecompress());
}

/**
 * The one transformation that matters.
 *
 * Returns the position the STUDENT is shown and the moves they must find, or null if the row
 * cannot be made into a puzzle at all.
 */
function studentView(fen, moves) {
  const board = new Chess();
  try {
    board.load(fen);
  } catch {
    return null;
  }
  const [opponent, ...solution] = moves;
  if (!opponent || solution.length === 0) return null;
  try {
    // ⚠️ THIS LINE IS THE WHOLE POINT OF THE FILE. Without it the puzzle starts one ply early, with
    // the wrong side to move, and its "solution" is the opponent's move.
    board.move({ from: opponent.slice(0, 2), to: opponent.slice(2, 4), promotion: opponent[4] });
  } catch {
    return null;
  }
  return { fen: board.fen(), solution, side: board.turn() };
}

const kept = new Map(WANTED.map((theme) => [theme, []]));
let seen = 0;
let usable = 0;

const stream = source();
if (truncated) {
  // The rows already read are kept; see `--allow-truncated`. Without the listener the error is
  // unhandled and the process dies with the whole sample in hand.
  stream.on('error', (error) => {
    if (error.code !== 'ZSTD_error_prefix_unknown') throw error;
  });
}
const lines = createInterface({ input: stream, crlfDelay: Infinity });
let header = null;

for await (const line of lines) {
  if (!line) continue;
  if (header === null) {
    header = line.split(',');
    // ⚠️ Checked rather than assumed: a column added in the middle of the dump would silently
    // shift every field, and the first sign would be puzzles that do not parse.
    if (header.join(',') !== COLUMNS.join(',')) {
      console.error(`unexpected columns:\n  got  ${header.join(',')}\n  want ${COLUMNS.join(',')}`);
      process.exit(1);
    }
    continue;
  }
  seen += 1;

  const cols = line.split(',');
  if (cols.length < 9) continue;
  const [id, fen, moveText, rating, , popularity, plays, themeText, url] = cols;

  const score = Number(rating);
  if (!(score >= RATING.min && score <= RATING.max)) continue;
  if (Number(popularity) < MIN_POPULARITY) continue;
  if (Number(plays) < MIN_PLAYS) continue;

  const themes = themeText.split(' ');
  const theme = WANTED.find((t) => themes.includes(t));
  if (!theme || kept.get(theme).length >= PER_THEME) continue;

  const view = studentView(fen, moveText.split(' '));
  if (!view) continue;
  usable += 1;

  kept.get(theme).push({
    id,
    theme,
    fen: view.fen,
    solution: view.solution,
    side: view.side,
    rating: score,
    url,
  });

  if (WANTED.every((t) => kept.get(t).length >= PER_THEME)) break;
}

const puzzles = WANTED.flatMap((theme) => kept.get(theme));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify({
  source: 'https://database.lichess.org/lichess_db_puzzle.csv.zst',
  licence: 'CC0-1.0',
  note: 'Positions are AFTER the opponent move the dump prepends; see scripts/build-puzzles.mjs.',
  sampled: truncated ? 'a byte-range prefix of the dump, not the whole file' : 'the whole dump',
  themes: WANTED,
  rating: RATING,
  puzzles,
}, null, 2)}\n`);

console.error(`read ${seen} rows, kept ${puzzles.length} of ${usable} usable -> ${output}`);
for (const theme of WANTED) console.error(`  ${theme}: ${kept.get(theme).length}`);
