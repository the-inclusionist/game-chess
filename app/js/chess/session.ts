// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/session — the game, written down so it survives a change of view.
//
// ========================= WHY THIS EXISTS AT ALL =========================
// The three views are three PAGES, because the measurement said so: a flat board is 110 KB and the
// projected one 148, and one bundle carrying both would make every player download the one they
// are not looking at. That decision has a bill, and this is it — a navigation throws away every
// object in memory, so switching from 2D to 2.5D restarted the game.
//
// ========================= WHY MOVES AND NOT A FEN =========================
// A FEN is the position and nothing else. It would restore the board and lose the score sheet, the
// captured tally that is READ from that score sheet, and both directions of the take-back. What is
// saved here is therefore the list of moves — and the list of moves that have been taken BACK, so
// that "avançar" still has somewhere to go after a change of view.
//
// Restoring replays them. That costs a few hundred microseconds for a whole game and buys exact
// agreement with a game that was never interrupted: same history, same captures, same redo stack,
// same threefold-repetition state, because chess.js has computed all of it the same way it would
// have anyway.
//
// ========================= WHY sessionStorage =========================
// It survives a navigation within the tab, which is the whole requirement, and it is gone when the
// tab closes. `localStorage` would resurrect a half-finished game days later on a shared school
// machine, in front of whoever sat down next — a different feature, and one nobody asked for.
//
// Every access is wrapped: a private window, a browser configured to refuse site data, or a full
// quota all throw, and none of them is a reason for a chess game to fail to start.

import type { PieceType } from './types.ts';
import { fromAlgebraic, toAlgebraic } from './types.ts';
import { createRules, type Rules } from './rules.ts';

const KEY = 'incl_chess_game';
const SETTINGS_KEY = 'incl_chess_view';

/** A move as four or five characters: `e2e4`, or `e7e8q` for a promotion. */
export type MoveToken = string;

export interface SavedGame {
  /**
   * The position the game began from. Absent means the standard opening — which is every game this
   * app starts today, and exactly the assumption that would rebuild the WRONG game the first time
   * one did not.
   */
  readonly start?: string;
  /** In play order. */
  readonly played: readonly MoveToken[];
  /** Taken back, in PLAY order — so restoring can replay them and unplay them again. */
  readonly future: readonly MoveToken[];
}

export interface SessionStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The tab's own storage, or nothing at all if the browser will not give it. */
export function defaultStore(): SessionStore | null {
  try {
    const store = window.sessionStorage;
    // Touch it: some browsers hand over an object that throws only on first use.
    const probe = '__incl_probe';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

const token = (move: { from: { x: number; y: number }; to: { x: number; y: number };
  promotion: PieceType | null }): MoveToken =>
  toAlgebraic(move.from) + toAlgebraic(move.to) + (move.promotion ?? '');

export function describe(rules: Rules): SavedGame {
  const start = rules.startFen();
  return {
    ...(start === createRules().fen() ? {} : { start }),
    played: rules.history().map(token),
    future: rules.pending().map(token),
  };
}

export function save(rules: Rules, store: SessionStore | null = defaultStore()): void {
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(describe(rules)));
  } catch {
    // Out of quota, or a browser that refuses. The game continues; only its memory is lost.
  }
}

export function clear(store: SessionStore | null = defaultStore()): void {
  try { store?.removeItem(KEY); } catch { /* see above */ }
}

/** Reads what was saved, or null. Anything malformed is treated as nothing rather than trusted. */
export function load(store: SessionStore | null = defaultStore()): SavedGame | null {
  if (!store) return null;
  let raw: string | null = null;
  try { raw = store.getItem(KEY); } catch { return null; }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const played = (parsed as SavedGame).played;
    const future = (parsed as SavedGame).future;
    if (!Array.isArray(played) || !Array.isArray(future)) return null;
    if (!played.every(isToken) || !future.every(isToken)) return null;
    const start = (parsed as SavedGame).start;
    if (start !== undefined && typeof start !== 'string') return null;
    return start === undefined ? { played, future } : { start, played, future };
  } catch {
    return null;
  }
}

