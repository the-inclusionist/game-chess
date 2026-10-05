// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE CARTRIDGE ENTRY =========================
// What a host imports when this game is one of many on a page. ADR-0139 decided the shape and
// ADR-0140 decided that it comes from the same source as the standalone PWA — `app/index.html`
// loads `boot/standalone.ts`, a platform loads this.
//
// ⚠️ NOTHING HERE RUNS ON IMPORT, and that is the property the file exists to have. A cartridge is
// instantiated by a factory; a module that boots on import cannot be one of six, cannot be torn
// down, and cannot be started twice. Spec D14, and the engine's own user story behind it: «I want
// the engine to carry no game state, so that two games on one page do not collide».
import type { Engine } from '@the-inclusionist/engine';
import { en } from '../app/js/i18n/en.ts';
import { es } from '../app/js/i18n/es.ts';
import { pt } from '../app/js/i18n/pt.ts';
import { CHESS_ACCOMMODATIONS, staticDeclaration } from '../app/js/declaration/cartridge-answers.ts';
import { SONAR_ACTION } from '../app/js/declaration/chess-declaration.ts';
import { actionPreset } from '../app/js/ui/key-hints.ts';
import { createChessCartridge, type GameShell } from '../app/js/boot/game-shell.ts';
import type { ViewKind } from '../app/js/ui/hud.ts';
import { VIEWS } from '../app/js/boot/views.ts';
import { PER_VIEW } from '../app/js/boot/standalone.ts';

/**
 * The repository, the package and the cartridge are one word — ADR-0082 §1.
 *
 * Measured rather than asserted: the directory is `game-chess`, `package.json` says
 * `@the-inclusionist/game-chess`, and the remote is `the-inclusionist/game-chess`. Unlike the
 * pinball, which ADR-0139 names for having three different words for one game, this one agrees
 * with itself.
 */
export const slug = 'game-chess';

/**
 * The three catalogues, for whichever shell loads this cartridge to register.
 *
 * ⚠️ THE TEACHING PROSE IS NOT HERE, and its absence is a decision rather than an oversight. That
 * text is ~5.5 kB per language of lesson sentences behind a dynamic import, so that somebody who
 * only wants to play never downloads the course. `i18n/teach/loadTeach(locale)` fetches it on the
 * first lesson and on every change of language. Putting it in this object would undo a measurement.
 */
export const dicts = { pt, en, es } as const;

/**
 * Build one instance of this game.
 *
 * ⚠️ A FACTORY, NOT `export const declaration` BESIDE `export default create(ctx)`, and this is a
 * finding about the contract rather than a preference. `architecture.md` sketches the second shape;
 * it fits a game whose declaration is a fixed description of itself. Chess's is not — its seven
 * fields read `rules()`, `state()` and `cursor()`, which are the CURRENT game, so as module
 * constants they would need a module-level pointer to the live instance. That is exactly what D14
 * forbids and the reason two games could not share a page. From a factory each call carries its own
 * state, its own declaration and its own instance, with nothing at module scope — so ADR-0139's
 * `Cartridge` INTERFACE is satisfied and only the sketch's shape is not.
 *
 * 📌 WHAT IS NOT DONE YET, named so it is not mistaken for finished: `create()` takes the engine,
 * where ADR-0139 §4 has it take a whole `GameCtx` — `{ engine, region, rng, t, params }`. Member by
 * member, because they are not one job:
 *
 * · `params` ✅ IS THREADED, and it arrives at CONSTRUCTION rather than in `create`. That departure
 *   is measured, not casual: `?debug=true` is read while the panel is being built, and the panel
 *   must exist before `createGame` — the engine is handed `a11yBarHost`, which lives inside it. A
 *   cartridge whose hosts are its own DOM cannot wait for the engine to learn its arguments.
 * · `region` — HALF DONE, and the half that is done is the one that had no name. Chess used to
 *   write into three places at once — the board, the side column, and beside the stage wrap —
 *   because its region was one ninth of what it draws, and the contract's «may write inside it and
 *   nothing outside it» had nothing to point at. Since the Dev's decision of 2026-09-11 the region
 *   is the board PLUS the panel, so everything this game draws is inside one element. What remains
 *   is that the factory still FINDS that element by id rather than being handed it, which is wrong
 *   on a page with several games; it belongs in the factory's own deps, and cannot move into
 *   `create` for the reason given above `params`.
 * · `rng` — this game never draws a random number, so there is nothing to take.
 * · `t` — its own, which the record allows: a stateless utility may be imported rather than handed
 *   over, and this game's catalogue is not the engine's.
 */
