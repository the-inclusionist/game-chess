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
import { contrastRows, type ContrastRow } from './contrast-report.ts';
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
  /**
   * The opening the game is in, already named, or null.
   *
   * ⚠️ A STRING RATHER THAN THE BOOK. The HUD does not fetch 230 kB of opening names and does not
   * know what an ECO code is; whoever owns the game looks it up and hands over the answer.
   */
  opening?(): string | null;
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
  /**
   * Whether the lesson picker should be SHOWN. Absent means always, which is what every consumer
   * but the shell wants.
   *
   * ⚠️ THE TITLE SCREEN'S CHOICE HAS TO MEAN SOMETHING (the Dev, 2026-10-04). A child who presses
   * JOGAR is choosing a game, and the panel was offering them "Aulas", a dropdown of thirteen
   * lessons and a "Começar" button anyway — the two doors diverged for one click and then met
   * again in the same panel.
   *
   * It is a predicate rather than a flag because the HUD is BUILT BEFORE THE DOOR IS CHOSEN:
   * `splash.done` resolves on a click, which is always later than the panel that asks this.
   *
   * ⚠️ AND THE BOX IS HIDDEN, NOT WITHHELD. `lessons()` keeps running and the list keeps being
   * rebuilt, because the picker has to be correct the instant it appears — a child who finishes a
   * lesson comes back to this panel to choose the next one.
   */
  lessonsVisible?(): boolean;
  onLesson?(id: string): void;
  onHint?(): void;
  hintBusy?(): boolean;
  /**
   * Whether the engine's suggestions are DRAWN. Present makes the pair switches, not verbs.
   *
   * ========================= ⚠️ TWO INDEPENDENT SWITCHES =========================
   * The Dev, 2026-10-04: «Setas» on the left, «Protetor de Lances» on the right, "e torne-os
   * independentes, ou seja, uma pessoa poderá ter setas ligadas e protetor de lances ligado ao
   * mesmo tempo."
   *
   * They were one three-valued setting for a few hours, on my reading that the second existed to
   * withhold what the first showed. The names are what settle it: one is a DISPLAY and the other
   * is a RULE. Wanting to see the good moves AND be stopped from playing the others is the
   * ordinary case, not a contradiction — and with both on, the arrows say what the guard will
   * accept, which is the gentlest way either of them can work.
   */
  arrows?(): boolean;
  onArrows?(on: boolean): void;
  /** Whether a move outside the engine's set is refused. Independent of `arrows`. */
  guard?(): boolean;
  onGuard?(on: boolean): void;

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
   * What to CALL the piece list, which is not the same question in every view.
   *
   * ⚠️ THE DEV ASKED FOR THREE ENTRIES — "desenho das peças (somente no 2D)", "conjunto de peças
   * 2.5D", "conjunto de peças 3D" — and they are one control, because only one board is ever
   * drawing. Three selects would mean two of them permanently hidden and a reader hearing a list
   * of settings that do not apply. One control whose LABEL says which board it belongs to keeps
   * his "somente no tabuleiro X" exactly, and keeps the panel honest about what is reachable.
   */
  pieceSetsLabel?(): string;
  /** The opponent's rating ladder, named. See `chess/engine/strength.ts`. */
  strengths?: readonly { readonly elo: number; readonly name: string }[];
  strength?(): number;
  onStrength?(elo: number): void;
  /**
   * The piece outline, when the board drawing right now HAS one.
   *
   * ⚠️ `undefined` MEANS THIS BOARD HAS NO OUTLINE, which is not the same as "it is off". The flat
   * board draws glyphs and has nothing to outline; a switch offered there would be a control that
   * answers nothing, and 📏 only the projected board has one.
   */
  outline?(): boolean | undefined;
  onOutline?(on: boolean): void;
  /** The file letters and rank numbers. Every board has them. */
  coordinates?(): boolean;
  onCoordinates?(on: boolean): void;
  /**
   * ========================= THE INTERFACE LANGUAGE, NAMED BY COUNTRY =========================
   * The Dev, 2026-10-04: "adicione mais um dropdown: países", in the same message that takes the
   * engine's quick bar away — and that bar is where the language lived, as «Idioma: Português
   * (Brasil)». So this is the door that replaces it, and his word for it is the one used here.
   *
   * ⚠️ A LANGUAGE IS NOT A COUNTRY and the list says so by what it does, not by a footnote: it
   * sets the LOCALE, and the country is how the choice is NAMED, because a child who cannot yet
   * read «Español» can recognise «Espanha». Spanish is spoken in twenty countries and English in
   * dozens; the one named here is the one whose flag the engine itself already used for Portuguese.
   */
  countries?: readonly { readonly code: string; readonly label: string }[];
  country?(): string;
  onCountry?(code: string): void;
  /**
   * ========================= WHO IS SITTING AT THE BOARD =========================
   * The Dev, 2026-10-04: "acima de «Voltar» e «Avançar» quero um checkbox: «2 Jogadores» e um
   * botão: «CPU joga!»."
   *
   * ⚠️ A CHECKBOX AND NOT A THREE-WAY LIST, which is what this setting was. «Brancas / Pretas /
   * dois jogadores» answered two questions at once — which colour the human plays and how many
   * humans there are — and could only be changed by reloading the page, because the colour is
   * read at boot. The number of people at the board is a thing that changes mid-game, when a
   * second child pulls up a chair.
   */
  /**
   * ========================= THE THIRD TEACHER =========================
   * The Dev, 2026-10-04: protected mode "vira o novo modo «professor» denominado «Proteção contra
   * lances ruins» e vai para a linha com os botões «Setas» e «Protetor de Lances» antes das Setas."
   *
   * It belongs there. All three are the same kind of thing — somebody standing behind the player —
   * and they differ only in how far they go: one SHOWS the good moves, one REFUSES the others, and
   * this one lets every move through and stops the game when one of them throws it away. Reading
   * them as a row, left to right, is reading them in order of how much they interrupt.
   */
  /**
   * ========================= THE GAME ROW =========================
   * The Dev, 2026-10-04: where the turn row used to be, "três botões: «Nova partida», «<tempo>»
   * (com <tempo> togleando entre 1+0, 2+1, 3+0, 3+2, 5+0, 10+0, 15+10, e «sem tempo»), e «Zerar
   * Relógio» zerando o relógio para o tempo total especificado no botão anterior para cada lado."
   *
   * ⚠️ THE MIDDLE ONE IS A BUTTON THAT CYCLES, not a list, and that is his word — «togleando». A
   * select with eight options would be the obvious shape and the wrong one here: these are a
   * LADDER, read in order, and a child choosing «faster» or «slower» presses the same button
   * again rather than finding a row in a menu.
   *
   * ⚠️ AND CHOOSING A CONTROL DOES NOT ZERO THE CLOCKS, which is why there are three buttons and
   * not two. "«Zerar Relógio» zerando o relógio para o tempo total especificado no botão anterior"
   * — the choice and the act are separate, so changing the control in the middle of a game does
   * not wipe the time two people have already spent.
   */
  /**
   * ========================= TAKING THE GAME AWAY WITH YOU =========================
   * The Dev, 2026-10-04: "o lado de lances deve ter dois botões: 📋 para copiar a partida (notação
   * pgn), 💾 para salvar o arquivo pgn no computador."
   *
   * ⚠️ BESIDE THE «LANCES» HEADING, which is «o lado de lances»: they are about the list, so they
   * read with its title rather than floating under the box. Both are absent where the composition
   * root offers neither — a lesson has no game to take home.
   */
  onCopyPgn?(): void;
  onSavePgn?(): void;
  onNewGame?(): void;
  /** The current control, already written the way it is shown: `5+0`, or «sem tempo». */
  timeControl?(): string;
  /** Moves to the next rung of the ladder. */
  onTimeControl?(): void;
  onResetClock?(): void;
  protect?(): boolean;
  onProtect?(on: boolean): void;
  twoPlayers?(): boolean;
  onTwoPlayers?(on: boolean): void;
  /**
   * «CPU joga!» — the engine takes exactly one move, and then the board is the human's again.
   *
   * ⚠️ IT IS WHAT MAKES THE SOLO GAME SYMMETRIC. With the engine moving only when it is handed the
   * board, a human who wants to play BLACK has no way to let white open — this is that way, and it
   * is also how a player hands over a position they are stuck in without giving up the game.
   */
  onCpuMove?(): void;
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
  /**
   * ⚠️ REMOVED FROM THE PANEL ON 2026-10-04 at the Dev's word — "remova a seção de pontuação
   * (material, engine, erros graves, brancas, pretas)" — and the dep is gone with it rather than
   * kept as an unused hook. The same facts a child needs are still beside the board: the player
   * strips carry the material count and the evaluation, where they belong to the player they are
   * about instead of being a table to read.
   */

  /**
   * Protected mode: the engine stops the game when the player throws it away. Absent where there
   * is nobody to protect anyone from — the two-player board.
   */

  /*
   * ========================= ⚠️ THE CONTRAST TABLE IS NOT BEHIND `?debug` ANY MORE ==============
   * It was, and the argument written here was that it answers "did that ink change break
   * anything" — a maintainer's question, asked while working on the game and never while playing
   * it. The Dev, 2026-10-04: "ao escolher as cores de tabuleiro deveria aparecer a tabela
   * comparativa para entender onde haveria contraste e onde faltaria contraste."
   *
   * That is a different question with the same table. A teacher picking colours for a particular
   * child is choosing BETWEEN palettes, and the only honest way to choose is to see what each one
   * costs: six columns side by side say "this one is kinder to a white piece on a light square and
   * that one is kinder to the squares themselves" in a way no label on a dropdown can.
   *
   * And the old argument had a false premise. It claimed every palette clears the floor on every
   * pair that touches, so there was nothing to warn anyone about. Measured on 2026-10-04: white
   * piece against the light square runs from 1.12 to 2.30 across the six, all of them under 3 —
   * carried by the silhouette rather than by the inks. The table has something to say after all,
   * and the person it has to say it to is the one choosing.
   */
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
   * The measured contrast table, shown while the board-colour control has focus. It lives OUTSIDE
   * the panel — in the space the board leaves — because six columns cannot be read in an 88-pixel
   * column.
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

  // ⚠️ LOCALE SELECT RETIRED (Wave 2d, 2026-10-02): chess hears `engine.onLocaleChange`
  // and the engine's a11y-bar 🌐 icon is the user-facing door. The HUD had a parallel select
  // appended to `settings` (not in the DOM since Wave 2c); comments across the codebase have
  // been claiming it was gone for weeks.

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
  /*
   * ========================= ⚠️ THE TURN ROW LEFT THE PANEL, AND NOT THE DOCUMENT =========================
   * The Dev, 2026-10-04: "remova o [ ] Brancas / [ ] Pretas do painel. Adicione um relógio marcado
   * 5:00 na frente de BRANCAS e um outro igual na frente de PRETAS." The clocks answer "whose turn
   * is it" better than this row did — the one that is draining is the one to move — so the row has
   * nothing left to show.
   *
   * ⚠️ IT STAYS FOR A SCREEN READER, and that is not a hedge. The strips at the top of the board
   * carry `aria-hidden="true"` on purpose: they are "a picture of things said elsewhere in words",
   * and this row was the words. Deleting it outright would have moved the answer from a sentence a
   * reader hears into a colour on a canvas it is told to ignore — on the board of a game whose
   * whole premise is that nothing is carried by sight alone.
   *
   * So: `sr-only`. Gone from the panel, still said.
   */
  /*
   * The three buttons that took the turn row's place on 2026-10-04. See `onNewGame` above.
   */
  const gameBox = doc.createElement('p');
  gameBox.className = 'hud-game';
  const newGameButton = doc.createElement('button');
  newGameButton.type = 'button';
  newGameButton.className = 'hud-game-btn';
  const timeButton = doc.createElement('button');
  timeButton.type = 'button';
  timeButton.className = 'hud-game-btn hud-time';
  const resetClockButton = doc.createElement('button');
  resetClockButton.type = 'button';
  resetClockButton.className = 'hud-game-btn';
  gameBox.append(newGameButton, timeButton, resetClockButton);

  const turn = doc.createElement('p');
  turn.className = 'hud-turn sr-only';
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
  /*
   * ========================= ⚠️ ABOVE THE WALK, WHICH IS WHERE HE PUT IT =========================
   * «2 Jogadores» changes what «Voltar» and «Avançar» mean — in a solo game the engine answers
   * the move you walk back to, in a two-player game nobody does — so the switch reads before the
   * buttons it governs. That is the same argument that moved the walk itself above the move list.
   */
  /*
   * ⚠️ A BUTTON, NOT A CHECKBOX, SINCE 2026-10-04. The Dev: "troque o rótulo de «2 Jogadores» para
   * «2P» e transforme-o num botão como «Setas» e «Protetor de Lances», mas na linha abaixo deles."
   *
   * It is the same kind of thing as the three above it — a setting that is on or off and says so
   * with `aria-pressed` — so it is the same control, and the two rows read as one block about who
   * is helping and who is playing. «CPU joga!» shares the row because it is the other half of the
   * same question: how many people are at the board, and who takes this move.
   */
  const seatBox = doc.createElement('p');
  seatBox.className = 'hud-seat';
  const seatCheck = doc.createElement('button');
  seatCheck.type = 'button';
  seatCheck.id = 'hud-two-players';
  seatCheck.className = 'hud-hint';
  const cpuButton = doc.createElement('button');
  cpuButton.type = 'button';
  cpuButton.className = 'hud-cpu';
  seatBox.append(seatCheck, cpuButton);

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

  // ⚠️ THE NAV LEFT THIS BOX ON 2026-10-04. The Dev's order puts «Voltar | Avançar» ABOVE the
  // move list, not under it: they are the two things a child reaches for while reading the list,
  // and a control below a list that grows is a control that walks away as the game goes on.
  /*
   * ⚠️ A HEADER ROW, so the two buttons sit ON the «LANCES» line rather than under it. The box
   * below is eight lines the Dev measured out by hand; spending one of them on chrome would be
   * taking a line of the game away to make room for a button about the game.
   */
  const movesHead = doc.createElement('div');
  movesHead.className = 'hud-moves-head';
  const copyButton = doc.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'hud-pgn';
  const saveButton = doc.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'hud-pgn';
  movesHead.append(movesTitle, copyButton, saveButton);
  movesBox.append(movesHead, movesList);

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
  // ⚠️ MOTION SWITCH RETIRED (Wave 2d, 2026-10-02): the HUD's checkbox was zombie code
  // since Wave 2c and no `gameOption` was ever opened for motion. Chess reads
  // `window.matchMedia('(prefers-reduced-motion: reduce)').matches` at boot and uses it for the
  // views' animation speed; there is no in-game override until a `gameOption` or an engine a11y
  // icon arrives for it.

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

  /*
   * ⚠️ A `role="group"` WITH A NAME, NOT TWO LOOSE BUTTONS. Two `aria-pressed` switches side by
   * side with nothing joining them are heard as two unrelated settings, and a listener has no way
   * to know that turning one on turns the other off. The group's label is what carries that.
   */
  const hintBox = doc.createElement('div');
  hintBox.className = 'hud-teachers';
  hintBox.setAttribute('role', 'group');
  const protectButton = doc.createElement('button');
  protectButton.type = 'button';
  protectButton.id = 'hud-protect';
  protectButton.className = 'hud-hint';
  const hintButton = doc.createElement('button');
  hintButton.type = 'button';
  hintButton.id = 'hud-hint';
  hintButton.className = 'hud-hint';
  const silentButton = doc.createElement('button');
  silentButton.type = 'button';
  silentButton.id = 'hud-hint-silent';
  silentButton.className = 'hud-hint';
  // ⚠️ PROTECTION FIRST, which is the Dev's order and also the gentlest-first reading: it lets
  // every move through, the arrows show the good ones, the trophy allows only those.
  hintBox.append(protectButton, hintButton, silentButton);

  /*
   * ========================= ⚠️ AN ICON IS NOT A LABEL =========================
   * The Dev, 2026-10-04, asked for these three to become 👨‍🏫, ⬆️ and 🏆 "com a tooltip". A tooltip
   * is a `title`, which a mouse reveals after a second of hovering and a keyboard never reveals at
   * all — so the words go in THREE places and the picture in one:
   *
   *   · `aria-label` — what a screen reader says, because «man teacher» is what it would say
   *     otherwise, and that is the emoji's name rather than the button's meaning;
   *   · `title`      — the tooltip he asked for;
   *   · the emoji    — `aria-hidden`, so the reader does not say the picture AND the label.
   *
   * ⚠️ AND THE ICONS ARE NOT IN THE DICTIONARIES. A picture is the same picture in Portuguese,
   * English and Spanish; only the words around it are translated. Putting 👨‍🏫 in three catalogues
   * would be three chances for them to drift apart.
   */
  const icon = (button: HTMLButtonElement, glyph: string, key: string): void => {
    const mark = doc.createElement('span');
    mark.className = 'hud-icon';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = glyph;
    button.replaceChildren(mark);
    button.title = i18n.t(key);
    button.setAttribute('aria-label', i18n.t(key));
  };

  /*
   * ========================= ⚠️ THE SETTINGS COME BACK TO THE PANEL =========================
   * The Dev, 2026-10-04: these seven go "abaixo da seção PONTUAÇÃO do painel lateral direito
   * (ficará acessível por rolagem)".
   *
   * They were taken OUT of this panel in Wave 2c/2d and given to the engine's pause card as
   * `hooks.gameOptions`, on the argument that the side column keeps game STATE and the engine
   * keeps settings. That argument still holds for the settings a child sets once — blind mode,
   * captions, colour correction. It does not hold for these: they are about the board in front of
   * them, they change while they play, and reaching them through a pause card means leaving the
   * game to answer a question about the game.
   *
   * ⚠️ AND THE PIECE LIST COULD NEVER LIVE IN THE ENGINE'S CARD AT ALL. `gameOptions.values` is a
   * fixed ARRAY read once at boot, and this list differs per view — three glyph sets on the flat
   * board, six piece designs on the other two. The engine's card has been offering the flat
   * board's three to a child playing in 3D since the migration; the plan records it as an open
   * defect. Here the list is re-read on every refresh, so it is simply right.
   */
  const controls = doc.createElement('div');
  controls.className = 'hud-controls';
  controls.setAttribute('role', 'group');

  const field = (): { box: HTMLElement; label: HTMLLabelElement; select: HTMLSelectElement } => {
    const box = doc.createElement('p');
    box.className = 'hud-field';
    const label = doc.createElement('label');
    const select = doc.createElement('select');
    select.id = `hud-opt-${controls.children.length}`;
    label.htmlFor = select.id;
    box.append(label, select);
    controls.appendChild(box);
    return { box, label, select };
  };

  const check = (): { box: HTMLElement; label: HTMLLabelElement; input: HTMLInputElement } => {
    const box = doc.createElement('p');
    box.className = 'hud-check';
    const input = doc.createElement('input');
    input.type = 'checkbox';
    input.id = `hud-opt-${controls.children.length}`;
    const label = doc.createElement('label');
    label.htmlFor = input.id;
    box.append(input, label);
    controls.appendChild(box);
    return { box, label, input };
  };

  const strengthField = field();
  const pieceField = field();
  const themeField = field();
  // ⚠️ AMONG THE SELECTS AND NOT AFTER THE SWITCHES: the Dev's order of 2026-10-04 ends with
  // «coordenadas», and a list dropped below two checkboxes would have moved it off the end.
  const countryField = field();
  const outlineCheck = check();
  const coordsCheck = check();

  /*
   * ========================= THE ORDER OF THE PANEL, AS THE DEV SET IT =========================
   * 2026-10-04, in his words: "1) Brancas – Pretas (de quem é a vez); 2) setas | Protetor de
   * lances; 3) voltar | avançar; 4) lances; 5) Força do adversário, desenho das peças, cores do
   * tabuleiro, coordenadas."
   *
   * It reads as a sentence about a turn: whose move it is, what help is on, how to walk the game,
   * what has been played, and only then the settings. The panel scrolls, so what a child watches
   * while playing has to come before what they occasionally change.
   *
   * ⚠️ TWO SECTIONS ARE NOT IN HIS LIST AND ARE KEPT, because he was ordering the panel rather
   * than pruning it: the opening's name, which is a sentence ABOUT the move list and sits with
   * it, and the lesson picker, which is hidden unless the APRENDER door was taken.
   */
  if (deps.onNewGame) root.appendChild(gameBox);
  root.append(turn);
  if (deps.onHint) root.appendChild(hintBox);
  /*
   * ⚠️ THE OPENING'S NAME MOVED BELOW THE LIST ON 2026-10-04, and it is a layout fix rather than a
   * change of mind about what it is. It still belongs with the move list — it is a sentence ABOUT
   * the move list — and under it is as much "with" as over it.
   *
   * What forced it: the Dev asked for the move box to be eight lines and fully visible without
   * touching the panel's scrollbar, and this name is the one thing above it whose height is not
   * known in advance. "Abertura: Bishop's Opening: Ponziani Gambit" wraps to three lines and
   * pushed the box 24 px past the panel's edge on move four — measured on the running build,
   * after it had looked right on an empty board.
   */
  if (deps.onTwoPlayers || deps.onCpuMove) root.appendChild(seatBox);
  root.append(navBox, movesBox, openingBox);
  if (deps.lessons) root.appendChild(lessonBox);
  // Settled here too, not only in refresh(): the panel is drawn before anything calls refresh, and
  // a picker that flashes once before hiding is the tremor this HUD has already been reported for.
  lessonBox.hidden = deps.lessonsVisible ? !deps.lessonsVisible() : false;
  root.appendChild(controls);
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

  /*
   * ⚠️ EACH BUTTON TOGGLES ITS OWN SWITCH AND SAYS NOTHING ABOUT THE OTHER, which is what
   * `aria-pressed` promises and what makes them independent. The shell is handed the new value
   * rather than "toggle", so the button and the setting cannot disagree about what was asked.
   */
  const onHintClick = (): void => { deps.onArrows?.(!(deps.arrows?.() ?? false)); };
  const onSilentClick = (): void => { deps.onGuard?.(!(deps.guard?.() ?? false)); };
  hintButton.addEventListener('click', onHintClick);
  silentButton.addEventListener('click', onSilentClick);

  function onLessonClick(): void { deps.onLesson?.(lessonSelect.value); }
  lessonButton.addEventListener('click', onLessonClick);





  /**
   * Re-reads every control from the game, and HIDES the ones this board does not offer.
   *
   * ⚠️ REBUILT RATHER THAN BUILT ONCE, because the lists change under it: switching from the flat
   * board to the projected one swaps three glyph sets for six piece designs, and a select that
   * kept the old options would be offering names the renderer does not know. That is the defect
   * the engine's card still has, and the reason this one is cheap to keep right: a handful of
   * `<option>`s per refresh, against a list nobody can act on.
   */
  function refreshControls(): void {
    const fill = (
      select: HTMLSelectElement,
      items: readonly { readonly value: string; readonly text: string }[],
      chosen: string | undefined,
    ): void => {
      select.replaceChildren(...items.map((item) => {
        const option = doc.createElement('option');
        option.value = item.value;
        option.textContent = item.text;
        return option;
      }));
      if (chosen !== undefined && items.some((i) => i.value === chosen)) select.value = chosen;
    };

    const strengths = deps.strengths ?? [];
    strengthField.box.hidden = strengths.length === 0 || !deps.onStrength;
    if (!strengthField.box.hidden) {
      strengthField.label.textContent = i18n.t('hud.strength');
      fill(
        strengthField.select,
        strengths.map((s) => ({ value: String(s.elo), text: i18n.t(s.name) })),
        deps.strength ? String(deps.strength()) : undefined,
      );
    }

    const sets = deps.pieceSets?.() ?? [];
    pieceField.box.hidden = sets.length === 0 || !deps.onPieceSet;
    if (!pieceField.box.hidden) {
      pieceField.label.textContent = i18n.t(deps.pieceSetsLabel?.() ?? 'hud.pieceSet');
      fill(
        pieceField.select,
        sets.map((s) => ({ value: s.key, text: i18n.t(s.label) })),
        deps.pieceSet?.(),
      );
    }

    const themes = deps.themes ?? [];
    themeField.box.hidden = themes.length === 0 || !deps.onTheme;
    if (!themeField.box.hidden) {
      themeField.label.textContent = i18n.t('hud.boardTheme');
      fill(
        themeField.select,
        themes.map((t) => ({ value: t.key, text: i18n.t(t.name) })),
        deps.theme?.(),
      );
    }

    const countries = deps.countries ?? [];
    countryField.box.hidden = countries.length === 0 || !deps.onCountry;
    if (!countryField.box.hidden) {
      countryField.label.textContent = i18n.t('hud.countries');
      fill(
        countryField.select,
        countries.map((c) => ({ value: c.code, text: i18n.t(c.label) })),
        deps.country?.(),
      );
    }

    // ⚠️ `undefined` is "this board has no outline", not "it is off" — see the dep's own note.
    const outline = deps.outline?.();
    outlineCheck.box.hidden = outline === undefined || !deps.onOutline;
    if (!outlineCheck.box.hidden) {
      outlineCheck.label.textContent = i18n.t('hud.outline');
      outlineCheck.input.checked = outline === true;
    }

    const coords = deps.coordinates?.();
    coordsCheck.box.hidden = coords === undefined || !deps.onCoordinates;
    if (!coordsCheck.box.hidden) {
      coordsCheck.label.textContent = i18n.t('hud.coordinates');
      coordsCheck.input.checked = coords === true;
    }
  }

  const onStrengthChange = (): void => {
    deps.onStrength?.(Number(strengthField.select.value));
  };
  const onPieceChange = (): void => { deps.onPieceSet?.(pieceField.select.value); };
  const onThemeField = (): void => { deps.onTheme?.(themeField.select.value); };
  const onCountryChange = (): void => { deps.onCountry?.(countryField.select.value); };
  const onCopyClick = (): void => { deps.onCopyPgn?.(); };
  const onSaveClick = (): void => { deps.onSavePgn?.(); };
  const onNewGameClick = (): void => { deps.onNewGame?.(); };
  const onTimeClick = (): void => { deps.onTimeControl?.(); };
  const onResetClockClick = (): void => { deps.onResetClock?.(); };
  const onProtectClick = (): void => { deps.onProtect?.(!(deps.protect?.() ?? false)); };
  const onSeatToggle = (): void => { deps.onTwoPlayers?.(!(deps.twoPlayers?.() ?? false)); };
  const onCpuClick = (): void => { deps.onCpuMove?.(); };
  const onOutlineToggle = (): void => { deps.onOutline?.(outlineCheck.input.checked); };
  const onCoordsToggle = (): void => { deps.onCoordinates?.(coordsCheck.input.checked); };
  strengthField.select.addEventListener('change', onStrengthChange);
  pieceField.select.addEventListener('change', onPieceChange);
  themeField.select.addEventListener('change', onThemeField);
  countryField.select.addEventListener('change', onCountryChange);
  copyButton.addEventListener('click', onCopyClick);
  saveButton.addEventListener('click', onSaveClick);
  newGameButton.addEventListener('click', onNewGameClick);
  timeButton.addEventListener('click', onTimeClick);
  resetClockButton.addEventListener('click', onResetClockClick);
  protectButton.addEventListener('click', onProtectClick);
  seatCheck.addEventListener('click', onSeatToggle);
  cpuButton.addEventListener('click', onCpuClick);
  outlineCheck.input.addEventListener('change', onOutlineToggle);
  coordsCheck.input.addEventListener('change', onCoordsToggle);

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
    report.hidden = false;
    fillReport();
  };
  const hideReport = (): void => { report.hidden = true; };
  /*
   * ⚠️ FOCUS AND BLUR, NOT THE POPUP'S FOUR EVENTS. The comment above describes the approximation
   * this used while the table was a maintainer's instrument: show it as the native list opens,
   * hide it the moment a choice lands. For someone CHOOSING, hiding on `change` is exactly wrong —
   * they pick a palette and the numbers that would tell them whether it was a good pick vanish in
   * the same instant. So the table stands for as long as the control is theirs, and `change` only
   * re-draws it, moving the highlight to the column they just chose.
   *
   * ⚠️ AND IT HANGS OFF `themeField.select`, THE ONE IN THE PANEL. The four listeners were on
   * `themeSelect`, which belongs to `settings` — a node that has not reached the DOM since Wave
   * 2c. The table has been unreachable since then, by a maintainer too.
   */
  themeField.select.addEventListener('focus', showReport);
  themeField.select.addEventListener('blur', hideReport);
  themeField.select.addEventListener('change', showReport);

  /*
   * ========================= ⚠️ THE TABLE TURNED ON ITS SIDE, AND SHRANK =========================
   * It was ten rows of pairs by seven columns of palettes, and it MEASURED 792 PIXELS WIDE in a
   * board that is 360. On the running page that is two scrollbars and one visible column: a person
   * comparing seven boards by swiping sideways is not comparing them at all. It survived in that
   * shape because `?debug=true` hid it from everyone who would have said so.
   *
   * So the axes swapped. A person choosing colours is choosing a BOARD, so the board is the row —
   * seven of them, named in full, which is what the dropdown above says too. And the columns are
   * the four questions that choosing actually turns on, out of the ten that were measured:
   *
   *   casas              the squares against each other — the longest boundary on the board
   *   clara na clara     a white piece on a light square — the Dev's report of 2026-10-04
   *   contorno           the silhouette against the square it sits on, at its TIGHTEST of the two
   *
   * ⚠️ THREE COLUMNS AND NOT FOUR, AND THE FOURTH IS A CORRECTION I OWE THIS COMMENT. It said
   * «escura na escura» was dropped because it clears the floor on every palette, 3.04 at worst.
   * Measured, it does not: José is 2.58 and «Azul & Amarelo» is 1.01, a black piece on a dark
   * square. I had read the floor off five boards and written it as if it were seven.
   *
   * It is still out, for the reason that was true all along. It is a pair that NEVER MEETS — the
   * silhouette is drawn between the piece and the square — and the column that says whether that
   * silhouette is doing its job is «contorno», which is in the table and clears 3:1 everywhere.
   * A fourth column put the table 58 px past the board again, measured on the running page, and
   * what it would have bought is a second reading of a question already answered.
   *
   * «CLARA NA CLARA» IS THE SAME KIND OF PAIR AND IT STAYS, because the Dev asked for it by name
   * and because it is where the silhouette's argument is thinnest: 1.12 to 2.30 across the seven,
   * under the floor on all of them, and on the lightest boards the piece's whole BODY is the
   * colour of the square it stands on. The outline is a line; the body is the shape.
   *
   * The other six really are constant. Piece against piece is 21 on five of the seven boards, and
   * the two inner strokes never touch a square at all, being inside a piece.
   */
  function fillReport(): void {
    if (!deps.themes) return;
    const current = deps.theme?.() ?? '';
    const measured = BOARD_THEMES.map((theme) => ({ theme, rows: contrastRows(theme) }));
    const at = (rows: readonly ContrastRow[], label: string): ContrastRow => {
      const found = rows.find((row) => row.label === label);
      if (!found) throw new Error(`contrast row ${label} is not measured any more`);
      return found;
    };
    const columns: readonly {
      readonly head: string;
      readonly pick: (rows: readonly ContrastRow[]) => ContrastRow;
    }[] = [
      { head: 'contrast.col.squares', pick: (rows) => at(rows, 'contrast.squares') },
      { head: 'contrast.col.whiteLight', pick: (rows) => at(rows, 'contrast.whiteLight') },
      {
        head: 'contrast.col.rim',
        // ⚠️ THE TIGHTER OF THE TWO, not one of them: the silhouette meets BOTH squares, and a
        // board is only as safe as the square the outline does worst against.
        pick: (rows) => {
          const light = at(rows, 'contrast.rimLight');
          const dark = at(rows, 'contrast.rimDark');
          return light.ratio <= dark.ratio ? light : dark;
        },
      },
    ];

    reportTitle.textContent = i18n.t('contrast.title');
    reportTable.replaceChildren();

    const head = doc.createElement('tr');
    const corner = doc.createElement('th');
    corner.scope = 'col';
    corner.textContent = i18n.t('contrast.board');
    head.appendChild(corner);
    for (const column of columns) {
      const cell = doc.createElement('th');
      cell.scope = 'col';
      cell.textContent = i18n.t(column.head);
      head.appendChild(cell);
    }
    reportTable.appendChild(head);

    for (const { theme, rows } of measured) {
      const line = doc.createElement('tr');
      const label = doc.createElement('th');
      label.scope = 'row';
      label.textContent = i18n.t(theme.name);
      if (theme.key === current) label.setAttribute('aria-current', 'true');
      line.appendChild(label);

      for (const column of columns) {
        const row = column.pick(rows);
        const cell = doc.createElement('td');
        // Never colour alone: the mark is a character a reader speaks; the colour is the extra.
        const state = row.passes ? 'pass' : (row.optional ? 'carried' : 'short');
        cell.dataset.state = state;
        if (theme.key === current) cell.dataset.current = 'true';
        cell.textContent = `${row.ratio.toFixed(1)}\u202F${
          state === 'pass' ? '\u2713' : state === 'carried' ? '\u2022' : '\u2717'}`;
        line.appendChild(cell);
      }
      reportTable.appendChild(line);
    }

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
    refreshControls();

    if (deps.onNewGame) {
      // ⚠️ A `title` ON BOTH, because the column truncates them. Measured in the panel: «Nova
      // partida» and «Zerar Relógio» come out as «Nova …» and «Zerar …», which is legible enough
      // to pick from three buttons and not enough to be sure. The tooltip carries the whole word,
      // and the accessible name was never truncated — only the picture is.
      newGameButton.textContent = i18n.t('hud.newGame');
      newGameButton.title = i18n.t('hud.newGame');
      resetClockButton.textContent = i18n.t('hud.resetClock');
      resetClockButton.title = i18n.t('hud.resetClock');
      timeButton.textContent = deps.timeControl?.() ?? '';
      // ⚠️ The ladder's rung is the button's own text, so a reader hears «5+0» and nothing else —
      // which is meaningless on its own. The label says what the number IS.
      timeButton.setAttribute('aria-label',
        i18n.t('hud.timeControl', { control: deps.timeControl?.() ?? '' }));
      timeButton.title = i18n.t('hud.timeControlTip');
    }

    copyButton.hidden = !deps.onCopyPgn;
    saveButton.hidden = !deps.onSavePgn;
    if (deps.onCopyPgn) icon(copyButton, '\u{1F4CB}', 'hud.copyPgn');
    if (deps.onSavePgn) icon(saveButton, '\u{1F4BE}', 'hud.savePgn');
    // ⚠️ NOTHING TO TAKE AWAY FROM AN EMPTY BOARD. Disabled rather than hidden: a button that
    // appears once the first move is played would move the heading under the player's hand.
    const anyMoves = rules().history().length > 0;
    copyButton.disabled = !anyMoves;
    saveButton.disabled = !anyMoves;

    const two = deps.twoPlayers?.() ?? false;
    seatCheck.setAttribute('aria-pressed', String(two));
    // ⚠️ «2P» IS THE PICTURE AND «2 Jogadores» IS THE NAME. Same split as the three icons above:
    // two characters on screen, the whole phrase to a reader and in the tooltip.
    seatCheck.textContent = i18n.t('hud.twoPlayersShort');
    seatCheck.title = i18n.t('hud.twoPlayers');
    seatCheck.setAttribute('aria-label', i18n.t('hud.twoPlayers'));
    cpuButton.textContent = i18n.t('hud.cpuMove');
    /*
     * ⚠️ HIDDEN RATHER THAN DISABLED WHEN TWO PEOPLE ARE PLAYING. A disabled «CPU joga!» is a
     * promise the board is not keeping: the Dev's rule is that with two players "a engine não joga
     * em nenhum momento", so the button has nothing to offer and says so by not being there.
     */
    cpuButton.hidden = two || !deps.onCpuMove;
    cpuButton.disabled = !!deps.canTakeBack && state().phase() === 'thinking';

    if (deps.lessons) {
      lessonBox.hidden = deps.lessonsVisible ? !deps.lessonsVisible() : false;
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
    const opening = deps.opening?.() ?? null;
    openingBox.hidden = opening === null;
    // ⚠️ The NAME is not translated; the label around it is. See `openings/opening.ts`: "Ruy
    // Lopez" is what it is called in all three languages, and inventing our own spellings of
    // three thousand of them would make this game the only place they read that way.
    openingBox.textContent = opening === null ? '' : i18n.t('hud.opening', { name: opening });
    if (deps.onHint) {
      hintBox.setAttribute('aria-label', i18n.t('hud.teachers'));
      icon(protectButton, '\u{1F468}\u{200D}\u{1F3EB}', 'hud.protectTip');
      icon(hintButton, '\u{2B06}\u{FE0F}', 'hud.hintTip');
      icon(silentButton, '\u{1F3C6}', 'hud.hintSilentTip');
      hintButton.disabled = false;
      silentButton.disabled = false;
      const protect = deps.protect?.();
      protectButton.hidden = protect === undefined || !deps.onProtect;
      if (protect !== undefined) protectButton.setAttribute('aria-pressed', String(protect));
      const arrows = deps.arrows?.();
      const guard = deps.guard?.();
      if (arrows === undefined) hintButton.removeAttribute('aria-pressed');
      else hintButton.setAttribute('aria-pressed', String(arrows));
      if (guard === undefined) silentButton.removeAttribute('aria-pressed');
      else silentButton.setAttribute('aria-pressed', String(guard));
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
      if (!report.hidden) fillReport();
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
      strengthField.select.removeEventListener('change', onStrengthChange);
      pieceField.select.removeEventListener('change', onPieceChange);
      themeField.select.removeEventListener('change', onThemeField);
      countryField.select.removeEventListener('change', onCountryChange);
      copyButton.removeEventListener('click', onCopyClick);
      saveButton.removeEventListener('click', onSaveClick);
      newGameButton.removeEventListener('click', onNewGameClick);
      timeButton.removeEventListener('click', onTimeClick);
      resetClockButton.removeEventListener('click', onResetClockClick);
      protectButton.removeEventListener('click', onProtectClick);
      seatCheck.removeEventListener('click', onSeatToggle);
      cpuButton.removeEventListener('click', onCpuClick);
      outlineCheck.input.removeEventListener('change', onOutlineToggle);
      coordsCheck.input.removeEventListener('change', onCoordsToggle);
      hintButton.removeEventListener('click', onHintClick);
      silentButton.removeEventListener('click', onSilentClick);
      lessonButton.removeEventListener('click', onLessonClick);
      setSelect.removeEventListener('change', onSetChange);
      themeSelect.removeEventListener('change', onThemeChange);
      themeField.select.removeEventListener('focus', showReport);
      themeField.select.removeEventListener('blur', hideReport);
      themeField.select.removeEventListener('change', showReport);
      report.remove();
      backButton.removeEventListener('click', onBackClick);
      forwardButton.removeEventListener('click', onForwardClick);
      root.remove();
    },
  };
}
