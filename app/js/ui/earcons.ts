// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/earcons — the game's own short sounds, synthesised.
//
// ========================= ⚠️ WHY THIS IS HERE AND NOT IN THE ENGINE =========================
// The engine HAS an earcon channel. `platform/audio-earcons.js` plays a table of `SfxDef`s — a
// timbre, a frequency, a duration, an optional ramp, and an i18n key for the caption — and its own
// header is explicit that THE TABLE IS THE GAME'S: "the table is the GAME's; this is the shape the
// engine knows how to play".
//
// But `boot/create-game` does not wire it, and the `Engine` a cartridge receives has no `sfx`. It
// has `captionSound(text)` — the engine hands over the CAPTION a sound should show and not the
// sound. Measured against the installed 11.x on 2026-10-04. It is the same shape of gap already
// recorded for the pause panels in 8.0.0: the capability exists, the door does not.
//
// ⚠️ SO THIS BORROWS THE ENGINE'S VOCABULARY RATHER THAN INVENTING ONE. The table below is written
// as `SfxDef`s, which is the type the engine exports, so the day `createGame` opens `sfx` the table
// moves across unchanged and this file is deleted. A private shape would have had to be translated.
//
// The Dev chose this over a recording on 2026-10-04 (option A), against shipping an audio asset or
// waiting for the engine's door: no file to add to the precache, nothing blocked on anyone.

/*
 * ⚠️ THE SUBPATH, AND `import type` SO NOTHING IS BUNDLED. `SfxDef`'s own comment says it is
 * "EXPORTED (#124)" and it is — through `./platform/*.js`, not through the package root. A value
 * import here would pull the engine's whole audio platform into a cartridge that only wanted the
 * shape of a note.
 */
import type { SfxDef } from '@the-inclusionist/engine/platform/audio-earcons.js';

/**
 * ========================= THE WHISTLE =========================
 * A coach's whistle, for the move Professor II will not accept.
 *
 * ⚠️ TWO SHORT RISING BURSTS, NOT ONE LONG NOTE, and the shape is the meaning. A held tone reads as
 * an error state — something is broken, stop. A pip-pip is a referee: that one does not count, go
 * again. The second burst is what tells them apart, and it costs nothing to play.
 *
 * ⚠️ AND IT HAS TO BE TOLD APART FROM THE ENGINE'S OWN SOUNDS BY EAR. 2.6 kHz is above everything
 * the platform plays for menus and alerts; a real whistle's fipple tone sits around there, which is
 * why it reads as a whistle and not as a beep.
 */
export const WHISTLE: readonly SfxDef[] = [
  { t: 'square', f: 2300, f2: 2800, d: 0.09, cap: 'sfx.whistle' },
  { t: 'square', f: 2300, f2: 2800, d: 0.11, cap: 'sfx.whistle' },
];

/** The gap between the two bursts, in seconds. Short enough to be one gesture, not two sounds. */
const GAP = 0.07;

export interface EarconsDeps {
  /**
   * The engine's caption channel: it shows `text` when the child has captions on, and does nothing
   * otherwise.
   *
   * ⚠️ THE SOUND IS HALF THE SIGNAL AND THE CAPTION IS THE OTHER HALF. A deaf child playing
   * Professor II would otherwise get a move that silently refuses to happen, which is
   * indistinguishable from a broken board. Optional only because a shell without an engine — a
   * test, a bare page — still has to be able to build this.
   */
  readonly caption?: (text: string) => void;
  /** Injected so a test can drive this without a sound card. */
  readonly audio?: () => AudioContext | null;
}

export interface Earcons {
  /** Plays a figure. Silent and harmless where there is no audio to play it with. */
  play(figure: readonly SfxDef[], caption?: string): void;
  destroy(): void;
}

export function createEarcons(deps: EarconsDeps): Earcons {
  let context: AudioContext | null = null;
  let failed = false;

  /*
   * ⚠️ BUILT ON FIRST USE, NOT AT BOOT. A page that constructs an `AudioContext` before the child
   * has touched anything gets one in the `suspended` state — every browser requires a gesture — and
   * on some it earns a console warning on every load. The first whistle follows a click by
   * definition, so that is the right moment.
   */
  const ensure = (): AudioContext | null => {
    if (context || failed) return context;
    if (deps.audio) { context = deps.audio(); return context; }
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!Ctor) { failed = true; return null; }
    try { context = new Ctor(); } catch { failed = true; }
    return context;
  };

  return {
    play(figure, caption) {
      if (caption) deps.caption?.(caption);
      const ac = ensure();
      // ⚠️ NOT AN ERROR. No audio is a page without sound, not a page that is wrong: the caption
      // above has already gone out, and that is the channel this has to keep.
      if (!ac) return;
      void ac.resume?.();

      let at = ac.currentTime;
      for (const part of figure) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = part.t;
        osc.frequency.setValueAtTime(part.f, at);
        /*
         * ⚠️ EXPONENTIAL, because pitch is heard as a RATIO and not as a difference — the engine's
         * own `SfxDef` note says exactly this about `f2`, and a linear ramp sounds crooked.
         */
        if (part.f2) osc.frequency.exponentialRampToValueAtTime(part.f2, at + part.d);
        /*
         * ⚠️ THE ENVELOPE IS NOT DECORATION. An oscillator switched on and off at full gain
         * produces a click at each end — a discontinuity in the waveform — which on a cheap school
         * speaker is louder than the note. Two milliseconds of ramp at each end removes it.
         */
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.18, at + 0.002);
        gain.gain.setValueAtTime(0.18, at + part.d - 0.002);
        gain.gain.linearRampToValueAtTime(0, at + part.d);
        osc.connect(gain).connect(ac.destination);
        osc.start(at);
        osc.stop(at + part.d);
        at += part.d + GAP;
      }
    },

    destroy() {
      void context?.close?.();
      context = null;
    },
  };
}
