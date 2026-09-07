// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  clampPitch, createCamera, PITCH_DEFAULT, PITCH_SHALLOWEST, PITCH_STEEPEST, wrapYaw, ZOOM_DEFAULT,
  ZOOM_STEP,
  ZOOM_NEAREST,
  ZOOM_FARTHEST,
} from '../app/js/render/camera.ts';

describe('[Pitch] the board is never allowed to go edge-on', () => {
  // At pitch 0 the board lies in the view plane and every square projects to a LINE. Picking
  // rejects degenerate quads, so the board would simply stop responding — no error, no clue.
  // The clamp is what makes that state unreachable in the first place.
  it('never returns a pitch shallower than the limit', () => {
    for (const p of [0, 0.5, -0.01, -0.2, -PITCH_SHALLOWEST]) {
      expect(clampPitch(p), `from ${p}`).toBeLessThanOrEqual(PITCH_SHALLOWEST);
    }
  });

  it('never returns a pitch past straight down', () => {
    for (const p of [-10, -Math.PI, PITCH_STEEPEST - 1]) {
      expect(clampPitch(p), `from ${p}`).toBeGreaterThanOrEqual(PITCH_STEEPEST);
    }
  });

  it('leaves a pitch inside the range alone', () => {
    expect(clampPitch(-1)).toBeCloseTo(-1, 12);
    expect(clampPitch(PITCH_DEFAULT)).toBeCloseTo(PITCH_DEFAULT, 12);
  });

  it('keeps the default comfortably inside its own limits', () => {
    expect(PITCH_DEFAULT).toBeLessThan(PITCH_SHALLOWEST);
    expect(PITCH_DEFAULT).toBeGreaterThan(PITCH_STEEPEST);
  });

  it('leaves the shallowest angle far enough from edge-on to be usable', () => {
    // A square seen at this angle keeps a usable fraction of its face-on height.
    expect(Math.abs(Math.sin(PITCH_SHALLOWEST))).toBeGreaterThan(0.3);
  });
});

