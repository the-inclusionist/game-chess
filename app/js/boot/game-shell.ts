// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/game-shell — everything the three views do the same way, done once.
//
// ========================= WHAT THIS REPLACES =========================
// Three composition roots, 2,510 lines, and about three fifths of it the same wiring written out
// three times: the score sheet restored from storage, the state machine, the engine client, the
// reviewer, the hint switch, protected mode, the title screen, the panel's ninety-line dependency
// object, the region assembly, the announcements, the opponent, the history walk, the debug global.
//
// Duplication of that size is not a tidiness problem, and this repository has the receipts. The
// solid board answered the engine through the wrong door and dropped every reply, silently, for as
// long as it existed. Changing a palette on one page erased a choice made on another, because each
// root spread a settings object listing only the keys IT knew about. The solid board announced
// moves as raw SAN while the other two spoke sentences. Every one of those is one copy drifting
// from the others, and none of them could have happened to a single copy.
//
// ========================= ⚠️ WHAT THIS FILE MAY IMPORT =========================
// `chess/**`, `ui/**`, `i18n/**`, `declaration/**`, the engine, and the three RENDER LEAVES —
// `render/board-geometry.ts`, `render/hint-arrows.ts`, `render/palette.ts`. Those three are already
// in the flat bundle through `ui/grid-mirror.ts`, so they cost it nothing.
//
// It may NOT import a value from `render/board.ts`, `render/zdog-stage.ts`, `render/pieces/**`,
// `render/animation.ts` or `render3d/**`. Doing so puts a renderer into the flat entry, which is
// 104 KB against the projected board's 146 precisely because it never loads one — a decision made
// by measurement in `spike/2d-weight/` and stated in `vite.config.ts`. `tsc` is blind to this and
// `vitest` never bundles: nothing will tell you. The size of `dist/` will.

import type { Engine } from '@the-inclusionist/engine';
import type { GameDeclaration } from '@the-inclusionist/engine/core/contract.js';
import type { CartridgeHooks } from '@the-inclusionist/engine';
import { createAnnouncer, type Announcer } from '@the-inclusionist/engine/core/a11y-sr.js';
import { VIZ_FILTER } from '@the-inclusionist/engine/render/viz-modes.js';
import { createChessDeclaration, SONAR_ACTION } from '../declaration/chess-declaration.ts';
import type { Suggestion } from '../chess/engine/client.ts';
import { createStockfishClient, type StockfishClient } from '../chess/engine/stockfish-client.ts';
import { preloadEngine } from '../chess/engine/preload.ts';
import { DEFAULT_ELO, STRENGTH_LADDER } from '../chess/engine/strength.ts';
import type { Thought } from '../chess/engine/uci.ts';
import { STUMBLES_BEFORE_HELP } from '../chess/protection.ts';
import { isBlunder } from '../chess/review.ts';
import { createReviewer, type ReviewedMove } from '../chess/reviewer.ts';
import { loadSettings, patchSettings, resume, save as saveGame } from '../chess/session.ts';
import { createGameState, type Activation } from '../chess/state.ts';
import { createRules, type MoveResult } from '../chess/rules.ts';
import { type Side, type Square, toAlgebraic } from '../chess/types.ts';
import { createI18n, preferredLocale } from '../i18n/index.ts';
import { squareIndex, type Marker } from '../render/board-geometry.ts';
import type { HintMove } from '../render/hint-arrows.ts';
import { BOARD_THEMES, DEFAULT_THEME } from '../ui/board-themes.ts';
import { createBlunderBar } from '../ui/blunder-bar.ts';
/*
 * ⚠️ THE TABLE IS STATIC AND THE MACHINERY IS NOT, and the split is deliberate. The HUD has to
 * list every lesson name before anyone opens one, so `LESSONS` is imported here — it is data,
 * a few kilobytes of FENs and square sets. The panel, the tutor and the driver are fetched only
 * when a lesson is actually started, and the PROSE is fetched separately again by the driver. A
 * player who never opens a lesson downloads the names and nothing else.
 */
import { LESSONS, lessonById, syllabus } from '../teach/lessons.ts';
import { isPuzzleId, puzzleId, puzzleLesson } from '../teach/puzzle-lesson.ts';
import { loadPuzzles, type PuzzleSet } from '../puzzles/puzzle.ts';
/*
 * ⚠️ STATIC, AND FOR ONCE THAT NEEDS NO DEFENCE. The books are PGN text measured in hundreds
 * of bytes — the weight of an annotated game is its PROSE, and that is already behind the
 * lazy teach catalogue with every other sentence. There is no JSON here to make lazy.
 */
import { GAMES, gameById } from '../teach/games.ts';
import { bookId, gameLesson, isBookId } from '../teach/game-lesson.ts';
/*
 * ⚠️ IMPORTED NORMALLY; the 230 kB of names is behind the dynamic import INSIDE `loadOpenings`.
 * The bundler said so the last time this was done the other way round for the puzzles
 * (`INEFFECTIVE_DYNAMIC_IMPORT`): a lazy import of a module something else already needs splits
 * nothing.
 */
import { loadOpenings, nameOpening, type OpeningBook } from '../openings/opening.ts';
import { loadProgress } from '../chess/session.ts';
import { createGridMirror, type LessonMark, type LessonSquare } from '../ui/grid-mirror.ts';
import { createHud, type GameMode, type Hud, type ViewKind } from '../ui/hud.ts';
import { applyLayout } from '../ui/layout.ts';
import {
  createChessClock, formatClock, formatControl, TIME_CONTROLS, type TimeControl,
} from '../ui/chess-clock.ts';
import { createPlayerStrips } from '../ui/player-strip.ts';
import { createEarcons, WHISTLE } from '../ui/earcons.ts';
import { createSplash } from '../ui/splash.ts';
import { createThinkingPanel } from '../ui/thinking.ts';
import { actionPreset, hintParts } from '../ui/key-hints.ts';
import { VIEWS } from './views.ts';
import { announceActivation, announceMove, announceOutcome } from './narration.ts';
import type { BoardView, ViewFactory } from './view.ts';

export interface GameShellDeps {
  readonly host: Document;
  /**
   * The arguments this game was opened with. Omitted means none — see the note where it is read.
   *
   * ⚠️ THE SHELL SUPPLIES IT, and that is the point: ADR-0139 §4 puts `params` in the context a host
   * hands over precisely so a cartridge never reads `location` itself, because on a platform page
   * there is ONE address and every game reading it directly reads its neighbours' arguments.
   */
  readonly params?: URLSearchParams;
  /**
   * The element this cartridge may write inside, and outside which it may not — ADR-0139 §4's
   * `region`, as much of it as this game can take today.
   *
   * ⚠️ OPTIONAL, AND THE DEFAULT IS AN ID LOOKUP, which is not a hedge: the standalone page is a
   * host too, `#game-region` is the id its markup uses, and it is the engine's required markup
   * besides. What the field buys is that a host with several games on one page can say WHICH
   * element is ours, instead of us answering with whichever came first in the document.
   */
  readonly region?: HTMLElement;
  /** Which page this is. Drives the panel's view switcher and the debug global's name. */
  readonly kind: ViewKind;
  readonly view: ViewFactory;
  /** True on the flat page, where the accessible grid IS the board rather than a mirror of it. */
  readonly visibleMirror?: boolean;
  /** `__chess` | `__chess2d` | `__chess3d`, kept distinct because console habits are real. */
  readonly debugName: string;
  /**
   * Whether this page offers the teaching mode.
   *
   * ⚠️ TRUE ON ALL THREE NOW. It was false on the solid page while `render3d/scene.ts` had no
   * marker channel, because a lesson saying "look at these squares" would have shown nothing. The
   * flag stays rather than being deleted: a view added later starts unable to draw a mark, and
   * should say so rather than offer a mode that half works.
   */
  readonly teaches?: boolean;
  /**
   * Which palette `prefers-contrast: more` picks on THIS page.
   *
   * ⚠️ IT IS NOT THE SAME ON ALL THREE, and the difference is the reason a theme carries piece
   * inks at all. The projected and solid boards take `contrast-solid`; the flat board takes
   * `contrast-flat`. Same squares, different pieces — because a solid whose ink is mostly STROKE
   * needs a different answer from a glyph.
   */
  readonly contrastTheme: string;
  /**
   * ⚠️ THE SEAM THAT SHOULD HAVE EXISTED ALL ALONG. There is no way to reach the opponent's reply
   * path without downloading 6.98 MB of WebAssembly, which is exactly why the solid board's reply
   * path was dead for its whole life and no test noticed. Injecting the client lets a test drive
   * `askOpponent` with an answer of its own choosing.
   */
  readonly makeOpponent?: (options: { onThought(t: Thought): void }) => StockfishClient;
}

/**
 * Told what the board did, after the board has finished doing it.
 *
 * ⚠️ AFTER THE FLIGHT, NOT BEFORE, for a move — which is the pedagogy and not a technicality. A
 * lesson answers a wrong move by taking it back, and `ui/blunder-bar.ts` already argued why the
 * wrong thing has to HAPPEN first: somebody being told their move was wrong needs to have seen it.
 * Handing this over before the piece has landed would undo a move the child never saw.
 */
export type ActivationObserver = (square: Square, result: Activation) => void;

export interface GameShell {
  readonly region: HTMLElement;
  readonly i18n: ReturnType<typeof createI18n>;
  /**
   * ⚠️ ACCESSORS, LIKE EVERYTHING ELSE DOWNSTREAM. `newGame` replaces both objects, so a caller
   * that read them once would be holding the board a lesson has already left.
   */
  rules(): ReturnType<typeof resume>;
  game(): ReturnType<typeof createGameState>;
  readonly mirror: ReturnType<typeof createGridMirror>;
  readonly hud: Hud;
  /**
   * The renderer currently drawing, ASKED FOR rather than held.
   *
   * ⚠️ IT WAS A FIELD, AND A FIELD WOULD LIE THE MOMENT `switchView` RAN — the same trap this file
   * already names twenty lines above for `rules` and `game`: «a caller that read them once would be
   * holding the board a lesson has already left». A view can be replaced now, so the rule applies
   * to it too.
   */
  view(): BoardView;
  /**
   * Change which renderer draws the board, without leaving the page.
   *
   * ⚠️ THIS IS THE THING THAT MAKES THREE PAGES UNNECESSARY. Each view was its own HTML entry and
   * changing view was a NAVIGATION — right while a page is a game, and wrong for a cartridge, where
   * a second entry is a second URL rather than a second bundle (ADR-0139, which records this
   * decision for this game by name).
   *
   * Asynchronous because the renderer arrives by dynamic `import()`: the Three.js view is 540.7 KB
   * that nobody should pay for unless they ask for it.
   */
  switchView(kind: ViewKind): Promise<void>;
  /**
   * One frame, `dt` in FRAMES — what ADR-0139 names `GameInstance.update(dt)`.
   *
   * ⚠️ THE CARTRIDGE DOES NOT START THE LOOP THAT CALLS THIS, and that is §3 of the same record
   * rather than a preference: inside a platform the clock is the page's, and a cartridge that
   * built its own would be a second 60 wake-ups a second on hardware that cannot spare the first.
   * Two of the three views used to call `startLoop` themselves; this is where that went.
   *
   * ⚠️ AND IT ASKS THE CURRENT VIEW RATHER THAN A HELD ONE, for the reason `view()` already gives:
   * `switchView` replaces the renderer, and a frame that had captured the old one would be drawing
   * into a board that has been torn down — sixty times a second, which is the one caller certain
   * to hit the window.
   */
  update(dt: number): void;
  /**
   * Let go of everything this game is holding — the other half of `update`, and the member
   * ADR-0139 names beside it.
   *
   * ⚠️ WHAT «EMPTY THE REGION» DOES NOT RELEASE IS THE WHOLE POINT OF THIS. The contract says the
   * shell empties `region` afterwards, and it would be easy to read that as sufficient. It is not:
   * measured in this file, four things outlive it, and each one is a different kind of leak.
   *
   *   · `window`'s resize listener — not in the region at all.
   *   · The pause menu's `keydown`, registered in CAPTURE ON THE DOCUMENT. A torn-down cartridge
   *     would keep taking keys from whatever ran next, and take them first.
   *   · This shell's own `keydown`, on the region ELEMENT, which the host keeps — only its children
   *     are emptied.
   *   · The opponent: a Web Worker holding 6.98 MB of WebAssembly, which no DOM operation reaches.
   *
   * The view is destroyed too, and there the cost is GPU memory: `render3d/pieces.ts` says Three
   * does not free a geometry when its mesh leaves the scene.
   *
   * ⚠️ IDEMPOTENT, because a shell can be torn down by the host and by a test, and the second call
   * must not run `destroy` twice on a view that has already let its context go.
   */
  teardown(): void;
  readonly opponent: StockfishClient;
  activate(square: Square): void;
  walkHistory(direction: 'back' | 'forward'): Promise<void>;
  askOpponent(): void;
  /**
   * Starts a fresh position, keeping every object around the board alive.
   *
   * ⚠️ THE POINT IS WHAT IT DOES *NOT* REBUILD. The mirror, the HUD, the view and the declaration
   * all stay — they ask for the rules rather than holding them — so the focused cell, the roving
   * tabindex and the scroll position survive. Rebuilding them instead would dump a keyboard reader
   * at the top of the page once per lesson step.
   *
   * `teaching` suppresses the save while a lesson owns the board; see the guard in `syncPosition`.
   */
  newGame(fen?: string, options?: { readonly teaching?: boolean }): void;
  /** What a lesson is saying about each square. Empty clears them all. */
  setTaught(marks: readonly LessonSquare[]): void;
  /**
   * Watches every activation, or stops watching when given null. One watcher, because there is one
   * lesson at a time and a list would only invite a second thing to answer the board.
   */
  watch(observer: ActivationObserver | null): void;
  /** Takes one ply back and redraws. Returns whether anything moved. */
  undoLast(): boolean;
  /**
   * Opens the teaching mode where the reader left off.
   *
   * ⚠️ NOT "THE FIRST LESSON". A child who finished four lessons yesterday and is sent back to
   * notation today has been told their work did not count. So: the lesson they were in the middle
   * of, else the first one they have not finished, else the start. Answers false where the page
   * cannot teach.
   */
  teach(): boolean;
}

/** The mirror's vocabulary is the board's, under two different names. One table, stated once. */
const LESSON_MARKER: Record<LessonMark, 'lesson' | 'lessonRight' | 'lessonWrong'> = {
  look: 'lesson', right: 'lessonRight', wrong: 'lessonWrong',
};

/**
 * What this repository hands a shell, and what ADR-0139 calls a `Cartridge`.
 *
 * ⚠️ PRODUCED BY A FACTORY, NOT EXPORTED AS MODULE CONSTANTS, and that is a finding rather than a
 * preference. `architecture.md` sketches a cartridge as `export const declaration` beside
 * `export default create(ctx)` — which works for a game whose declaration is a fixed description.
 * Chess's declaration is not: its seven fields read `rules()`, `state()` and `cursor()`, which are
 * the CURRENT game. As module constants those would need a module-level pointer to the live
 * instance, which is exactly what spec D14 forbids and why two games could not share a page.
 *
 * From a factory the whole problem disappears: every call gets its own state, its own declaration
 * and its own instance, with nothing at module scope. The `Cartridge` interface is satisfied; only
 * the sketch's shape is not.
 */
export interface ChessCartridge {
  /** The engine's contract object, built against this instance's state. */
  readonly declaration: GameDeclaration;
  /**
   * The game-owned half of `CreateGameOptions`, per ADR-0139 §1.
   *
   * ⚠️ TYPED BY THE ENGINE'S OWN `CartridgeHooks`, NOT BY A HAND-WRITTEN `Pick`. It was a Pick,
   * which was right while the engine named no type for this half — and became a COPY the moment
   * engine 9 exported one. A copy of a definition is the drift this derivation exists to avoid, and
   * the engine's version is also the corrected one: fifteen fields rather than the ten I listed.
   */
  readonly hooks: CartridgeHooks & { readonly declaration: GameDeclaration };
  /** Where the engine's own bar and pause card fit in this game's layout. */
  readonly hosts: { readonly a11yBarHost: Element | undefined; readonly pauseHost: Element };
  /** Nothing runs until this is called, and it needs the engine the shell built. */
  create(engine: Engine): GameShell;
}

