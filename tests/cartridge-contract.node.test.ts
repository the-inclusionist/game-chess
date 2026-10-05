// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE SAME REFUSALS, FOUR SECONDS EARLIER =========================
// `inclusionist-check-cartridge` already asks this question of the BUILT cartridge, in CI. This
// file asks it of the SOURCE, in the unit suite, and both are worth having for the ordinary reason
// a type and a test are both worth having: the gate that runs in CI runs after `npm ci`, a build
// and a cartridge build, and the one that runs here runs in two hundred milliseconds while somebody
// is still typing.
//
// ⚠️ AND IT IMPORTS THE ENGINE'S OWN LIST RATHER THAN RE-LISTING IT. `cartridgeRefusals` is the one
// list `createGame`, `mount()` and the engine's checker all read; a test that wrote out the rules it
// expects would drift from the boot the first time a rule was added, and would then pass on a
// cartridge the platform refuses — which is the exact drift ADR-0253 exists to end.
//
// ⚠️ AND IT RUNS IN THE `node` PROJECT, WITH NO DOM, ON PURPOSE. That is not an accident of where
// the file was put: a cartridge runs nothing until `create(ctx)` (ADR-0139 §2), so merely IMPORTING
// it must not need a page. If `src/index.ts` ever reaches for `document` at module scope, this file
// fails at the import — which is the earliest anything can say so.
import { describe, expect, it } from 'vitest';
import cartridge from '../src/index.ts';
import { CHESS_ACCOMMODATIONS } from '../app/js/declaration/cartridge-answers.ts';

const { cartridgeRefusals } = await import(
  '../node_modules/@the-inclusionist/engine/dist-pkg/boot/create-game.js' as string
) as { cartridgeRefusals: (d: unknown, h: unknown) => readonly string[] };

describe('[Cartridge] the engine would accept what a platform imports', () => {
  it('🔴 raises not one refusal, read BOTH ways the engine reads them', () => {
    /*
     * 🔴 TWO CALLS, AND THE SECOND ONE IS THE WHOLE REASON THIS ASSERTION IS SHAPED LIKE THIS.
     * The engine's two readers look in two different places:
     *
     *   · `createGame(o)` → `refuseCartridge('createGame', cartridge.declaration, cartridge)`,
     *     the hooks FLAT, because a host has already spread them into its options;
     *   · `inclusionist-check-cartridge` → `refusals(cartridge.declaration, cartridge.hooks)`,
     *     NESTED, reading the cartridge as ADR-0139 §2 describes it.
     *
     * Measured on 2026-10-05: with the hooks written flat, the first call returned `[]` and the CI
     * gate said «accommodations: missing» about an object that was demonstrably present in the same
     * build. Checking only one of the two would have passed, both times, on a cartridge that was
     * refused somewhere.
     */
    expect(cartridgeRefusals(cartridge.declaration, cartridge.hooks)).toEqual([]);
    expect(cartridgeRefusals(cartridge.declaration, { ...cartridge.hooks })).toEqual([]);
  });

  it('is the shape ADR-0139 §2 names', () => {
    expect(cartridge.slug).toBe('game-chess');
    expect(typeof cartridge.create).toBe('function');
    expect(cartridge.declaration).toBeTruthy();
    expect(cartridge.hooks).toBeTruthy();
  });

  it('⚠️ hands both readers the SAME declaration object, not two equal ones', () => {
    // Two separate-but-equal declarations would pass every gate there is, and the day one of them
    // was changed the gate would still pass while the platform ran the other.
    expect(cartridge.hooks.declaration).toBe(cartridge.declaration);
  });

  it('⚠️ answers every accommodation from the one shared table', () => {
    // The live shell reads the same constant. Two copies of eighteen booleans would disagree in
    // the worst direction: the static copy is what a platform REFUSES on, the live copy is what it
    // then RUNS with, so a row that differed would pass the gate and lie to the child.
    expect(cartridge.hooks.accommodations).toBe(CHESS_ACCOMMODATIONS);
    expect(Object.keys(CHESS_ACCOMMODATIONS)).toHaveLength(18);
  });

  it('declares a board that is 8×8 and a world that is a SELECTOR', () => {
    /*
     * The selector is what makes a module-level declaration possible at all, and it was measured
     * rather than assumed: `worldProblems` accepts `{kind:'element', selector}` — a string — so
     * nothing here needs a document to exist. An `element` would have made this whole file
     * impossible and the failure would have been an import-time crash in CI.
     */
    const topology = cartridge.declaration.topology();
    expect(topology.kind).toBe('grid');
    expect('size' in topology ? topology.size : null).toEqual([8, 8]);
    const world = cartridge.declaration.world?.();
    expect(world && 'selector' in world ? world.selector : null).toBe('#game-region');
  });
});
