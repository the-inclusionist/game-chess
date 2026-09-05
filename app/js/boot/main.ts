// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/main — the composition root. The only module that knows PixiJS and the DOM concretely.
//
// What is wired here today: the engine's accessibility stack, the Zdog board, the PixiJS surface,
// the camera, and picking. What is NOT here yet, by plan: the pieces (step 4), the rules and the
// move animation (step 5), the opponent (step 6), the DOM grid mirror (step 7) and the HUD (8).
//
// The starting position below is a FIXTURE, not a model. It exists so the seven fields have
// something true to say — `nameAt` speaks real piece names through the screen reader — and it is
// replaced by chess.js at step 5. It is marked rather than disguised.

import { createGame } from '@pm-monte/inclusionist-engine';
import { srAlert, srSay } from '@pm-monte/inclusionist-engine/core/a11y-sr.ts';
import type {
  Focus, GameDeclaration, Objective, Role, Speakable, Spot,
} from '@pm-monte/inclusionist-engine/core/contract.ts';
import { startLoop } from '@pm-monte/inclusionist-engine/core/loop.ts';
import { initLayout, layout } from '@pm-monte/inclusionist-engine/ui/layout.ts';
import {
  type Piece, type PieceType, sameSquare, type Square, toAlgebraic,
} from '../chess/types.ts';
import { createI18n, preferredLocale } from '../i18n/index.ts';
import { createBoard, type Marker } from '../render/board.ts';
import { squareFromIndex } from '../render/board-geometry.ts';
import { createCamera } from '../render/camera.ts';
import { createPixiSurface } from '../render/pixi-surface.ts';
import { pickTopmost, toIllustrationSpace } from '../render/picking.ts';
import { LOGICAL_W } from '../render/resolution.ts';
import { createZdogStage } from '../render/zdog-stage.ts';

/* ============================ provisional position (replaced at step 5) ============================ */

const BACK_RANK: readonly PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

function startingPosition(): (Piece | null)[][] {
  const rows: (Piece | null)[][] = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
  for (let f = 0; f < 8; f++) {
    rows[0][f] = { type: BACK_RANK[f], side: 'b' };
    rows[1][f] = { type: 'p', side: 'b' };
    rows[6][f] = { type: 'p', side: 'w' };
    rows[7][f] = { type: BACK_RANK[f], side: 'w' };
  }
  return rows;
}

/* ============================ composition ============================ */

