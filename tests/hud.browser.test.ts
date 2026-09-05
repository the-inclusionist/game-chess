// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import { createGameState } from '../app/js/chess/state.ts';
import { fromAlgebraic, type Square } from '../app/js/chess/types.ts';
import { DEFAULT_ELO, STRENGTH_LADDER } from '../app/js/chess/engine/strength.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createHud, type Hud } from '../app/js/ui/hud.ts';

const sq = (name: string): Square => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

let hud: Hud | null = null;
afterEach(() => { hud?.destroy(); hud = null; document.body.replaceChildren(); });

function build(locale: 'pt' | 'en' | 'es' = 'pt', fen?: string) {
  const rules = createRules(fen);
  const state = createGameState({ rules, opponent: false });
  let vision = 'normal';
  const onVision = vi.fn((key: string) => { vision = key; });
  let motion = false;
  const onReducedMotion = vi.fn((on: boolean) => { motion = on; });
  let outline = true;
  const onOutline = vi.fn((on: boolean) => { outline = on; });
  let coords = true;
  const onCoords = vi.fn((on: boolean) => { coords = on; });
  // The composition root cancels the search and redraws around these; the panel only asks.
  const onTakeBack = vi.fn(() => { state.takeBack(); hud!.refresh(); });
  const onReplay = vi.fn(() => { state.replay(); hud!.refresh(); });
  hud = createHud({
    doc: document, i18n: createI18n(locale), rules, state,
    vision: () => vision, onVision,
    reducedMotion: () => motion, onReducedMotion,
    outline: () => outline, onOutline,
    coordinates: () => coords, onCoordinates: onCoords,
    view: '2.5d',
    // The two controls the panel has that are about the OPPONENT: who plays which colour, and how
    // strong the engine is. Both are optional to the panel — the two-player board has neither —
    // so a builder that left them out was testing a panel the game never actually shows.
    mode: () => 'w', onMode: vi.fn(),
    strengths: STRENGTH_LADDER.map((rung) => ({ elo: rung.elo, name: rung.name })),
    strength: () => DEFAULT_ELO, onStrength: vi.fn(),
    canTakeBack: () => state.canTakeBack(), canReplay: () => state.canReplay(),
    onTakeBack, onReplay,
  });
  document.body.appendChild(hud.root);
  const play = (from: string, to: string) => {
    state.activate(sq(from));
    state.activate(sq(to));
    state.animationDone();
    hud!.refresh();
  };
  return { rules, state, hud, onVision, play,
           getVision: () => vision, onReducedMotion, getMotion: () => motion,
           onOutline, getOutline: () => outline, onTakeBack, onReplay,
           onCoords, getCoords: () => coords };
}

const text = (selector: string): string =>
  document.querySelector(selector)?.textContent?.trim() ?? '';

describe('[Turn] whose move it is, said in words', () => {
  it('starts with white', () => {
    build();
    expect(text('.hud-turn')).toContain('Brancas');
  });

  it('changes hands after a move', () => {
    const { play } = build();
    play('e2', 'e4');
    expect(text('.hud-turn')).toContain('Pretas');
  });

  it('keeps the colour block out of the accessible name', () => {
    // Colour alone must never be the signal (WCAG 1.4.1). The swatch is decoration and says so
    // itself; the word beside it is what carries the meaning.
    build();
    expect(document.querySelector('.hud-swatch')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.hud-turn')?.getAttribute('aria-label')).toContain('Vez');
  });
});

describe('[Captured] read off the history, never tallied', () => {
  it('shows nothing at the start', () => {
    build();
    const rows = document.querySelectorAll('.hud-captured');
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.textContent).toBe('—');
  });

  it('shows a captured piece', () => {
    const { play } = build();
    play('e2', 'e4');
    play('d7', 'd5');
    play('e4', 'd5');
    expect(text('.hud-captured')).toContain('♟');
  });

  it('sorts the heaviest first, so a queen is not buried behind pawns', () => {
    const { play } = build('pt', '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1');
    play('e4', 'd5');
    expect(text('.hud-captured').startsWith('♛')).toBe(true);
  });

  it('corrects itself when a move is taken back', () => {
    // Reading the history rather than keeping a running tally is what makes this free: undo
    // needs no path of its own.
    const { rules, play, hud: h } = build();
    play('e2', 'e4');
    play('d7', 'd5');
    play('e4', 'd5');
    expect(text('.hud-captured')).toContain('♟');
    rules.undo();
    h.refresh();
    expect(text('.hud-captured')).toBe('—');
  });
});

