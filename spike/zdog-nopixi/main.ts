// SPDX-License-Identifier: AGPL-3.0-or-later
// spike/zdog-nopixi — what the CURRENT board weighs with the compositor taken out.
//
// PixiJS in this app does four things: `new Application`, `Texture.from(zdogCanvas)`, a `Sprite`,
// and a `Container` for a HUD that has been DOM since step 8. The colour-vision correction is a
// CSS filter on the region, not a Pixi filter. So the compositor's whole job is to draw one canvas
// into another canvas, and the engine's own figure for that privilege is 467 kB.
//
// This probe is the same 2D probe plus the REAL Zdog stage, board and pieces, with the Zdog canvas
// put straight into the document. Same picture, no compositor.

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
import { createBoard } from '../../app/js/render/board.ts';
import { createPiecesLayer } from '../../app/js/render/pieces/index.ts';
import { createZdogStage } from '../../app/js/render/zdog-stage.ts';

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
  sonarPlayers: () => [{ i: 0, x: cursor.x, y: cursor.y, viz: 'normal' }],
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

const stage = createZdogStage();
const boardView = createBoard(stage.root);
const pieces = createPiecesLayer(stage.root);
pieces.setPosition(rules.placements());
stage.render();
// Straight into the document. No texture, no sprite, no compositor.
stage.canvas.id = 'board-canvas';
region.insertBefore(stage.canvas, region.firstChild);

applyLayout({ doc: host, win: window });
void opponent;
void boardView;
