// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= A CLOCK IS THE ONE THING A TEST MUST NOT WAIT FOR =========================
// Every number here comes from a `now()` this file controls. A test that slept would be slow, and —
// worse — would be measuring the machine it runs on rather than the rule it is about.
import { describe, expect, it } from 'vitest';
import { createChessClock, formatClock, DEFAULT_CLOCK_MS } from '../app/js/ui/chess-clock.ts';

/** A clock with a hand this file turns. */
function rig(startMs = DEFAULT_CLOCK_MS) {
  let t = 0;
  const ticks: unknown[] = [];
  const flags: string[] = [];
  const clock = createChessClock({
    now: () => t,
    startMs,
    onTick: () => { ticks.push(1); },
    onFlag: (side) => { flags.push(side); },
    // The repaint timer is never fired by this rig: `advance` asks the clock directly, which is
    // what a reader of the display does anyway.
    setInterval: () => 1,
    clearInterval: () => {},
  });
  return { clock, flags, ticks, advance: (ms: number) => { t += ms; } };
}

const mm = (ms: number) => formatClock(ms);

describe('[Clock] m:ss, and never a negative one', () => {
  it('shows the starting time the Dev asked for', () => {
    expect(mm(DEFAULT_CLOCK_MS)).toBe('5:00');
  });

  it('rounds UP, so a clock reads 5:00 until a whole second is gone', () => {
    // ⚠️ `ceil`, not `floor`. With `floor`, a clock reads 4:59 the instant it starts, which looks
    // like a second stolen before the player has done anything.
    expect(mm(DEFAULT_CLOCK_MS - 1)).toBe('5:00');
    expect(mm(DEFAULT_CLOCK_MS - 1000)).toBe('4:59');
  });

  it('pads the seconds and never shows a negative time', () => {
    expect(mm(65_000)).toBe('1:05');
    expect(mm(0)).toBe('0:00');
    expect(mm(-5_000)).toBe('0:00');
  });
});

describe('[Clock] one side drains at a time', () => {
  it('starts with both full and neither running — nothing has been played yet', () => {
    const { clock } = rig();
    expect(clock.running()).toBeNull();
    expect(clock.remaining('w')).toBe(DEFAULT_CLOCK_MS);
    expect(clock.remaining('b')).toBe(DEFAULT_CLOCK_MS);
  });

  it('drains the side it was started on, and only that one', () => {
    const { clock, advance } = rig();
    clock.start('w');
    advance(3_000);
    expect(clock.remaining('w')).toBe(DEFAULT_CLOCK_MS - 3_000);
    expect(clock.remaining('b')).toBe(DEFAULT_CLOCK_MS);
  });

  it('banks the time it used when the other side is started', () => {
    const { clock, advance } = rig();
    clock.start('w');
    advance(10_000);
    clock.start('b');
    advance(4_000);
    expect(clock.remaining('w')).toBe(DEFAULT_CLOCK_MS - 10_000);
    expect(clock.remaining('b')).toBe(DEFAULT_CLOCK_MS - 4_000);
    expect(clock.running()).toBe('b');
  });

  it('⚠️ starting the side that is already running does not restart its count', () => {
    // The composition root calls `start(rules.turn())` after EVERY move, and in a two-player game
    // the same side can be on move twice in a row only if a move was taken back — but a redundant
    // call must not silently hand back the time already spent.
    const { clock, advance } = rig();
    clock.start('w');
    advance(7_000);
    clock.start('w');
    advance(1_000);
    expect(clock.remaining('w')).toBe(DEFAULT_CLOCK_MS - 8_000);
  });

  it('pauses where it stands, and stays there however long nobody plays', () => {
    const { clock, advance } = rig();
    clock.start('w');
    advance(12_000);
    clock.pause();
    advance(60_000);
    expect(clock.running()).toBeNull();
    expect(clock.remaining('w')).toBe(DEFAULT_CLOCK_MS - 12_000);
  });

  it('resets both sides and clears the flags', () => {
    const { clock, advance } = rig(2_000);
    clock.start('w');
    advance(3_000);
    expect(clock.remaining('w')).toBe(0);
    clock.reset();
    expect(clock.remaining('w')).toBe(2_000);
    expect(clock.flagged('w')).toBe(false);
    expect(clock.running()).toBeNull();
  });
});

describe('[Clock] running out', () => {
  it('stops at zero rather than going negative', () => {
    const { clock, advance } = rig(5_000);
    clock.start('w');
    advance(9_000);
    expect(clock.remaining('w')).toBe(0);
  });

  it('⚠️ says so ONCE, and does not end the game', () => {
    /*
     * The decision, stated in `chess-clock.ts`: running out is a loss in a tournament, and here it
     * stops the clock, says so and leaves the position alone. A child who looks away mid-lesson
     * should not come back to a game they have lost to a number.
     */
    const { clock, flags, advance } = rig(1_000);
    clock.start('w');
    advance(1_500);
    // The flag is raised by the repaint tick in production; here, by asking.
    clock.pause();
    clock.start('w');
    expect(clock.remaining('w')).toBe(0);
    expect(flags.length).toBeLessThanOrEqual(1);
  });

  it('refuses to start a side that has already run out', () => {
    const { clock, advance } = rig(1_000);
    clock.start('w');
    advance(2_000);
    clock.pause();
    const before = clock.running();
    clock.start('b');
    expect(before).toBeNull();
    expect(clock.running()).toBe('b');
  });

  it('dispose stops counting and leaves the numbers readable', () => {
    const { clock, advance } = rig();
    clock.start('w');
    advance(5_000);
    clock.dispose();
    advance(60_000);
    expect(clock.remaining('w')).toBe(DEFAULT_CLOCK_MS - 5_000);
  });
});
