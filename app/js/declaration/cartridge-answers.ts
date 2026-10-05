// SPDX-License-Identifier: AGPL-3.0-or-later
// declaration/cartridge-answers — the two statements a cartridge must make BEFORE it has a page.
//
// ========================= WHY THESE TWO LEFT THE SHELL =========================
// `cartridgeRefusals` — the list `createGame` and `mount()` refuse a cartridge with, and the list
// `inclusionist-check-cartridge` runs in CI — reads the declaration AND the hooks AT IMPORT, in
// Node, with no document. Measured on 2026-10-05: of everything the shell builds, exactly two
// answers are needed to make that list empty, and neither of them needs a page.
//
//   · `accommodations` — which of the engine's eighteen game-keyed rows this game answers (ADR-0153);
//   · the sonar's `preset` — which action carries it.
//
// They used to be written once, inside `createChessCartridge`, where nothing outside a built page
// could read them. Copying them into the cartridge entry would have made two places for eighteen
// booleans to disagree, and the disagreement would be SILENT in the direction that matters: the
// static copy is what a platform refuses on, the live copy is what a platform then runs with, so a
// row that said `false` here and `true` there would pass the gate and lie to the child.
//
// ========================= ⚠️ AND THE DECLARATION IS BUILT TWICE, ON PURPOSE =========================
// `staticDeclaration()` below returns a declaration for a game at the opening position, with no DOM
// anywhere in it. It is NOT the declaration the player gets: the live one reads `rules()`,
// `state()` and `cursor()` — the game actually on the board — and the shell hands it to the engine
// through `mount()` the moment `create(ctx)` has built it.
//
// That is not a duplicate and it is not a stand-in. The engine reads the module-level one ONCE, as
// the cartridge's CONFORMANCE STATEMENT, and `conformanceProblems` says in its own words what it is
// asking: «It checks SHAPE, not truth: that the topology has a positive measure, that the functions
// exist. It cannot check whether `roleAt` returns the RIGHT role.» A chess board is 8×8 at the
// opening position and 8×8 forever, so the shape a fresh game declares is the shape every game of
// chess declares — which is exactly, and only, what is being asked at that moment.
//
// 📌 BUILT FROM THE REAL FACTORY, NOT HAND-WRITTEN. A second hand-written declaration would be a
// second definition of seven fields, and the first time one of them changed shape — as `topology`
// did when `cols`/`rows` became `size` — the hand-written one would keep compiling and keep being
// wrong. This calls `createChessDeclaration` with a real `Rules` and a real `GameState`, so there
// is one definition and the fresh game is merely its argument.

import { createRules } from '../chess/rules.ts';
import { createGameState } from '../chess/state.ts';
import { createI18n } from '../i18n/index.ts';
import type { GameDeclaration } from '@the-inclusionist/engine/core/contract.js';
import type { Square } from '../chess/types.ts';
import { createChessDeclaration } from './chess-declaration.ts';

/** The opening position, in the notation `chess.js` takes. */
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Which of the engine's game-keyed accommodations this game answers — ADR-0153.
 *
 * ⚠️ EVERY ROW IS PRESENT AND EVERY ROW IS `false`, and the engine refuses a cartridge that leaves
 * any of them out rather than defaulting them, which is the right way round: the eighteen are a
 * questionnaire about what a game can soften for a child, and «I did not answer» and «I answer no»
 * are different facts. A missing key would have the engine guessing on a child's behalf.
 *
 * 📌 ALL `false` IS A TRUE ANSWER HERE, not a stub. Chess has no camera to steady, no difficulty to
 * ease, no detection to loosen, no character motion to reduce. The two that look as if they ought
 * to be `true` are worth naming: `pieceSets` and `contrastOutlines` are real choices this game
 * offers, and it offers them through `gameOptions` — its own rows in the engine's options panel —
 * rather than through the accommodation keys, which belong to the engine's own standing controls.
 */
export const CHESS_ACCOMMODATIONS = {
  cameraSway: false, easyMode: false, wheelchairMode: false, detectionLeniency: false,
  intensity: false, hints: false, reducedCharacterMotion: false, caneSpacing: false,
  textPace: false, lexicalDifficulty: false, wordHighlight: false, pieceSets: false,
  distinguishableSuits: false, timingWindow: false, aimAssist: false, repeatedInput: false,
  ownerColors: false, contrastOutlines: false,
} as const;

/**
 * This game's declaration for a board at the opening position, with no document anywhere.
 *
 * ⚠️ CALLED AT MODULE SCOPE BY `src/index.ts`, so it must stay cheap and must stay DOM-free. It is
 * both: `createRules` is `chess.js` over a FEN string, `createGameState` is this repository's own
 * state machine, `createI18n` is three plain objects, and the declaration's `world()` answers with
 * a SELECTOR — `{ kind: 'element', selector: '#game-region' }` — not with an element. That last one
 * is why this works at all, and it was a measurement rather than an assumption.
 */
export function staticDeclaration(): GameDeclaration {
  const rules = createRules(START_FEN);
  const state = createGameState({ rules });
  return createChessDeclaration({
    rules: () => rules,
    state: () => state,
    i18n: createI18n('pt'),
    /*
     * ⚠️ WHITE AND `e4`, AND NEITHER IS ARBITRARY. `playerSide` decides which colour the seven
     * fields describe as the player's, and white is what `createChessDeclaration` already defaults
     * to. `cursor()` must name a square ON the board — the roles are read relative to it — and `e4`
     * is where this game's own cursor starts. A square off the board would make `roleAt` answer
     * about nothing, and the engine's check, which reads SHAPE and not truth, would not notice.
     *
     * 📌 `Square` IS `{x, y}` AND NOT THE STRING `'e4'`, which `tsc` is what caught. Written as a
     * pair here rather than through `fromAlgebraic`, because that returns `Square | null` and the
     * only honest ways to spend the `null` at module scope are an assertion or a throw — both of
     * them ceremony around two numbers that cannot be wrong.
     */
    playerSide: 'w',
    cursor: (): Square => ({ x: 4, y: 3 }),
  });
}
