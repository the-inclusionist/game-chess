// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/main-3d — the entry of the WebGL board.
//
// ========================= WHY A THIRD ENTRY AND NOT A FLAG =========================
// Each view is its own page because each is its own DOWNLOAD. The flat board is 104 KB and never
// loads Zdog; the projected board is 146 KB and never loads Three; this one carries Three and
// nothing else. A single bundle with a switch would make every player pay for all three to use
// one, which is why the view control is a set of LINKS rather than buttons.
//
// ========================= WHAT IS LEFT HERE, WHICH IS ALMOST NOTHING =========================
// The rules, the state machine, Stockfish in its worker, the seven declaration fields, the panel,
// i18n, the layout, protected mode, the hint switch, the announcements and the history walk are in
// `boot/game-shell.ts`, once, for all three pages. What differs is how a position becomes pixels —
// `boot/view-solid.ts` — and this file is the sentence that puts the two together.
//
// It was 610 lines, and four faults it had were faults of being a third copy: it answered the
// engine through the wrong door and dropped every reply, it hid its canvas from nobody, it never
// gave the grid the engine's remappable keys, and it printed "K sonar" in its legend while
// listening for nothing. All four are the shell's business now, and the shell gets them right once.

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
export function boot3d(host: Document = document): Promise<void> {
  return bootChess(host, '3d');
}

if (typeof document !== 'undefined' && document.getElementById('game-region')) boot3d();
