// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= A WHOLE LESSON, THROUGH THE REAL PARTS =========================
// Everything under this has its own test and passes it. What has had no test until now is the claim
// that they FIT: that a lesson taken through the shell's single door — `activate`, the same door a
// pointer and a keyboard both use — advances, corrects itself, and finishes.
//
// ⚠️ NOTHING HERE IS MOCKED EXCEPT THE DRAWING. Real rules, real state machine, real tutor, real
// panel, real grid mirror, real storage. The view is the recording fake the shell's own test uses,
// because the browser pane is not visible under vitest and a real animation never settles there.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGameShell, type GameShell } from '../app/js/boot/game-shell.ts';
import { createLessonMode, type LessonMode } from '../app/js/boot/lesson-mode.ts';
import { createLessonPanel } from '../app/js/ui/lesson-panel.ts';
import type { BoardView, ViewContext } from '../app/js/boot/view.ts';
import { clear, loadProgress, saveSettings } from '../app/js/chess/session.ts';
import { fromAlgebraic, type Square } from '../app/js/chess/types.ts';

const at = (name: string): Square => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

function fakeView(ctx: ViewContext): BoardView {
  ctx.region.appendChild(ctx.mirror.root);
  return {
    hudControls: { coordinates: () => false, onCoordinates: () => {} },
    applyTheme: () => {},
    drawPosition: () => {},
    drawMarks: () => {},
    travel: () => Promise.resolve(),
    relayout: () => {},
    destroy: () => {},
  };
}

let shell: GameShell;
let mode: LessonMode;
let said: string[];
let left: number;

beforeEach(() => {
  document.body.innerHTML = `
    <div id="stage-wrap" style="width: 640px; height: 360px">
      <div id="game-region" tabindex="0"></div>
    </div>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd" aria-hidden="true"></svg>
  `;
  clear();
  localStorage.removeItem('incl_chess_learned');
  saveSettings({ mode: 'two' });
  said = [];
  left = 0;
  shell = createGameShell({
    host: document, kind: '2d', view: fakeView, visibleMirror: true,
    debugName: '__lessonTest', contrastTheme: 'contrast-flat',
  });
  const panel = createLessonPanel({
    doc: document,
    i18n: shell.i18n,
    onChoose: (option) => { mode.chose(option); },
    onLeave: () => { mode.stop(); },
  });
  document.body.appendChild(panel.root);
  mode = createLessonMode({
    shell, panel, say: (text) => { said.push(text); }, onLeave: () => { left += 1; },
  });
});

afterEach(() => {
  document.body.replaceChildren();
  localStorage.removeItem('incl_chess_learned');
});

const text = (selector: string): string => document.querySelector(selector)?.textContent ?? '';
const mark = (name: string): string | null =>
  document.querySelector(`[data-square="${name}"]`)?.getAttribute('data-lesson') ?? null;

/** Lets the shell's post-flight observer run: it fires from a resolved promise. */
const settle = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

/** Answers a whole step's `mark` set, in order. */
async function touchAll(names: readonly string[]): Promise<void> {
  for (const name of names) { shell.activate(at(name)); await settle(); }
}

