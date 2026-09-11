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

import { createGame } from '@the-inclusionist/engine';
import { srAlert, srSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import { VIZ_FILTER } from '@the-inclusionist/engine/render/viz-modes.js';
import { createChessDeclaration } from '../declaration/chess-declaration.ts';
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
import { createPauseMenu } from '../ui/pause-menu.ts';
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
import { createPlayerStrips } from '../ui/player-strip.ts';
import { createScoreboard } from '../ui/scoreboard.ts';
import { createSplash } from '../ui/splash.ts';
import { createThinkingPanel } from '../ui/thinking.ts';
import { announceActivation, announceMove, announceOutcome } from './narration.ts';
import type { BoardView, ViewFactory } from './view.ts';

export interface GameShellDeps {
  readonly host: Document;
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
  readonly view: BoardView;
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

export function createGameShell(deps: GameShellDeps): GameShell {
  const host = deps.host;
  const region = host.getElementById('game-region');
  if (!region) throw new Error('#game-region is required (engine MARCACAO_EXIGIDA)');
  /*
   * ⚠️ THE STAGE IS BOARD PLUS PANEL; THE REGION IS ONLY THE BOARD. Keys are bound HERE rather
   * than on the region, because the panel is a sibling now — an event from the lesson list would
   * never bubble through the board, and `action4` exists precisely to move between the two.
   */
  const stage = host.getElementById('stage') ?? region;
  const column = host.getElementById('side-column') ?? region;

  /*
   * ========================= WHERE THE ENGINE'S OWN PAUSE CARD GOES =========================
   * ⚠️ SINCE 8.0.0 THE QUESTION IS WHERE AND NO LONGER WHETHER. ADR-0122 removed the decline, and
   * `createGame` mounts a `.screen-pause` card by itself; absent a `host.pauseHost` it falls back
   * to `#game-region` — which here is not "the game", it is the BOARD, nine of the stage's sixteen
   * units. The card would be a child of the square.
   *
   * ⚠️ AND IT IS NOT A FLEX CHILD OF THE STAGE EITHER. `#stage` lays its two columns out by width —
   * 9 units of board, 7 of panel, no gap — so a third child in flow would take a share of that and
   * the measured split would stop being the measured split. Out of flow, exactly like `.chess-pause`
   * beside it, and `pointer-events: none` while it is empty so it cannot swallow a click on the
   * board underneath.
   *
   * ⚠️ THIS GAME'S PAUSE BUTTON DOES NOT OPEN IT — the Dev's instruction, 2026-09-11: the engine
   * pauses at the moments it is itself programmed to, not at ours. `H`/`Enter`/START keep opening
   * `.chess-pause`, and `engine.pausa.mostrar` is never called from here.
   *
   * 📌 What that means TODAY, written down so the missing wiring reads as a choice: the card is
   * revealed by the engine's `ui/shell`, per phase, and `createGame` deliberately does not mount
   * `ui/shell` ("não substitui o boot do main.js, que tem catorze anos de ordem própria"). So the
   * card is mounted, stays hidden, and nothing reveals it. That is the requested behaviour.
   */
  const enginePause = host.createElement('div');
  enginePause.className = 'engine-pause-host';
  stage.appendChild(enginePause);

  /*
   * ========================= THE ACCESSIBILITY BAR, AND THE HOLE IT FILLS =========================
   * ⚠️ THE ENGINE'S MEASUREMENT NAMES THIS GAME, and it is right: of six games in the local
   * catalogue, five mount no accessibility bar at all, and `game-chess` is one of the five. Its
   * `problems` list has been saying so since 8.0.0 — *"sem barra de acessibilidade na primeira
   * tela… sem ela a criança não alcança modo cego, TTS, alto contraste nem Libras antes de começar"*.
   *
   * ⚠️ AND THE HOLE IS REAL RATHER THAN FORMAL. Searched before building: this game exposes NO
   * control for blind mode, none for TTS, and the word Libras does not appear once in `app/`. The
   * sonar is reachable only by knowing the `L` key. Every display setting it does offer — palette,
   * colour-vision correction, reduced motion, piece design — lives behind the pause menu, which is
   * behind knowing that START opens one. A child who needs the screen reader to begin with cannot
   * get to the thing that would read it.
   *
   * WHERE: the top of the side panel, by the Dev's decision of 2026-09-11, with the cost accepted
   * — that panel already holds 487 px of content in 360 and scrolls, and this adds a row. It is a
   * SIBLING of `.chess-hud` rather than a child, so it survives the teaching mode hiding the panel:
   * an accessibility control that disappears during a lesson is worse than useless, because it is
   * gone exactly when a child is being asked to concentrate.
   *
   * ⚠️ The element must exist BEFORE `createGame`, which reads the host during boot and writes the
   * buttons into it with `innerHTML`. Nothing else may put anything here.
   */
  const a11yBar = host.createElement('div');
  a11yBar.className = 'a11y-bar';
  column.appendChild(a11yBar);

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
  const playerSide: Side = mode === 'b' ? 'b' : 'w';
  let game = createGameState({ rules, playerSide, opponent: mode !== 'two' });

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
  let vision = 'normal';
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
  let hintsOn = remembered.hints ?? false;
  let hintFen: string | null = null;
  let hinted: readonly HintMove[] = [];

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
  const opponent = (deps.makeOpponent ?? createStockfishClient)({
    onThought: (thought: Thought) => thinking.update(thought),
  });
  opponent.setStrength(elo);

  const splash = createSplash({
    doc: host,
    i18n,
    region,
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
      scoreboard.refresh();
      players.refresh();
      hud.refresh();
      // The reviewer is also a clock: protected mode holds the opponent until a verdict lands,
      // and this is the tick that lets it go again.
      askOpponent();
    },
    onVerdict: (entry) => { onVerdict(entry); },
  });

  const players = createPlayerStrips({
    doc: host, i18n, rules,
    evaluation: () => reviewer.evaluation(),
    mistakes: (side) => reviewer.mistakes(side),
  });

  const scoreboard = createScoreboard({
    doc: host, i18n, rules,
    evaluation: () => reviewer.evaluation(),
    blunders: (side) => reviewer.blunders(side),
  });

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
  const engine = createGame({
    declaration,
    host: {
      doc: host, win: window, cvdHost: host.getElementById('cvd'),
      // Out of the board's nine units and into the stage. See the element's own comment.
      pauseHost: enginePause,
      // Named rather than left to the fallback: the engine looks for `#title-icons`, which is the
      // platformer's id, and finding nothing it reported the absence instead of mounting the bar.
      a11yBarHost: a11yBar,
    },
    /*
     * ========================= WHAT THIS GAME DECLINES, AS 8.0.0 ASKS IT =========================
     * ⚠️ `semMenuDePausa` IS GONE, AND ITS GOING IS A CHANGE OF QUESTION RATHER THAN A RENAME. Up to
     * 7.x a game could decline the engine's pause menu; 8.0.0 dropped the field because the answer
     * stopped being optional — the engine now mounts the card itself and asks only WHERE
     * (`host.pauseHost`, defaulting to `#game-region`), pushing a `problems` entry when there is
     * nowhere to put it. The card is born hidden and is revealed by whoever owns the phase, so this
     * game's own pause menu stays the one a player sees.
     *
     * ⚠️ `semVozNeural` IS NEW, AND THE ENGINE NAMES THIS GAME IN THE FIELD'S OWN COMMENT: of six
     * games in the local catalogue, three load a neural voice and three — soccer, whackwhack and
     * this one — neither load it nor say so. There is no neural voice here and there was never a
     * line saying it, which is the difference between declining and forgetting. This is the line.
     */
    declines: { semVozNeural: true, semAssistenteDePad: true, semAtorDePausa: true },
    /*
     * ⚠️ `viz: 'normal'` LEFT, and the absence is the news. The sonar no longer reads a visual mode
     * off the player: the engine's root answers `visaoComprometida` for it, from the two-axis
     * `visual` state a player may carry. This game carries none — a cursor on a board has no
     * eyesight of its own — so the answer stays the same one `'normal'` used to give: not impaired.
     * The blind mode that DOES matter here reaches the sonar through `isBlindMode`, as before.
     */
    sonarPlayers: () => [{ i: 0, x: cursor.x, y: cursor.y }],
    /*
     * ========================= THE DOWNLOAD THIS GAME HAD JUST DECLINED =========================
     * ⚠️ IT DEFAULTS TO TRUE, AND THE DEFAULT CONTRADICTS THE LINE TWENTY ROWS ABOVE. `create-game`
     * ends its boot with `if (o.baixarPesados !== false) void baixarPesados(...).catch(() => {})`,
     * and the catalogue behind it is the neural voices plus a vision bundle — the engine's own
     * comment speaks of "faltam 241 MB". So from the moment this repository moved to 8.0.0, every
     * boot started fetching voices that `declines.semVozNeural` says this game does not have.
     *
     * ⚠️ AND IT COULD NOT HAVE ANNOUNCED ITSELF: the promise is discarded into an empty `catch`, by
     * design — the engine argues, correctly, that a school with no network would otherwise push
     * eight failures into a `problems` list built to say what is missing from the HOST. Nothing is
     * wrong with that decision; what is wrong is a game paying for it silently. Declining the voice
     * and downloading the voice are the same sentence said twice, and this is the half that costs
     * bytes on a school's connection.
     */
    baixarPesados: false,
  });

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

  const view = deps.view({
    doc: host,
    region,
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

  const hud = createHud({
    doc: host,
    view: deps.kind,
    i18n,
    rules: () => rules,
    state: () => game,

    // ⚠️ A maintainer's instrument, behind `?debug=true`.
    debug: /[?&]debug=true/.test(location.search),
    themes: BOARD_THEMES.map((t) => ({ key: t.key, name: t.name })),
    theme: () => themeKey,
    onTheme: (key) => {
      themeKey = key;
      view.applyTheme(key);
      prefs.save({ theme: key });
      // Choosing a palette by hand is a statement about the board, and leaving the panel in a
      // high-contrast skin while the board is not would be a lie the checkbox told.
      const contrast = key.startsWith('contrast-');
      if (paletteHigh !== contrast) {
        paletteHigh = contrast;
        region.dataset.contrast = contrast ? 'high' : '';
      }
      hud.refresh();
    },
    vision: () => vision,
    onVision: (key) => {
      vision = key;
      region.style.filter = VIZ_FILTER[key] ?? '';
      hud.refresh();
    },
    reducedMotion: () => motionReduced,
    onReducedMotion: (on) => { motionReduced = on; hud.refresh(); },
    mode: () => mode,
    onMode: chooseMode,

    markAt: (ply) => reviewer.markAt(ply),
    scoreboard: scoreboard.root,
    ...(mode === 'two' ? {} : {
      protectedOn: () => protectedOn,
      onProtected: (on) => {
        protectedOn = on;
        if (!on) { blunderHeld = null; blunderBar.show(null); }
        prefs.save({ protect: on });
        hud.refresh();
        askOpponent();
      },
    }),
    strengths: STRENGTH_LADDER.map((rung) => ({ elo: rung.elo, name: rung.name })),
    strength: () => elo,
    onStrength: (next) => {
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
    },

    // No engine in a two-player game, so nobody to ask.
    ...(mode === 'two' ? {} : {
      onHint: () => {
        hintsOn = !hintsOn;
        prefs.save({ hints: hintsOn });
        if (!hintsOn) clearHints();
        hud.refresh();
        refreshHints();
      },
      hintsOn: () => hintsOn,
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
        onLesson: (id: string) => { void startLesson(id); },
      }
      : {}),

    /*
     * ⚠️ NAMED IN THEIR OWN LANGUAGES. A reader looking for Spanish is looking for "Español", not
     * for this game's Portuguese word for Spanish — which is the one string a language menu must
     * not translate.
     */
    locales: [
      { code: 'pt', name: 'Português' },
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Español' },
    ],
    locale: () => i18n.getLocale(),
    onLocale: (code) => { void changeLocale(code); },

    opening: () => openingName,

    ...view.hudControls,

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
  region.prepend(players.root);
  // Outside the panel, over the board: see `.theme-report` in the stylesheet.
  region.appendChild(hud.report);
  column.appendChild(hud.root);
  // ⚠️ After `#stage-wrap`, not inside it. That element is a centring FLEX ROW, so a child lands
  // beside the board and squeezes it. The panel belongs under the board, and under the board is
  // the next sibling.
  const wrap = host.getElementById('stage-wrap');
  if (!wrap?.parentElement) {
    // Not fatal, but the thinking panel and the blunder bar would never enter the document, and
    // nothing else would say so. The engine keeps a `problems` list for exactly this shape of gap.
    console.warn('[chess] #stage-wrap has no parent: the thinking panel has nowhere to go');
  }
  /*
   * ========================= ⚠️ INSIDE THE BOARD'S OWN NINE UNITS =========================
   * It was a sibling of `#stage-wrap` once — an 11 px ribbon stretched across a 1600 px window —
   * and then a child of the stage. Both drew it OUTSIDE the sixteen-by-nine box, and the spec is
   * that nothing may be.
   *
   * So it sits at the foot of the region, in flow. On the flat board that pushes the grid up and
   * makes it slightly smaller, which is the intended trade. On the projected and solid boards it
   * costs nothing: their canvas is `position: absolute; inset: 0` and keeps the whole region, so
   * this rides over it — and those two can be zoomed by the player anyway, which is the reason
   * given for treating them differently.
   *
   * It is built here rather than in the three HTML files because it has no content of its own —
   * markup that exists only to be filled in by this module belongs to this module.
   */
  const below = host.createElement('div');
  below.id = 'below-board';
  region.appendChild(below);
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
    pause.refresh();
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
      say: (text) => { srSay(text); refreshLessonMenu(); },
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
   * Moves focus up and down the side panel.
   *
   * ⚠️ THE PANEL IS A COLUMN OF CONTROLS AND NOTHING GAVE IT ARROWS. Tab reaches them, but a
   * player holding a pad has no Tab — and this game's own board is arrow-driven, so a panel that
   * answered only to Tab would be the one place the controls stopped working. Left and right are
   * deliberately left alone: a `<select>` uses them to change its value.
   */
  function walkPanel(action: string | null): boolean {
    if (action !== 'up' && action !== 'down') return false;
    const panel = lessonMenu && !lessonMenu.root.hidden ? lessonMenu.root : hud.root;
    const stops = [...panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]',
    )];
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
    const line = host.querySelector('.hint');
    if (!line) return;
    line.replaceChildren();
    const parts: readonly (readonly [string, string])[] = [
      ['WASD', 'keys.move'],
      ['J', 'keys.select'],
      ['K', 'keys.cancel'],
      ['U', 'keys.teacher'],
      ['I', 'keys.panel'],
      ['L', 'keys.sonar'],
      ['H', 'keys.pause'],
    ];
    /*
     * ⚠️ THE CAMERA HINTS BELONG TO THE VIEWS THAT HAVE A CAMERA, and they used to be typed into
     * two of the three HTML files by hand — which is how the flat page nearly ended up advertising
     * a board it cannot turn.
     */
    const camera: readonly (readonly [string, string])[] = deps.kind === '2d'
      ? []
      : [['⇧ + WASD', 'keys.turn'], ['⇧ + / −', 'keys.zoom']];
    [...parts, ...camera].forEach(([key, label], index) => {
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
  const pause = createPauseMenu({
    doc: host,
    i18n,
    /*
     * ⚠️ THE HUD STILL OWNS THESE, and hands them over rather than duplicating them. Building a
     * second copy of six controls would be two of everything to keep in step — and the pair that
     * drifted would be the one nobody was looking at.
     */
    settings: hud.settings,
    /*
     * ⚠️ THE SAME `<p class="hint">` THE THREE PAGES ALREADY CARRY, moved rather than copied. It is
     * filled by `refreshKeyHints()` from the catalogue at boot and on every change of language, and
     * moving the element keeps that one writer — a second line built here would be a second place
     * for the keys to be wrong.
     */
    keys: host.querySelector('.hint') as HTMLElement | undefined ?? undefined,
    actions: () => [
      { label: 'pause.resume', run: () => pause.hide() },
      ...(lessonMode
        ? [{
          label: 'pause.leaveLesson',
          leaving: true,
          run: () => { pause.hide(); lessonMode?.stop(); },
        }]
        : []),
    ],
  });
  stage.appendChild(pause.root);

  stage.addEventListener('keydown', (event) => {
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
     * ⚠️ `start` IS NOT IN THE ENGINE'S SOLO KEYBOARD SCHEME. Asked of the running page: `KeyU`,
     * `KeyJ`, `KeyK` and `KeyI` all resolve, and `KeyH` and `Enter` both come back NULL. So the
     * pause key is named here rather than resolved — H and Enter, which is what a player is told,
     * plus Escape because every dialog on every platform answers to it.
     */
    if (action === 'start' || event.code === 'KeyH' || event.key === 'Enter'
      || event.key === 'Escape') {
      pause.toggle();
      event.preventDefault();
      return;
    }
    /*
     * ========================= THE FOUR ACTIONS =========================
     * `action2` (confirm) is the board's and lives in `ui/grid-mirror.ts`, because that is what
     * knows where the cursor is. The other three are the shell's, because each of them is about
     * the game rather than about a square.
     */
    if (action === 'action3') {
      // ⚠️ CANCEL CLOSES THE MENU FIRST, before the guard below. A cancel that only worked when
      // nothing was open would be missing the one moment anybody presses it.
      if (pause.open) { pause.hide(); event.preventDefault(); return; }
      // Otherwise it puts the held piece down — activating the selected square again is how
      // `chess/state.ts` already spells "deselect", so there is nothing new to teach it.
      const held = game.selection();
      if (held) { onActivate(held); event.preventDefault(); }
      return;
    }
    if (pause.open) return;

    if (action === 'action1') {
      /*
       * The teacher, in both modes. In a lesson it shows the step's own answer, and refuses until
       * three tries have been spent — `setTeacher` enforces that itself, which is why this can ask
       * plainly rather than checking first. In a game it is the engine's suggestion.
       */
      if (lessonMode) {
        lessonMode.setTeacher(!lessonMode.teacher());
        refreshLessonMenu();
      } else if (mode !== 'two') {
        hintsOn = !hintsOn;
        prefs.save({ hints: hintsOn });
        if (!hintsOn) clearHints();
        hud.refresh();
        refreshHints();
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
      const panel = lessonMenu && !lessonMenu.root.hidden ? lessonMenu.root : hud.root;
      const inPanel = panel.contains(host.activeElement);
      if (inPanel) mirror.focusSquare(cursor);
      /*
       * ⚠️ THE FIRST ENABLED ONE, and the first version left off `:not([disabled])`. The lesson
       * menu's first control is "previous", which is disabled at the very first step of the very
       * first lesson — so pressing this at the one moment a reader is most likely to press it did
       * NOTHING, silently, and left them on the board wondering whether the key existed.
       */
      else {
        panel.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]',
        )?.focus();
      }
      event.preventDefault();
      return;
    }

    /*
     * ⚠️ THE BOARD IS OFFERED THE KEY LAST, AND THAT IS THE BUG THIS FIXES. `ui/grid-mirror.ts`
     * listens on its own root, so it only ever heard keys pressed while focus was already INSIDE
     * the grid — and the splash leaves focus on `#game-region`, its parent. Press START, then a
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
     * nothing else. `especial` is the slot a game may define, and this game never defined it: the
     * sonar moved there when a bare `s` was found colliding with `down`, and moving it there is
     * what silently switched it off.
     *
     * Asked of the running page rather than read off the table. So the key is NAMED here, the way
     * the pause key is, and `especial` is still honoured for the day the engine binds it.
     */
    if (action === 'especial' || event.code === 'KeyL') {
      engine.sonar.sonar({ i: 0, x: cursor.x, y: cursor.y });
      event.preventDefault();
      return;
    }
    if (view.onKey?.(event)) event.preventDefault();
  });

  const relayout = (): void => { applyLayout({ doc: host, win: window }); view.relayout(); };
  relayout();
  window.addEventListener('resize', relayout);

  /* ---------- the loops everything else hangs off ---------- */

  /**
   * A move has been judged. Almost always this does nothing visible — most moves are ordinary —
   * and the whole of protected mode is the exception.
   */
  function onVerdict(entry: ReviewedMove): void {
    if (!protectedOn || !isBlunder(entry.mark) || mode === 'two') return;
    if (entry.side !== playerSide) return;
    if (entry.ply !== rules.history().length - 1) return;   // already answered for, or replayed

    blunderHeld = entry;
    // ⚠️ Counted per POSITION, not per game. Three blunders spread over forty moves is somebody
    // learning; three in a row from the same position is somebody stuck.
    if (stumbleAt !== entry.ply) { stumbleAt = entry.ply; stumbles = 0; }
    stumbles++;

    blunderBar.show({ mark: entry.mark ?? '', lost: entry.lost });
    if (stumbles >= STUMBLES_BEFORE_HELP && !hintsOn) {
      hintsOn = true;
      prefs.save({ hints: hintsOn });
      srSay(i18n.t('protected.teaching'));
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
      srSay(i18n.t('protected.tookBack'));
      void walkHistory('back');
    } else {
      srSay(i18n.t('protected.kept'));
      hud.refresh();
      askOpponent();
    }
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
    const say = (m: Suggestion): string => `${toAlgebraic(m.move.from)} ${toAlgebraic(m.move.to)}`;
    srSay(moves.length > 1
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
    if (!hintsOn || hinting || game.phase() !== 'idle' || hintFen === fen) return;
    void askHint();
  }

  async function askHint(): Promise<void> {
    if (hinting || game.phase() !== 'idle') return;
    hinting = true;
    thinking.setBusy(true);
    hud.refresh();
    srSay(i18n.t('a11y.hintAsked'));
    try {
      const hint = await opponent.requestHint(rules.fen());
      if (!hint) { srSay(i18n.t('a11y.hintNone')); return; }
      hintFen = rules.fen();
      showHint(hint.ties.length ? hint.ties : [{ move: hint.move, behind: 0 }]);
    } catch {
      srSay(i18n.t('status.engineFailed'));
    } finally {
      hinting = false;
      thinking.setBusy(false);
      hud.refresh();
    }
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
    const check = game.kingInCheck();
    if (check) markers.set(squareIndex(check), 'check');
    // The keyboard cursor last, and only where nothing else already speaks for the square.
    const at = squareIndex(cursor);
    if (!markers.has(at)) markers.set(at, 'cursor');
    view.drawMarks(markers, hinted);
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

  function askOpponent(): void {
    if (game.phase() !== 'thinking' || searching) return;
    // ⚠️ HELD. Protected mode's whole value is that the warning arrives while the position it
    // ruined is still on the board. So the opponent waits for TWO things: an unanswered warning,
    // and a verdict that has not landed yet. `reviewer.onChange` is what tries again.
    if (blunderHeld) return;
    if (protectedOn && mode !== 'two' && !reviewer.judged(rules.history().length - 1)) return;

    searching = true;
    thinking.setBusy(true);
    srSay(i18n.t('status.thinking'));

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
        syncPosition([move.to], move.piece);
        announceMove(i18n, move);
        announceOutcome(i18n, game.outcome());
        // The reply is the move nobody was watching for, so it is the one that most needs to be
        // seen travelling rather than to have simply appeared somewhere else.
        void fly(move.from, move.to);
      })
      .catch((error: unknown) => {
        searching = false;
        thinking.setBusy(false);
        // Saying nothing would leave the game on "thinking" for good, and a child waiting for a
        // reply cannot tell that apart from a game that is broken.
        srAlert(i18n.t('status.engineFailed'));
        console.error('[chess] engine failed', error);
      });
  }

  function onActivate(square: Square): void {
    if (walking) return;
    cursor = square;
    const result = game.activate(square);
    if (result.kind !== 'moved') {
      syncPosition();
      announceActivation(i18n, rules, result);
      observer?.(square, result);
      return;
    }

    const move = result.move;
    // The rules have already applied it, so the phase settles now and the travel is only the
    // picture catching up. Said before the flight, not after: a player who cannot see it should
    // not wait a third of a second to be told what happened.
    game.animationDone();
    syncPosition([move.to], move.piece);
    announceActivation(i18n, rules, result);
    announceOutcome(i18n, game.outcome());
    // ⚠️ THE OBSERVER WAITS FOR THE PIECE TO LAND. See `ActivationObserver`: a lesson undoes a
    // wrong move, and undoing one the child never saw teaches nothing.
    void fly(move.from, move.to).then(() => { askOpponent(); observer?.(square, result); });
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
    opponent.cancel();
    searching = false;
    thinking.setBusy(false);

    let step = direction === 'back' ? game.takeBackStep() : game.replayStep();
    if (!step) {
      srSay(i18n.t(direction === 'back' ? 'a11y.nothingToTakeBack' : 'a11y.nothingToReplay'));
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
    srSay(i18n.t(direction === 'back' ? 'a11y.tookBack' : 'a11y.replayed', {
      side: i18n.t(`turn.${rules.turn()}`),
    }));
    askOpponent();
  }

  /** Where the piece a move captured was standing. Not `move.to` when it was taken en passant. */
  function capturedSquare(move: MoveResult): Square {
    if (!move.enPassant) return move.to;
    return { x: move.to.x, y: move.from.y };
  }

  // ⚠️ ONCE, BEFORE ANYTHING HAPPENS. This used to be reached only from an event handler in the
  // flat root, so on a board that had not been touched yet — every restored game, and every
  // switch between views — the reviewer was never told to look. The advantage readout sat at a
  // dash and the score sheet carried no marks until the player happened to move.
  syncPosition();
  askOpponent();

  refreshKeyHints();
  if (engine.problems.length) console.warn('[chess] engine problems:', engine.problems);
  srSay(i18n.t('a11y.boardLabel'));

  if (/[?&]debug=true/.test(location.search)) {
    (window as unknown as Record<string, unknown>)[deps.debugName] = {
      game, rules, mirror, hud, opponent, engine, declaration,
      activate: onActivate, takeBack: () => walkHistory('back'),
      replay: () => walkHistory('forward'), askOpponent,
      ...(view.debug?.() ?? {}),
    };
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
    game = createGameState({ rules, playerSide, opponent: !teaching && mode !== 'two' });
    setTaught([]);
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
    region, i18n, mirror, hud, view, opponent,
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
  return self;
}