describe('[Yaw] turns freely and stays bounded', () => {
  it('wraps into (-π, π]', () => {
    expect(wrapYaw(0)).toBeCloseTo(0, 12);
    expect(wrapYaw(Math.PI * 3)).toBeCloseTo(Math.PI, 12);
    expect(wrapYaw(-Math.PI * 3)).toBeCloseTo(Math.PI, 12);
    expect(wrapYaw(Math.PI * 2 + 0.5)).toBeCloseTo(0.5, 12);
  });

  it('keeps repeated turns bounded rather than accumulating forever', () => {
    const cam = createCamera();
    for (let i = 0; i < 200; i++) cam.drag(50, 0);
    expect(Math.abs(cam.snapshot().yaw)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });
});

describe('[Drag] the two axes stay separate', () => {
  it('a horizontal drag turns without tilting', () => {
    const cam = createCamera();
    const before = cam.snapshot();
    cam.drag(40, 0);
    const after = cam.snapshot();
    expect(after.pitch).toBeCloseTo(before.pitch, 12);
    expect(after.yaw).not.toBeCloseTo(before.yaw, 6);
  });

  it('a vertical drag tilts without turning', () => {
    const cam = createCamera();
    const before = cam.snapshot();
    cam.drag(0, 30);
    const after = cam.snapshot();
    expect(after.yaw).toBeCloseTo(before.yaw, 12);
    expect(after.pitch).not.toBeCloseTo(before.pitch, 6);
  });

  it('dragging DOWN tips the near edge down, showing more of the top', () => {
    // ⚠️ Both drag axes were inverted, and the reason is which mental model the gesture belongs
    // to: dragging can move the VIEWER around a fixed board or move the BOARD under a fixed
    // viewer. Those are opposites, and only the second is what a hand on a physical board does.
    //
    // Pulling down tips the near edge towards you, so more of the top surface comes into view —
    // a STEEPER pitch, which is a more negative number here.
    const down = createCamera();
    down.drag(0, 40);
    const up = createCamera();
    up.drag(0, -40);
    expect(down.snapshot().pitch).toBeLessThan(PITCH_DEFAULT);
    expect(up.snapshot().pitch).toBeGreaterThan(PITCH_DEFAULT);
  });

  it('dragging RIGHT turns the board the way a hand on its near edge would', () => {
    const right = createCamera();
    right.drag(40, 0);
    const left = createCamera();
    left.drag(-40, 0);
    expect(right.snapshot().yaw).toBeLessThan(left.snapshot().yaw);
  });

  it('cannot be dragged out of range however hard it is pushed', () => {
    const cam = createCamera();
    for (let i = 0; i < 100; i++) cam.drag(0, 200);
    expect(cam.snapshot().pitch).toBeLessThanOrEqual(PITCH_SHALLOWEST);
    for (let i = 0; i < 200; i++) cam.drag(0, -200);
    expect(cam.snapshot().pitch).toBeGreaterThanOrEqual(PITCH_STEEPEST);
  });

  it('a zero drag changes nothing', () => {
    const cam = createCamera();
    const before = cam.snapshot();
    cam.drag(0, 0);
    expect(cam.snapshot()).toEqual(before);
  });
});

describe('[Keyboard] no action requires a drag', () => {
  // WCAG 2.5.7 and the engine's own rule: everything reachable by pointer must be reachable
  // without one. The camera is the only thing here that would otherwise be drag-only.
  it('nudges in all four directions, the SAME way the drag does', () => {
    // ⚠️ The keyboard follows the pointer because they are one control reached two ways. A player
    // who learns the board turns this way with a hand must not find it turns the other way with a
    // key — so both were flipped together, and this test is what stops one of them drifting back.
    const left = createCamera();
    left.nudge('left');
    const right = createCamera();
    right.nudge('right');
    expect(right.snapshot().yaw).toBeLessThan(left.snapshot().yaw);

    const up = createCamera();
    up.nudge('up');
    const down = createCamera();
    down.nudge('down');
    expect(down.snapshot().pitch).toBeLessThan(up.snapshot().pitch);
  });

  it('agrees with the drag on every axis', () => {
    const dragged = createCamera();
    dragged.drag(10, 10);
    const nudged = createCamera();
    nudged.nudge('right');
    nudged.nudge('down');
    // Same sign on both axes: the two controls describe the same movement.
    expect(Math.sign(dragged.snapshot().yaw)).toBe(Math.sign(nudged.snapshot().yaw));
    expect(dragged.snapshot().pitch).toBeLessThan(PITCH_DEFAULT);
    expect(nudged.snapshot().pitch).toBeLessThan(PITCH_DEFAULT);
  });

  it('respects the same clamp as dragging', () => {
    const cam = createCamera();
    for (let i = 0; i < 100; i++) cam.nudge('down');
    expect(cam.snapshot().pitch).toBeLessThanOrEqual(PITCH_SHALLOWEST);
  });

  it('takes a whole number of nudges to turn a quarter, so the board squares up', () => {
    const cam = createCamera();
    const step = Math.abs(createCamera().nudge('right').yaw);
    expect(Number.isInteger(Math.round((Math.PI / 2) / step))).toBe(true);
    expect(Math.abs((Math.PI / 2) / step - Math.round((Math.PI / 2) / step))).toBeLessThan(1e-9);
    cam.reset();
    expect(cam.snapshot()).toEqual({ pitch: PITCH_DEFAULT, yaw: 0, zoom: ZOOM_DEFAULT });
  });
});

describe('[Reset] returns to the framing spike 0 measured', () => {
  it('goes back to the default after any amount of movement', () => {
    const cam = createCamera();
    cam.drag(123, -45);
    cam.nudge('left');
    cam.reset();
    expect(cam.snapshot()).toEqual({ pitch: PITCH_DEFAULT, yaw: 0, zoom: ZOOM_DEFAULT });
  });
});

describe('[Zoom] the wheel comes closer, within limits', () => {
  it('reads a wheel the way every other application does', () => {
    // ⚠️ `deltaY` is POSITIVE when the wheel turns the way that scrolls a page down, and every
    // application on the machine treats that as zooming OUT. The sign is passed straight through,
    // so this is the assertion that stops someone "fixing" it into the odd one out.
    const cam = createCamera();
    expect(cam.dolly(+1).zoom).toBeLessThan(ZOOM_DEFAULT);
    cam.reset();
    expect(cam.dolly(-1).zoom).toBeGreaterThan(ZOOM_DEFAULT);
  });

  it('comes back exactly on a notch out, because the step is a factor', () => {
    // In-then-out is a multiplication by a reciprocal, which is the property that makes a notch
    // feel the same close up and far away. A step measured in units would fail this by
    // construction, and a board that drifts a little on every pair of notches is worse than one
    // that does not zoom.
    const cam = createCamera();
    cam.dolly(-1);
    expect(cam.dolly(+1).zoom).toBeCloseTo(ZOOM_DEFAULT, 12);
    /*
     * ⚠️ `ZOOM_DEFAULT * ZOOM_STEP`, NOT `ZOOM_STEP`. Written as the bare step this quietly assumed
     * the default was exactly 1 — true when it was written, and a copy of the data rather than the
     * property. The property is that one notch in multiplies by the step, whatever the default is.
     */
    expect(cam.dolly(-1).zoom).toBeCloseTo(ZOOM_DEFAULT * ZOOM_STEP, 12);
  });

  it('stops at both ends however long the wheel is turned', () => {
    const cam = createCamera();
    for (let i = 0; i < 200; i++) cam.dolly(-1);
    expect(cam.snapshot().zoom).toBe(ZOOM_NEAREST);
    for (let i = 0; i < 400; i++) cam.dolly(+1);
    expect(cam.snapshot().zoom).toBe(ZOOM_FARTHEST);
  });

  it('keeps the near limit tighter than the far one, because this board does not pan', () => {
    // Zoom in and the far files leave the canvas with no way to reach them but zooming out again.
    // Zoom out and the board only gets smaller, which is recoverable by looking closer.
    expect(ZOOM_NEAREST - ZOOM_DEFAULT).toBeLessThan(ZOOM_DEFAULT - ZOOM_FARTHEST + 1);
    expect(ZOOM_NEAREST).toBeGreaterThan(ZOOM_DEFAULT);
    expect(ZOOM_FARTHEST).toBeLessThan(ZOOM_DEFAULT);
  });

  it('leaves the turn alone, and the turn leaves it alone', () => {
    // Two independent controls on one gesture. A player who zooms in and then turns the board must
    // not find the zoom has crept, or they end up somewhere they never asked to be.
    const cam = createCamera();
    cam.dolly(-3);
    const zoomed = cam.snapshot();
    cam.drag(80, -30);
    cam.nudge('left');
    expect(cam.snapshot().zoom).toBe(zoomed.zoom);

    cam.reset();
    cam.drag(80, -30);
    const turned = cam.snapshot();
    cam.dolly(-2);
    expect(cam.snapshot().pitch).toBe(turned.pitch);
    expect(cam.snapshot().yaw).toBe(turned.yaw);
  });

  it('accepts a partial state without forgetting the rest of itself', () => {
    // `set` takes what a caller knows and keeps what it does not. Restoring a saved pitch used to
    // mean restoring a zoom nobody had saved.
    const cam = createCamera({ zoom: 1.1 });
    cam.set({ yaw: 1 });
    expect(cam.snapshot().zoom).toBeCloseTo(1.1, 12);
    expect(cam.snapshot().yaw).toBeCloseTo(1, 12);
    expect(cam.snapshot().pitch).toBe(PITCH_DEFAULT);
  });
});
