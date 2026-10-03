// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import { createGameState } from '../app/js/chess/state.ts';
import { fromAlgebraic, toAlgebraic, type Square } from '../app/js/chess/types.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { SAME_LEVEL_CP } from '../app/js/chess/engine/same-level.ts';
import { createGridMirror, type GridMirror } from '../app/js/ui/grid-mirror.ts';

const sq = (name: string): Square => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

let mirror: GridMirror | null = null;
afterEach(() => { mirror?.destroy(); mirror = null; document.body.replaceChildren(); });

function build(fen?: string, locale: 'pt' | 'en' | 'es' = 'pt') {
  const rules = createRules(fen);
  const state = createGameState({ rules, opponent: false });
  const onActivate = vi.fn((square: Square) => {
    state.activate(square);
    mirror?.refresh();
  });
  mirror = createGridMirror({
    doc: document, i18n: createI18n(locale), rules: () => rules, state: () => state, onActivate,
  });
  document.body.appendChild(mirror.root);
  return { rules, state, onActivate, mirror };
}

const cellAt = (name: string): HTMLButtonElement => {
  const el = document.querySelector<HTMLButtonElement>(`[data-square="${name}"]`);
  if (!el) throw new Error(`no cell ${name}`);
  return el;
};

const labelOf = (name: string): string => cellAt(name).getAttribute('aria-label') ?? '';

describe('[Structure] a real grid, of real buttons', () => {
  it('lays out 64 cells in 8 rows', () => {
    build();
    expect(document.querySelectorAll('[role="gridcell"]')).toHaveLength(64);
    expect(document.querySelectorAll('[role="row"]')).toHaveLength(8);
  });

  it('reads top-left to bottom-right, the way a diagram is printed', () => {
    build();
    const order = [...document.querySelectorAll<HTMLElement>('[role="gridcell"]')]
      .map((c) => c.dataset.square);
    expect(order[0]).toBe('a8');
    expect(order[7]).toBe('h8');
    expect(order[63]).toBe('h1');
  });

  it('keeps the cells as real buttons, so the platform supplies Enter and Space', () => {
    build();
    expect(cellAt('e2').tagName).toBe('BUTTON');
    expect(cellAt('e2').type).toBe('button');
  });

  it('announces itself, with how to use it', () => {
    const { mirror: m } = build();
    const label = m.root.getAttribute('aria-label') ?? '';
    expect(label).toContain('Tabuleiro de xadrez');
    expect(label).toContain('Setas');
  });
});

describe('[Labels] every square says where it is and what is on it', () => {
  it('names the piece standing there', () => {
    build();
    expect(labelOf('a1')).toBe('a1, torre branca');
    expect(labelOf('b8')).toBe('b8, cavalo preto');
  });

  it('says an empty square is empty', () => {
    build();
    expect(labelOf('d4')).toBe('d4, vazia');
  });

  it('follows the interface language', () => {
    build(undefined, 'en');
    expect(labelOf('a1')).toBe('a1, white rook');
    expect(labelOf('d4')).toBe('d4, empty');
  });

  it('re-labels after a move', () => {
    const { onActivate } = build();
    onActivate(sq('e2'));
    onActivate(sq('e4'));
    expect(labelOf('e2')).toBe('e2, vazia');
    expect(labelOf('e4')).toBe('e4, peão branco');
  });

  it('marks a legal destination WITHOUT inflecting on the piece', () => {
    const { onActivate } = build();
    onActivate(sq('e2'));
    expect(labelOf('e4')).toContain('lance possível');
    expect(labelOf('e3')).toContain('lance possível');
    expect(labelOf('d4')).not.toContain('lance possível');
  });

  it('tells a capture apart from a quiet move', () => {
    // White knight e4 can take the black pawn on d6 or step to a quiet square.
    const { onActivate } = build('4k3/8/3p4/8/4N3/8/8/4K3 w - - 0 1');
    onActivate(sq('e4'));
    expect(labelOf('d6')).toContain('captura possível');
    expect(labelOf('f6')).toContain('lance possível');
  });

  it('says which king is in check', () => {
    // White rook h7, black king h8, black to move.
    build('7k/7R/8/8/8/8/8/4K3 b - - 0 1');
    expect(labelOf('h8')).toContain('em xeque');
    expect(labelOf('a8')).not.toContain('em xeque');
  });
});

