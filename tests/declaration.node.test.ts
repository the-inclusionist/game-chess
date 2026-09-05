// SPDX-License-Identifier: AGPL-3.0-or-later
import { conformanceProblems, distance, speakableProblems } from '@pm-monte/inclusionist-engine/core/contract.ts';
import { describe, expect, it } from 'vitest';
import { createRules } from '../app/js/chess/rules.ts';
import { createGameState } from '../app/js/chess/state.ts';
import { fromAlgebraic, toAlgebraic, type Square } from '../app/js/chess/types.ts';
import { createChessDeclaration } from '../app/js/declaration/chess-declaration.ts';
import { createI18n } from '../app/js/i18n/index.ts';

const sq = (name: string): Square => {
  const s = fromAlgebraic(name);
  if (!s) throw new Error(`bad square ${name}`);
  return s;
};

function build(fen?: string, locale: 'pt' | 'en' | 'es' = 'pt') {
  const rules = createRules(fen);
  const state = createGameState({ rules, opponent: false });
  const i18n = createI18n(locale);
  let cursor: Square = sq('e2');
  const declaration = createChessDeclaration({
    rules, state, i18n, cursor: () => cursor,
  });
  return { rules, state, i18n, declaration, setCursor: (s: Square) => { cursor = s; } };
}

describe('[Conformance] the engine agrees this is a well-formed game', () => {
  // `conformanceProblems` is the engine's own gate: a preset "either satisfies the seven fields
  // or it does not". Running it here is the difference between claiming the contract is met and
  // having the engine say so.
  it('reports no problems at all', () => {
    expect(conformanceProblems(build().declaration)).toEqual([]);
  });

  it('still reports none at checkmate, when there is nothing left to point at', () => {
    const { declaration } = build('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(conformanceProblems(declaration)).toEqual([]);
  });

  it('declares a grid of the right size', () => {
    const { declaration } = build();
    expect(declaration.topology).toEqual({ kind: 'grid', cols: 8, rows: 8 });
  });

  it('declares the player as the clock, not a timer', () => {
    // `tick: 'player'` is what tells the engine that time does not pressure this game, which is
    // what makes WCAG 2.2.1 (Timing Adjustable) inapplicable and lets sweeping wait.
    expect(build().declaration.tick).toBe('player');
  });
});

describe('[Roles] the platformer vocabulary, in chess', () => {
  it('calls a quiet empty square free', () => {
    expect(build().declaration.roleAt(sq('d4'))).toBe('free');
  });

  it('calls your own piece structure — scenery that blocks you', () => {
    expect(build().declaration.roleAt(sq('e2'))).toBe('structure');
    expect(build().declaration.roleAt(sq('a1'))).toBe('structure');
  });

  it('calls an enemy piece a key, and the enemy king the goal', () => {
    const { declaration } = build();
    expect(declaration.roleAt(sq('d8'))).toBe('key');
    expect(declaration.roleAt(sq('e8'))).toBe('goal');
  });

  it('calls an empty square the opponent covers a HAZARD', () => {
    // This is the line that gives the blind-navigation sonar a threat warning for free. Black
    // rook on e8 sweeps the open e-file; e4 is empty and covered.
    const { declaration } = build('4r2k/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(declaration.roleAt(sq('e4'))).toBe('hazard');
    expect(declaration.roleAt(sq('a4'))).toBe('free');
  });

  it('marks exactly the sixth rank as hazardous in the opening', () => {
    // Written expecting ZERO hazards at move one, which was wrong — and instructively so. The
    // eight black pawns cover all eight empty squares of rank 6 diagonally, and for a white
    // piece that rank genuinely IS where the danger starts. Nothing reaches rank 5 yet.
    const { declaration } = build();
    const hazards: string[] = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (declaration.roleAt({ x, y }) === 'hazard') hazards.push(toAlgebraic({ x, y }));
      }
    }
    expect(hazards.sort()).toEqual(['a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6']);
  });
});

