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
import { en } from '../app/js/i18n/en.ts';
import { es } from '../app/js/i18n/es.ts';
import { pt } from '../app/js/i18n/pt.ts';

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
