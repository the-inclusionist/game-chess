// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHAT THIS PROVES =========================
// Professor II, asked for by the Dev on 2026-10-04: a teacher that shows nothing and instead
// REFUSES any move that is not one of the moves Professor I would have drawn an arrow for. "Um
// apito de treinador é tocado e a peça volta pra casa inicial, permitindo que o jogador escolha
// outra jogada."
//
// ⚠️ THE TWO HALVES ARE TESTED SEPARATELY BECAUSE THEY FAIL SEPARATELY. "The move was refused" is
// a fact about the state machine; "and nothing was given away" is a fact about the board and the
// live region, and a mode that refused correctly while drawing the answer would pass the first and
// be useless.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import { createGameState } from '../app/js/chess/state.ts';
import { createEarcons, WHISTLE } from '../app/js/ui/earcons.ts';
import '../app/css/board.css';
import { createGameShell } from '../app/js/boot/standalone.ts';
import { clear, saveSettings } from '../app/js/chess/session.ts';
import type { BoardView, ViewContext } from '../app/js/boot/view.ts';
import type { EngineMove } from '../app/js/chess/engine/client.ts';
import type { Square } from '../app/js/chess/types.ts';

const at = (name: string): Square => ({
  x: 'abcdefgh'.indexOf(name[0]!), y: 8 - Number(name[1]),
});
const same = (a: Square, b: Square): boolean => a.x === b.x && a.y === b.y;

describe('[Professor II] the state machine sends a legal move back', () => {
  /** A board where only e2–e4 is acceptable to the teacher. */
  const onlyE4 = () => createGameState({
    rules: createRules(),
    opponent: false,
    allowMove: (from, to) => same(from, at('e2')) && same(to, at('e4')),
  });

  it('⚠️ refuses a legal move the teacher does not accept, and plays nothing', () => {
    const game = onlyE4();
    game.activate(at('d2'));
    const result = game.activate(at('d4'));

    expect(result).toEqual({ kind: 'refused', from: at('d2'), to: at('d4') });
    expect(game.rules.pieceAt(at('d2'))?.type, 'the pawn never left').toBe('p');
    expect(game.rules.pieceAt(at('d4')), 'and never arrived').toBeNull();
    expect(game.rules.history(), 'nothing on the score sheet').toHaveLength(0);
  });

  it('⚠️ leaves the piece in hand, which is the whole point of the mode', () => {
    /*
     * "permitindo que o jogador escolha outra jogada" — a refusal that also put the piece down
     * would make the child pick it up again to try a second square, and the mode would be a
     * punishment rather than a correction.
     */
    const game = onlyE4();
    game.activate(at('d2'));
    game.activate(at('d4'));

    expect(game.selection(), 'still held').toEqual(at('d2'));
    expect(game.legalTargets().length, 'and its squares still lit').toBeGreaterThan(0);
    expect(game.phase()).toBe('selected');
  });

  it('lets the accepted move through untouched', () => {
    const game = onlyE4();
    game.activate(at('e2'));
    expect(game.activate(at('e4')).kind).toBe('moved');
    expect(game.rules.pieceAt(at('e4'))?.type).toBe('p');
  });

  it('⚠️ is never asked about a move the RULES already refuse', () => {
    /*
     * The two answers want opposite things: an illegal move is a misunderstanding of chess and
     * deserves the rules explained; a refused one is a legal move that is simply not the best. A
     * filter in front of the legality check would turn "that piece does not move that way" into
     * "try again", and tell the child the wrong thing about their own mistake.
     */
    const asked: string[] = [];
    const game = createGameState({
      rules: createRules(),
      opponent: false,
      allowMove: (from, to) => { asked.push(`${from.x}${from.y}-${to.x}${to.y}`); return false; },
    });
    game.activate(at('e2'));
    expect(game.activate(at('e5')).kind, 'a pawn cannot go three squares').toBe('illegal');
    expect(asked, 'the teacher was not consulted').toEqual([]);
  });

  it('judges the second order of operations too, not only piece-first', () => {
    // A destination chosen before the piece reaches `play` down a different branch. A gate on one
    // of the two is a gate a player walks round without knowing there was one.
    const game = onlyE4();
    game.activate(at('d4'));                       // aim at it
    const result = game.activate(at('d2'));        // then the pawn that could go there
    expect(result.kind).toBe('refused');
    expect(game.rules.pieceAt(at('d2'))?.type, 'the pawn stayed').toBe('p');
  });

  it('has no opinion at all when no teacher is set', () => {
    const game = createGameState({ rules: createRules(), opponent: false });
    game.activate(at('d2'));
    expect(game.activate(at('d4')).kind).toBe('moved');
  });
});