describe('[Names] every piece can be spoken, and agrees in gender', () => {
  it('gives a well-formed Speakable for all 32 pieces', () => {
    const { rules, declaration } = build();
    for (const { square } of rules.placements()) {
      const name = declaration.nameAt(square);
      expect(name, toAlgebraic(square)).not.toBeNull();
      expect(speakableProblems(name), toAlgebraic(square)).toEqual([]);
    }
  });

  it('says nothing about an empty square, rather than saying "empty"', () => {
    // null is the contract's own word for "there is nothing here". A Speakable reading "empty"
    // would make the sonar announce furniture that is not there.
    expect(build().declaration.nameAt(sq('d4'))).toBeNull();
  });

  it('carries the gender the frame needs to agree with', () => {
    const { declaration } = build();
    expect(declaration.nameAt(sq('a1'))).toEqual({ text: 'torre branca', gender: 'f', plural: false });
    expect(declaration.nameAt(sq('b8'))).toEqual({ text: 'cavalo preto', gender: 'm', plural: false });
  });

  it('follows the interface language', () => {
    expect(build(undefined, 'en').declaration.nameAt(sq('a1'))?.text).toBe('white rook');
    expect(build(undefined, 'es').declaration.nameAt(sq('a1'))?.text).toBe('torre blanca');
  });
});

describe('[Focus] where the player is looking', () => {
  it('follows the cursor when nothing is held', () => {
    const { declaration, setCursor } = build();
    setCursor(sq('c3'));
    expect(declaration.focusOf(0)?.at).toEqual(sq('c3'));
  });

  it('follows the selection once a piece is picked up', () => {
    const { declaration, state } = build();
    state.activate(sq('g1'));
    expect(declaration.focusOf(0)?.at).toEqual(sq('g1'));
  });

  it('reports no focus for a player who does not exist', () => {
    expect(build().declaration.focusOf(1)).toBeNull();
  });
});

describe('[Targets] where this player may still go', () => {
  it('offers every square something could move to, with nothing selected', () => {
    const targets = build().declaration.targetsOf(0);
    // Twenty opening moves land on sixteen distinct squares: the eight knight destinations
    // overlap none of the pawn ones, and each pawn has two.
    expect(targets.length).toBeGreaterThan(0);
    const unique = new Set(targets.map((t) => `${t.x},${t.y}`));
    expect(unique.size).toBe(targets.length);
  });

  it('narrows to that piece once one is in hand', () => {
    const { declaration, state } = build();
    state.activate(sq('e2'));
    expect(declaration.targetsOf(0).map((t) => toAlgebraic(t as Square)).sort())
      .toEqual(['e3', 'e4']);
  });

  it('offers nothing while it is not your turn', () => {
    const { declaration, state } = build();
    state.activate(sq('e2'));
    state.activate(sq('e4'));
    state.animationDone();
    expect(declaration.targetsOf(0)).toEqual([]);
  });

  it('offers nothing at checkmate — empty is an answer, not a fault', () => {
    const { declaration } = build('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(declaration.targetsOf(0)).toEqual([]);
  });

  it('offers nothing to a player who does not exist', () => {
    expect(build().declaration.targetsOf(1)).toEqual([]);
  });
});

describe('[Objective] what the round is asking for', () => {
  it('asks for one checkmate, and does not have it yet', () => {
    const objective = build().declaration.objectiveOf(0);
    expect(objective.need).toBe(1);
    expect(objective.have).toBe(0);
    expect(speakableProblems(objective.name)).toEqual([]);
  });

  it('does not credit the player with a mate the opponent delivered', () => {
    // White is mated here. The objective is the PLAYER's, so it stays unmet.
    const { declaration } = build('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(declaration.objectiveOf(0).have).toBe(0);
  });
});

describe('[Metric] the engine measures the board the way a player counts it', () => {
  it('makes a diagonal step cost one, like the king', () => {
    const { declaration } = build();
    expect(distance(declaration.topology, sq('e4'), sq('f5'))).toBe(1);
    expect(distance(declaration.topology, sq('e4'), sq('e5'))).toBe(1);
    expect(distance(declaration.topology, sq('a1'), sq('h8'))).toBe(7);
  });
});