describe('[Moves] a scoresheet, one line per pair', () => {
  it('is empty before anything is played', () => {
    build();
    expect(document.querySelectorAll('.hud-moves li')).toHaveLength(0);
  });

  it('pairs white and black on one line', () => {
    const { play } = build();
    play('e2', 'e4');
    play('e7', 'e5');
    expect([...document.querySelectorAll('.hud-moves li')].map((li) => li.textContent))
      .toEqual(['e4 e5']);
  });

  it('leaves a half-finished pair alone', () => {
    const { play } = build();
    play('e2', 'e4');
    play('e7', 'e5');
    play('g1', 'f3');
    expect([...document.querySelectorAll('.hud-moves li')].map((li) => li.textContent))
      .toEqual(['e4 e5', 'Nf3']);
  });

  it('is an ordered list, so the numbering belongs to the platform', () => {
    build();
    expect(document.querySelector('.hud-moves')?.tagName).toBe('OL');
  });

  it('is NOT a live region — every move is already spoken once', () => {
    // A live move list would announce each move a second time, which is worse than not having one.
    build();
    expect(document.querySelector('.hud-moves')?.getAttribute('aria-live')).toBeNull();
  });
});

// ========================= DIFFICULTY IS THREE BUTTONS NOW =========================
// It was a `select`, which hides two of its three options behind an arrow. Three options fit, so
// showing them costs a row and saves a click and a guess. They are REAL RADIOS with their labels
// drawn as buttons: the platform then supplies the grouping, the arrow keys, one tab stop for the
// set and "2 of 3" to a screen reader — none of which a row of buttons gets for free.


describe('[i18n] the panel follows the interface language', () => {
  it('speaks English', () => {
    build('en');
    expect(text('.hud-turn')).toContain('White');
    const labels = [...document.querySelectorAll('.hud-choice label')].map((l) => l.textContent);
    expect(labels).toContain('1 player\nwhite');
  });

  it('speaks Spanish', () => {
    build('es');
    expect(text('.hud-turn')).toContain('Blancas');
    expect(document.querySelector('fieldset.hud-choice legend')?.textContent).toBe('Quién juega');
  });
});

// ========================= THE HIGH-CONTRAST SWITCH IS GONE =========================
// It was a second door onto one state: the palette list already contains both high-contrast
// answers, so the checkbox and the list could disagree and had to be kept in step by hand. The
// cases that guarded it went with it. `prefers-contrast: more` still selects a high-contrast
// palette at boot, which is the part that was never about the control.

describe('[Colour vision] the corrections, and only the corrections', () => {
  it('offers trichromatic vision plus the three corrections', () => {
    build();
    const options = [...document.querySelectorAll('#hud-vision option')];
    expect(options.map((o) => (o as HTMLOptionElement).value))
      .toEqual(['normal', 'fix-protan', 'fix-deuter', 'fix-tritan']);
    // ⚠️ Named here rather than by the engine: "visão normal" makes every other entry in the same
    // list an abnormality, in a menu a child opens BECAUSE of how they see.
    expect(options[0].textContent).toBe('Visão tricromática');
    expect(options[1].textContent).toBe('Correção protanopia');
  });

  it('offers no SIMULATION of a deficiency', () => {
    // The engine's list also holds simulations, which show a sighted adult what a deficiency
    // looks like. Beside a child's own correction, that control would invite switching a
    // disability ON in the one place they came to switch it off. Teaching tools live in the
    // engine's empathy menu, not here.
    build();
    const values = [...document.querySelectorAll('#hud-vision option')]
      .map((o) => (o as HTMLOptionElement).value);
    expect(values.some((v) => v.startsWith('sim-'))).toBe(false);
    expect(values.some((v) => v.startsWith('lv-') || v === 'blind')).toBe(false);
  });

  it('is labelled, and the label points at it', () => {
    build();
    const select = document.querySelector<HTMLSelectElement>('#hud-vision')!;
    const label = document.querySelector<HTMLLabelElement>('label[for="hud-vision"]')!;
    expect(label.textContent).toBe('Visão de cores');
    expect(label.htmlFor).toBe(select.id);
  });

  it('reports a change', () => {
    const { onVision, getVision } = build();
    const select = document.querySelector<HTMLSelectElement>('#hud-vision')!;
    select.value = 'fix-deuter';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onVision).toHaveBeenCalledWith('fix-deuter');
    expect(getVision()).toBe('fix-deuter');
  });
});

