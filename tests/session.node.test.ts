// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import {
  clear, describe as describeGame, load, loadSettings, restore, resume, save, saveSettings,
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
    saveSettings({ theme: 'jose2', set: 'math', coordinates: false, side: 'b' }, store);
    expect(loadSettings(store)).toEqual({
      theme: 'jose2', set: 'math', coordinates: false, side: 'b',
    });
  });

  it('drops anything it does not recognise instead of handing it on', () => {
    // A stale or hand-edited entry must not reach the renderer as a colour or a side.
    const store = fakeStore();
    store.setItem('incl_chess_view', JSON.stringify({ theme: 7, side: 'purple', coordinates: 'yes' }));
    expect(loadSettings(store)).toEqual({});
  });

  it('is separate from the game, so a new game keeps the settings', () => {
    const store = fakeStore();
    saveSettings({ theme: 'xboard', side: 'b' }, store);
    save(opened(), store);
    clear(store);
    expect(load(store)).toBeNull();
    expect(loadSettings(store)).toEqual({ theme: 'xboard', side: 'b' });
  });
});