const isToken = (value: unknown): value is MoveToken =>
  typeof value === 'string' && (value.length === 4 || value.length === 5)
  && fromAlgebraic(value.slice(0, 2)) !== null && fromAlgebraic(value.slice(2, 4)) !== null;

/**
 * Rebuilds the rules from a saved game. Every token is replayed — the taken-back ones too — and
 * then unplayed, which is what puts them back on the redo stack in the order `redo()` expects.
 *
 * ⚠️ A token that will not play STOPS the restore rather than being skipped. A saved game is only
 * worth anything if it is the same game; half of one, with a move quietly missing, would be a
 * position nobody ever reached.
 */
export function restore(saved: SavedGame): Rules {
  const fresh = (): Rules => createRules(saved.start);
  const rules = fresh();

  for (const item of [...saved.played, ...saved.future]) {
    const from = fromAlgebraic(item.slice(0, 2));
    const to = fromAlgebraic(item.slice(2, 4));
    const promotion = item.length === 5 ? (item[4] as PieceType) : undefined;
    // ⚠️ A token that will not play STOPS the restore. It also has to start over rather than keep
    // what played: half a game is a position nobody reached.
    if (!from || !to || !rules.move(from, to, promotion)) return fresh();
  }

  for (let i = 0; i < saved.future.length; i++) rules.undo();
  return rules;
}

/** The rules a page should start from: a saved game if there is a sound one, a new one otherwise. */
export function resume(store: SessionStore | null = defaultStore()): Rules {
  const saved = load(store);
  return saved ? restore(saved) : createRules();
}


/* ============================ WHAT THE VIEWS AGREE ON ============================ */

/**
 * The handful of choices that must not reset when a player changes view. A board palette that went
 * back to the factory one on every switch would be a worse bug than the restarting game was: the
 * game at least announced itself, and a colour quietly reverting just looks broken.
 *
 * Deliberately NOT everything. Difficulty and the colour-vision correction belong to the engine's
 * own settings and are its to remember; this is the short list this game owns.
 */
export interface ViewSettings {
  /**
   * The language, once somebody has chosen one.
   *
   * ⚠️ ABSENT MEANS "ASK THE BROWSER", which is what the game did exclusively until now — and
   * exclusively was the bug: three catalogues shipped and `setLocale` was never called anywhere in
   * production, so a child on a Portuguese machine could not read the game in Spanish however much
   * they wanted to. A chosen language has to outlive a change of view like every other choice here.
   */
  readonly locale?: string;
  readonly theme?: string;
  readonly set?: string;
  readonly coordinates?: boolean;
  /**
   * Who is playing: one person as white, one as black, or two people sharing the board. Not a
   * rendering preference — it decides whether there is an opponent at all, and which side it
   * answers as — but it belongs here for the same reason the others do: a choice that reset on
   * every change of view would be a bug.
   */
  readonly mode?: 'w' | 'b' | 'two';
  /**
   * Whether two people are sharing the board.
   *
   * ⚠️ SPLIT OFF `mode` ON 2026-10-04. That field decided the player's COLOUR and the number of
   * players at once, and changing it reloaded the page because the colour is read at boot. The
   * Dev asked for a live checkbox, so the number of players moved to a field of its own and `mode`
   * kept the half that still needs a reload. The old value is read once as the default, so nobody
   * loses the setting they had.
   */
  readonly twoPlayers?: boolean;
  /**
   * Whether the engine's suggestions are DRAWN on the board.
   *
   * ========================= ⚠️ TWO SETTINGS, NOT ONE WITH THREE VALUES =========================
   * They were one three-valued setting for a few hours on 2026-10-04, on my reading that "both at
   * once is not a thing a teacher can be". The Dev decided otherwise the same day, and renaming
   * them is what makes the reason plain: «Setas» shows you the moves, «Protetor de Lances» refuses
   * the others. Those are not two amounts of the same thing — they are a display and a rule, and
   * wanting both is the ordinary case rather than a contradiction.
   */
  readonly arrows?: boolean;
  /** Whether a move outside the engine's set is refused. The «Protetor de Lances». */
  readonly guard?: boolean;
  /** @deprecated The three-valued setting these replaced. Read for migration, never written. */
  readonly teacher?: 'off' | 'arrows' | 'silent';
  /** @deprecated The boolean before that. Read for migration, never written. See `arrows`. */
  readonly hints?: boolean;
  /** Which piece drawing the PROJECTED board uses. The flat board's `set` is a font, not a shape. */
  readonly design?: string;
  /** Whether the engine stops the game when the player throws it away. */
  readonly protect?: boolean;
  /** The rating the opponent is asked to play at. */
  readonly elo?: number;
  /**
   * Which board is drawing: flat, projected or solid.
   *
   * ⚠️ THE ADDRESS USED TO CARRY THIS, and that is why it was not here. Each view was its own page,
   * so reloading `3d.html` gave you back the solid board without anything being remembered. One
   * document showing all three means the choice has nowhere to live but here — and a view that
   * reset on every reload would be exactly the bug the `mode` field above was written to avoid.
   */
  readonly view?: '2d' | '2.5d' | '3d';
}