describe('[Selection] state travels as ARIA, not as a word', () => {
  it('marks the held square with aria-selected', () => {
    const { onActivate } = build();
    expect(cellAt('e2').getAttribute('aria-selected')).toBe('false');
    onActivate(sq('e2'));
    expect(cellAt('e2').getAttribute('aria-selected')).toBe('true');
    // The reader says "selected" in the user's own language; the label stays about the board.
    expect(labelOf('e2')).toBe('e2, peão branco');
  });

  it('clears when the piece is put down', () => {
    const { onActivate } = build();
    onActivate(sq('e2'));
    onActivate(sq('e2'));
    expect(cellAt('e2').getAttribute('aria-selected')).toBe('false');
  });
});

describe('[Roving tabindex] one stop, not sixty-four', () => {
  it('puts exactly one cell in the tab order', () => {
    build();
    const focusable = [...document.querySelectorAll<HTMLElement>('[role="gridcell"]')]
      .filter((c) => c.tabIndex === 0);
    expect(focusable).toHaveLength(1);
  });

  it('moves that single stop as the cursor moves', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('c3'));
    expect(cellAt('c3').tabIndex).toBe(0);
    expect(cellAt('e2').tabIndex).toBe(-1);
    expect([...document.querySelectorAll<HTMLElement>('[role="gridcell"]')]
      .filter((c) => c.tabIndex === 0)).toHaveLength(1);
  });

  it('survives a refresh', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('h5'));
    m.refresh();
    expect(cellAt('h5').tabIndex).toBe(0);
  });
});

describe('[Keyboard] the arrows walk the board', () => {
  const press = (key: string, init: KeyboardEventInit = {}) => {
    cellAt(toAlgebraic(mirror!.cursor()))
      .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  };

  it('moves one square at a time, in board terms', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('d4'));
    press('ArrowRight');
    expect(toAlgebraic(m.cursor())).toBe('e4');
    press('ArrowUp');
    expect(toAlgebraic(m.cursor())).toBe('e5');
    press('ArrowLeft');
    expect(toAlgebraic(m.cursor())).toBe('d5');
    press('ArrowDown');
    expect(toAlgebraic(m.cursor())).toBe('d4');
  });

  it('stops at the edge instead of wrapping to the far file', () => {
    // A board has corners. Being teleported across it is disorienting for exactly the person
    // this grid exists for.
    const { mirror: m } = build();
    m.focusSquare(sq('a1'));
    press('ArrowLeft');
    press('ArrowDown');
    expect(toAlgebraic(m.cursor())).toBe('a1');

    m.focusSquare(sq('h8'));
    press('ArrowRight');
    press('ArrowUp');
    expect(toAlgebraic(m.cursor())).toBe('h8');
  });

  it('Home and End jump along the rank', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('d4'));
    press('End');
    expect(toAlgebraic(m.cursor())).toBe('h4');
    press('Home');
    expect(toAlgebraic(m.cursor())).toBe('a4');
  });

  it('Ctrl+Home and Ctrl+End jump to the corners', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('d4'));
    press('Home', { ctrlKey: true });
    expect(toAlgebraic(m.cursor())).toBe('a8');
    press('End', { ctrlKey: true });
    expect(toAlgebraic(m.cursor())).toBe('h1');
  });

  it('actually moves DOM focus, not just a variable', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('d4'));
    expect(document.activeElement).toBe(cellAt('d4'));
    press('ArrowRight');
    expect(document.activeElement).toBe(cellAt('e4'));
  });
});

