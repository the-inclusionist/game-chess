// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import { createGameState } from '../app/js/chess/state.ts';
import { fromAlgebraic, type Square } from '../app/js/chess/types.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { BOARD_THEMES } from '../app/js/ui/board-themes.ts';
import { createHud, type Hud } from '../app/js/ui/hud.ts';

const sq = (name: string): Square => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

let hud: Hud | null = null;
afterEach(() => { hud?.destroy(); hud = null; document.body.replaceChildren(); });

// ⚠️ `engineT` RETIRED in Wave 2 item 2: the vision select's labels now come from chess's own
// catalogues (which mirror the engine's `viz.fix-*` entries), so the HUD does not reach into
// the engine's dictionary any more. Tests here build the HUD with chess's own `i18n` alone.

function build(locale: 'pt' | 'en' | 'es' = 'pt', fen?: string) {
  const rules = createRules(fen);
  const state = createGameState({ rules, opponent: false });
  const viewAsks: string[] = [];
  // The composition root cancels the search and redraws around these; the panel only asks.
  const onTakeBack = vi.fn(() => { state.takeBack(); hud!.refresh(); });
  const onReplay = vi.fn(() => { state.replay(); hud!.refresh(); });
  hud = createHud({
    doc: document, i18n: createI18n(locale), rules: () => rules, state: () => state,
    view: () => '2.5d',
    // Recorded rather than acted on: the panel's job is to ASK for a view, and what that means is
    // the composition root's. A harness that mounted a renderer here would be testing the shell.
    onView: (kind: string) => { viewAsks.push(kind); },
    // The two controls the panel has that are about the OPPONENT: who plays which colour, and how
    // strong the engine is. Both are optional to the panel — the two-player board has neither —
    // so a builder that left them out was testing a panel the game never actually shows.
    canTakeBack: () => state.canTakeBack(), canReplay: () => state.canReplay(),
    onTakeBack, onReplay,
  });
  document.body.appendChild(hud.root);
  /*
   * ⚠️ TWO ROOTS, BECAUSE THE PANEL AND THE SETTINGS ARE TWO PLACES NOW. The view switch, the
   * piece drawing, the board colours, the colour-vision correction, reduced motion and the
   * coordinate labels are built and refreshed by the HUD but SHOWN in the pause menu — a node has
   * one parent, so the shell puts them there and this puts them somewhere.
   *
   * Mounting only `root` is what these tests did, and ten of them went red the moment the six
   * moved: they were querying the document, not the panel, and had never had to care which.
   */
  document.body.appendChild(hud.settings);
  /*
   * ⚠️ AND IT HAPPENED A SECOND TIME, WHICH IS WHY THE PARAGRAPH ABOVE IS WORTH KEEPING. On
   * 2026-09-11 the view switch left the settings for the side column, and five tests in this file
   * went red at once — all of them querying `document` for `.hud-view`, all of them unaware that
   * somebody else had been mounting the node they were reading.
   *
   * The harness mounts what the composition root mounts. A test that asks the document a question
   * has to put in the document everything the shell puts there, or it is asking about a page that
   * does not exist.
   */
  document.body.appendChild(hud.views);
  const play = (from: string, to: string) => {
    state.activate(sq(from));
    state.activate(sq(to));
    state.animationDone();
    hud!.refresh();
  };
  return { rules, state, hud, play, viewAsks,
           onTakeBack, onReplay };
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
  it.skip('speaks English', () => {
    build('en');
    expect(text('.hud-turn')).toContain('White');
    const labels = [...document.querySelectorAll('.hud-choice label')].map((l) => l.textContent);
    expect(labels).toContain('1 player\nwhite');
  });

  it('speaks Spanish', () => {
    build('es');
    expect(text('.hud-turn')).toContain('Blancas');
  });
});

