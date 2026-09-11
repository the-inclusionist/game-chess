// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The line under the board is derived from the remappable scheme now, so what is worth asserting is
// the DERIVATION — that a scheme which changed produces a line that changed, and that an action
// bound to nothing is not advertised at all.
import { describe, expect, it } from 'vitest';
import type { KeyScheme } from '@the-inclusionist/engine/input/keyboard-runtime.js';
import { hintParts, keyLabel } from '../app/js/ui/key-hints.ts';

/** The engine's own solo defaults, read off the running page at `?debug=true` on 8.0.0. */
const MEASURED: KeyScheme = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  action1: ['KeyU'], action2: ['KeyJ', 'Space'], action3: ['KeyK'], action4: ['KeyI'],
  leftShoulder: ['Digit7'], leftTrigger: ['KeyY'],
  rightShoulder: ['Digit8'], rightTrigger: ['KeyO'],
  start: ['KeyH', 'Enter'], select: ['KeyF'],
} as unknown as KeyScheme;

const line = (parts: readonly (readonly [string, string])[]): string =>
  parts.map(([key, label]) => `${key}=${label}`).join(' · ');

describe('[Key label] a code as a person reads it off the key', () => {
  it('names the families by shape rather than one by one', () => {
    expect(keyLabel('KeyH')).toBe('H');
    expect(keyLabel('Digit7')).toBe('7');
    expect(keyLabel('Numpad1')).toBe('Num 1');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('ShiftRight')).toBe('⇧');
  });

  it('⚠️ gives an unknown code back as itself, like a missing i18n key', () => {
    /*
     * The same contract `i18n.t()` keeps, and for the same reason: the screen shows something
     * wrong-looking rather than something missing, and wrong-looking is what gets reported. An
     * empty string would hide the gap behind a line that merely looked short.
     */
    expect(keyLabel('IntlBackslash')).toBe('IntlBackslash');
    expect(keyLabel('F13')).toBe('F13');
  });
});

describe('[Key hints] the line follows the scheme, which is the point', () => {
  it('reproduces the hand-written line from the measured defaults', () => {
    // The seven entries this line carried as literals, now derived from the same scheme the game
    // resolves keys through. If the two ever disagree, the literals were the ones that were wrong.
    expect(line(hintParts(MEASURED, { camera: false, sonar: 'L' })))
      .toBe('WASD=keys.move · J=keys.select · K=keys.cancel · U=keys.teacher · I=keys.panel · L=keys.sonar · H=keys.pause');
  });

  it('⚠️ a remapped scheme produces a remapped line', () => {
    /*
     * THE TEST THE OLD VERSION COULD NOT PASS. A child who moves the pause key to P was told to
     * press H, in her own language, by a line that had been translated with care and never asked
     * what the keys were.
     */
    const remapped = { ...MEASURED, start: ['KeyP'], action2: ['KeyZ'] } as unknown as KeyScheme;
    expect(line(hintParts(remapped, { camera: false, sonar: 'L' })))
      .toBe('WASD=keys.move · Z=keys.select · K=keys.cancel · U=keys.teacher · I=keys.panel · L=keys.sonar · P=keys.pause');
  });

  it('⚠️ an action that reaches no key is not advertised', () => {
    // Silence is honest; a promise is not. `null` is what the engine's own boot scheme is made of
    // — every action to null — so this is a state the game really passes through.
    const bare = { ...MEASURED, action1: null, start: [] } as unknown as KeyScheme;
    const out = line(hintParts(bare, { camera: false, sonar: null }));
    expect(out).toBe('WASD=keys.move · J=keys.select · K=keys.cancel · I=keys.panel');
  });

  it('the camera rides the same four keys, and only where there is a camera', () => {
    const flat = hintParts(MEASURED, { camera: false, sonar: 'L' });
    const solid = hintParts(MEASURED, { camera: true, sonar: 'L' });
    expect(solid.length - flat.length).toBe(2);
    expect(solid[solid.length - 2]?.[0]).toBe('⇧ + WASD');
  });
});
