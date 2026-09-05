// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/engine/strength — the opponent's playing strength, as a number a person can interpret.
//
// ========================= WHY A LADDER AND NOT THREE DIFFICULTIES =========================
// "Easy, medium, hard" says nothing about who you are playing. A rating does, and it is the one
// scale every chess player already owns: a child who knows they are around 1200 can pick 1200 and
// find out whether that is true. Three words cannot do that, and the words drift — one game's
// "hard" is another's "easy".
//
// ========================= ⚠️ THE LABELS WERE RESEARCHED, NOT GUESSED =========================
// The bands below are the US Chess classes and the FIDE titles at their real thresholds, and they
// are NOT the same system — which is why the 2200 line carries two names. Checked rather than
// remembered, because a game that teaches a child "2000 is a candidate master" has taught them
// something they will be corrected on:
//
//  · US Chess CLASSES are where a rating sits now: Class E, D, C, B, A, then Expert at 2000,
//    National Master at 2200, Senior Master at 2400. A class moves with the rating.
//  · FIDE TITLES are permanent awards with rating thresholds: Candidate Master 2200, FIDE Master
//    2300, International Master 2400 (plus norms), Grandmaster 2500 (plus norms).
//
// So 2000 is EXPERT, not "candidate master" — the candidate-master line is 2200, where US Chess
// also puts National Master. That coincidence is worth showing rather than hiding, and both names
// are on that rung.
//
// ========================= ⚠️ AND WHAT AN ENGINE'S ELO IS NOT =========================
// A Stockfish told `UCI_Elo 1600` is calibrated at 120s+1s against CCRL, not against the club
// down the road, and it plays a very different KIND of weak game from a 1600 human: it does not
// get tired, it does not have an opening it fears, and its mistakes are sampled rather than
// believed. The number is a dial with a familiar scale, and the labels are there to make the dial
// legible — not to certify anyone.

export interface StrengthRung {
  /** The Elo the engine is asked to play at. */
  readonly elo: number;
  /** i18n key naming what that rating means. */
  readonly name: string;
}

/**
 * From 1000 in steps of 200 to 2000, then by the thresholds that actually mean something — 2200,
 * 2300, 2400, 2500 — and finally the engine unleashed. The steps are coarse at the bottom because
 * 100 points of difference is not perceptible to a beginner, and fine at the top because that is
 * where each hundred points has a name.
 */
export const STRENGTH_LADDER: readonly StrengthRung[] = [
  { elo: 1000, name: 'elo.1000' },
  { elo: 1200, name: 'elo.1200' },
  { elo: 1400, name: 'elo.1400' },
  { elo: 1600, name: 'elo.1600' },
  { elo: 1800, name: 'elo.1800' },
  { elo: 2000, name: 'elo.2000' },
  { elo: 2200, name: 'elo.2200' },
  { elo: 2300, name: 'elo.2300' },
  { elo: 2400, name: 'elo.2400' },
  { elo: 2500, name: 'elo.2500' },
  { elo: 3000, name: 'elo.3000' },
];

export const DEFAULT_ELO = 1200;

/**
 * ⚠️ Stockfish's own floor is 1320 — `UCI_Elo` will not go below it, and `Skill Level 0` is that
 * same 1320. Everything under that has to be produced another way: by limiting the search to a
 * handful of nodes, which is how a weak engine is made weak honestly rather than by asking it to
 * pretend.
 *
 * The number is the ENGINE'S, read from the `option name UCI_Elo type spin ... min N` line it
 * prints on `uci`, and this constant is only the fallback for an engine that declares nothing.
 */
export const ENGINE_ELO_FLOOR = 1320;

/** The nearest rung at or below a rating, for showing where a chosen number sits. */
export function rungFor(elo: number): StrengthRung {
  let found = STRENGTH_LADDER[0];
  for (const rung of STRENGTH_LADDER) if (rung.elo <= elo) found = rung;
  return found;
}
