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
// `8·k`, so 16 px at the k=2 floor), it honours the reader's own font size, the difficulty control
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
import type { Difficulty } from '../chess/engine/difficulty.ts';
import { DIFFICULTIES } from '../chess/engine/difficulty.ts';
import type { Rules } from '../chess/rules.ts';
import type { GameState } from '../chess/state.ts';
import type { PieceType, Side } from '../chess/types.ts';
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
  readonly rules: Rules;
  readonly state: GameState;
  difficulty(): Difficulty;
  onDifficulty(level: Difficulty): void;
  highContrast(): boolean;
  onHighContrast(on: boolean): void;
  /** A key from the engine's VIZ_MODES, or 'normal'. */
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
   * Which side the player takes. Changing it starts a new game — there is no honest way to swap
   * sides in the middle of one — so the control says so and the composition root asks.
   */
  playerSide?(): Side;
  onPlayerSide?(side: Side): void;

  /** The drawings available for the pieces. Only the flat view has any; the projected view draws
   * geometry and has nothing to choose between. */
  pieceSets?: readonly { readonly key: string; readonly label: string }[];
  pieceSet?(): string;
  onPieceSet?(key: string): void;
  coordinates(): boolean;
  onCoordinates(on: boolean): void;
  /** Whether the score sheet can be walked back or forward from where it stands. */
  canTakeBack(): boolean;
  canReplay(): boolean;
  onTakeBack(): void;
  onReplay(): void;
}

export interface Hud {
  readonly root: HTMLElement;
  /**
   * The measured contrast of every palette, side by side, shown while one is being chosen. It
   * lives OUTSIDE the panel — in the space the board leaves — because a table six columns wide
   * cannot be read in an 88-pixel column, and because it is about the board, not about the panel.
   */
  readonly report: HTMLElement;
  refresh(): void;
  destroy(): void;
}

/** Figurine letters. Not the piece NAME — that is the screen reader's job, and it is spoken. */
const GLYPH: Readonly<Record<PieceType, string>> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
};

/** The three views and the page each one lives on. `null` is a view that is not built yet. */
const VIEW_PAGES: readonly (readonly [ViewKind, string | null])[] = [
  ['2d', '2d.html'],
  ['2.5d', 'index.html'],
  ['3d', null],
];