export { createChessCartridge as createCartridge } from '../app/js/boot/game-shell.ts';
export type { ChessCartridge } from '../app/js/boot/game-shell.ts';

/** A convenience for a host that wants the declaration without keeping the instance. */
export function describe(): { readonly slug: string; readonly locales: readonly string[] } {
  return { slug, locales: Object.keys(dicts) };
}

/* ============================ THE DEFAULT EXPORT — ADR-0139 §2 ============================ */

/**
 * What a host hands `create`. ADR-0139 §4 calls it `GameCtx`.
 *
 * ⚠️ DECLARED HERE BECAUSE THE ENGINE DOES NOT PUBLISH IT, which is worth knowing before trusting
 * it: `inclusionist-check-cartridge` asks only that `create` be a FUNCTION, and there is no
 * `Cartridge` or `GameCtx` type in the engine's published `.d.ts`. So nothing mechanical would have
 * caught a `create` that took an `Engine` where a host passes an object — the gate would be green
 * and the first platform to install this game would get `undefined` where it expected a board.
 * Taking the object is the shape the record names, and the one that can grow a member without
 * changing its own signature.
 */
export interface ChessGameCtx {
  /** The engine the host built, ONCE, for however many games share the page. */
  readonly engine: Engine;
  /** The element this cartridge may write inside, and outside which it may not. */
  readonly region?: HTMLElement;
  /** The arguments THIS game was opened with — never `location`, which the page shares. */
  readonly params?: URLSearchParams;
  /** Which board to draw. The standalone pages pick it; a platform may not care. */
  readonly kind?: ViewKind;
}

/**
 * THE CARTRIDGE, as `createGame` and `mount()` read it.
 *
 * ========================= ⚠️ TWO DECLARATIONS, AND THE ORDER IS THE DESIGN =========================
 * The `declaration` below is the STATIC one — a board at the opening position, built with no
 * document — and it is what a platform refuses on at `createGame`, before this game has a page to
 * be described. The LIVE one, which reads `rules()`, `state()` and `cursor()`, cannot exist until
 * `create(ctx)` has built the board, and it reaches the engine through `ctx.engine.mount()` on the
 * last line of `create`.
 *
 * That is not a workaround: it is what `mount()` is for. The engine's own comment says
 * `declaration`, `declines`, `problems` and `reach` are GETTERS precisely «so all four must follow
 * the mounted cartridge — a plain field here would return, after a `mount()`, what the cartridge
 * that booted first had». From the mount onward, every read the engine makes is of the live game.
 *
 * 📌 AND THE STATIC ONE IS NOT A STAND-IN. `conformanceProblems` states what it asks: «It checks
 * SHAPE, not truth.» A chess board is 8×8 at the opening position and 8×8 forever, so the shape a
 * fresh game declares is the shape every game of chess declares.
 */
/*
 * ⚠️ BUILT ONCE AND NAMED, because it is read from two places below and a second
 * `staticDeclaration()` call would be a second OBJECT. Nothing would fail: the engine's checker
 * reads `cartridge.declaration` and its boot reads whatever a host spread out of `cartridge.hooks`,
 * so two separate-but-equal declarations would pass every gate — and the day one of them was
 * changed, the gate would still pass and the platform would run the other one.
 */
const declaration = staticDeclaration();

