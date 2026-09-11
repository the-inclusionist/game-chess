// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE KEY LINE, DERIVED RATHER THAN TYPED =========================
// The line under the board tells a player which keys do what. It was a table of letters written by
// hand — `WASD`, `J`, `K`, `U`, `I`, `L`, `H` — while the game resolves every one of those through
// the engine's remappable scheme.
//
// ⚠️ THAT IS THE SAME DEFECT THIS REPOSITORY ALREADY FIXED ONCE, arriving by a different road.
// `4345f66` fixed a line that announced `Enter seleciona` and `K sonar` after the remapping landed;
// the text stopped being hard-coded and the KEYS stayed hard-coded. A child who remaps `action2`
// away from `J` is then told, in her own language, to press a key that does nothing.
//
// So the line is computed from `KeyScheme` — the same object `engine.keyboard.kbFor(0)` returns and
// the same one a remap writes into. Pure, and in its own file, because the part worth testing is
// the derivation and not the `<kbd>` elements around it.
import type { KeyScheme } from '@the-inclusionist/engine/input/keyboard-runtime.js';

/**
 * A key code as a person reads it on the key.
 *
 * ⚠️ AN UNKNOWN CODE COMES BACK AS ITSELF, which is deliberate and is the same contract `i18n.t()`
 * keeps for a missing string: the screen shows something wrong-looking rather than something
 * missing, and wrong-looking is what gets reported. Returning an empty string would hide the gap
 * behind a line that merely looked short.
 */
export function keyLabel(code: string): string {
  if (code.startsWith('Key') && code.length === 4) return code.slice(3);
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const named: Record<string, string> = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Space: 'Space', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab',
    ShiftLeft: '⇧', ShiftRight: '⇧', Backspace: '⌫',
  };
  return named[code] ?? code;
}

/** The first key bound to an action, as a label, or null when the action reaches no key at all. */
function firstKey(scheme: KeyScheme, action: keyof KeyScheme): string | null {
  const bound = scheme[action];
  return bound && bound.length > 0 ? keyLabel(bound[0]!) : null;
}

/** One entry of the line: what to print on the key, and the i18n key for what it does. */
export type Hint = readonly [key: string, label: string];

/**
 * The line for a scheme, in reading order.
 *
 * ⚠️ AN ACTION THAT REACHES NO KEY IS NOT ADVERTISED. This is the whole point of deriving the line:
 * the previous version printed seven keys whatever the scheme said, so a binding that had been
 * cleared still had a letter under the board promising it. Silence is honest; a promise is not.
 */
export function hintParts(scheme: KeyScheme, opts: { readonly camera: boolean; readonly sonar: string | null }): readonly Hint[] {
  const parts: Hint[] = [];

  /*
   * The four directions as one entry, because they are one gesture. Printed in the order a person
   * says them — up, left, down, right — which is what makes `WASD` come out as `WASD`.
   */
  const move = (['up', 'left', 'down', 'right'] as const)
    .map((d) => firstKey(scheme, d))
    .filter((k): k is string => k !== null);
  if (move.length > 0) parts.push([move.join(''), 'keys.move']);

  const verbs: readonly (readonly [keyof KeyScheme, string])[] = [
    ['action2', 'keys.select'],
    ['action3', 'keys.cancel'],
    ['action1', 'keys.teacher'],
    ['action4', 'keys.panel'],
  ];
  for (const [action, label] of verbs) {
    const key = firstKey(scheme, action);
    if (key) parts.push([key, label]);
  }

  /*
   * ⚠️ THE SONAR IS PASSED IN, BECAUSE IT IS NOT AN ACTION AND SAYING SO IS THE POINT. It used to
   * ride the `especial` intent; engine 8's canonical list has no such name — `especial` survives in
   * one historical comment there and nowhere else — so the only thing that reaches the sonar is the
   * literal key the shell still tests for. Deriving it from the scheme would print nothing at all,
   * and printing nothing would hide a key that works.
   */
  if (opts.sonar) parts.push([opts.sonar, 'keys.sonar']);

  const pause = firstKey(scheme, 'start');
  if (pause) parts.push([pause, 'keys.pause']);

  /*
   * The camera belongs to the two views that have one, and rides the same direction keys with a
   * modifier — so it is derived from the same four rather than typed again.
   */
  if (opts.camera && move.length > 0) {
    parts.push([`⇧ + ${move.join('')}`, 'keys.turn'], ['⇧ + / −', 'keys.zoom']);
  }
  return parts;
}
