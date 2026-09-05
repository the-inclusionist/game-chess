// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/piece-sets — what the 2D board draws a piece WITH. Data, and nothing else.
//
// ========================= ⚠️ THE EMOJI SET WAS TRIED AND REMOVED =========================
// It drew the pieces with emoji instead of the chess block, and it brought a problem the text sets
// do not have: an emoji is a full-colour bitmap that cannot be recoloured, so the SIDE could not be
// carried by the glyph at all. It was carried by a disc behind the piece instead — and that is a
// second thing to look at in every square, on a board whose whole job is to be read quickly.
//
// It also looked different on every machine, since the engine's standing decision for emoji is
// `src: local(...)`: the system's font, no download. "A board that is not the same board twice" is
// a poor thing to offer a classroom.
//
// Removed rather than left switched off, along with the machinery that existed only for it — the
// `coloured` flag and the disc it drove. Something kept for a case nobody has is how a file starts
// carrying weight it cannot justify.
//
// ========================= WHY A SET IS A CHEAP THING TO OFFER =========================
// The meaning of a square lives in the `aria-label` of `ui/grid-mirror.ts`, in the player's own
// language, with the piece's grammatical gender attached. A glyph is `aria-hidden` decoration on
// top of that. So changing the set changes NOTHING a screen reader hears — it is a legibility
// control with no semantic surface, which is what makes it worth having several.
//
// ========================= WHERE THE FONTS COME FROM =========================
// All three are VENDORED now, cut to the twelve codepoints a board needs and served from this
// origin. The note that used to be here said the subsets "should be a few KB each"; measured, they
// are 2,684, 3,176 and 2,748 bytes — **8,608 for all three**, against 3.6 MB of originals.
//
// Served from here and never fetched from a CDN, which is the engine's existing practice and not a
// preference: the destination is a school, so the board has to work with no network, and the user
// is a child, so nobody's IP address should reach a third party to draw a rook.
//
// Each stack still ends in a generic family. The vendored face is declared with a `unicode-range`
// covering only the chess block, so anything else falls straight through — and if a file ever
// fails to arrive, a system symbol font still draws a playable board.
//
// `app/public/vendor/fonts/NOTICE.md` records the source, the size and the licence of each.

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

export interface PieceSet {
  readonly key: string;
  /**
   * ========================= THE FACE'S OWN NAME, NEVER TRANSLATED =========================
   * A typeface is a proper noun. It was "Símbolos de xadrez" and "Símbolos matemáticos" here,
   * which is a description dressed as a name and helps nobody: someone who knows what STIX Two
   * Math looks like could not find it, and someone who does not learns nothing from "mathematical
   * symbols" either. The engine's own catalogue settled this — `ui/fonts.ts` keeps `fam` as a
   * literal and puts only the DESCRIPTION behind an i18n key — and this follows it.
   *
   * So this string is shown as it is, in every language.
   */
  readonly label: string;
  /** Font stack. The first name is the intended face; the rest is what a machine is likely to have. */
  readonly family: string;
  readonly glyph: Glyphs;
  /** i18n key for the one-line description, if the name alone does not say enough. */
  readonly description?: string;
  /** Set when the set cannot be offered yet. The engine's own catalogue uses the same idea. */
  readonly off?: string;
}

const SYMBOL_STACK = "'Noto Sans Symbols 2', 'Segoe UI Symbol', 'Apple Symbols', 'DejaVu Sans', serif";
const MATH_STACK = "'STIX Two Math', 'STIX Two Text', 'Cambria Math', 'Latin Modern Math', serif";
// ⚠️ `HandwrittenChess` IS Pecita — see the NOTICE and the @font-face comment for why it cannot be
// called that. `Pecita` stays in the stack behind it so a machine with the full font installed
// uses that instead, which is the one case where the whole face is available rather than twelve
// glyphs of it.
const HAND_STACK = "'HandwrittenChess', 'Pecita', cursive";

export const PIECE_SETS: readonly PieceSet[] = [
  {
    key: 'symbols',
    label: 'Noto Sans Symbols 2',
    family: SYMBOL_STACK,
    glyph: CHESS_BLOCK,
  },
  {
    key: 'math',
    label: 'STIX Two Math',
    family: MATH_STACK,
    glyph: CHESS_BLOCK,
  },
  {
    // ⚠️ Shipped as `HandwrittenChess`, and that is the OFL working rather than a workaround.
    // Pecita is SIL OFL 1.1, © Philippe Cochy, with the Reserved Font Name "Pecita" — a subset is
    // a Modified Version and may not carry a reserved name, so the FONT is renamed while the SET
    // keeps the designer's name, because that names the design a player is choosing rather than
    // the font software. Saying where a typeface came from is what the licence asks for.
    key: 'pecita',
    label: 'Pecita',
    family: HAND_STACK,
    glyph: CHESS_BLOCK,
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
