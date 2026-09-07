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

/*
 * ========================= HOW FAR THE ZOOM MAY GO =========================
 * A multiple of the framing measured in spike 0, not an absolute: the board's own zoom depends on
 * the canvas the stage was built at, and only the RATIO is a decision about how the game looks.
 *
 * ⚠️ PUSHING IN HAS A HARD STOP THE SOLID VIEW DOES NOT HAVE, because this camera cannot pan. A
 * rank that leaves the canvas cannot be clicked, and the only way back to it is to zoom out again.
 *
 * Both ends were measured on screen rather than chosen. At 0.72 a piece is about fifteen pixels
 * tall, which is as small as six silhouettes stay six. The near end is where every SQUARE is still
 * inside the canvas at the default pitch; the tallest pieces touch the top edge there, and that is
 * the accepted part — a king's finial clipped costs nothing, a square you cannot click costs a
 * move.
 *
 * The step is a FACTOR, so a notch feels the same close up and far away, and in-then-out lands
 * exactly where it started. It is the same 1.1 the solid view uses, because they are one control
 * reached two ways and a player who learns it on one board must find it on the other.
 */
/*
 * ========================= ⚠️ WHY THIS NUMBER MOVED TWICE IN ONE EVENING =========================
 * It was framed for a canvas that reserved 27.5% of itself for a HUD drawn inside it. The teaching
 * mode moved that HUD out to a DOM sibling and nobody re-measured, so the board went on being
 * drawn for two thirds of the canvas it had. Three readings, in the order they were taken:
 *
 *   640x360, framed for the old HUD column:        258x217 — 40% of the width
 *   640x360, ceiling raised as far as it would go:  18% more, and no further
 *   360x360, square, this ceiling:                  92% of the width, all 64 squares inside
 *
 * ⚠️ THE SECOND READING IS THE ONE THAT MATTERED. The zoom was pushed to its measured limit and
 * the board still used less than half the canvas — which is what said the framing was never the
 * problem. A square board cannot fill a 16:9 raster at ANY zoom, and no amount of adjusting this
 * number was going to make it. The canvas shape was the answer; this number only became worth
 * touching once that changed.
 *
 * So the ceiling moved with the canvas and had to. 1.18 was where the eighth rank left a 640x360
 * raster, bound by its HEIGHT — which is exactly why raising the zoom never bought any width. The
 * raster is square now, the width binds instead, and the board reaches it at about 1.42 with
 * fourteen pixels either side.
 *
 * ⚠️ AND IT STOPS SHORT OF THE CEILING ON PURPOSE — see `ZOOM_DEFAULT` below.
 *
 * What is left is a 640x360 canvas holding a board whose projection is about as wide as it is
 * tall: roughly 300x255 of it used, and the rest letterboxed. Closing that needs a decision nobody
 * has made — a flatter pitch, a taller canvas, or accepting the letterbox — and it is recorded in
 * the interface review rather than guessed at here.
 */
export const ZOOM_NEAREST = 1.42;
export const ZOOM_FARTHEST = 0.72;
export const ZOOM_STEP = 1.1;
/*
 * ⚠️ EXACTLY ONE NOTCH BELOW THE CEILING, AND WRITTEN AS THAT RATHER THAN AS A NUMBER. Any closer
 * and a notch IN hits the clamp, so the notch back OUT lands somewhere else — and "in then out
 * returns exactly where it started" is a property this camera's own comment promises and
 * `tests/camera.node.test.ts` checks. 1.12 broke it; the test said so within seconds.
 *
 * So the board gains what the framing can actually give it — about seven per cent — and the wheel
 * still works in both directions from where a player finds it.
 */
export const ZOOM_DEFAULT = ZOOM_NEAREST / ZOOM_STEP;

/** Radians per canvas pixel: dragging the full 320 px width turns half a circle. */
export const DRAG_SENSITIVITY = Math.PI / 320;

/**
 * ========================= HOW LONG A PRESS HAS TO BE BEFORE IT TURNS =========================
 * One second, and the number is not about the mechanism — it was two, and a second of waiting for
 * a gesture you meant is a long time to spend proving you meant it. A board that starts turning on the first
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
export const ROTATE_HOLD_MS = 1000;

export interface CameraState {
  readonly pitch: number;
  readonly yaw: number;
  /** A multiple of the stage's own framing. 1 is the framing measured in spike 0. */
  readonly zoom: number;
}

export type NudgeDirection = 'left' | 'right' | 'up' | 'down';

export interface Camera {
  /**
   * Applies a drag, in CANVAS pixels — not CSS pixels. The caller divides by the upscale factor
   * first, so sensitivity does not change with the size of the window.
   */
  drag(dx: number, dy: number): CameraState;
  nudge(direction: NudgeDirection): CameraState;
  /** Zooms, in wheel notches: NEGATIVE is closer, which is the sign a wheel reports. */
  dolly(notches: number): CameraState;
  set(state: Partial<CameraState>): CameraState;
  reset(): CameraState;
  snapshot(): CameraState;
}

export function clampPitch(pitch: number): number {
  return Math.min(PITCH_SHALLOWEST, Math.max(PITCH_STEEPEST, pitch));
}

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_NEAREST, Math.max(ZOOM_FARTHEST, zoom));
}

/** Normalises a turn into (-π, π], so a player spinning the board forever cannot drift a float. */
export function wrapYaw(yaw: number): number {
  const turn = Math.PI * 2;
  const v = ((yaw % turn) + turn) % turn; // [0, 2π)
  return v > Math.PI ? v - turn : v;
}

export function createCamera(initial: Partial<CameraState> = {}): Camera {
  let pitch = clampPitch(initial.pitch ?? PITCH_DEFAULT);
  let yaw = wrapYaw(initial.yaw ?? 0);
  let zoom = clampZoom(initial.zoom ?? ZOOM_DEFAULT);

  const snapshot = (): CameraState => ({ pitch, yaw, zoom });

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

    /**
     * ⚠️ NEGATIVE IS CLOSER, which reads backwards and is what a wheel reports: `deltaY` is
     * positive when the wheel turns the way that scrolls a page DOWN, and every application on the
     * machine treats that as zooming out. Flipping it here would make this board the odd one.
     */
    dolly(notches) {
      zoom = clampZoom(zoom * ZOOM_STEP ** -notches);
      return snapshot();
    },

    set(state) {
      pitch = clampPitch(state.pitch ?? pitch);
      yaw = wrapYaw(state.yaw ?? yaw);
      zoom = clampZoom(state.zoom ?? zoom);
      return snapshot();
    },

    reset() {
      pitch = PITCH_DEFAULT;
      yaw = 0;
      zoom = ZOOM_DEFAULT;
      return snapshot();
    },
  };
}
