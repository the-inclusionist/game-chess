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
import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import { createFrameTicker } from '../render/frame-ticker.ts';
import { createChessCartridge } from './game-shell.ts';
import { VIEWS } from './views.ts';
import { CONTRAST_THEME } from '../ui/board-themes.ts';
import type { ViewKind } from '../ui/hud.ts';
import { loadSettings } from '../chess/session.ts';
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
  const host = deps.host;
  /*
   * ⚠️ THE ONE PLACE IN THIS REPOSITORY THAT READS THE ADDRESS, and it is here because a HOST is
   * what an address belongs to. The cartridge used to read `location.search` itself for its
   * `?debug=true`; ADR-0139 §4 counts that among the faults it removes, since a platform page has
   * one address for however many games share it, and a game reading it directly reads whatever the
   * page was opened with rather than what it was given.
   *
   * `defaultView` rather than `window`, because `host` is the document a caller handed over and may
   * not be this one — a test builds its own. An explicit `params` in the deps still wins.
   */
  const params = deps.params
    ?? new URLSearchParams(host.defaultView?.location.search ?? '');
  const cartridge = createChessCartridge({ ...deps, params });

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

  const shell = cartridge.create(engine);

  /*
   * ========================= THE CLOCK IS THE SHELL'S, AND ONLY THE SHELL'S =========================
   * ADR-0139 §3 in one statement: a cartridge never calls `startLoop`. It used to be called twice
   * here — once inside the projected view and once inside the solid one — which was right while each
   * view was its own page and wrong the moment a view became something you switch. Two consequences
   * were already true and nobody had to pay for them yet: two renderers on one page would have meant
   * two clocks, and switching view meant tearing a clock down and building another.
   *
   * ⚠️ AND `aoFalhar` IS THE ENGINE'S NOW, WHICH IS THE PART THAT MATTERS. Both views passed a
   * `console.error`, so a loop that stopped announced itself to whoever had devtools open. The
   * engine's own announcer reaches the screen reader and the visible page, and its comment says why
   * that is not a nicety: a child who cannot see the screen has no way to tell a frozen board from a
   * board that is thinking. Stopping was never optional; SAYING so was, and this is where it stopped
   * being skipped.
   *
   * `2` is the frame ceiling, unchanged from both call sites it replaces: a tab that comes back after
   * a minute in the background must not advance an animation by three thousand frames at once.
   *
   * 📌 Nothing stops this ticker, because in this shell nothing ends before the document does. A
   * platform that swaps cartridges needs the other half — `teardown()`, the sibling ADR-0139 names
   * beside `update` — and it is not written yet; saying so here is cheaper than discovering it as a
   * leak on the day two games share a page.
   */
  startLoop(createFrameTicker(), (dt) => { shell.update(dt); }, 2, { aoFalhar: engine.aoFalhar });

  return shell;
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
export function bootChess(host: Document, asked?: ViewKind): Promise<void> {
  /*
   * ⚠️ THE REMEMBERED VIEW WINS WHEN NOBODY ASKS, and `2.5d` is the floor rather than a preference:
   * it is the board this game was built to draw, and the one the title screen's art belongs to.
   * An explicit `asked` still wins over both — that is how a test names the view it wants.
   */
  const kind = asked ?? loadSettings().view ?? '2.5d';
  return startChess({ host, kind, teaches: true, ...PER_VIEW[kind] })
    .then(() => undefined)
    .catch(bootFailed);
}
