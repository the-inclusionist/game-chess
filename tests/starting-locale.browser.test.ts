// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= 🔴 THE TEST THAT 27 OTHER TESTS NEEDED AND NOBODY HAD =========================
// On 2026-10-05 this repository's suite ran somewhere other than its author's machine for the first
// time — the shared CI, against `fbe4863` — and twenty-seven browser tests went red at once. Not one
// of them was about language. They asserted Portuguese sentences («peão branco»), the boot read
// `navigator.language` to choose between three catalogues, this developer's Chromium reports
// `pt-BR` and a GitHub runner's reports `en-US`, so what those assertions had really been measuring
// all along was the operating system they ran on. `"e4, white pawn"` was the received value.
//
// ⚠️ THE FIX IS A DEP AND NOT A TEST HELPER, because the fault is the game's and not the suite's.
// ADR-0139 §4 already named this exact class once, for `location.search`: a cartridge that reads the
// page's address reads its NEIGHBOURS' arguments, so `params` is handed over instead. A cartridge
// that reads `navigator.language` reads the DEVICE's language rather than the one its host chose
// for it — the same mistake about the same kind of global, invisible until another computer ran it.
//
// ⚠️ AND THIS FILE PROVES THE MECHANISM RATHER THAN THE SYMPTOM. Pinning `locale: 'pt'` in the
// twenty-seven makes them green here, where they were already green; it proves nothing. What has to
// be true is that the dep BEATS whatever this browser claims — in BOTH directions, so that passing
// `'en'` really produces English rather than the test merely agreeing with the machine again.
import { beforeEach, describe, expect, it } from 'vitest';
import { createGameShell, type GameShell } from '../app/js/boot/standalone.ts';
import { clear, saveSettings } from '../app/js/chess/session.ts';
import { fakeView, fixture } from './helpers/shell-fixture.ts';

const live: GameShell[] = [];

/**
 * Makes this browser claim the language a GitHub runner claims.
 *
 * 🔴 THIS IS THE TOOL THAT WAS MISSING ON 2026-10-05, and its absence cost a red CI run and a wrong
 * diagnosis. The first attempt to reproduce the runner forced Chromium through the Playwright
 * provider — `context.locale`, then `--lang=en-US` — ran the unpinned suite expecting red, and got
 * GREEN. The option was not taking: `navigator.language` was measured, directly, still answering
 * `pt-BR` both times. A reproduction that cannot fail is not a reproduction.
 *
 * Redefining the property in the page works, is measured below, and is confined to the tests that
 * ask for it — `configurable: true` so each one can set its own.
 */
function deviceSpeaks(tag: string): void {
  Object.defineProperty(navigator, 'language', { get: () => tag, configurable: true });
  Object.defineProperty(navigator, 'languages', { get: () => [tag], configurable: true });
}

/**
 * Long enough for the engine to settle its boot language and announce it.
 *
 * 🔴 EVERY CASE IN THIS FILE AWAITS IT BEFORE ENDING, even the ones whose assertion is synchronous,
 * and that is not symmetry. Telling the engine a language returns a PROMISE; a case that asserted
 * and ended left that promise in flight, and it resolved inside the NEXT case — announcing the
 * previous case's language to a board that had already drawn itself correctly in its own. The
 * symptom was «expected 'e2, peón blanco' to be 'e2, peão branco'» in a case that never mentions
 * Spanish, passing in isolation and failing in the file. Settling is how a case cleans up here.
 */
const settle = (): Promise<void> => new Promise((r) => { setTimeout(r, 400); });

beforeEach(() => {
  while (live.length > 0) live.pop()!.teardown();
  /*
   * ⚠️ THE WHOLE STORE, NOT JUST THIS GAME'S KEYS, and it took a failing run to find out why. The
   * ENGINE remembers a language too — its own words: «a switch is kept, told to the page, and
   * followed by every root on it» — under a key this repository does not name. Clearing only
   * `clear()` and `saveSettings({})` left the engine holding whatever the previous test had put
   * there, so a case that saved Spanish leaked Spanish into the next one and the failure read
   * «expected 'e2, peón blanco' to be 'e2, peão branco'» in a test that had never mentioned Spanish.
   *
   * 📌 That is a property of this file in particular: it is the only one that changes the language
   * on purpose, so it is the only one that can poison its own neighbours.
   */
  localStorage.clear();
  clear();
  saveSettings({});
  document.body.replaceChildren();
});

