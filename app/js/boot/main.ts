// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/main — the entry of the standalone page. The only entry there is.
//
// ========================= WHY IT ARRIVES AT ONE ENTRY =========================
// ⚠️ THERE WERE THREE, one per view, and the measurement that justified them still stands — it is
// the mechanism that changed. A flat board needs 104 KB and the Zdog one 146, measured in
// `spike/2d-weight/`, so one bundle with a switch would have made every player pay for all three to
// use one. As separate PAGES each carried only what it drew, and the view control was a set of
// LINKS because a link is how you reach another page.
//
// Dynamic `import()` buys the same saving without the pages, and better: `view-flat` is 0.8 KB,
// `view-zdog` 38.2 KB and `view-solid` 553.6 KB, each a chunk nobody parses unless they choose it —
// where `3d.html` used to load Three.js eagerly for anyone who opened it. The links are buttons now,
// because there is no other page to reach.
//
// And weight is not why it HAD to change: inside a platform a second HTML entry is a second URL,
// not a second bundle (ADR-0139, which records this for this game by name).
//
// ========================= WHAT IS LEFT HERE, WHICH IS ALMOST NOTHING =========================
// The rules, the state machine, Stockfish in its worker, the seven declaration fields, the panel,
// i18n, the layout, protected mode, the hint switch, the announcements and the history walk are in
// `boot/game-shell.ts`, once. What differs between views is how a position becomes pixels, and that
// is behind `boot/views.ts`. This file is one line: ask the standalone shell to boot.

import { bootChess } from './standalone.ts';

/*
 * ⚠️ THIS FILE NO LONGER KNOWS WHAT A RENDERER IS, and that is the point rather than a tidy-up. It
 * used to import one view module and hand the factory over, which is right for a page that IS the
 * game and wrong for a game that is one of many: a host cannot be asked to know what a Zdog view is.
 * `startChess` asks the cartridge's own registry for the view this kind names, by dynamic
 * `import()`, so each renderer stays a chunk nobody parses unless it is chosen.
 */
/**
 * ⚠️ RETURNS A PROMISE NOW, AND THAT IS A REAL CHANGE RATHER THAN A TYPE TIDY-UP. The renderer
 * arrives by dynamic `import()`, so the board is not on the screen when this function returns. Four
 * boot tests failed the moment it stopped being synchronous, which is the suite catching exactly
 * what it exists to catch — they asserted a mounted board immediately after calling this.
 *
 * Anything that needs the game to be up has to await it. The failure path is the same either way:
 * `bootFailed` is loud in the console AND in `srAlert`, because a board that never arrives is not a
 * degraded experience, it is no game at all.
 */
export function boot(host: Document = document): Promise<void> {
  return bootChess(host, '2.5d');
}

if (typeof document !== 'undefined' && document.getElementById('game-region')) boot();
