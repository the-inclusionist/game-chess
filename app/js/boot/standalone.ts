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
import { createChessCartridge } from './game-shell.ts';
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
     * ⚠️ HOST-OWNED, AND THAT IS A READING RATHER THAN A DECISION. ADR-0139 leaves `declines`
     * undecided: it reads as a statement about what a GAME does not have, which would put it in
     * `CartridgeHooks`, but `createGame` also returns a resolved `declines`. It sits here because
     * here is where it was, and the record says to read the implementation before moving it.
     */
    declines: { semVozNeural: true, semAssistenteDePad: true, semAtorDePausa: true },
    /*
     * ⚠️ HOST-OWNED BY THE SPLIT, AND THE CONSEQUENCE IS WANTED: a swap between cartridges inside
     * the platform does not re-fetch anything. This game declares no neural voice, so the ~241 MB
     * catalogue behind this flag is bytes it would download and never use.
     */
    baixarPesados: false,
  });

  return cartridge.create(engine);
}
