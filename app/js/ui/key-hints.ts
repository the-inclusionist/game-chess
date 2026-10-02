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
import type { KeyScheme } from '@the-inclusionist/engine/core/entity.js';

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

/*
 * ========================= ONE TABLE, TWO CONSUMERS =========================
 * These are the actions this game asks for, and they were written out twice: once here, to print
 * the line under the board, and once in the shell's `preset`, to tell the engine how many actions a
 * device must reach before a child can finish a game. Two lists of the same fact, and nothing
 * obliging them to agree — which is the shape that has already gone wrong in this repository more
 * than once this week.
 *
 * ⚠️ THE ANSWER IS NOT A TEST THAT THEY MATCH, IT IS NOT HAVING TWO. `render/pieces/geometry.ts` is
 * the precedent and it is the house rule: a table read by two consumers, rather than a rule two
 * consumers each remember. A test asserting agreement would pass the day somebody edited both —
 * which is the day it would be least needed — and say nothing about the day they edited one.
 */

/** The four directions, in the order a person says them, which is what makes `WASD` read as WASD. */
const MOVE = ['up', 'left', 'down', 'right'] as const;

/** The verbs, in the order the line reads them. */
const VERBS: readonly (readonly [keyof KeyScheme, string])[] = [
  ['action2', 'keys.select'],
  ['action3', 'keys.cancel'],
  ['action1', 'keys.teacher'],
  ['action4', 'keys.panel'],
];

/**
 * Every action this game asks for, flat — what the engine counts against a device's transports.
 *
 * ⚠️ THE COUNT IS THE HONEST ONE RATHER THAN THE FLATTERING ONE. Four directions and a confirm
 * would be enough to push a pawn, and declaring only those would make the reach warning quieter by
 * lying about what the game needs: the sonar is one, and getting into the side panel at all is
 * `action4`. The engine reserves `start` and `select` for the pause and the menus (ADR-0144 §4),
 * so a preset that claims either is refused at boot. A child who cannot reach those
 * has a game she cannot finish, not a game she can play with fewer buttons.
 */
export function gameActions(sonar: keyof KeyScheme | null): readonly (readonly [keyof KeyScheme, string])[] {
  return [
    ...MOVE.map((d) => [d, 'keys.move'] as const),
    ...VERBS,
    ...(sonar ? [[sonar, 'keys.sonar'] as const] : []),
  ];
}

/**
 * The same table as an engine `ActionPreset`.
 *
 * ⚠️ THE LABELS FREEZE IN WHATEVER LANGUAGE IS ASKED FOR HERE, because `createGame` reads the
 * preset once. That is survivable today only because this root uses it to COUNT and never builds
 * the labeller, so none of these strings reaches a screen. The day one does, a change of language
 * has to reach them too, and this is the note that says where to look.
 */
export function actionPreset(
  sonar: keyof KeyScheme | null,
): Record<string, { readonly labelKey: string }> {
  // The KEY, not the resolved text. ADR-0232 D3 erratum of 2026-09-25: a game declares the KEY of
  // each word, resolved at every drawing — a word baked in at boot sticks to the boot language
  // forever (📏 measured: a preset built with `t` in Portuguese still said «Acima» after
  // `setLocale('en')`). The engine registers chess's dictionary (`hooks.dictionaries`) and
  // translates these keys itself.
  return Object.fromEntries(gameActions(sonar).map(([action, key]) => [action, { labelKey: key }]));
}

/**
 * The line for a scheme, in reading order.
 *
 * ⚠️ AN ACTION THAT REACHES NO KEY IS NOT ADVERTISED. This is the whole point of deriving the line:
 * the previous version printed seven keys whatever the scheme said, so a binding that had been
 * cleared still had a letter under the board promising it. Silence is honest; a promise is not.
 */
export function hintParts(
  scheme: KeyScheme,
  opts: { readonly camera: boolean; readonly sonar: keyof KeyScheme | null },
): readonly Hint[] {
  const parts: Hint[] = [];

  /*
   * The four directions as one entry, because they are one gesture. Printed in the order a person
   * says them — up, left, down, right — which is what makes `WASD` come out as `WASD`.
   */
  const move = MOVE
    .map((d) => firstKey(scheme, d))
    .filter((k): k is string => k !== null);
  if (move.length > 0) parts.push([move.join(''), 'keys.move']);

  for (const [action, label] of VERBS) {
    const key = firstKey(scheme, action);
    if (key) parts.push([key, label]);
  }

  /*
   * ⚠️ THE SONAR IS PASSED IN AS AN ACTION, NOT AS A LETTER, and the difference is the whole repair.
   * This argument was a literal `'L'` for as long as the sonar rode a key the engine did not know
   * about: it used to be the `especial` intent, which engine 8's canonical list does not contain,
   * so nothing bound it and the shell tested the physical code instead. The game now declares the
   * sonar on a canonical slot, so it derives here like every other entry — and follows a remapping
   * the same way.
   *
   * It stays a PARAMETER rather than a constant in this file because which slot carries the sonar
   * is the game's decision, and this module is about the derivation.
   */
  if (opts.sonar) {
    const key = firstKey(scheme, opts.sonar);
    if (key) parts.push([key, 'keys.sonar']);
  }

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
