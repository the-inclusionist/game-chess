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

import { createGameShell } from './game-shell.ts';
import { createFlatView } from './view-flat.ts';

export function boot2d(host: Document = document): void {
  createGameShell({
    host,
    kind: '2d',
    view: createFlatView,
    // ⚠️ The grid is the BOARD on this page, not a mirror of one. Same object, same labels, same
    // roving tabindex — it simply keeps its pixels instead of being `sr-only` behind a canvas.
    visibleMirror: true,
    debugName: '__chess2d',
  });
}

// Same self-start as the other two entries: the page names this module and the module starts the
// game. The guard is what lets a test import `boot2d` and call it against a fixture instead.
if (typeof document !== 'undefined' && document.getElementById('game-region')) boot2d();
