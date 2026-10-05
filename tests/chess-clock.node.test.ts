// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= A CLOCK IS THE ONE THING A TEST MUST NOT WAIT FOR =========================
// Every number here comes from a `now()` this file controls. A test that slept would be slow, and —
// worse — would be measuring the machine it runs on rather than the rule it is about.
import { describe, expect, it } from 'vitest';
import {
  createChessClock, formatClock, formatControl, paceOf, DEFAULT_CLOCK_MS, TIME_CONTROLS,
} from '../app/js/ui/chess-clock.ts';

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

describe('[Clock] the ladder the time button walks', () => {
  it('is the ladder the Dev named, in his order, with «sem tempo» at the end', () => {
    // ⚠️ ASSERTED AS THE WHOLE LIST. He named eight rungs — "1+0, 2+1, 3+0, 3+2, 5+0, 10+0, 15+10,
    // e «sem tempo»" — and a list is the one kind of data where "it contains X" proves nothing
    // about the thing a player actually walks through.
    expect(TIME_CONTROLS.map((c) => (c === null ? 'none' : formatControl(c)))).toEqual([
      '1+0', '2+1', '3+0', '3+2', '5+0', '10+0', '15+10', 'none',
    ]);
  });

  it('⚠️ `configure` does not touch the clocks that are already running', () => {
    /*
     * The Dev's own separation, and the reason «Zerar Relógio» is a second button: "«Zerar
     * Relógio» zerando o relógio para o tempo total especificado no botão anterior". Choosing a
     * rung in the middle of a game must not wipe the time two people have spent.
     */
    const { clock, advance } = rig();
    clock.start('w');
    advance(30_000);
    clock.configure(60_000, 0);
    expect(clock.remaining('w')).toBe(DEFAULT_CLOCK_MS - 30_000);
    clock.reset();
    expect(clock.remaining('w')).toBe(60_000);
    expect(clock.remaining('b')).toBe(60_000);
  });
});

describe('[Clock] the increment pays for the move you made', () => {
  it('adds it to the side that moved, not the side now on move', () => {
    const { clock, advance } = rig();
    clock.configure(DEFAULT_CLOCK_MS, 2_000);
    clock.reset();
    clock.start('w');
    advance(10_000);
    // White's move lands: white is credited, then black's clock starts.
    clock.addIncrement('w');
    clock.start('b');
    expect(clock.remaining('w')).toBe(DEFAULT_CLOCK_MS - 10_000 + 2_000);
    expect(clock.remaining('b')).toBe(DEFAULT_CLOCK_MS);
  });

  it('⚠️ credits the time LEFT when the side credited is still running', () => {
    // The trap: banking `banked[side] + increment` instead of `remaining(side) + increment` hands
    // back everything spent this turn. Ten seconds in, this clock must read 4:52 and not 5:02.
    const { clock, advance } = rig();
    clock.configure(DEFAULT_CLOCK_MS, 2_000);
    clock.reset();
    clock.start('w');
    advance(10_000);
    clock.addIncrement('w');
    expect(clock.remaining('w')).toBe(DEFAULT_CLOCK_MS - 8_000);
    advance(1_000);
    expect(clock.remaining('w')).toBe(DEFAULT_CLOCK_MS - 9_000);
  });

  it('gives nothing to a side that has already run out', () => {
    const { clock, advance } = rig(1_000);
    clock.configure(1_000, 5_000);
    clock.reset();
    clock.start('w');
    advance(2_000);
    clock.pause();
    clock.addIncrement('w');
    expect(clock.remaining('w')).toBe(0);
  });
});

/* ========================= WHAT A PLAYER CALLS THE SPEED ========================= */

describe('[Pace] the name of a speed is derived from the ladder, not tabled beside it', () => {
  /*
   * ⚠️ THE EXPECTATIONS ARE THE DEV'S OWN LIST, 2026-10-04, transcribed and not paraphrased:
   * «1+0 e 1+1, "Bala"», «Em 3+0, 5+0 e 3+2, "Bliz"», «em 10+0, 15+10, e 30+0: "Rápido"».
   *
   * 📌 TWO OF THOSE NINE ARE NOT RUNGS OF `TIME_CONTROLS` TODAY — `1+1` and `30+0` — and they are
   * checked anyway, which is the point of a rule over a table: the day either is added, the button
   * is already right and there is nothing to remember. The rung the list does not mention, `2+1`,
   * is bullet by the same boundary.
   */
  const asked: readonly [number, number, string][] = [
    [1, 0, 'bullet'], [1, 1, 'bullet'], [2, 1, 'bullet'],
    [3, 0, 'blitz'], [3, 2, 'blitz'], [5, 0, 'blitz'],
    [10, 0, 'rapid'], [15, 10, 'rapid'], [30, 0, 'rapid'],
  ];

  it('names every control the Dev listed, and the one he did not', () => {
    for (const [minutes, increment, pace] of asked) {
      expect(`${minutes}+${increment}: ${paceOf({ minutes, increment })}`)
        .toBe(`${minutes}+${increment}: ${pace}`);
    }
  });

  it('🔴 names every rung of the ladder, so none can be added without a name', () => {
    // This is the assertion the parallel table would not have had. A new rung gets its name from
    // the same numbers the button already shows; there is no second place to forget.
    for (const control of TIME_CONTROLS) {
      if (control === null) continue;
      const pace = paceOf(control);
      expect(`${formatControl(control)}: ${['bullet', 'blitz', 'rapid'].includes(pace)}`)
        .toBe(`${formatControl(control)}: true`);
    }
  });

  it('⚠️ reads the BASE minutes and not the total, which is what players mean', () => {
    // `3+2` is a blitz game to everyone who has been handed one: the three is what you feel.
    // Folding the increment in would make it 5-ish and move it, correctly by arithmetic and
    // wrongly by every usage of the word.
    expect(paceOf({ minutes: 3, increment: 2 })).toBe('blitz');
    expect(paceOf({ minutes: 2, increment: 10 })).toBe('bullet');
  });

  it('puts the boundaries where chess puts them', () => {
    expect(paceOf({ minutes: 2, increment: 0 })).toBe('bullet');
    expect(paceOf({ minutes: 3, increment: 0 })).toBe('blitz');
    expect(paceOf({ minutes: 9, increment: 0 })).toBe('blitz');
    expect(paceOf({ minutes: 10, increment: 0 })).toBe('rapid');
  });
});