/** The square name the grid mirror gives e4's pawn, which is a sentence in whichever language. */
function pawnLabel(): string {
  const cell = [...document.querySelectorAll('[role="gridcell"]')]
    .find((c) => (c.getAttribute('aria-label') ?? '').startsWith('e2,'));
  return cell?.getAttribute('aria-label') ?? '';
}

function boot(locale: 'pt' | 'en' | 'es'): void {
  fixture();
  const shell = createGameShell({
    locale,
    host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
    debugName: '__localeTest', contrastTheme: 'contrast-flat',
  });
  live.push(shell);
}

describe('[Locale] the host names the starting language, and the browser does not', () => {
  it('🔴 starts in Portuguese when asked for Portuguese', async () => {
    boot('pt');
    expect(pawnLabel()).toBe('e2, peão branco');
    await settle();
  });

  it('🔴 starts in ENGLISH when asked for English, on this same machine', async () => {
    /*
     * ⚠️ THIS IS THE HALF THAT CANNOT BE FAKED BY AGREEING WITH THE MACHINE. This developer's
     * browser reports `pt-BR` — measured, not assumed, on 2026-10-05 — so if `locale` were being
     * ignored the label below would come back in Portuguese and this assertion would fail. It is
     * the only assertion in the repository that would notice the dep being quietly dropped.
     */
    boot('en');
    expect(pawnLabel()).toBe('e2, white pawn');
    await settle();
  });

  it('starts in Spanish when asked for Spanish', async () => {
    boot('es');
    expect(pawnLabel()).toBe('e2, peón blanco');
    await settle();
  });

  it('⚠️ a remembered language still beats the host\'s default', async () => {
    // The order the boot documents: remembered → host → browser. What a host supplies is a DEFAULT
    // and not an override, so a child who chose Spanish yesterday keeps Spanish today.
    saveSettings({ locale: 'es' });
    boot('en');
    expect(pawnLabel()).toBe('e2, peón blanco');
    await settle();
  });
});

/* ========================= THE HALF THAT REACHED CHILDREN ========================= */

describe('[Locale] the choice a child made outranks the device she was given', () => {
  it('🔴 keeps the language she chose, on a device that speaks another one', async () => {
    /*
     * ⚠️ THE EXACT MEASUREMENT THAT NAMED THE DEFECT, 2026-10-05. Before the fix, with a remembered
     * `pt` and a device claiming `en-US`:
     *
     *   synchronously  → «e2, peão branco»   (this game started in her language)
     *   400 ms later   → «e2, white pawn»    (and threw it away)
     *
     * The engine reads `navigator.language` itself and announces it as the page's language; this
     * game follows that door on purpose, and nobody had ever told the engine what she chose. It is
     * not a test artefact: `en-US` is what a school's donated laptop very often reports.
     */
    deviceSpeaks('en-US');
    saveSettings({ locale: 'pt' });
    boot('pt');
    expect(pawnLabel()).toBe('e2, peão branco');
    await settle();
    expect(pawnLabel()).toBe('e2, peão branco');
  });

  it('🔴 and the other way round, so this is not the machine agreeing with itself', async () => {
    // The mirror image: remembered English on a Portuguese device. Without it, a fix that simply
    // forced Portuguese everywhere would pass the test above and be just as wrong.
    deviceSpeaks('pt-BR');
    saveSettings({ locale: 'en' });
    boot('en');
    expect(pawnLabel()).toBe('e2, white pawn');
    await settle();
    expect(pawnLabel()).toBe('e2, white pawn');
  });

  it('⚠️ follows the device when NOBODY chose, which is the case it must not break', async () => {
    /*
     * The guard on the fix. This game corrects the engine only when a language was CHOSEN — by the
     * child or by the host. Inherited from the device, the two already agree, and a game that told
     * a page what to speak anyway would be overriding its neighbours on a platform.
     */
    deviceSpeaks('en-US');
    fixture();
    const shell = createGameShell({
      host: document, kind: '2d', view: fakeView({ legs: [], hidden: [] }), visibleMirror: true,
      debugName: '__localeTest', contrastTheme: 'contrast-flat',
    });
    live.push(shell);
    expect(pawnLabel()).toBe('e2, white pawn');
    await settle();
    expect(pawnLabel()).toBe('e2, white pawn');
  });
});