describe('[Mode] a lesson runs through the board, and only through the board', () => {
  it('⚠️ has the prose before it draws anything', async () => {
    // The catalogues are a dynamic import, so a panel opened first says `teach.notation.title` —
    // exactly as `t()` documents, and useless to a child.
    expect(await mode.start('notation')).toBe(true);
    expect(text('.lesson-title')).toBe('Lendo o tabuleiro');
  });

  it('says the step politely, and never assertively', async () => {
    // Being in a lesson is not an emergency, and neither is getting one wrong.
    await mode.start('notation');
    expect(said[0]).toContain('Toque em e4');
    expect(document.getElementById('sr-alert')!.textContent).toBe('');
  });

  it('advances on the right square and nudges on the wrong one', async () => {
    await mode.start('notation');
    shell.activate(at('d4'));
    await settle();
    expect(text('.lesson-say')).toContain('Toque em e4');
    expect(text('.lesson-nudge')).toContain('Conte as colunas');

    shell.activate(at('e4'));
    await settle();
    expect(text('.lesson-say')).toContain('Agora toque em c6');
    // ⚠️ The nudge belongs to the step that earned it, and goes when the step goes.
    expect(document.querySelector<HTMLElement>('.lesson-nudge')!.hidden).toBe(true);
  });

  it('lights the square a step says to look at, and puts it out again', async () => {
    await mode.start('notation');
    expect(mark('f3')).toBeNull();

    await touchAll(['e4', 'c6']);
    // Step 2 is "what is this square called", and f3 is the square being asked about.
    expect(text('.lesson-say')).toContain('Qual é o nome dela');
    expect(mark('f3')).toBe('true');
    expect(document.querySelector('[data-square="f3"]')!.getAttribute('aria-label'))
      .toContain('nesta casa');

    document.querySelectorAll<HTMLButtonElement>('.lesson-option')[0]!.click();
    expect(mark('f3')).toBeNull();
  });

  it('⚠️ counts a partial mark set, so a child knows the touch landed', async () => {
    // Eight squares and no feedback is a step a child cannot tell they are making progress in —
    // and a reader who cannot see the board has nothing at all.
    await mode.start('king');
    shell.activate(at('c4'));
    await settle();
    expect(text('.lesson-counter')).toContain('1 de 8 casas');
    shell.activate(at('e6'));
    await settle();
    expect(text('.lesson-counter')).toContain('2 de 8 casas');
  });

  it('⚠️ takes a wrong MOVE back, after the piece has landed', async () => {
    /*
     * THE ORDER THE TUTOR'S OWN TEST FOUND. A move leaves the phase on `animating`, where
     * `canTakeBack()` refuses by design — so an undo issued too early does nothing at all, and
     * every answer after it comes back `ignored/busy`: a lesson that has silently stopped
     * accepting answers. The shell's observer fires after the flight for exactly this reason.
     *
     * And the move HAPPENS before it is undone, which is the pedagogy rather than a side effect:
     * a child who moved the pawn one square has to see it standing there.
     */
    await mode.start('pawn');
    await touchAll(['e3', 'e4']);                 // the reach step, answered
    expect(text('.lesson-say')).toContain('duas casas');

    shell.activate(at('e2'));
    shell.activate(at('e3'));                     // legal, and the wrong answer
    await settle();
    expect(shell.rules().pieceAt(at('e2'))?.type).toBe('p');
    expect(shell.rules().pieceAt(at('e3'))).toBeNull();
    expect(text('.lesson-nudge')).toContain('não saiu do lugar');

    shell.activate(at('e2'));
    shell.activate(at('e4'));                     // the right one, and it stays
    await settle();
    expect(shell.rules().pieceAt(at('e4'))?.type).toBe('p');
  });

  it('answers a pick in the panel and leaves the board alone', async () => {
    await mode.start('values');
    const before = shell.rules().fen();
    document.querySelectorAll<HTMLButtonElement>('.lesson-option')[2]!.click();
    expect(text('.lesson-say')).toContain('Quanto vale um peão');

    document.querySelectorAll<HTMLButtonElement>('.lesson-option')[0]!.click();
    expect(text('.lesson-say')).toContain('E a torre');
    expect(shell.rules().fen()).toBe(before);
  });

  it('finishes, files the lesson as learned, and forgets the place in it', async () => {
    await mode.start('rook');
    await touchAll([
      'a5', 'b5', 'c5', 'd1', 'd2', 'd3', 'd4', 'd6', 'd7', 'd8', 'e5', 'f5', 'g5', 'h5',
    ]);
    expect(text('.lesson-say')).toContain('Leve a torre até d8');

    shell.activate(at('d5'));
    shell.activate(at('d8'));
    await settle();
    expect(text('.lesson-counter')).toContain('Aula concluída');

    const progress = loadProgress(localStorage);
    expect(progress.done).toContain('rook');
    // A finished lesson resumed at its last step reopens on the question just answered.
    expect(progress.at).toBeUndefined();
  });

  it('remembers the place while a lesson is unfinished, so a reload can resume it', async () => {
    await mode.start('notation');
    shell.activate(at('e4'));
    await settle();
    expect(loadProgress(localStorage).at).toEqual({ lesson: 'notation', step: 1 });
  });

  it('resumes at a stored step', async () => {
    await mode.start('notation', 1);
    expect(text('.lesson-say')).toContain('Agora toque em c6');
  });
});

describe('[Mode] the board belongs to the player again afterwards', () => {
  it('⚠️ does not eat the game that was in progress', async () => {
    /*
     * The defect the `teaching` guard exists for, seen from the outside. `syncPosition` writes the
     * score sheet after everything that changes it, and a lesson changes it constantly.
     */
    shell.activate(at('e2'));
    shell.activate(at('e4'));
    await settle();
    const saved = sessionStorage.getItem('incl_chess_game');
    expect(saved).toContain('e2e4');

    await mode.start('rook');
    shell.activate(at('a5'));
    await settle();
    expect(sessionStorage.getItem('incl_chess_game')).toBe(saved);

    mode.stop();
    expect(left).toBe(1);
    expect(mode.active()).toBeNull();
    // ⚠️ The player's OWN position is back, not a fresh board — which is why `newGame()` with no
    // FEN reads the tab's storage rather than dealing a new game.
    expect(shell.rules().pieceAt(at('e4'))?.type).toBe('p');
  });

  it('stops watching, so the board is a game again and not an answer sheet', async () => {
    await mode.start('rook');
    mode.stop();
    expect(document.querySelector<HTMLElement>('.lesson-panel')!.hidden).toBe(true);
    shell.activate(at('e2'));
    shell.activate(at('e4'));
    await settle();
    expect(shell.rules().pieceAt(at('e4'))?.type).toBe('p');
  });

  it('refuses a lesson nobody wrote instead of opening an empty one', async () => {
    expect(await mode.start('a-lesson-nobody-wrote')).toBe(false);
    expect(mode.active()).toBeNull();
  });
});
