// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= AN OFF-BY-ONE HERE WOULD READ ALMOST SENSIBLY =========================
// A PGN attaches a note AFTER the move it is about, so the note on the 17th half-move is the
// comment on the position that half-move produced. Get that wrong by one and every note lands on
// the previous move — and the result is not gibberish, which is the danger: "the bishop pins the
// knight" over a move that prepares the pin still reads like chess. Nobody would notice from the
// screen, and the only thing that can notice is a test that names a move and demands its own note.
//
// So this file pins the pairing at both ends: the step for `teach.book.opera.n17` asks for Bg5, and the
// step for `n19` asks for the knight sacrifice. Those are two facts about the Opera Game, and they
// are checkable without knowing anything about how the lesson driver works.
import { describe, expect, it } from 'vitest';
import { gameLesson, bookId, isBookId, type AnnotatedGame } from '../app/js/teach/game-lesson.ts';
import { GAMES, gameById } from '../app/js/teach/games.ts';
import { createRules } from '../app/js/chess/rules.ts';
import { matchesShape } from '../app/js/teach/lesson.ts';

const opera = gameLesson(gameById('opera')!)!;

/** The SAN a step asks for, which is the only thing a `play` step in a book ever asks by. */
function wants(step: { task: { kind: string } }): string {
  const task = step.task as { kind: 'play'; want: { san?: string } };
  if (task.kind !== 'play' || !task.want.san) throw new Error('a book step is a play with a san');
  return task.want.san;
}

describe('[Book] the Opera Game becomes a lesson', () => {
  it('is a lesson at all, with a namespaced id', () => {
    expect(opera).not.toBeNull();
    expect(opera.id).toBe('book:opera');
    expect(isBookId(opera.id)).toBe(true);
    // And the namespace does its job: no lesson or puzzle id can collide with it.
    expect(isBookId('rook')).toBe(false);
    expect(isBookId('puzzle:abc12')).toBe(false);
  });

  it('⚠️ makes a step of the ANNOTATED moves and of nothing else', () => {
    /*
     * The whole design decision, asserted. Thirty-three half-moves, nine notes, nine steps — a book
     * is the annotator's choice of where to stop, and the plies between two notes are folded into
     * the next step's FEN. A step per ply would be a move list, and an unannotated step would have
     * to invent a sentence.
     */
    expect(opera.steps).toHaveLength(9);
    expect(opera.steps.map(wants)).toEqual([
      'd4', 'Bg4', 'Bc4', 'Bg5', 'Nxb5', 'O-O-O', 'Rxd7', 'Qb8+', 'Rd8#',
    ]);
  });

  it('⚠️ puts each note on the move it is about, not the one before it', () => {
    // n17 is the seventeenth half-move. Counted out: 1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3
    // 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 — the pin, and the note that names it.
    const pin = opera.steps.find((step) => step.say === 'teach.book.opera.n17')!;
    expect(pin).toBeDefined();
    expect(wants(pin)).toBe('Bg5');

    // And the sacrifice two plies later, so a shift of one in EITHER direction fails something.
    const sacrifice = opera.steps.find((step) => step.say === 'teach.book.opera.n19')!;
    expect(wants(sacrifice)).toBe('Nxb5');

    // The last note is on the mate itself, which is the one place an off-by-one would run out of
    // moves rather than land on the wrong one.
    expect(opera.steps.at(-1)!.say).toBe('teach.book.opera.n33');
    expect(wants(opera.steps.at(-1)!)).toBe('Rd8#');
  });

  it('⚠️ starts every step from a position where the asked-for move is legal', () => {
    /*
     * THE ASSERTION THAT MAKES THE FILE SAFE TO GROW, and it is the same one the puzzle adapter
     * earns: a step whose FEN is one ply out is a step that cannot be answered at all, and the
     * symptom on screen is a child being told they are wrong however they move.
     *
     * Re-derived from the rules rather than trusted: the position is built, every legal move in it
     * is generated, and exactly one of them must satisfy the shape the step asks for.
     */
    for (const step of opera.steps) {
      const rules = createRules(step.fen!);
      const shape = (step.task as { want: { san?: string } }).want;
      let fits = 0;
      for (const move of rules.allMoves()) {
        // ⚠️ PLAYED AND TAKEN BACK, ONE AT A TIME. Playing them all onto one board would leave the
        // second candidate generated from the position the first produced, and the count would be
        // nonsense that still looked like a number.
        const result = rules.move(move.from, move.to, move.promotion ?? undefined);
        if (result && matchesShape(shape, result)) fits += 1;
        if (result) rules.undo();
      }
      expect(`${wants(step)}: ${fits} legal move fits`)
        .toBe(`${wants(step)}: 1 legal move fits`);
    }
  });

  it('draws the teacher an arrow along the move it is asking for', () => {
    // Not a second source of truth: it comes from the same `MoveResult`. Asserted because a hint
    // that points somewhere else is worse than no hint, and this is the one place it could drift.
    const sacrifice = opera.steps.find((step) => step.say === 'teach.book.opera.n19')!;
    expect(sacrifice.show?.arrows).toEqual([['c3', 'b5']]);
  });
});

describe('[Book] a file that will not parse is a value, not an exception', () => {
  const broken = (pgn: string): AnnotatedGame => ({ id: 'x', title: 'x', pgn });

  it('returns null rather than throwing, for every shape of bad input', () => {
    for (const pgn of ['', '   ', 'not a game at all', '1. e5 e5 2. Qq9']) {
      expect(`${JSON.stringify(pgn)}: ${gameLesson(broken(pgn)) === null}`)
        .toBe(`${JSON.stringify(pgn)}: true`);
    }
  });

  it('⚠️ refuses a game with no notes in it, rather than shipping an empty lesson', () => {
    /*
     * A perfectly legal PGN with nothing to say is not a book, and a lesson with no steps would
     * open to a panel with nothing in it and no way to advance — the failure looks like a bug in
     * the driver, three modules away from the file that caused it.
     */
    expect(gameLesson(broken('1. e4 e5 2. Nf3 Nc6 3. Bb5 *'))).toBeNull();
  });
});

describe('[Book] the shipped table', () => {
  it('is every game, and every one of them builds', () => {
    expect(GAMES.length).toBeGreaterThanOrEqual(1);
    for (const game of GAMES) {
      expect(`${game.id}: ${gameLesson(game) !== null}`).toBe(`${game.id}: true`);
      expect(`${game.id}: ${bookId(game)}`).toBe(`${game.id}: book:${game.id}`);
      // The title is a key, and a key has a dot. A literal title would render untranslated in two
      // of the three languages and nothing would fail.
      expect(`${game.id} title: ${game.title.includes('.')}`).toBe(`${game.id} title: true`);
    }
  });

  it('finds a game by its bare id, and nothing by a namespaced one', () => {
    expect(gameById('opera')?.id).toBe('opera');
    // ⚠️ `book:opera` is what the shell holds; stripping the prefix is the CALLER's job, and
    // asserting it here is what stops a future caller passing the wrong one and getting undefined.
    expect(gameById('book:opera')).toBeUndefined();
  });
});
