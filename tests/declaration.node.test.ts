// SPDX-License-Identifier: AGPL-3.0-or-later
import { conformanceProblems, distance, speakableProblems } from '@the-inclusionist/engine/core/contract.js';
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

function build(fen?: string, locale: 'pt' | 'en' | 'es' = 'pt', playerSide: 'w' | 'b' = 'w') {
  const rules = createRules(fen);
  const state = createGameState({ rules, opponent: false });
  const i18n = createI18n(locale);
  let cursor: Square = sq('e2');
  const declaration = createChessDeclaration({
    rules: () => rules, state: () => state, i18n, playerSide, cursor: () => cursor,
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

  it('⚠️ holds exactly ONE position at a time, which is the strongest answer a game can give', () => {
    /*
     * The engine's ADR-0104 made this field mandatory because omitting it decides a child's accommodation by
     * silence — «não declarar é ter a acessibilidade programada no controle pro sorte». Chess is the cleanest
     * case: nothing is ever held down, every command arrives on its own, and the next one waits.
     *
     * ONE is not a shrug. It means this game is playable on EVERY transport the engine offers and on every
     * one it will offer later — a two-point phone, a single switch, a gaze tracker, a breath sensor. This
     * case exists so that a future change to the declaration cannot quietly raise the number: raising it
     * would exclude those children, and it should have to be argued rather than typed.
     */
    expect(build().declaration.holdsAtOnce()).toBe(1);
  });

  it('declares a grid of the right size, and how a step is counted in it', () => {
    /*
     * ⚠️ `move` AND `frame` ARE NOT DECORATION, and the engine made them required because "grid"
     * never was one thing. `diagonal` is Chebyshev — the KING'S step, so "two squares away" means
     * the same to the sonar as to the player — and `compass` is north/south/east/west, which is
     * what a board seen from above has. `clock` would have the sonar placing a rook at four
     * o'clock, which is a 2D side view's vocabulary and not this one's.
     */
    const { declaration } = build();
    expect(declaration.topology())
      .toEqual({ kind: 'grid', size: [8, 8], move: 'diagonal', frame: 'compass' });
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

describe('[Roles] a player who chose black is told THEIR board', () => {
  /*
   * ⚠️ NO ROOT EVER PASSED `playerSide`, for the whole life of this game, so `mine` defaulted
   * to white and a player who chose black was told the board from the other side of it: their own
   * pieces `key`, the piece hunting their king `structure`, the king they were defending `goal`.
   *
   * None of that is visible. The seven fields feed the sonar and the screen reader and nothing
   * else — so it was wrong only for the players those fields exist for.
   */
  it('calls black’s own men structure and white’s king the goal', () => {
    const { declaration } = build(undefined, 'pt', 'b');
    expect(declaration.roleAt(sq('e7'))).toBe('structure');
    expect(declaration.roleAt(sq('a8'))).toBe('structure');
    expect(declaration.roleAt(sq('d1'))).toBe('key');
    expect(declaration.roleAt(sq('e1'))).toBe('goal');
  });

  it('is the exact mirror of what white is told', () => {
    const white = build(undefined, 'pt', 'w').declaration;
    const black = build(undefined, 'pt', 'b').declaration;
    // The same square, the two points of view, and never the same answer where a piece stands.
    expect(white.roleAt(sq('e2'))).toBe('structure');
    expect(black.roleAt(sq('e2'))).toBe('key');
    expect(white.roleAt(sq('e8'))).toBe('goal');
    expect(black.roleAt(sq('e8'))).toBe('structure');
  });

  it('warns about the squares the OTHER side covers', () => {
    // `hazard` is an empty square the opponent attacks, so whose opponent it is decides the whole
    // answer. On the opening board it is white's third rank for black, not black's sixth.
    const black = build(undefined, 'pt', 'b').declaration;
    expect(black.roleAt(sq('e3'))).toBe('hazard');
    expect(black.roleAt(sq('e6'))).toBe('free');
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
    // ⚠️ `topology()` IS CALLED, not read. It became a method in the engine's ADR-0084 because a
    // value could not serve a game whose board changes size; chess's never does, and it is called
    // the same way anyway rather than being the one declaration that answers differently.
    const { declaration } = build();
    expect(distance(declaration.topology(), sq('e4'), sq('f5'))).toBe(1);
    expect(distance(declaration.topology(), sq('e4'), sq('e5'))).toBe(1);
    expect(distance(declaration.topology(), sq('a1'), sq('h8'))).toBe(7);
  });
});

describe('[World] what a simulated blindness is allowed to reach', () => {
  it('⚠️ names the whole STAGE, not the canvas and not the board region', () => {
    /*
     * The canvas would be wrong twice: the flat page has no canvas board at all, and on the other
     * two the HUD, the move list and the coordinate labels are DOM beside it. A blindness aimed at
     * the canvas blacks out the board and leaves the score sheet legible, which simulates nothing.
     *
     * ⚠️ AND `#chess-board` STOPPED BEING ENOUGH the day the panel moved out of the board. It used
     * to be the answer, back when the side panel was absolutely positioned over the board's right
     * 27.5% and was therefore inside it. Now the panel is a SIBLING — so a blindness aimed at the
     * region would black the board and leave the lesson and the move list perfectly readable,
     * which is precisely the defect the engine's ADR-0087 was written about.
     *
     * And it must not be the DOCUMENT either: the engine's menus live outside `#game-region`, and that
     * is what stops a simulation from locking a child inside itself.
     */
    const { declaration } = build();
    expect(declaration.world()).toEqual({ kind: 'element', selector: '#game-region' });
  });

  it('never declares that it has no world', () => {
    // Blindfold chess exists. A board that happens to be DOM is not a game where empathy makes no
    // sense — it is one where it asks more of whoever writes it.
    const { declaration } = build();
    expect(declaration.world().kind).not.toBe('none');
  });
});
