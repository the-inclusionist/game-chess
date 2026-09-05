// SPDX-License-Identifier: AGPL-3.0-or-later
// render/camera — where the viewer stands, and the two limits that matter.
//
// No DOM here: this is state and arithmetic, so it runs in the node project. The pointer and key
// listeners live in the composition root, which is also the only place that knows the canvas is
// displayed at an integer multiple of its resolution.
//
// ========================= WHY THE PITCH IS CLAMPED =========================
// Not for looks. At pitch 0 the board lies in the view plane and every square projects to a LINE.
// `picking` rejects degenerate quads by design, so the board would simply stop responding to
// clicks — with no error, no warning and nothing on screen to explain it. The clamp is what makes
// that state unreachable, and the area guard in `picking` is the backstop if it ever is reached.
//
// ========================= WHY NUDGE EXISTS =========================
// WCAG 2.5.7 and the engine's own rule: nothing may require a drag. The camera is the only thing
// in this game that otherwise would. `nudge` is the same movement, one step at a time, and the
// step divides a quarter turn exactly — so a player using the keyboard can square the board up
// instead of landing near it.

/** Straight down. Past this the board would start turning over. */
export const PITCH_STEEPEST = -Math.PI / 2;

/**
 * The shallowest view allowed. Chosen so a square keeps roughly 40 % of its face-on height —
 * flat enough to feel like a real board seen from a chair, far enough from edge-on to stay
 * clickable.
 */
export const PITCH_SHALLOWEST = -0.42;

/** The framing measured in spike 0. */
export const PITCH_DEFAULT = -1;

/** A quarter turn is exactly 12 nudges, so the keyboard can square the board up. */
export const NUDGE_YAW = Math.PI / 24;
export const NUDGE_PITCH = Math.PI / 36;

/** Radians per canvas pixel: dragging the full 320 px width turns half a circle. */
export const DRAG_SENSITIVITY = Math.PI / 320;

/**
 * ========================= HOW LONG A PRESS HAS TO BE BEFORE IT TURNS =========================
 * Two seconds, and the number is not about the mechanism. A board that starts turning on the first
 * pixel of movement turns while a teacher is pointing at a square in front of a class — the
 * gesture for "look here" and the gesture for "spin the board" were the same one, and only one of
 * them was ever wanted mid-lesson.
 *
 * So turning is a DELIBERATE act now: hold, and then drag. A press shorter than this is a click on
 * a square, whatever it did in between.
 *
 * ⚠️ The keyboard is untouched and stays immediate. `nudge` requires no press and no hold, which is
 * both WCAG 2.5.7 — nothing may require a drag — and the reason a delay is affordable here: the
 * player who cannot wait two seconds on a button already has the faster path.
 */
export const ROTATE_HOLD_MS = 2000;

export interface CameraState {
  readonly pitch: number;
  readonly yaw: number;
}

export type NudgeDirection = 'left' | 'right' | 'up' | 'down';

export interface Camera {
  /**
   * Applies a drag, in CANVAS pixels — not CSS pixels. The caller divides by the upscale factor
   * first, so sensitivity does not change with the size of the window.
   */
  drag(dx: number, dy: number): CameraState;
  nudge(direction: NudgeDirection): CameraState;
  set(state: CameraState): CameraState;
  reset(): CameraState;
  snapshot(): CameraState;
}

export function clampPitch(pitch: number): number {
  return Math.min(PITCH_SHALLOWEST, Math.max(PITCH_STEEPEST, pitch));
}

/** Normalises a turn into (-π, π], so a player spinning the board forever cannot drift a float. */
export function wrapYaw(yaw: number): number {
  const turn = Math.PI * 2;
  const v = ((yaw % turn) + turn) % turn; // [0, 2π)
  return v > Math.PI ? v - turn : v;
}

export function createCamera(initial: CameraState = { pitch: PITCH_DEFAULT, yaw: 0 }): Camera {
  let pitch = clampPitch(initial.pitch);
  let yaw = wrapYaw(initial.yaw);

  const snapshot = (): CameraState => ({ pitch, yaw });

  return {
    snapshot,

    /**
     * ========================= THE HAND MOVES THE BOARD, NOT THE CAMERA =========================
     * Both signs are negative, and both were positive. The difference is which of two mental
     * models the gesture belongs to: dragging can move the VIEWER around a fixed board, or move
     * the BOARD under a fixed viewer. They are opposites, and only one of them is what a hand on a
     * physical board does.
     *
     * Dragging right turns the board anticlockwise, the way a hand pushing the near edge to the
     * right would. Dragging down tips the near edge DOWN and the far edge up, so more of the top
     * surface comes into view — the way you tilt a board towards yourself to see the squares.
     */
    drag(dx, dy) {
      yaw = wrapYaw(yaw - dx * DRAG_SENSITIVITY);
      pitch = clampPitch(pitch - dy * DRAG_SENSITIVITY);
      return snapshot();
    },

    /**
     * ⚠️ The keyboard follows the pointer, because they are one control in two ways of reaching it.
     * Left and right were flipped with the drag: a player who learns the board turns THIS way with
     * a hand must not find it turns the other way with a key. `up` and `down` name the direction
     * the near edge moves, which is the same thing the drag now does.
     */
    nudge(direction) {
      if (direction === 'left') yaw = wrapYaw(yaw + NUDGE_YAW);
      else if (direction === 'right') yaw = wrapYaw(yaw - NUDGE_YAW);
      else if (direction === 'up') pitch = clampPitch(pitch + NUDGE_PITCH);
      else pitch = clampPitch(pitch - NUDGE_PITCH);
      return snapshot();
    },

    set(state) {
      pitch = clampPitch(state.pitch);
      yaw = wrapYaw(state.yaw);
      return snapshot();
    },

    reset() {
      pitch = PITCH_DEFAULT;
      yaw = 0;
      return snapshot();
    },
  };
}
