// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/chess-clock — two countdowns, one running at a time.
//
// ========================= WHAT A CHESS CLOCK IS, AND WHAT THIS ONE IS NOT =========================
// The Dev, 2026-10-04: "adicione um relógio marcado 5:00 na frente de BRANCAS e um outro igual na
// frente de PRETAS… quero ambos funcionando como relógios de xadrez, entrando em modo de contagem
// regressiva após o lance do adversário."
//
// So: two stores of time, at most one of them draining, and the one that drains is the side ON
// MOVE. Pressing your clock is making your move — there is no button, because the board is the
// button.
//
// ⚠️ NEITHER CLOCK RUNS BEFORE THE FIRST MOVE, and that is his sentence taken literally: a clock
// enters countdown "após o lance do adversário", and before white's first move there has been no
// such move. A real tournament clock is started by hand for exactly this reason — somebody has to
// decide when the game begins — and a board that started draining white's time while a child was
// still reading the pieces would be deciding it for them.
//
// ⚠️ AND IT DOES NOT END THE GAME AT ZERO. Running out of time is a loss in a tournament; here it
// stops at 0:00, says so once, and leaves the position alone. That is a decision rather than an
// omission: this clock was asked for as a thing to watch, nothing in the request makes it a
// referee, and a child who looks away mid-lesson should not come back to a game they have lost to
// a number. The hook for the other answer is `onFlag`.
//
// ⚠️ WALL TIME, NOT FRAMES. The engine's loop hands out `dt` in FRAMES, which is right for an
// animation and wrong for a clock: a tab that throttles to 10 fps would make a minute last six.
// This reads `now()` and subtracts, so a throttled tab, a paused loop and a hidden page all tell
// the same time — which is the only way two people sharing a board can trust it.

import type { Side } from '../chess/types.ts';

/** Five minutes, in milliseconds. The Dev asked for a clock "marcado 5:00". */
export const DEFAULT_CLOCK_MS = 5 * 60 * 1000;

/**
 * ========================= THE LADDER =========================
 * The Dev, 2026-10-04: the time button toggles "entre 1+0, 2+1, 3+0, 3+2, 5+0, 10+0, 15+10, e
 * «sem tempo»", and "<tempo> envolve número de minutos para cada lado mais acréscimo por lance em
 * segundos".
 *
 * ⚠️ `null` IS «SEM TEMPO» AND IT IS A RUNG LIKE THE OTHERS, not a flag beside them. A board with
 * no clock is a real way to play — it is how every lesson is played, and how two children arguing
 * about a position want to play — so it sits at the end of the ladder where somebody looking for
 * "slower" will reach it.
 */
export interface TimeControl {
  /** Minutes for each side. */
  readonly minutes: number;
  /** Seconds added to a player's clock when their move lands (Fischer). */
  readonly increment: number;
}

export const TIME_CONTROLS: readonly (TimeControl | null)[] = [
  { minutes: 1, increment: 0 },
  { minutes: 2, increment: 1 },
  { minutes: 3, increment: 0 },
  { minutes: 3, increment: 2 },
  { minutes: 5, increment: 0 },
  { minutes: 10, increment: 0 },
  { minutes: 15, increment: 10 },
  null,
];

/** `5+0`, the way a chess player writes it. «sem tempo» is the caller's word, not this file's. */
export function formatControl(control: TimeControl): string {
  return `${control.minutes}+${control.increment}`;
}

export interface ChessClockDeps {
  /** Injected so a test can drive time without waiting for it. Defaults to `performance.now()`. */
  now?: () => number;
  /** Called whenever the displayed time should change. */
  onTick?: () => void;
  /** Called once, for the side whose time reached zero. */
  onFlag?: (side: Side) => void;
  /** How long each side starts with. */
  startMs?: number;
  /** How often the display is repainted while a clock runs. */
  tickMs?: number;
  /** Injected for the same reason as `now`. */
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
}

export interface ChessClock {
  /** Milliseconds left for `side`, never below zero. */
  remaining(side: Side): number;
  /** Which clock is draining, or null. */
  running(): Side | null;
  /** Whether `side` has run out. */
  flagged(side: Side): boolean;
  /** Starts `side`'s countdown and stops the other. */
  start(side: Side): void;
  /** Stops whichever is draining, keeping both times. */
  pause(): void;
  /** Back to the starting time for both, stopped. Uses whatever `configure` last set. */
  reset(): void;
  /**
   * Chooses the control the NEXT reset will use.
   *
   * ⚠️ IT DOES NOT TOUCH THE RUNNING TIMES, which is the Dev's own separation: «Zerar Relógio» is
   * a second button precisely so that choosing a rung in the middle of a game does not wipe the
   * time two people have already spent.
   */
  configure(startMs: number, incrementMs: number): void;
  /**
   * Adds the increment to `side`, because their move has landed.
   *
   * ⚠️ TO THE SIDE THAT JUST MOVED, not the one now on move. Fischer increment pays for the move
   * you have made; crediting the opponent instead would hand a player time for thinking.
   */
  addIncrement(side: Side): void;
  dispose(): void;
}

