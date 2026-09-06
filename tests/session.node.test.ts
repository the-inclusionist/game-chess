// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import {
  clear, describe as describeGame, load, loadProgress, loadSettings, markLearned, patchSettings,
  rememberPlace, restore, resume, save, saveProgress, saveSettings,
} from '../app/js/chess/session.ts';
import { fromAlgebraic, type Square } from '../app/js/chess/types.ts';

// ========================= WHY THIS EXISTS =========================
// The three views are three PAGES, because a flat board is 110 KB and the projected one 148 and
// one bundle carrying both would make every player download the one they are not looking at. The
// bill for that decision is this module: a navigation throws away every object in memory, and
// without it, switching from 2D to 2.5D restarted the game.

const sq = (name: string): Square => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

function fakeStore() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    get size() { return data.size; },
  };
}

const opened = () => {
  const rules = createRules();
  rules.move(sq('e2'), sq('e4'));
  rules.move(sq('e7'), sq('e5'));
  rules.move(sq('g1'), sq('f3'));
  return rules;
};

describe('[Session] a game written down as moves, not as a position', () => {
  it('writes the score sheet in play order', () => {
    expect(describeGame(opened())).toEqual({
      played: ['e2e4', 'e7e5', 'g1f3'],
      future: [],
    });
  });

  it('comes back as the same game, not merely the same board', () => {
    const before = opened();
    const store = fakeStore();
    save(before, store);

    const after = restore(load(store)!);
    expect(after.fen()).toBe(before.fen());
    // A FEN would have restored the position and lost all of this.
    expect(after.history().map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3']);
    expect(after.canUndo()).toBe(true);
  });

  it('carries the captured tally, because that is read from the history', () => {
    const rules = createRules();
    rules.move(sq('e2'), sq('e4'));
    rules.move(sq('d7'), sq('d5'));
    rules.move(sq('e4'), sq('d5'));

    const store = fakeStore();
    save(rules, store);
    const after = restore(load(store)!);
    expect(after.history().at(-1)?.captured).toEqual({ type: 'p', side: 'b' });
  });

  it('keeps BOTH directions of the take-back', () => {
    const rules = opened();
    rules.undo();
    rules.undo();
    expect(rules.canRedo()).toBe(true);

    const store = fakeStore();
    save(rules, store);
    const after = restore(load(store)!);

    expect(after.history().map((m) => m.san)).toEqual(['e4']);
    expect(after.canRedo()).toBe(true);
    // And the redo replays in the order it was undone in, which is the point of saving play order.
    after.redo();
    expect(after.history().map((m) => m.san)).toEqual(['e4', 'e5']);
    after.redo();
    expect(after.history().map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3']);
    expect(after.canRedo()).toBe(false);
  });

  it('records a promotion, which is the one move four characters cannot say', () => {
    const rules = createRules('8/4P3/8/8/8/8/8/K6k w - - 0 1');
    rules.move(sq('e7'), sq('e8'), 'q');
    expect(describeGame(rules).played).toEqual(['e7e8q']);
    const store = fakeStore();
    save(rules, store);
    expect(restore(load(store)!).history().at(-1)?.promotion).toBe('q');
  });
});

describe('[Session] nothing it reads back is trusted', () => {
  it('treats an empty store as a new game', () => {
    const store = fakeStore();
    expect(load(store)).toBeNull();
    expect(resume(store).history()).toHaveLength(0);
  });

  it('refuses rubbish rather than throwing', () => {
    const store = fakeStore();
    for (const junk of ['', '{', 'null', '[]', '{"played":"e2e4"}', '{"played":[7]}',
      '{"played":["zz99"],"future":[]}', '{"played":["e2"],"future":[]}']) {
      store.setItem('incl_chess_game', junk);
      expect(load(store)).toBeNull();
      expect(() => resume(store)).not.toThrow();
    }
  });

  it('STOPS on a move that will not play, rather than skipping it', () => {
    // A saved game is worth something only if it is the same game. Half of one, with a move
    // quietly missing, is a position nobody ever reached — worse than starting again.
    const store = fakeStore();
    store.setItem('incl_chess_game', JSON.stringify({ played: ['e2e4', 'e2e4'], future: [] }));
    const rules = resume(store);
    expect(rules.history()).toHaveLength(0);
    expect(rules.fen()).toBe(createRules().fen());
  });

  it('survives a browser that refuses storage entirely', () => {
    // A private window, or site data switched off. Not a reason for chess to fail to start.
    expect(() => save(createRules(), null)).not.toThrow();
    expect(load(null)).toBeNull();
    expect(() => clear(null)).not.toThrow();
    expect(resume(null).history()).toHaveLength(0);
  });

  it('survives a store that throws on write', () => {
    const angry = {
      getItem: () => null,
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('nope'); },
    };
    expect(() => save(opened(), angry)).not.toThrow();
    expect(() => clear(angry)).not.toThrow();
  });
});

describe('[Session] the choices that must not reset when the view changes', () => {
  it('remembers the palette, the drawing, the coordinates and the side', () => {
    const store = fakeStore();
    saveSettings({ theme: 'jose', set: 'math', coordinates: false, mode: 'b' }, store);
    expect(loadSettings(store)).toEqual({
      theme: 'jose', set: 'math', coordinates: false, mode: 'b',
    });
  });

  it('drops anything it does not recognise instead of handing it on', () => {
    // A stale or hand-edited entry must not reach the renderer as a colour or a side.
    const store = fakeStore();
    store.setItem('incl_chess_view', JSON.stringify({ theme: 7, mode: 'purple', coordinates: 'yes' }));
    expect(loadSettings(store)).toEqual({});
  });

  it('MERGES a change instead of replacing the record', () => {
    /*
     * ⚠️ THE BUG THIS CLOSES WAS SILENT DATA LOSS, not untidiness. `saveSettings` writes the
     * whole record, so each of the three composition roots kept its own `currentSettings()`
     * closure listing only the keys IT knew about — the projected root had no `set`, the solid
     * root had no `set` either and hardcoded `coordinates: false`. Changing the palette on one
     * page erased a choice made on another, and it only showed on the next change of view.
     */
    const store = fakeStore();
    saveSettings({ set: 'math', coordinates: true, elo: 1600 }, store);
    patchSettings({ theme: 'xboard' }, store);
    expect(loadSettings(store)).toEqual({
      set: 'math', coordinates: true, elo: 1600, theme: 'xboard',
    });
  });

  it('overwrites only the key it was given', () => {
    const store = fakeStore();
    saveSettings({ theme: 'jose', hints: true }, store);
    patchSettings({ hints: false }, store);
    expect(loadSettings(store)).toEqual({ theme: 'jose', hints: false });
  });

  it('repairs a record that has gone bad rather than throwing on it', () => {
    // A patch reads through `loadSettings`, which drops what it does not recognise. So a stored
    // record that is nonsense becomes an empty one plus the patch, instead of a crash at boot.
    const store = fakeStore();
    store.setItem('incl_chess_view', 'not json at all');
    patchSettings({ theme: 'wikipedia' }, store);
    expect(loadSettings(store)).toEqual({ theme: 'wikipedia' });
  });

  it('is separate from the game, so a new game keeps the settings', () => {
    const store = fakeStore();
    saveSettings({ theme: 'xboard', mode: 'b' }, store);
    save(opened(), store);
    clear(store);
    expect(load(store)).toBeNull();
    expect(loadSettings(store)).toEqual({ theme: 'xboard', mode: 'b' });
  });
});

describe('[Progress] the one thing that is meant to outlive the tab', () => {
  /*
   * ⚠️ THE ARGUMENT FOR `sessionStorage` INVERTS HERE, and that is the whole reason this section
   * exists rather than another key on the record above. A half-finished GAME resurrected days
   * later on a shared school machine, in front of whoever sat down next, is a feature nobody asked
   * for. A list of lessons finished is the thing the child came back FOR.
   */
  it('starts empty, and stays empty when the browser refuses storage', () => {
    // A private window, site data refused, a full quota: none of them is a reason a child cannot
    // take a lesson. They just do not get to keep it.
    expect(loadProgress(fakeStore())).toEqual({ done: [] });
    expect(loadProgress(null)).toEqual({ done: [] });
    expect(() => { markLearned('rook', null); }).not.toThrow();
    expect(() => { rememberPlace('rook', 1, null); }).not.toThrow();
  });

  it('remembers a finished lesson, and does not file it twice', () => {
    const store = fakeStore();
    markLearned('notation', store);
    markLearned('rook', store);
    markLearned('notation', store);
    expect(loadProgress(store).done).toEqual(['notation', 'rook']);
  });

  it('remembers where a lesson was left without disturbing what was finished', () => {
    const store = fakeStore();
    markLearned('notation', store);
    rememberPlace('rook', 2, store);
    expect(loadProgress(store)).toEqual({ done: ['notation'], at: { lesson: 'rook', step: 2 } });
  });

  it('⚠️ forgets the place when the lesson it was in is finished', () => {
    // A finished lesson resumed at its last step would reopen on the question that had just been
    // answered, which reads as the game having lost the answer.
    const store = fakeStore();
    rememberPlace('rook', 1, store);
    markLearned('rook', store);
    expect(loadProgress(store)).toEqual({ done: ['rook'] });
  });

  it('keeps the game and the lessons in different places', () => {
    /*
     * They are different storages in the app, but a test can hand both the same object — and if
     * they shared a key, one would silently overwrite the other and only the second reader would
     * find out.
     */
    const store = fakeStore();
    save(opened(), store);
    saveSettings({ theme: 'dark' }, store);
    markLearned('rook', store);
    expect(loadProgress(store).done).toEqual(['rook']);
    expect(loadSettings(store).theme).toBe('dark');
    expect(load(store)?.played).toHaveLength(3);
    expect(store.size).toBe(3);
  });

  it('trusts nothing it reads back', () => {
    /*
     * ⚠️ THIS RECORD SURVIVES AN UPDATE OF THE GAME, so its shape is not this version's to assume.
     * A `done` that has become a string, or a step that has become a float or a negative, would
     * otherwise reach the tutor as an index into `Lesson.steps` — and the failure a child sees is
     * a lesson that opens on nothing.
     */
    const bad = [
      'not json at all', '"a string"', 'null', '[]', '42',
      '{"done":"rook"}', '{"done":[1,2,3]}', '{"done":["rook",7,"king"]}',
      '{"done":[],"at":{"lesson":"rook"}}',
      '{"done":[],"at":{"lesson":"rook","step":1.5}}',
      '{"done":[],"at":{"lesson":"rook","step":-1}}',
      '{"done":[],"at":{"lesson":7,"step":1}}',
      '{"done":[],"at":"rook"}',
    ];
    for (const raw of bad) {
      const store = fakeStore();
      store.setItem('incl_chess_learned', raw);
      const progress = loadProgress(store);
      expect(`${raw} -> at: ${JSON.stringify(progress.at)}`).toBe(`${raw} -> at: undefined`);
      expect(`${raw} -> done: ${progress.done.every((id) => typeof id === 'string')}`)
        .toBe(`${raw} -> done: true`);
    }
    // The one that is merely partly wrong keeps the part that is right.
    const store = fakeStore();
    store.setItem('incl_chess_learned', '{"done":["rook",7,"king"]}');
    expect(loadProgress(store).done).toEqual(['rook', 'king']);
  });

  it('round-trips a whole record', () => {
    const store = fakeStore();
    const progress = { done: ['notation', 'values'], at: { lesson: 'pawn', step: 0 } };
    saveProgress(progress, store);
    expect(loadProgress(store)).toEqual(progress);
  });
});