/**
 * Replaces the whole record.
 *
 * ⚠️ REPLACES. What is not in `settings` is GONE, and that is almost never what a caller wants —
 * see `patchSettings`, which is. This one stays because starting from nothing is a real operation
 * (a test, a reset) and because saying so here is better than a second function that quietly
 * shadows it.
 */
export function saveSettings(settings: ViewSettings, store: SessionStore | null = defaultStore()): void {
  if (!store) return;
  try { store.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* see save() */ }
}

/**
 * Merges over what is already stored.
 *
 * ========================= ⚠️ WHY THE FLAT BOARD KEPT LOSING ITS PIECE FONT =========================
 * `saveSettings` writes the whole record, so every page that wanted to change ONE thing had to
 * read the others back and spread them — and each of the three composition roots kept its own
 * `currentSettings()` closure listing only the keys IT knew about. The projected root had no
 * `set`; the solid root had no `set` either and hardcoded `coordinates: false`.
 *
 * The result was not a tidiness problem. Changing the board palette on the projected page erased
 * the flat page's choice of piece font, and touching anything at all on the solid page erased the
 * coordinate switch — silently, and only noticed on the next change of view, by which time
 * nothing on screen connected the loss to what caused it.
 *
 * A merge cannot do that. A caller says what it changed and says nothing about the rest.
 */
export function patchSettings(patch: ViewSettings, store: SessionStore | null = defaultStore()): void {
  if (!store) return;
  // Read through `loadSettings` rather than the raw string: a stored record that has gone bad
  // reads as `{}` there, and a patch onto `{}` is a repair rather than a throw.
  saveSettings({ ...loadSettings(store), ...patch }, store);
}

export function loadSettings(store: SessionStore | null = defaultStore()): ViewSettings {
  if (!store) return {};
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const {
      locale, theme, set, design, coordinates, mode, twoPlayers, elo, hints, protect, view,
    } = parsed as ViewSettings;
    return {
      ...(locale === 'pt' || locale === 'en' || locale === 'es' ? { locale } : {}),
      ...(typeof theme === 'string' ? { theme } : {}),
      ...(typeof set === 'string' ? { set } : {}),
      ...(typeof coordinates === 'boolean' ? { coordinates } : {}),
      ...(mode === 'w' || mode === 'b' || mode === 'two' ? { mode } : {}),
      ...(typeof twoPlayers === 'boolean' ? { twoPlayers } : {}),
      ...(view === '2d' || view === '2.5d' || view === '3d' ? { view } : {}),
      ...(typeof design === 'string' ? { design } : {}),
      ...(typeof hints === 'boolean' ? { hints } : {}),
      ...(typeof protect === 'boolean' ? { protect } : {}),
      ...(typeof elo === 'number' && Number.isFinite(elo) ? { elo } : {}),
    };
  } catch {
    return {};
  }
}


/* ============================ WHAT A CHILD COMES BACK FOR ============================ */