/*
 * ========================= THE KEY-FREE API, FOR THE ONCOMMAND PATH =========================
 * ⚠️ `moveCursor` and `activate` are the entries the shell's `onCommand` handler (Wave 3) reaches
 * — virtual commands arrive with an action NAME, not a KeyboardEvent, so these are tested with
 * neither event dispatch nor `press(...)`. The pair also powers `handleKey`'s body: an arrow key
 * through the DOM goes through moveCursor, and action2 through activate. These tests pin the
 * key-free contract so a refactor that moves the body elsewhere cannot silently change the
 * cursor's bounds, the clamp, or the activation path.
 */
describe('[Command API] moveCursor and activate work without an event', () => {
  it('moveCursor(left/right/up/down) returns true and shifts the cursor', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('d4'));
    expect(m.moveCursor('right')).toBe(true);
    expect(toAlgebraic(m.cursor())).toBe('e4');
    expect(m.moveCursor('up')).toBe(true);
    expect(toAlgebraic(m.cursor())).toBe('e5');
    expect(m.moveCursor('left')).toBe(true);
    expect(toAlgebraic(m.cursor())).toBe('d5');
    expect(m.moveCursor('down')).toBe(true);
    expect(toAlgebraic(m.cursor())).toBe('d4');
  });

  it('moveCursor clamps at the board edges, not wraps', () => {
    // Same clamp rule as `handleKey` — a board has corners, and a player who runs into one
    // should feel the edge rather than being teleported to the far file.
    const { mirror: m } = build();
    m.focusSquare(sq('a1'));
    expect(m.moveCursor('left')).toBe(true);
    expect(toAlgebraic(m.cursor()), 'cannot go further left').toBe('a1');
    expect(m.moveCursor('down')).toBe(true);
    expect(toAlgebraic(m.cursor()), 'cannot go further down').toBe('a1');
    m.focusSquare(sq('h8'));
    expect(m.moveCursor('right')).toBe(true);
    expect(toAlgebraic(m.cursor()), 'cannot go further right').toBe('h8');
    expect(m.moveCursor('up')).toBe(true);
    expect(toAlgebraic(m.cursor()), 'cannot go further up').toBe('h8');
  });

  it('moveCursor(leftShoulder/rightShoulder) jumps to the file edge on the current rank', () => {
    // Wave 3 Step 3: Home and End became `leftShoulder` and `rightShoulder` in chess's
    // keyboardMapping, so a child who remaps the pad can jump the rank from any transport.
    const { mirror: m } = build();
    m.focusSquare(sq('d4'));
    expect(m.moveCursor('leftShoulder')).toBe(true);
    expect(toAlgebraic(m.cursor())).toBe('a4');
    m.focusSquare(sq('d4'));
    expect(m.moveCursor('rightShoulder')).toBe(true);
    expect(toAlgebraic(m.cursor())).toBe('h4');
  });

  it('moveCursor returns false and does nothing for an unknown action', () => {
    const { mirror: m } = build();
    m.focusSquare(sq('d4'));
    const before = m.cursor();
    expect(m.moveCursor('action1')).toBe(false);
    expect(m.moveCursor('')).toBe(false);
    expect(m.moveCursor('nonsense')).toBe(false);
    expect(m.cursor(), 'cursor unchanged for unknown actions').toEqual(before);
  });

  it('activate() calls onActivate with the current cursor square', () => {
    const { onActivate, mirror: m } = build();
    m.focusSquare(sq('e2'));
    m.activate();
    expect(onActivate).toHaveBeenCalledWith(sq('e2'));
    // Activating again from the same cursor should re-fire; `handleKey` already does this through
    // action2, so the key-free path has to behave the same.
    m.activate();
    expect(onActivate).toHaveBeenCalledTimes(2);
  });
});

