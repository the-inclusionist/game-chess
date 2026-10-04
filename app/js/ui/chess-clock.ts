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
  /** Back to the starting time for both, stopped. */
  reset(): void;
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
  let side: Side | null = null;
  let since = 0;
  let timer: unknown = null;
  const flagged: Record<Side, boolean> = { w: false, b: false };

  const drained = (): number => (side === null ? 0 : now() - since);

  const remaining = (which: Side): number => {
    const left = banked[which] - (which === side ? drained() : 0);
    return left > 0 ? left : 0;
  };

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
    if (which !== null && remaining(which) <= 0 && !flagged[which]) {
      flagged[which] = true;
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
    flagged: (which) => flagged[which],

    start(which) {
      if (flagged[which]) return;
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
      banked.w = startMs;
      banked.b = startMs;
      flagged.w = false;
      flagged.b = false;
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
