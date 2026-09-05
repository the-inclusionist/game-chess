// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/main — the composition root. The only module that knows PixiJS and the DOM concretely.
//
// Wired: the engine's accessibility stack, real chess rules, the state machine, the Zdog board and
// pieces, the PixiJS surface, the camera, picking, and move animation.
// Not yet, by plan: the opponent (step 6), the DOM grid mirror (step 7), the HUD (step 8).
//
// Everything a player does goes through `game.activate(square)` — pointer and keyboard alike — and
// everything the game says goes through `announce()`. Keeping those two funnels narrow is what will
// let the grid mirror behave identically to a click when it arrives.

import { createGame } from '@pm-monte/inclusionist-engine';
import { srAlert, srSay } from '@pm-monte/inclusionist-engine/core/a11y-sr.ts';
import type {
  Focus, GameDeclaration, Objective, Role, Speakable, Spot,
} from '@pm-monte/inclusionist-engine/core/contract.ts';
import { startLoop } from '@pm-monte/inclusionist-engine/core/loop.ts';
import { initLayout, layout } from '@pm-monte/inclusionist-engine/ui/layout.ts';
import { createRules, type MoveResult } from '../chess/rules.ts';
import { createGameState, type Activation } from '../chess/state.ts';
import { sameSquare, type Square, toAlgebraic } from '../chess/types.ts';
import { createI18n, preferredLocale, type I18n } from '../i18n/index.ts';
import { createMoveAnimation, type MoveAnimation } from '../render/animation.ts';
import { createBoard, type Marker } from '../render/board.ts';
import { squareFromIndex, squareIndex } from '../render/board-geometry.ts';
import { createCamera } from '../render/camera.ts';
import { createPiecesLayer } from '../render/pieces/index.ts';
import { pickTopmost, toIllustrationSpace } from '../render/picking.ts';
import { createPixiSurface } from '../render/pixi-surface.ts';
import { LOGICAL_W } from '../render/resolution.ts';
import { createZdogStage } from '../render/zdog-stage.ts';

/** What the move sounds like. The notation is exact; this is what a person actually hears. */
function moveSentence(i18n: I18n, move: MoveResult): string {
  if (move.castle === 'king') return i18n.t('move.castleShort');
  if (move.castle === 'queen') return i18n.t('move.castleLong');

  const piece = i18n.describePiece(move.piece).text;
  const from = toAlgebraic(move.from);
  const to = toAlgebraic(move.to);

  if (move.captured) {
    return i18n.t('move.capture', {
      piece, from, to, target: i18n.describePiece(move.captured).text,
    });
  }
  if (move.promotion) {
    return i18n.t('move.promotion', {
      to, piece: i18n.describePiece({ type: move.promotion, side: move.piece.side }).text,
    });
  }
  return i18n.t('move.plain', { piece, from, to });
}

