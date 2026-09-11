// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/view — the seam between the game and the three ways of drawing it.
//
// ========================= WHAT IS ACTUALLY DIFFERENT BETWEEN THE THREE =========================
// The three composition roots were 2,510 lines and about three fifths of that was the same wiring
// written out three times. The part that genuinely differs is one sentence long: HOW A POSITION
// BECOMES PIXELS. Everything else — the rules, the state machine, the engine, the reviewer, the
// score sheet, the screen-reader grid, the panel, protected mode, the title screen — is the same
// modules in the same order.
//
// This file is that sentence, written as a type. A view supplies five things and the shell
// supplies the rest.
//
// ⚠️ TYPES ONLY, AND THAT IS LOAD-BEARING. Not a convention: this module is imported by the shell,
// which is imported by all three entries, and the flat entry is 104 KB precisely because it never
// loads a renderer. `import type` is erased under `isolatedModules`, so nothing here can pull Zdog
// or Three into a bundle that does not draw with them — but only for as long as everything here
// stays a type. See the allow-list note at the head of `boot/game-shell.ts`.

import type { Piece, Square } from '../chess/types.ts';
import type { Marker } from '../render/board-geometry.ts';
import type { HintMove } from '../render/hint-arrows.ts';
import type { GridMirror } from '../ui/grid-mirror.ts';
import type { HudDeps } from '../ui/hud.ts';
import type { I18n } from '../i18n/index.ts';
import type { Rules } from '../chess/rules.ts';
import type { GameState } from '../chess/state.ts';
import type { ViewSettings } from '../chess/session.ts';

/**
 * The panel controls that belong to the view rather than to the game.
 *
 * A drawing set is a face on the flat board and a shape on the other two; coordinates are labels
 * on one and a data attribute on another; an outline exists only where there is a line to draw.
 * Everything else in the panel — the palette, the mode, the rating, the hint switch, protected
 * mode — asks the same question of every view and is the shell's.
 */
export type HudViewControls = Pick<HudDeps,
  | 'pieceSets' | 'pieceSet' | 'onPieceSet'
  | 'outline' | 'onOutline'
  | 'coordinates' | 'onCoordinates'>;

/** The remembered choices, read once and written back by MERGE. Never by replacement. */
export interface Prefs {
  readonly remembered: ViewSettings;
  save(patch: ViewSettings): void;
}

/** What the shell hands a view when it builds it. */
export interface ViewContext {
  readonly doc: Document;
  readonly region: HTMLElement;
  readonly i18n: I18n;
  /**
   * ⚠️ ACCESSORS. A lesson step with a new position is a new `Rules` and a new `GameState` — see
   * the note in `ui/grid-mirror.ts` — so a view that remembered either would keep drawing the
   * board the lesson has already left.
   */
  rules(): Rules;
  state(): GameState;
  /**
   * ⚠️ THE SHELL BUILDS THIS, not the view, because all three pages have one. On the flat page it
   * IS the board, with its `sr-only` taken off; on the other two it is the accessible mirror
   * behind an `aria-hidden` canvas. One object, two jobs, and the difference is a boolean.
   */
  readonly mirror: GridMirror;
  readonly playerSide: 'w' | 'b';
  readonly prefs: Prefs;
  reducedMotion(): boolean;
  /** The one funnel. A view calls this when a pointer picks a square, and nothing else. */
  activate(square: Square): void;
  /** A key CODE resolved to an intent, through the engine's remappable runtime. */
  keyIntent(code: string): string | null;
}

export interface BoardView {
  readonly hudControls: HudViewControls;
  /** Repaints from a named palette. The shell owns remembering it. */
  applyTheme(key: string): void;
  /**
   * Draws the position the rules are in NOW.
   *
   * ⚠️ `hidden` AND `travelling` ARE FOR A VIEW THAT FLIES THE ORIGINAL PIECE. The projected board
   * withholds the traveller from its static set and draws it separately, so it must not appear at
   * both ends at once. The flat board flies a COPY — `grid-mirror.animate` clones the glyph
   * standing on `to` — so it draws the position complete and consults neither argument, and it
   * must be drawn complete BEFORE the flight or there is no glyph to clone.
   *
   * Same two calls in the same order on every page. One view simply does not read the argument.
   */
  drawPosition(hidden: readonly Square[], travelling: Piece | null): void;
  /**
   * Draws what is marked and what is suggested.
   *
   * The markers are shape-coded, never colour alone (WCAG 1.4.1) — see `render/board-geometry.ts`.
   * A view with no marker channel of its own draws the arrows and ignores the map; the words are
   * on the mirror's labels either way, which is where they have to be.
   */
  drawMarks(markers: ReadonlyMap<number, Marker>, hints: readonly HintMove[]): void;
  /**
   * Flies a piece, and resolves when it lands.
   *
   * ⚠️ RESOLVES IMMEDIATELY UNDER REDUCED MOTION, and that is `render/animation.ts`'s rule rather
   * than a shortcut: reduced motion is NO animation, not a shorter one. A view that waited for a
   * frame there would hang forever on a pane the browser has stopped ticking.
   */
  travel(from: Square, to: Square): Promise<void>;
  /**
   * One frame, `dt` in FRAMES. Absent on a view with nothing to animate.
   *
   * ⚠️ THE VIEW NO LONGER OWNS ITS CLOCK, and ADR-0139 §3 is the reason rather than tidiness: a
   * cartridge never calls `startLoop`, because inside a platform the loop is the page's and a
   * second one is a second 60 wake-ups a second on the machine least able to afford it. Two of
   * these three views used to build a ticker and a loop apiece; now the shell builds one and asks
   * whoever is drawing.
   *
   * ⚠️ AND THE ANNOUNCER CAME WITH THE MOVE. Both views passed `console.error` to `aoFalhar` —
   * which tells whoever has the console open and nobody else. The engine's `aoFalhar` reaches the
   * screen reader, and a child who cannot see the screen cannot tell a frozen board from a
   * thinking one.
   *
   * The flat board has no `frame`: it draws a position and stops, which is the measurement that
   * kept it at 104 KB against 146.
   */
  frame?(dt: number): void;
  relayout(): void;
  /**
   * A key the shell did not want. Return true when it was used, and the shell calls
   * `preventDefault` — so a view says what it consumed rather than reaching for the event itself.
   *
   * ⚠️ ONLY ONE LISTENER EXISTS, and it is the shell's. Two listeners on `#game-region` is two
   * places for a key to be swallowed, and the second one is always the one nobody remembers.
   */
  onKey?(event: KeyboardEvent): boolean;
  /** Extras merged into the `?debug=true` global. */
  debug?(): Record<string, unknown>;
  destroy(): void;
}

export type ViewFactory = (ctx: ViewContext) => BoardView;
