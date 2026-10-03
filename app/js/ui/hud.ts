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

import type { Rules } from '../chess/rules.ts';
import type { GameState } from '../chess/state.ts';

/** One person as white, one as black, or two people sharing the board. */
export type GameMode = 'w' | 'b' | 'two';
import { BOARD_THEMES } from './board-themes.ts';
import { contrastRows } from './contrast-report.ts';
import { VIEW_KINDS } from '../boot/views.ts';
import type { I18n } from '../i18n/index.ts';

/** Which drawing of the board this page is. Also which of the three buttons is the current one. */
export type ViewKind = '2d' | '2.5d' | '3d';

export interface HudDeps {
  readonly doc: Document;
  /**
   * Which view is drawing NOW. Omit and the switcher is left out entirely.
   *
   * ⚠️ AN ACCESSOR SINCE VIEWS BECAME SWAPPABLE. It was a value, which was right while a page was a
   * view and became a capture the moment one document could show all three.
   */
  readonly view?: () => ViewKind;
  /** Asked to change the board. The composition root owns what that means. */
  readonly onView?: (kind: ViewKind) => void;
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
  /**
   * The opening the game is in, already named, or null.
   *
   * ⚠️ A STRING RATHER THAN THE BOOK. The HUD does not fetch 230 kB of opening names and does not
   * know what an ECO code is; whoever owns the game looks it up and hands over the answer.
   */
  opening?(): string | null;
  reducedMotion(): boolean;
  onReducedMotion(on: boolean): void;
  /**
   * The piece-outline switch. OPTIONAL: the projected board has an outline to turn off and the
   * flat board has none, and a control that had to be repurposed to stay on both pages ended up
   * with a label that lied about its own question.
   */
  /**
   * Whether the renderer drawing RIGHT NOW has an outline to switch.
   *
   * ⚠️ SEPARATE FROM `onOutline` BECAUSE A DELEGATING WRAPPER IS ALWAYS PRESENT. Once the shell
   * stopped copying the view's controls and started forwarding to whichever view is mounted, the
   * mere existence of `onOutline` stopped meaning "this board has an outline" — the wrapper exists
   * even when the view behind it lends nothing. 📏 Measured: only the projected board has one.
   * Absent, the control behaves as it always did.
   */
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

  /**
   * The opponent's rating, from `STRENGTH_LADDER`.
   *
   * ⚠️ This REPLACED an easy/medium/hard control, and the replacement is the whole reason there
   * is only one engine left. A rating is a number a child may already have; "medium" is a number
   * nobody has. Two engines meant two ladders that could not be compared with each other, and one
   * of the two could not honour a rating at all.
   */

  /**
   * Asks the engine what it would play. Absent on a board with no engine, which is the two-player
   * mode: there is nobody to ask.
   */
  /**
   * The lessons this page can open, in the order they should be taken, with what is already
   * learned marked.
   *
   * ⚠️ ABSENT WHERE A PAGE CANNOT DRAW A LESSON MARK. That was the solid page until
   * `render3d/scene.ts` grew a marker channel; all three teach now. The gate stays, because a page
   * that could not show "look at this square" should not offer a mode whose main instruction is
   * exactly that.
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

  /**
   * The drawings available for the pieces, READ WHEN NEEDED rather than captured.
   *
   * ⚠️ THE COMMENT HERE SAID "Only the flat view has any; the projected view draws geometry and has
   * nothing to choose between", AND IT WAS WRONG. Measured 2026-09-11: all three views offer a list
   * — the flat board offers glyph sets, the two canvas views offer piece DESIGNS. The control has
   * never been absent; only its contents differ.
   *
   * ⚠️ AND THAT IS EXACTLY WHY THIS IS A FUNCTION NOW. It was an array, captured once at
   * construction, which is correct while a page has one view for its lifetime and wrong the moment
   * a view can be swapped underneath the panel: the select would go on offering the previous
   * renderer's drawings, and choosing one would do nothing. Not an error — a dead control.
   */
  pieceSets?: () => readonly { readonly key: string; readonly label: string }[];
  pieceSet?(): string;
  onPieceSet?(key: string): void;
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
   * The controls you set once and then forget: the piece drawing, the board colours, the
   * colour-vision correction, reduced motion and the coordinate labels.
   *
   * ⚠️ THE VIEW SWITCH LEFT THIS LIST on 2026-09-11 — see `views` below and the comment where it is
   * built. It was swept in here with the others because it is set once; it went back out because
   * what it does is not the same kind of thing.
   *
   * ⚠️ NOT INSIDE `root`. They are built and refreshed by the HUD because that is where their
   * state and callbacks live, but they are SHOWN wherever the composition root puts them — which
   * is the pause menu. Appending this to two places at once would silently move it: a node has one
   * parent.
   */
  readonly settings: HTMLElement;
  /**
   * The three board views — 2D, 2.5D, 3D — as a row of links.
   *
   * ⚠️ ALSO NOT INSIDE `root`, and for the same reason `settings` is not: the HUD builds it because
   * that is where the current view and its callbacks live, and the composition root decides where it
   * is seen. It goes under the accessibility bar, at the top of the side column, where it is a
   * sibling of the panel rather than a child — so a lesson hiding the panel does not take it away.
   *
   * Empty when the page did not ask for a view switch; mounting an empty node costs nothing and is
   * cheaper than a branch at the mounting site.
   */
  readonly views: HTMLElement;
  /**
   * The measured contrast table, or an empty node when `debug` is off. It lives OUTSIDE the panel
   * — in the space the board leaves — because six columns cannot be read in an 88-pixel column.
   */
  readonly report: HTMLElement;
  refresh(): void;
  destroy(): void;
}

