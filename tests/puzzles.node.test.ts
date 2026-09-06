// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE TEST THAT MAKES A DOWNLOADED FILE SAFE TO SHIP =========================
// `app/data/puzzles.json` was written by a script, from a 304 MB file nobody will read, in a format
// documented by somebody else. Everything about that says the contents should be re-derived rather
// than trusted — and re-derived HERE, against the shipped artefact, not against the script, because
// the script is exactly the thing that might be wrong.
//
// ⚠️ THE FAULT THIS EXISTS FOR IS A ONE-PLY OFFSET. The Lichess dump's `FEN` is the position BEFORE
// the opponent's move, and the first token of its `Moves` is that opponent move. A reader who takes
// the FEN at face value produces puzzles that are wrong in a way NOTHING DETECTS: the position is
// legal, the moves are legal, the file parses, and the "solution" is the opponent's move played by
// the wrong side from a board the student was never shown.
//
// The mate tests below are what actually settle it. A mate-in-one is mate after ONE move only if
// the offset is right; shifted by a ply it is mate after two, and that is a difference a machine
// can see even though a human reading the JSON cannot.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { isStudentMove, type PuzzleSet } from '../app/js/puzzles/puzzle.ts';

const set = JSON.parse(readFileSync('app/data/puzzles.json', 'utf8')) as PuzzleSet;

/** Plays a UCI token. Returns false rather than throwing, so a bad one is a value. */
function play(board: Chess, token: string): boolean {
  try {
    return Boolean(board.move({
      from: token.slice(0, 2), to: token.slice(2, 4), promotion: token[4],
    }));
  } catch {
    return false;
  }
}

describe('[Data] the shipped set is what it claims to be', () => {
  it('is not empty, and is not enormous', () => {
    // A guard on every other test here: an empty file would pass all of them.
    expect(set.puzzles.length).toBeGreaterThanOrEqual(100);
    // And a guard on the download: this file is fetched by anyone who opens a puzzle.
    expect(set.puzzles.length).toBeLessThanOrEqual(1000);
  });

  it('says where it came from and under what licence', () => {
    // CC0-1.0 is a public-domain dedication with no conditions, which is why it can sit inside an
    // AGPL project at all. `docs/LICENSES.md` carries the reasoning; this keeps it in the data.
    expect(set.source).toContain('database.lichess.org');
    expect(set.licence).toBe('CC0-1.0');
    expect(set.sampled.length).toBeGreaterThan(0);
  });

  it('has no duplicates, and every puzzle can be traced back to its game', () => {
    const ids = set.puzzles.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const puzzle of set.puzzles) {
      expect(`${puzzle.id} url: ${puzzle.url.startsWith('https://lichess.org/')}`)
        .toBe(`${puzzle.id} url: true`);
    }
  });

  it('keeps only the themes a beginner has been taught, in the rating band it claims', () => {
    for (const puzzle of set.puzzles) {
      expect(`${puzzle.id} theme: ${set.themes.includes(puzzle.theme)}`)
        .toBe(`${puzzle.id} theme: true`);
      const inBand = puzzle.rating >= set.rating.min && puzzle.rating <= set.rating.max;
      expect(`${puzzle.id} rating ${puzzle.rating} in band: ${inBand}`)
        .toBe(`${puzzle.id} rating ${puzzle.rating} in band: true`);
    }
  });
});

