// SPDX-License-Identifier: AGPL-3.0-or-later
// spike/2d-weight — what a 2D-only chess actually weighs, built rather than estimated.
//
// The design note put a number on this by subtraction: 600 KB minus the engine's own measured
// 467 KB for PixiJS leaves "roughly 130 KB before fonts", and said in the same sentence that
// arithmetic on two measured numbers is not a measured build. This is the measured build.
//
// It imports everything a DOM-only chess would need and NOTHING from `render/` except the two
// pure-geometry modules the grid mirror already reaches for. If that set can be bundled without
// PixiJS, the bundler will say so by not including it.

import { createGame } from '@the-inclusionist/engine';
import { srSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import { createChessDeclaration } from '../../app/js/declaration/chess-declaration.ts';
import { createEngineClient } from '../../app/js/chess/engine/client.ts';
import { DEFAULT_DIFFICULTY } from '../../app/js/chess/engine/difficulty.ts';
import { createRules } from '../../app/js/chess/rules.ts';
import { createGameState } from '../../app/js/chess/state.ts';
import type { Square } from '../../app/js/chess/types.ts';
import { createI18n, preferredLocale } from '../../app/js/i18n/index.ts';
import { createGridMirror } from '../../app/js/ui/grid-mirror.ts';
import { createHud } from '../../app/js/ui/hud.ts';
import { applyLayout } from '../../app/js/ui/layout.ts';

const host = document;
const region = host.getElementById('game-region');
if (!region) throw new Error('#game-region is required');

const i18n = createI18n(preferredLocale(navigator.language));
const rules = createRules();
const game = createGameState({ rules, opponent: true });
const opponent = createEngineClient();
let cursor: Square = { x: 4, y: 6 };

const declaration = createChessDeclaration({ rules, state: game, i18n, cursor: () => cursor });
const engine = createGame({
  declaration,
  host: { doc: host, win: window, cvdHost: host.getElementById('cvd') },
  declines: { semMenuDePausa: true, semAssistenteDePad: true, semAtorDePausa: true },
  sonarPlayers: () => [{ i: 0, x: cursor.x, y: cursor.y }],
});

const mirror = createGridMirror({
  doc: host,
  i18n,
  rules,
  state: game,
  onActivate: (square) => {
    cursor = square;
    game.activate(square);
    mirror.refresh();
    hud.refresh();
    srSay(String(game.phase()));
  },
  onCursor: (square) => { cursor = square; },
  resolveAction: (code) => engine.keyboard.actionOf(code, 0),
});
region.appendChild(mirror.root);

const hud = createHud({
  doc: host,
  i18n,
  rules,
  state: game,
  difficulty: () => DEFAULT_DIFFICULTY,
  onDifficulty: () => {},
  highContrast: () => false,
  onHighContrast: () => {},
  vision: () => 'normal',
  onVision: () => {},
  reducedMotion: () => false,
  onReducedMotion: () => {},
  outline: () => true,
  onOutline: () => {},
  canTakeBack: () => game.canTakeBack(),
  canReplay: () => game.canReplay(),
  onTakeBack: () => { game.takeBack(); mirror.refresh(); hud.refresh(); },
  onReplay: () => { game.replay(); mirror.refresh(); hud.refresh(); },
});
region.appendChild(hud.root);

applyLayout({ doc: host, win: window });
void opponent;
