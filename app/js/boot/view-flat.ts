// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/view-flat — the board that is already accessible, with its `sr-only` taken off.
//
// ========================= THE VIEW THAT DRAWS NOTHING =========================
// Every other view builds a picture and keeps an invisible grid beside it for a screen reader.
// This one has no picture: the grid IS the board. So almost every method here is a line of
// delegation, and the two that are empty are empty for a reason worth stating rather than for want
// of anything to say.
//
// ⚠️ NOTHING IN THIS FILE IMPORTS A RENDERER, and that is the entry's whole reason to exist:
// measured in `spike/2d-weight/`, this page is 104 KB against the projected board's 146. A flat
// board offered as a MODE inside the other bundle would ask a school's connection for everything
// the 3D board needs and then not use it.

import type { BoardView, ViewContext, ViewFactory } from './view.ts';
import { AVAILABLE_SETS, DEFAULT_SET } from '../ui/piece-sets.ts';

export const createFlatView: ViewFactory = (ctx: ViewContext): BoardView => {
  const { mirror, region, prefs } = ctx;

  let setKey = prefs.remembered.set ?? DEFAULT_SET;
  let showCoordinates = prefs.remembered.coordinates ?? true;

  region.appendChild(mirror.root);
  // Turned round when you are black, so your own men are the ones nearest you. The rotation is on
  // the ELEMENT, not on the DOM order: the grid keeps its rows and columns, so arrow keys, the
  // reading order and every label go on meaning what they meant.
  mirror.root.dataset.flipped = ctx.playerSide === 'b' ? 'true' : '';
  region.dataset.coords = showCoordinates ? 'on' : '';

  return {
    hudControls: {
      // The face's own name, not an i18n key: a typeface is a proper noun.
      pieceSets: AVAILABLE_SETS.map((set) => ({ key: set.key, label: set.label })),
      pieceSet: () => setKey,
      onPieceSet: (key) => {
        setKey = key;
        mirror.setPieceSet(key);
        prefs.save({ set: key });
      },
      coordinates: () => showCoordinates,
      onCoordinates: (on) => {
        showCoordinates = on;
        region.dataset.coords = on ? 'on' : '';
        prefs.save({ coordinates: on });
      },
    },

    applyTheme: (key) => { mirror.setTheme(key); },

    /*
     * ⚠️ EMPTY, AND NOT BY OVERSIGHT. The shell refreshes the mirror before calling this, and on
     * this page the mirror IS the board — so the position is already drawn, complete, by the time
     * control arrives here.
     *
     * `hidden` and `travelling` go unread for the same reason. They exist for a view that flies
     * the ORIGINAL piece and must not draw it at both ends; `grid-mirror.animate` flies a CLONE of
     * the glyph standing on `to`, so the destination must be occupied before the flight starts.
     * Withholding it here would leave nothing to clone and the flight would silently not happen.
     */
    drawPosition: () => { /* the mirror is the board, and the shell has already refreshed it */ },

    // No marker channel: `grid-mirror.refresh()` derives its own from the state and writes them as
    // `data-mark` AND into the label, because a legal move is a marked cell and a named one.
    drawMarks: (_markers, hints) => { mirror.setHints(hints); },

    travel: (from, to) => mirror.animate(from, to, { reducedMotion: ctx.reducedMotion() }),

    // The engine's `applyLayout` sizes the region, and the board is CSS inside it. Nothing here
    // measures anything.
    relayout: () => { /* CSS owns the flat board's size */ },

    debug: () => ({
      board: mirror,
      setPieceSet: (key: string) => { setKey = key; mirror.setPieceSet(key); },
      setTheme: (key: string) => { mirror.setTheme(key); },
    }),

    destroy: () => { mirror.destroy(); },
  };
};