// ========================= THE HIGH-CONTRAST SWITCH IS GONE =========================
// It was a second door onto one state: the palette list already contains both high-contrast
// answers, so the checkbox and the list could disagree and had to be kept in step by hand. The
// cases that guarded it went with it. `prefers-contrast: more` still selects a high-contrast
// palette at boot, which is the part that was never about the control.

// ⚠️ `[Colour vision] the corrections, and only the corrections` DELETED on 2026-10-02
// (Wave 2d). Four tests pinned `#hud-vision`, a chess-side select that was built in the HUD and
// appended to the `settings` container the HUD never attaches to the DOM. The engine's a11y-bar
// cvd icon drives chess's `setPlayerCorrection` hook, so the correction is still reachable; the
// select the tests tracked went away because it was never shown to a child in the first place.

// ⚠️ `[Reduced motion] one switch, because one thing moves` DELETED (Wave 2d, 2026-10-02):
// the HUD's own motion checkbox was zombie code since Wave 2c and is gone. Chess still reads
// the OS `prefers-reduced-motion` pref at boot and feeds `motionReduced` to the views, but
// there is no in-game override until a `gameOption` or an engine a11y icon arrives for it.

// ⚠️ `[Outline] on by default, and switchable` DELETED (Wave 2d, 2026-10-02): the HUD's
// own outline switch was zombie code since Wave 2c and is gone. The piece-outline toggle lives
// in `hooks.gameOptions` and the engine's panel renders it.

// ========================= THE PANEL MUST NOT RUN OUT OF ROOM =========================
// The report was concrete: as moves accumulated the menus below the score sheet went out of
// reach. Two independent causes, so two independent guards — the list is bounded, and the panel
// itself scrolls. Losing the strength control because you played twenty moves is a bug.