/** Heaviest first, so a captured queen is not buried behind six pawns. */
const ORDER: readonly PieceType[] = ['q', 'r', 'b', 'n', 'p'];

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
  const report = doc.createElement('aside');
  report.className = 'theme-report';
  report.id = 'theme-report';
  report.hidden = true;
  const reportTitle = doc.createElement('h2');
  const reportTable = doc.createElement('table');
  const reportFloor = doc.createElement('p');
  reportFloor.className = 'theme-report-floor';
  report.append(reportTitle, reportTable, reportFloor);

  const views = doc.createElement('nav');
  views.className = 'hud-views';
  const viewLinks: { kind: ViewKind; el: HTMLElement }[] = [];

  if (deps.view) {
    const here = deps.view;
    for (const [kind, href] of VIEW_PAGES) {
      // ⚠️ The 3D view does not exist yet. It is shown and disabled rather than hidden, because a
      // control that appears later moves the other two, and because saying "not yet" is more
      // useful than pretending there were only ever two.
      const pending = href === null;
      const el = doc.createElement(pending ? 'span' : 'a');
      el.className = 'hud-view';
      el.dataset.view = kind;
      if (!pending) (el as HTMLAnchorElement).href = href;
      if (kind === here) el.setAttribute('aria-current', 'page');
      if (pending) el.setAttribute('aria-disabled', 'true');
      views.appendChild(el);
      viewLinks.push({ kind, el });
    }
    root.appendChild(views);
  }

  // --- turn ------------------------------------------------------------------
  const turn = doc.createElement('p');
  turn.className = 'hud-turn';
  const swatch = doc.createElement('span');
  swatch.className = 'hud-swatch';
  swatch.setAttribute('aria-hidden', 'true');   // colour alone says nothing; the text carries it
  const turnText = doc.createElement('span');
  turn.append(swatch, turnText);

  // --- captured --------------------------------------------------------------
  const capturedBox = doc.createElement('section');
  const capturedTitle = doc.createElement('h2');
  const capturedByPlayer = doc.createElement('p');
  const capturedByOpponent = doc.createElement('p');
  capturedByPlayer.className = 'hud-captured';
  capturedByOpponent.className = 'hud-captured';
  capturedBox.append(capturedTitle, capturedByPlayer, capturedByOpponent);

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

  // --- difficulty ------------------------------------------------------------
  const difficultyBox = doc.createElement('p');
  const difficultyLabel = doc.createElement('label');
  const difficultySelect = doc.createElement('select');
  difficultySelect.id = 'hud-difficulty';
  difficultyLabel.htmlFor = difficultySelect.id;
  for (const level of DIFFICULTIES) {
    const option = doc.createElement('option');
    option.value = level;
    difficultySelect.appendChild(option);
  }
  difficultyBox.append(difficultyLabel, difficultySelect);

  // --- high contrast ---------------------------------------------------------
  const contrastBox = doc.createElement('p');
  const contrastInput = doc.createElement('input');
  contrastInput.type = 'checkbox';
  contrastInput.id = 'hud-contrast';
  const contrastLabel = doc.createElement('label');
  contrastLabel.htmlFor = contrastInput.id;
  contrastLabel.className = 'hud-check';
  contrastBox.append(contrastInput, contrastLabel);

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
  for (const mode of [{ key: 'normal', nome: 'viz.normal' }, ...VIZ_CORRECTIONS]) {
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

  // --- which side you play ---------------------------------------------------
  const sideBox = doc.createElement('p');
  const sideLabel = doc.createElement('label');
  const sideSelect = doc.createElement('select');
  sideSelect.id = 'hud-side';
  sideLabel.htmlFor = sideSelect.id;
  for (const value of ['w', 'b'] as const) {
    const option = doc.createElement('option');
    option.value = value;
    sideSelect.appendChild(option);
  }
  sideBox.append(sideLabel, sideSelect);

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

  root.append(turn, capturedBox, movesBox);
  if (deps.onPlayerSide) root.appendChild(sideBox);
  root.append(difficultyBox, contrastBox);
  if (deps.pieceSets) root.appendChild(setBox);
  if (deps.themes) root.appendChild(themeBox);
  root.append(visionBox, motionBox);
  if (deps.onOutline) root.appendChild(outlineBox);
  root.appendChild(coordsBox);

  function onDifficultyChange(): void {
    deps.onDifficulty(difficultySelect.value as Difficulty);
  }
  difficultySelect.addEventListener('change', onDifficultyChange);

  function onContrastChange(): void { deps.onHighContrast(contrastInput.checked); }
  contrastInput.addEventListener('change', onContrastChange);

  function onVisionChange(): void { deps.onVision(visionSelect.value); }
  visionSelect.addEventListener('change', onVisionChange);

  function onMotionChange(): void { deps.onReducedMotion(motionInput.checked); }
  motionInput.addEventListener('change', onMotionChange);

  function onOutlineChange(): void { deps.onOutline?.(outlineInput.checked); }
  outlineInput.addEventListener('change', onOutlineChange);

  function onSideChange(): void { deps.onPlayerSide?.(sideSelect.value as Side); }
  sideSelect.addEventListener('change', onSideChange);

  function onSetChange(): void { deps.onPieceSet?.(setSelect.value); }
  setSelect.addEventListener('change', onSetChange);

  function onThemeChange(): void { deps.onTheme?.(themeSelect.value); }
  themeSelect.addEventListener('change', onThemeChange);

  // On screen exactly while someone is choosing, because that is what it describes.
  const showReport = (): void => { report.hidden = false; fillReport(); };
  const hideReport = (): void => { report.hidden = true; };
  themeSelect.addEventListener('focus', showReport);
  themeSelect.addEventListener('blur', hideReport);
  themeSelect.addEventListener('pointerenter', showReport);
  themeSelect.addEventListener('pointerleave', () => {
    if (doc.activeElement !== themeSelect) hideReport();
  });

  /** Redraws the whole matrix: one row per measured pair, one column per palette. */
  function fillReport(): void {
    if (!deps.themes) return;
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

  function capturedFor(side: Side): string {
    // Reading the history rather than keeping a tally: one source of truth, and a taken-back move
    // corrects the list for free instead of needing its own undo path.
    const taken: PieceType[] = [];
    for (const move of rules.history()) {
      if (move.captured && move.captured.side === side) taken.push(move.captured.type);
    }
    taken.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    return taken.map((t) => GLYPH[t]).join('');
  }

  function describeCaptured(side: Side): string {
    const glyphs = capturedFor(side);
    return glyphs || '—';
  }

  /** "1. e4 e5" per line, which is how a scoresheet reads. */
  function fillMoves(): void {
    const history = rules.history();
    movesList.replaceChildren();
    for (let i = 0; i < history.length; i += 2) {
      const item = doc.createElement('li');
      item.textContent = history[i + 1]
        ? `${history[i].san} ${history[i + 1].san}`
        : history[i].san;
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

    const side = rules.turn();
    swatch.dataset.side = side;
    turnText.textContent = i18n.t(`turn.${side}`);
    // The heading says what the colour block means, so the block is decoration and not the signal.
    turn.setAttribute('aria-label', `${i18n.t('hud.turn')}: ${i18n.t(`turn.${side}`)}`);

    capturedTitle.textContent = i18n.t('hud.captured');
    capturedByPlayer.textContent = describeCaptured('b');
    capturedByPlayer.setAttribute('aria-label',
      `${i18n.t('turn.w')}: ${describeCaptured('b')}`);
    capturedByOpponent.textContent = describeCaptured('w');
    capturedByOpponent.setAttribute('aria-label',
      `${i18n.t('turn.b')}: ${describeCaptured('w')}`);

    movesTitle.textContent = i18n.t('hud.moves');
    movesList.setAttribute('aria-label', i18n.t('hud.movesRegion'));
    fillMoves();

    backText.textContent = i18n.t('hud.takeBackShort');
    forwardText.textContent = i18n.t('hud.replayShort');
    backButton.setAttribute('aria-label', i18n.t('hud.takeBack'));
    forwardButton.setAttribute('aria-label', i18n.t('hud.replay'));
    backButton.disabled = !deps.canTakeBack();
    forwardButton.disabled = !deps.canReplay();

    difficultyLabel.textContent = i18n.t('hud.difficulty');
    for (const option of difficultySelect.options) {
      option.textContent = i18n.t(`difficulty.${option.value}`);
    }
    difficultySelect.value = deps.difficulty();

    contrastLabel.textContent = i18n.t('hud.highContrast');
    contrastInput.checked = deps.highContrast();

    // These labels come from the ENGINE's catalogue, not this game's: the modes are the engine's
    // and it already names them in all three languages. Restating them here would be a second
    // copy to drift.
    visionLabel.textContent = i18n.t('hud.vision');
    for (const option of visionSelect.options) {
      option.textContent = engineT(option.dataset.nome ?? '');
    }
    visionSelect.value = deps.vision();

    motionLabel.textContent = i18n.t('hud.reducedMotion');
    motionInput.checked = deps.reducedMotion();

    if (deps.onPlayerSide) {
      sideLabel.textContent = i18n.t('hud.playAs');
      for (const option of sideSelect.options) option.textContent = i18n.t(`turn.${option.value}`);
      sideSelect.value = deps.playerSide?.() ?? 'w';
    }

    if (deps.pieceSets) {
      setLabel.textContent = i18n.t('hud.pieceSet');
      setSelect.value = deps.pieceSet?.() ?? '';
    }

    if (deps.themes) {
      themeLabel.textContent = i18n.t('hud.boardTheme');
      for (const option of themeSelect.options) option.textContent = i18n.t(option.dataset.name ?? '');
      themeSelect.value = deps.theme?.() ?? '';
      themeSelect.setAttribute('aria-describedby', report.id);
      if (!report.hidden) fillReport();
    }

    outlineLabel.textContent = i18n.t('hud.outline');
    outlineInput.checked = deps.outline?.() ?? false;

    coordsLabel.textContent = i18n.t('hud.coordinates');
    coordsInput.checked = deps.coordinates();

    const outcome = state.outcome();
    root.dataset.outcome = outcome ? outcome.kind : '';
  }

  refresh();

  return {
    root,
    report,
    refresh,
    destroy() {
      difficultySelect.removeEventListener('change', onDifficultyChange);
      contrastInput.removeEventListener('change', onContrastChange);
      visionSelect.removeEventListener('change', onVisionChange);
      motionInput.removeEventListener('change', onMotionChange);
      outlineInput.removeEventListener('change', onOutlineChange);
      sideSelect.removeEventListener('change', onSideChange);
      setSelect.removeEventListener('change', onSetChange);
      themeSelect.removeEventListener('change', onThemeChange);
      themeSelect.removeEventListener('focus', showReport);
      themeSelect.removeEventListener('blur', hideReport);
      report.remove();
      coordsInput.removeEventListener('change', onCoordsChange);
      backButton.removeEventListener('click', onBackClick);
      forwardButton.removeEventListener('click', onForwardClick);
      root.remove();
    },
  };
}
