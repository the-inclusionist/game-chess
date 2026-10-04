// SPDX-License-Identifier: AGPL-3.0-or-later
// render/board — the 64 squares, their markers, and the corners picking reads.
//
// The arithmetic lives in `board-geometry`; this file is wiring. It owns three node arrays of 64,
// built once and mutated in place: churning the Zdog graph on every selection would re-sort a
// tree that has not structurally changed.

import Zdog, { type Anchor, type Rect, type Shape } from 'zdog';
import type { Square } from '../chess/types.ts';
import {
  isLightSquare, squareCenter, squareFromIndex, squareIndex, type Marker,
} from './board-geometry.ts';

// Re-exported so every existing importer keeps working; the union itself lives in the leaf.
export type { Marker } from './board-geometry.ts';
import {
  DEFAULT_PALETTE, MARKER_CAPTURE, MARKER_CHECK, MARKER_LESSON, MARKER_LESSON_HALO,
  MARKER_LESSON_RIGHT, MARKER_LESSON_WRONG,
  MARKER_CURSOR, MARKER_MOVE, MARKER_SELECTED,
  type Palette, SQUARE_STROKE,
} from './palette.ts';
import type { Quad } from './picking.ts';
import { TILE } from './resolution.ts';

export const SQUARE_COUNT = 64;

/**
 * How far markers float above the board plane, in Zdog units. Negative because Zdog's Y points
 * down. Enough to sort in front of the square, small enough not to read as a hovering object.
 */
const MARKER_LIFT = -0.5;


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
  /**
   * The marks, plus WHERE THE CURSOR IS — a second argument rather than another entry in the map,
   * because it is a different channel and not a competing mark.
   *
   * ⚠️ THE MAP HOLDS ONE KIND PER SQUARE, so while the cursor lived in it, it could only appear on
   * a square that said nothing else. The moment a player walked onto a square lit as a legal move,
   * the cursor VANISHED — the Dev's report of 2026-10-04, and the reason this board was hard to
   * walk about on while the flat one was not. The flat board never had the problem because it
   * carries its marks on the mirror's own attributes and can say two things at once.
   */
  setMarkers(markers: ReadonlyMap<number, Marker>, cursor?: Square | null): void;
  /**
   * The engine's suggestions, best first, drawn as arrows across the board.
   *
   * A CHANNEL OF ITS OWN rather than more `Marker`s, and for a reason worth keeping: a marker map
   * holds one thing per square, and a hint is not about squares. Three pieces can all be able to
   * take on d4, and three marks on d4 cannot say who is being asked to go there. The arrow can.
   */
  clearMarkers(): void;
  /** Recolours the 64 squares in place. Cheaper than rebuilding, and keeps the markers. */
  setPalette(palette: Palette): void;
}

/**
 * ⚠️ `Exclude<..., 'lesson'>` RATHER THAN `Record<Marker, …>`, and it is doing work: a lesson mark
 * has no ring at all, so giving it a ring colour here would be an entry nothing could ever read.
 * Written this way, `tsc` refuses the day somebody removes the early return in `setMarkers` — the
 * lookup stops compiling instead of quietly drawing the wrong shape.
 */
// ⚠️ `aim` is in here to satisfy the exhaustive Record and nothing reads it: an aim is a CROSS,
// drawn by `drawAim`, and never an outline. `tsc` refusing the day a marker is added is the point
// of the type — see the note on this record below.
const OUTLINE_COLOUR: Record<Exclude<Marker, 'lesson' | 'lessonRight' | 'lessonWrong'>, string> = {
  cursor: MARKER_CURSOR,
  move: MARKER_MOVE,
  capture: MARKER_CAPTURE,
  selected: MARKER_SELECTED,
  check: MARKER_CHECK,
  aim: MARKER_SELECTED,
};