describe('[Reduced motion] one switch, because one thing moves', () => {
  it('offers a labelled checkbox', () => {
    build();
    const label = document.querySelector<HTMLLabelElement>('label[for="hud-motion"]')!;
    expect(label.textContent).toBe('Movimento reduzido');
    expect(label.htmlFor).toBe('hud-motion');
  });

  it('reports a change', () => {
    const { onReducedMotion, getMotion } = build();
    const box = document.querySelector<HTMLInputElement>('#hud-motion')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onReducedMotion).toHaveBeenCalledWith(true);
    expect(getMotion()).toBe(true);
  });
});

describe('[Outline] on by default, and switchable', () => {
  it('starts on, because it is what gives a piece form in high contrast', () => {
    build();
    expect(document.querySelector<HTMLInputElement>('#hud-outline')!.checked).toBe(true);
  });

  it('is labelled, and the label points at it', () => {
    build();
    const label = document.querySelector<HTMLLabelElement>('label[for="hud-outline"]')!;
    expect(label.textContent).toBe('Contorno das peças');
  });

  it('reports being switched off', () => {
    const { onOutline, getOutline } = build();
    const box = document.querySelector<HTMLInputElement>('#hud-outline')!;
    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onOutline).toHaveBeenCalledWith(false);
    expect(getOutline()).toBe(false);
  });
});

// ========================= THE PANEL MUST NOT RUN OUT OF ROOM =========================
// The report was concrete: as moves accumulated the menus below the score sheet went out of
// reach. Two independent causes, so two independent guards — the list is bounded, and the panel
// itself scrolls. Losing the strength control because you played twenty moves is a bug.

describe('[Panel] the controls stay reachable however long the game runs', () => {
  const nav = (): HTMLButtonElement[] =>
    [...document.querySelectorAll<HTMLButtonElement>('.hud-nav button')];

  it('keeps every control in the document after a long game', () => {
    const { play } = build();
    // Twenty plies — enough score sheet to have pushed the panel over. Pawns rather than a
    // knight shuffle: a shuffle draws by threefold repetition and the state machine, quite
    // correctly, stops accepting moves half way through.
    for (const file of 'abcdefgh') {
      play(`${file}2`, `${file}3`);
      play(`${file}7`, `${file}6`);
    }
    // Every third-rank square is a pawn by now, so the knights go to the second rank.
    play('g1', 'e2'); play('g8', 'e7'); play('b1', 'd2'); play('b8', 'd7');
    expect(document.querySelectorAll('.hud-moves li').length).toBe(10);
    for (const id of ['#hud-vision', '#hud-motion', '#hud-outline']) {
      expect(document.querySelector(id)).not.toBeNull();
    }
    expect(document.querySelector('#hud-strength')).not.toBeNull();
    expect(nav()).toHaveLength(2);
  });

  it('leaves the score sheet reachable by keyboard', () => {
    build();
    const list = document.querySelector<HTMLElement>('.hud-moves');
    // It scrolls and holds nothing focusable, so it must take focus itself (WCAG 2.1.1).
    expect(list?.tabIndex).toBe(0);
    expect(list?.getAttribute('aria-label')).toBe('Lista de lances, rolável');
  });
});

