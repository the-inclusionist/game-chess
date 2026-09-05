// SPDX-License-Identifier: AGPL-3.0-or-later
// render/animation — a piece crossing the board.
//
// ========================= dt IS IN FRAMES =========================
// The engine's loop passes `ticker.deltaTime`, which is Pixi's frame-normalised delta — about 1.0
// at 60 fps — clamped to 2. Not seconds. The engine's own note is blunt about why it matters:
// "physics copied from a seconds-based tutorial runs wrong". A move written for seconds would
// take several minutes here and report nothing; the board would simply look frozen.
//
// ========================= REDUCED MOTION IS NOT A SHORTER ANIMATION =========================
// It is no animation. The piece is already at its destination on the first frame, and `done()` is
// true before anything advances — so the state machine settles immediately rather than waiting out
// a duration nobody sees.

import { squareCenter } from './board-geometry.ts';
import { TILE } from './resolution.ts';
import type { Square } from '../chess/types.ts';

/** About a third of a second at 60 fps: fast enough not to be waited on, slow enough to follow. */
export const MOVE_FRAMES = 20;

/** Peak height of the arc, in Zdog units. Under a square's width, so it never reads as a jump. */
export const MOVE_LIFT = TILE * 0.45;

export interface MoveAnimationOptions {
  /** When true the piece is simply at its destination, from the first frame. */
  readonly reducedMotion?: boolean;
  readonly frames?: number;
}

export interface TravelPosition {
  readonly x: number;
  readonly z: number;
  /** Height above the board. NEGATIVE, because Zdog's Y points down. */
  readonly lift: number;
}

export interface MoveAnimation {
  /** Advances by `dt` FRAMES. Returns true while the piece is still travelling. */
  advance(dt: number): boolean;
  progress(): number;
  done(): boolean;
  position(): TravelPosition;
}

/** Ease in and out. Smooth at both ends, so the piece neither jerks off nor slams down. */
function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

export function createMoveAnimation(
  from: Square,
  to: Square,
  options: MoveAnimationOptions = {},
): MoveAnimation {
  const start = squareCenter(from, TILE);
  const end = squareCenter(to, TILE);
  const total = options.reducedMotion ? 0 : (options.frames ?? MOVE_FRAMES);

  let elapsed = total;   // overwritten below unless the duration is zero
  if (total > 0) elapsed = 0;

  const progress = (): number => (total <= 0 ? 1 : Math.min(1, elapsed / total));

  return {
    progress,
    done: () => progress() >= 1,

    advance(dt) {
      if (progress() >= 1) return false;
      elapsed = Math.min(total, elapsed + dt);
      return progress() < 1;
    },

    position() {
      const t = ease(progress());
      return {
        x: start.x + (end.x - start.x) * t,
        z: start.z + (end.z - start.z) * t,
        // A half sine: zero at both ends, peak in the middle. Negative is up.
        lift: -Math.sin(Math.PI * progress()) * MOVE_LIFT,
      };
    },
  };
}
