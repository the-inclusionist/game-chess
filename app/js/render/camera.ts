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

    drag(dx, dy) {
      yaw = wrapYaw(yaw + dx * DRAG_SENSITIVITY);
      // Dragging DOWN flattens the view, which is what pulling the near edge towards you does.
      pitch = clampPitch(pitch + dy * DRAG_SENSITIVITY);
      return snapshot();
    },

    nudge(direction) {
      if (direction === 'left') yaw = wrapYaw(yaw - NUDGE_YAW);
      else if (direction === 'right') yaw = wrapYaw(yaw + NUDGE_YAW);
      else if (direction === 'up') pitch = clampPitch(pitch - NUDGE_PITCH);
      else pitch = clampPitch(pitch + NUDGE_PITCH);
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
