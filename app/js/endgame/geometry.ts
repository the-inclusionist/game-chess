// SPDX-License-Identifier: AGPL-3.0-or-later
// endgame/geometry — the two endgame ideas that are arithmetic rather than prose.
//
// ========================= WHY THESE TWO, AND WHY THEY ARE HERE AT ALL =========================
// The plan's endgame stage ran into a licence wall: the book it named is by EDWARD Lasker, who died
// in 1981 and is protected until 2052 — not the world champion, and the English original does not
// save it. What it also said is the way through: "os conceitos geométricos — regra do quadrado,
// oposição — são matemática, não texto de ninguém, e viram algoritmo direto."
//
// So these are computed, not quoted. Nobody owns the observation that a king catches a pawn when
// it can step inside a square, any more than anybody owns Pythagoras. A position generated from
// the rule is ours to ship, and the rule can be CHECKED rather than believed — which is what
// `tests/endgame-geometry.node.test.ts` does by racing every position on the board.
//
// ========================= ⚠️ WHAT THESE FUNCTIONS ARE NOT =========================
// They are the textbook rules of thumb, stated exactly. Both ignore pieces the real position may
// contain — the square rule assumes nothing helps the pawn and nothing blocks the king; the
// opposition assumes the kings are the story. That is not a defect to be fixed by adding
// conditions: it is what the rules ARE, and it is why a beginner can apply them. A lesson that
// used them must build the position it teaches them on.

import { FILES, RANKS, type Side, type Square } from '../chess/types.ts';

/** Chebyshev distance: what a king actually pays to get from one square to another. */
export function kingMoves(from: Square, to: Square): number {
  return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
}

/** The square a pawn is heading for. Row 0 is rank 8, which is where a white pawn is going. */
export function promotionSquare(pawn: Square, side: Side): Square {
  return { x: pawn.x, y: side === 'w' ? 0 : RANKS - 1 };
}

/**
 * How many moves a lone pawn needs to promote.
 *
 * ⚠️ THE DOUBLE STEP IS THE WHOLE SUBTLETY. A pawn still on its own second rank promotes in one
 * move fewer than the rank count suggests, and a rule of the square that forgets it draws the
 * square one file too small — which is the single most common way this is taught wrongly.
 */
export function pawnMoves(pawn: Square, side: Side): number {
  const ranks = side === 'w' ? pawn.y : RANKS - 1 - pawn.y;
  const onHome = side === 'w' ? pawn.y === RANKS - 2 : pawn.y === 1;
  return onHome ? ranks - 1 : ranks;
}

/**
 * Every square the pawn will stand on, in order, starting with the one it is on.
 *
 * ⚠️ INDEX IS THE NUMBER OF PAWN MOVES, NOT THE NUMBER OF RANKS, which is why the double step
 * cannot be handled by arithmetic on the rank alone: from its home square the pawn's FIRST move
 * covers two ranks, so `path[1]` is two rows away and everything after it is off by one if that is
 * missed.
 */
export function pawnPath(pawn: Square, side: Side): Square[] {
  const step = side === 'w' ? -1 : 1;
  const home = side === 'w' ? RANKS - 2 : 1;
  const path = [{ ...pawn }];
  let y = pawn.y + (pawn.y === home ? step * 2 : step);
  while (y >= 0 && y < RANKS) {
    path.push({ x: pawn.x, y });
    if (y === (side === 'w' ? 0 : RANKS - 1)) break;
    y += step;
  }
  return path;
}

/**
 * The rule of the square: can the defending king stop this pawn?
 *
 * The square is the box whose side is the pawn's remaining path. A king inside it — or able to
 * step inside on its move — arrives in time; a king outside it does not, and no amount of running
 * changes that, which is the point of the rule. It replaces counting a race with looking at a box.
 *
 * ⚠️ `toMove` IS NOT DECORATION. A tempo is exactly one file's worth of square, and every position
 * where the rule looks wrong to a learner is one where they forgot whose turn it was.
 */
export function catchesPawn(
  pawn: Square,
  pawnSide: Side,
  king: Square,
  toMove: Side,
): boolean {
  /*
   * ⚠️ THE CLASSIC FORM IS "CAN THE KING REACH THE QUEENING SQUARE IN TIME", AND IT IS INCOMPLETE.
   * It answers a RACE, and a king does not only race: it can step in front of the pawn and block
   * it, or walk up and take it. Written the classic way this said a black king on a6 could not
   * stop a white pawn on a7 — which is true of the race to a8 and absurd about the position,
   * because the king simply captures.
   *
   * Found by racing every position on the board against the formula rather than by reading it. So
   * every square of the pawn's path is considered, and the earliest interception wins:
   *
   *  · BLOCKING or CAPTURING at path square `i` needs the king there while the pawn is still
   *    behind it or standing on it.
   *  · The queening square is the one square where sitting on it later is no use — the pawn has
   *    already promoted — so it must be reached before the pawn arrives.
   *
   * The tempo shows up as the `+1`: a king that moves first gets one interception's worth of
   * grace, which is the same fact the classic rule states as "one file of square".
   */
  const path = pawnPath(pawn, pawnSide);
  const last = path.length - 1;
  const kingFirst = toMove !== pawnSide;

  for (let i = 0; i <= last; i += 1) {
    const need = kingMoves(king, path[i]!);
    const allowed = i === last
      ? (kingFirst ? i : i - 1)      // the promotion square: be there BEFORE the pawn arrives
      : (kingFirst ? i + 1 : i);     // anywhere else: while the pawn is still there to be taken
    if (need <= allowed) return true;
  }
  return false;
}

export type OppositionKind = 'direct' | 'distant' | 'diagonal';

export interface Opposition {
  readonly kind: OppositionKind;
  /** Whoever is NOT to move. Holding the opposition is a fact about whose turn it is. */
  readonly holder: Side;
}

/**
 * Which side holds the opposition, and in what shape — or null if the kings are not in it.
 *
 * The kings are in opposition when they stand on the same file, rank or diagonal with an ODD
 * number of squares between them, and it is held by whoever does NOT have to move. That is the
 * entire idea: the player forced to move first has to give way.
 *
 * ⚠️ ODD SQUARES BETWEEN, WHICH IS AN EVEN DISTANCE. Kings a knight's-move apart are not in
 * opposition and kings adjacent cannot be — they would be attacking each other, which is not a
 * position. Counting the squares BETWEEN rather than the distance is how the idea is taught, and
 * getting the parity backwards produces a rule that is confidently wrong half the time.
 */
export function opposition(white: Square, black: Square, toMove: Side): Opposition | null {
  const dx = Math.abs(white.x - black.x);
  const dy = Math.abs(white.y - black.y);
  const holder: Side = toMove === 'w' ? 'b' : 'w';

  const aligned = dx === 0 || dy === 0 || dx === dy;
  if (!aligned) return null;

  const gap = Math.max(dx, dy) - 1;
  // Adjacent kings are illegal, and a gap of zero is that. Even gaps are not opposition at all.
  if (gap <= 0 || gap % 2 === 0) return null;

  if (dx === dy) return { kind: 'diagonal', holder };
  return { kind: gap === 1 ? 'direct' : 'distant', holder };
}

/** Every square on the board, for whoever wants to look at all of them. */
export function everySquare(): Square[] {
  const out: Square[] = [];
  for (let y = 0; y < RANKS; y += 1) for (let x = 0; x < FILES; x += 1) out.push({ x, y });
  return out;
}
