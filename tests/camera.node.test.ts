// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  clampPitch, createCamera, PITCH_DEFAULT, PITCH_SHALLOWEST, PITCH_STEEPEST, wrapYaw,
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

  it('dragging down flattens the view and dragging up steepens it', () => {
    const down = createCamera();
    down.drag(0, 40);
    const up = createCamera();
    up.drag(0, -40);
    expect(down.snapshot().pitch).toBeGreaterThan(PITCH_DEFAULT);
    expect(up.snapshot().pitch).toBeLessThan(PITCH_DEFAULT);
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
  it('nudges in all four directions', () => {
    const left = createCamera();
    left.nudge('left');
    const right = createCamera();
    right.nudge('right');
    expect(left.snapshot().yaw).toBeLessThan(right.snapshot().yaw);

    const up = createCamera();
    up.nudge('up');
    const down = createCamera();
    down.nudge('down');
    expect(up.snapshot().pitch).toBeLessThan(down.snapshot().pitch);
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
    expect(cam.snapshot()).toEqual({ pitch: PITCH_DEFAULT, yaw: 0 });
  });
});

describe('[Reset] returns to the framing spike 0 measured', () => {
  it('goes back to the default after any amount of movement', () => {
    const cam = createCamera();
    cam.drag(123, -45);
    cam.nudge('left');
    cam.reset();
    expect(cam.snapshot()).toEqual({ pitch: PITCH_DEFAULT, yaw: 0 });
  });
});