export function boot(host: Document = document): void {
  const region = host.getElementById('game-region');
  if (!region) throw new Error('#game-region is required (engine MARCACAO_EXIGIDA)');

  const i18n = createI18n(preferredLocale(navigator.language));
  host.documentElement.lang = i18n.bcp47();

  const board = startingPosition();
  const pieceAt = (s: Spot): Piece | null =>
    (s.y >= 0 && s.y < 8 && s.x >= 0 && s.x < 8) ? board[s.y][s.x] : null;

  let cursor: Square = { x: 4, y: 6 };  // e2
  let selected: Square | null = null;

  const declaration: GameDeclaration = {
    topology: { kind: 'grid', cols: 8, rows: 8 },
    tick: 'player',

    roleAt(s: Spot): Role {
      const p = pieceAt(s);
      if (!p) return 'free';
      if (p.side === 'w') return 'structure';   // own piece: scenery that blocks
      if (p.type === 'k') return 'goal';        // the enemy king is what the round asks for
      return 'key';                             // enemy piece: capturable
      // 'hazard' — squares the opponent attacks — arrives with the rules at step 5.
    },

    nameAt(s: Spot): Speakable | null {
      const p = pieceAt(s);
      return p ? i18n.describePiece(p) : null;
    },

    focusOf(playerIndex: number): Focus | null {
      return playerIndex === 0 ? { id: 'cursor', at: cursor, heading: 'n' } : null;
    },

    objectiveOf(): Objective {
      return {
        name: { text: i18n.t('objective.checkmate'), gender: 'm', plural: false },
        have: 0,
        need: 1,
      };
    },

    targetsOf(): readonly Spot[] {
      return [];  // legal destinations arrive with the rules at step 5
    },
  };

  const engine = createGame({
    declaration,
    host: { doc: host, win: window, cvdHost: host.getElementById('cvd') },
    declines: { semMenuDePausa: true, semAssistenteDePad: true, semAtorDePausa: true },
  });

  /* ---------- render ---------- */

  const stage = createZdogStage();
  const boardView = createBoard(stage.root);
  const surface = createPixiSurface(stage.canvas);
  const camera = createCamera();

  surface.view.id = 'board-canvas';
  // The canvas speaks through the DOM, never to the screen reader directly — the same pillar the
  // engine applies to its own canvas. The grid mirror at step 7 is what carries the board.
  surface.view.setAttribute('aria-hidden', 'true');
  region.appendChild(surface.view);

  // The engine's scaling, not ours: it locks the upscale to whole PHYSICAL pixels, floors it at
  // k=2 so a 2x2 grid fits a government Chromebook, and scopes --tap / --ui-fs / --hud-fs to
  // #game-region for the HUD to inherit. Reinventing it here would drift from the engine's own
  // pixel identity — and the first attempt, plain CSS, stretched the board.
  initLayout({ numJogadores: () => 1 });
  layout();
  window.addEventListener('resize', layout);

  let dirty = true;
  const markers = new Map<number, Marker>();
  const invalidate = (): void => { dirty = true; };

  /* ---------- pointer: drag turns the camera, a click picks a square ---------- */

  /** CSS pixels per canvas pixel. The engine scales the region by a whole number. */
  const upscale = (): number =>
    Math.max(1, surface.view.getBoundingClientRect().width / LOGICAL_W);

  let dragging: number | null = null;
  let last = { x: 0, y: 0 };
  let travelled = 0;

  surface.view.addEventListener('pointerdown', (e) => {
    dragging = e.pointerId;
    last = { x: e.clientX, y: e.clientY };
    travelled = 0;
    surface.view.setPointerCapture(e.pointerId);
  });

  surface.view.addEventListener('pointermove', (e) => {
    if (dragging !== e.pointerId) return;
    const k = upscale();
    const dx = (e.clientX - last.x) / k;
    const dy = (e.clientY - last.y) / k;
    travelled += Math.abs(dx) + Math.abs(dy);
    last = { x: e.clientX, y: e.clientY };
    camera.drag(dx, dy);
    invalidate();
  });

  surface.view.addEventListener('pointerup', (e) => {
    if (dragging !== e.pointerId) return;
    dragging = null;
    surface.view.releasePointerCapture(e.pointerId);
    // A drag that barely moved was a click. Three canvas pixels of slop is about one finger's
    // worth of tremor at k=2, and well under one square.
    if (travelled < 3) selectAtPointer(e);
  });

  function selectAtPointer(e: PointerEvent): void {
    const rect = surface.view.getBoundingClientRect();
    const k = upscale();
    const point = toIllustrationSpace(
      { x: (e.clientX - rect.left) / k, y: (e.clientY - rect.top) / k },
      stage.viewport(),
    );
    stage.update();
    const hit = pickTopmost(boardView.quads(), point);
    if (hit === null) { setSelection(null); return; }
    const square = squareFromIndex(hit);
    // Clicking the selected square again lets go of it, which is the only way to clear a
    // selection with a pointer alone.
    setSelection(selected && sameSquare(selected, square) ? null : square);
  }

  function setSelection(square: Square | null): void {
    selected = square;
    markers.clear();
    if (square) {
      cursor = square;
      markers.set(square.y * 8 + square.x, 'selected');
      const piece = pieceAt(square);
      srSay(piece
        ? i18n.t('a11y.selected', { piece: i18n.describePiece(piece).text, square: toAlgebraic(square) })
        : i18n.t('square.empty', { square: toAlgebraic(square) }));
    } else {
      srSay(i18n.t('a11y.noSelection'));
    }
    boardView.setMarkers(markers);
    invalidate();
  }

  /* ---------- keyboard: everything the pointer can do, without a pointer ---------- */

  // Listened on #game-region, never on window — the engine's rule, and what keeps the camera from
  // swallowing keys meant for a dialog. Plain arrows are reserved for the grid cursor at step 7.
  region.addEventListener('keydown', (e) => {
    if (!e.shiftKey) return;
    const direction = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    }[e.key];
    if (!direction) return;
    camera.nudge(direction as 'left' | 'right' | 'up' | 'down');
    invalidate();
    e.preventDefault();
  });

  /* ---------- frame loop ---------- */

  startLoop(surface.ticker, () => {
    if (!dirty) return;
    dirty = false;
    const view = camera.snapshot();
    stage.setCamera(view.pitch, view.yaw);
    stage.render();
    surface.present();
    surface.render();
  }, 2, {
    // The engine ships this and its own game never wires it: the loop stops on error and NOTHING
    // announces it. A blind child cannot see a frozen screen.
    aoFalhar: (erro: unknown) => {
      srAlert(i18n.t('status.thinking'));
      console.error('[chess] frame loop stopped', erro);
    },
  });

  if (engine.problems.length) console.warn('[chess] engine problems:', engine.problems);
  srSay(i18n.t('a11y.boardLabel'));
}

if (typeof document !== 'undefined' && document.getElementById('game-region')) boot();
