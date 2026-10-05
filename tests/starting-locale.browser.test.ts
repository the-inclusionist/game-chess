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

beforeEach(() => {
  while (live.length > 0) live.pop()!.teardown();
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
  it('🔴 starts in Portuguese when asked for Portuguese', () => {
    boot('pt');
    expect(pawnLabel()).toBe('e2, peão branco');
  });

  it('🔴 starts in ENGLISH when asked for English, on this same machine', () => {
    /*
     * ⚠️ THIS IS THE HALF THAT CANNOT BE FAKED BY AGREEING WITH THE MACHINE. This developer's
     * browser reports `pt-BR` — measured, not assumed, on 2026-10-05 — so if `locale` were being
     * ignored the label below would come back in Portuguese and this assertion would fail. It is
     * the only assertion in the repository that would notice the dep being quietly dropped.
     */
    boot('en');
    expect(pawnLabel()).toBe('e2, white pawn');
  });

  it('starts in Spanish when asked for Spanish', () => {
    boot('es');
    expect(pawnLabel()).toBe('e2, peón blanco');
  });

  it('⚠️ a remembered language still beats the host\'s default', () => {
    // The order the boot documents: remembered → host → browser. What a host supplies is a DEFAULT
    // and not an override, so a child who chose Spanish yesterday keeps Spanish today.
    saveSettings({ locale: 'es' });
    boot('en');
    expect(pawnLabel()).toBe('e2, peón blanco');
  });
});
