// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/main-3d — the third composition root: the same game, drawn in WebGL.
//
// ========================= WHY A THIRD ROOT AND NOT A FLAG =========================
// Each view is its own page because each is its own DOWNLOAD. The flat board is 110 KB and never
// loads Zdog; the projected board is 148 KB and never loads Three; this one carries Three and
// nothing else. A single bundle with a switch would make every player pay for all three to use
// one, which is the whole reason the view control is a set of LINKS rather than buttons.
//
// ========================= WHAT IS SHARED, WHICH IS ALMOST EVERYTHING =========================
// The rules, the state machine, the engine, the reviewer, the score sheet, the screen-reader grid,
// the panel, protected mode and the title screen are the same modules the other two roots use.
// What differs is one thing: how a position becomes pixels. That is the claim `render/pieces/
// geometry.ts` was written to make good on — it is a TABLE, so Three reads it as readily as Zdog,
// and `tests/pieces3d.node.test.ts` measures the solids against the flat renderer's arithmetic.
//
// ⚠️ The board here does NOT use the engine's 320×180. A pseudo-3D drawing of flat shapes is a
// pixel image and must be upscaled whole; a WebGL scene is resolution-independent by construction,
// and rendering it small to blow it up would throw away the one thing this view is for.

import { createGame } from '@the-inclusionist/engine';
import { srAlert, srSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import { VIZ_FILTER } from '@the-inclusionist/engine/render/viz-modes.js';
import { createChessDeclaration } from '../declaration/chess-declaration.ts';
import { createGridMirror } from '../ui/grid-mirror.ts';
import { createReviewer, type ReviewedMove } from '../chess/reviewer.ts';
import { isBlunder } from '../chess/review.ts';
import { createScoreboard } from '../ui/scoreboard.ts';
import { STUMBLES_BEFORE_HELP } from '../chess/protection.ts';
import { createBlunderBar } from '../ui/blunder-bar.ts';
import type { Suggestion } from '../chess/engine/client.ts';
import { createPlayerStrips } from '../ui/player-strip.ts';
import { createSplash } from '../ui/splash.ts';
import { createHud, type GameMode } from '../ui/hud.ts';
import { applyLayout } from '../ui/layout.ts';
import { createStockfishClient } from '../chess/engine/stockfish-client.ts';
import { DEFAULT_ELO, STRENGTH_LADDER } from '../chess/engine/strength.ts';
import { createThinkingPanel } from '../ui/thinking.ts';
import { loadSettings, resume, save as saveGame, saveSettings } from '../chess/session.ts';
import { createGameState } from '../chess/state.ts';
import { type Side, type Square, toAlgebraic } from '../chess/types.ts';
import { createI18n, preferredLocale } from '../i18n/index.ts';
import { squareCenter } from '../render/board-geometry.ts';
import { ROTATE_HOLD_MS } from '../render/camera.ts';
import { DEFAULT_DESIGN, PIECE_DESIGNS } from '../render/pieces/sets.ts';
import { projectedPalette } from '../render/palette.ts';
import { BOARD_THEMES, boardTheme, DEFAULT_THEME } from '../ui/board-themes.ts';
import { createFrameTicker } from '../render/frame-ticker.ts';
import { TILE } from '../render/resolution.ts';
import { createScene3d } from '../render3d/scene.ts';
import { buildPiece3d, disposePiece3d } from '../render3d/pieces.ts';
import { specs3dFor } from '../render3d/geometry3d.ts';
import * as THREE from 'three';

/** How far a pointer may wander during the hold before it counts as a drag rather than a press. */
const SLOP = 6;

export function boot3d(host: Document = document): void {
  const region = host.getElementById('game-region');
  if (!region) throw new Error('#game-region is required (engine MARCACAO_EXIGIDA)');

  const i18n = createI18n(preferredLocale(navigator.language));
  let motionReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const rules = resume();
  const remembered = loadSettings();
  const mode: GameMode = remembered.mode ?? 'w';
  const playerSide: Side = mode === 'b' ? 'b' : 'w';
  const game = createGameState({ rules, playerSide, opponent: mode !== 'two' });

  let searching = false;
  let hinting = false;
  let cursor: Square = { x: 4, y: 6 };
  let hintsOn = remembered.hints ?? false;
  let hintFen: string | null = null;
  let protectedOn = remembered.protect ?? false;
  let blunderHeld: ReviewedMove | null = null;
  let stumbles = 0;
  let stumbleAt = -1;

  const systemContrast = window.matchMedia?.('(prefers-contrast: more)').matches ?? false;
  let themeKey = remembered.theme ?? (systemContrast ? 'contrast-solid' : DEFAULT_THEME);
  let designKey = remembered.design ?? DEFAULT_DESIGN;
  let vision = 'normal';
  const unlit = (): boolean => themeKey.startsWith('contrast-');

  const thinking = createThinkingPanel({ doc: host, i18n });
  const blunderBar = createBlunderBar({
    doc: host, i18n, onAnswer: (takeBack) => { answerBlunder(takeBack); },
  });

  const opponent = createStockfishClient({ onThought: (thought) => thinking.update(thought) });
  let elo = remembered.elo ?? DEFAULT_ELO;
  opponent.setStrength(elo);

  createSplash({
    doc: host,
    i18n,
    region,
    ready: Promise.allSettled([opponent.ready(), host.fonts?.ready ?? Promise.resolve()])
      .then((results) => { if (results[0].status === 'rejected') throw results[0].reason; }),
  });

  const reviewer = createReviewer({
    rules,
    engine: opponent,
    onChange: () => { scoreboard.refresh(); players.refresh(); hud.refresh(); askOpponent(); },
    onVerdict: (entry) => { onVerdict(entry); },
  });

  const players = createPlayerStrips({
    doc: host, i18n, rules,
    evaluation: () => reviewer.evaluation(),
    mistakes: (side) => reviewer.mistakes(side),
  });

  const scoreboard = createScoreboard({
    doc: host, i18n, rules,
    evaluation: () => reviewer.evaluation(),
    blunders: (side) => reviewer.blunders(side),
  });

  // --- the WebGL stage -------------------------------------------------------
  const canvas = host.createElement('canvas');
  canvas.className = 'stage-3d';
  region.appendChild(canvas);

  const theme = boardTheme(themeKey);
  const scene = createScene3d({
    canvas,
    flipped: playerSide === 'b',
    unlit: unlit(),
    light: theme.light,
    dark: theme.dark,
    rim: theme.rim,
  });

  /**
   * The pieces, rebuilt from the position rather than pooled.
   *
   * ⚠️ Three does NOT free a geometry when its mesh leaves the scene — it is a GPU buffer and it
   * stays there until something disposes it. Rebuilding thirty-two pieces a few times a minute
   * without disposing is a leak that only shows up after a long game, on the machine least able
   * to afford it.
   */
  function syncPieces(): void {
    for (const child of [...scene.pieces.children]) {
      scene.pieces.remove(child);
      disposePiece3d(child as THREE.Group);
    }
    const palette = projectedPalette(boardTheme(themeKey));
    // ⚠️ The 3D table, not the shared one. Two Hartwig pieces in the shared table are the
    // design as a PAINTER'S ALGORITHM can draw it rather than as Hartwig described it — see
    // `render3d/geometry3d.ts`. Neither constraint exists here.
    const specs = specs3dFor(designKey);
    for (const { piece, square } of rules.placements()) {
      /*
       * ⚠️ NO OUTLINE HERE, and that is the point of this view. The flat and projected boards draw
       * one because they have no light: a Zdog piece is a set of coloured shapes sorted by depth,
       * and without a line around it there is nothing to say where one solid stops and the next
       * begins. This scene has three lights and real perspective, which do that job properly —
       * an inverted hull on top of them adds a black rim that reads as a drawing convention
       * carried over from a renderer that needed it.
       *
       * The capability stays in `render3d/pieces.ts`, tested, because it is one argument away.
       */
      const group = buildPiece3d(
        specs[piece.type],
        piece.side === 'w' ? palette.lightPieces : palette.darkPieces,
        { unlit: unlit() },
      );
      const { x, z } = squareCenter(square, TILE);
      group.position.set(x, 0, z);
      scene.pieces.add(group);
    }
    saveGame(rules);
    players.refresh();
    reviewer.observe();
    refreshHints();
  }

  // --- the panel and the screen-reader grid ----------------------------------
  const mirror = createGridMirror({
    doc: host, i18n, rules, state: game,
    onActivate: (square) => onActivate(square),
    onCursor: (square) => { cursor = square; },
  });

  const declaration = createChessDeclaration({ rules, state: game, i18n, cursor: () => cursor });

  const currentSettings = () => ({
    theme: themeKey, design: designKey, coordinates: false,
    mode, elo, hints: hintsOn, protect: protectedOn,
  });

  const hud = createHud({
    doc: host,
    view: '3d',
    i18n,
    rules,
    state: game,
    vision: () => vision,
    onVision: (key) => {
      vision = key;
      region.style.filter = VIZ_FILTER[key] ?? '';
      hud.refresh();
    },
    reducedMotion: () => motionReduced,
    onReducedMotion: (on) => { motionReduced = on; hud.refresh(); },

    debug: /[?&]debug=true/.test(location.search),

    pieceSets: PIECE_DESIGNS.map((d) => ({ key: d.key, label: i18n.t(d.name) })),
    pieceSet: () => designKey,
    onPieceSet: (key) => {
      designKey = key;
      saveSettings({ ...currentSettings(), design: key });
      syncPieces();
    },

    themes: BOARD_THEMES.map((t) => ({ key: t.key, name: t.name })),
    theme: () => themeKey,
    onTheme: (key) => {
      themeKey = key;
      const next = boardTheme(key);
      region.dataset.contrast = key.startsWith('contrast-') ? 'high' : '';
      scene.setBoard(next.light, next.dark, next.rim, unlit());
      saveSettings({ ...currentSettings(), theme: key });
      syncPieces();
    },

    markAt: (ply) => reviewer.markAt(ply),
    scoreboard: scoreboard.root,

    ...(mode === 'two' ? {} : {
      protectedOn: () => protectedOn,
      onProtected: (on) => {
        protectedOn = on;
        if (!on) { blunderHeld = null; blunderBar.show(null); }
        saveSettings({ ...currentSettings(), protect: on });
        hud.refresh();
        askOpponent();
      },
    }),

    strengths: STRENGTH_LADDER.map((rung) => ({ elo: rung.elo, name: rung.name })),
    strength: () => elo,
    onStrength: (next) => {
      elo = next;
      opponent.setStrength(next);
      saveSettings({ ...currentSettings(), elo: next });
      hud.refresh();
      if (game.phase() === 'thinking') { opponent.cancel(); searching = false; askOpponent(); }
    },

    ...(mode === 'two' ? {} : {
      onHint: () => {
        hintsOn = !hintsOn;
        saveSettings({ ...currentSettings(), hints: hintsOn });
        if (!hintsOn) clearHints();
        hud.refresh();
        refreshHints();
      },
      hintsOn: () => hintsOn,
      hintBusy: () => hinting,
    }),

    mode: () => mode,
    onMode: (next) => {
      if (next === mode) return;
      saveSettings({ ...currentSettings(), mode: next });
      try { sessionStorage.setItem('incl_chess_switching', '1'); } catch { /* private mode */ }
      window.location.reload();
    },

    // ⚠️ NO COORDINATE SWITCH HERE, and it is missing on purpose rather than forgotten. The other
    // two views put letters and numbers along a board whose edges are always in the same place.
    // This one turns, so an edge label is either painted on the plinth — where it is upside down
    // half the time — or floated in the air, where it is a HUD element pretending to be scenery.
    // Both are worse than the screen-reader grid, which names every square out loud already.
    coordinates: () => false,
    onCoordinates: () => {},

    canTakeBack: () => game.canTakeBack(),
    canReplay: () => game.canReplay(),
    onTakeBack: () => { game.takeBack(); afterMove(); },
    onReplay: () => { game.replay(); afterMove(); },
  });

  region.appendChild(players.root);
  region.appendChild(hud.report);
  region.appendChild(hud.root);
  region.appendChild(mirror.root);
  region.dataset.contrast = themeKey.startsWith('contrast-') ? 'high' : '';

  const wrap = host.getElementById('stage-wrap');
  wrap?.parentElement?.insertBefore(thinking.root, wrap.nextSibling);
  wrap?.parentElement?.insertBefore(blunderBar.root, thinking.root);

  const engine = createGame({
    declaration,
    host: { doc: host, win: window, cvdHost: host.getElementById('cvd') },
    declines: { semMenuDePausa: true, semAssistenteDePad: true, semAtorDePausa: true },
    // The sonar measures from where the listener is standing, which on a grid is the cursor.
    sonarPlayers: () => [{ i: 0, x: cursor.x, y: cursor.y, viz: 'normal' }],
  });

  // --- hints -----------------------------------------------------------------
  /** The arrows, as flat shapes lying on the board. Rebuilt whenever the advice changes. */
  const arrows = new THREE.Group();
  scene.scene.add(arrows);

  function clearHints(): void {
    hintFen = null;
    for (const child of [...arrows.children]) {
      arrows.remove(child);
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }

  function showHint(moves: readonly Suggestion[]): void {
    clearHints();
    for (const suggestion of moves) {
      const from = squareCenter(suggestion.move.from, TILE);
      const to = squareCenter(suggestion.move.to, TILE);
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const length = Math.hypot(dx, dz);
      if (length < 1e-6) continue;

      // A flat arrow drawn in its own local space and then laid on the board: a rectangle from
      // the tail to the head, plus a triangle for the barbs. Simpler than the flat renderer's
      // path because a mesh can overlap itself without a painter's algorithm minding.
      const shape = new THREE.Shape();
      const w = TILE * 0.09;
      const head = TILE * 0.34;
      shape.moveTo(TILE * 0.34, -w);
      shape.lineTo(length - head, -w);
      shape.lineTo(length - head, -w * 2.4);
      shape.lineTo(length - TILE * 0.06, 0);
      shape.lineTo(length - head, w * 2.4);
      shape.lineTo(length - head, w);
      shape.lineTo(TILE * 0.34, w);
      shape.closePath();

      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({
          color: hintHue(suggestion.behind),
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        }),
      );
      mesh.rotation.set(Math.PI / 2, 0, 0, 'XYZ');
      mesh.rotation.z = Math.atan2(dz, dx);
      // Just above the board's face, so it is drawn ON the squares and under the pieces.
      mesh.position.set(from.x, -0.15, from.z);
      arrows.add(mesh);
    }

    const say = (m: Suggestion): string =>
      `${toAlgebraic(m.move.from)} ${toAlgebraic(m.move.to)}`;
    if (!moves.length) return;
    srSay(moves.length > 1
      ? i18n.t('a11y.hintMany', { move: say(moves[0]), others: moves.slice(1).map(say).join(', ') })
      : i18n.t('a11y.hintOne', { move: say(moves[0]) }));
  }

  function refreshHints(): void {
    const fen = rules.fen();
    if (hintFen !== null && hintFen !== fen) clearHints();
    if (!hintsOn || hinting || game.phase() !== 'idle' || hintFen === fen) return;
    void askHint();
  }

  async function askHint(): Promise<void> {
    if (hinting || game.phase() !== 'idle') return;
    hinting = true;
    thinking.setBusy(true);
    hud.refresh();
    srSay(i18n.t('a11y.hintAsked'));
    try {
      const hint = await opponent.requestHint(rules.fen());
      if (!hint) { srSay(i18n.t('a11y.hintNone')); return; }
      hintFen = rules.fen();
      showHint(hint.ties.length ? hint.ties : [{ move: hint.move, behind: 0 }]);
    } catch {
      srSay(i18n.t('status.engineFailed'));
    } finally {
      hinting = false;
      thinking.setBusy(false);
      hud.refresh();
    }
  }

  // --- protected mode --------------------------------------------------------
  function onVerdict(entry: ReviewedMove): void {
    if (!protectedOn || !isBlunder(entry.mark) || mode === 'two') return;
    if (entry.side !== playerSide) return;
    if (entry.ply !== rules.history().length - 1) return;

    blunderHeld = entry;
    if (stumbleAt !== entry.ply) { stumbleAt = entry.ply; stumbles = 0; }
    stumbles++;
    blunderBar.show({ mark: entry.mark ?? '', lost: entry.lost });
    if (stumbles >= STUMBLES_BEFORE_HELP && !hintsOn) {
      hintsOn = true;
      saveSettings({ ...currentSettings(), hints: hintsOn });
      srSay(i18n.t('protected.teaching'));
      refreshHints();
    }
    hud.refresh();
  }

  function answerBlunder(takeBack: boolean): void {
    if (!blunderHeld) return;
    blunderHeld = null;
    blunderBar.show(null);
    if (takeBack) {
      srSay(i18n.t('protected.tookBack'));
      game.takeBack();
      afterMove();
    } else {
      srSay(i18n.t('protected.kept'));
      hud.refresh();
      askOpponent();
    }
  }

  // --- playing ---------------------------------------------------------------
  function afterMove(): void {
    syncPieces();
    mirror.refresh();
    hud.refresh();
    askOpponent();
  }

  function onActivate(square: Square): void {
    if (game.phase() === 'thinking' || blunderHeld) return;
    const result = game.activate(square);
    if (result.kind === 'moved') {
      game.animationDone();
      srSay(i18n.t('status.played', { move: result.move.san }));
      if (!result.move.checkmate && result.move.check) srAlert(i18n.t('status.check'));
      afterMove();
      announceOutcome();
    } else {
      mirror.refresh();
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

  function askOpponent(): void {
    if (game.phase() !== 'thinking' || searching) return;
    if (blunderHeld) return;
    if (protectedOn && mode !== 'two' && !reviewer.judged(rules.history().length - 1)) return;

    searching = true;
    thinking.setBusy(true);
    srSay(i18n.t('status.thinking'));
    opponent.requestMove(rules.fen())
      .then((reply) => {
        searching = false;
        thinking.setBusy(false);
        if (!reply || game.phase() !== 'thinking') return;
        const result = game.activate(reply.move.from);
        if (result.kind !== 'selected') return;
        const played = game.activate(reply.move.to);
        if (played.kind !== 'moved') return;
        game.animationDone();
        srSay(i18n.t('status.played', { move: played.move.san }));
        if (!played.move.checkmate && played.move.check) srAlert(i18n.t('status.check'));
        afterMove();
        announceOutcome();
      })
      .catch(() => {
        searching = false;
        thinking.setBusy(false);
        srAlert(i18n.t('status.engineFailed'));
      });
  }

  // --- the pointer: a press selects, a HOLD turns the board --------------------
  /*
   * ⚠️ THE SAME ONE-SECOND HOLD THE PROJECTED VIEW USES, and for the same reason: a teacher
   * pointing at a square in front of a class must not spin the board by resting a finger on it.
   * Below the hold a press is a move; past it, and past a few pixels of slop, it is a turn.
   */
  let holding = false;
  let turning = false;
  let last = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let holdTimer = 0;

  canvas.addEventListener('pointerdown', (event) => {
    start = { x: event.clientX, y: event.clientY };
    last = start;
    holding = true;
    turning = false;
    holdTimer = window.setTimeout(() => { if (holding) turning = true; }, ROTATE_HOLD_MS);
    try { canvas.setPointerCapture(event.pointerId); } catch { /* no such pointer */ }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!holding || !turning) return;
    // Both axes inverted: dragging left turns the board as if the table were being pushed left.
    scene.orbit((last.x - event.clientX) * 0.008, (last.y - event.clientY) * 0.006);
    last = { x: event.clientX, y: event.clientY };
  });

  const release = (event: PointerEvent): void => {
    window.clearTimeout(holdTimer);
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (holding && !turning && moved < SLOP) {
      const box = canvas.getBoundingClientRect();
      const square = scene.pick(
        event.clientX - box.left, event.clientY - box.top, box.width, box.height,
      );
      if (square) {
        mirror.focusSquare(square);
        onActivate(square);
      }
    }
    holding = false;
    turning = false;
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* no such pointer */ }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // --- the frame -------------------------------------------------------------
  const ticker = createFrameTicker();
  /*
   * ⚠️ THE ENGINE STILL SIZES THE REGION, and it must. `#game-region` is what the panel, the
   * strips and every `--ui-fs` in the stylesheet are laid out against; without `applyLayout` the
   * region has no size at all and the canvas comes out one pixel by one, which is exactly what
   * the first run did.
   *
   * What this view does NOT do is RENDER at that box's logical 320×180 and upscale. The region is
   * a layout box here, not a pixel grid: the canvas fills the part of it the panel leaves and
   * draws at the device's own resolution. Both statements are true at once, and conflating them
   * is what cost a working first frame.
   */
  const relayout = (): void => {
    applyLayout({ doc: host, win: window });
    const box = region.getBoundingClientRect();
    scene.resize(Math.max(1, box.width * 0.725), Math.max(1, box.height));
  };
  relayout();
  window.addEventListener('resize', relayout);

  startLoop(ticker, () => { scene.render(); }, 2, {
    aoFalhar: (error: unknown) => {
      // ⚠️ A loop that stops silently leaves a frozen picture and a live region that never speaks
      // again. A child who cannot see the screen has no way to know the game has died.
      console.error('[chess3d] frame failed', error);
      srAlert(i18n.t('status.engineFailed'));
    },
  });

  syncPieces();
  mirror.refresh();
  hud.refresh();
  askOpponent();

  if (engine.problems.length) console.warn('[chess3d] engine problems:', engine.problems);
  srSay(i18n.t('a11y.boardLabel'));
}

/** The ramp the flat and projected boards use, read here without importing their drawing code. */
function hintHue(behind: number): string {
  const RAMP = ['#7A4FBF', '#2E64C8', '#1F7A4A', '#B08A00', '#C2600C', '#B3231F'];
  const step = Math.round((Math.min(Math.max(behind, 0), 30) / 30) * (RAMP.length - 1));
  return RAMP[step];
}

if (typeof document !== 'undefined' && document.getElementById('game-region')) boot3d();