export function boot(host: Document = document): void {
  const region = host.getElementById('game-region');
  if (!region) throw new Error('#game-region is required (engine MARCACAO_EXIGIDA)');

  const i18n = createI18n(preferredLocale(navigator.language));
  host.documentElement.lang = i18n.bcp47();

  // Reduced motion straight from the platform. The engine exposes it per element through
  // ui/settings-motion, which is richer and belongs to step 8; this is the honest floor until then.
  const reducedMotion = (): boolean =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const rules = createRules();
  // Hot seat for now. The minimax opponent arrives at step 6 and flips this to true.
  const game = createGameState({ rules, opponent: false });

  let cursor: Square = { x: 4, y: 6 };

  /* ---------- the seven fields, in chess semantics ---------- */

  const declaration: GameDeclaration = {
    topology: { kind: 'grid', cols: 8, rows: 8 },
    tick: 'player',

    roleAt(s: Spot): Role {
      const square = s as Square;
      const piece = rules.pieceAt(square);
      const mine = rules.turn();
      if (!piece) {
        // A square the opponent covers is a HAZARD — and that one line is the whole reason the
        // engine's blind-navigation sonar warns about threats without a word of audio code here.
        return rules.isAttackedBy(square, mine === 'w' ? 'b' : 'w') ? 'hazard' : 'free';
      }
      if (piece.side === mine) return 'structure';
      if (piece.type === 'k') return 'goal';
      return 'key';
    },

    nameAt(s: Spot): Speakable | null {
      const piece = rules.pieceAt(s as Square);
      return piece ? i18n.describePiece(piece) : null;
    },

    focusOf(playerIndex: number): Focus | null {
      if (playerIndex !== 0) return null;
      return { id: 'cursor', at: game.selection() ?? cursor, heading: 'n' };
    },

    objectiveOf(): Objective {
      return {
        name: { text: i18n.t('objective.checkmate'), gender: 'm', plural: false },
        have: game.outcome()?.kind === 'checkmate' ? 1 : 0,
        need: 1,
      };
    },

    targetsOf(playerIndex: number): readonly Spot[] {
      return playerIndex === 0 ? game.legalTargets() : [];
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
  const pieces = createPiecesLayer(stage.root);
  const surface = createPixiSurface(stage.canvas);
  const camera = createCamera();

  surface.view.id = 'board-canvas';
  // Hidden from the screen reader ON PURPOSE — the same pillar the engine applies to its own
  // canvas: the game speaks through the DOM. The grid mirror at step 7 carries the board.
  surface.view.setAttribute('aria-hidden', 'true');
  region.appendChild(surface.view);

  initLayout({ numJogadores: () => 1 });
  layout();
  window.addEventListener('resize', layout);

  let dirty = true;
  let animation: MoveAnimation | null = null;
  const invalidate = (): void => { dirty = true; };

  function syncPieces(): void {
    const flying = game.animating();
    // The rules have ALREADY applied the move, so the travelling piece is standing on its
    // destination. It is left out of the static set and drawn separately, in flight.
    const placements = rules.placements()
      .filter((p) => !(flying && sameSquare(p.square, flying.to)));
    pieces.setPosition(placements);
    pieces.setTravelling(flying ? flying.piece : null);
    invalidate();
  }

  function syncMarkers(): void {
    const markers = new Map<number, Marker>();
    const selected = game.selection();
    if (selected) {
      markers.set(squareIndex(selected), 'selected');
      for (const target of game.legalTargets()) {
        // Shape carries the meaning, not colour: a dot on an empty square, a ring on a capture.
        markers.set(squareIndex(target), rules.pieceAt(target) ? 'capture' : 'move');
      }
    }
    const check = game.kingInCheck();
    if (check) markers.set(squareIndex(check), 'check');
    boardView.setMarkers(markers);
    invalidate();
  }

  function announce(result: Activation): void {
    if (result.kind === 'selected') {
      const piece = rules.pieceAt(result.square);
      const where = toAlgebraic(result.square);
      srSay(piece
        ? `${i18n.t('a11y.selected', { piece: i18n.describePiece(piece).text, square: where })}. `
          + i18n.t('a11y.legalMoves', { count: result.targets.length })
        : i18n.t('square.empty', { square: where }));
      return;
    }

    if (result.kind === 'deselected') {
      srSay(i18n.t('a11y.noSelection'));
      return;
    }

    if (result.kind === 'moved') {
      srSay(moveSentence(i18n, result.move));
      // Check is an EVENT, and an urgent one: assertive, not polite.
      if (!result.move.checkmate && result.move.check) srAlert(i18n.t('status.check'));
      return;
    }

    if (result.kind === 'illegal') {
      const piece = rules.pieceAt(result.square);
      const square = toAlgebraic(result.square);
      srSay(piece
        ? i18n.t('square.occupied', { square, piece: i18n.describePiece(piece).text })
        : i18n.t('square.empty', { square }));
    }
  }

  function announceOutcome(): void {
    const outcome = game.outcome();
    if (!outcome) return;
    if (outcome.kind === 'checkmate') {
      srAlert(i18n.t('status.checkmate', { side: i18n.t(`turn.${outcome.winner}`) }));
    } else if (outcome.kind === 'stalemate') {
      srAlert(i18n.t('status.stalemate'));
    } else {
      srAlert(i18n.t('status.draw'));
    }
  }

  function onActivate(square: Square): void {
    cursor = square;
    const result = game.activate(square);
    if (result.kind === 'moved') {
      animation = createMoveAnimation(result.move.from, result.move.to, {
        reducedMotion: reducedMotion(),
      });
      syncPieces();
    }
    syncMarkers();
    announce(result);
  }

  /* ---------- pointer: drag turns the camera, a click activates a square ---------- */

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
    // A drag that barely moved was a click. Three canvas pixels of slop is about a finger's worth
    // of tremor at k=2, and well under one square.
    if (travelled >= 3) return;

    const rect = surface.view.getBoundingClientRect();
    const k = upscale();
    const point = toIllustrationSpace(
      { x: (e.clientX - rect.left) / k, y: (e.clientY - rect.top) / k },
      stage.viewport(),
    );
    stage.update();
    const hit = pickTopmost(boardView.quads(), point);
    if (hit !== null) onActivate(squareFromIndex(hit));
  });

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

  /**
   * One frame. Named and passed to `startLoop` rather than written inline, so it can also be
   * driven by hand: a browser pane that is hidden never fires requestAnimationFrame, and an
   * animation that only advances when someone takes a screenshot cannot be verified at all.
   */
  function frame(dt: number): void {
    if (animation) {
      const running = animation.advance(dt);
      const at = animation.position();
      pieces.moveTravelling(at.x, at.lift, at.z);
      dirty = true;
      if (!running) {
        animation = null;
        game.animationDone();
        syncPieces();
        syncMarkers();
        announceOutcome();
      }
    }

    if (!dirty) return;
    dirty = false;
    const view = camera.snapshot();
    stage.setCamera(view.pitch, view.yaw);
    stage.render();
    surface.present();
    surface.render();
  }

  startLoop(surface.ticker, frame, 2, {
    // The engine ships this and its own game never wires it: the loop stops on error and NOTHING
    // announces it. A blind child cannot see a frozen screen.
    aoFalhar: (erro: unknown) => {
      srAlert(i18n.t('status.thinking'));
      console.error('[chess] frame loop stopped', erro);
    },
  });

  syncPieces();
  syncMarkers();

  // Diagnostics behind ?debug=true, the same switch the engine's own ui/layout uses. Off by
  // default, so nothing is exposed to a page that did not ask for it — and available when a
  // question needs measuring instead of estimating from a screenshot.
  if (/[?&]debug=true/.test(location.search)) {
    (window as unknown as Record<string, unknown>).__chess = {
      game,
      rules,
      camera,
      /** Client coordinates of a square's centre, for driving the board from the console. */
      screenOf(square: Square): { x: number; y: number } | null {
        stage.update();
        const quad = boardView.quads()[squareIndex(square)];
        if (!quad) return null;
        const cx = (quad.corners[0].x + quad.corners[1].x + quad.corners[2].x + quad.corners[3].x) / 4;
        const cy = (quad.corners[0].y + quad.corners[1].y + quad.corners[2].y + quad.corners[3].y) / 4;
        const view = stage.viewport();
        const rect = surface.view.getBoundingClientRect();
        const k = upscale();
        return {
          x: rect.left + (cx * view.zoom + view.width / 2) * k,
          y: rect.top + (cy * view.zoom + view.height / 2) * k,
        };
      },
      activate: onActivate,
      /** Advances the loop by hand — see `frame`. */
      step: frame,
    };
  }

  if (engine.problems.length) console.warn('[chess] engine problems:', engine.problems);
  srSay(i18n.t('a11y.boardLabel'));
}

if (typeof document !== 'undefined' && document.getElementById('game-region')) boot();