export function createChessCartridge(deps: GameShellDeps): ChessCartridge {
  const host = deps.host;
  /**
   * The query this game was opened with, HANDED OVER rather than read.
   *
   * ⚠️ IT WAS `location.search`, TWICE, and ADR-0139 §4 names that as one of the faults the whole
   * `params` member exists to prevent: inside a platform there is one address for however many
   * cartridges share the page, so a game reading it directly is a game reading ANOTHER GAME'S
   * arguments. Standalone it is the same string either way, which is exactly why nothing here would
   * ever have failed to reveal it.
   *
   * ⚠️ AND IT ARRIVES AT CONSTRUCTION, NOT IN `create`, which departs from the record's `GameCtx`
   * for a measured reason: `?debug=true` is read while the PANEL is being built, and the panel has
   * to exist before `createGame` does — the engine is handed `a11yBarHost`, which lives inside it.
   * A cartridge whose hosts are its own DOM cannot wait for the engine to learn its arguments.
   *
   * Absent means NO ARGUMENTS, never «go and look»: a test builds a shell without a query and gets
   * a game with no debug global, which is the answer it wants and the one this file can give
   * without touching `window`.
   */
  const params = deps.params ?? new URLSearchParams();
  const debugAsked = params.get('debug') === 'true';
  /**
   * ⚠️ THE REGION IS THE BOARD PLUS THE PANEL, and it used to be only the board.
   *
   * The Dev settled it on 2026-09-11, asked which of two elements should carry the engine's id:
   * «o tabuleiro + menu lateral constituem o game-region». What was `#stage` took the name, and the
   * board became `#chess-board`. It is not a rename — it decides what this cartridge's ROOT is, and
   * `cartridge-contract.md` is literal about what a root means: a cartridge «may write inside it and
   * nothing outside it».
   *
   * ⚠️ AND IT IS HANDED OVER NOW RATHER THAN LOOKED UP, which is the half of ADR-0139 §4's `region`
   * that this game could actually do. Finding it by id is right for a game that owns its page and
   * wrong for one of several on a platform's: `getElementById` answers with the FIRST `#game-region`
   * in the document, which on that page is whoever got there first. The id lookup survives as the
   * DEFAULT, because the standalone page is a host too and this is the id its markup uses — and
   * because `#game-region` is the engine's required markup (`MARCACAO_EXIGIDA`), the one id here
   * that was never ours to choose.
   *
   * Keys are bound to the REGION and not to the board, which is why the distinction is load-bearing
   * rather than cosmetic: the panel is a sibling of the board, so an event from the lesson list
   * never bubbles through it, and `action4` exists precisely to move between the two.
   */
  const region = deps.region ?? host.getElementById('game-region');
  if (!region) throw new Error('a region is required — this game has nowhere to draw');

  /**
   * The engine arrives in `create(received)`. Everywhere BELOW the create() hook `engine` reads
   * it through a non-null assertion — correct, because every caller runs after `create` has set
   * it. The ref beside it exists for the handful of CLOSURES evaluated during construction,
   * before `create` runs. `engineRef.current` is null until `create` sets it.
   *
   * ⚠️ MOVED UP in Wave 2 item 1 (2026-10-02) to sit beside the announcer, which now routes
   * `say`/`alert` through `engine` once it exists so the DEAF-MODE MIRROR (ADR-0232 D4) sees
   * every announcement; the local `createAnnouncer` is the boot-window fallback only.
   *
   * ⚠️ `engineT` RETIRED in Wave 2 item 2 (2026-10-02): the vision select's option labels now go
   * through chess's own `i18n`.
   */
  /*
 * ========================= THE THREE LANGUAGES, NAMED AS LANGUAGES =========================
 * The Dev, 2026-10-04, in three steps on the same afternoon: "adicione mais um dropdown: países",
 * then — asked what it should choose — the language, by country, then: "troque «Países» por
 * «Idioma» (Português, Español, English)".
 *
 * ⚠️ THE LAST STEP SETTLES AN ARGUMENT THIS COMMENT USED TO MAKE. It said one country per
 * language was "wrong as geography and right as a label", because a child who cannot read
 * «Español» can recognise «Espanha». His answer is better: name the language in the language. A
 * child who reads none of the three recognises «Español» as the shape of the word they are
 * looking for, and nobody is told that Spanish belongs to Spain.
 *
 * ⚠️ THE FLAG STAYS, as the picture beside the word rather than instead of it. He asked for Noto
 * Color Emoji by name one message earlier precisely so these three would render — Windows ships
 * no country-flag glyphs — and dropping them now would throw that away. The order is his: pt, es,
 * en. The key names still say `country.*`, which is now a small lie about three strings; renaming
 * them is a rename across three catalogues and is not worth a commit of its own.
 */
const COUNTRIES: readonly { readonly code: string; readonly label: string }[] = [
  { code: 'pt', label: 'country.br' },
  { code: 'es', label: 'country.es' },
  { code: 'en', label: 'country.us' },
];

const engineRef: { current: Engine | null } = { current: null };
  let engine!: Engine;

  /**
   * THIS CARTRIDGE'S ANNOUNCER (ADR-0232 D4).
   *
   * ⚠️ `core/a11y-sr` was a module-level pair of functions in engine 9. In 11 it is a factory
   * and each root builds its own, so the Libras mirror and the sound caption follow this
   * instance and not the next one on the page. The engine's `engine.say`/`engine.alert` are the
   * LARGER channel — they mirror to deaf mode — so this cartridge routes through the engine
   * once it is here. The local `createAnnouncer` is the BOOT-WINDOW FALLBACK: the closures below
   * are evaluated during construction, and a `say` or `alert` fired before `create(engine)`
   * runs would otherwise have nowhere to go.
   */
  const win = host.defaultView;
  const bootAnnouncer: Announcer = createAnnouncer({
    doc: host,
    raf: win ? win.requestAnimationFrame.bind(win) : undefined,
  });
  const announcer: Announcer = {
    say: (text) => { (engineRef.current ?? bootAnnouncer).say(text); },
    alert: (text) => { (engineRef.current ?? bootAnnouncer).alert(text); },
    /*
     * ⚠️ The engine's equivalent is named `mirrorAnnouncements` rather than `mirrorTo`; chess has
     * no callsite for either today, but the Announcer shape has to be complete to type-check.
     */
    mirrorTo: (sink) => (engineRef.current
      ? engineRef.current.mirrorAnnouncements(sink)
      : bootAnnouncer.mirrorTo(sink)),
  };

  /**
   * The board and the panel, ASKED OF THE REGION and not of the document — and built when it has
   * none.
   *
   * ⚠️ THE SCOPE IS THE POINT, not the convenience. `host.getElementById('side-column')` on a
   * platform page answers with whichever cartridge's column comes first in the document; a query
   * rooted at our own region cannot reach another game's.
   *
   * ⚠️ AND BUILT-IF-ABSENT IS THE SAME ARGUMENT `#below-board` MAKES further down, applied one level
   * up: «markup that exists only to be filled in by this module belongs to this module». Neither of
   * these has any content of its own. A host that hands over a bare `<div>` gets a working game
   * rather than a list of divs it has to copy out of our page — which was the objection to giving a
   * cartridge five elements instead of one root.
   *
   * They are ADOPTED when the host did author them, because the standalone page has reasons to:
   * its CSS is written against these ids, and the title screen paints on the first frame from an
   * inline stylesheet that names them.
   */
  const within = (id: string): HTMLElement => {
    const found = region.querySelector<HTMLElement>(`#${id}`);
    if (found) return found;
    const made = host.createElement('div');
    made.id = id;
    region.appendChild(made);
    return made;
  };
  const board = within('chess-board');
  // The board takes the keyboard cursor, so it has to be reachable by Tab whether we built it or
  // the page did. `tabindex` on an authored one is already there; setting it again costs nothing.
  board.tabIndex = 0;
  const column = within('side-column');

  /**
   * The keyboard legend finder — DEAD since Onda 2b retired `.chess-pause`. The engine's remap
   * screen (reached from the pause card's `options`) is the keyboard reference now, so `.hint` no
   * longer exists in the document and this returns `null`; `refreshKeyHints()` is a no-op by its
   * first guard. Kept because the subsequent cleanup commit retires the strip and this helper
   * together; leaving them separates two decisions a reader is more likely to understand apart.
   */
  const keyHintLine = (): HTMLElement | null =>
    region.querySelector<HTMLElement>('.hint') ?? host.querySelector<HTMLElement>('.hint');

  /*
   * ========================= WHERE THE ENGINE'S OWN PAUSE CARD GOES =========================
   * ⚠️ SINCE 8.0.0 THE QUESTION IS WHERE AND NO LONGER WHETHER. ADR-0122 removed the decline, and
   * `createGame` mounts a `.screen-pause` card by itself; absent a `host.pauseHost` it falls back
   * to `#game-region`.
   *
   * ⚠️ AND THAT FALLBACK USED TO BE THE DEFECT THIS LINE EXISTS TO AVOID, AND HAS STOPPED BEING ONE.
   * While `#game-region` was the BOARD, falling back put the card inside nine of the stage's sixteen
   * units — a card the size of a square. Now that the region is board plus panel, the engine's own
   * fallback lands exactly where the line below puts it. It is still said explicitly, because a
   * silent agreement between two repositories is the kind that breaks without anyone editing it.
   *
   * ⚠️ AND IT IS NOT A FLEX CHILD OF THE REGION EITHER. `#game-region` lays its two columns out by width —
   * 9 units of board, 7 of panel, no gap — so a third child in flow would take a share of that and
   * the measured split would stop being the measured split. Out of flow, exactly like `.chess-pause`
   * beside it, and `pointer-events: none` while it is empty so it cannot swallow a click on the
   * board underneath.
   *
   * ⚠️ THIS GAME'S PAUSE BUTTON DOES NOT OPEN IT — the Dev's instruction, 2026-09-11: the engine
   * pauses at the moments it is itself programmed to, not at ours. `H`/`Enter`/START keep opening
   * `.chess-pause`, and `engine.pause.show` is never called from here.
   *
   * 📌 What that means TODAY, written down so the missing wiring reads as a choice: the card is
   * revealed by the engine's `ui/shell`, per phase, and `createGame` deliberately does not mount
   * `ui/shell` ("não substitui o boot do main.js, que tem catorze anos de ordem própria"). So the
   * card is mounted, stays hidden, and nothing reveals it. That is the requested behaviour.
   */
  const enginePause = host.createElement('div');
  enginePause.className = 'engine-pause-host';
  region.appendChild(enginePause);

  /*
   * ========================= ⚠️ THE QUICK ACCESSIBILITY BAR IS GONE =========================
   * The Dev, 2026-10-04: "remova o menu de acessibilidade rápida", and asked what to do with what
   * only it reached: "remover a interface, vamos reimplementar por outro caminho tanto via painel
   * como por outras formas."
   *
   * ⚠️ WHAT WENT WITH IT, MEASURED ON THE RUNNING PAGE BEFORE REMOVING — twelve buttons: ☰ Menu ·
   * modo cego · narração por voz · modo pessoa surda · modo TEA · jeito de apertar · correção de
   * daltonismo · webcam · comando de voz · comunicação (Libras) · velocidade do jogo · idioma.
   *
   * ⚠️ THE MACHINERY STAYS AND LOSES ITS SWITCH. `chess-declaration.ts` still answers the seven
   * questions, so the engine still HAS the sonar, the sweep, the screen reader and Libras for this
   * board — what is gone is the place a child turned them on. That is the shape of the debt, and
   * naming it here is the point of this comment: the work is not "put a bar back", it is "give
   * each of those eleven a door", which the Dev has said he will do by other paths.
   *
   * ONE OF THE TWELVE ALREADY HAS ITS NEW DOOR: the language is the «Países» list in the side
   * panel, added in the same commit — see `COUNTRIES` above and `hud.ts`.
   *
   * ⚠️ AND THE ENGINE SAYS SO ON EVERY BOOT. Without `#title-icons` it adds a line to `problems`:
   * «sem barra de acessibilidade na primeira tela… sem ela a criança não alcança modo cego, TTS,
   * alto contraste nem Libras antes de começar». That line is CORRECT and is left to be printed.
   * Silencing it by fabricating an empty host would be hiding the debt from the next reader.
   *
   * The retracting-bar machinery went with it: five seconds of idle, the 60-pixel top strip, the
   * MutationObserver on the pause card. It was ~70 lines and all of it was about a node that no
   * longer exists.
   */

  /*
   * ⚠️ THE REMEMBERED LANGUAGE BEATS THE BROWSER'S, and until now there was no remembered one to
   * beat it with: `setLocale` existed on the interface and was called nowhere in production, so
   * three catalogues shipped and only the browser could pick between them.
   */
  const startingLocale = (() => {
    const saved = loadSettings().locale;
    return saved === 'pt' || saved === 'en' || saved === 'es'
      ? saved
      : preferredLocale(navigator.language);
  })();
  const i18n = createI18n(startingLocale);
  host.documentElement.lang = i18n.bcp47();

  // ========================= THE GAME SURVIVES A CHANGE OF VIEW =========================
  // The three views are three pages, so a navigation throws away every object in memory. The score
  // sheet is written to the tab's own storage after anything that changes it and read back here,
  // which is why switching from 2D to 2.5D continues the game rather than starting one.
  /*
   * ⚠️ `let`, NOT `const`, AND THAT IS THE WHOLE OF `newGame`. `chess/rules.ts` only takes a FEN
   * at construction: giving it a `setFen` would make `startFen()` lie about the game
   * `session.describe()` rebuilds from, and `GameState` would need a `resync()` because it holds
   * `phase`, `selection` and the move in flight. Two modules would grow a life cycle to serve one
   * mode.
   *
   * Swapping the objects instead is not a chess operation at all — it is the capability
   * `chooseMode` has been faking with `location.reload()` since it was written. Everything
   * downstream is handed an ACCESSOR, so nothing has to be torn down and rebuilt when a lesson
   * changes the board, and the focused cell survives the step.
   */
  let rules = resume();
  const remembered = loadSettings();
  // Three modes rather than two sides: one player as white, one as black, or two people sharing
  // the board — the case the state machine already had and nothing in the panel could reach.
  const mode: GameMode = remembered.mode ?? 'w';
  /*
   * ⚠️ `mode` IS NOW ONLY ABOUT WHICH WAY THE BOARD FACES. Who moves next is `twoPlayers`, a live
   * switch in the panel — the Dev, 2026-10-04: "acima de «Voltar» e «Avançar» quero um checkbox:
   * «2 Jogadores»". The old `mode` was three values and a RELOAD, because it decided the player's
   * colour as well; this decides one thing and decides it immediately.
   *
   * The old shape is read once so nobody loses the setting they had.
   */
  let twoPlayers: boolean = remembered.twoPlayers ?? (mode === 'two');
  const playerSide: Side = mode === 'b' ? 'b' : 'w';
  let game = createGameState({
    rules, playerSide, opponent: !twoPlayers, allowMove: approved,
  });

  let searching = false;
  /** A walk is in flight: the board must not accept a move played on top of it. */
  let walking = false;
  /** A hint is in flight: the button says so and a second press is refused. */
  let hinting = false;
  let cursor: Square = { x: 4, y: 6 };
  /**
   * The squares a lesson is pointing at.
   *
   * ⚠️ SHELL STATE, NOT GAME STATE. Everything else `syncMarks` draws is READ BACK OUT of the
   * position — selection, legal targets, check — so it is right by construction and free to
   * rebuild. "Look at this square" is not a fact about the position at all: nothing in `chess/`
   * knows it, and nothing in `chess/` should.
   */
  let taught: readonly LessonSquare[] = [];
  /**
   * True while a lesson owns the board.
   *
   * ⚠️ IT EXISTS TO STOP `saveGame`. See the guard in `syncPosition`, which is the one place that
   * matters and the last place anybody would look.
   */
  let teaching = false;

  /*
   * ⚠️ DECLARED HERE, ABOVE THE HUD, AND THAT IS THE FOURTH TIME THIS FILE HAS TAUGHT THE LESSON.
   * `createHud` runs its own `refresh()` while it is being built, so anything its deps read must
   * already exist — and a `let` further down is in its temporal dead zone at that moment. The
   * previous three were `learned`, and two `ReferenceError`s in `main.ts` that
   * `tests/boot.browser.test.ts` was written for. `tsc` sees nothing wrong with any of them: the
   * reference is in scope and correctly typed.
   */
  let openings: OpeningBook | null = null;
  /** In flight. Separate from `openings`, which is only set when the book LANDS. */
  let fetchingOpenings = false;
  let openingName: string | null = null;
  let openingPlies = -1;
  /** Who is being told what the board did. A lesson, or nobody. */
  let observer: ActivationObserver | null = null;

  let motionReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let paletteHigh = window.matchMedia?.('(prefers-contrast: more)').matches ?? false;
  // ⚠️ `let vision = 'normal'` RETIRED in Wave 2d: the HUD's vision select is gone, so nothing
  // reads this state back. The engine's a11y-bar's cvd icon calls `setPlayerCorrection`, which
  // writes the filter directly into `board.style.filter` through `applyVision` — the local write
  // was for the old HUD getter, and there is no getter now.
  let themeKey = remembered.theme ?? (paletteHigh ? deps.contrastTheme : DEFAULT_THEME);

  /**
   * ========================= A SUGGESTION IS A SETTING, NOT A QUESTION =========================
   * It was a question — press, get an answer, watch it vanish on the next redraw. Which meant it
   * vanished exactly when it was about to be used, because touching a piece redraws the board.
   *
   * So it is a switch, and `hintFen` is what makes a switch honest: the arrows describe ONE
   * position, and the moment the position is not that one any more they are retired and a fresh
   * search is asked for. Selecting a piece does not change the position, so the advice survives
   * being acted on — which was the whole complaint.
   */
  /**
   * Whether the LEARN door was ever taken. The panel's lesson picker is shown only once it has.
   *
   * ⚠️ THE TITLE SCREEN'S TWO DOORS HAD STOPPED MEANING ANYTHING (the Dev, 2026-10-04): JOGAR and
   * APRENDER diverged for exactly one click, and then the game panel offered "Aulas", a dropdown
   * of thirteen lessons and a "Comecar" button to both. A child who chose to play was still being
   * asked to study.
   *
   * ⚠️ DISTINCT FROM `teaching` ABOVE, AND THE NAMES ARE WORTH READING TWICE. `teaching` is "a
   * lesson owns the board RIGHT NOW" and it falls back to false the moment one ends; this one is
   * "this session is a learning session" and it never falls back. Had the picker been hung on
   * `teaching`, it would have disappeared in the gap between finishing a lesson and choosing the
   * next — which is the one moment it exists for.
   *
   * It is raised in `teach()` rather than read off the door, because `teach()` is where the
   * teaching path actually opens; the door is only one of its callers.
   */
  let lessonsOffered = false;
  /**
   * The game's own short sounds.
   *
   * ⚠️ THE CAPTION COMES FROM THE ENGINE AND THE SOUND DOES NOT. `engine.captionSound` shows the
   * caption when the child has captions on; there is no `sfx` on the Engine a cartridge receives,
   * so the note itself is synthesised here. See the header of `ui/earcons.ts`.
   */
  const earcons = createEarcons({
    caption: (text) => { engineRef.current?.captionSound(text); },
  });

  /**
   * The two teachers, and they are INDEPENDENT — the Dev, 2026-10-04.
   *
   *   · «Setas» draws every move the engine rates at the same level, and says the best one.
   *   · «Protetor de Lances» refuses any move outside that same set: a whistle, and the piece
   *     back where it started.
   *
   * ⚠️ THEY WERE ONE THREE-VALUED SETTING FOR A FEW HOURS, on my reading that the second existed
   * to withhold what the first showed. The Dev decided otherwise the same day, and the renaming is
   * what makes the reason plain: one is a DISPLAY and the other is a RULE. With both on, the
   * arrows say exactly what the guard will accept, which is the gentlest way either of them works
   * — and it is the combination a child learning openings would actually want.
   *
   * ⚠️ TWO OLD SHAPES ARE READ ON THE WAY IN, because neither should cost a child their setting:
   * the three-valued `teacher` of this morning, and the `hints` boolean that every board saved
   * before it.
   */
  let arrows = remembered.arrows ?? (remembered.teacher !== undefined
    ? remembered.teacher === 'arrows'
    : remembered.hints ?? false);
  let guard = remembered.guard ?? (remembered.teacher === 'silent');
  /** True for either: both want the engine's set, and only one of them draws it. */
  const teaches = (): boolean => arrows || guard;
  let hintFen: string | null = null;
  let hinted: readonly HintMove[] = [];
  /** The hint request in the air, so a caller that must WAIT joins it instead of missing it. */
  let pendingHint: Promise<void> | null = null;

  /**
   * ========================= PROTECTED MODE =========================
   * The engine watches the player's own moves and stops the game when one throws it away. Not a
   * difficulty setting — it changes nothing about how the opponent plays — but a teaching aid: the
   * moment a blunder is worth talking about is while the position it ruined is still on the board
   * and the reason is still in the player's head.
   *
   * ⚠️ THE OPPONENT WAITS. A warning that arrived after the reply had been played would be about a
   * position two plies old, and taking the move back would mean unpicking someone else's move as
   * well. So `askOpponent` holds while a verdict on the player's last move is outstanding.
   */
  let protectedOn = remembered.protect ?? false;
  let blunderHeld: ReviewedMove | null = null;
  let stumbles = 0;
  /**
   * ⚠️ The PLY, not the position. Keying on the resulting FEN looked equivalent and was exactly
   * backwards: two different blunders from the same position produce two different positions, so
   * the counter reset on every attempt and never reached three.
   */
  let stumbleAt = -1;

  const prefs = {
    remembered,
    save: (patch: Parameters<typeof patchSettings>[0]) => { patchSettings(patch); },
  };

  // Under the board, because that is what it is about — and outside the panel, which has no room
  // for four numbers that change several times a second.
  const thinking = createThinkingPanel({ doc: host, i18n });
  /**
   * Under the board rather than over it: a player being told their move gave the game away has to
   * be able to LOOK at the position while they decide. See `ui/blunder-bar.ts`.
   */
  const blunderBar = createBlunderBar({
    doc: host, i18n, onAnswer: (takeBack) => { answerBlunder(takeBack); },
  });

  /**
   * ========================= ONE ENGINE, AND A RATING RATHER THAN A WORD =========================
   * "1400" means something to a child who has a rating; "medium" means nothing to anybody.
   *
   * ⚠️ WHAT IT COST: there is no opponent at all until 6.98 MB of WebAssembly has arrived. No
   * offline play, no first move during the download. On a school connection that is a real wait,
   * and it is the price of the rating dial and of a hint that is genuinely full strength.
   */
  let elo = remembered.elo ?? DEFAULT_ELO;
  /**
   * The three settings whose write side-effects live BOTH inside the HUD deps AND inside the
   * engine's `gameOptions` panel. Extracted so the two never drift: Onda 2a opens the engine
   * panel, and chess-pause still exists in the DOM — Onda 2b retires the duplicate. Keeping one
   * body means the day a side-effect is added, it covers both doors.
   *
   * ⚠️ `applyTheme` IS NOT `view.applyTheme`. The latter repaints the renderer; this one updates
   * the model, persists it, swaps the contrast attribute on the region, redraws the HUD, AND calls
   * `view.applyTheme`. The two have the same verb and different scopes; the comment is the fence.
   */
  const applyTheme = (key: string): void => {
    themeKey = key;
    view.applyTheme(key);
    prefs.save({ theme: key });
    const contrast = key.startsWith('contrast-');
    if (paletteHigh !== contrast) {
      paletteHigh = contrast;
      region.dataset.contrast = contrast ? 'high' : '';
    }
    hud.refresh();
  };

  const applyStrength = (next: number): void => {
    elo = next;
    opponent.setStrength(next);
    prefs.save({ elo: next });
    hud.refresh();
    // A change mid-search would otherwise be answered at the OLD rating.
    if (game.phase() === 'thinking') {
      opponent.cancel();
      searching = false;
      askOpponent();
    }
  };

  const opponent = (deps.makeOpponent ?? createStockfishClient)({
    onThought: (thought: Thought) => thinking.update(thought),
  });
  opponent.setStrength(elo);

  const splash = createSplash({
    doc: host,
    i18n,
    // Inert covers the whole game; focus lands on the board. See the two fields' own notes.
    region,
    board,
    /*
     * ⚠️ ONE WAIT, SHARED, and an earlier version split it — opening `APRENDER` before the engine
     * on the grounds that a lesson runs as a hot seat. That was wrong about what study IS:
     * Capablanca's exercises let the student play the position ON from where it is set, and a
     * board you can only answer one question on is not the book. Seven megabytes is also very
     * little to organise a loading strategy around.
     *
     * What changed instead is that the wait became VISIBLE — see `preloadEngine` below.
     */
    ready: Promise.allSettled([
      opponent.ready(),
      host.fonts?.ready ?? Promise.resolve(),
    ]).then((results) => {
      // A rejected font is cosmetic; a rejected engine means the buttons should say so rather than
      // open onto a board with no opponent.
      if (results[0].status === 'rejected') throw results[0].reason;
    }),
  });

  /*
   * ⚠️ FETCHED WHERE THE PROGRESS CAN BE SEEN. The worker downloads the engine from inside itself,
   * so the page had no byte count to show and the splash could only say "loading" — for as long as
   * 7.3 MB takes, which on a school connection is a screen that looks broken. This warms the HTTP
   * cache with a fetch we can read, and the worker's own request then comes out of it.
   *
   * Not awaited: `opponent.ready()` is still what the doors wait on. This only reports.
   */
  /*
   * ⚠️ ONLY WHERE THERE IS A BAR TO FEED. This exists to put a number on the wait, so with no
   * splash in the document there is nothing to report to — and starting a 7.3 MB fetch anyway
   * would mean every test that builds a shell also queues one. That is not a hypothetical: it made
   * the suite flaky the moment this was added unconditionally, passing alone and failing together.
   */
  if (host.getElementById('splash')) {
    void preloadEngine(({ fraction }) => splash.setProgress(fraction));
  }

  /*
   * ⚠️ THE DOOR IS ACTED ON AFTER CONSTRUCTION, NOT DURING IT. `teach()` reaches `startLesson`,
   * which reaches `self` — the object this function has not returned yet. The promise settles on a
   * click, which is always later, so the ordering is safe; wiring it any earlier would be the
   * temporal-dead-zone fault this file has already paid for twice.
   */
  void splash.done.then((door) => {
    if (door === 'learn') self?.teach();
  });

  /**
   * One search per ply, feeding three things at once: the advantage readout, the marks on the
   * score sheet, and protected mode. See `chess/reviewer.ts` for why one is enough.
   */
  const reviewer = createReviewer({
    rules,
    engine: opponent,
    onChange: () => {
      players.refresh();
      hud.refresh();
      // The reviewer is also a clock: protected mode holds the opponent until a verdict lands,
      // and this is the tick that lets it go again.
      askOpponent();
    },
    onVerdict: (entry) => { onVerdict(entry); },
  });

  /*
   * ========================= TWO CLOCKS, AND WHEN THEY RUN =========================
   * The Dev, 2026-10-04: "quero ambos funcionando como relógios de xadrez, entrando em modo de
   * contagem regressiva após o lance do adversário", and, about the walk: "seja onde parar, o
   * relógio fica pausado aguardando o jogador humano jogar."
   *
   * Three rules, and they are the whole of it:
   *   · a move lands  -> the clock of the side now ON MOVE starts, the other stops;
   *   · a walk begins -> both stop, and nothing restarts them until a move lands;
   *   · a new game    -> both back to 5:00, stopped.
   *
   * ⚠️ THE ENGINE'S CLOCK RUNS WHILE IT THINKS, which is not a special case but the same rule: it
   * is the side on move. A player watching the opponent's time drain while Stockfish searches is
   * seeing something true.
   */
  /*
   * ⚠️ THE RUNG IS AN INDEX, NOT A CONTROL. The Dev asked the middle button to «toggle» through the
   * ladder, so what is remembered is WHERE on it we are — which survives a change of language and
   * is one number in `sessionStorage` rather than two.
   */
  let rung = TIME_CONTROLS.findIndex((c) => c?.minutes === 5 && c.increment === 0);
  const control = (): TimeControl | null => TIME_CONTROLS[rung] ?? null;
  const timed = (): boolean => control() !== null;

  const clock = createChessClock({
    onTick: () => { players.refresh(); },
    /*
     * ⚠️ AND IT ENDS THE GAME NOW. It did not: "para em 0:00, diz uma vez e deixa a posição em
     * paz", with the hook left for the other answer. The Dev, 2026-10-04: "é para terminar, com
     * partida perdida caso o contador chegue a zero." This is that hook, used.
     *
     * `game.stop()` rather than anything in `rules`: a position whose clock has run out is a
     * perfectly legal position, chess.js has nothing to say about it, and every guard that already
     * refuses input on `over` refuses it here with no new branch.
     */
    onFlag: (side) => {
      game.stop();
      announcer.alert(i18n.t('clock.lost', { side: i18n.t(`turn.${side}`) }));
      hud.refresh();
    },
  });

  const players = createPlayerStrips({
    doc: host, i18n, rules,
    evaluation: () => reviewer.evaluation(),
    mistakes: (side) => reviewer.mistakes(side),
    clock: {
      // ⚠️ An em dash on «sem tempo», not 0:00 and not an empty box: the clock is there, it is
      // simply not counting, and a blank would read as a thing that failed to load.
      text: (side) => (timed() ? formatClock(clock.remaining(side)) : '\u2014'),
      running: () => clock.running(),
      flagged: (side) => clock.flagged(side),
    },
  });

  /** A move has landed, by either hand. The clock passes to whoever is on move. */
  function movePlayed(): void {
    if (!timed()) return;
    // ⚠️ THE INCREMENT GOES TO THE SIDE THAT JUST MOVED, which is the one NOT on move now.
    clock.addIncrement(rules.turn() === 'w' ? 'b' : 'w');
    if (rules.isGameOver()) { clock.pause(); return; }
    clock.start(rules.turn());
  }

  /**
   * `xadrez-2026-10-04-1532.pgn`.
   *
   * ⚠️ THE DATE AND THE TIME, because a child who saves three games in an afternoon gets three
   * files and not one asked-about overwrite. Local time rather than ISO: the name is read by the
   * person who made it, in the room they made it in.
   */
  function pgnFilename(): string {
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `xadrez-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      + `-${pad(now.getHours())}${pad(now.getMinutes())}.pgn`;
  }

  /** The middle button of the game row: one rung along the ladder, wrapping at the end. */
  function nextControl(): void {
    rung = (rung + 1) % TIME_CONTROLS.length;
    applyControl();
    hud.refresh();
  }

  function applyControl(): void {
    const next = control();
    clock.configure((next?.minutes ?? 5) * 60_000, (next?.increment ?? 0) * 1000);
    if (!next) clock.pause();
  }

  applyControl();

  /*
   * ⚠️ `playerSide` WAS NEVER PASSED, by any of the three roots, for the whole life of this
   * game. `createChessDeclaration` defaults it to white — so a player who chose black was told the
   * board from the other side of it: their own pieces declared `key`, the piece hunting their king
   * declared `structure`, and the king they were defending declared `goal`.
   *
   * Nothing about that is visible. The seven fields feed the sonar and the screen reader and
   * nothing else, so it was wrong only for the players who cannot see the board — which is the
   * whole audience those fields exist for.
   */
  const declaration = createChessDeclaration({
    rules: () => rules, state: () => game, i18n, playerSide, cursor: () => cursor,
  });
  /*
   * ========================= THE DIVISION OF ADR-0139 §1, MADE EXPLICIT =========================
   * `CreateGameOptions` splits in two, and the record's test for which half a field belongs to is
   * whether a PAGE could answer it without knowing which game is running. The host's half describes
   * the document and the device; the game's half is every field that is a callback INTO this game or
   * a statement ABOUT it.
   *
   * ⚠️ WRITTEN OUT HERE BECAUSE THIS GAME IS GOING TO BE A CARTRIDGE, and a cartridge does not
   * receive these options — it SUPPLIES this half and somebody else calls `createGame` once, for
   * however many games share the page. Naming the half now, while the two are still adjacent, is how
   * the split gets made from what the code already says instead of from a fresh design.
   *
   * 📌 `declines` STAYS ON THE HOST'S SIDE, and that is a reading rather than a decision: ADR-0139
   * leaves its direction open, noting it reads as a statement about what a GAME does not have while
   * `createGame` also returns a resolved `declines`. It is where it was; the record says to read the
   * implementation before moving it.
   */
  /**
   * Put a colour-vision correction on the board, from wherever it was asked for.
   *
   * ⚠️ ONE WRITER, BECAUSE THERE ARE NOW TWO ASKERS: the select in this game's pause menu, and the
   * 🚥 icon the engine mounts in the accessibility bar. Two copies of three lines would be two
   * places for the filter and the remembered key to drift apart, and the symptom would be a bar
   * that changes the board while the panel still shows the old answer.
   */
  /*
   * ⚠️ A `const` ARROW AND NOT A `function`, AND `tsc` IS WHAT INSISTED. A function declaration is
   * HOISTED, so it could in principle run before the `if (!region) throw` twenty lines above —
   * which means TypeScript refuses to narrow `region` inside it, and refusing is right. An arrow
   * cannot be called before its own line, so the guard holds and the narrowing with it.
   */
  const applyVision = (key: string): void => {
    board.style.filter = VIZ_FILTER[key] ?? '';
    hud.refresh();
  };

  const hooks: CartridgeHooks & { declaration: typeof declaration } = {
    declaration,
    /*
     * ========================= WHAT EACH PAUSE ITEM DOES, AND WHY IT IS NOT DECORATION =========================
     * 🔴 THIS FIELD DID NOT EXIST UNTIL ENGINE 9, AND ITS ABSENCE REACHED EVERY GAME AT ONCE. The
     * engine's own comment says it: `initPauseIcons` has accepted `getPauseActs` since it was
     * written, `createGame` never passed it and had no field for it, so NO game mounted by that root
     * could wire a single pause item.
     *
     * ⚠️ AND THE COST LANDED ON THE ACCESSIBILITY BAR RATHER THAN ON THE CARD. `entrarNaBarra` calls
     * `acts.resume?.()` to step out of the pause card before handing the directional keys to the
     * bar. With an empty table that call is `undefined`, the card stays over the game, and ADR-0044
     * item 7 — the directional DRIVING the bar — was unreachable from any game in the catalogue.
     *
     * So the bar this game mounted in `b75c807` was reachable by Tab and by pointer and NOT by the
     * mode the engine designed for it. Nothing said so: it is not in `problems`, and it looks like
     * a bar that works.
     *
     * 📌 ONE ACT, DELIBERATELY. This game has its own pause menu — `.chess-pause`, opened with the
     * key a player is told about — and the engine's card is not meant to become a second one. What
     * `resume` buys is the door OUT of that card, which is the thing the bar needs.
     *
     * ⚠️ IT READS `engine`, WHICH IS DECLARED SIXTY LINES BELOW THIS OBJECT. That is safe and the
     * reason is worth writing, because this repository has been bitten by temporal dead zones three
     * times: the reference lives inside a function body that nothing calls during construction. By
     * the time the engine asks for the table, the binding it names has been filled by `create()`.
     */
    /**
     * Table consulted LAZILY: the engine calls this each time the pause card opens, so a `quit`
     * that only exists in a lesson appears only in a lesson.
     *
     * ⚠️ `quit` IS WHAT «SAIR DA AULA» BECAME. The engine's own PM_BTNS carries a `quit` row with
     * the i18n key `pause.quit` → «Sair»; it is the engine's vocabulary and this file does not
     * override the word. During a lesson the row acts as «sair da aula»; outside a lesson the
     * entry is absent and the row does not mount at all (`itensQueAccionam` filters). Overriding
     * the label would need `PauseIconsCtx.dynLabel`, which `CartridgeHooks` does not expose yet —
     * noted in the «Parte da engine» plan section as the one gap this coexistence has to live with.
     */
    getPauseActs: () => ({
      resume: () => engine.pause.hide(0),
      ...(lessonMode ? { quit: () => { engine.pause.hide(0); lessonMode?.stop(); } } : {}),
    }),
    /*
     * ========================= THE 🚥 ICON, AND THE ⚫ ONE THAT IS NOT HERE =========================
     * 🔴 ENGINE 9 OPENED A DOOR THAT DID NOT EXIST, and its own comment names the misreading I made
     * when mounting the bar: I wrote that contrast and colour-vision were absent because this game
     * «already offers both in its pause menu». The engine's record answers that exactly — «verdade
     * sobre o resultado e falso sobre a causa. Uma lacuna que o consumidor lê como escolha é a pior
     * forma de lacuna». The icons were unmountable because no game could supply the setter.
     *
     * The mapping is mechanical: the engine's axis is `tricro | protan | deuter | tritan`, this
     * game's keys are `normal` and `fix-*`, and one is the other with a prefix.
     *
     * ⚠️ AND `setTemaDoJogador` IS DELIBERATELY NOT PASSED, which is why the ⚫ icon stays absent.
     * The engine's theme axis is a CONTRAST LEVEL — `padrao | hc3 | hc45 | hc7`, three of them
     * naming measured ratios. This game's themes are seven NAMED PALETTES, and two of them are high
     * contrast for different renderers rather than different levels. Wiring them would make this
     * game assert ratios it has not measured — and `render/palette.ts` records the opposite: five of
     * the seven have piece fills BELOW 3:1. The engine's own comment says these are two questions
     * and a game may answer one; this is a game that can correct colour and cannot claim a level.
     */
    setPlayerCorrection: (_i: number, correcao: string) => {
      applyVision(correcao === 'tricro' ? 'normal' : `fix-${correcao}`);
    },
    /*
     * ⚠️ GAME-OWNED, AND ENGINE 9 IS WHAT SETTLED IT. This sat on the host's side with a comment
     * saying ADR-0139 left the direction open and that the implementation should be read before
     * moving it. The implementation arrived: `MetadeDoJogo` in engine 9 lists fifteen fields rather
     * than ten, and `declines` is one of the five the record's first version had left out — its own
     * test («could a PAGE answer this without knowing which game is running?») puts them here.
     */
    declines: { noNeuralVoice: true, noPauseActor: true },
    /*
     * ⚠️ `viz: 'normal'` LEFT, and the absence is the news. The sonar no longer reads a visual mode
     * off the player: the engine's root answers `visaoComprometida` for it, from the two-axis
     * `visual` state a player may carry. This game carries none — a cursor on a board has no
     * eyesight of its own — so the answer stays the same one `'normal'` used to give: not impaired.
     * The blind mode that DOES matter here reaches the sonar through `isBlindMode`, as before.
     */
    /*
     * ========================= HOW MANY ACTIONS THIS GAME ASKS FOR =========================
     * The engine cannot count them by itself, and without the count the reach notice never appears:
     * `createGame` only shows it `if (acoesDoJogo.length)`, and `acoesDoJogo` is empty for a game
     * that declares no preset. So this is not decoration — it is the difference between a child on
     * a two-button device being told, before she starts, that this game asks for more than her
     * device offers, and that same child pressing at a board that does not answer.
     *
     * ⚠️ THE LIST ITSELF IS NOT HERE, AND THAT IS THE POINT. It is the same set of actions the hint
     * line prints, so it lives once, in `ui/key-hints.ts`, with the reasoning for what it includes
     * and the note about the labels freezing in the boot language. Written out again here it would
     * be two lists of one fact with nothing obliging them to agree — which is the shape that
     * produced a key line advertising keys nothing listened to.
     */
    /**
     * The eighteen GAME-KEYED accommodations (ADR-0153), answered minimally in Wave 1 — every one
     * `false`. Four have a real subject in chess (`pieceSets`, `hints`, `ownerColors`,
     * `contrastOutlines`) and open up in Wave 2 through `gameOptions`; declaring their keys here
     * before the dictionaries carry them would only put four lines in `engine.problems`.
     */
    /**
     * Chess's dictionary entries the engine itself resolves (preset labels now; accommodations,
     * gameOptions and howToPlay in Wave 2). Chess's own i18n keeps all of its catalogue — pieces,
     * sides, patterns, phrases — because the engine's translator takes flat records only.
     *
     * ⚠️ The three keys below cover `keys.move`, `keys.select`, `keys.cancel`, `keys.teacher`,
     * `keys.panel`, `keys.sonar` — the labelKeys of chess's `preset`. Chess's own catalogue has
     * each in `app/js/i18n/{pt,en,es}.ts` and we project just those six here.
     */
    dictionaries: (() => {
      /*
       * Every key the engine's own surfaces resolve from CHESS's catalogue: the preset's labels,
       * each gameOption's label + hint, each list value's label. The three catalogues in
       * `app/js/i18n/{pt,en,es}.ts` carry the words; this is the projection into the flat shape
       * `CreateGameOptions.dictionaries` wants.
       *
       * A KEY THE DICTIONARY LACKS LEAVES A ROW UNNAMED (ADR-0232 D3). The engine's `problems`
       * list says which — keep this list exhaustive against every `labelKey`/`hintKey` below.
       */
      const keys = [
        'keys.move', 'keys.select', 'keys.cancel', 'keys.teacher', 'keys.panel', 'keys.sonar',
        // ⚠️ `keys.rankStart`/`keys.rankEnd` SINCE WAVE 3 STEP 3 (2026-10-02): the preset carries
        // leftShoulder/rightShoulder with these labels, and the dictionaries projection has to
        // name them too or the remap screen draws the row with the raw key visible to a child.
        'keys.rankStart', 'keys.rankEnd',
        'hud.pieceSet', 'go.pieceSet.hint',
        'pieceSet.symbols', 'pieceSet.math', 'pieceSet.pecita',
        'hud.boardTheme', 'go.boardTheme.hint',
        'theme.brown', 'theme.wikipedia', 'theme.xboard', 'theme.jose',
        'theme.cbsafe', 'theme.cbwarm', 'theme.contrast1', 'theme.contrast2',
        'hud.mode', 'go.mode.hint', 'mode.w.long', 'mode.b.long', 'mode.two.long',
        'hud.strength', 'go.strength.hint',
        'elo.1000', 'elo.1200', 'elo.1400', 'elo.1600', 'elo.1800', 'elo.2000',
        'elo.2200', 'elo.2300', 'elo.2400', 'elo.2500', 'elo.3000',
        'hud.outline', 'go.outline.hint',
        'hud.coordinates', 'go.coordinates.hint',
        'hud.protected', 'go.protected.hint',
      ];
      const project = (locale: 'pt' | 'en' | 'es'): Readonly<Record<string, string>> => {
        const scoped = createI18n(locale);
        return Object.fromEntries(keys.map((k) => [k, scoped.t(k)]));
      };
      return { pt: project('pt'), en: project('en'), es: project('es') };
    })(),

    accommodations: {
      cameraSway: false, easyMode: false, wheelchairMode: false, detectionLeniency: false,
      intensity: false, hints: false, reducedCharacterMotion: false, caneSpacing: false,
      textPace: false, lexicalDifficulty: false, wordHighlight: false, pieceSets: false,
      distinguishableSuits: false, timingWindow: false, aimAssist: false, repeatedInput: false,
      ownerColors: false, contrastOutlines: false,
    },

    /**
     * Chess's own options, drawn by the engine's `options` panel (ADR-0182). Wave 2a opens the
     * first one — `piece-set` — through this door to prove the mechanism; Wave 2b expands to the
     * other five and dismantles the `.chess-pause` card that still houses them today.
     *
     * ⚠️ READ EVERY TIME, NOT CAPTURED. The engine redraws each row on opening and after each
     * write (ADR-0232 D3 erratum), so a value fed in through a closure that captured the view at
     * build time would stop updating the moment `switchView` runs. Reads delegate to
     * `view.hudControls`, which is already the shell's one point of truth for the per-view
     * controls (ADR-0139 §4 half we did ship).
     */
    gameOptions: [
      {
        id: 'piece-set',
        labelKey: 'hud.pieceSet',
        hintKey: 'go.pieceSet.hint',
        kind: 'list' as const,
        values: [
          { value: 'symbols', labelKey: 'pieceSet.symbols' },
          { value: 'math', labelKey: 'pieceSet.math' },
          { value: 'pecita', labelKey: 'pieceSet.pecita' },
        ],
        read: (): string => view.hudControls.pieceSet?.() ?? 'symbols',
        write: (value: string): void => { view.hudControls.onPieceSet?.(value); },
      },
      {
        /*
         * Palette. The seven BOARD_THEMES (two high-contrast included) cycle through
         * `applyTheme`, which carries the side-effects chess-pause's own radio carried: persist,
         * repaint, swap `data-contrast`, refresh HUD.
         */
        id: 'board-theme',
        labelKey: 'hud.boardTheme',
        hintKey: 'go.boardTheme.hint',
        kind: 'list' as const,
        values: BOARD_THEMES.map((t) => ({ value: t.key, labelKey: t.name })),
        read: (): string => themeKey,
        write: (value: string): void => { applyTheme(value); },
      },
      {
        /*
         * Who plays. `chooseMode` saves to sessionStorage and reloads — same path as chess-pause.
         */
        id: 'mode',
        labelKey: 'hud.mode',
        hintKey: 'go.mode.hint',
        kind: 'list' as const,
        values: [
          { value: 'w',   labelKey: 'mode.w.long' },
          { value: 'b',   labelKey: 'mode.b.long' },
          { value: 'two', labelKey: 'mode.two.long' },
        ],
        read: (): string => mode,
        write: (value: string): void => { chooseMode(value as GameMode); },
      },
      {
        /*
         * Opponent strength. STRENGTH_LADDER.name is already the elo-i18n key; `applyStrength`
         * persists, retargets Stockfish mid-search, and refreshes the HUD.
         */
        id: 'strength',
        labelKey: 'hud.strength',
        hintKey: 'go.strength.hint',
        kind: 'list' as const,
        values: STRENGTH_LADDER.map((rung) => ({ value: String(rung.elo), labelKey: rung.name })),
        read: (): string => String(elo),
        write: (value: string): void => { applyStrength(Number.parseInt(value, 10)); },
      },
      {
        /*
         * Piece outline. VIEW-DEPENDENT: the flat board has none (its glyphs are typefaces); a
         * read falls back to false there, and a write is a no-op. Not perfect UX while chess-pause
         * still coexists; Onda 2b considers persisting it across views.
         */
        id: 'outline',
        labelKey: 'hud.outline',
        hintKey: 'go.outline.hint',
        kind: 'switch' as const,
        read: (): boolean => view.hudControls.outline?.() ?? false,
        write: (on: boolean): void => { view.hudControls.onOutline?.(on); },
      },
      {
        id: 'coordinates',
        labelKey: 'hud.coordinates',
        hintKey: 'go.coordinates.hint',
        kind: 'switch' as const,
        read: (): boolean => view.hudControls.coordinates(),
        write: (on: boolean): void => { view.hudControls.onCoordinates(on); },
      },
      {
        /*
         * Protected mode (chess-specific, solo only). Reads from `protectedOn`; writes delegate to
         * the same handler the HUD had — persist, drop the held blunder bar, refresh, re-ask the
         * engine (so a change mid-think reaches the search).
         */
        id: 'protected',
        labelKey: 'hud.protected',
        hintKey: 'go.protected.hint',
        kind: 'switch' as const,
        read: (): boolean => protectedOn,
        write: (on: boolean): void => {
          protectedOn = on;
          if (!on) { blunderHeld = null; blunderBar.show(null); }
          prefs.save({ protect: on });
          hud.refresh();
          askOpponent();
        },
      },
    ],

    preset: actionPreset(SONAR_ACTION),
    /*
     * ========================= IT IS NEVER TIME FOR THE ENGINE TO NAVIGATE A MENU HERE =========================
     * The engine asks "is it now time to navigate a menu?" and, absent an answer, says YES — which
     * is right for the game it was written for (a quiz, always in its menus) and wrong here. Its
     * `menu-nav` listens on the WINDOW, in the capture phase, and with a yes it will consume any
     * key carrying menu intent — the arrows, Enter, Space, Escape — the moment it finds a card of
     * its own open. Every one of those keys is the board's in this game.
     *
     * It changes nothing today, because the only card it could find is the one this game never
     * reveals. It is written for the day that stops being true: an engine that starts opening its
     * pause card by itself would otherwise take the arrow keys away from a chessboard, in the
     * capture phase, and the symptom would be a cursor that stops moving for no reason on screen.
     *
     * ⚠️ AND IT DOES NOT COST THE ACCESSIBILITY BAR, which was the thing to check before answering:
     * `menuNavKey` tests `naBarraDe` BEFORE this guard, on purpose — that mode runs while the game
     * is PLAYING, which is the whole point of it. Saying no here leaves the bar exactly as it was.
     */
    isNavigable: () => false,
  };

  /*
   * ========================= THE ENGINE ARRIVES; IT IS NOT MADE HERE =========================
   * ADR-0139 §2, and the record calls it the clause the others hang from: a cartridge never calls
   * `createGame`. Six games each calling it inside one platform would deduplicate the BYTES and
   * multiply the RUNTIME — N accessibility bars, N TTS instances, N keyboard runtimes competing for
   * one document — which is a worse failure than shipping the engine twice, and one that appears as
   * broken behaviour rather than as weight.
   *
   * ⚠️ AND IT IS WHAT MAKES ONE SOURCE SERVE TWO SHELLS (ADR-0140). Because the caller is outside,
   * the caller is free to differ: `boot/standalone.ts` calls `createGame` for this repository's own
   * PWA, and a platform would hand over the one engine it already built. Nothing in here knows
   * which it got.
   *
   * `let` rather than a parameter because the engine is consumed by handlers defined below, which
   * are all called after `create()` has run. Measured: exactly four members are read — `keyboard`,
   * `pausa`, `problems` and `sonar` — so this is a narrow seam rather than a leak.
   */
  // ⚠️ `undefined` IS THE DECLINE. See the tombstone above: the bar is gone and the engine's
  // `problems` line about it is left to print, because the debt is real.
  const hosts = { a11yBarHost: undefined, pauseHost: enginePause };

  /**
   * ⚠️ THE SHELL BUILDS THE MIRROR, not the view, because all three pages have one. On the flat
   * page it IS the board with its `sr-only` taken off; on the other two it is the accessible board
   * behind an `aria-hidden` canvas. One object, two jobs, and the difference is a boolean.
   */
  const mirror = createGridMirror({
    doc: host,
    i18n,
    rules: () => rules,
    state: () => game,
    ...(deps.visibleMirror ? { visible: true, set: remembered.set, theme: themeKey } : {}),
    onActivate: (square) => onActivate(square),
    onCursor: (square) => { cursor = square; syncMarks(); },
    resolveAction: (code) => engine.keyboard.actionOf(code, 0),
  });
  /*
   * ⚠️ MIRROR STARTS HIDDEN ON 2.5D/3D (2026-10-03). The mirror is always built with
   * `visible: true` so the 2D view has drawings on hand after a switch, but the two canvas
   * views cover a smaller area now (to leave room for file/rank labels), so the mirror would
   * show BESIDE the canvas instead of behind it. `sr-only` keeps the glyphs reachable for
   * screen readers and out of the layout at the same time.
   */
  if (deps.kind !== '2d') mirror.root.className = 'sr-only';

  /**
   * Build a renderer against this game. Extracted so a SWAP can repeat it exactly.
   *
   * ⚠️ THE CONTEXT IS NOT A SNAPSHOT — every field is an accessor into the live game, which is what
   * makes a second call safe: the new renderer reads the same rules, the same state and the same
   * cursor as the one it replaces, rather than a copy taken when the page loaded.
   */
  const mountView = (factory: ViewFactory): BoardView => factory({
    doc: host,
    region: board,
    i18n,
    rules: () => rules,
    state: () => game,
    mirror,
    playerSide,
    prefs,
    reducedMotion: () => motionReduced,
    activate: (square) => onActivate(square),
    keyIntent: (code) => engine.keyboard.actionOf(code, 0),
  });

  /*
   * ⚠️ `let`, BECAUSE A VIEW CAN BE REPLACED NOW. It was a `const` for as long as a page was a view
   * — `index.html` was the projected board and `3d.html` was the solid one, and changing view meant
   * a navigation. Inside a platform that is a second URL rather than a second bundle (ADR-0139), so
   * the board has to change underneath the same document.
   *
   * 📏 Measured before making it mutable: the shell holds the view in ELEVEN places, and ten of
   * them are calls that a swap handles by itself. The eleventh was the piece-drawing list the panel
   * captured, fixed in `373e9ed`.
   */
  let view = mountView(deps.view);
  let viewKind = deps.kind;
  /**
   * Whether `view` is a renderer that is actually mounted.
   *
   * ⚠️ A WINDOW THAT DID NOT EXIST WHILE EACH VIEW OWNED ITS CLOCK. `switchView` tears the old
   * renderer down and then AWAITS the import of the next one; for that whole moment `view` names
   * something destroyed. Nobody noticed because every caller of a view is a person doing something,
   * and a person cannot click during an await they did not know about — but the frame loop is not a
   * person, it runs sixty times a second, and it is guaranteed to land in there. A frame drawn into
   * a torn-down stage throws, and `startLoop` answers a throw by removing its callback for good: one
   * change of view and the board would freeze for the rest of the game.
   */
  let mounted = true;

  const hud = createHud({
    doc: host,
    view: () => viewKind,
    /*
     * ⚠️ THE PANEL ASKS AND THE COMPOSITION ROOT ANSWERS, which is the whole reason `switchView`
     * is on the shell rather than in the panel. A switcher that knew how to mount a renderer would
     * be a second place that knows what a Zdog view is, and the panel is the one part of this game
     * that never needed to.
     *
     * `void` because a click handler cannot await: the renderer arrives by dynamic import, and a
     * failure there is reported by the shell rather than swallowed here.
     */
    // `self?` and not `self!`: the binding is null only until this function finishes building the
    // shell, and nobody can click a button that is not in the document yet. Optional rather than
    // asserted because an assertion here would be a claim about timing that nothing checks.
    onView: (kind: ViewKind) => { void self?.switchView(kind); },
    i18n,
    rules: () => rules,
    state: () => game,

    themes: BOARD_THEMES.map((t) => ({ key: t.key, name: t.name })),
    theme: () => themeKey,
    onTheme: applyTheme,

    markAt: (ply) => reviewer.markAt(ply),
    /*
     * ⚠️ THE TEACHERS WORK IN A TWO-PLAYER GAME TOO, SINCE 2026-10-04. They were withheld there —
     * "no engine in a two-player game, so nobody to ask" — which confused the OPPONENT with the
     * ANALYST. The engine is still in the page either way; what a two-player game declines is
     * having it MOVE. The Dev: "as flechas e protetor de lance, se ligados, funciona dos dois
     * lados do tabuleiro", and they do, because a hint is asked of the position and the position
     * belongs to whoever is on move.
     */
    ...({
      onHint: () => {
        chooseTeacher({ arrows: !arrows });
      },
      arrows: () => arrows,
      onArrows: (on: boolean) => { chooseTeacher({ arrows: on }); },
      guard: () => guard,
      onGuard: (on: boolean) => { chooseTeacher({ guard: on }); },
      hintBusy: () => hinting,
    }),

    /*
     * ⚠️ THE LIST IS REBUILT ON EVERY `hud.refresh()`, which is what makes a finished lesson show
     * its tick without anybody wiring an event. `loadProgress` reads `localStorage`, and the whole
     * cost is one string comparison per lesson.
     */
    ...(deps.teaches
      ? {
        lessons: () => LESSONS.map((lesson) => ({
          id: lesson.id, title: lesson.title, done: learned().includes(lesson.id),
        })),
        lessonsVisible: () => lessonsOffered,
        onLesson: (id: string) => { void startLesson(id); },
      }
      : {}),

    /*
     * ⚠️ NAMED IN THEIR OWN LANGUAGES. A reader looking for Spanish is looking for "Español", not
     * for this game's Portuguese word for Spanish — which is the one string a language menu must
     * not translate.
     */

    opening: () => openingName,

    /*
     * ========================= DELEGATED, NOT SPREAD =========================
     * ⚠️ THIS WAS `...view.hudControls`, AND THE SPREAD WAS THE OTHER HALF OF A BUG I ONLY HALF
     * FIXED. `373e9ed` made the piece-drawing LIST a function so it could be re-read; this line was
     * still copying the object that holds it, once, from whichever renderer happened to be first.
     * The test said so: after `switchView` the panel offered nothing at all, because it was still
     * asking the renderer that had been destroyed.
     *
     * Five of the seven are universal — every view lends drawings and coordinates. The outline is
     * not: 📏 measured, only the projected board has one, so it is announced separately and the
     * panel hides the control where the current view lends none. A switch that does nothing is
     * worse than a switch that is not there.
     */
    pieceSets: () => view.hudControls.pieceSets?.() ?? [],
    pieceSet: () => view.hudControls.pieceSet?.() ?? '',
    onPieceSet: (key: string) => view.hudControls.onPieceSet?.(key),
    /*
     * ⚠️ THE LABEL IS PER VIEW, which is the Dev's "somente no tabuleiro X" of 2026-10-04. The
     * flat board offers glyph SETS and the other two offer piece DESIGNS, so one name for all
     * three would be wrong on two of them.
     */
    pieceSetsLabel: () => (viewKind === '2d' ? 'hud.pieceSet2d'
      : viewKind === '2.5d' ? 'hud.pieceSet25d' : 'hud.pieceSet3d'),
    strengths: STRENGTH_LADDER.map((rung) => ({ elo: rung.elo, name: rung.name })),
    strength: () => elo,
    onStrength: applyStrength,
    /*
     * ⚠️ FORWARDED THROUGH THE VIEW, NOT COPIED FROM IT. The board under the panel changes while
     * the panel stays, so every one of these asks whichever renderer is mounted right now —
     * including whether it HAS an outline at all, which only the projected one does.
     */
    outline: () => view.hudControls.outline?.(),
    onOutline: (on: boolean) => view.hudControls.onOutline?.(on),
    coordinates: () => view.hudControls.coordinates(),
    onCoordinates: (on: boolean) => view.hudControls.onCoordinates(on),
    /*
     * ========================= THE LANGUAGE, THROUGH THE ENGINE =========================
     * `engine.setLocale` is the only writer: the engine redraws everything that is its own — the
     * caption, the card, the pad, the voice that speaks and the model that listens — and then
     * calls `onLocaleChange`, which is where chess redraws the activity. Writing `locale` here
     * instead would translate the panel and leave the rest of the page in the old language.
     *
     * ⚠️ READ THROUGH `engineRef`, NOT CAPTURED. The panel is built before `createGame` returns —
     * the engine is handed hosts that live inside it — so a captured `engine` would be the
     * previous instance or nothing at all.
     */
    /*
     * ⚠️ TOGGLING IT DOES NOT RELOAD, which is the whole reason it is a checkbox. The engine moves
     * only when `handOver` gives it the board, so there is no boot-time decision to redo — the
     * next human move simply stops being answered.
     */
    /*
     * ⚠️ PROTECTION IS A TEACHER NOW, and this is the only writer of it that reaches a player: the
     * engine's `gameOptions` entry for `protected` is still declared but the pause card that drew
     * it has been unreachable since the quick bar went.
     */
    /*
     * ========================= TAKING THE GAME AWAY WITH YOU =========================
     * The Dev, 2026-10-04: 📋 "para copiar a partida (notação pgn)", 💾 "para salvar o arquivo pgn
     * no computador".
     *
     * ⚠️ BOTH SAY SO OUT LOUD. A copy that leaves no mark is indistinguishable from a button that
     * does nothing — there is no cursor to watch and no dialog to close — so the announcer says it
     * landed, which also means a child who cannot see the panel is told.
     *
     * ⚠️ AND THE CLIPBOARD IS A PERMISSION, NOT A FUNCTION CALL. `navigator.clipboard` is absent
     * on an insecure origin and may be refused by the browser; the failure is caught and SAID
     * rather than left in the console, because a silent refusal is the same screen as a success.
     */
    onCopyPgn: () => {
      const text = rules.pgn();
      void (async () => {
        try {
          await navigator.clipboard.writeText(text);
          announcer.say(i18n.t('pgn.copied'));
        } catch {
          announcer.alert(i18n.t('pgn.copyFailed'));
        }
      })();
    },
    onSavePgn: () => {
      /*
       * ⚠️ A BLOB AND AN ANCHOR, AND THE URL IS REVOKED. An object URL holds its blob in memory
       * for the life of the document; a child who saves twenty games in a lesson would be holding
       * twenty copies of a score sheet for no reason. `revokeObjectURL` after the click is the
       * whole of the cleanup, and it is safe immediately — the download has already been handed
       * to the browser.
       */
      const blob = new Blob([rules.pgn()], { type: 'application/x-chess-pgn' });
      const url = URL.createObjectURL(blob);
      const link = host.createElement('a');
      link.href = url;
      link.download = pgnFilename();
      host.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      announcer.say(i18n.t('pgn.saved', { name: link.download }));
    },
    onNewGame: () => {
      newGame('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      hud.refresh();
    },
    timeControl: () => {
      const now = control();
      return now === null ? i18n.t('time.none') : formatControl(now);
    },
    onTimeControl: () => { nextControl(); },
    onResetClock: () => { clock.reset(); hud.refresh(); },
    protect: () => protectedOn,
    onProtect: (on: boolean) => {
      protectedOn = on;
      prefs.save({ protect: on });
      hud.refresh();
    },
    twoPlayers: () => twoPlayers,
    onTwoPlayers: (on: boolean) => {
      twoPlayers = on;
      prefs.save({ twoPlayers: on });
      hud.refresh();
    },
    onCpuMove: () => { cpuMove(); },
    countries: COUNTRIES,
    country: () => i18n.getLocale(),
    onCountry: (code: string) => { void engineRef.current?.setLocale(code); },
    canTakeBack: () => !walking && game.canTakeBack(),
    canReplay: () => !walking && game.canReplay(),
    onTakeBack: () => { void walkHistory('back'); },
    onReplay: () => { void walkHistory('forward'); },
  });

  /*
   * ⚠️ `prepend`, NOT `append`, AND NOT `order: -1` IN CSS. The view mounts the board first, so
   * appending put the strips after it — and with the region a flex column that drew them BELOW the
   * board, where the spec says above.
   *
   * CSS `order` would have moved them visually and left them last for a screen reader, which is
   * the mismatch WCAG 1.3.2 is about. Putting them first in the DOM fixes the picture and the
   * reading order with one change, and there is nothing focusable in them to reorder.
   */
  board.prepend(players.root);
  // Outside the panel, over the board: see `.theme-report` in the stylesheet.
  board.appendChild(hud.report);
  /*
   * ⚠️ UNDER THE ACCESSIBILITY BAR, AND BEFORE THE PANEL, which is the whole of what was asked for:
   * the three view buttons went into the pause menu in `32d5227` and the Dev reported them missing
   * on 2026-09-11 — behind a menu that opens on a key, they were not found.
   *
   * A SIBLING of the panel rather than a child, exactly like the bar above it. Two consequences,
   * both wanted: a lesson hides `.chess-hud` and cannot take these away, and the row stays put while
   * the panel scrolls under it. Changing how you look at the board is not a thing to lose track of.
   */
  column.appendChild(hud.views);
  column.appendChild(hud.root);
  /*
   * ========================= ⚠️ BELOW THE STAGE, 2026-10-03 =========================
   * ⚠️ MOVED FROM `#chess-board` TO `#stage-wrap` on the Dev's report of 2026-10-03: appended
   * inside the board, this panel was fighting with the 2.5D canvas for flex space — the three
   * flex items (player strips 48 + canvas 360 + below-board 78) summed past the chess-board's
   * declared 360 px height, so the thinking visually appeared ABOVE the canvas instead of below
   * it ("Pensamento da engine deveria aparecer na parte debaixo da tela, não acima do tabuleiro").
   * It also meant that making the 2.5D canvas `position:absolute; inset:0` (needed so the
   * always-visible mirror hides behind it) would cover `#below-board` and hide the thinking panel
   * entirely.
   *
   * On `#stage-wrap` as a flex-column sibling of `#game-region`, it sits BELOW the whole stage
   * (board + side panel) and spans the stage's own width. It is still "in the stage"
   * (the 16:9 rectangle `#stage-wrap` defines), which is what ADR-0106 asks of every visible
   * element. The CSS width/placement are in `#stage-wrap > #below-board` in `board.css`.
   */
  const below = host.createElement('div');
  below.id = 'below-board';
  const stageWrap = host.getElementById('stage-wrap');
  if (stageWrap) stageWrap.appendChild(below);
  else board.appendChild(below);
  below.appendChild(blunderBar.root);
  // Below the blunder bar: a warning about the move just played is more urgent than the engine's
  // running commentary.
  below.appendChild(thinking.root);

  /**
   * Changes the language, everywhere, without losing where anybody was.
   *
   * ⚠️ THE LESSON PROSE HAS TO BE FETCHED AGAIN. It is a dynamic import per language, so a panel
   * refreshed before the new catalogue lands shows raw keys — which is the documented behaviour of
   * `t()` and useless to a child. Awaited first, then everything is redrawn.
   *
   * ⚠️ AND NOTHING IS REBUILT. Every panel re-reads its own strings, so the focused cell, the
   * open lesson, the step being answered and the reader's place in the list all survive. Rebuilding
   * would have been easier and would have thrown a child out of the lesson they were mid-way
   * through, for the crime of changing language.
   */
  async function changeLocale(code: string): Promise<void> {
    if (code !== 'pt' && code !== 'en' && code !== 'es') return;
    if (code === i18n.getLocale()) return;
    prefs.save({ locale: code });
    i18n.setLocale(code);
    host.documentElement.lang = i18n.bcp47();
    if (lessonMode) {
      const { loadTeach } = await import('../i18n/teach/index.ts');
      i18n.extend(code, await loadTeach(code));
    }
    hud.refresh();
    refreshKeyHints();
    mirror.refresh();
    lessonPanel?.refresh();
    refreshLessonMenu();
    players.refresh();
    thinking.refresh?.();
    blunderBar.refresh();
  }

  /* ============================ NAMING THE OPENING ============================ */

  /**
   * The opening the game is in, or null.
   *
   * ⚠️ FETCHED ON THE FIRST MOVE, NOT AT BOOT. It is 230 kB of names, and a game that has not
   * started cannot be in an opening — so the download is paid for by the first person who plays,
   * and never by somebody who opened the page and left.
   *
   * ⚠️ AND IT IS A CACHED STRING RATHER THAN A LOOKUP PER FRAME. `hud.refresh()` runs on every
   * change; walking twelve prefixes of a growing move list each time is work nobody asked for, and
   * the answer only changes when a move does.
   */
  function refreshOpening(): void {
    const history = rules.history();
    if (history.length === 0) { openingName = null; openingPlies = -1; return; }
    if (!openings) {
      /*
       * ⚠️ "ONE FETCH, EVER" WAS A COMMENT AND NOT A GUARD. `openings` is only set when the book
       * LANDS, so every move played while it was still in the air started another one — counted,
       * on a five-move opening: eleven requests for the same 230 kB. Nothing broke, because they
       * all resolve to the same book, which is exactly why it survived.
       *
       * It is not free. This game is for a school connection, and the whole reason the book is
       * fetched on the first move rather than at boot is to spend that download carefully.
       *
       * When it lands, ask again and redraw — the game will have moved on by then and that is
       * fine, because the answer is computed from the history as it is at that moment.
       */
      if (fetchingOpenings) return;
      fetchingOpenings = true;
      void loadOpenings().then((book) => {
        openings = book;
        refreshOpening();
        hud.refresh();
      }).catch(() => {
        // A name that never arrives is a line that never appears. Nothing else — but the flag is
        // released, so a later move can try again rather than the game going permanently nameless.
        fetchingOpenings = false;
      });
      return;
    }
    if (openingPlies === history.length) return;
    openingPlies = history.length;
    openingName = nameOpening(history.map((m) => m.san), openings)?.name ?? null;
  }

  /* ============================ THE TACTICS ============================ */
  /*
   * `teach/puzzle-lesson.ts` turns a Lichess puzzle into a `Lesson`, so everything the teaching
   * mode already does works on one unchanged — the tutor judges it, the panel draws it, the column
   * lists it, back and forward walk it, the teacher unlocks after three tries. What is left for
   * this file is only finding WHICH.
   */

  /** The five themes, in the order a beginner meets them. Names come from the main catalogue. */
  const PUZZLE_THEMES = ['mateIn1', 'fork', 'hangingPiece', 'pin', 'mateIn2'] as const;
  /** A menu id that is NOT a puzzle id: it names a theme, and picking it opens the next one. */
  const themeEntry = (theme: string): string => `theme:${theme}`;

  /**
   * The set, once.
   *
   * ⚠️ NOT AT BOOT. 59 KB fetched the first time anybody asks for a tactic and never again —
   * somebody who only plays should not carry two hundred positions, which is the same argument
   * that keeps the lesson prose and the renderer off the flat page.
   *
   * ⚠️ AND THE LAZY THING IS THE JSON, NOT THIS MODULE. `loadPuzzles` is imported normally, because
   * `teach/puzzle-lesson.ts` already needs `isStudentMove` from the same file and drags it into
   * this graph regardless — a dynamic import here split nothing and the bundler said so
   * (`INEFFECTIVE_DYNAMIC_IMPORT`). The two hundred positions are behind the dynamic import INSIDE
   * `loadPuzzles`, which is the one that was ever doing the work.
   */
  let puzzles: PuzzleSet | null = null;
  async function puzzleSet(): Promise<PuzzleSet> {
    if (!puzzles) puzzles = await loadPuzzles();
    return puzzles;
  }

  /** The theme of the tactic being solved, so the column can mark which entry is open. */
  let currentTheme: string | null = null;

  /**
   * Opens whatever the column was pointing at: a lesson, or the next unsolved tactic of a theme.
   *
   * ⚠️ THE NEXT UNSOLVED ONE, NOT THE FIRST. A child who has done four mates-in-one and comes back
   * wants the fifth; being handed the first again says their work did not count, which is the same
   * reason APRENDER resumes rather than restarting.
   */
  async function openFromMenu(pick: string): Promise<void> {
    if (!pick.startsWith('theme:')) { await startLesson(pick); return; }
    const theme = pick.slice('theme:'.length);
    const set = await puzzleSet();
    const done = learned();
    const inTheme = set.puzzles.filter((p) => p.theme === theme);
    // All solved: start the theme again rather than refusing. A tactic is worth repeating, and a
    // menu entry that does nothing is worse than one that repeats itself.
    const next = inTheme.find((p) => !done.includes(puzzleId(p))) ?? inTheme[0];
    if (next) await startLesson(puzzleId(next));
  }

  /* ============================ THE TEACHING MODE ============================ */

  /**
   * Which lessons are already finished. Re-read rather than cached: it lives in `localStorage`.
   *
   * ⚠️ A `function` DECLARATION, NOT A `const` ARROW, AND THIS EXACT LINE WAS THE BUG. The HUD's
   * deps call this, `createHud` runs its own `refresh()` while it is being built, and that happens
   * ABOVE here — so as a `const` the binding was still in its temporal dead zone and both roots
   * died with `ReferenceError: Cannot access 'learned' before initialization`.
   *
   * `tsc` sees nothing: the reference is in scope and correctly typed. `tests/boot.browser.test.ts`
   * caught it, which is the third time that file has paid for itself in this way.
   */
  function learned(): readonly string[] {
    return loadProgress().done;
  }

  /** The panel and the driver, once somebody has actually asked for a lesson. */
  let lessonMode: import('./lesson-mode.ts').LessonMode | null = null;
  /**
   * This shell, handed to the lesson driver.
   *
   * ⚠️ AN EXPLICIT SLOT RATHER THAN A REFERENCE TO THE `const` BELOW. Naming the returned object
   * from a function defined above it works — the function only runs after construction — but this
   * repository has already paid for that reasoning twice: `tests/boot.browser.test.ts` exists
   * because two temporal-dead-zone `ReferenceError`s in `main.ts` passed `tsc`, 375 tests and the
   * build. A slot that is visibly filled before it can be read costs one line and argues nothing.
   */
  let self: GameShell | null = null;

  /**
   * Opens a lesson, fetching everything it needs first.
   *
   * ⚠️ THREE DYNAMIC IMPORTS AND NONE OF THEM IS AN ACCIDENT. The panel, the driver and the tutor
   * are only reachable from here, and the driver fetches the prose again on its own — so the flat
   * page's measured weight, which is the whole reason there are three pages at all, is untouched
   * for a player who only ever plays.
   */
  /** The lesson's own side panel, in the slot the HUD normally fills. */
  let lessonMenu: import('../ui/lesson-menu.ts').LessonMenu | null = null;
  /** The lesson section inside it, kept so a change of language can re-read its strings. */
  let lessonPanel: import('../ui/lesson-panel.ts').LessonPanel | null = null;

  /** Redraws the lesson menu. Cheap, and called after anything that could change it. */
  function refreshLessonMenu(): void {
    lessonMenu?.refresh();
  }

  /**
   * ⚠️ RETURNS WHETHER IT OPENED, because one caller has somewhere else to go if it did not.
   * A remembered place can name a lesson that no longer resolves — a tactic dropped from the
   * curated set, a book taken out — and the failure path here tears everything down and leaves
   * the reader looking at the board with nothing said. Silent for a menu click, where the entry
   * came from the list itself; not acceptable for a resume.
   */
  async function startLesson(id: string): Promise<boolean> {
    const [{ createLessonPanel }, { createLessonMode }, { createLessonMenu }] = await Promise.all([
      import('../ui/lesson-panel.ts'),
      import('./lesson-mode.ts'),
      import('../ui/lesson-menu.ts'),
    ]);
    if (lessonMode) lessonMode.stop();
    const panel = createLessonPanel({
      doc: host,
      i18n,
      onChoose: (option) => lessonMode?.chose(option),
    });
    /*
     * ⚠️ NOT UNDER THE BOARD ANY MORE. It lived there so the position stayed in view while the
     * sentence was read — which it still does, because the panel is now the top of the right-hand
     * column and the board is beside it rather than above it. What that buys is the 157 px of
     * height a third panel was taking out of the board's own share.
     */
    lessonMode = createLessonMode({
      // Filled at the end of construction; `startLesson` cannot run before that.
      shell: self!,
      panel,
      say: (text) => { announcer.say(text); refreshLessonMenu(); },
      /*
       * ⚠️ A PUZZLE IS RESOLVED HERE RATHER THAN IN THE DRIVER, because resolving one means
       * fetching a file — which is the composition root's business. The driver only ever sees a
       * `Lesson` and cannot tell the two apart, which is the whole point of the converter.
       */
      find: async (wanted) => {
        /*
         * ⚠️ A BOOK NEEDS NO FETCH AT ALL, which is why it is answered before the puzzle branch
         * rather than beside it: the game is text in the bundle and the converter is synchronous.
         * Routing it through the same hook anyway is what keeps the driver unable to tell a
         * syllabus lesson, a tactic and a book apart.
         */
        if (isBookId(wanted)) {
          currentTheme = null;
          const game = gameById(wanted.slice('book:'.length));
          return game ? gameLesson(game) : null;
        }
        if (!isPuzzleId(wanted)) { currentTheme = null; return lessonById(wanted); }
        const set = await puzzleSet();
        const puzzle = set.puzzles.find((p) => puzzleId(p) === wanted);
        currentTheme = puzzle?.theme ?? null;
        return puzzle ? puzzleLesson(puzzle) : null;
      },
      onLeave: () => {
        panel.destroy();
        lessonPanel = null;
        lessonMenu?.destroy();
        lessonMenu = null;
        lessonMode = null;
        // ⚠️ THE HUD COMES BACK, and it was HIDDEN rather than destroyed. It is the game's own
        // panel and the game is still there underneath; rebuilding it would throw away the move
        // list's scroll position and whatever control the reader had left focus on.
        hud.root.hidden = false;
        players.root.hidden = false;
        thinking.root.hidden = false;
        relayout();
        // The tick on a finished lesson appears here, without an event to wire.
        hud.refresh();
      },
    });

    /*
     * ⚠️ ONE PANEL IN THE SLOT AT A TIME. Almost nothing the HUD shows means anything in a lesson —
     * whose turn it is, the captures, the move list, the difficulty, the take-back pair — so it
     * steps aside entirely rather than hiding nine of its twelve controls and pretending.
     */
    lessonPanel = panel;
    lessonMenu = createLessonMenu({
      doc: host,
      i18n,
      lesson: panel.root,
      lessons: () => [
        ...syllabus().map((l) => ({
          id: l.id,
          title: l.title,
          done: learned().includes(l.id),
          current: l.id === lessonMode?.active()?.id,
        })),
        /*
         * ⚠️ ONE ENTRY PER THEME, NOT ONE PER PUZZLE. Two hundred names would bury the course
         * above them and turn it into a phone book. A theme opens the next tactic in it that has
         * not been solved, which is what a list of two hundred was only ever a slow way of doing.
         *
         * `done` stays false until the set has been fetched, because until then nobody knows how
         * many there are — and claiming a theme is finished before counting it would be a tick
         * that lied.
         */
        ...PUZZLE_THEMES.map((theme) => ({
          id: themeEntry(theme),
          title: `puzzle.theme.${theme}`,
          done: puzzles !== null
            && puzzles.puzzles.filter((p) => p.theme === theme)
              .every((p) => learned().includes(puzzleId(p))),
          current: currentTheme === theme,
        })),
        /*
         * ⚠️ LAST, BECAUSE A BOOK IS WHAT COMES AFTER. The syllabus teaches the moves and the
         * tactics drill one idea at a time; playing a whole game through with somebody explaining
         * it only pays once both of those are somewhere in reach.
         */
        ...GAMES.map((game) => ({
          id: bookId(game),
          title: game.title,
          done: learned().includes(bookId(game)),
          current: bookId(game) === lessonMode?.active()?.id,
        })),
      ],
      onPick: (pick) => { void openFromMenu(pick); },
      place: () => ({
        at: (lessonMode?.stepIndex() ?? 0) + 1,
        of: lessonMode?.active()?.steps.length ?? 1,
      }),
      onBack: () => { void lessonMode?.back().then(refreshLessonMenu); },
      onForward: () => { void lessonMode?.forward().then(refreshLessonMenu); },
      canBack: () => lessonMode?.canBack() ?? false,
      canForward: () => lessonMode?.canForward() ?? false,
      teacher: () => lessonMode?.teacher() ?? false,
      teacherReady: () => lessonMode?.teacherReady() ?? false,
      onTeacher: (on) => { lessonMode?.setTeacher(on); refreshLessonMenu(); },
    });
    column.appendChild(lessonMenu.root);

    const started = await lessonMode.start(id, resumeStepFor(id));
    if (!started) {
      panel.destroy();
      lessonMenu.destroy();
      lessonMenu = null;
      lessonMode = null;
      return false;
    }
    /*
     * ⚠️ THE HUD IS NOT THE ONLY THING THAT MEANS NOTHING IN A LESSON. The player strips carry
     * whose turn it is, the captured tally and an ENGINE EVALUATION; the thinking line reports a
     * search. A lesson is a hot seat with no opponent — `+0.2` and "engine: stopped" are answers to
     * questions nobody asked, sitting above and below the board the whole time.
     *
     * Found by LOOKING at the page rather than by measuring it, which is how all three of these
     * survived: `hidden` was set on the HUD and read back as `true` while 360x720 of controls stayed
     * exactly where they were.
     */
    hud.root.hidden = true;
    players.root.hidden = true;
    thinking.root.hidden = true;
    lessonMenu.root.hidden = false;
    refreshLessonMenu();
    // Nothing is under the board any more, so the board gets that height back.
    relayout();
    return true;
  }

  /**
   * Where to pick a lesson up.
   *
   * ⚠️ ONLY FOR THE LESSON THE READER WAS ACTUALLY IN. `Progress.at` names one lesson, so opening
   * a different one has to start at the top rather than at whatever step number happened to be
   * stored — which would drop a child into the middle of a lesson they had never seen.
   */
  function resumeStepFor(id: string): number | undefined {
    const { at } = loadProgress();
    return at && at.lesson === id ? at.step : undefined;
  }
  paletteHigh = themeKey.startsWith('contrast-');
  // ⚠️ ON THE REGION, WHICH CONTAINS THE PANEL. See the note at the palette control: while this sat
  // on the board, every high-contrast rule aimed at the panel matched nothing at all.
  region.dataset.contrast = paletteHigh ? 'high' : '';

  /*
   * ================= ⚠️ ONE KEYDOWN, ON `#game-region`, NEVER ON `window` =================
   * The engine's rule, and what keeps the board from swallowing keys meant for a dialog.
   *
   * The sonar goes first and it is the shell's, because it is the same on every page — and because
   * two of the three pages have been PRINTING "K sonar" in their keyboard legend while listening
   * for nothing at all. It is on the `especial` intent rather than on a key: a bare `s` was the
   * first attempt and `KeyS` is `down` in the engine's default scheme, so it fought the board
   * navigation. `especial` is the open slot the engine leaves a game to define.
   *
   * What the shell does not want, the view is offered. That is also where `cenas.input(intent)`
   * goes the day there are two things to stack — a lesson over a game, a puzzle over a lesson.
   */
  /**
   * The controls in a panel that focus can actually REACH, in reading order.
   *
   * ========================= ⚠️ THE SAME LESSON, A SECOND TIME =========================
   * This selector used to be written out in two places, and both were missing the same kind of
   * filter. The first round added `:not([disabled])`, because the lesson menu opens on "previous"
   * — disabled at the first step of the first lesson — so the one key that reaches the panel did
   * NOTHING at the moment a reader was most likely to press it.
   *
   * ⚠️ DISABLED IS NOT THE ONLY WAY A CONTROL CAN BE UNREACHABLE, and that is what this round
   * adds. A control that is not DRAWN cannot be focused either: `.focus()` on it is a silent
   * no-op, the walk loses a step, and entering the panel appears to do nothing at all. Found on
   * 2026-10-04, when the HUD's lesson picker began hiding itself for a player who chose JOGAR and
   * became the panel's first "stop" — present in the DOM, impossible to land on.
   *
   * So it is ONE function now. The duplicated literal is how the same hole got dug twice.
   *
   * `getClientRects()` is empty for `display: none` — which is what `[hidden]` is — and the
   * `visibility` check covers the other way to be drawn-but-unfocusable.
   */
  function panelStops(panel: HTMLElement): HTMLElement[] {
    return [...panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]',
    )].filter((el) => el.getClientRects().length > 0
      && host.defaultView?.getComputedStyle(el).visibility !== 'hidden');
  }

  /**
   * Moves focus up and down the side panel.
   *
   * ⚠️ THE PANEL IS A COLUMN OF CONTROLS AND NOTHING GAVE IT ARROWS. Tab reaches them, but a
   * player holding a pad has no Tab — and this game's own board is arrow-driven, so a panel that
   * answered only to Tab would be the one place the controls stopped working. Left and right are
   * deliberately left alone: a `<select>` uses them to change its value.
   *
   * ========================= ⚠️ THE WHOLE COLUMN, NOT `hud.root` =========================
   * The Dev chose this on 2026-10-04, and it closes a hole the argument above had all along: the
   * three view keys (2D / 2,5D / 3D) are a `<nav>` in `#side-column` and a SIBLING of the HUD, so
   * walking only `hud.root` left them reachable by Tab and by nothing else — which is exactly the
   * "one place the controls stopped working" this function exists to prevent, sitting inside the
   * function that prevents it.
   *
   * ⚠️ AND IT MAKES THE LESSON TERNARY UNNECESSARY. The column holds the view keys, the HUD and
   * the lesson menu, and `panelStops` already drops whatever is not drawn — so when a lesson hides
   * the HUD, its controls leave the walk by themselves. One container, one rule, no "which panel
   * is showing" question to get wrong.
   */
  function walkPanel(action: string | null): boolean {
    if (action !== 'up' && action !== 'down') return false;
    const stops = panelStops(column);
    if (stops.length === 0) return false;
    const at = stops.indexOf(host.activeElement as HTMLElement);
    // Clamped at both ends rather than wrapped, for the same reason the board's cursor is: running
    // into the end of a list should feel like an end, not like a teleport to the other one.
    const next = at < 0 ? 0 : Math.min(stops.length - 1, Math.max(0, at + (action === 'up' ? -1 : 1)));
    stops[next]!.focus();
    return true;
  }

  /**
   * The line of keyboard hints under the board.
   *
   * ========================= ⚠️ IT WAS HARDCODED PORTUGUESE, AND IT WAS WRONG =========================
   * It read "Setas navegam o tabuleiro · Enter seleciona · K sonar" in all three pages, in one
   * language, in a game whose floor is three. That was the recorded debt. What the debt did not say
   * is that every claim in it had also stopped being true: Enter opens the PAUSE menu now, K is
   * cancel, and the sonar was on an intent nothing was bound to.
   *
   * ⚠️ A HINT THAT LIES IS WORSE THAN NO HINT. Somebody who presses the key it names and gets
   * something else concludes the keyboard does not work, which is the opposite of what a control
   * list is for — and the people most likely to read it are the ones with no other way in.
   */
  function refreshKeyHints(): void {
    const line = keyHintLine();
    if (!line) return;
    line.replaceChildren();
    /*
     * ⚠️ DERIVED FROM THE SCHEME, NOT TYPED. This was a table of letters — `WASD`, `J`, `K`, `U`,
     * `I`, `L`, `H` — and every one of them is remappable, so the line promised keys it had no way
     * of knowing were still bound. It is the same defect `4345f66` fixed from the other side: that
     * one stopped the WORDS being hard-coded and left the KEYS hard-coded.
     *
     * ⚠️ THE CAMERA HINTS BELONG TO THE VIEWS THAT HAVE A CAMERA, and they used to be typed into
     * two of the three HTML files by hand — which is how the flat page nearly ended up advertising
     * a board it cannot turn. They ride the same four direction keys, so they are derived too.
     */
    const parts = hintParts(engine.keyboard.kbFor(0), {
      camera: deps.kind !== '2d',
      sonar: SONAR_ACTION,
    });
    parts.forEach(([key, label], index) => {
      if (index > 0) line.append(' · ');
      const kbd = host.createElement('kbd');
      kbd.textContent = key;
      line.append(kbd, ` ${i18n.t(label)}`);
    });
  }

  /* ============================ WHAT START OPENS ============================ */

  /**
   * ⚠️ THE ONLY WAY OUT OF A LESSON, and the only one there should be. It was a button under the
   * board, which spent a tap target on a panel meant to carry one sentence and put the exit inside
   * the thing being read.
   */
  /*
   * ========================= THE CHESS-PAUSE IS GONE =========================
   * Onda 2b of the engine-11 migration retired this game's own pause card. The engine mounts its
   * own (`#vp-pause-0`), and the chess-specific controls that used to live in `.chess-pause` moved
   * to `hooks.gameOptions` — the engine's «Opções do jogo» panel draws them with the shared
   * `.ctrl-row` vocabulary (ADR-0129). The two cards coexisted for a tick; the duplicate is now
   * nothing more than a line in `git log`.
   */

  /**
   * ⚠️ NAMED SO IT CAN BE TAKEN OFF AGAIN. It was an inline arrow, which is fine for a page that
   * ends when the document does and wrong for a cartridge: the host keeps the region and empties its
   * children, so a listener on the region ITSELF survives a teardown and the next game inherits it.
   * See `teardown` at the foot of this file.
   */
  const onRegionKey = (event: KeyboardEvent): void => {
    /*
     * ⚠️ START FIRST, BEFORE ANYTHING ELSE LOOKS AT THE KEY. It has to work while a lesson is
     * refusing input, while a piece is in flight, and while the menu itself is open — a pause that
     * only works when the game is idle is a pause you cannot reach when you need it.
     */
    /*
     * ⚠️ NOTHING ACTS ON A KEY SOMETHING ELSE ALREADY TOOK. The pause menu's own focus trap runs
     * on the document in the CAPTURE phase, so on Escape it closes the menu — and then this
     * listener, bubbling afterwards, saw the same Escape and TOGGLED IT BACK OPEN. Escape opened
     * the pause perfectly and could not close it.
     *
     * The same guard covers the board: its grid handles a key first when focus is inside it, and
     * without this every press would be acted on twice.
     */
    if (event.defaultPrevented) return;

    const action = engine.keyboard.actionOf(event.code, 0);
    /*
     * ⚠️ THE MEASUREMENT THAT USED TO BE HERE WAS TRUE AND IS NOT ANY MORE, which is the whole
     * argument for writing measurements down. It read: "`start` IS NOT IN THE ENGINE'S SOLO
     * KEYBOARD SCHEME. Asked of the running page: `KeyU`, `KeyJ`, `KeyK` and `KeyI` all resolve,
     * and `KeyH` and `Enter` both come back NULL" — so the pause key was NAMED here, by hand.
     *
     * Asked again of the running page on engine 8.0.0, at `?debug=true`: `KeyH` resolves to
     * `start`, `Enter` resolves to `start`. The engine's own default bindings carry
     * `start: ['KeyH', 'Enter']` — the same two keys this file had been spelling out, which means
     * the hand-named half had quietly become a SECOND source of truth for one answer.
     *
     * ⚠️ AND THE TWO DISAGREE THE MOMENT A CHILD REMAPS. `start` moved to another key would open
     * the pause AND `KeyH` would go on opening it too, because this line said so — a key that
     * cannot be unbound is exactly what a remapping screen exists to prevent.
     *
     * Escape stays named, and stays for its own reason: it resolves to nothing (measured: `null`),
     * because it is not a game action. Every dialog on every platform answers to it anyway.
     */
    /*
     * ⚠️ NO BRANCH HERE FOR `start` OR Escape. The engine's own window listener for `start` opens
     * ITS pause (`toggleQuickPauseByStart` in `boot/create-game.js`), and its menu-nav listens on
     * the window in CAPTURE for Escape — both fire BEFORE this bubbling listener and consume the
     * key (`event.defaultPrevented` catches them, line above). This file used to open its own
     * `.chess-pause` here; Onda 2b retired it.
     */
    /*
     * ========================= THE FOUR ACTIONS =========================
     * `action2` (confirm) is the board's and lives in `ui/grid-mirror.ts`, because that is what
     * knows where the cursor is. The other three are the shell's, because each of them is about
     * the game rather than about a square.
     */
    if (action === 'action3') {
      // CANCEL puts the held piece down — activating the selected square again is how
      // `chess/state.ts` already spells "deselect", so there is nothing new to teach it. The
      // engine's own menu-nav intercepts Escape on an open overlay BEFORE this listener runs, so
      // the chess-pause's old «close on cancel» has no job here any more.
      const held = game.selection();
      if (held) { onActivate(held); event.preventDefault(); }
      return;
    }

    if (action === 'action1') {
      /*
       * The teacher, in both modes. In a lesson it shows the step's own answer, and refuses until
       * three tries have been spent — `setTeacher` enforces that itself, which is why this can ask
       * plainly rather than checking first. In a game it is the engine's suggestion.
       */
      if (lessonMode) {
        lessonMode.setTeacher(!lessonMode.teacher());
        refreshLessonMenu();
      } else {
        /*
         * ⚠️ THE KEY TOGGLES THE ARROWS AND LEAVES THE GUARD ALONE. It did cycle three states while
         * there was one setting; with two independent switches a cycle would have to walk four
         * combinations, and a key that takes four presses to get back where it started is not a
         * shortcut. The guard is a panel control like every other, reachable by the arrows that
         * walk `#side-column`.
         */
        chooseTeacher({ arrows: !arrows });
      }
      event.preventDefault();
      return;
    }

    if (action === 'action4') {
      /*
       * ⚠️ THE ONE KEY THAT MAKES THE SIDE PANEL REACHABLE WITHOUT TABBING PAST SIXTY-FOUR CELLS.
       * The board is a roving-tabindex grid, so Tab leaves it in one press — but coming BACK lands
       * on whichever cell holds the tab stop, and getting from a lesson's list to the board and
       * back is otherwise a trip through everything between them.
       */
      /*
       * ⚠️ `column`, THE SAME CONTAINER `walkPanel` USES, and they disagreed until 2026-10-04.
       * This asked `hud.root`; the arrow dispatch below asks `column`. With focus on a view key —
       * in the column but not in the HUD — this key concluded "not in the panel" and pushed focus
       * INTO the panel instead of handing it back to the board, so the one key for getting out did
       * the opposite. Two questions that have to agree were written in two places.
       */
      const inPanel = column.contains(host.activeElement);
      if (inPanel) mirror.focusSquare(cursor);
      /*
       * ⚠️ THE FIRST ENABLED ONE, and the first version left off `:not([disabled])`. The lesson
       * menu's first control is "previous", which is disabled at the very first step of the very
       * first lesson — so pressing this at the one moment a reader is most likely to press it did
       * NOTHING, silently, and left them on the board wondering whether the key existed.
       */
      /*
       * ⚠️ THE WALK IS THE WHOLE COLUMN; THE ENTRY IS NOT. Widening `walkPanel` to the column
       * (the Dev's option A, 2026-10-04) made the arrows reach the view keys, and it also moved
       * this key's landing spot to the TOP of the column — which is the view nav. A reader in a
       * lesson pressed the one key that reaches the panel and arrived at "2D".
       *
       * So the entry aims at the panel that is actually showing, and only falls back to the
       * column when that panel offers nothing to land on. Getting IN should put you where you
       * were going; the arrows are what take you everywhere else.
       */
      else {
        const active = lessonMenu && !lessonMenu.root.hidden ? lessonMenu.root : hud.root;
        (panelStops(active)[0] ?? panelStops(column)[0])?.focus();
      }
      event.preventDefault();
      return;
    }

    /*
     * ⚠️ THE BOARD IS OFFERED THE KEY LAST, AND THAT IS THE BUG THIS FIXES. `ui/grid-mirror.ts`
     * listens on its own root, so it only ever heard keys pressed while focus was already INSIDE
     * the grid — and the splash leaves focus on `#chess-board`, its parent. Press START, then a
     * direction: nothing happened, every time, until a square happened to be clicked first.
     *
     * Offered here it is heard from anywhere in the stage. `defaultPrevented` is what keeps a key
     * the grid's own listener already took from being taken twice.
     */
    /*
     * ⚠️ ONLY WHEN FOCUS IS ON THE BOARD'S SIDE OF THE STAGE. The first version asked "is focus
     * outside the grid?", which is TRUE when focus is in the side panel — so `action4` moved the
     * reader into the lesson list and the very next arrow key moved the board's cursor and left
     * them there. Getting into the panel worked and being in it did not.
     */
    const inPanel = column.contains(host.activeElement);
    if (!inPanel) {
      if (!mirror.root.contains(host.activeElement) && mirror.handleKey(event)) return;
    } else if (walkPanel(action)) {
      event.preventDefault();
      return;
    }

    /*
     * ⚠️ `especial` IS NOT BOUND TO ANY KEY, and the sonar was therefore unreachable. The engine's
     * solo scheme carries up/down/left/right, action1-4, the shoulders, start and select — and
     * nothing else. The sonar moved to `especial` when a bare `s` was found colliding with `down`,
     * and moving it there is what silently switched it off.
     *
     * ⚠️ AND THE OLD HOPE HERE — "`especial` is still honoured for the day the engine binds it" —
     * WAS A DAY THAT WAS NEVER COMING. Measured on 8.0.0: `especial` appears in the engine's whole
     * shipped `core/actions` exactly once, in a comment listing the names that were REPLACED
     * (`jump`, `run`, `swap`, `especial`). It is not a slot a game may define; it is vocabulary
     * from before the canonical list existed.
     *
     * ✅ SO THE GAME GAVE THE SONAR A SLOT OF ITS OWN. `declaration.mapeamentoDoTeclado` binds
     * `SONAR_ACTION` to `KeyL` for seat 0, which leaves the key exactly where every player already
     * expects it and makes it REMAPPABLE — the one control here that was not, and the wrong one to
     * leave out, since it is the key a player who cannot see the board depends on.
     *
     * 📌 The physical code is gone from this branch on purpose. It was the last place in the game
     * that answered a key rather than an intent, and the pair "handler tests a code / hint line
     * prints a letter" is exactly what produced a line advertising keys nothing listened to.
     */
    if (action === SONAR_ACTION) {
      engine.sonar.sonar({ i: 0, x: cursor.x, y: cursor.y });
      event.preventDefault();
      return;
    }
    if (view.onKey?.(event)) event.preventDefault();
  };
  region.addEventListener('keydown', onRegionKey);

  const relayout = (): void => { applyLayout({ doc: host, win: window }); view.relayout(); };
  relayout();
  window.addEventListener('resize', relayout);

  /* ---------- the loops everything else hangs off ---------- */

  /**
   * A move has been judged. Almost always this does nothing visible — most moves are ordinary —
   * and the whole of protected mode is the exception.
   */
  function onVerdict(entry: ReviewedMove): void {
    if (!protectedOn || !isBlunder(entry.mark) || twoPlayers) return;
    if (entry.side !== playerSide) return;
    if (entry.ply !== rules.history().length - 1) return;   // already answered for, or replayed

    blunderHeld = entry;
    // ⚠️ Counted per POSITION, not per game. Three blunders spread over forty moves is somebody
    // learning; three in a row from the same position is somebody stuck.
    if (stumbleAt !== entry.ply) { stumbleAt = entry.ply; stumbles = 0; }
    stumbles++;

    blunderBar.show({ mark: entry.mark ?? '', lost: entry.lost });
    // ⚠️ `arrows`, NOT `silent`. This exists because a child is struggling, and the teacher that
    // SHOWS is the one that helps; arriving unasked at the one that only says no would be cruel.
    if (stumbles >= STUMBLES_BEFORE_HELP && !arrows) {
      arrows = true;
      prefs.save({ arrows, guard });
      announcer.say(i18n.t('protected.teaching'));
      // Turning the switch on is not enough: the arrows are drawn when a suggestion arrives, and
      // nothing else is going to ask for one — the position has not changed and will not until
      // the player answers the warning that is on screen because of it.
      refreshHints();
    }
    hud.refresh();
  }

  /** The player chose. Either way the game moves on — this mode never leaves anybody stuck. */
  function answerBlunder(takeBack: boolean): void {
    if (!blunderHeld) return;
    blunderHeld = null;
    blunderBar.show(null);
    if (takeBack) {
      announcer.say(i18n.t('protected.tookBack'));
      void walkHistory('back');
    } else {
      announcer.say(i18n.t('protected.kept'));
      hud.refresh();
      handOver();
    }
  }

  /**
   * Turns a teacher on or off. The one place the setting changes, so the three things that have to
   * happen together cannot drift apart: the panel, the board, and what is stored.
   */
  function chooseTeacher(next: { arrows?: boolean; guard?: boolean }): void {
    if (next.arrows !== undefined) arrows = next.arrows;
    if (next.guard !== undefined) guard = next.guard;
    prefs.save({ arrows, guard });
    /*
     * ========================= ⚠️ NOTHING IS THROWN AWAY HERE ANY MORE =========================
     * The Dev, 2026-10-04: "o botão «só permitido jogar os melhores lances» não deve sumir com as
     * setas! Ele só deve ligar o bloqueio, ao passo que o botão setas deve ligar as setas, um
     * independente do outro."
     *
     * What stood here was `clearHints()` with this reasoning: "the arrows go when EITHER button
     * changes… pressing II while I is lit must take the arrows off the board immediately, and a
     * child would see the answer to the move they are about to be refused for." That was true
     * while the two were ONE setting with three values and II meant «withhold what I shows». They
     * became independent switches this morning and the clear was left behind.
     *
     * ⚠️ AND IT WAS NOT EVEN DOING WHAT IT CLAIMED. `syncMarks` already draws `arrows ? hinted :
     * []` — the set is kept either way and the arrows are withheld AT THE DRAW, which is the line
     * that actually implements the old rule. All this did was throw away a set that was still
     * right for the position, so pressing 🏆 blanked the board and the arrows came back when the
     * engine had searched again. Measured on the running build: 14 arrows → 0 → 14, four seconds
     * apart. A blink, and the Dev saw it.
     *
     * A stale set is still cleared, by the one caller that can tell: `refreshHints` compares
     * `hintFen` with the position and clears when they differ.
     */
    hud.refresh();
    refreshHints();
  }

  function clearHints(): void {
    hintFen = null;
    hinted = [];
    syncMarks();
  }

  /** Draws the suggested moves as arrows and says them. Retired when the position moves on. */
  function showHint(moves: readonly Suggestion[]): void {
    hinted = moves.map((m) => ({ from: m.move.from, to: m.move.to, behind: m.behind }));
    syncMarks();
    /*
     * ⚠️ PROFESSOR II SAYS NOTHING, and this is the half that would have leaked. "A engine jogaria
     * e2 e4" hands the answer to anyone listening, which is exactly what the mode withholds from
     * anyone looking. The whistle and its caption are the channel instead, and the move being sent
     * back IS the information — for a listener as much as for a watcher.
     */
    if (!arrows) return;
    const say = (m: Suggestion): string => `${toAlgebraic(m.move.from)} ${toAlgebraic(m.move.to)}`;
    announcer.say(moves.length > 1
      ? i18n.t('a11y.hintMany', { move: say(moves[0]), others: moves.slice(1).map(say).join(', ') })
      : i18n.t('a11y.hintOne', { move: say(moves[0]) }));
  }

  /**
   * Retires advice that no longer describes the position, and asks for more when the switch is on.
   * Called from every path that redraws, which is cheap: the `hintFen` guard means a selection, a
   * theme change or a window resize all fall straight through.
   */
  function refreshHints(): void {
    const fen = rules.fen();
    if (hintFen !== null && hintFen !== fen) clearHints();
    if (!teaches() || hinting || game.phase() !== 'idle' || hintFen === fen) return;
    void askHint();
  }

  /**
   * Asks for the set, or JOINS the request already in the air.
   *
   * ========================= ⚠️ `if (hinting) return` WAS A HOLE, AND I FELL IN IT =========================
   * Returning early while a request is in flight is right for the caller that only wants the
   * arrows eventually — it is `refreshHints`, and a second search would be waste. It is wrong for
   * the caller that has to WAIT for the answer: Professor II resolved instantly, found no set for
   * the current position, and let the move through. Measured on the running build on 2026-10-04,
   * with `a2–a3` sailing past a teacher that had just refused `h2–h4`.
   *
   * So the flight is shared. One request at a time as before, and everybody who asks gets the same
   * promise to wait on — which is what makes the Dev's "segura o lance até chegar" true rather
   * than true-when-the-timing-happens-to-suit.
   */
  function askHint(): Promise<void> {
    if (game.phase() !== 'idle') return Promise.resolve();
    if (pendingHint) return pendingHint;
    hinting = true;
    thinking.setBusy(true);
    hud.refresh();
    announcer.say(i18n.t('a11y.hintAsked'));
    pendingHint = (async () => {
      try {
        const hint = await opponent.requestHint(rules.fen());
        if (!hint) { announcer.say(i18n.t('a11y.hintNone')); return; }
        hintFen = rules.fen();
        showHint(hint.ties.length ? hint.ties : [{ move: hint.move, behind: 0 }]);
      } catch {
        announcer.say(i18n.t('status.engineFailed'));
      } finally {
        pendingHint = null;
        hinting = false;
        thinking.setBusy(false);
        hud.refresh();
      }
    })();
    return pendingHint;
  }

  /**
   * ========================= CHANGING SIDES KEEPS THE GAME =========================
   * ⚠️ IT USED TO THROW THE GAME AWAY, on the argument that the position and the score sheet
   * belong to whoever played them. That argument is about who gets CREDIT for a game, and nobody
   * pressing this button is asking about credit — they are asking to swap seats.
   *
   * The reload remains, because the composition root wires one game into a dozen closures and
   * rebuilding those by hand would be a second, quieter way of getting it wrong. And it flags
   * itself as an in-app move, so the title screen — which exists to cover the engine's download
   * and nothing else — stays out of the way.
   */
  function chooseMode(next: GameMode): void {
    if (next === mode) return;
    prefs.save({ mode: next });
    try { sessionStorage.setItem('incl_chess_switching', '1'); } catch { /* private mode */ }
    window.location.reload();
  }

  /** The markers the game itself asks for, rebuilt from the position every time. */
  function syncMarks(): void {
    const markers = new Map<number, Marker>();
    /*
     * ⚠️ THE LESSON SPEAKS FIRST SO THE GAME CAN SPEAK OVER IT. The map holds one kind per square
     * and later writes win, so putting this loop first is what lets a square that is both "look
     * here" and "you can capture here" end up saying the second — which is the more useful of the
     * two, because the child is holding a piece. The cursor keeps the last word under the rule it
     * already had.
     *
     * The flat board does not need this ordering: it carries the lesson on its own attribute and
     * says BOTH. This is the projected board's compromise, and it is a compromise.
     */
    for (const { square, mark } of taught) markers.set(squareIndex(square), LESSON_MARKER[mark]);
    const selected = game.selection();
    if (selected) {
      markers.set(squareIndex(selected), 'selected');
      for (const target of game.legalTargets()) {
        // Shape carries the meaning, not colour: a dot on an empty square, a ring on a capture.
        markers.set(squareIndex(target), rules.pieceAt(target) ? 'capture' : 'move');
      }
    }

    /*
     * ========================= THE OTHER ORDER, DRAWN =========================
     * A destination chosen before a piece (the Dev, 2026-10-04). The square itself takes
     * `selected` — ring and dot together — because that is literally what it is: the thing
     * currently in hand. The pieces that can reach it take the move dot, which is the same mark
     * their destinations would carry in the usual order, read backwards.
     *
     * ⚠️ NO NEW MARK WAS INVENTED FOR THIS, deliberately. The vocabulary is shape-coded and
     * already has four shapes carrying meaning in one turn; a fifth is a design decision about
     * what a child sees, and that is the Dev's to make rather than something to slip in with a
     * feature. If the two orders need telling apart on sight, that is the next conversation.
     */
    const aimed = game.destination();
    if (aimed) {
      // The Dev's form, 2026-10-04: a CROSS on the square chosen before the piece, so the two
      // orders of operations are told apart by shape and not by position alone.
      markers.set(squareIndex(aimed), 'aim');
      for (const from of game.legalTargets()) markers.set(squareIndex(from), 'move');
    }
    const check = game.kingInCheck();
    if (check) markers.set(squareIndex(check), 'check');
    /*
     * ⚠️ THE CURSOR GOES BESIDE THE MAP, NOT IN IT, and this line used to read
     * `if (!markers.has(at)) markers.set(at, 'cursor')` — the cursor drawn "only where nothing
     * else already speaks for the square".
     *
     * Which meant it was silenced on precisely the squares a player is heading for: select a
     * piece, and every square you could move to stops showing where you are. The Dev, 2026-10-04:
     * "quando o cursor esta sob uma casa marcada como casa possivel de andar, o cursor some" — and
     * it is why walking the projected and solid boards was so hard, while the flat board, which
     * never used this map, was fine.
     *
     * The views draw it last and unconditionally now, each with a ring wider than the square's own
     * marks, so the two coexist instead of competing.
     */
    /*
     * ⚠️ `hinted` IS THE JUDGE'S SET AS WELL AS THE DRAWING, and Professor II needs it WITHOUT the
     * drawing. So the set is kept either way and the arrows are withheld here — the one line that
     * separates the two teachers on the board.
     */
    view.drawMarks(markers, arrows ? hinted : [], cursor);
  }

  /**
   * Everything that has to happen when the position has changed.
   *
   * ⚠️ THE MIRROR IS REFRESHED FIRST, and even mid-flight. A screen reader wants the landed
   * position NOW, not a third of a second after everyone else got it. The picture is what lags.
   */
  function syncPosition(hidden: readonly Square[] = [], travelling: MoveResult['piece'] | null = null): void {
    mirror.refresh();
    view.drawPosition(hidden, travelling);
    syncMarks();
    hud.refresh();
    /*
     * The one place the score sheet is written down, and the one place the engine is told the
     * game has moved: one search per ply feeds the readout, the marks and protected mode.
     *
     * ⚠️ AND NOT WHILE A LESSON IS RUNNING. Without this guard, opening a lesson OVERWRITES THE
     * PLAYER'S REAL GAME in `sessionStorage` — with a board holding two kings and a bishop — and
     * the loss shows up only when they change view, by which time nothing on screen connects it to
     * what caused it. The comment belongs here rather than at the top of the function because
     * here the code looks unconditionally correct, and here is the last place anybody will look.
     */
    if (!teaching) saveGame(rules);
    // ⚠️ BEFORE the HUD is asked for it. `refreshOpening` recomputes only when the ply count has
    // changed, so this is a comparison rather than a lookup on most calls.
    refreshOpening();
    players.refresh();
    reviewer.observe();
    refreshHints();
  }

  /**
   * Flies a piece and makes sure the board is whole again afterwards, whatever happened.
   *
   * ⚠️ A FLIGHT THAT FAILS MUST STILL LAND. `travel` is the VIEW's promise, and a view can be
   * torn down, disposed or cancelled while a piece is in the air. `syncPosition` has already told
   * it to withhold that piece from the static drawing — so without this the piece stays withheld
   * for the rest of the game, and all anyone gets is an unhandled rejection in the console with
   * nothing on screen to connect it to the hole in the board.
   */
  function fly(from: Square, to: Square): Promise<void> {
    return view.travel(from, to)
      .catch((error: unknown) => { console.error('[chess] a move could not be animated', error); })
      .then(() => { syncPosition(); });
  }

  /**
   * ========================= THE HUMAN HAS FINISHED A MOVE =========================
   * The Dev, 2026-10-04: "se 2 Jogadores estiver desligado, após o humano jogar será sempre a vez
   * da engine, seja o lance feito pelas brancas ou pelas pretas."
   *
   * ⚠️ THE ENGINE MOVES BECAUSE IT IS HANDED THE BOARD, not because of whose turn it is. That used
   * to live in `chess/state.ts`, where `settle()` declared `thinking` whenever the colour on move
   * was not the player's — which is why the human could only ever play one colour and why a walk
   * through the score sheet was answered the instant it stopped. See the note there.
   */
  function handOver(): void {
    if (twoPlayers) return;
    game.think();
    askOpponent();
  }

  /**
   * The «CPU joga!» button: one move from the engine, and then the board is the human's again.
   *
   * The Dev: "se o jogador clicar em «CPU joga!» o CPU joga e em seguida é a vez do humano." It
   * needs no special case to end there — the reply settles the phase to `idle`, and nothing hands
   * the board over again until a human move does.
   */
  function cpuMove(): void {
    if (game.phase() !== 'idle') return;
    game.think();
    askOpponent();
  }

  function askOpponent(): void {
    if (game.phase() !== 'thinking' || searching) return;
    // ⚠️ HELD. Protected mode's whole value is that the warning arrives while the position it
    // ruined is still on the board. So the opponent waits for TWO things: an unanswered warning,
    // and a verdict that has not landed yet. `reviewer.onChange` is what tries again.
    if (blunderHeld) return;
    if (protectedOn && !twoPlayers && !reviewer.judged(rules.history().length - 1)) return;

    searching = true;
    thinking.setBusy(true);
    announcer.say(i18n.t('status.thinking'));

    opponent.requestMove(rules.fen())
      .then((reply) => {
        searching = false;
        thinking.setBusy(false);
        // The position may have moved on while the worker was busy — a restart, a difficulty
        // change. The state machine refuses the move in that case, and so does this guard.
        if (!reply || game.phase() !== 'thinking') return;
        // ⚠️ `applyOpponentMove`, NOT two `activate` calls. `activate` answers every call in the
        // `thinking` phase with `ignored/busy`, which is the whole point of the phase — the solid
        // board used to pick the piece up and put it down like a player, and dropped every reply.
        const move = game.applyOpponentMove(reply.move.from, reply.move.to, reply.move.promotion);
        if (!move) return;
        game.animationDone();
        movePlayed();
        syncPosition([move.to], move.piece);
        announceMove(announcer, i18n, move);
        announceOutcome(announcer, i18n, game.outcome());
        // The reply is the move nobody was watching for, so it is the one that most needs to be
        // seen travelling rather than to have simply appeared somewhere else.
        void fly(move.from, move.to);
      })
      .catch((error: unknown) => {
        searching = false;
        thinking.setBusy(false);
        // Saying nothing would leave the game on "thinking" for good, and a child waiting for a
        // reply cannot tell that apart from a game that is broken.
        announcer.alert(i18n.t('status.engineFailed'));
        console.error('[chess] engine failed', error);
      });
  }

  /**
   * Professor II's verdict on a move, and the ONE place that waits for it.
   *
   * ========================= ⚠️ WHY THE WAIT IS HERE AND NOT IN THE STATE =========================
   * The Dev chose this on 2026-10-04 (option B) over letting a fast move through: a mode that
   * lapses when the engine is slow lapses exactly in the positions that are hard, which are the
   * ones it exists for.
   *
   * `game.activate` is synchronous and every view drives it from a pointer or a key; making it a
   * promise would mean teaching all of them to wait. So the question is ASKED EARLY instead — the
   * set for this position is fetched before the activation is handed on, and by the time the state
   * machine consults its filter the answer is already in hand.
   *
   * ⚠️ AND IT COSTS NOTHING AFTER THE FIRST TIME. `hintFen` matches until the position changes,
   * and the position only changes on a move, so at most one activation per move ever waits — and
   * usually not even that, because `refreshHints` set the engine going the moment the board moved.
   */
  async function readyToJudge(): Promise<void> {
    if (!guard) return;
    if (hintFen === rules.fen()) return;
    await askHint();
  }

  /** Whether Professor II would let this move happen. Synchronous: see `readyToJudge`. */
  function approved(from: Square, to: Square): boolean {
    if (!guard) return true;
    /*
     * ⚠️ NO SET MEANS YES. The engine failed, or the position has none to give — and a teacher
     * that cannot name a better move has no standing to refuse this one. Refusing on an empty set
     * would make a broken engine look like a board that rejects everything.
     */
    if (hintFen !== rules.fen() || hinted.length === 0) return true;
    return hinted.some((h) => h.from.x === from.x && h.from.y === from.y
      && h.to.x === to.x && h.to.y === to.y);
  }

  function onActivate(square: Square): void {
    if (walking) return;
    /*
     * ⚠️ THE WAIT IS ONLY EVER ENTERED BY PROFESSOR II (`readyToJudge` returns at once otherwise),
     * so every other board keeps the straight synchronous path it always had.
     */
    if (guard && hintFen !== rules.fen()) {
      void readyToJudge().then(() => { activateNow(square); });
      return;
    }
    activateNow(square);
  }

  function activateNow(square: Square): void {
    if (walking) return;
    cursor = square;
    const result = game.activate(square);
    if (result.kind === 'refused') {
      /*
       * ⚠️ A WHISTLE AND NOTHING ELSE. The move was legal; what it was not is one of the moves the
       * teacher would have drawn. Explaining that would be handing over the answer, which is the
       * one thing this mode is for — so the child gets "not that one, go again" and the board is
       * exactly as they left it, piece still in hand and its squares still lit.
       */
      earcons.play(WHISTLE, i18n.t('sfx.whistle'));
      syncPosition();
      observer?.(square, result);
      return;
    }
    if (result.kind !== 'moved') {
      syncPosition();
      announceActivation(announcer, i18n, rules, result);
      observer?.(square, result);
      return;
    }

    const move = result.move;
    // The rules have already applied it, so the phase settles now and the travel is only the
    // picture catching up. Said before the flight, not after: a player who cannot see it should
    // not wait a third of a second to be told what happened.
    game.animationDone();
    movePlayed();
    syncPosition([move.to], move.piece);
    announceActivation(announcer, i18n, rules, result);
    announceOutcome(announcer, i18n, game.outcome());
    // ⚠️ THE OBSERVER WAITS FOR THE PIECE TO LAND. See `ActivationObserver`: a lesson undoes a
    // wrong move, and undoing one the child never saw teaches nothing.
    void fly(move.from, move.to).then(() => { handOver(); observer?.(square, result); });
  }

  /**
   * ========================= ONE PLY PER LEG =========================
   * Applying both plies before drawing either puts the second piece on its destination from the
   * moment the button is pressed, so it teleports and then travels. `takeBackStep` and
   * `replayStep` exist precisely so a caller can hold the clock.
   *
   * Travelling BACKWARDS is the move run in reverse — from where it landed to where it began —
   * which is the only difference between the two directions.
   */
  async function walkHistory(direction: 'back' | 'forward'): Promise<void> {
    if (walking) return;
    // ⚠️ BEFORE THE EARLY RETURN BELOW, deliberately: a player who presses «Voltar» at the start of
    // the game has asked for the clock to stop as plainly as one who presses it on move forty.
    clock.pause();
    opponent.cancel();
    searching = false;
    thinking.setBusy(false);

    let step = direction === 'back' ? game.takeBackStep() : game.replayStep();
    if (!step) {
      announcer.say(i18n.t(direction === 'back' ? 'a11y.nothingToTakeBack' : 'a11y.nothingToReplay'));
      hud.refresh();
      return;
    }

    walking = true;
    try {
      while (step) {
        const move = step.move;
        /*
         * ⚠️ `hidden` IS A LIST, NOT A SQUARE. Taking a capture back restores TWO pieces at once —
         * the mover coming home and the piece it took — and both are already on the board as far
         * as the rules are concerned. Withholding only one draws the captured piece underneath a
         * piece that is still flying away from it.
         */
        const leg = direction === 'back'
          ? {
            from: move.to,
            to: move.from,
            hidden: move.captured ? [move.from, capturedSquare(move)] : [move.from],
          }
          : { from: move.from, to: move.to, hidden: [move.to] };

        syncPosition(leg.hidden, move.piece);
        /*
         * MARK CAUGHT, NOT PROPAGATED. A rejected leg ends the walk — there is no sense flying the
         * next ply through a view that has just said it cannot draw — but it must not escape this
         * function: the caller is a button handler that discards the promise, so a throw here
         * would be an unhandled rejection AND would skip the announcement below.
         */
        let flew = true;
        await view.travel(leg.from, leg.to)
          .catch((error: unknown) => {
            flew = false;
            console.error('[chess] the walk could not be animated', error);
          });
        if (!flew || !step.more) break;
        step = direction === 'back' ? game.takeBackStep() : game.replayStep();
      }
    } finally {
      // ⚠️ IN A `finally`. A `travel` that rejects — a disposed scene, a cancelled animation —
      // would otherwise leave this true for the rest of the game, and take-back and replay would
      // stay dead with nothing on screen or in the console to say why.
      walking = false;
    }

    syncPosition();
    // Said at the end, because mid-walk the board belongs to whoever has just been rewound past.
    announcer.say(i18n.t(direction === 'back' ? 'a11y.tookBack' : 'a11y.replayed', {
      side: i18n.t(`turn.${rules.turn()}`),
    }));
    /*
     * ⚠️ AND IT DOES NOT HAND THE BOARD OVER. `askOpponent()` stood here, which is why a take-back
     * that landed on the engine's turn was answered at once and undone in front of the player.
     * The Dev, 2026-10-04: "seja onde parar, o relógio fica pausado aguardando o jogador humano
     * jogar." Wherever the walk stops, the next move is a person's — «CPU joga!» is there for
     * anyone who wants the engine to take that one.
     */
  }

  /** Where the piece a move captured was standing. Not `move.to` when it was taken en passant. */
  function capturedSquare(move: MoveResult): Square {
    if (!move.enPassant) return move.to;
    return { x: move.to.x, y: move.from.y };
  }


  /**
   * ⚠️ THE ORDER HERE IS LOAD-BEARING, and every line of it was a bug waiting.
   *
   *  1. `teaching` FIRST, before anything can call `syncPosition` — otherwise the very first sync
   *     of a lesson writes its two-kings board over the player's real game.
   *  2. The new `Rules`, then the new `GameState` built ON it. A lesson is a HOT SEAT
   *     (`opponent: false`), so `settle()` never enters `thinking` and no engine is ever asked to
   *     reply — which is also why none of this needs the 6.98 MB of Stockfish.
   *  3. The marks are dropped, because they named squares in a position that no longer exists.
   *  4. The selection is gone with the old state, so the cursor is left where the reader put it:
   *     it is a property of the PERSON, not of the position.
   */
  function newGame(fen?: string, options: { readonly teaching?: boolean } = {}): void {
    teaching = options.teaching ?? false;
    /*
     * ⚠️ NO FEN MEANS "THE PLAYER'S OWN GAME", NOT "A FRESH BOARD", and the difference is a game
     * thrown away. The only caller that omits it is a lesson handing the board back, and what it
     * wants back is the position the player was in — which lives in the tab's storage and is what
     * `resume()` reads. A standard opening would silently discard a game in progress.
     */
    rules = fen === undefined ? resume() : createRules(fen);
    // ⚠️ `aiming: !teaching` — a lesson's `mark` steps answer BY touching empty squares, so a board
    // that remembered each touch as a destination would turn the lesson's own answer into a move.
    game = createGameState({
      rules, playerSide, opponent: !teaching && !twoPlayers, aiming: !teaching,
      // ⚠️ A lesson has its own teacher; Professor II must not also be marking it. `approved`
      // answers true for every teacher but `silent`, and a lesson board never sets that.
      allowMove: approved,
    });
    setTaught([]);
    /*
     * ⚠️ RESET RATHER THAN LEFT RUNNING, including when a lesson hands the board back. A clock that
     * kept draining through a lesson would hand the player their own game back with four minutes
     * gone to something that was not their game.
     */
    clock.reset();
    syncPosition();
  }

  /**
   * ⚠️ THE ONE WRITER, and the first version was not.
   *
   * The lesson marks live in two places — here, for the projected board's marker map, and inside
   * `grid-mirror`, which owns the flat board's attribute and the cell labels. `newGame` cleared
   * only this one, so a step that changed the position left the PREVIOUS step's amber square
   * sitting on the flat board, pointing at a lesson that had moved on. Everything that changes the
   * set goes through here.
   */
  function setTaught(marks: readonly LessonSquare[]): void {
    taught = [...marks];
    mirror.setTaught(taught);
    syncMarks();
  }

  self = {
    region, i18n, mirror, hud, opponent,
    view: () => view,
    update: (dt: number) => { if (mounted) view.frame?.(dt); },

    teardown: () => {
      /*
       * ⚠️ THE SAME FLAG THE VIEW SWAP USES, and reusing it is the point rather than a shortcut:
       * both states are «there is no renderer to draw into right now», and a frame that arrived
       * after a teardown would throw inside `startLoop`, which answers a throw by removing its
       * callback for good. One flag, one question, no second place to forget.
       */
      if (!mounted) return;
      mounted = false;
      // Outside the region, so emptying the region does not reach them.
      window.removeEventListener('resize', relayout);
      region.removeEventListener('keydown', onRegionKey);
      // In CAPTURE on the document: this one would take keys from whatever ran next, and first.
      // A Web Worker with 6.98 MB of WebAssembly in it. No DOM operation frees this.
      opponent.destroy();
      // GPU buffers: Three does not free a geometry when its mesh leaves the scene.
      view.destroy();
      /*
       * ⚠️ `engine.dispose()` ENDS THE ROOT (Wave 4, 2026-10-02). Until engine 11 the root kept
       * its ~30 window listeners for the lifetime of the document, and since every query it
       * makes is document-wide, it went on driving the pause card of whatever root came after it
       * — measured: one ArrowDown moved the cursor two items with a second root alive. The hook
       * is open now because `teardown()` is only called from `standalone.ts` on page unload
       * today, so the cost of calling `dispose` is zero and the benefit is forward-compatibility
       * with any future host (platform page, cartridge swap) that keeps the document alive after
       * dropping this root. Idempotent in practice: `mounted` guards against repeats.
       */
      clock.dispose();
      earcons.destroy();
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    async switchView(kind: ViewKind): Promise<void> {
      if (kind === viewKind) return;
      /*
       * ⚠️ THE OLD ONE IS TORN DOWN BEFORE THE NEW ONE IS ASKED FOR, not after it arrives. The
       * import may take a moment on a school link, and two renderers drawing the same board into
       * the same region is a worse thing to look at than an empty board for that moment.
       */
      mounted = false;
      view.destroy();
      view = mountView(await VIEWS[kind]());
      mounted = true;
      viewKind = kind;
      /*
       * ⚠️ MIRROR VISIBILITY FOLLOWS THE VIEW (2026-10-03). The grid mirror is always built with
       * `visible: true` so its glyphs exist no matter which view is up (otherwise a swap into
       * 2D after booting on 2.5D would find an empty grid, which the user reported). But those
       * glyphs would show BESIDE the 2.5D or 3D canvas — the canvas is smaller than the board
       * area to leave room for file/rank labels — and that was exactly the "mirror showing
       * underneath" the Dev saw on 2026-10-03. The className toggle hides the mirror visually
       * while leaving it (and its screen-reader duty) alive.
       */
      mirror.root.className = kind === '2d' ? 'board-2d' : 'sr-only';
      /*
       * A fresh renderer starts at its own defaults, so everything the player had chosen has to be
       * said again: the palette, and then the position it is meant to be drawing.
       */
      view.applyTheme(themeKey);
      syncPosition();
      relayout();
      hud.refresh();
      /*
       * ⚠️ REMEMBERED, BECAUSE THE ADDRESS NO LONGER REMEMBERS IT. Each view used to be its own
       * page, so reloading gave the board back for free. One document showing all three means a
       * reload would drop the player on whichever view the game opens with — which is the same
       * defect the remembered `mode` was written to prevent, arriving by a different door.
       */
      patchSettings({ view: kind });
    },
    rules: () => rules,
    game: () => game,
    activate: onActivate, walkHistory, askOpponent, newGame, setTaught,

    teach() {
      if (!deps.teaches) return false;
      const { at, done } = loadProgress();
      const order = syllabus();
      /*
       * ================= ⚠️ HALF THIS FEATURE WAS IMPLANTED =================
       * `rememberPlace` is called for whatever lesson is open — a course lesson, a tactic, a book
       * — because the driver does not know the difference and should not. The resume did know:
       * `order.some((l) => l.id === at.lesson)` is true only for the thirteen lessons IN the
       * syllabus, so a child who closed the tab halfway through a tactic pressed APRENDER and was
       * put back at the start of the course.
       *
       * That guard was right when it was written, because nothing else could be resolved then.
       * `find` has answered `puzzle:` ids since the tactics landed and `book:` ids since the books
       * did — so the guard is not protecting anything any more, it is only discarding the place.
       */
      const remembered = at?.lesson;
      const next = order.find((l) => !done.includes(l.id))?.id;
      const fallback = next ?? order[0]?.id;
      const id = remembered ?? fallback;
      if (!id) return false;
      /*
       * ⚠️ AND IF THE REMEMBERED ONE WILL NOT OPEN, THE COURSE STILL DOES. This is what the guard
       * was really worth, kept without throwing the place away: an id that no longer resolves
       * costs one failed open instead of the whole door.
       */
      // Raised here, past every `return false` above, so the picker appears only once a lesson is
      // genuinely being opened: a syllabus that resolves to nothing should not advertise itself.
      lessonsOffered = true;
      void startLesson(id).then((opened) => {
        if (!opened && fallback && fallback !== id) void startLesson(fallback);
      });
      return true;
    },

    watch(next) { observer = next; },
    undoLast() {
      // One ply. `takeBack()` is two against an opponent and one in a hot seat, and a lesson is
      // always a hot seat — so this is the unit a wrong answer costs.
      const moved = game.takeBack();
      if (moved) syncPosition();
      return moved;
    },
  };
  return {
    declaration,
    hooks,
    /*
     * ⚠️ THE GAME SAYS WHERE, THE HOST DECIDES. `a11yBarHost` and `pauseHost` are the host's half of
     * the options by ADR-0139 §1 — but ADR-0122 is explicit that what a game declares about the pause
     * is only WHERE it fits, and the same is true of the bar: these two elements are positions inside
     * a layout only this game knows. So the cartridge offers them and the shell passes them on.
     */
    hosts,
    create(received: Engine): GameShell {
      engine = received;
      engineRef.current = received;
      /*
       * Follow the engine's language. Since Onda 2b retired `.chess-pause` (and with it the
       * `#hud-locale` select the HUD used to carry), the ONLY language door the user sees is the
       * engine's 🌐 on `.a11y-bar`. Chess's own catalogue (pieces, phrases) is NOT in
       * `hooks.dictionaries` because its shape is richer than the engine's flat records (gender,
       * patterns) — so when the engine switches, chess has to re-translate itself. ADR-0225 names
       * this door for exactly that purpose.
       */
      engine.onLocaleChange(() => { void changeLocale(engine.locale()); });
      // ⚠️ ONCE, BEFORE ANYTHING HAPPENS. This used to be reached only from an event handler in the
      // flat root, so on a board that had not been touched yet — every restored game, and every
      // switch between views — the reviewer was never told to look. The advantage readout sat at a
      // dash and the score sheet carried no marks until the player happened to move.
      syncPosition();
      hud.refresh();  // Now that engine.t is callable, resolve the engine-owned labels (vision modes).
      askOpponent();

      refreshKeyHints();
      if (engine.problems.length) console.warn('[chess] engine problems:', engine.problems);
      announcer.say(i18n.t('a11y.boardLabel'));

      if (debugAsked) {
        (window as unknown as Record<string, unknown>)[deps.debugName] = {
          game, rules, mirror, hud, opponent, engine, declaration,
          activate: onActivate, takeBack: () => walkHistory('back'),
          replay: () => walkHistory('forward'), askOpponent,
          ...(view.debug?.() ?? {}),
        };
      }
      return self;
    },
  };
}