describe('[Activation] the keyboard uses the same door as the pointer', () => {
  it('a click on a cell activates that square', () => {
    const { onActivate } = build();
    cellAt('g1').click();
    expect(onActivate).toHaveBeenCalledWith(sq('g1'));
  });

  it('Enter on a focused cell activates it, because it is a real button', () => {
    const { onActivate, mirror: m } = build();
    m.focusSquare(sq('b1'));
    // A real <button> turns Enter into a click at the platform level. Simulating the click is
    // simulating what the platform does; the point of the test is that nothing here re-implements it.
    (document.activeElement as HTMLButtonElement).click();
    expect(onActivate).toHaveBeenCalledWith(sq('b1'));
  });

  it('plays a whole move through the grid alone', () => {
    const { onActivate, rules } = build();
    cellAt('e2').click();
    cellAt('e4').click();
    expect(onActivate).toHaveBeenCalledTimes(2);
    expect(rules.history().map((m) => m.san)).toEqual(['e4']);
  });

  it('reports the cursor to whoever draws it', () => {
    const rules = createRules();
    const state = createGameState({ rules, opponent: false });
    const onCursor = vi.fn();
    mirror = createGridMirror({
      doc: document, i18n: createI18n('pt'), rules: () => rules, state: () => state, onActivate: () => {}, onCursor,
    });
    document.body.appendChild(mirror.root);
    mirror.focusSquare(sq('f6'));
    expect(onCursor).toHaveBeenCalledWith(sq('f6'));
  });
});

// The hint marks are the VISIBLE board's — in the projected view the Zdog markers carry them, and
// the screen-reader grid says the move in words. So these are built with the drawing turned on.
function shown() {
  const rules = createRules();
  const state = createGameState({ rules, opponent: false });
  mirror = createGridMirror({
    doc: document, i18n: createI18n('pt'), rules: () => rules, state: () => state, onActivate: () => {}, visible: true,
  });
  document.body.appendChild(mirror.root);
  return mirror;
}

