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
//  · FOCUS IS MIRRORED ONTO THE BOARD. When this grid is visually hidden, a sighted person moving
//    by keyboard would have focus in a place they cannot see. The `cursor` marker is that focus,
//    drawn on the canvas.
//
// ========================= AND IT IS ALSO THE 2D BOARD =========================
// `visible: true` takes the `sr-only` off and puts a glyph in each cell. That is the whole of the
// 2D mode's board, and it is not a shortcut: this grid was already 64 real buttons in a real grid,
// with roving tabindex, `aria-selected`, arrow navigation clamped at the edges, and one funnel to
// `onActivate` shared with the pointer. Building a second board for the 2D view would have meant
// building all of that again and then keeping two of them correct.
//
// The glyph is `aria-hidden`: the meaning is in the label, in the player's language and with the
// piece's gender attached. Which is why the piece SET is a free choice — see `ui/piece-sets.ts`.

import type { Rules } from '../chess/rules.ts';
import type { GameState } from '../chess/state.ts';
import { FILES, RANKS, sameSquare, type Square, toAlgebraic } from '../chess/types.ts';
import type { I18n } from '../i18n/index.ts';
import { boardTheme, DEFAULT_THEME, type BoardTheme } from './board-themes.ts';
import { DEFAULT_SET, pieceSet, type PieceSet } from './piece-sets.ts';
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
  /** Show the grid and draw pieces in it: this is the 2D board. Default false. */
  readonly visible?: boolean;
  /** Which drawing to use. Only consulted when visible. */
  readonly set?: string;
  /** Which board colours. Only consulted when visible. */
  readonly theme?: string;
}

export interface GridMirror {
  readonly root: HTMLElement;
  /** Re-labels every cell from the current position. Call after anything changes. */
  refresh(): void;
  focusSquare(square: Square): void;
  cursor(): Square;
  /** Swaps the drawing. No effect on anything a screen reader hears. */
  setPieceSet(key: string): void;
  pieceSetKey(): string;
  /** Swaps the board colours. Also nothing a screen reader hears. */
  setTheme(key: string): void;
  themeKey(): string;
  /**
   * Slides a piece from one square to another and resolves when it lands.
   *
   * ========================= WHY A FLAT BOARD ANIMATES AT ALL =========================
   * The projected board animates because a piece crossing it is a thing moving through space. A
   * flat board could simply redraw, and the first version did — but a redraw gives no answer to
   * "what just happened", and the opponent's reply in particular arrives with nobody watching the
   * square it came from. The travel IS the explanation, and it costs one element.
   *
   * Resolves immediately, with nothing drawn, under reduced motion — the same rule
   * `render/animation.ts` states for the other board: reduced motion is NO animation, not a
   * shorter one.
   */
  animate(from: Square, to: Square, options?: { reducedMotion?: boolean }): Promise<void>;
  destroy(): void;
}

const CELL_COUNT = FILES * RANKS;

const FILE_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

/**
 * How long a piece takes to cross. The projected board uses 20 frames, which is a third of a
 * second at 60 fps; this is the same duration said in the unit a Web Animation speaks.
 */
const FLIGHT_MS = 333;