describe('[Position] every puzzle is a chess position with a playable answer', () => {
  it('loads every FEN', () => {
    for (const puzzle of set.puzzles) {
      const board = new Chess();
      expect(`${puzzle.id}: ${(() => { try { board.load(puzzle.fen); return 'ok'; } catch { return 'bad'; } })()}`)
        .toBe(`${puzzle.id}: ok`);
    }
  });

  it('agrees with its own FEN about whose move it is', () => {
    // `side` is redundant with the FEN and kept because a menu needs it. Redundant data is data
    // that can disagree, so it is checked rather than assumed.
    for (const puzzle of set.puzzles) {
      const board = new Chess();
      board.load(puzzle.fen);
      expect(`${puzzle.id} side: ${puzzle.side}`).toBe(`${puzzle.id} side: ${board.turn()}`);
    }
  });

  it('plays the whole solution, in order, from the position it ships', () => {
    for (const puzzle of set.puzzles) {
      const board = new Chess();
      board.load(puzzle.fen);
      puzzle.solution.forEach((token, index) => {
        expect(`${puzzle.id}[${index}] ${token}: ${play(board, token)}`)
          .toBe(`${puzzle.id}[${index}] ${token}: true`);
      });
    }
  });

  it('⚠️ asks the STUDENT to move first, and last', () => {
    /*
     * An odd number of moves is the signature of the offset being right: student, opponent,
     * student, … , student. An even number means the dump's leading opponent move is still in
     * there and the student is being asked to play the wrong colour.
     */
    for (const puzzle of set.puzzles) {
      expect(`${puzzle.id} plies ${puzzle.solution.length} odd: ${puzzle.solution.length % 2 === 1}`)
        .toBe(`${puzzle.id} plies ${puzzle.solution.length} odd: true`);
      expect(isStudentMove(0)).toBe(true);
      expect(isStudentMove(puzzle.solution.length - 1)).toBe(true);
    }
  });

  it('⚠️ has the student, and only the student, moving on the student ply', () => {
    // The other half of the same claim, checked against the board rather than against the parity:
    // every move the convention calls the student's is played by the side the puzzle says they are.
    for (const puzzle of set.puzzles) {
      const board = new Chess();
      board.load(puzzle.fen);
      puzzle.solution.forEach((token, index) => {
        const expected = isStudentMove(index) ? puzzle.side : (puzzle.side === 'w' ? 'b' : 'w');
        expect(`${puzzle.id}[${index}] mover: ${board.turn()}`)
          .toBe(`${puzzle.id}[${index}] mover: ${expected}`);
        play(board, token);
      });
    }
  });
});

describe('[Themes] a mate in one really is mate, in one', () => {
  /*
   * ========================= ⚠️ THE ASSERTION THAT SETTLES THE PLY OFFSET =========================
   * Everything above proves the file is internally consistent. It would ALSO be internally
   * consistent one ply out — legal position, legal moves, alternating sides — which is precisely
   * why the offset is dangerous.
   *
   * This is the claim that cannot survive being wrong. `mateIn1` is checkmate after ONE move only
   * if the position shipped is the one the student is meant to see. Shift it by a ply and the mate
   * arrives a move late, or not at all.
   */
  it('mates in one', () => {
    const ones = set.puzzles.filter((p) => p.theme === 'mateIn1');
    expect(ones.length).toBeGreaterThan(0);
    for (const puzzle of ones) {
      expect(`${puzzle.id} plies: ${puzzle.solution.length}`).toBe(`${puzzle.id} plies: 1`);
      const board = new Chess();
      board.load(puzzle.fen);
      play(board, puzzle.solution[0]!);
      expect(`${puzzle.id} mate: ${board.isCheckmate()}`).toBe(`${puzzle.id} mate: true`);
    }
  });

  it('mates in two, having let the opponent reply once', () => {
    const twos = set.puzzles.filter((p) => p.theme === 'mateIn2');
    expect(twos.length).toBeGreaterThan(0);
    for (const puzzle of twos) {
      expect(`${puzzle.id} plies: ${puzzle.solution.length}`).toBe(`${puzzle.id} plies: 3`);
      const board = new Chess();
      board.load(puzzle.fen);
      for (const token of puzzle.solution) play(board, token);
      expect(`${puzzle.id} mate: ${board.isCheckmate()}`).toBe(`${puzzle.id} mate: true`);
    }
  });

  it('⚠️ is NOT already over before the student has played', () => {
    // The cheapest way to be wrong by a ply in the other direction: a position that is already
    // checkmate is one the student cannot answer at all, and `chess/state.ts` would settle it to
    // `over` and refuse every square — exactly the failure four lessons had.
    for (const puzzle of set.puzzles) {
      const board = new Chess();
      board.load(puzzle.fen);
      expect(`${puzzle.id} over: ${board.isGameOver()}`).toBe(`${puzzle.id} over: false`);
    }
  });
});