export function createBoard(parent: Anchor, initial: Palette = DEFAULT_PALETTE): BoardView {
  const anchor = new Zdog.Anchor({ addTo: parent });
  let palette = initial;

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
      color: isLightSquare(square) ? palette.squareLight : palette.squareDark,
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

  /**
   * ⚠️ Built when asked and thrown away, rather than kept hidden in the graph. Zdog re-flattens
   * and re-sorts every shape each frame — the measured budget is 450 shapes in 1.44 ms — and a
   * hint is on screen for seconds of a whole match. Six shapes when asked and none otherwise.
   */
  /*
   * ========================= ⚠️ THE HINT ARROWS ARE NOT HERE ANY MORE =========================
   * They were Zdog shapes on this anchor until 2026-10-04, and they came out HALVED. Zdog is a
   * painter: every shape gets ONE sort value, so a shaft crossing several squares is entirely in
   * front of or entirely behind each of them, and the squares nearer the camera are painted after
   * it — taking the tail with them. Measured: shaft from z = 34.6 to z = 9.6, mean 22; the rank-2
   * square sits at z = 40, is painted later, and swallows half the arrow.
   *
   * Lifting them above every square's sort value does make them whole, and was tried: they then
   * float, and the parallax moves them off the squares they name — by an amount that CHANGES WITH
   * THE CAMERA, so no fixed height is right at more than one angle.
   *
   * They live in `ui/hint-overlay.ts` now, drawn in SVG over the canvas and positioned from this
   * board's own projection — the same thing `ui/coordinates.ts` does with the file letters, for
   * the same reason and by the same affine argument. Nothing in this file draws them, and nothing
   * should: a painter cannot order half a shape.
   */

  /*
   * ⚠️ ON DEMAND, FOR THE REASON THE HINT ANCHOR GIVES ABOVE, and more so. A lesson lights two or
   * three squares at a time; keeping two hidden shapes on all sixty-four would add 128 to a graph
   * Zdog re-flattens and re-sorts every frame, to draw at most six of them. Built when asked and
   * emptied otherwise.
   */
  const lessonAnchor = new Zdog.Anchor({ addTo: anchor });

  /*
   * ⚠️ ON DEMAND, AND FOR THE RULE THIS FILE ALREADY STATES TWICE ABOVE. Zdog re-flattens and
   * re-sorts every shape in the graph each frame — the measured budget is 450 shapes in 1.44 ms —
   * so sixty-four hidden cursor rings would be 64 shapes of standing cost to draw exactly ONE.
   *
   * ⚠️ AND IT IS ITS OWN SHAPE RATHER THAN THE SQUARE'S `outlines[i]`, which is the real reason
   * this exists. Each square owns one dot and one outline: `move` wants the dot, `capture`,
   * `selected` and `check` want the outline. A cursor that borrowed the outline would be silenced
   * by any of those three — which is the defect, one layer further down, that putting the cursor
   * in the marker map produced one layer up.
   */
  const cursorAnchor = new Zdog.Anchor({ addTo: anchor });

  /*
   * ⚠️ ON DEMAND, like the hints, the lessons and the cursor above, and for the same measured
   * reason. At most ONE square is aimed at a time, so two bars built when asked beat 128 hidden
   * ones in a graph Zdog re-flattens every frame.
   */
  const aimAnchor = new Zdog.Anchor({ addTo: anchor });

  /** The aim: a cross dividing the square into four, the Dev's form for "I am going HERE". */
  function drawAim(index: number): void {
    const { x, z } = squareCenter(squareFromIndex(index), TILE);
    const BAR = TILE * 0.09;
    for (const [w, h] of [[TILE * 0.92, BAR], [BAR, TILE * 0.92]] as const) {
      new Zdog.Rect({
        addTo: aimAnchor,
        width: w,
        height: h,
        translate: { x, y: MARKER_LIFT, z },
        rotate: { x: Zdog.TAU / 4 },
        stroke: SQUARE_STROKE,
        color: MARKER_SELECTED,
        fill: true,
        backface: true,
      });
    }
  }

  /**
   * The lesson mark: an inner filled square inside a black halo.
   *
   * ⚠️ THE HALO IS WHAT SATISFIES 1.4.11 — see the long note in `palette.ts`. No hue clears 3:1
   * against both the light square and the high-contrast dark grey, so the boundary is carried by
   * black and the amber only has to read against the black. Removing the halo to tidy this up
   * removes the accessibility of the mark, silently.
   *
   * And the FORM is what satisfies 1.4.1: a filled inner square is not the ring that `selected`
   * and `capture` draw, so a square that is both "look here" and "you may capture here" still says
   * two distinguishable things.
   */
  const LESSON_INK: Record<'lesson' | 'lessonRight' | 'lessonWrong', string> = {
    lesson: MARKER_LESSON,
    lessonRight: MARKER_LESSON_RIGHT,
    lessonWrong: MARKER_LESSON_WRONG,
  };

  function drawLesson(index: number, kind: 'lesson' | 'lessonRight' | 'lessonWrong'): void {
    const { x, z } = squareCenter(squareFromIndex(index), TILE);
    /*
     * ⚠️ `lessonWrong` IS HOLLOW AND THE OTHER TWO ARE FILLED, and that is not decoration. Blue and
     * red measure 1.06:1 against each other — see `palette.ts` — so a reader going by lightness
     * rather than hue sees ONE mark where there are two. The fill is what actually separates
     * "that was right" from "that was wrong"; the colour only makes it quicker for whoever can use
     * it. WCAG 1.4.1.
     */
    const filled = kind !== 'lessonWrong';
    for (const [size, colour, fill] of [
      [TILE * 0.60, MARKER_LESSON_HALO, filled],
      [TILE * 0.52, LESSON_INK[kind], filled],
    ] as const) {
      new Zdog.Rect({
        addTo: lessonAnchor,
        width: size,
        height: size,
        translate: { x, y: MARKER_LIFT, z },
        rotate: { x: Zdog.TAU / 4 },
        // A hollow ring needs a visible line; a filled square only needs its edge closed.
        stroke: fill ? SQUARE_STROKE : SQUARE_STROKE * 2.5,
        color: colour,
        fill,
        backface: true,
      });
    }
  }

  function hideAll(): void {
    for (let i = 0; i < SQUARE_COUNT; i++) {
      dots[i].visible = false;
      outlines[i].visible = false;
    }
    lessonAnchor.children = [];
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

    setMarkers(markers, cursor) {
      hideAll();
      cursorAnchor.children = [];
      aimAnchor.children = [];
      for (const [index, kind] of markers) {
        if (index < 0 || index >= SQUARE_COUNT) continue;
        // ⚠️ A lesson mark is neither a dot nor a ring, so it leaves both of those alone. That is
        // what lets the game speak over it: the map holds one kind per square, and `syncMarkers`
        // writes the lesson first so a square that is also a legal target ends up saying the more
        // useful of the two.
        if (kind === 'lesson' || kind === 'lessonRight' || kind === 'lessonWrong') {
          drawLesson(index, kind);
          continue;
        }
        // ⚠️ Like a lesson mark and unlike the rest: its own shape, so it leaves the square's dot
        // and outline alone rather than competing for them.
        if (kind === 'aim') {
          drawAim(index);
          continue;
        }
        const showDot = kind === 'move' || kind === 'selected';
        const showOutline = kind !== 'move';
        dots[index].visible = showDot;
        dots[index].color = kind === 'selected' ? MARKER_SELECTED : MARKER_MOVE;
        outlines[index].visible = showOutline;
        outlines[index].color = OUTLINE_COLOUR[kind];
      }

      /*
       * ⚠️ AFTER THE LOOP AND UNCONDITIONAL, so "this square is a legal move" can never silence
       * "this is where you are". Wider than the square's own outline (0.96 of a tile against
       * 0.84), which is what keeps the two readable when they land together.
       */
      if (cursor) {
        const { x, z } = squareCenter(cursor, TILE);
        new Zdog.Rect({
          addTo: cursorAnchor,
          width: TILE * 0.96,
          height: TILE * 0.96,
          translate: { x, y: MARKER_LIFT, z },
          rotate: { x: Zdog.TAU / 4 },
          stroke: SQUARE_STROKE * 3,
          color: OUTLINE_COLOUR.cursor,
          fill: false,
          backface: true,
        });
      }
    },


    setPalette(next) {
      palette = next;
      for (let i = 0; i < SQUARE_COUNT; i++) {
        squares[i].color = isLightSquare(squareFromIndex(i))
          ? palette.squareLight
          : palette.squareDark;
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
