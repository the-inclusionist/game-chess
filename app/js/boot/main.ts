// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/main — the entry of the projected board: Zdog geometry, a camera, and a frame loop.
//
// ========================= WHY THIS IS ITS OWN ENTRY =========================
// Each view is its own page because each is its own DOWNLOAD. This one carries Zdog and the six
// piece drawings; the flat board carries neither and is 104 KB against this page's 146, measured
// in `spike/2d-weight/`. A single bundle with a switch would make every player pay for all three
// to use one, which is why the view control is a set of LINKS rather than buttons.
//
// ========================= WHAT IS LEFT HERE, WHICH IS ALMOST NOTHING =========================
// The rules, the state machine, Stockfish in its worker, the seven declaration fields, the panel,
// i18n, the layout, protected mode, the hint switch, the announcements and the history walk are in
// `boot/game-shell.ts`, once, for all three pages. What differs is how a position becomes pixels —
// `boot/view-zdog.ts` — and this file is the sentence that puts the two together.
//
// It was 1,103 lines. The frame loop, the camera, the picking and the pointer went to the view;
// everything else was a copy of something in the other two roots.

import { bootFailed, startChess } from './standalone.ts';

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
  return startChess({
    host,
    kind: '2.5d',
    /*
     * ⚠️ THIS PAGE TEACHES; `3d.html` DOES NOT, AND THAT IS SAID RATHER THAN FUDGED.
     * `render3d/scene.ts` has no marker channel at all — no selection, no legal targets, nothing —
     * so a lesson that said "look at these squares" would silently show nothing there. Offering a
     * mode whose main instruction does nothing is worse than not offering it. See the debt list.
     */
    teaches: true,
    debugName: '__chess',
    // ⚠️ `contrast-solid` HERE and `contrast-flat` on the flat board, and that is the whole reason
    // a theme carries piece inks: the two have the same squares and different pieces, because a
    // solid whose ink is mostly STROKE needs a different answer from a glyph.
    contrastTheme: 'contrast-solid',
  }).then(() => undefined).catch(bootFailed);
}

if (typeof document !== 'undefined' && document.getElementById('game-region')) boot();
