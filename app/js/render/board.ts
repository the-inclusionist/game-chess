// SPDX-License-Identifier: AGPL-3.0-or-later
// render/board — the 64 squares, their markers, and the corners picking reads.
//
// The arithmetic lives in `board-geometry`; this file is wiring. It owns three node arrays of 64,
// built once and mutated in place: churning the Zdog graph on every selection would re-sort a
// tree that has not structurally changed.

import Zdog, { type Anchor, type Rect, type Shape } from 'zdog';
import type { Square } from '../chess/types.ts';
import { isLightSquare, squareCenter, squareFromIndex, squareIndex } from './board-geometry.ts';
import {
  MARKER_CAPTURE, MARKER_CHECK, MARKER_MOVE, MARKER_SELECTED,
  SQUARE_DARK, SQUARE_LIGHT, SQUARE_STROKE,
} from './palette.ts';
import type { Quad } from './picking.ts';
import { TILE } from './resolution.ts';

export const SQUARE_COUNT = 64;

/**
 * How far markers float above the board plane, in Zdog units. Negative because Zdog's Y points
 * down. Enough to sort in front of the square, small enough not to read as a hovering object.
 */
const MARKER_LIFT = -0.5;

/**
 * ========================= SHAPE, NOT ONLY COLOUR =========================
 * WCAG 1.4.1: colour must never be the only carrier of meaning. So the three markers that
 * co-occur during a turn are told apart by FORM:
 *
 *   · `move`     — a filled dot in the middle of an empty destination
 *   · `capture`  — an outline ring around the square, with no dot
 *   · `selected` — outline AND dot together
 *
 * `check` is the exception, and it is an honest one: it is an outline like `capture`, on a square
 * that is never simultaneously a capture target for the side in check. Its primary channel is not
 * visual at all — it goes out through `srAlert`, assertively.
 */
export type Marker = 'selected' | 'move' | 'capture' | 'check';

export interface BoardView {
  /** The subtree to add to the scene. */
  readonly anchor: Anchor;
  /**
   * Projected corners of all 64 squares, for picking. Valid only after `updateGraph()` has run on
   * an ancestor — the points read here are the very ones the renderer is about to draw, so they
   * cannot drift from what is on screen.
   */
  quads(): Quad[];
  /** Replaces every marker at once. Absent squares are cleared. */
  setMarkers(markers: ReadonlyMap<number, Marker>): void;
  clearMarkers(): void;
}

const OUTLINE_COLOUR: Record<Marker, string> = {
  move: MARKER_MOVE,
  capture: MARKER_CAPTURE,
  selected: MARKER_SELECTED,
  check: MARKER_CHECK,
};

export function createBoard(parent: Anchor): BoardView {
  const anchor = new Zdog.Anchor({ addTo: parent });

  const squares: Rect[] = [];
  const dots: Shape[] = [];
  const outlines: Rect[] = [];

  for (let i = 0; i < SQUARE_COUNT; i++) {
    const square = squareFromIndex(i);
    const { x, z } = squareCenter(square, TILE);

    squares.push(new Zdog.Rect({
      addTo: anchor,
      width: TILE,
      height: TILE,
      translate: { x, z },
      // Lay the square flat: a Rect is built in the XY plane, so a quarter turn about X drops it
      // into the XZ plane the board occupies.
      rotate: { x: Zdog.TAU / 4 },
      stroke: SQUARE_STROKE,
      color: isLightSquare(square) ? SQUARE_LIGHT : SQUARE_DARK,
      fill: true,
      // Without this the far half of the board vanishes: the squares face one way, and half of
      // them present their back to the camera at any useful pitch.
      backface: true,
    }));

    dots.push(new Zdog.Shape({
      addTo: anchor,
      stroke: TILE * 0.32,
      color: MARKER_MOVE,
      translate: { x, y: MARKER_LIFT, z },
      visible: false,
    }));

    outlines.push(new Zdog.Rect({
      addTo: anchor,
      width: TILE * 0.84,
      height: TILE * 0.84,
      translate: { x, y: MARKER_LIFT, z },
      rotate: { x: Zdog.TAU / 4 },
      stroke: SQUARE_STROKE * 3,
      color: MARKER_SELECTED,
      fill: false,
      backface: true,
      visible: false,
    }));
  }

  function hideAll(): void {
    for (let i = 0; i < SQUARE_COUNT; i++) {
      dots[i].visible = false;
      outlines[i].visible = false;
    }
  }

  return {
    anchor,

    quads(): Quad[] {
      const out: Quad[] = new Array<Quad>(SQUARE_COUNT);
      for (let i = 0; i < SQUARE_COUNT; i++) {
        const commands = squares[i].pathCommands;
        const at = (n: number) => {
          const p = commands[n].endRenderPoint;
          return { x: p.x, y: p.y };
        };
        out[i] = { corners: [at(0), at(1), at(2), at(3)], depth: squares[i].sortValue };
      }
      return out;
    },

    setMarkers(markers) {
      hideAll();
      for (const [index, kind] of markers) {
        if (index < 0 || index >= SQUARE_COUNT) continue;
        const showDot = kind === 'move' || kind === 'selected';
        const showOutline = kind !== 'move';
        dots[index].visible = showDot;
        dots[index].color = kind === 'selected' ? MARKER_SELECTED : MARKER_MOVE;
        outlines[index].visible = showOutline;
        outlines[index].color = OUTLINE_COLOUR[kind];
      }
    },

    clearMarkers: hideAll,
  };
}

/** Convenience for callers holding a `Square` rather than an index. */
export function markersFor(entries: readonly (readonly [Square, Marker])[]): Map<number, Marker> {
  const map = new Map<number, Marker>();
  for (const [square, marker] of entries) map.set(squareIndex(square), marker);
  return map;
}
