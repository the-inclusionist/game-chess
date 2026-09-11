// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/standalone — the shell this repository runs itself in.
//
// ========================= WHY THIS FILE EXISTS AT ALL =========================
// ADR-0139 §2 put the `createGame` call OUTSIDE the cartridge, and ADR-0140 is what that buys: one
// source tree serving two shells. This is the first of the two. The other is the platform, which
// calls `createGame` ONCE for however many games share the page and hands each cartridge the engine
// it already built.
//
// ⚠️ THE WHOLE DIFFERENCE BETWEEN THE TWO MODES LIVES IN THIS FILE, and it is about thirty lines.
// Nothing in `game-shell.ts` knows which shell it got — that is the property the split exists to
// create, and it is why the conversion is cheap rather than clever.
//
// ⚠️ AND ADR-0140 §3 DRAWS A LINE THIS FILE MUST NOT CROSS: the standalone artifact is a
// development, test, audit and demonstration route, NEVER a delivery route to children. A
// standalone build deployed for children is a unit of installation, and then every word of
// ADR-0117 applies — Cache Storage partitions by origin, so the child's accessibility profile
// stops following her from one game to the next, and a school network has a second address to
// allow.
import { createGame } from '@the-inclusionist/engine';
import { srAlert } from '@the-inclusionist/engine/core/a11y-sr.js';
import { createChessCartridge } from './game-shell.ts';
import { VIEWS } from './views.ts';
import { CONTRAST_THEME } from '../ui/board-themes.ts';
import type { ViewKind } from '../ui/hud.ts';
import type { GameShell, GameShellDeps } from './game-shell.ts';

// Re-exported because this file is the door now: whoever builds a shell imports it from here.
export type { GameShell, GameShellDeps } from './game-shell.ts';

/**
 * Build the game, give it an engine, start it.
 *
 * The three steps are the contract read aloud: the cartridge is made first because `createGame`
 * needs its `declaration` as a value; the engine is made second from the game's half merged with
 * the host's; the cartridge is started third, with the engine it never built.
 */
export function createGameShell(deps: GameShellDeps): GameShell {
  const cartridge = createChessCartridge(deps);
  const host = deps.host;

  const engine = createGame({
    // The game's half — `declaration`, `sonarPlayers`, `preset`, `isNavigable`. Read off
    // `CreateGameOptions` rather than designed, per ADR-0139 §1.
    ...cartridge.hooks,
    host: {
      doc: host,
      win: window,
      cvdHost: host.getElementById('cvd'),
      // Where the engine's own pause card and accessibility bar fit. The game knows the layout and
      // says WHERE; this shell decides whether to use it. See ADR-0122 and the elements' comments.
      ...cartridge.hosts,
    },
    /*
     * ⚠️ HOST-OWNED BY THE SPLIT, AND THE CONSEQUENCE IS WANTED: a swap between cartridges inside
     * the platform does not re-fetch anything. This game declares no neural voice, so the ~241 MB
     * catalogue behind this flag is bytes it would download and never use.
     */
    baixarPesados: false,
  });

  return cartridge.create(engine);
}

/**
 * Boot this game by NAME of view, letting the cartridge fetch its own renderer.
 *
 * ⚠️ THE ASYNC LIVES HERE AND NOT IN THE CARTRIDGE, and that is the whole reason this function
 * exists beside `createGameShell` instead of replacing it. A renderer arrives by dynamic `import()`,
 * which is a promise; the cartridge's own construction must stay synchronous because `createGame`
 * needs its `declaration` as a VALUE before anything else can happen. Resolving the view first and
 * handing it over keeps both true.
 *
 * 📌 It is also what lets a test hand in a fake renderer with no `await` anywhere: `createGameShell`
 * still takes a view, and 26 test call sites did not have to learn about promises to keep working.
 */
export async function startChess(deps: Omit<GameShellDeps, 'view'>): Promise<GameShell> {
  const view = await VIEWS[deps.kind]();
  return createGameShell({ ...deps, view });
}

/**
 * What to do when the board never arrives.
 *
 * ⚠️ A RENDERER NOW COMES BY DYNAMIC `import()`, so for the first time booting this game can fail
 * at a point where nothing else notices: the splash stays up, the region stays empty, and a promise
 * nobody awaited carries the reason away. That is the shape of silent failure this repository keeps
 * finding, and it is worse here than usual — a child who cannot see the screen gets no signal at all.
 *
 * So it is loud in both channels: the console for whoever is debugging, and `srAlert` for whoever is
 * listening. Assertive rather than polite, because unlike a wrong move in a lesson, this one really
 * is an emergency: there is no game.
 */
export function bootFailed(error: unknown): void {
  console.error('[chess] the board could not be loaded', error);
  try {
    srAlert('Não foi possível carregar o tabuleiro. Verifique a ligação e recarregue a página.');
  } catch {
    // The live region may not exist if the failure happened before the document was ready.
  }
}

/**
 * Everything about a view that is not the renderer itself.
 *
 * ⚠️ THIS WAS THREE ROOTS SAYING NEARLY THE SAME THING, and the differences were four fields out of
 * five. Measured before gathering them: `teaches` is true on all three, and only the flat board
 * differs on the other two — its grid IS the board rather than a mirror behind a canvas, and its
 * high-contrast palette answers a glyph where the other two answer a stroke.
 *
 * 📌 Gathered here because the three HTML entries are going away: inside a platform a second entry
 * is a second URL, not a second bundle. A single root needs to derive from the KIND what three
 * files used to state, and this table is that derivation — written once so the collapse is a
 * deletion rather than a rewrite.
 */
const PER_VIEW = {
  '2d': { visibleMirror: true, debugName: '__chess2d', contrastTheme: CONTRAST_THEME },
  '2.5d': { visibleMirror: false, debugName: '__chess', contrastTheme: 'contrast-solid' },
  '3d': { visibleMirror: false, debugName: '__chess3d', contrastTheme: 'contrast-solid' },
} as const;

/**
 * Boot this game in one named view.
 *
 * ⚠️ ALL THREE TEACH, and that is worth stating because it was not always so: the solid board was
 * left out while `render3d/scene.ts` had no marker channel, since a lesson that says «look at these
 * squares» and shows nothing is worse than no lesson mode. The channel exists; the exception does
 * not.
 */
export function bootChess(host: Document, kind: ViewKind): Promise<void> {
  return startChess({ host, kind, teaches: true, ...PER_VIEW[kind] })
    .then(() => undefined)
    .catch(bootFailed);
}