describe('[GridMirror] a hint is an arrow', () => {
  /** The drawn paths, in order. Two per move: a dark halo under a coloured line. */
  const arrows = (): SVGPathElement[] =>
    [...document.querySelectorAll<SVGPathElement>('.hint-arrows path')];

  it('draws one arrow per suggested move', () => {
    const mirror = shown();
    mirror.setHints([{ from: sq('g1'), to: sq('f3'), behind: 0 }, { from: sq('e2'), to: sq('e4'), behind: 0 }]);
    expect(arrows()).toHaveLength(4);
  });

  it('points from the piece to the square, not the other way round', () => {
    // ⚠️ The direction IS the advice. An arrow drawn tail-for-head would be a different, wrong
    // suggestion rendered perfectly, which no type and no colour test would ever catch.
    const mirror = shown();
    mirror.setHints([{ from: sq('a1'), to: sq('a8'), behind: 0 }]);
    const d = arrows()[0].getAttribute('d') ?? '';
    const [firstY, secondY] = [...d.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
    // a1 is the bottom row and a8 the top, and SVG y grows downwards.
    expect(firstY).toBeGreaterThan(secondY);
  });

  it('draws each arrow twice, the halo under the colour', () => {
    // No hue clears 3:1 against every square this game can draw — measured, five triples tried.
    // So the boundary is the dark halo's, and losing it would be a silent contrast regression.
    const mirror = shown();
    mirror.setHints([{ from: sq('e2'), to: sq('e4'), behind: 0 }]);
    const [halo, line] = arrows();
    expect(halo).toBeDefined();
    expect(Number(halo.getAttribute('stroke-width')))
      .toBeGreaterThan(Number(line.getAttribute('stroke-width')));
    expect(halo.getAttribute('stroke')).not.toBe(line.getAttribute('stroke'));
  });

  it('ramps colour and weight by how far behind the best a move is', () => {
    // ⚠️ Drawn BEST LAST so it sits on top, which is why the best move's pair is at the end.
    const mirror = shown();
    mirror.setHints([
      { from: sq('e2'), to: sq('e4'), behind: 0 },
      { from: sq('d2'), to: sq('d4'), behind: SAME_LEVEL_CP },
    ]);
    const [, worst, , best] = arrows();
    expect(best.getAttribute('stroke')).not.toBe(worst.getAttribute('stroke'));
    expect(Number(best.getAttribute('stroke-width')))
      .toBeGreaterThan(Number(worst.getAttribute('stroke-width')));
  });

  it('offers as many as fall inside the margin, with no rank cap', () => {
    const mirror = shown();
    mirror.setHints([
      { from: sq('e2'), to: sq('e4'), behind: 0 },
      { from: sq('d2'), to: sq('d4'), behind: 6 },
      { from: sq('g1'), to: sq('f3'), behind: 12 },
      { from: sq('b1'), to: sq('c3'), behind: 18 },
      { from: sq('c2'), to: sq('c4'), behind: 24 },
    ]);
    expect(arrows()).toHaveLength(10);
  });

  it('clears every arrow, not only the ones it drew last', () => {
    const mirror = shown();
    mirror.setHints([{ from: sq('g1'), to: sq('f3'), behind: 0 }, { from: sq('e2'), to: sq('e4'), behind: 0 }]);
    mirror.setHints([]);
    expect(arrows()).toHaveLength(0);
  });

  it('never takes a click meant for the square underneath', () => {
    // 2.1.1 and 2.5.7: the arrow is a picture of something already said in words. If it could
    // swallow a pointer event, a hint would make part of the board unplayable.
    const mirror = shown();
    mirror.setHints([{ from: sq('e2'), to: sq('e4'), behind: 0 }]);
    const layer = document.querySelector('.hint-arrows');
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('[Lesson] "look here" is a shape AND a word, never a colour', () => {
  /*
   * ⚠️ `visible: true`, AND THAT IS NOT BOILERPLATE. `refresh()` writes every visual attribute
   * behind an `if (!visible) continue`, because on the projected and solid pages this grid is the
   * hidden mirror and has no pixels to spend. Written against the hidden one, three of the tests
   * below failed while the LABEL test passed — which is the split working exactly as designed: the
   * word is the accessibility channel and belongs to both, the shape is the visual half and
   * belongs only to the board a person is looking at.
   */
  const board = (fen?: string, locale: 'pt' | 'en' | 'es' = 'pt') => {
    const rules = createRules(fen);
    const state = createGameState({ rules, opponent: false });
    mirror = createGridMirror({
      doc: document, i18n: createI18n(locale), rules: () => rules, state: () => state, visible: true, onActivate: () => {},
    });
    document.body.appendChild(mirror.root);
    return { rules, state, mirror };
  };
  /*
   * ========================= ⚠️ THE 1.4.1 CLAIM, ASSERTED RATHER THAN DESCRIBED =========================
   * The rule this file already lives by is literal: never colour alone — a legal move is a marked
   * cell AND a named one. A teaching highlight that existed only as an amber square would break
   * that in the one mode whose entire purpose is to teach, and it would be nothing at all to the
   * reader who needs the lesson read to them.
   */
  it('marks the squares it is told, and only those', () => {
    const { mirror: m } = board();
    m.setTaught([{ square: sq('e4'), mark: 'look' }, { square: sq('d5'), mark: 'look' }]);
    expect(cellAt('e4').dataset.lesson).toBe('look');
    expect(cellAt('d5').dataset.lesson).toBe('look');
    expect(cellAt('e5').dataset.lesson).toBeUndefined();
  });

  it('says so in the label, in the reader\'s own language', () => {
    const { mirror: m } = build(undefined, 'en');
    m.setTaught([{ square: sq('e4'), mark: 'look' }]);
    expect(labelOf('e4')).toContain('the lesson points here');
    expect(labelOf('e5')).not.toContain('the lesson points here');
  });

  it('⚠️ says BOTH when a square is a lesson mark and a legal move at once', () => {
    /*
     * THE CASE THE SEPARATE ATTRIBUTE EXISTS FOR. A child picks the taught piece up while the
     * square they were told to look at is still lit, so the two coincide by design. One attribute
     * holding one value would have made the game silence the lesson, or the lesson silence the
     * game — and a square that is "look here" and "you can move here" is more useful saying both.
     */
    const { state, mirror: m } = board();
    m.setTaught([{ square: sq('e4'), mark: 'look' }]);
    state.activate(sq('e2'));
    m.refresh();
    expect(cellAt('e4').dataset.lesson).toBe('look');
    expect(cellAt('e4').dataset.mark).toBe('move');
    const label = labelOf('e4');
    expect(label).toContain('lance possível');
    expect(label).toContain('nesta casa');
  });

  it('replaces the set rather than adding to it, and an empty set clears it', () => {
    const { mirror: m } = board();
    m.setTaught([{ square: sq('e4'), mark: 'look' }]);
    m.setTaught([{ square: sq('d5'), mark: 'look' }]);
    expect(cellAt('e4').dataset.lesson).toBeUndefined();
    expect(cellAt('d5').dataset.lesson).toBe('look');
    m.setTaught([]);
    expect(cellAt('d5').dataset.lesson).toBeUndefined();
    expect(labelOf('d5')).not.toContain('nesta casa');
  });

  it('survives a refresh driven by the game, because it is not derived from the game', () => {
    // Selection, legal targets and check are read back out of `state` on every refresh, so they
    // are right by construction. "Look at this square" is not a fact about the position at all —
    // nothing in `chess/` knows it — so it has to be remembered until it is replaced.
    const { state, mirror: m } = board();
    m.setTaught([{ square: sq('e4'), mark: 'look' }]);
    state.activate(sq('g1'));
    m.refresh();
    expect(cellAt('e4').dataset.lesson).toBe('look');
  });
});

describe('[Actions] confirm is an ACTION, not a button press', () => {
  /*
   * ========================= ⚠️ WHY THIS IS HANDLED AT ALL =========================
   * A cell is a real `<button>`, so Enter and Space already activate it. Left at that, `action2`
   * bound to a gamepad face button — or to any key that is not Enter or Space — would do nothing
   * on the board while working everywhere else in the game. The whole point of the engine's
   * intent layer is that the binding is the player's to change.
   */
  function withActions(fen?: string) {
    const rules = createRules(fen);
    const state = createGameState({ rules, opponent: false });
    const onActivate = vi.fn((square: Square) => { state.activate(square); mirror?.refresh(); });
    mirror = createGridMirror({
      doc: document,
      i18n: createI18n('pt'),
      rules: () => rules,
      state: () => state,
      onActivate,
      // The engine's SOLO defaults, which is what a player has before they remap anything.
      resolveAction: (code) => ({
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        KeyJ: 'action2', Space: 'action2',
      }[code] ?? null),
    });
    document.body.appendChild(mirror.root);
    return { rules, state, onActivate, mirror };
  }

  const key = (code: string, target: Element): void => {
    target.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
  };

  it('activates the square under the cursor', () => {
    const { onActivate } = withActions();
    key('KeyJ', cellAt('e2'));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate.mock.calls[0]![0]).toEqual(sq('e2'));
  });

  it('⚠️ activates ONCE on Space, not twice', () => {
    /*
     * THE FAULT THIS TEST EXISTS FOR. The engine binds `action2` to KeyJ AND Space, and Space also
     * activates a `<button>` natively. Without `preventDefault` every Space would go through both
     * paths — on a lesson's `mark` step that is a square touched twice, which the set forgives; on
     * a `play` step it is a move, and then a second move.
     */
    const { onActivate } = withActions();
    const cell = cellAt('e2');
    const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
    cell.dispatchEvent(event);
    expect(onActivate).toHaveBeenCalledTimes(1);
    // The native click is suppressed, which is what keeps the second one from arriving.
    expect(event.defaultPrevented).toBe(true);
  });

  it('follows the cursor rather than the focused element', () => {
    // The two agree in practice, and the cursor is the one that is true: it is what the board
    // draws and what the 2.5D and 3D pages read.
    const { onActivate } = withActions();
    key('ArrowUp', cellAt('e2'));
    key('KeyJ', document.activeElement!);
    expect(onActivate.mock.calls[0]![0]).toEqual(sq('e3'));
  });

  it('leaves Enter to the button, which has always worked', () => {
    // Enter is not bound to `action2` in the engine's defaults, so it reaches the board the way it
    // always has — through the element. Asserted so that adding it to the table later is a
    // decision rather than an accident that starts double-activating.
    const { onActivate } = withActions();
    cellAt('e2').click();
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});
