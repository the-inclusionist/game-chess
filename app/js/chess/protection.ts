// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/protection — the numbers protected mode is made of.

/**
 * Blunders played from the SAME position before the game stops asking and starts showing.
 *
 * ⚠️ Per position, not per game. Three blunders spread over forty moves is a child learning at a
 * perfectly normal rate; three in a row from one position is a child stuck, and the answer to
 * being stuck is not a fourth chance to guess. At that point the suggestions come on by
 * themselves — which is a decision the game makes FOR the player, and so one it says out loud.
 *
 * Three rather than two because the second attempt is often the first real one: the first is
 * frequently a misclick or a piece picked up before the position was read.
 */
export const STUMBLES_BEFORE_HELP = 3;
