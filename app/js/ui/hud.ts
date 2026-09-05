// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/hud — turn, captured pieces, the move list, and how hard the opponent plays.
//
// ========================= WHY THIS IS DOM AND NOT PIXI =========================
// The plan said the HUD would be drawn in PixiJS, on the grounds that Zdog has no text. The first
// half is true and the conclusion was wrong.
//
// At 320×180 a HUD line is about seven pixels tall. In a canvas that is illegible without a bitmap
// font, it cannot be resized by anyone who needs it larger, and a screen reader cannot see it at
// all. In the DOM it is text: it scales with `--ui-fs` (which the engine's own `ui/layout` sets to
// `8·k`, so 16 px at the k=2 floor), it honours the reader's own font size, the difficulty control
// gets a 44 px tap target from `--tap` without being asked, and the move list is simply readable.
//
// This is also how the ENGINE does it. `--ui-fs` and `--tap` are scoped to `#game-region` precisely
// because the engine's own UI is DOM laid over the canvas, and its colour-vision filters are
// SVG/CSS — they reach the DOM as readily as the canvas, which is what `VIZ_DOM_ONLY` is about.
//
// PixiJS still earns its keep: it composites the Zdog frame, it owns the layer order, and the
// post-processing applies to the BOARD. Only the text argument was mistaken.

import type { Difficulty } from '../chess/engine/difficulty.ts';
import { DIFFICULTIES } from '../chess/engine/difficulty.ts';
import type { Rules } from '../chess/rules.ts';
import type { GameState } from '../chess/state.ts';
import type { PieceType, Side } from '../chess/types.ts';
import type { I18n } from '../i18n/index.ts';

export interface HudDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  readonly rules: Rules;
  readonly state: GameState;
  difficulty(): Difficulty;
  onDifficulty(level: Difficulty): void;
}

export interface Hud {
  readonly root: HTMLElement;
  refresh(): void;
  destroy(): void;
}

/** Figurine letters. Not the piece NAME — that is the screen reader's job, and it is spoken. */
const GLYPH: Readonly<Record<PieceType, string>> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
};

/** Heaviest first, so a captured queen is not buried behind six pawns. */
const ORDER: readonly PieceType[] = ['q', 'r', 'b', 'n', 'p'];

export function createHud(deps: HudDeps): Hud {
  const { doc, i18n, rules, state } = deps;

  const root = doc.createElement('div');
  root.className = 'hud';

  // --- turn ------------------------------------------------------------------
  const turn = doc.createElement('p');
  turn.className = 'hud-turn';
  const swatch = doc.createElement('span');
  swatch.className = 'hud-swatch';
  swatch.setAttribute('aria-hidden', 'true');   // colour alone says nothing; the text carries it
  const turnText = doc.createElement('span');
  turn.append(swatch, turnText);

  // --- captured --------------------------------------------------------------
  const capturedBox = doc.createElement('section');
  const capturedTitle = doc.createElement('h2');
  const capturedByPlayer = doc.createElement('p');
  const capturedByOpponent = doc.createElement('p');
  capturedByPlayer.className = 'hud-captured';
  capturedByOpponent.className = 'hud-captured';
  capturedBox.append(capturedTitle, capturedByPlayer, capturedByOpponent);

  // --- move list -------------------------------------------------------------
  const movesBox = doc.createElement('section');
  const movesTitle = doc.createElement('h2');
  const movesList = doc.createElement('ol');
  movesList.className = 'hud-moves';
  // NOT a live region. Every move is already announced through srSay the moment it is played;
  // a live list would say each one twice, which is worse than saying it once.
  movesBox.append(movesTitle, movesList);

  // --- difficulty ------------------------------------------------------------
  const difficultyBox = doc.createElement('p');
  const difficultyLabel = doc.createElement('label');
  const difficultySelect = doc.createElement('select');
  difficultySelect.id = 'hud-difficulty';
  difficultyLabel.htmlFor = difficultySelect.id;
  for (const level of DIFFICULTIES) {
    const option = doc.createElement('option');
    option.value = level;
    difficultySelect.appendChild(option);
  }
  difficultyBox.append(difficultyLabel, difficultySelect);

  root.append(turn, capturedBox, movesBox, difficultyBox);

  function onDifficultyChange(): void {
    deps.onDifficulty(difficultySelect.value as Difficulty);
  }
  difficultySelect.addEventListener('change', onDifficultyChange);

  function capturedFor(side: Side): string {
    // Reading the history rather than keeping a tally: one source of truth, and a taken-back move
    // corrects the list for free instead of needing its own undo path.
    const taken: PieceType[] = [];
    for (const move of rules.history()) {
      if (move.captured && move.captured.side === side) taken.push(move.captured.type);
    }
    taken.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    return taken.map((t) => GLYPH[t]).join('');
  }

  function describeCaptured(side: Side): string {
    const glyphs = capturedFor(side);
    return glyphs || '—';
  }

  /** "1. e4 e5" per line, which is how a scoresheet reads. */
  function fillMoves(): void {
    const history = rules.history();
    movesList.replaceChildren();
    for (let i = 0; i < history.length; i += 2) {
      const item = doc.createElement('li');
      item.textContent = history[i + 1]
        ? `${history[i].san} ${history[i + 1].san}`
        : history[i].san;
      movesList.appendChild(item);
    }
    movesList.scrollTop = movesList.scrollHeight;
  }

  function refresh(): void {
    const side = rules.turn();
    swatch.dataset.side = side;
    turnText.textContent = i18n.t(`turn.${side}`);
    // The heading says what the colour block means, so the block is decoration and not the signal.
    turn.setAttribute('aria-label', `${i18n.t('hud.turn')}: ${i18n.t(`turn.${side}`)}`);

    capturedTitle.textContent = i18n.t('hud.captured');
    capturedByPlayer.textContent = describeCaptured('b');
    capturedByPlayer.setAttribute('aria-label',
      `${i18n.t('turn.w')}: ${describeCaptured('b')}`);
    capturedByOpponent.textContent = describeCaptured('w');
    capturedByOpponent.setAttribute('aria-label',
      `${i18n.t('turn.b')}: ${describeCaptured('w')}`);

    movesTitle.textContent = i18n.t('hud.moves');
    fillMoves();

    difficultyLabel.textContent = i18n.t('hud.difficulty');
    for (const option of difficultySelect.options) {
      option.textContent = i18n.t(`difficulty.${option.value}`);
    }
    difficultySelect.value = deps.difficulty();

    const outcome = state.outcome();
    root.dataset.outcome = outcome ? outcome.kind : '';
  }

  refresh();

  return {
    root,
    refresh,
    destroy() {
      difficultySelect.removeEventListener('change', onDifficultyChange);
      root.remove();
    },
  };
}