/**
 * ========================= ⚠️ THIS ONE IS `localStorage`, AND THE REASON INVERTS =========================
 * The argument at the top of this file for `sessionStorage` is a good one and it does not carry
 * here — it turns around and points the other way.
 *
 * A half-finished GAME resurrected days later on a shared school machine, in front of whoever sat
 * down next, is a feature nobody asked for. A list of lessons finished is the opposite: it is the
 * thing the child came back for. It carries no position, no moves and no name; it says nothing
 * about who they are; and losing it every time a tab closes makes a course impossible to finish.
 *
 * So two channels, two answers, and the difference IS the point. Nothing else joins this one — not
 * the position, not the moves, not a name.
 */
const PROGRESS_KEY = 'incl_chess_learned';

/**
 * What has been learned, and where the reader had got to.
 *
 * `at` is what makes a lesson resumable across a reload — including the emergency route the plan
 * kept for a step that changes the position, which reloads the page rather than swapping the rules
 * object. Its `step` is an index into `Lesson.steps`, and `teach/tutor.ts` treats one that has run
 * off the end as a start rather than a fault, because storage outlives a lesson being shortened.
 */
export interface Progress {
  /** Lesson ids, finished. Order is the order they were finished in. */
  readonly done: readonly string[];
  /** Where a lesson was left, if one was. */
  readonly at?: { readonly lesson: string; readonly step: number };
}

/**
 * Storage that outlives the tab, or nothing at all if the browser will not give it.
 *
 * ⚠️ THE WRITE PROBE IS NOT PARANOIA — see `defaultStore()`: some browsers hand over an object that
 * throws only on first use, so asking whether the property exists proves nothing. A private
 * window, site data refused, or a full quota all fail here, and none of them is a reason a child
 * cannot take a lesson. They simply do not get to keep it.
 */
export function durableStore(): SessionStore | null {
  try {
    const store = window.localStorage;
    const probe = '__incl_probe';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

export function loadProgress(store: SessionStore | null = durableStore()): Progress {
  if (!store) return { done: [] };
  try {
    const raw = store.getItem(PROGRESS_KEY);
    if (!raw) return { done: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { done: [] };
    const { done, at } = parsed as Progress;
    // ⚠️ EVERY FIELD IS CHECKED, because this record survives an update of the game. A `done` that
    // has become a string, or an `at.step` that has become a float, would otherwise reach the
    // tutor as an index — and the failure would be a lesson that opens on nothing.
    return {
      done: Array.isArray(done) ? done.filter((id): id is string => typeof id === 'string') : [],
      ...(at && typeof at.lesson === 'string' && Number.isInteger(at.step) && at.step >= 0
        ? { at: { lesson: at.lesson, step: at.step } }
        : {}),
    };
  } catch {
    return { done: [] };
  }
}

/**
 * Replaces the whole record.
 *
 * ⚠️ REPLACES — the same warning `saveSettings` carries, and for the same reason. The two callers
 * below are what the game actually does; this stays because starting from nothing is a real
 * operation and because saying so is better than a second function that quietly shadows it.
 */
export function saveProgress(progress: Progress, store: SessionStore | null = durableStore()): void {
  if (!store) return;
  try { store.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* see save() */ }
}

/** Remembers where a lesson was left, without disturbing what has been finished. */
export function rememberPlace(
  lesson: string, step: number, store: SessionStore | null = durableStore(),
): void {
  saveProgress({ ...loadProgress(store), at: { lesson, step } }, store);
}

/**
 * Files a lesson as finished and forgets the place in it.
 *
 * ⚠️ THE PLACE IS DROPPED ON PURPOSE. A finished lesson resumed at its last step would reopen on
 * the question that had just been answered — which reads as the game having lost the answer.
 * Recorded once: a lesson finished twice does not appear twice.
 */
export function markLearned(lesson: string, store: SessionStore | null = durableStore()): void {
  const { done } = loadProgress(store);
  saveProgress({ done: done.includes(lesson) ? done : [...done, lesson] }, store);
}