/** `m:ss`, which is what a chess clock shows at these times. Never negative. */
export function formatClock(ms: number): string {
  const whole = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function createChessClock(deps: ChessClockDeps = {}): ChessClock {
  const now = deps.now ?? (() => performance.now());
  const startMs = deps.startMs ?? DEFAULT_CLOCK_MS;
  const tickMs = deps.tickMs ?? 200;
  const setTimer = deps.setInterval ?? ((fn, ms) => setInterval(fn, ms));
  const clearTimer = deps.clearInterval ?? ((h) => { clearInterval(h as ReturnType<typeof setInterval>); });

  /** What each side had when its clock was last stopped. */
  const banked: Record<Side, number> = { w: startMs, b: startMs };
  let configured = startMs;
  let increment = 0;
  let side: Side | null = null;
  let since = 0;
  let timer: unknown = null;
  /*
   * ⚠️ «HAS IT RUN OUT» IS DERIVED, AND IT WAS A STORED FLAG. The flag was only ever written by the
   * repaint tick, so between two ticks — or with the timer throttled, or in a test that drives
   * time by hand — a clock could read 0:00 and still answer `flagged: false`. `addIncrement` then
   * credited five seconds to a side that had already lost. Found by the test that pauses a clock
   * past zero without letting the timer run.
   *
   * What a stored flag is still needed for is saying so ONCE: `announced` is that, and nothing
   * else reads it.
   */
  const announced: Record<Side, boolean> = { w: false, b: false };

  const drained = (): number => (side === null ? 0 : now() - since);

  const remaining = (which: Side): number => {
    const left = banked[which] - (which === side ? drained() : 0);
    return left > 0 ? left : 0;
  };

  const out = (which: Side): boolean => remaining(which) <= 0;

  const stopTimer = (): void => {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  };

  /** Moves the drained time into the bank and stops counting. */
  const bank = (): void => {
    if (side === null) return;
    banked[side] = remaining(side);
    side = null;
    stopTimer();
  };

  const tick = (): void => {
    const which = side;
    if (which !== null && out(which) && !announced[which]) {
      announced[which] = true;
      // ⚠️ BANKED BEFORE THE CALLBACK, so a listener that reads the clock sees 0 and not a
      // negative number that is still falling.
      bank();
      deps.onFlag?.(which);
    }
    deps.onTick?.();
  };

  return {
    remaining,
    running: () => side,
    flagged: out,

    start(which) {
      if (out(which)) return;
      if (side === which) return;
      bank();
      side = which;
      since = now();
      stopTimer();
      timer = setTimer(tick, tickMs);
      deps.onTick?.();
    },

    pause() {
      if (side === null) return;
      bank();
      deps.onTick?.();
    },

    reset() {
      bank();
      banked.w = configured;
      banked.b = configured;
      announced.w = false;
      announced.b = false;
      deps.onTick?.();
    },

    configure(nextStartMs, nextIncrementMs) {
      configured = nextStartMs;
      increment = nextIncrementMs;
    },

    addIncrement(which) {
      // ⚠️ `out(which)`, NOT a stored flag: see the note on `announced`. A side with no time left
      // is out whether or not a timer has noticed yet.
      if (increment === 0 || out(which)) return;
      // ⚠️ Banked through `remaining`, so adding to the side that is STILL running credits the
      // time it has left rather than the time it started the turn with.
      banked[which] = remaining(which) + increment;
      if (which === side) since = now();
      deps.onTick?.();
    },

    dispose() {
      /*
       * ⚠️ `bank()`, NOT `side = null`. The first version dropped the running side without banking
       * what it had already spent, so a clock disposed five seconds into a turn reported the full
       * five minutes again — the elapsed time existed only as the gap between `since` and `now`,
       * and clearing `side` threw that gap away. Found by `tests/chess-clock.node.test.ts`, which
       * is the only reader that ever looks at a clock after it has been disposed.
       */
      bank();
    },
  };
}