export function createGridMirror(deps: GridMirrorDeps): GridMirror {
  const { doc, i18n, rules, state } = deps;

  const visible = deps.visible ?? false;
  let set: PieceSet = pieceSet(deps.set ?? DEFAULT_SET);
  let theme: BoardTheme = boardTheme(deps.theme ?? DEFAULT_THEME);

  const root = doc.createElement('div');
  root.className = visible ? 'board-2d' : 'sr-only';
  root.setAttribute('role', 'grid');
  root.setAttribute('aria-label', `${i18n.t('a11y.boardLabel')}. ${i18n.t('a11y.gridHint')}`);
  root.setAttribute('aria-rowcount', String(RANKS));
  root.setAttribute('aria-colcount', String(FILES));

  const cells: HTMLButtonElement[] = [];
  const glyphs: HTMLElement[] = [];

  /**
   * Publishes the whole palette as custom properties. One write reaches 64 cells and every glyph,
   * and it is the only place a colour is decided — the stylesheet then has no per-theme rules to
   * keep in step, which is what let the high-contrast board go on wearing the projected board's
   * yellow long after that stopped making sense.
   */
  function applyTheme(): void {
    root.dataset.theme = theme.key;
    root.style.setProperty('--square-light', theme.light);
    root.style.setProperty('--square-dark', theme.dark);
    root.style.setProperty('--piece-white', theme.white);
    root.style.setProperty('--piece-black', theme.black);
    root.style.setProperty('--piece-white-rim', theme.whiteRim);
    root.style.setProperty('--piece-black-rim', theme.blackRim);
    root.style.setProperty('--piece-halo', theme.rim);
  }

  /** A corner mark on a cell. Hidden from the reader: the cell's own label already says "e4". */
  function coordLabel(kind: 'file' | 'rank', text: string): HTMLElement {
    const mark = doc.createElement('span');
    mark.className = 'cell-coord';
    mark.dataset.kind = kind;
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = text;
    return mark;
  }

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
      // a1 is dark, and the parity that gives it is (x + y) EVEN = light — the same rule
      // `render/board.ts` proves for the 3D squares, so the two boards cannot disagree.
      cell.dataset.shade = (x + y) % 2 === 0 ? 'light' : 'dark';
      cell.tabIndex = -1;
      if (visible) {
        const glyph = doc.createElement('span');
        glyph.className = 'cell-piece';
        // The label already says what stands here, in the player's language and with the piece's
        // gender. A glyph read out on top of that would be noise.
        glyph.setAttribute('aria-hidden', 'true');
        cell.appendChild(glyph);
        glyphs.push(glyph);

        // The coordinates, which on a flat board need no projection at all: the file letter
        // belongs in the bottom row and the rank number in the first column. `ui/coordinates`
        // exists because Zdog has no text primitive — here the cells are text already.
        if (y === RANKS - 1) cell.appendChild(coordLabel('file', FILE_NAMES[x]));
        if (x === 0) cell.appendChild(coordLabel('rank', String(RANKS - y)));
      }
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
    const targets = state.legalTargets();
    const check = state.kingInCheck();

    for (let i = 0; i < CELL_COUNT; i++) {
      const square = squareFromIndex(i);
      const cell = cells[i];
      cell.setAttribute('aria-label', labelFor(square));
      // aria-selected rather than a word in the label: the reader says it in the user's language.
      cell.setAttribute('aria-selected', String(!!selected && sameSquare(selected, square)));
      cell.tabIndex = sameSquare(square, cursor) ? 0 : -1;

      if (!visible) continue;
      const piece = rules.pieceAt(square);
      const glyph = glyphs[i];
      const drawn = piece ? set.glyph[piece.side][piece.type] : '';
      glyph.textContent = drawn;
      // The same character again, for the silhouette drawn behind it. A pseudo-element can only
      // take its content from an attribute, and repeating it here is what lets the whole rim be
      // CSS — no second element per cell, nothing to keep in step when a set changes.
      if (drawn) glyph.dataset.glyph = drawn;
      else delete glyph.dataset.glyph;
      // The side is a data attribute rather than a colour written here, so the stylesheet owns
      // the palette and the high-contrast variant can override it in one place. It is also what
      // carries the side for a coloured set, whose glyph cannot be tinted at all.
      if (piece) glyph.dataset.side = piece.side;
      else delete glyph.dataset.side;

      // Never colour alone: a legal move is a marked cell AND a named one — the label already
      // carries "lance possível". This is the visual half of the same fact.
      const legal = targets.some((t) => sameSquare(t, square));
      const mark = legal ? (piece ? 'capture' : 'move') : '';
      if (mark) cell.dataset.mark = mark;
      else delete cell.dataset.mark;

      if (check && sameSquare(check, square)) cell.dataset.check = 'true';
      else delete cell.dataset.check;
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

  if (visible) {
    root.dataset.set = set.key;
    root.style.setProperty('--piece-font', set.family);
    applyTheme();
  }

  refresh();

  return {
    root,

    pieceSetKey: () => set.key,
    themeKey: () => theme.key,

    setTheme(key) {
      theme = boardTheme(key);
      applyTheme();
    },

    async animate(from, to, options = {}) {
      const source = cells[squareIndex(from)];
      const target = cells[squareIndex(to)];
      const glyph = glyphs[squareIndex(to)];
      // Nothing to fly, or nobody to see it fly.
      if (!visible || !glyph || options.reducedMotion) return;

      const a = source.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      if (!a.width || !b.width) return;   // laid out yet? in a detached tree it is not

      const flight = doc.createElement('span');
      flight.className = 'cell-flight';
      flight.setAttribute('aria-hidden', 'true');
      flight.style.width = `${a.width}px`;
      flight.style.height = `${a.height}px`;
      flight.style.left = `${a.left}px`;
      flight.style.top = `${a.top}px`;
      // A copy of the destination glyph, which is where the piece already stands as far as the
      // rules are concerned — the same arrangement the 3D board uses, for the same reason.
      const copy = glyph.cloneNode(true) as HTMLElement;
      copy.classList.remove('cell-piece');
      copy.classList.add('cell-piece');
      flight.appendChild(copy);
      doc.body.appendChild(flight);

      // The real piece waits at its destination until the copy gets there.
      const wasHidden = glyph.style.visibility;
      glyph.style.visibility = 'hidden';

      const travel = flight.animate(
        [
          { transform: 'translate(0px, 0px)' },
          { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px)` },
        ],
        { duration: FLIGHT_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
      );

      try {
        await travel.finished;
      } catch {
        // Cancelled — the board moved on. Landing is still the right thing to do.
      }
      flight.remove();
      glyph.style.visibility = wasHidden;
    },

    setPieceSet(key) {
      set = pieceSet(key);
      root.dataset.set = set.key;
      root.style.setProperty('--piece-font', set.family);
      refresh();
    },
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
