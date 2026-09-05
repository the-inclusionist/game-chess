// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/grid-mirror — the board, in the DOM, for everyone who is not looking at the canvas.
//
// ========================= THE CANVAS IS NOT THE SOURCE OF TRUTH =========================
// The canvas is `aria-hidden` on purpose — the same pillar the engine applies to its own: the
// game speaks through the DOM. This module IS the board as far as a screen reader is concerned:
// 64 real buttons in a real grid, each labelled in algebraic notation with what stands on it.
//
// It routes every action through `onActivate`, which is the same funnel a click uses. That is why
// `state.activate(square)` was built as the one door in: keyboard and pointer cannot drift apart
// if there is nowhere for them to drift to.
//
// ========================= THE CHOICES WORTH DEFENDING =========================
//
//  · REAL BUTTONS, with `role="gridcell"` layered on. The role gives the grid its row and column
//    semantics; the ELEMENT keeps its activation behaviour, so Enter and Space work because the
//    platform makes them work and not because this file re-implements them.
//
//  · ROVING TABINDEX. One cell is in the tab order at a time. Sixty-four tab stops on the way past
//    a chess board would be its own accessibility failure.
//
//  · `aria-selected`, not a word in the label. The screen reader then says "selected" in the
//    user's own language rather than in whatever this catalogue happens to carry.
//
//  · THE MARKERS THAT ARE WORDS AVOID GENDER. "lance possível" and "captura possível" attach to
//    any piece; "selecionada" would not. The catalogue carries gender for the piece NOUN and
//    nothing else, so every other phrase is written to sidestep agreement.
//
//  · FOCUS IS MIRRORED ONTO THE BOARD. This grid is visually hidden, so a sighted person moving
//    by keyboard would have focus in a place they cannot see. The `cursor` marker is that focus,
//    drawn on the canvas.

import type { Rules } from '../chess/rules.ts';
import type { GameState } from '../chess/state.ts';
import { FILES, RANKS, sameSquare, type Square, toAlgebraic } from '../chess/types.ts';
import type { I18n } from '../i18n/index.ts';
import { squareFromIndex, squareIndex } from '../render/board-geometry.ts';

export interface GridMirrorDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  readonly rules: Rules;
  readonly state: GameState;
  /** The same handler a click uses. */
  onActivate(square: Square): void;
  /** Called when the keyboard cursor moves, so the board can draw it. */
  onCursor?(square: Square): void;
  /**
   * Turns a key CODE into an intent, so the board can be walked with whatever keys the player
   * can reach. The engine's KeyboardRuntime is the real one and it is remappable and saved;
   * without it this falls back to the arrows alone.
   *
   * Injected rather than imported so the grid can be tested without booting an engine.
   */
  resolveAction?(code: string): string | null;
}

export interface GridMirror {
  readonly root: HTMLElement;
  /** Re-labels every cell from the current position. Call after anything changes. */
  refresh(): void;
  focusSquare(square: Square): void;
  cursor(): Square;
  destroy(): void;
}

const CELL_COUNT = FILES * RANKS;

export function createGridMirror(deps: GridMirrorDeps): GridMirror {
  const { doc, i18n, rules, state } = deps;

  const root = doc.createElement('div');
  root.className = 'sr-only';
  root.setAttribute('role', 'grid');
  root.setAttribute('aria-label', `${i18n.t('a11y.boardLabel')}. ${i18n.t('a11y.gridHint')}`);
  root.setAttribute('aria-rowcount', String(RANKS));
  root.setAttribute('aria-colcount', String(FILES));

  const cells: HTMLButtonElement[] = [];

  for (let y = 0; y < RANKS; y++) {
    const row = doc.createElement('div');
    row.setAttribute('role', 'row');
    row.setAttribute('aria-rowindex', String(y + 1));

    for (let x = 0; x < FILES; x++) {
      const cell = doc.createElement('button');
      cell.type = 'button';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-colindex', String(x + 1));
      cell.dataset.square = toAlgebraic({ x, y });
      cell.tabIndex = -1;
      row.appendChild(cell);
      cells.push(cell);
    }
    root.appendChild(row);
  }

  // Starts on e2 — the square a beginner is most likely to want first, and a sensible place for
  // focus to land rather than the far corner.
  let cursor: Square = { x: 4, y: 6 };

  function labelFor(square: Square): string {
    const where = toAlgebraic(square);
    const piece = rules.pieceAt(square);
    const base = piece
      ? i18n.t('square.occupied', { square: where, piece: i18n.describePiece(piece).text })
      : i18n.t('square.empty', { square: where });

    const extras: string[] = [];
    if (state.legalTargets().some((t) => sameSquare(t, square))) {
      extras.push(piece ? i18n.t('a11y.cellCapture') : i18n.t('a11y.cellMove'));
    }
    const check = state.kingInCheck();
    if (check && sameSquare(check, square)) extras.push(i18n.t('a11y.cellCheck'));

    return extras.length ? `${base}, ${extras.join(', ')}` : base;
  }

  function refresh(): void {
    const selected = state.selection();
    for (let i = 0; i < CELL_COUNT; i++) {
      const square = squareFromIndex(i);
      const cell = cells[i];
      cell.setAttribute('aria-label', labelFor(square));
      // aria-selected rather than a word in the label: the reader says it in the user's language.
      cell.setAttribute('aria-selected', String(!!selected && sameSquare(selected, square)));
      cell.tabIndex = sameSquare(square, cursor) ? 0 : -1;
    }
  }

  function setCursor(square: Square, moveFocus: boolean): void {
    cursor = square;
    for (let i = 0; i < CELL_COUNT; i++) {
      cells[i].tabIndex = i === squareIndex(square) ? 0 : -1;
    }
    if (moveFocus) cells[squareIndex(square)].focus();
    deps.onCursor?.(square);
  }

  const clamp = (n: number, hi: number): number => Math.min(hi, Math.max(0, n));

  /** Arrows only. The fallback for when no engine is wired — a test, or a bare page. */
  const FALLBACK: Record<string, string> = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  };

  function onKeyDown(event: KeyboardEvent): void {
    // Clamped at the edges rather than wrapped. A board has corners, and a player who runs into
    // one should feel the edge instead of being teleported to the far file.
    const DELTA: Record<string, [number, number]> = {
      left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1],
    };
    const action = deps.resolveAction?.(event.code) ?? FALLBACK[event.key] ?? null;
    const delta = action ? DELTA[action] : undefined;
    if (delta) {
      setCursor(
        { x: clamp(cursor.x + delta[0], FILES - 1), y: clamp(cursor.y + delta[1], RANKS - 1) },
        true,
      );
      event.preventDefault();
      return;
    }

    if (event.key === 'Home') {
      setCursor({ x: 0, y: event.ctrlKey ? 0 : cursor.y }, true);
      event.preventDefault();
    } else if (event.key === 'End') {
      setCursor({ x: FILES - 1, y: event.ctrlKey ? RANKS - 1 : cursor.y }, true);
      event.preventDefault();
    }
  }

  function onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest('button');
    if (!target) return;
    const index = cells.indexOf(target as HTMLButtonElement);
    if (index < 0) return;
    const square = squareFromIndex(index);
    setCursor(square, false);
    deps.onActivate(square);
  }

  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('click', onClick);

  refresh();

  return {
    root,
    refresh,
    cursor: () => cursor,
    focusSquare: (square) => setCursor(square, true),
    destroy() {
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('click', onClick);
      root.remove();
    },
  };
}
