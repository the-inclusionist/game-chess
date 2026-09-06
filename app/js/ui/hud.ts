// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/hud — turn, captured pieces, the move list, and how hard the opponent plays.
//
// ========================= WHY THIS IS DOM AND NOT PIXI =========================
// The plan said the HUD would be drawn in PixiJS, on the grounds that Zdog has no text. The first
// half is true and the conclusion was wrong.
//
// At 320×180 a HUD line is about seven pixels tall. In a canvas that is illegible without a bitmap
// font, it cannot be resized by anyone who needs it larger, and a screen reader cannot see it at
// all. In the DOM it is text: it scales with `--ui-fs` (which the engine's own `ui/layout` sets to
// `8·k`, so 16 px at the k=2 floor), it honours the reader's own font size, the strength control
// gets a 44 px tap target from `--tap` without being asked, and the move list is simply readable.
//
// This is also how the ENGINE does it. `--ui-fs` and `--tap` are scoped to `#game-region` precisely
// because the engine's own UI is DOM laid over the canvas, and its colour-vision filters are
// SVG/CSS — they reach the DOM as readily as the canvas, which is what `VIZ_DOM_ONLY` is about.
//
// PixiJS still earns its keep: it composites the Zdog frame, it owns the layer order, and the
// post-processing applies to the BOARD. Only the text argument was mistaken.

import { t as engineT } from '@the-inclusionist/engine/core/i18n.js';
import { VIZ_CORRECTIONS } from '@the-inclusionist/engine/render/viz-modes.js';
import type { Rules } from '../chess/rules.ts';
import type { GameState } from '../chess/state.ts';

/** One person as white, one as black, or two people sharing the board. */
export type GameMode = 'w' | 'b' | 'two';
import { BOARD_THEMES } from './board-themes.ts';
import { contrastRows } from './contrast-report.ts';
import type { I18n } from '../i18n/index.ts';

/** Which drawing of the board this page is. Also which of the three buttons is the current one. */
export type ViewKind = '2d' | '2.5d' | '3d';

export interface HudDeps {
  readonly doc: Document;
  /** The view this page shows. Omit and the switcher is left out entirely. */
  readonly view?: ViewKind;
  readonly i18n: I18n;
  /**
   * ⚠️ ACCESSORS, NOT OBJECTS, AND THAT IS WHAT KEEPS THE FOCUS ON THE BOARD.
   *
   * A lesson step with a new position is a new `Rules` and a new `GameState` — `chess/rules.ts`
   * only takes a FEN at construction, and giving it a `setFen` would make `startFen()` lie about
   * the game `session.describe()` rebuilds from. So the shell swaps the objects, and everything
   * downstream has to ask rather than remember.
   *
   * Held as a value, this consumer would have to be TORN DOWN AND REBUILT on every step that
   * changes the board — which throws away the focused cell and the roving tabindex, and dumps a
   * keyboard reader at the top of the page once per step.
   */
  rules(): Rules;
  state(): GameState;
  /** A key from the engine's VIZ_MODES, or 'normal'. */
  /** The languages on offer, and the one in use. Absent means the game cannot change language. */
  locales?: readonly { readonly code: string; readonly name: string }[];
  locale?(): string;
  onLocale?(code: string): void;
  vision(): string;
  onVision(key: string): void;
  reducedMotion(): boolean;
  onReducedMotion(on: boolean): void;
  /**
   * The piece-outline switch. OPTIONAL: the projected board has an outline to turn off and the
   * flat board has none, and a control that had to be repurposed to stay on both pages ended up
   * with a label that lied about its own question.
   */
  outline?(): boolean;
  onOutline?(on: boolean): void;
  /**
   * The named board palettes, when the view has any. Six of them do not fit a checkbox, and the
   * two high-contrast entries are not variants of each other — they differ in their PIECES — so
   * this is a list and not a toggle.
   */
  themes?: readonly { readonly key: string; readonly name: string }[];
  theme?(): string;
  onTheme?(key: string): void;

  /**
   * Who is playing. Changing it starts a new game — there is no honest way to change who owns the
   * pieces in the middle of one — so the composition root does exactly that.
   */
  mode?(): GameMode;
  onMode?(mode: GameMode): void;

  /**
   * The opponent's rating, from `STRENGTH_LADDER`.
   *
   * ⚠️ This REPLACED an easy/medium/hard control, and the replacement is the whole reason there
   * is only one engine left. A rating is a number a child may already have; "medium" is a number
   * nobody has. Two engines meant two ladders that could not be compared with each other, and one
   * of the two could not honour a rating at all.
   */
  strengths?: readonly { readonly elo: number; readonly name: string }[];
  strength?(): number;
  onStrength?(elo: number): void;