describe('[Panel] walking the game backwards and forwards', () => {
  const nav = (): HTMLButtonElement[] =>
    [...document.querySelectorAll<HTMLButtonElement>('.hud-nav button')];

  it('offers two named buttons, both dead on an empty board', () => {
    build();
    const [back, forward] = nav();
    // Seen short, spoken in full — and the full name contains the visible word (WCAG 2.5.3).
    expect(back.textContent).toContain('Voltar');
    expect(forward.textContent).toContain('Avançar');
    expect(back.getAttribute('aria-label')).toBe('Voltar lance');
    expect(forward.getAttribute('aria-label')).toBe('Avançar lance');
    const seen = back.querySelector('.hud-nav-text')?.textContent ?? '';
    expect(back.getAttribute('aria-label')).toContain(seen);
    expect(back.disabled).toBe(true);
    expect(forward.disabled).toBe(true);
  });

  it('wakes the back button as soon as there is a move to take back', () => {
    const { play } = build();
    play('e2', 'e4');
    expect(nav()[0].disabled).toBe(false);
    expect(nav()[1].disabled).toBe(true);
  });

  it('takes the move off the score sheet and offers it forward again', () => {
    const { play, onTakeBack, onReplay } = build();
    play('e2', 'e4');
    expect(document.querySelectorAll('.hud-moves li')).toHaveLength(1);

    nav()[0].click();
    expect(onTakeBack).toHaveBeenCalled();
    expect(document.querySelectorAll('.hud-moves li')).toHaveLength(0);
    expect(nav()[0].disabled).toBe(true);
    expect(nav()[1].disabled).toBe(false);

    nav()[1].click();
    expect(onReplay).toHaveBeenCalled();
    expect(document.querySelectorAll('.hud-moves li')).toHaveLength(1);
  });

  it('puts a captured piece back in the tally on the way out', () => {
    // The capture list is read from the history, so a take-back corrects it with no undo path
    // of its own — the claim the HUD comment makes, now actually exercised.
    const { play } = build();
    play('e2', 'e4'); play('d7', 'd5'); play('e4', 'd5');
    expect(text('.hud-captured')).toContain('♟');
    nav()[0].click();
    expect(text('.hud-captured')).toBe('—');
  });

  it('names the buttons in every language', () => {
    build('en');
    expect(nav()[0].textContent).toContain('Back');
    expect(nav()[0].getAttribute('aria-label')).toBe('Take back');
    hud?.destroy();
    document.body.replaceChildren();
    build('es');
    expect(nav()[0].textContent).toContain('Deshacer');
    expect(nav()[0].getAttribute('aria-label')).toBe('Deshacer jugada');
  });
});

// ========================= THE THREE VIEWS =========================
// Each view is its own page, because a flat board is 110 KB and the projected one 148, and one
// bundle carrying both would make every player download the one they are not looking at. So the
// control that changes view is a NAVIGATION, and the element for a navigation is an anchor.

describe('[Views] 2D, 2.5D and 3D across the top of the panel', () => {
  const views = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.hud-view')];

  it('offers all three, in order, at the top', () => {
    build();
    expect(views().map((v) => v.textContent)).toEqual(['2D', '2,5D', '3D']);
    // First child of the panel: a view switch below the score sheet would be a scroll away.
    expect(document.querySelector('.hud')!.firstElementChild!.className).toBe('hud-views');
  });

  it('marks the current one for the eye AND for the reader', () => {
    build();
    const current = views().filter((v) => v.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0].dataset.view).toBe('2.5d');
    // It stays in the list rather than being removed: a control that changed length between views
    // would move under the pointer, and a reader would lose the answer to "which am I in".
    expect(views()).toHaveLength(3);
  });

  it('uses real links, so the platform gives back what a button would take away', () => {
    build();
    const [flat, projected] = views();
    expect(flat.tagName).toBe('A');
    expect(flat.getAttribute('href')).toBe('2d.html');
    expect(projected.getAttribute('href')).toBe('index.html');
  });

  it('shows the view that does not exist yet as disabled, and says why', () => {
    build();
    const third = views()[2];
    // A control that appears later moves the other two; saying "not yet" beats pretending there
    // were only ever two.
    expect(third.tagName).toBe('SPAN');
    expect(third.getAttribute('aria-disabled')).toBe('true');
    expect(third.getAttribute('aria-label')).toContain('ainda não disponível');
  });

  it('names each destination in the language the reader chose', () => {
    build('en');
    expect(views()[0].getAttribute('aria-label')).toBe('See the board in 2D');
  });
});