describe('[Whistle] the sound is half the signal and the caption is the other half', () => {
  let said: string[] = [];

  beforeEach(() => { said = []; });
  afterEach(() => { said = []; });

  it('⚠️ captions the whistle even where there is no audio to play it with', () => {
    /*
     * A deaf child playing Professor II would otherwise meet a move that silently refuses to
     * happen, which is indistinguishable from a broken board. The caption goes out BEFORE the
     * sound is attempted, so a page with no `AudioContext` — a test, a locked-down browser, a
     * device with sound off — still says what happened.
     */
    const earcons = createEarcons({ caption: (t) => said.push(t), audio: () => null });
    earcons.play(WHISTLE, 'sfx.whistle');
    expect(said).toEqual(['sfx.whistle']);
    earcons.destroy();
  });

  it('is a FIGURE and not one long note, because a held tone reads as an error', () => {
    // Two short rising bursts: a referee saying "that one does not count, go again", rather than
    // an alarm saying "something is broken, stop". The shape is the meaning.
    expect(WHISTLE.length, 'two bursts').toBe(2);
    for (const part of WHISTLE) {
      expect(part.f2 ?? 0, 'each one rises').toBeGreaterThan(part.f);
      expect(part.d, 'and is short').toBeLessThan(0.2);
    }
  });

  it('survives a page with no AudioContext at all, rather than throwing into a click', () => {
    const earcons = createEarcons({ audio: () => null });
    expect(() => earcons.play(WHISTLE, 'sfx.whistle')).not.toThrow();
    earcons.destroy();
  });
});


