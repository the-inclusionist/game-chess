// SPDX-License-Identifier: AGPL-3.0-or-later
//
// What survived the negamax: the plain material count, which exists so the readout can show it
// BESIDE the engine's evaluation and let the two disagree. That disagreement is the lesson.
import { describe, expect, it } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import { leadFor, material, PIECE_VALUE } from '../app/js/chess/material.ts';

describe('[Material] counted the way a player counts', () => {
  it('calls the opening dead level', () => {
    const count = material(createRules());
    expect(count.lead).toBe(0);
    expect(count.w).toBe(count.b);
  });

  it('reads a lead from the side that has it, either way round', () => {
    // White a whole rook up.
    const count = material(createRules('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'));
    expect(leadFor(count, 'w')).toBe(5);
    expect(leadFor(count, 'b')).toBe(-5);
  });

  it('leaves the king out, because it is never captured', () => {
    expect(PIECE_VALUE.k).toBe(0);
    // Two bare kings: nothing on the board that either side could ever win.
    expect(material(createRules('4k3/8/8/8/8/8/8/4K3 w - - 0 1'))).toMatchObject({ w: 0, b: 0 });
  });

  it('is about the board and not about who is winning', () => {
    // ⚠️ White is a queen for a rook up — and lost, to Re1 mate, with Black to move. The count
    // says +4 and is RIGHT to: it reports material, and the engine's evaluation is what reports
    // the position. Showing both is the whole point of keeping this module after the negamax
    // went; a single number that quietly folded one into the other would teach nothing.
    const rules = createRules('4r1k1/5ppp/8/8/8/8/Q4PPP/7K b - - 0 1');
    expect(leadFor(material(rules), 'w')).toBe(4);

    rules.move({ x: 4, y: 0 }, { x: 4, y: 7 });   // Re8-e1
    expect(rules.isCheckmate()).toBe(true);
    expect(leadFor(material(rules), 'w')).toBe(4);
  });
});
