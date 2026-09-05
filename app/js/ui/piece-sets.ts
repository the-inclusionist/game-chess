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
    // ⚠️ THE LICENCE IS SETTLED AND THE SET IS STILL OFF, which is a different reason from the one
    // that used to be here. Pecita is SIL OFL 1.1, © Philippe Cochy, with the Reserved Font Name
    // "Pecita" — checked, not assumed — and the author's own documentation lists Chess Symbols
    // among its coverage, so the block this needs is there. OFL permits bundling and
    // redistribution outright.
    //
    // What is missing is the FILE. The stack below is `'Pecita', cursive`, and Pecita is on no
    // system by default: without the font vendored the browser falls through `cursive` — which on
    // most machines has no chess glyphs — and then falls through again, glyph by glyph, to the
    // same symbol font the default set already uses. A player would choose "handwritten" and get
    // exactly the board they already had. A set that lies is worse than a set that is absent.
    //
    // ⚠️ And one clause of the OFL will bite when it is vendored: a SUBSET is a modified version,
    // and the Reserved Font Name may not be used for one. The @font-face will have to declare a
    // different family name, with the unmodified `Pecita.otf` and the licence text beside it.
    key: 'pecita',
    label: 'Pecita',
    family: "'Pecita', cursive",
    glyph: CHESS_BLOCK,
    off: 'set.off.notVendored',
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