describe('[Professor II] through the whole shell, with an engine that answers slowly', () => {
  /*
   * ========================= WHY THIS ONE DRIVES THE SHELL =========================
   * The state machine's refusal is pinned above. This pins the thing the state machine cannot see:
   * that the SET IS IN HAND by the time the filter is consulted.
   *
   * ⚠️ AND IT EXISTS BECAUSE THE FIRST VERSION WAS WRONG. `askHint` returned early while a request
   * was in flight — right for the caller that only wants arrows eventually, wrong for the one that
   * has to wait — so Professor II resolved instantly, found no set for the position, and let the
   * move through. Measured by hand on the running build, with `a2–a3` sailing past a teacher that
   * had refused `h2–h4` a minute earlier. A timing hole closes for good only with a test that can
   * hold the engine still.
   */
  let release: ((hint: EngineMove | null) => void) | null = null;
  let asked = 0;

  function slowEngine() {
    return () => ({
      // ⚠️ `ready` TOO: the shell waits on it before the doors open, and a fake without it is a
      // fake of a different interface — the compiler says so, which is the point of not casting.
      ready: () => Promise.resolve({ minElo: 1320, maxElo: 3190 }),
      requestMove: () => new Promise<EngineMove | null>(() => {}),
      requestHint: () => {
        asked += 1;
        return new Promise<EngineMove | null>((resolve) => { release = resolve; });
      },
      requestReview: () => new Promise<EngineMove | null>(() => {}),
      setStrength: () => {},
      cancel: () => {},
      destroy: () => {},
    });
  }

  const fakeView = (ctx: ViewContext): BoardView => {
    ctx.region.appendChild(ctx.mirror.root);
    return {
      hudControls: { coordinates: () => false, onCoordinates: () => {} },
      applyTheme: () => {}, drawPosition: () => {}, drawMarks: () => {}, carry: () => {},
      travel: () => Promise.resolve(), relayout: () => {}, destroy: () => {},
    };
  };

  function board(): void {
    document.body.innerHTML = `
      <div id="stage-wrap" style="width: 640px; height: 360px">
        <div id="game-region">
          <div id="chess-board" tabindex="0"></div>
          <div id="side-column"></div>
        </div>
        <div class="pause-icons" id="title-icons" role="group" aria-label="a"></div>
      </div>
      <div id="sr-status" role="status" aria-live="polite"></div>
      <div id="sr-alert" role="alert" aria-live="assertive"></div>
      <svg id="cvd" class="sr-only" aria-hidden="true"></svg>`;
  }

  const hint = (ties: readonly [string, string][]): EngineMove => ({
    move: { from: at(ties[0][0]), to: at(ties[0][1]), promotion: null },
    score: 20, nodes: 1, depth: 8,
    ties: ties.map(([f, t]) => ({ move: { from: at(f), to: at(t), promotion: null }, behind: 0 })),
    lines: [],
  });

  const label = (n: string): string =>
    document.querySelector(`[data-square="${n}"]`)!.getAttribute('aria-label')!;

  beforeEach(() => { release = null; asked = 0; board(); clear(); saveSettings({ mode: 'w' }); });
  afterEach(() => { document.body.replaceChildren(); clear(); });

  const settle = (): Promise<void> => new Promise((r) => { setTimeout(r, 0); });

  it('⚠️ holds the move until the set arrives, rather than letting it through', async () => {
    const shell = createGameShell({
      host: document, kind: '2d', view: fakeView, visibleMirror: true,
      makeOpponent: slowEngine(), debugName: '__profII', contrastTheme: 'contrast-flat',
    });

    (document.getElementById('hud-hint-silent') as HTMLButtonElement).click();
    await settle();

    // The player moves while the engine is still thinking. a2–a3 is legal and not in the set.
    shell.activate(at('a2'));
    shell.activate(at('a3'));
    await settle();
    expect(label('a3'), 'nothing happened while the answer was in the air').toContain('vazia');

    release!(hint([['e2', 'e4'], ['d2', 'd4']]));
    await settle();
    await settle();

    expect(label('a2'), 'the pawn stayed').toContain('peão branco');
    expect(label('a3'), 'and never arrived').toContain('vazia');
    expect(shell.game().selection(), 'still in hand, ready for another try').not.toBeNull();
  });

  it('⚠️ the two switches are INDEPENDENT: both can be on at once', async () => {
    /*
     * The Dev, 2026-10-04: "torne-os independentes, ou seja, uma pessoa poderá ter setas ligadas e
     * protetor de lances ligado ao mesmo tempo." They were one three-valued setting for a few
     * hours, on my reading that the second existed to withhold what the first showed. The names he
     * chose are what settle it — «Setas» is a DISPLAY, «Protetor de Lances» is a RULE — and with
     * both on the arrows say exactly what the guard will accept.
     */
    createGameShell({
      host: document, kind: '2d', view: fakeView, visibleMirror: true,
      makeOpponent: slowEngine(), debugName: '__both', contrastTheme: 'contrast-flat',
    });
    const setas = document.getElementById('hud-hint') as HTMLButtonElement;
    const protetor = document.getElementById('hud-hint-silent') as HTMLButtonElement;

    setas.click();
    await settle();
    protetor.click();
    await settle();

    expect(setas.getAttribute('aria-pressed'), 'arrows stayed on').toBe('true');
    expect(protetor.getAttribute('aria-pressed'), 'and the guard went on beside it').toBe('true');

    // And each turns off on its own, without touching the other.
    setas.click();
    await settle();
    expect(setas.getAttribute('aria-pressed')).toBe('false');
    expect(protetor.getAttribute('aria-pressed'), 'the guard is not collateral').toBe('true');
  });

  it('plays the move the set DOES contain, once the set is there', async () => {
    const shell = createGameShell({
      host: document, kind: '2d', view: fakeView, visibleMirror: true,
      makeOpponent: slowEngine(), debugName: '__profII2', contrastTheme: 'contrast-flat',
    });
    (document.getElementById('hud-hint-silent') as HTMLButtonElement).click();
    await settle();

    shell.activate(at('e2'));
    shell.activate(at('e4'));
    release!(hint([['e2', 'e4']]));
    await settle();
    await settle();

    expect(label('e4'), 'the accepted move went through').toContain('peão branco');
  });

  it('⚠️ asks ONCE however many callers are waiting on the same answer', async () => {
    // Two searches for one position is waste the engine cannot afford on school hardware, and the
    // early return that prevented it is exactly what used to make the wait a no-op.
    const shell = createGameShell({
      host: document, kind: '2d', view: fakeView, visibleMirror: true,
      makeOpponent: slowEngine(), debugName: '__profII3', contrastTheme: 'contrast-flat',
    });
    (document.getElementById('hud-hint-silent') as HTMLButtonElement).click();
    await settle();
    shell.activate(at('a2'));
    shell.activate(at('a3'));
    await settle();
    expect(asked, 'one flight, several passengers').toBe(1);
  });
});