const cartridge = {
  slug,

  /** Read once, at `createGame`, as this cartridge's conformance statement. See above. */
  declaration,

  /**
   * The game's half of `CreateGameOptions` — ADR-0139 §1 — as a FIELD and not spread onto this
   * object.
   *
   * 🔴 AND THE NESTING IS NOT A STYLE CHOICE: the engine's two readers look in two different
   * places, which cost a measurement to find. `createGame(o)` calls
   * `refuseCartridge('createGame', cartridge.declaration, cartridge)` — the hooks FLAT, because by
   * then a host has already spread them into its options. `inclusionist-check-cartridge` calls
   * `refusals(cartridge.declaration, cartridge.hooks)` — NESTED, because it is reading the
   * cartridge as ADR-0139 §2 describes it.
   *
   * Written flat, this cartridge passed `createGame` and the CI gate said «accommodations:
   * missing» about an object that was demonstrably there — `cartridgeRefusals(c.declaration, c)`
   * returned `[]` on the very same build. Written as a field, both readers are right, and a host
   * does what `boot/standalone.ts` already does one file over: `...cartridge.hooks`.
   *
   * 📌 The two answers inside are the ones measured on 2026-10-05 as the minimum: with the
   * declaration plus these two the engine's list is EMPTY, and with either missing it is not. They
   * are imported rather than written here — `declaration/cartridge-answers.ts` says why a second
   * copy would be worse than a shared one.
   */
  hooks: {
    declaration,
    accommodations: CHESS_ACCOMMODATIONS,
    preset: actionPreset(SONAR_ACTION),
  },

  /**
   * Builds one game inside the host's region and hands the engine the live declaration.
   *
   * ⚠️ ASYNC, BECAUSE A RENDERER IS A DYNAMIC IMPORT. The three views are code-split on purpose —
   * flat is 0.8 kB, Zdog 38.2 kB and the solid one 540.7 kB — so a cartridge that resolved its view
   * synchronously would make every player pay for all three. The cartridge's own CONSTRUCTION stays
   * synchronous, which is the property that matters: `createChessCartridge` returns a value, and
   * only the view in front of it is awaited.
   *
   * ⚠️ MOUNTED BEFORE STARTED. `mount()` throws on a malformed declaration and refuses before
   * writing, so a failure here leaves the engine on the cartridge it had rather than half on this
   * one. Starting first would have the game announcing moves against the static declaration — the
   * opening position — for as long as the two lines are apart.
   *
   * 🔴 WHAT A PLATFORM STILL DOES NOT GET, named rather than discovered: the engine's accessibility
   * bar and pause card are placed from `host.a11yBarHost` and `host.pauseHost`, which a host passes
   * to `createGame` — and in this path `createGame` has already run by the time this game builds the
   * panel those two elements live inside. `cartridge.hosts` below names them, and there is nowhere
   * to deliver them. The engine reports that as `problems`, not as a refusal, so the game plays and
   * the bar lands wherever the host put it. Standalone is unaffected: `boot/standalone.ts` builds
   * the cartridge BEFORE `createGame` and passes `...cartridge.hosts` straight in.
   */
  async create(ctx: ChessGameCtx): Promise<GameShell> {
    const kind: ViewKind = ctx.kind ?? '2.5d';
    const view = await VIEWS[kind]();
    const built = createChessCartridge({
      /*
       * ⚠️ THE REGION'S OWN DOCUMENT, NOT THE GLOBAL ONE. A host may build this game inside a
       * document that is not the one this module was evaluated in — an iframe, a test's own DOM —
       * and reaching for the global `document` there writes the board into the wrong page.
       */
      host: ctx.region?.ownerDocument ?? document,
      region: ctx.region,
      params: ctx.params,
      kind,
      view,
      /*
       * ⚠️ THE PAGE'S OWN TABLE, NOT THREE FIELDS WRITTEN AGAIN. `contrastTheme` differs between
       * the flat board and the other two — same squares, different piece inks — and a second copy
       * of that fact would be wrong silently: nothing shows it until a child turns high contrast on
       * and the pieces stop separating from the squares.
       */
      ...PER_VIEW[kind],
    });
    ctx.engine.mount(built.declaration, built.hooks);
    return built.create(ctx.engine);
  },
};

export default cartridge;
