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

import { createGameShell } from './game-shell.ts';
import { createSolidView } from './view-solid.ts';

export function boot3d(host: Document = document): void {
  createGameShell({
    host,
    kind: '3d',
    view: createSolidView,
    /*
     * ⚠️ THIS PAGE TEACHES NOW, AND IT DID NOT. It was left out because `render3d/scene.ts` had no
     * marker channel at all — a lesson saying "look at these squares" would have shown nothing, and
     * offering a mode whose main instruction silently does nothing is worse than not offering it.
     * The scene has marks now, so the reason is gone.
     */
    teaches: true,
    debugName: '__chess3d',
    // Solids, not glyphs: the same squares as the flat board's high contrast, different pieces.
    contrastTheme: 'contrast-solid',
  });
}

if (typeof document !== 'undefined' && document.getElementById('game-region')) boot3d();