  /**
   * Asks the engine what it would play. Absent on a board with no engine, which is the two-player
   * mode: there is nobody to ask.
   */
  /**
   * The lessons this page can open, in the order they should be taken, with what is already
   * learned marked.
   *
   * ⚠️ ABSENT ON THE SOLID PAGE, AND SAID RATHER THAN FUDGED. `render3d/scene.ts` has no marker
   * channel at all — no selection, no legal targets, nothing — so a lesson that said "look at
   * these squares" would silently show nothing there. Offering the mode and having half of it do
   * nothing is worse than not offering it, so the composition root of `3d.html` passes neither of
   * these two and the control does not exist.
   */
  lessons?(): readonly { readonly id: string; readonly title: string; readonly done: boolean }[];
  onLesson?(id: string): void;
  onHint?(): void;
  hintBusy?(): boolean;
  /**
   * Whether suggestions are ON. Present makes the button a SWITCH rather than a verb — see the
   * note where it is built.
   */
  hintsOn?(): boolean;

  /** The drawings available for the pieces. Only the flat view has any; the projected view draws
   * geometry and has nothing to choose between. */
  pieceSets?: readonly { readonly key: string; readonly label: string }[];
  pieceSet?(): string;
  onPieceSet?(key: string): void;
  coordinates(): boolean;
  onCoordinates(on: boolean): void;
  /**
   * The engine's mark beside the move played at this ply — `!`, `?`, `??` and so on, or null
   * while it is still being worked out or for an ordinary move, which is most of them.
   *
   * ⚠️ A FUNCTION, asked per ply, rather than a list handed over. The marks arrive one at a time
   * and a second behind the moves; a snapshot passed in would be a snapshot of what was known
   * when the panel was last built, and the mark for the move just played is precisely the one
   * that would always be missing from it.
   */
  markAt?(ply: number): string | null;

  /**
   * The advantage readout. Optional because a board with no engine has half of it to show and
   * would have to invent the other half.
   */
  scoreboard?: HTMLElement;

  /**
   * Protected mode: the engine stops the game when the player throws it away. Absent where there
   * is nobody to protect anyone from — the two-player board.
   */
  protectedOn?(): boolean;
  onProtected?(on: boolean): void;

  /**
   * ⚠️ `?debug=true` ONLY. The measured contrast table is a maintainer's instrument: it answers
   * "did that ink change break anything", which is a question asked while working on the game and
   * never while playing it. Every palette here clears the floor on every pair that touches, so
   * there is nothing left for it to warn a player about — and six columns of numbers over the
   * board is a poor way to say "everything is fine".
   */
  debug?: boolean;

  /** Whether the score sheet can be walked back or forward from where it stands. */
  canTakeBack(): boolean;
  canReplay(): boolean;
  onTakeBack(): void;
  onReplay(): void;
}

export interface Hud {
  readonly root: HTMLElement;
  /**
   * The controls you set once and then forget: the view switch, the piece drawing, the board
   * colours, the colour-vision correction, reduced motion and the coordinate labels.
   *
   * ⚠️ NOT INSIDE `root`. They are built and refreshed by the HUD because that is where their
   * state and callbacks live, but they are SHOWN wherever the composition root puts them — which
   * is the pause menu. Appending this to two places at once would silently move it: a node has one
   * parent.
   */
  readonly settings: HTMLElement;
  /**
   * The measured contrast table, or an empty node when `debug` is off. It lives OUTSIDE the panel
   * — in the space the board leaves — because six columns cannot be read in an 88-pixel column.
   */
  readonly report: HTMLElement;
  refresh(): void;
  destroy(): void;
}

/** The three views and the page each one lives on. `null` is a view that is not built yet. */
const VIEW_PAGES: readonly (readonly [ViewKind, string | null])[] = [
  ['2d', '2d.html'],
  ['2.5d', 'index.html'],
  ['3d', '3d.html'],
];