describe('[Panel] the controls stay reachable however long the game runs', () => {
  const nav = (): HTMLButtonElement[] =>
    [...document.querySelectorAll<HTMLButtonElement>('.hud-nav button')];

  it('keeps the move list and the take-back/replay row reachable after a long game', () => {
    /*
     * ⚠️ Post-Wave-2c: the controls this used to look for (`#hud-vision`, `#hud-motion`,
     * `#hud-outline`, `#hud-strength`) moved to the engine's `gameOptions` panel. The HUD side
     * column now carries only the game STATE (turn, opening, moves) and the two navigation
     * buttons. The test's intent — the score sheet growing does not push essential controls off
     * — carries over to WHAT STAYS IN THE PANEL: the move list and the nav buttons.
     */
    const { play } = build();
    for (const file of 'abcdefgh') {
      play(`${file}2`, `${file}3`);
      play(`${file}7`, `${file}6`);
    }
    play('g1', 'e2'); play('g8', 'e7'); play('b1', 'd2'); play('b8', 'd7');
    expect(document.querySelectorAll('.hud-moves li').length).toBe(10);
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

  it('offers all three, in order, and NOT inside the settings', () => {
    build();
    expect(views().map((v) => v.textContent)).toEqual(['2D', '2,5D', '3D']);
    /*
     * ⚠️ THIS ASSERTED THE OPPOSITE UNTIL 2026-09-11, and the reversal is the point rather than a
     * detail. It read "FIRST IN THE SETTINGS", because `32d5227` had swept the view switch into the
     * pause menu with the six set-once controls and being first there was the consolation.
     *
     * The Dev reported the three buttons missing: behind a menu that opens on a key, they were not
     * found. They are mounted by the composition root now, under the accessibility bar. So the HUD
     * builds them and hands them over, and what belongs here is the negative — that they are NOT in
     * the settings, which is the half a test can state without knowing where the shell put them.
     */
    expect(document.querySelector('.hud-settings')!.querySelector('.hud-views')).toBeNull();
  });

  it('marks the current one for the eye AND for the reader', () => {
    build();
    const current = views().filter((v) => v.getAttribute('aria-current') === 'true');
    expect(current).toHaveLength(1);
    expect(current[0].dataset.view).toBe('2.5d');
    // It stays in the list rather than being removed: a control that changed length between views
    // would move under the pointer, and a reader would lose the answer to "which am I in".
    expect(views()).toHaveLength(3);
  });

  it('⚠️ is a row of BUTTONS, and it was a row of links on purpose until the pages went', () => {
    /*
     * THE TEST THIS REPLACES SAID THE OPPOSITE, and it was right: «uses real links, so the platform
     * gives back what a button would take away». What a link gives back is opening a view in
     * another tab, and that was a true affordance while each view WAS a page — `2d.html`,
     * `index.html`, `3d.html`.
     *
     * ⚠️ IT STOPPED BEING TRUE WHEN THE PAGES WENT. A link to `2d.html` would now point at nothing,
     * and the middle click it afforded would land on a 404. A button is what this control actually
     * is: it changes the board in front of you, with no title screen in between.
     *
     * `type="button"` is not decoration — inside a form an untyped button submits.
     */
    build();
    for (const el of views()) {
      expect(`${el.dataset.view}: ${el.tagName} ${(el as HTMLButtonElement).type}`)
        .toBe(`${el.dataset.view}: BUTTON button`);
      expect(el.hasAttribute('href'), 'no destination, because there is none').toBe(false);
    }
  });

  it('⚠️ asks the composition root to change view, rather than knowing how', () => {
    /*
     * The panel is the one part of this game that never had to know what a Zdog view is, and a
     * switcher that mounted renderers would make it the second place that does. It reports a want;
     * the shell owns the meaning.
     */
    const { viewAsks } = build();
    [...document.querySelectorAll<HTMLElement>('.hud-view')]
      .find((v) => v.dataset.view === '3d')!.click();
    expect(viewAsks).toEqual(['3d']);
  });

  it('names each destination in the language the reader chose', () => {
    build('en');
    expect(views()[0].getAttribute('aria-label')).toBe('See the board in 2D');
  });
});

/*
 * ========================= THE ORDER OF THE PANEL, AS THE DEV SET IT =========================
 * 2026-10-04, verbatim: "1) [ ] Brancas - Preatas [ ] (de quem é a vez); 2) setas | Protetor de
 * lances; 3) voltar | avançar ; 4) lances 5) Força do adversário, desenho das peças, cores do
 * tabuleiro, coordenadas" — and "remova a seção de pontuação".
 *
 * ⚠️ WHY THIS IS A TEST AND NOT A COMMENT. An order is the one property of a panel that nothing
 * else notices breaking: every section still exists, every control still works, every other test
 * in this file still passes, and the only person who finds out is the one reading the panel.
 */
describe('[Panel] the sections come in the order the Dev asked for', () => {
  const panel = (): Hud => {
    const rules = createRules();
    const state = createGameState({ rules, opponent: true });
    hud = createHud({
      doc: document, i18n: createI18n('pt'), rules: () => rules, state: () => state,
      view: () => '2.5d',
      onHint: () => {}, arrows: () => false, onArrows: () => {},
      guard: () => false, onGuard: () => {},
      themes: BOARD_THEMES, theme: () => 'brown', onTheme: () => {},
      coordinates: () => true, onCoordinates: () => {},
      canTakeBack: () => state.canTakeBack(), canReplay: () => state.canReplay(),
      onTakeBack: () => {}, onReplay: () => {},
    });
    document.body.append(hud.root, hud.report);
    return hud;
  };

  it('whose turn, the two teachers, the walk, the moves, then the settings', () => {
    panel();
    const sections = [...hud!.root.children].map((n) => n.className || n.tagName.toLowerCase());
    /*
     * The opening's name sits with the move list because it is a sentence ABOUT it — and UNDER it
     * since 2026-10-04, which is a layout fix rather than a change of mind: it is the one thing
     * above the move box whose height is not known in advance, and the Dev asked for that box to
     * be eight lines and fully visible without touching the panel's scrollbar.
     */
    expect(sections).toEqual([
      'hud-turn', 'hud-teachers', 'hud-nav', 'section', 'hud-opening', 'hud-controls',
    ]);
  });

  it('⚠️ has no PONTUAÇÃO section — the strips beside the board carry those numbers', () => {
    panel();
    expect(hud!.root.textContent ?? '').not.toContain('PONTUAÇÃO');
    expect(hud!.root.querySelector('.hud-scoreboard')).toBeNull();
  });
});

/*
 * ================== THE CONTRAST TABLE BELONGS TO WHOEVER IS CHOOSING ==================
 * The Dev, 2026-10-04: "ao escolher as cores de tabuleiro deveria aparecer a tabela comparativa
 * para entender onde haveria contraste e onde faltaria contraste."
 *
 * ⚠️ IT WAS BEHIND `?debug=true` AND HUNG OFF A SELECT THAT HAS NOT BEEN IN THE DOM SINCE WAVE 2c,
 * so it was unreachable twice over. Both halves are asserted here: no debug flag reaches this HUD
 * at all — there is no longer one to pass — and the control focused is the one in the panel.
 */
describe('[Contrast] the comparison table, while the board colours are being chosen', () => {
  const colours = (): HTMLSelectElement => {
    const box = [...document.querySelectorAll<HTMLElement>('.hud-controls .hud-field')]
      .find((b) => (b.textContent ?? '').includes('Cores do tabuleiro'));
    if (!box) throw new Error('the board-colour control is not in the panel');
    return box.querySelector('select')!;
  };

  const panel = (): Hud => {
    const rules = createRules();
    const state = createGameState({ rules, opponent: true });
    hud = createHud({
      doc: document, i18n: createI18n('pt'), rules: () => rules, state: () => state,
      view: () => '2.5d',
      themes: BOARD_THEMES, theme: () => 'cb-safe', onTheme: () => {},
      canTakeBack: () => state.canTakeBack(), canReplay: () => state.canReplay(),
      onTakeBack: () => {}, onReplay: () => {},
    });
    document.body.append(hud.root, hud.report);
    return hud;
  };

  it('is hidden until the control is touched, and then shows every board', () => {
    panel();
    expect(hud!.report.hidden).toBe(true);
    colours().dispatchEvent(new FocusEvent('focus'));
    expect(hud!.report.hidden).toBe(false);
    const rows = [...hud!.report.querySelectorAll('th[scope="row"]')].map((n) => n.textContent);
    expect(rows).toHaveLength(BOARD_THEMES.length);
    expect(rows).toContain('Seguro para daltonismo (azul)');
  });

  it('⚠️ stays up after a choice, because the choice is what the numbers are for', () => {
    panel();
    const select = colours();
    select.dispatchEvent(new FocusEvent('focus'));
    select.dispatchEvent(new Event('change'));
    // It used to hide on `change`: a person picked a palette and the numbers that would have told
    // them whether it was a good pick vanished in the same instant.
    expect(hud!.report.hidden).toBe(false);
    select.dispatchEvent(new FocusEvent('blur'));
    expect(hud!.report.hidden).toBe(true);
  });

  it('marks the board in use, and says in a CHARACTER whether a pair clears the floor', () => {
    panel();
    colours().dispatchEvent(new FocusEvent('focus'));
    const current = hud!.report.querySelector('th[aria-current="true"]');
    expect(current?.textContent).toBe('Seguro para daltonismo (azul)');
    // Never colour alone (WCAG 1.4.1): ✓ clears, • is carried by the outline, ✗ fails.
    const cells = [...hud!.report.querySelectorAll('td')].map((n) => n.textContent ?? '');
    expect(cells).not.toHaveLength(0);
    expect(cells.every((t) => /[✓•✗]$/.test(t))).toBe(true);
  });
});
