// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/piece-sets — what the 2D board draws a piece WITH. Data, and nothing else.
//
// ========================= WHY A SET IS A CHEAP THING TO OFFER =========================
// The meaning of a square lives in the `aria-label` of `ui/grid-mirror.ts`, in the player's own
// language, with the piece's grammatical gender attached. A glyph is `aria-hidden` decoration on
// top of that. So changing the set changes NOTHING a screen reader hears — it is a legibility
// control with no semantic surface, which is what makes it worth having several.
//
// ========================= WHERE THE FONTS COME FROM =========================
// The stacks below name the family and then fall back through what a machine is likely to have.
// ⚠️ THE WOFF2 SUBSETS ARE NOT VENDORED YET, and until they are, these sets render in whatever the
// system supplies — Segoe UI Symbol on Windows, DejaVu on most Linux, Apple Symbols on macOS. That
// degrades to a usable board everywhere and to an IDENTICAL board nowhere, which is a real gap and
// is recorded rather than hidden.
//
// When they are vendored it must be the engine's way: downloaded at build time and served from
// this origin, never fetched from a CDN at runtime. That is not a preference — the engine's
// `app/public/vendor/fonts/` holds 36 files and 928 KB for eighteen families with no request to
// googleapis anywhere, because the destination is a school (offline) and the user is a child
// (LGPD). A board needs twelve codepoints, so the subsets should be a few KB each.

import type { PieceType, Side } from '../chess/types.ts';

export type Glyphs = Readonly<Record<Side, Readonly<Record<PieceType, string>>>>;

/**
 * ========================= BOTH SIDES USE THE SOLID GLYPHS =========================
 * The chess block has two runs: U+2654–2659 drawn hollow ("white") and U+265A–265F drawn solid
 * ("black"). Using one run per side is the obvious choice and it was the first one, and looking at
 * it settled the matter — a hollow glyph is almost entirely OUTLINE, so a white piece came out as
 * a dark shape with a thin light line inside it. The same finding the 3D pieces produced by
 * measurement: **the ink that covers a piece is the ink that names it**, and for a hollow glyph
 * that ink is the outline.
 *
 * So both sides take the SOLID run and the side is carried by colour, with the outline in the
 * opposite ink — which is how a printed diagram does it, and what every 2D chess interface that
 * uses artwork rather than text does too.
 *
 * The founding argument of `render/palette.ts` still holds: the two colours are separated by
 * LUMINANCE (5.86:1 between the light and dark fills), so the distinction survives every
 * colour-vision filter the engine can apply and does not depend on hue.
 */
const CHESS_BLOCK: Glyphs = {
  w: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

/**
 * ⚠️ Emoji are not the chess block and never were: U+2654 upward are TEXT symbols, and no emoji
 * font carries them. So this set is a different picture of the same game, and it brings a problem
 * the others do not — an emoji is a full-colour bitmap and cannot be recoloured, so the SIDE
 * cannot be carried by the glyph.
 *
 * It is carried by a disc behind it instead (`.cell-piece[data-side]` in the stylesheet), which is
 * how a physical set does it too: the piece is the same shape, the material is what differs.
 */
const EMOJI: Glyphs = {
  w: { k: '\u{1F934}', q: '\u{1F478}', r: '\u{1F3F0}', b: '\u{1F3EF}', n: '\u{1F40E}', p: '\u{1F6E1}' },
  b: { k: '\u{1F934}', q: '\u{1F478}', r: '\u{1F3F0}', b: '\u{1F3EF}', n: '\u{1F40E}', p: '\u{1F6E1}' },
};

export interface PieceSet {
  readonly key: string;
  /** Font stack. The first name is the intended face; the rest is what a machine is likely to have. */
  readonly family: string;
  readonly glyph: Glyphs;
  /**
   * True when the glyph paints its own colours, so the side has to be shown some other way and
   * the palette cannot tint it.
   */
  readonly coloured?: boolean;
  /** i18n key for the one-line description shown beside the name. */
  readonly description: string;
  /** Set when the set cannot be offered yet. The engine's own catalogue uses the same idea. */
  readonly off?: string;
}

const SYMBOL_STACK = "'Noto Sans Symbols 2', 'Segoe UI Symbol', 'Apple Symbols', 'DejaVu Sans', serif";
const MATH_STACK = "'STIX Two Math', 'STIX Two Text', 'Cambria Math', 'Latin Modern Math', serif";
const EMOJI_STACK = "'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";

export const PIECE_SETS: readonly PieceSet[] = [
  {
    key: 'symbols',
    family: SYMBOL_STACK,
    glyph: CHESS_BLOCK,
    description: 'set.symbols',
  },
  {
    key: 'math',
    family: MATH_STACK,
    glyph: CHESS_BLOCK,
    description: 'set.math',
  },
  {
    key: 'emoji',
    family: EMOJI_STACK,
    glyph: EMOJI,
    coloured: true,
    description: 'set.emoji',
  },
  {
    // Pecita is SIL OFL and covers the chess block, but it is not on Google Fonts — it comes from
    // pecita.eu, so it needs its own acquisition and its own confirmation before being shipped.
    key: 'pecita',
    family: "'Pecita', cursive",
    glyph: CHESS_BLOCK,
    description: 'set.pecita',
    off: 'set.off.licence',
  },
];

export const DEFAULT_SET = 'symbols';

const BY_KEY: ReadonlyMap<string, PieceSet> = new Map(PIECE_SETS.map((set) => [set.key, set]));

/** Falls back to the default for an unknown or unavailable key, so a stale setting cannot break. */
export function pieceSet(key: string): PieceSet {
  const found = BY_KEY.get(key);
  if (!found || found.off) return BY_KEY.get(DEFAULT_SET) as PieceSet;
  return found;
}

/** The sets a player may actually pick right now. */
export const AVAILABLE_SETS: readonly PieceSet[] = PIECE_SETS.filter((set) => !set.off);
