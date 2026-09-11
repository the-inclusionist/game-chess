// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/main-2d — the entry of the flat board. The one that never imports a renderer.
//
// ========================= WHY THIS IS A SECOND ENTRY AND NOT A MODE =========================
// Measured, not assumed (`spike/2d-weight/`, and the note in docs/design-2d-board-and-piece-sets):
//
//   2D only, no renderer     104.17 KB raw    36.70 KB gzip
//   Zdog board and pieces    146.44 KB        49.20 KB
//
// A flat board offered as a MODE inside the Zdog bundle would ask a school's connection for
// everything the 3D board needs and then not use it. As its own entry it asks for what it draws.
// The engine makes that possible on purpose: `createGame` is an ACCESSIBILITY contract and imports
// no renderer at all, which its own consumer test asserts in as many words.
//
// ========================= WHAT IS LEFT HERE, WHICH IS ALMOST NOTHING =========================
// The rules, the state machine, Stockfish in its worker, the seven declaration fields, the panel,
// i18n, the layout, protected mode, the hint switch and the history walk are all in
// `boot/game-shell.ts`, once, for all three pages. What differs between the pages is how a
// position becomes pixels — `boot/view-flat.ts` here — and this file is the sentence that puts the
// two together.
//
// It was 661 lines. Everything taken out of it was a copy of something in the other two roots, and
// three of the faults that copying produced are in the git log immediately above this change.

import { bootChess } from './standalone.ts';

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
export function boot2d(host: Document = document): Promise<void> {
  return bootChess(host, '2d');
}

// Same self-start as the other two entries: the page names this module and the module starts the
// game. The guard is what lets a test import `boot2d` and call it against a fixture instead.
if (typeof document !== 'undefined' && document.getElementById('game-region')) boot2d();