/** The three views and the page each one lives on. `null` is a view that is not built yet. */

export function createHud(deps: HudDeps): Hud {
  const { doc, i18n, rules, state } = deps;

  const root = doc.createElement('div');
  /*
   * ⚠️ `chess-hud` AND NOT `hud`, FOR THE SAME REASON `chess-pause` IS NOT `pause-menu`, and this
   * one would have been the more expensive collision of the two. The engine's own stylesheet — the
   * one this game is about to import, so that the accessibility bar it mounts looks like something
   * — carries four rules on `.hud`, and two of them are not cosmetic:
   *
   *   · `.hud{max-width:1000px;margin:0 auto;padding:0 1rem .5rem;display:flex;gap:1.5rem;
   *     flex-wrap:wrap}` — a centred, wrapping ROW, applied to a panel that is a measured 280x360
   *     COLUMN. Probed on the built page under the old name: `max-width: 1000px`, `flex-wrap:
   *     wrap`, `gap: 24px`, all of it unconditional.
   *   · `body.blind-mode .hud{visibility:hidden}`.
   *
   * ⚠️ AND THE SECOND ONE IS A CORRECTION TO WHAT THIS COMMENT FIRST SAID. It claimed that turning
   * blind mode on — from the very bar being adopted to offer it — would make the panel disappear.
   * Measured afterwards, on the running page: clicking the blind icon leaves `document.body.
   * className` EMPTY, so that rule never fires here. `body.blind-mode` is written by the engine's
   * `ui/shell`, which `createGame` deliberately does not mount. The panel stays 264x331 and
   * visible through the toggle, verified on all three pages.
   *
   * The rename was still necessary, and the first rule is the whole reason: it needs no class on
   * anything. Keeping a claim that sounds worse than the truth would have cost the true one its
   * credibility the first time somebody checked.
   *
   * Two projects named their panel the same thing; the shared vocabulary is the engine's, so this
   * is the side that moves. Only the bare class changes — the `hud-*` children collide with
   * nothing and keep their names, which is what keeps the diff readable.
   */
  root.className = 'chess-hud';

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
  /*
   * ⚠️ BESIDE THE MOVE LIST, NOT IN THE SETTINGS. It is a fact about the game in progress — the
   * same kind of thing as whose turn it is — and it changes as the game does. The settings are for
   * choices; this is a readout.
   */
  const openingBox = doc.createElement('p');
  openingBox.className = 'hud-opening';
  openingBox.hidden = true;

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
    /*
     * ⚠️ BUTTONS SINCE THE THREE PAGES WENT, AND THEY WERE LINKS ON PURPOSE UNTIL THEN. The reason
     * is recorded in the test that pinned it: real links give back what a button takes away —
     * opening a view in another tab. That was a true affordance while each view WAS a page.
     *
     * It stopped being one when the views became renderers swapped inside one document: a link to
     * `2d.html` would be a link to a page that no longer exists, and the middle click it afforded
     * would land on nothing. A button says what this now is — a control that changes the board in
     * front of you, with no title screen in between.
     */
    for (const kind of VIEW_KINDS) {
      const el = doc.createElement('button');
      el.type = 'button';
      el.className = 'hud-view';
      el.dataset.view = kind;
      el.addEventListener('click', () => { deps.onView?.(kind); });
      views.appendChild(el);
      viewLinks.push({ kind, el });
    }
    /*
     * ⚠️ NOT `settings.appendChild(views)` ANY MORE, AND THE MOVE IS A REVERSAL ASKED FOR BY NAME.
     * `32d5227` swept the view switch into the pause menu with the six set-once controls, on the
     * reasoning that they are all chosen once and then forgotten. The Dev's report of 2026-09-11 is
     * that the three buttons «sumiram»: from the side panel they were gone, and behind a menu that
     * opens on a key they were not found.
     *
     * The others belong there and stay there. This one does not sit with them, and the difference is
     * what a control DOES rather than how often it is touched: changing the board's view is how a
     * player looks at the same position another way, which is closer to the sonar than to a colour
     * preference. It is mounted by the composition root now, next to the accessibility bar.
     */
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

  // ⚠️ COLOUR VISION SELECT RETIRED (Wave 2d, 2026-10-02). It was built here and appended to
  // `settings`, which has not reached the DOM since Wave 2c. The engine's a11y-bar's cvd icon
  // drives chess's `setPlayerCorrection` hook, so the correction is still reachable — just
  // not through a chess-side select that was never visible. The three corrections (`fix-protan`,
  // `fix-deuter`, `fix-tritan`) stay in chess's i18n for the day a UI needs them again.

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

  // ⚠️ `modeGroup` RETIRED (Wave 2d, 2026-10-02): the who-plays choice lives in
  // `hooks.gameOptions` as `{id: 'mode', kind: 'list'}` and the engine's `.ctrl-row` panel
  // renders it. The HUD's own radio group was built here and appended to `settings`, which has
  // not reached the DOM since Wave 2c.

  // --- protected mode ---------------------------------------------------------
  // ⚠️ PROTECTED CHECKBOX RETIRED (Wave 2d, 2026-10-02): protected mode lives in
  // `hooks.gameOptions` as `{id: 'protected', kind: 'switch'}` with the same side effects —
  // persist, clear blunder bar, refresh HUD, re-ask engine. The HUD's own checkbox was appended
  // to `settings`, which has not reached the DOM since Wave 2c.

  // --- how strong the opponent plays ------------------------------------------
  // ⚠️ STRENGTH SELECT RETIRED (Wave 2d, 2026-10-02): the ELO ladder lives in
  // `hooks.gameOptions` as `{id: 'strength', kind: 'list'}` and the engine's `.ctrl-row` panel
  // renders it. The HUD's own select was appended to `settings` which has not reached the DOM
  // since Wave 2c.

  // --- which drawing the pieces use ------------------------------------------
  const setBox = doc.createElement('p');
  const setLabel = doc.createElement('label');
  const setSelect = doc.createElement('select');
  setSelect.id = 'hud-set';
  setLabel.htmlFor = setSelect.id;
  /**
   * Fill the select from whatever view is mounted now.
   *
   * ⚠️ A FUNCTION BECAUSE IT RUNS TWICE: once here, and again from `refresh()` whenever the mounted
   * view's list is no longer the one on screen. Built inline it could only ever describe the view
   * that happened to be first.
   */
  function fillPieceSets(): void {
    const items = deps.pieceSets?.() ?? [];
    const shown = [...setSelect.options].map((o) => o.value).join(',');
    if (shown === items.map((i) => i.key).join(',')) return;
    setSelect.replaceChildren();
    for (const item of items) {
      const option = doc.createElement('option');
      option.value = item.key;
      // Written straight in: a typeface's name is the same string in every language.
      option.textContent = item.label;
      setSelect.appendChild(option);
    }
  }

  if (deps.pieceSets) {
    fillPieceSets();
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

  // ⚠️ OUTLINE SWITCH RETIRED (Wave 2d, 2026-10-02): piece outline lives in
  // `hooks.gameOptions` as `{id: 'outline', kind: 'switch'}` and the engine's `.ctrl-row` panel
  // renders it. The HUD's own checkbox was appended to `settings`, which has not reached the DOM
  // since Wave 2c.

  // ⚠️ COORDINATES SWITCH RETIRED (Wave 2d, 2026-10-02): file/rank labels live in
  // `hooks.gameOptions` as `{id: 'coordinates', kind: 'switch'}`. The HUD's own checkbox was
  // appended to `settings`, which has not reached the DOM since Wave 2c.

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
  // A select and a verb, like the strength control below it, rather than a button per lesson:
  // the HUD is 88 logical pixels wide and a list of lessons would be most of it.
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

  root.append(turn, openingBox, movesBox);
  if (deps.lessons) root.appendChild(lessonBox);
  if (deps.onHint) root.appendChild(hintBox);
  if (deps.scoreboard) root.appendChild(deps.scoreboard);
  /*
   * ⚠️ `modeGroup.box`, `strengthBox` AND `protectedBox` GO TO THE ENGINE'S PANEL IN WAVE 2c.
   * They are built above and refresh() still reads them so a late unskip has somewhere to find
   * them, but nothing appends them to the DOM: the three settings live in `hooks.gameOptions`,
   * drawn by the engine's `.ctrl-row` panel (ADR-0129). The HUD side column keeps `turn`,
   * `opening`, `moves`, `lessons`, `hint` and the player strips — all chess-game STATE, not
   * settings a child configures.
   */
  // `hud.settings` was adopted into `.chess-pause` until Onda 2b retired it. The elements are
  // kept so this file compiles until the follow-up cleanup, but nothing attaches `settings` to
  // the DOM any more; its controls duplicate what `hooks.gameOptions` renders in the engine's
  // card. The next commit removes the whole settings panel from this file.
  if (deps.pieceSets) settings.appendChild(setBox);
  if (deps.themes) settings.appendChild(themeBox);
  settings.append(motionBox);

  function onHintClick(): void { deps.onHint?.(); }
  hintButton.addEventListener('click', onHintClick);

  function onLessonClick(): void { deps.onLesson?.(lessonSelect.value); }
  lessonButton.addEventListener('click', onLessonClick);

  function onLocaleChange(): void { deps.onLocale?.(localeSelect.value); }
  localeSelect.addEventListener('change', onLocaleChange);


  function onMotionChange(): void { deps.onReducedMotion(motionInput.checked); }
  motionInput.addEventListener('change', onMotionChange);


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
    /*
     * ⚠️ THE CURRENT ONE IS MARKED HERE AND NOT AT CONSTRUCTION, because it changes now. It used to
     * be decided once, from the page you were on; a view that can be swapped makes that a capture
     * like any other, and the symptom would be a switcher permanently pointing at whichever board
     * the page opened with.
     *
     * `aria-current="true"` rather than `"page"`: it is still the current item of a set, and it is
     * no longer a page. The `pending` branch went with the links — all three views exist, and a
     * `<span>` standing in for one that did not was the last trace of when two did.
     */
    const hereNow = deps.view?.();
    for (const { kind, el } of viewLinks) {
      const name = i18n.t(`view.${kind === '2.5d' ? '25d' : kind}`);
      el.textContent = name;
      el.setAttribute('aria-label', i18n.t('view.go', { name }));
      if (kind === hereNow) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
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
    motionLabel.textContent = i18n.t('hud.reducedMotion');
    motionInput.checked = deps.reducedMotion();

    /*
     * ================= ⚠️ THESE THREE ARE NOT THE HINT'S, AND THEY USED TO BE =================
     * The lesson list, the language selector and the opening name sat inside `if (deps.onHint)`
     * — one level too deep, which `tsc` cannot see and a reader skims straight past because
     * every line in it is correct.
     *
     * ⚠️ THE SHELL WITHHOLDS `onHint` IN A TWO-PLAYER GAME, deliberately: there is no engine to
     * ask, so there is no hint button. So on one board shared by two people the opening was
     * never named, the lesson dropdown was never filled, and the language selector never
     * followed a change of language — three features switched off by a brace.
     *
     * Each has its own guard already, which is what made the nesting invisible: nothing here
     * changes except how deep it sits.
     */
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
    const opening = deps.opening?.() ?? null;
    openingBox.hidden = opening === null;
    // ⚠️ The NAME is not translated; the label around it is. See `openings/opening.ts`: "Ruy
    // Lopez" is what it is called in all three languages, and inventing our own spellings of
    // three thousand of them would make this game the only place they read that way.
    openingBox.textContent = opening === null ? '' : i18n.t('hud.opening', { name: opening });
    if (deps.onHint) {
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

    if (deps.pieceSets) {
      setLabel.textContent = i18n.t('hud.pieceSet');
      // The list first: a swapped view brings different drawings, and the value below has to be
      // chosen from the options that are actually there.
      fillPieceSets();
      setSelect.value = deps.pieceSet?.() ?? '';
    }

    if (deps.themes) {
      themeLabel.textContent = i18n.t('hud.boardTheme');
      for (const option of themeSelect.options) option.textContent = i18n.t(option.dataset.name ?? '');
      themeSelect.value = deps.theme?.() ?? '';
      if (deps.debug && !report.hidden) fillReport();
    }

    const outcome = state().outcome();
    root.dataset.outcome = outcome ? outcome.kind : '';
  }

  refresh();

  return {
    root,
    settings,
    views,
    report,
    refresh,
    destroy() {
      hintButton.removeEventListener('click', onHintClick);
      lessonButton.removeEventListener('click', onLessonClick);
      localeSelect.removeEventListener('change', onLocaleChange);
      motionInput.removeEventListener('change', onMotionChange);
      setSelect.removeEventListener('change', onSetChange);
      themeSelect.removeEventListener('change', onThemeChange);
      themeSelect.removeEventListener('mousedown', showReport);
      themeSelect.removeEventListener('change', hideReport);
      themeSelect.removeEventListener('blur', hideReport);
      report.remove();
      backButton.removeEventListener('click', onBackClick);
      forwardButton.removeEventListener('click', onForwardClick);
      root.remove();
    },
  };
}