export function createHud(deps: HudDeps): Hud {
  const { doc, i18n, rules, state } = deps;

  const root = doc.createElement('div');
  root.className = 'hud';

  // --- the three views ---------------------------------------------------------
  // ========================= LINKS, NOT BUTTONS =========================
  // Each view is its own page, because the measurement said so: a flat board is 110 KB and the
  // projected one 148, and a switch inside one bundle would make every player download both. So
  // the control that changes view is a NAVIGATION, and the element for a navigation is an anchor —
  // which gets middle-click, open-in-new-tab, the browser's own back button and a real focus ring
  // from the platform rather than from this file.
  //
  // The current view stays in the list and is marked `aria-current="page"`. Removing it would make
  // the control jump about as you move between views, and a screen reader would lose the answer to
  // "which one am I in".
  // ========================= THE NUMBERS, WHERE THE PERSON CHOOSING CAN SEE THEM ==============
  // Every palette here was argued for with measurements, and until now those lived in comments and
  // tests — read by whoever maintains the code and by nobody who uses it. The person choosing a
  // board is the one they are about: a teacher picking a palette for a child with low vision has
  // exactly one question, and this table answers it for all six at once rather than one at a time.
  //
  // It does not warn and it does not refuse. Four of the six have fills under the floor ON PURPOSE
  // — that is how the printed convention works and the rim is what carries them — so the table
  // marks those differently from a real failure instead of hiding them.

  /*
   * ========================= ⚠️ THESE SIX LEFT THE SIDE PANEL =========================
   * The view switch, the piece drawing, the board colours, the colour-vision correction, reduced
   * motion and the coordinate labels are all things you set ONCE and then forget. They were taking
   * most of a panel that is 27.5% of a 640-pixel board, above the things a player actually watches
   * while playing — and in a lesson they were taking that room from the lesson.
   *
   * They are still BUILT and REFRESHED here, because this is where their state and their callbacks
   * live. Only where they are SHOWN has moved: the composition root hands this container to the
   * pause menu. That is a seam rather than a move — the HUD owns the controls, the shell decides
   * where they appear — and it is why `refresh()` needed no change at all.
   */
  const settings = doc.createElement('div');
  settings.className = 'hud-settings';

  /*
   * ⚠️ FIRST IN THE SETTINGS, ABOVE THE VIEW SWITCH. Somebody who cannot read the panel cannot
   * find anything else in it — so the control that fixes that comes before the controls that
   * assume it. The option NAMES are in their own languages ("Português", "English", "Español")
   * rather than translated, for the same reason: a reader looking for their language is looking
   * for the word they know, not for this game's word for it.
   */
  const localeBox = doc.createElement('p');
  localeBox.className = 'hud-field';
  const localeLabel = doc.createElement('label');
  const localeSelect = doc.createElement('select');
  localeSelect.id = 'hud-locale';
  localeLabel.htmlFor = localeSelect.id;
  localeBox.append(localeLabel, localeSelect);
  if (deps.locales) {
    for (const { code, name } of deps.locales) {
      const option = doc.createElement('option');
      option.value = code;
      option.textContent = name;
      localeSelect.appendChild(option);
    }
    settings.appendChild(localeBox);
  }

  const views = doc.createElement('nav');
  views.className = 'hud-views';
  const viewLinks: { kind: ViewKind; el: HTMLElement }[] = [];

  if (deps.view) {
    const here = deps.view;
    for (const [kind, href] of VIEW_PAGES) {
      // ⚠️ All three exist now. The `null` case stays: a view that is not built yet is shown and
      // disabled rather than hidden, because a control that appears later moves the other two,
      // and because saying "not yet" is more useful than pretending there were only ever two.
      const pending = href === null;
      const el = doc.createElement(pending ? 'span' : 'a');
      el.className = 'hud-view';
      el.dataset.view = kind;
      if (!pending) {
        (el as HTMLAnchorElement).href = href;
        // ⚠️ Says WHY the next page is loading. Each view is its own page — 110 KB against 148,
        // measured — so changing view is a navigation, and a navigation runs the title screen
        // again. A title screen is for loading the GAME; meeting it every time you look at the
        // same position from a different angle is being asked to start something you are already
        // in the middle of. `ui/splash.ts` reads this and steps aside.
        el.addEventListener('click', () => {
          try { sessionStorage.setItem('incl_chess_switching', '1'); } catch { /* private mode */ }
        });
      }
      if (kind === here) el.setAttribute('aria-current', 'page');
      if (pending) el.setAttribute('aria-disabled', 'true');
      views.appendChild(el);
      viewLinks.push({ kind, el });
    }
    settings.appendChild(views);
  }

  const report = doc.createElement('aside');
  report.className = 'theme-report';
  report.id = 'theme-report';
  report.hidden = true;
  const reportTitle = doc.createElement('h2');
  const reportTable = doc.createElement('table');
  const reportFloor = doc.createElement('p');
  reportFloor.className = 'theme-report-floor';
  report.append(reportTitle, reportTable, reportFloor);

  // --- turn ------------------------------------------------------------------
  const turn = doc.createElement('p');
  turn.className = 'hud-turn';
  const swatch = doc.createElement('span');
  swatch.className = 'hud-swatch';
  swatch.setAttribute('aria-hidden', 'true');   // colour alone says nothing; the text carries it
  const turnText = doc.createElement('span');
  turn.append(swatch, turnText);

  // ========================= A CHOICE OF TWO OR THREE IS BUTTONS =========================
  // A `select` hides every option but one until you open it, which is the right trade when there
  // are seven palettes and the wrong one when there are two sides or three difficulties: the whole
  // set fits, so showing it costs a row and saves a click and a decision about what is behind the
  // arrow.
  //
  // They are REAL RADIOS with their labels styled as buttons, not buttons with `aria-pressed`. The
  // platform then supplies the group semantics, arrow-key movement between the options, one tab
  // stop for the whole set and the announcement "2 of 3" — none of which would come free from a
  // row of buttons, and all of which would have to be rebuilt correctly here.
  const groupOf = (
    name: string, values: readonly string[], id: (v: string) => string,
  ): { box: HTMLElement; legend: HTMLElement; options: { input: HTMLInputElement; label: HTMLElement }[] } => {
    const box = doc.createElement('fieldset');
    box.className = 'hud-choice';
    const legend = doc.createElement('legend');
    box.appendChild(legend);
    // ⚠️ The label is KEPT, not looked up later. `createHud` calls its own `refresh()` while it is
    // being built, before the panel is in the document — so a `document.querySelector` for it finds
    // nothing and every button comes out blank. Holding the element is also simply cheaper.
    const options = values.map((value) => {
      const input = doc.createElement('input');
      input.type = 'radio';
      input.name = name;
      input.value = value;
      input.id = id(value);
      const label = doc.createElement('label');
      label.htmlFor = input.id;
      box.append(input, label);
      return { input, label };
    });
    return { box, legend, options };
  };


  // ========================= THE CAPTURES MOVED TO THE BOARD =========================
  // They used to be here, and here is where they were least useful: a player deciding on a move
  // is looking at the board, and a row of glyphs they have to look away to read is a row of
  // glyphs they do not read. `ui/player-strip.ts` puts them at each player's own end of the
  // board, which is where every chess program has settled on putting them.
  //
  // Not duplicated — MOVED. Two copies of one tally is two things to keep in step, and it was
  // already being rebuilt from `rules().history()` on every refresh, so the move cost nothing.

  // --- move list -------------------------------------------------------------
  const movesBox = doc.createElement('section');
  const movesTitle = doc.createElement('h2');
  const movesList = doc.createElement('ol');
  movesList.className = 'hud-moves';
  // NOT a live region. Every move is already announced through srSay the moment it is played;
  // a live list would say each one twice, which is worse than saying it once.

  // ========================= WHY THE LIST IS FOCUSABLE =========================
  // It scrolls, and it holds no focusable content — an `<ol>` of text. A scroll container like
  // that is unreachable by keyboard unless it can take focus itself (WCAG 2.1.1), so a person
  // who cannot use a pointer would have no way to read past the visible moves.
  movesList.tabIndex = 0;

  // ========================= TAKE BACK AND PLAY FORWARD =========================
  // Under the score sheet because that is what they move through. Two real buttons, so they are
  // in the tab order and speak their own names; the arrows are decoration and are hidden from the
  // reader, which is why each button also carries visible text.
  //
  // The visible word is the short one and the accessible name is the full phrase — "Voltar" seen,
  // "Voltar lance" spoken. Two buttons side by side in an 88-logical-pixel column cannot show
  // "Avançar lance" without ellipsis, and an ellipsis is a label nobody can read. WCAG 2.5.3 is
  // satisfied because the full name CONTAINS the visible one, so a voice-control user who says
  // what they see is still understood.
  const navBox = doc.createElement('p');
  navBox.className = 'hud-nav';
  const backButton = doc.createElement('button');
  const forwardButton = doc.createElement('button');
  for (const [button, glyph] of [[backButton, '◀'], [forwardButton, '▶']] as const) {
    button.type = 'button';
    const arrow = doc.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = glyph;
    const text = doc.createElement('span');
    text.className = 'hud-nav-text';
    button.append(...(glyph === '◀' ? [arrow, text] : [text, arrow]));
    navBox.appendChild(button);
  }
  const backText = backButton.querySelector('.hud-nav-text') as HTMLElement;
  const forwardText = forwardButton.querySelector('.hud-nav-text') as HTMLElement;

  movesBox.append(movesTitle, movesList, navBox);

  // ========================= NO HIGH-CONTRAST SWITCH =========================
  // There was a checkbox here and it was a second door onto one state: the palette list already
  // contains both high-contrast answers, so the switch and the list could disagree and had to be
  // kept in step by hand. One control, one state(). `prefers-contrast: more` still selects a
  // high-contrast palette at boot — a preference someone has already expressed to their system is
  // not something to make them express again.

  // --- colour vision ---------------------------------------------------------
  // Only the CORRECTIONS. The engine's list also holds simulations, which exist to show a
  // sighted adult what a deficiency looks like — a teaching tool, and it belongs in the
  // engine's own empathy menu. Putting it beside a child's own correction would invite
  // switching a disability ON in the one place they went to switch it off.
  const visionBox = doc.createElement('p');
  const visionLabel = doc.createElement('label');
  const visionSelect = doc.createElement('select');
  visionSelect.id = 'hud-vision';
  visionLabel.htmlFor = visionSelect.id;
  // ⚠️ THE FIRST ENTRY IS NAMED HERE AND NOT BY THE ENGINE, and the reason is the word. The
  // engine's catalogue calls it "visão normal", which makes every other entry in the same list an
  // abnormality — in a menu a child opens BECAUSE of how they see. The corrections keep the
  // engine's names, since those name a condition and do it accurately; only this one is replaced,
  // with the term for what it actually describes.
  //
  // The engine has the same line in its own games. That is worth fixing upstream, and it is not
  // this repository's to fix.
  for (const mode of [{ key: 'normal', nome: '' }, ...VIZ_CORRECTIONS]) {
    const option = doc.createElement('option');
    option.value = mode.key;
    option.dataset.nome = mode.nome;
    visionSelect.appendChild(option);
  }
  visionBox.append(visionLabel, visionSelect);

  // --- reduced motion --------------------------------------------------------
  // The engine exposes reduced motion PER ELEMENT — rm.parallax, rm.walk, rm.breath and so on —
  // which is richer than a single switch and is the right shape for a platformer. None of those
  // elements exist here: this game moves exactly one thing, a piece crossing the board. So the
  // control is one switch, seeded from the system preference the person already expressed.
  const motionBox = doc.createElement('p');
  const motionInput = doc.createElement('input');
  motionInput.type = 'checkbox';
  motionInput.id = 'hud-motion';
  const motionLabel = doc.createElement('label');
  motionLabel.htmlFor = motionInput.id;
  motionLabel.className = 'hud-check';
  motionBox.append(motionInput, motionLabel);

  const modeGroup = groupOf('hud-mode', ['w', 'b', 'two'], (v) => `hud-mode-${v}`);

  // --- protected mode ---------------------------------------------------------
  // A switch and not a difficulty: it does not change how the opponent plays, it changes what
  // happens when the PLAYER throws the game away. Which is a teaching aid, so it sits with the
  // other things a teacher turns on rather than with the ones that set the level.
  const protectedBox = doc.createElement('p');
  protectedBox.className = 'hud-check';
  const protectedInput = doc.createElement('input');
  protectedInput.type = 'checkbox';
  protectedInput.id = 'hud-protected';
  const protectedLabel = doc.createElement('label');
  protectedLabel.htmlFor = protectedInput.id;
  protectedBox.append(protectedInput, protectedLabel);

  // --- how strong the opponent plays ------------------------------------------
  const strengthBox = doc.createElement('p');
  const strengthLabel = doc.createElement('label');
  const strengthSelect = doc.createElement('select');
  strengthSelect.id = 'hud-strength';
  strengthLabel.htmlFor = strengthSelect.id;
  if (deps.strengths) {
    for (const rung of deps.strengths) {
      const option = doc.createElement('option');
      option.value = String(rung.elo);
      option.dataset.name = rung.name;
      strengthSelect.appendChild(option);
    }
    strengthBox.append(strengthLabel, strengthSelect);
  }

  // --- which drawing the pieces use ------------------------------------------
  const setBox = doc.createElement('p');
  const setLabel = doc.createElement('label');
  const setSelect = doc.createElement('select');
  setSelect.id = 'hud-set';
  setLabel.htmlFor = setSelect.id;
  if (deps.pieceSets) {
    for (const item of deps.pieceSets) {
      const option = doc.createElement('option');
      option.value = item.key;
      // Written straight in: a typeface's name is the same string in every language.
      option.textContent = item.label;
      setSelect.appendChild(option);
    }
    setBox.append(setLabel, setSelect);
  }

  // --- board colours ---------------------------------------------------------
  const themeBox = doc.createElement('p');
  const themeLabel = doc.createElement('label');
  const themeSelect = doc.createElement('select');
  themeSelect.id = 'hud-theme';
  themeLabel.htmlFor = themeSelect.id;
  if (deps.themes) {
    for (const item of deps.themes) {
      const option = doc.createElement('option');
      option.value = item.key;
      option.dataset.name = item.name;
      themeSelect.appendChild(option);
    }
    themeBox.append(themeLabel, themeSelect);
  }

  // --- piece outline ---------------------------------------------------------
  // On by default: it is what gives a piece its form in high contrast, where every face is the
  // same colour. Switchable because it is also a strong visual opinion, and because a flat look
  // is a legitimate thing to prefer.
  const outlineBox = doc.createElement('p');
  const outlineInput = doc.createElement('input');
  outlineInput.type = 'checkbox';
  outlineInput.id = 'hud-outline';
  const outlineLabel = doc.createElement('label');
  outlineLabel.htmlFor = outlineInput.id;
  outlineLabel.className = 'hud-check';
  outlineBox.append(outlineInput, outlineLabel);

  // --- board coordinates ------------------------------------------------------
  // On by default. The algebraic names are what the screen reader already speaks, and seeing them
  // is how a sighted learner connects the two — so the pedagogical default is ON, and the switch
  // exists because at this resolution sixteen labels are real pixels around a small board.
  const coordsBox = doc.createElement('p');
  const coordsInput = doc.createElement('input');
  coordsInput.type = 'checkbox';
  coordsInput.id = 'hud-coords';
  const coordsLabel = doc.createElement('label');
  coordsLabel.htmlFor = coordsInput.id;
  coordsLabel.className = 'hud-check';
  coordsBox.append(coordsInput, coordsLabel);

  // --- the hint --------------------------------------------------------------
  // ========================= WHY THIS IS A BUTTON AND NOT A PANEL =========================
  // ⚠️ A SWITCH, not a verb. It was a verb, and the verb was wrong: an answer that appeared once
  // and vanished the next time the board redrew meant a player who wanted help had to keep asking
  // for it, and lost it precisely when they touched a piece to act on it. Help you have to
  // re-request is help you stop requesting. `aria-pressed` is what says so to a screen reader,
  // and it is the difference between "Hint" being read as a button and as a setting that is on.
  //
  // What it answers with goes on the BOARD —
  // marks on the squares — and into the live region, because a player who cannot see the marks is
  // exactly the player a hint is for.
  // --- the lessons ------------------------------------------------------------
  // A select and a verb, like the strength control below it, rather than eleven buttons: the HUD
  // is 88 logical pixels wide and a list of lessons would be most of it.
  const lessonBox = doc.createElement('p');
  lessonBox.className = 'hud-field';
  const lessonLabel = doc.createElement('label');
  const lessonSelect = doc.createElement('select');
  lessonSelect.id = 'hud-lesson';
  lessonLabel.htmlFor = lessonSelect.id;
  const lessonButton = doc.createElement('button');
  lessonButton.type = 'button';
  lessonButton.className = 'hud-lesson-start';
  lessonBox.append(lessonLabel, lessonSelect, lessonButton);

  const hintBox = doc.createElement('p');
  const hintButton = doc.createElement('button');
  hintButton.type = 'button';
  hintButton.id = 'hud-hint';
  hintButton.className = 'hud-hint';
  hintBox.appendChild(hintButton);

  root.append(turn, movesBox);
  if (deps.lessons) root.appendChild(lessonBox);
  if (deps.onHint) root.appendChild(hintBox);
  if (deps.onMode) root.appendChild(modeGroup.box);
  if (deps.scoreboard) root.appendChild(deps.scoreboard);
  if (deps.strengths) root.appendChild(strengthBox);
  if (deps.onProtected) root.appendChild(protectedBox);
  if (deps.pieceSets) settings.appendChild(setBox);
  if (deps.themes) settings.appendChild(themeBox);
  settings.append(visionBox, motionBox);
  if (deps.onOutline) settings.appendChild(outlineBox);
  settings.appendChild(coordsBox);

  function onModeInput(event: Event): void {
    deps.onMode?.((event.target as HTMLInputElement).value as GameMode);
  }
  for (const { input } of modeGroup.options) input.addEventListener('change', onModeInput);

  function onProtectedChange(): void { deps.onProtected?.(protectedInput.checked); }
  protectedInput.addEventListener('change', onProtectedChange);

  function onStrengthChange(): void { deps.onStrength?.(Number(strengthSelect.value)); }
  strengthSelect.addEventListener('change', onStrengthChange);

  function onHintClick(): void { deps.onHint?.(); }
  hintButton.addEventListener('click', onHintClick);

  function onLessonClick(): void { deps.onLesson?.(lessonSelect.value); }
  lessonButton.addEventListener('click', onLessonClick);

  function onLocaleChange(): void { deps.onLocale?.(localeSelect.value); }
  localeSelect.addEventListener('change', onLocaleChange);

  function onVisionChange(): void { deps.onVision(visionSelect.value); }
  visionSelect.addEventListener('change', onVisionChange);

  function onMotionChange(): void { deps.onReducedMotion(motionInput.checked); }
  motionInput.addEventListener('change', onMotionChange);

  function onOutlineChange(): void { deps.onOutline?.(outlineInput.checked); }
  outlineInput.addEventListener('change', onOutlineChange);

  function onSetChange(): void { deps.onPieceSet?.(setSelect.value); }
  setSelect.addEventListener('change', onSetChange);

  function onThemeChange(): void { deps.onTheme?.(themeSelect.value); }
  themeSelect.addEventListener('change', onThemeChange);

  // ========================= ON SCREEN WHILE THE LIST IS OPEN =========================
  // It used to appear on hover, which put a table of numbers over the board every time a pointer
  // crossed the panel. It belongs on screen while the list is OPEN and no longer.
  //
  // ⚠️ HTML gives no event for that. A `select` has no `open`, no `close` and no way to ask. What
  // it does have is a reliable pattern around the native popup: it opens on `mousedown`, or on the
  // keys that open one; it closes on `change`, and it closes on `blur` whichever way it went. So
  // those four are the approximation, and it is stated as an approximation rather than dressed up
  // as an event that exists.
  const showReport = (): void => {
    if (!deps.debug) return;
    report.hidden = false;
    fillReport();
  };
  const hideReport = (): void => { report.hidden = true; };
  themeSelect.addEventListener('mousedown', showReport);
  themeSelect.addEventListener('keydown', (event) => {
    // The keys that open a native list: Alt+Down, Enter, Space, and the arrows on some platforms.
    if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Spacebar'].includes(event.key)) showReport();
  });
  themeSelect.addEventListener('change', hideReport);
  themeSelect.addEventListener('blur', hideReport);

  /** Redraws the whole matrix: one row per measured pair, one column per palette. */
  function fillReport(): void {
    if (!deps.themes || !deps.debug) return;
    const current = deps.theme?.() ?? '';
    const columns = BOARD_THEMES;
    const rows = columns.map((theme) => contrastRows(theme));

    reportTitle.textContent = i18n.t('contrast.title');
    reportTable.replaceChildren();

    const head = doc.createElement('tr');
    const corner = doc.createElement('th');
    corner.scope = 'col';
    corner.textContent = i18n.t('contrast.pair');
    head.appendChild(corner);
    for (const theme of columns) {
      const cell = doc.createElement('th');
      cell.scope = 'col';
      cell.textContent = i18n.t(theme.short);
      if (theme.key === current) cell.setAttribute('aria-current', 'true');
      head.appendChild(cell);
    }
    reportTable.appendChild(head);

    rows[0].forEach((_, index) => {
      const line = doc.createElement('tr');
      const label = doc.createElement('th');
      label.scope = 'row';
      label.textContent = i18n.t(rows[0][index].label);
      line.appendChild(label);

      columns.forEach((theme, column) => {
        const row = rows[column][index];
        const cell = doc.createElement('td');
        // Never colour alone: the mark is a character a reader speaks; the colour is the extra.
        const state = row.passes ? 'pass' : (row.optional ? 'carried' : 'short');
        cell.dataset.state = state;
        if (theme.key === current) cell.dataset.current = 'true';
        cell.textContent = `${row.ratio.toFixed(1)}\u202F${
          state === 'pass' ? '\u2713' : state === 'carried' ? '\u2022' : '\u2717'}`;
        line.appendChild(cell);
      });
      reportTable.appendChild(line);
    });

    reportFloor.textContent = i18n.t('contrast.floor');
  }

  function onCoordsChange(): void { deps.onCoordinates(coordsInput.checked); }
  coordsInput.addEventListener('change', onCoordsChange);

  function onBackClick(): void { deps.onTakeBack(); }
  function onForwardClick(): void { deps.onReplay(); }
  backButton.addEventListener('click', onBackClick);
  forwardButton.addEventListener('click', onForwardClick);

  /**
   * "1. e4 e5" per line, which is how a scoresheet reads — with the engine's mark where it has
   * one, which is how an annotated one reads.
   *
   * ⚠️ The mark is a `<b>` and not a colour. `??` beside a move has to survive being printed in
   * grey, read aloud, and looked at by someone who sees no colour at all (1.4.1) — and it is
   * already the notation every chess book on earth uses, so there is nothing to invent.
   */
  function fillMoves(): void {
    const history = rules().history();
    movesList.replaceChildren();
    for (let i = 0; i < history.length; i += 2) {
      const item = doc.createElement('li');
      for (const ply of [i, i + 1]) {
        if (!history[ply]) continue;
        if (ply > i) item.appendChild(doc.createTextNode(' '));
        item.appendChild(doc.createTextNode(history[ply].san));
        const mark = deps.markAt?.(ply);
        if (!mark) continue;
        const flag = doc.createElement('b');
        flag.className = 'hud-mark';
        flag.textContent = mark;
        flag.dataset.mark = mark;
        // Spoken as well as seen: "e4 question mark" is not a sentence, and the title is what
        // makes it one for anybody hovering or reading the accessibility tree.
        flag.title = i18n.t('mark.title', { mark });
        item.appendChild(flag);
      }
      movesList.appendChild(item);
    }
    movesList.scrollTop = movesList.scrollHeight;
  }

  function refresh(): void {
    for (const { kind, el } of viewLinks) {
      el.textContent = i18n.t(`view.${kind === '2.5d' ? '25d' : kind}`);
      const pending = el.tagName === 'SPAN';
      el.setAttribute(
        'aria-label',
        pending
          ? `${i18n.t(`view.${kind === '2.5d' ? '25d' : kind}`)}, ${i18n.t('view.soon')}`
          : i18n.t('view.go', { name: i18n.t(`view.${kind === '2.5d' ? '25d' : kind}`) }),
      );
      if (pending) el.title = i18n.t('view.soon');
    }

    const side = rules().turn();
    swatch.dataset.side = side;
    turnText.textContent = i18n.t(`turn.${side}`);
    // The heading says what the colour block means, so the block is decoration and not the signal.
    turn.setAttribute('aria-label', `${i18n.t('hud.turn')}: ${i18n.t(`turn.${side}`)}`);

    movesTitle.textContent = i18n.t('hud.moves');
    movesList.setAttribute('aria-label', i18n.t('hud.movesRegion'));
    fillMoves();

    backText.textContent = i18n.t('hud.takeBackShort');
    forwardText.textContent = i18n.t('hud.replayShort');
    backButton.setAttribute('aria-label', i18n.t('hud.takeBack'));
    forwardButton.setAttribute('aria-label', i18n.t('hud.replay'));
    backButton.disabled = !deps.canTakeBack();
    forwardButton.disabled = !deps.canReplay();

    // These labels come from the ENGINE's catalogue, not this game's: the modes are the engine's
    // and it already names them in all three languages. Restating them here would be a second
    // copy to drift.
    visionLabel.textContent = i18n.t('hud.vision');
    for (const option of visionSelect.options) {
      option.textContent = option.value === 'normal'
        ? i18n.t('viz.trichromatic')
        : engineT(option.dataset.nome ?? '');
    }
    visionSelect.value = deps.vision();

    motionLabel.textContent = i18n.t('hud.reducedMotion');
    motionInput.checked = deps.reducedMotion();

    if (deps.onProtected) {
      protectedLabel.textContent = i18n.t('hud.protected');
      protectedInput.checked = deps.protectedOn?.() ?? false;
    }

    if (deps.strengths) {
      strengthLabel.textContent = i18n.t('hud.strength');
      for (const option of strengthSelect.options) {
        // "1600 · Class B" — the number is the dial and the name is what it means.
        option.textContent = `${option.value} · ${i18n.t(option.dataset.name ?? '')}`;
      }
      strengthSelect.value = String(deps.strength?.() ?? '');
    }

    if (deps.onHint) {
      if (deps.lessons) {
        lessonLabel.textContent = i18n.t('hud.lessons');
        lessonButton.textContent = i18n.t('hud.startLesson');
        const chosen = lessonSelect.value;
        const list = deps.lessons();
        lessonSelect.replaceChildren(...list.map((lesson) => {
          const option = doc.createElement('option');
          option.value = lesson.id;
          /*
           * ⚠️ THE TICK IS A CHARACTER IN THE TEXT, not a colour and not an icon. An `<option>`
           * cannot carry a marker of its own that a screen reader will read, so "learned" has to
           * be part of the name or it is not there at all for the reader who most needs to know
           * which lessons are left. WCAG 1.4.1, in the one place where the platform gives no
           * other channel.
           */
          option.textContent = lesson.done
            ? i18n.t('hud.lessonDone', { title: i18n.t(lesson.title) })
            : i18n.t(lesson.title);
          return option;
        }));
        // Keep the reader's choice across a refresh; otherwise every redraw of the HUD would
        // silently reset the select to the first lesson under their hand.
        if (list.some((l) => l.id === chosen)) lessonSelect.value = chosen;
      }
      if (deps.locales) {
        localeLabel.textContent = i18n.t('hud.language');
        localeSelect.value = deps.locale?.() ?? '';
      }
      hintButton.textContent = i18n.t('hud.hint');
      hintButton.disabled = false;
      const on = deps.hintsOn?.();
      if (on === undefined) hintButton.removeAttribute('aria-pressed');
      else hintButton.setAttribute('aria-pressed', String(on));
      // ⚠️ BUSY IS NOT OFF. The switch stays on and stays pressable while the engine searches;
      // disabling it would move focus off the control the moment it was used, and would say
      // "this setting is unavailable" when what is true is "the answer is on its way".
      hintButton.dataset.busy = String(deps.hintBusy?.() ?? false);
    }

    if (deps.onMode) {
      modeGroup.legend.textContent = i18n.t('hud.mode');
      const chosen = deps.mode?.() ?? 'w';
      for (const { input, label } of modeGroup.options) {
        label.textContent = i18n.t(`mode.${input.value}`);
        // The short label fits three across an 88-pixel column; the full phrase is what is spoken.
        label.setAttribute('aria-label', i18n.t(`mode.${input.value}.long`));
        input.checked = input.value === chosen;
      }
    }

    if (deps.pieceSets) {
      setLabel.textContent = i18n.t('hud.pieceSet');
      setSelect.value = deps.pieceSet?.() ?? '';
    }

    if (deps.themes) {
      themeLabel.textContent = i18n.t('hud.boardTheme');
      for (const option of themeSelect.options) option.textContent = i18n.t(option.dataset.name ?? '');
      themeSelect.value = deps.theme?.() ?? '';
      if (deps.debug && !report.hidden) fillReport();
    }

    outlineLabel.textContent = i18n.t('hud.outline');
    outlineInput.checked = deps.outline?.() ?? false;

    coordsLabel.textContent = i18n.t('hud.coordinates');
    coordsInput.checked = deps.coordinates();

    const outcome = state().outcome();
    root.dataset.outcome = outcome ? outcome.kind : '';
  }

  refresh();

  return {
    root,
    settings,
    report,
    refresh,
    destroy() {
      for (const { input } of modeGroup.options) input.removeEventListener('change', onModeInput);
      hintButton.removeEventListener('click', onHintClick);
      lessonButton.removeEventListener('click', onLessonClick);
      localeSelect.removeEventListener('change', onLocaleChange);
      strengthSelect.removeEventListener('change', onStrengthChange);
      protectedInput.removeEventListener('change', onProtectedChange);
      visionSelect.removeEventListener('change', onVisionChange);
      motionInput.removeEventListener('change', onMotionChange);
      outlineInput.removeEventListener('change', onOutlineChange);
      setSelect.removeEventListener('change', onSetChange);
      themeSelect.removeEventListener('change', onThemeChange);
      themeSelect.removeEventListener('mousedown', showReport);
      themeSelect.removeEventListener('change', hideReport);
      themeSelect.removeEventListener('blur', hideReport);
      report.remove();
      coordsInput.removeEventListener('change', onCoordsChange);
      backButton.removeEventListener('click', onBackClick);
      forwardButton.removeEventListener('click', onForwardClick);
      root.remove();
    },
  };
}
