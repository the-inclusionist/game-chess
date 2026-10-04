// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/state — whose turn it is, what is selected, and what is allowed right now.
//
// ========================= ONE DOOR IN =========================
// `activate(square)` is the ONLY way a player affects the game, and both the pointer and the
// keyboard go through it. That is not tidiness: the DOM grid mirror at step 7 has to behave
// identically to a click, and the surest way to guarantee that is to leave it no other path.
//
// It returns a description of WHAT HAPPENED rather than mutating and staying silent. The renderer
// reads it to place markers; the announcer reads it to speak; a test reads it to assert. A method
// that returned void would force all three to re-derive the same fact from the new state.
//
// ========================= THE PHASES ARE ABOUT INPUT, NOT ABOUT CHESS =========================
// `idle → selected → animating → thinking → over`. Chess itself has no notion of "animating"; the
// phase exists because a piece in flight must not accept another click, and because the engine's
// frame loop needs to know when it is allowed to move something.
//
// No module-level state: `createGameState()` returns an instance and the composition root owns it.

import type { MoveResult, Rules } from './rules.ts';
import type { Side, Square } from './types.ts';

export type Phase = 'idle' | 'selected' | 'animating' | 'thinking' | 'over';

export type Activation =
  | { readonly kind: 'selected'; readonly square: Square; readonly targets: readonly Square[] }
  | { readonly kind: 'deselected' }
  /**
   * An empty square was chosen as WHERE TO GO, before a piece was chosen to go there.
   *
   * ========================= ⚠️ THE SECOND ORDER, AND WHY IT IS NOT A LUXURY =========================
   * The Dev, 2026-10-04: "o contrario (clicar na casa e depois clicar na peca) tambem deve ser
   * possivel. Em todos os tabuleiros."
   *
   * It is how a beginner actually thinks. A child learning the game looks at the board, sees the
   * square they want to reach, and only then asks which piece can get there — and a program that
   * insists on piece-first is teaching its own order rather than the game's. It is also the order
   * a player uses when the destination is obvious and the piece is not: two rooks on a file, two
   * knights that both reach the same square.
   *
   * `targets` carries the pieces that can legally go there, so the board can light them up — the
   * mirror image of what `selected` does, and the reason a destination is not just a remembered
   * square.
   */
  | { readonly kind: 'aimed'; readonly square: Square; readonly targets: readonly Square[] }
  /** The chosen destination was given up, without a piece ever being chosen. */
  | { readonly kind: 'unaimed' }
  | { readonly kind: 'moved'; readonly move: MoveResult }
  /**
   * A LEGAL move that something outside the rules would not accept.
   *
   * ========================= ⚠️ NOT THE SAME THING AS `illegal` =========================
   * `illegal` means chess says no — the piece does not move that way, or the king would be left in
   * check. This means chess says yes and a TEACHER says no: Professor II accepts only the moves it
   * would have drawn arrows for (the Dev, 2026-10-04), and everything else is sent back.
   *
   * Telling them apart is not pedantry. The two want opposite answers: an illegal move is a
   * misunderstanding of the rules and deserves the rules explained; a refused one is a legal move
   * that is simply not the best, and deserves "try again" and nothing else — which is why it gets
   * a whistle rather than a sentence.
   *
   * ⚠️ THE SELECTION SURVIVES IT, which is the whole point of the mode: "a peça volta pra casa
   * inicial, permitindo que o jogador escolha outra jogada". The piece is still in hand and the
   * legal squares are still lit; only the move did not happen.
   */
  | { readonly kind: 'refused'; readonly from: Square; readonly to: Square }
  | { readonly kind: 'illegal'; readonly square: Square }
  | {
      readonly kind: 'ignored';
      readonly reason: 'empty' | 'not-your-turn' | 'busy' | 'over';
    };

/**
 * One ply of a walk through the score sheet, handed to a caller that draws it.
 *
 * ========================= WHY A CALLER NEEDS THE PLIES ONE AT A TIME =========================
 * `takeBack()` moves the whole unit — your move and the reply to it — and that is the right unit
 * for a button. It is the wrong unit for an ANIMATION: applying both plies and then drawing them
 * means the second piece stands on its destination from the moment the button is pressed, and
 * only starts travelling once the first has landed. It teleports, then flies.
 *
 * So the position moves one ply at a time, and `more` says whether the unit is finished. The
 * policy — two plies against an opponent, one in a hot seat — stays here; only the clock belongs
 * to whoever is drawing.
 */
export interface HistoryStep {
  /** The move that left the board, or arrived on it. */
  readonly move: MoveResult;
  /** True while the unit is unfinished: step again once this one has been drawn. */
  readonly more: boolean;
}

export type Outcome =
  | { readonly kind: 'checkmate'; readonly winner: Side }
  | { readonly kind: 'stalemate' }
  | { readonly kind: 'draw' };

export interface GameStateOptions {
  readonly rules: Rules;
  /** Which side the human plays. Only consulted when there is an opponent. */
  readonly playerSide?: Side;
  /** false = hot seat: both sides are driven from the same board. Default true. */
  readonly opponent?: boolean;
  /**
   * Whether an empty square may be chosen BEFORE the piece that goes to it. Default true.
   *
   * ========================= ⚠️ WHY A LESSON TURNS THIS OFF =========================
   * A teaching step of the `mark` kind asks the student to TOUCH squares — "show me where this
   * rook can go" — and those squares are empty by definition. With aiming on, every one of those
   * touches leaves a destination behind, and the next click on a piece is read as "send it
   * there": the lesson's own answer becomes a move the child never asked for.
   *
   * Found by the suite on 2026-10-04, in five tests, within minutes of the feature landing. The
   * free board is the place for a second order of operations; a guided lesson has an order of its
   * own and is entitled to it.
   */
  readonly aiming?: boolean;
  /**
   * A second opinion on a move the rules already allow. `false` sends it back.
   *
   * ⚠️ IT LIVES IN THE STATE MACHINE AND NOT IN THE SHELL, because "may this move happen" is a
   * question this file already answers and answering it in two places is how this repository has
   * been bitten all week. The shell owns WHO is asking — a teacher, a lesson, nothing — and this
   * owns when the question is put.
   *
   * ⚠️ AND IT IS SYNCHRONOUS ON PURPOSE. The caller that needs to consult an engine must have its
   * answer ready BEFORE it activates; `activate` cannot become a promise without every view that
   * drives it learning to wait, and a board that pauses mid-click is worse than one that asks its
   * question a moment earlier. See `game-shell.ts`, where the hint is awaited first.
   */
  readonly allowMove?: (from: Square, to: Square) => boolean;
}

export interface GameState {
  readonly rules: Rules;
  phase(): Phase;
  selection(): Square | null;
  /** The square chosen to move TO, when it was chosen before the piece. See `Activation.aimed`. */
  destination(): Square | null;
  /**
   * What the current choice offers: where the selected piece may GO, or — when a destination was
   * chosen first — which pieces may COME. One field, and which meaning applies is told by whether
   * `selection` or `destination` is set.
   */
  legalTargets(): readonly Square[];
  /** The move currently in flight, for the renderer to animate. */
  animating(): MoveResult | null;
  /** Where the king under attack stands, or null. Drives the check marker and the alert. */
  kingInCheck(): Square | null;
  outcome(): Outcome | null;
  /** The single entry point for a player action, from pointer or keyboard alike. */
  activate(square: Square): Activation;
  /** The renderer says the piece has arrived. Also settles the phase if nothing was in flight. */
  animationDone(): void;
  /** The opponent's chosen move. Only accepted while thinking; never throws. */
  applyOpponentMove(from: Square, to: Square, promotion?: MoveResult['promotion']): MoveResult | null;

  /**
   * ========================= WHY A TAKE-BACK IS TWO PLIES =========================
   * Undoing ONE ply against an opponent hands the position back with the opponent to move, so the
   * engine immediately plays again — from the player's chair the button would look like it did
   * nothing except change the computer's mind. Against an opponent the unit is the pair: your move
   * and the reply to it, leaving you to move again. In a hot seat there is no reply, so it is one.
   *
   * Both directions are refused mid-animation. A piece in flight is drawn from a move the rules
   * have already applied; pulling that move out from under it would leave the renderer holding a
   * destination that no longer exists. `thinking` is NOT refused — a player who has changed their
   * mind should not have to wait for the search, and cancelling it belongs to whoever owns the
   * worker, not here.
   */
  canTakeBack(): boolean;
  canReplay(): boolean;
  /** Returns whether anything moved, so the caller knows whether to redraw and speak. */
  takeBack(): boolean;
  replay(): boolean;
  /** The same two operations, one ply at a time, for a caller that animates them. */
  takeBackStep(): HistoryStep | null;
  replayStep(): HistoryStep | null;
  /**
   * Hands the board to the opponent: the phase becomes `thinking` and the composition root's
   * `askOpponent` may run. A no-op on a finished game.
   *
   * ⚠️ IT EXISTS BECAUSE «WHOSE TURN» AND «WHO MOVES NEXT» ARE DIFFERENT QUESTIONS, and this file
   * only ever knew the first. See the long note in `createGameState`.
   */
  think(): void;
}

export function createGameState(options: GameStateOptions): GameState {
  const { rules } = options;
  /*
   * ========================= ⚠️ WHOSE TURN IT IS STOPPED BEING THIS FILE'S BUSINESS =========================
   * The Dev, 2026-10-04: "se 2 Jogadores estiver desligado, após o humano jogar será sempre a vez
   * da engine, seja o lance feito pelas brancas ou pelas pretas", and "seja onde parar, o relógio
   * fica pausado aguardando o jogador humano jogar."
   *
   * Both sentences say the same thing about this module: the opponent moves because somebody HANDED
   * the board over, not because of whose turn it is. `settle()` used to read `playerSide` and
   * declare `thinking` whenever the other colour was on move, which made three things true that
   * the Dev has now asked to be false — the human could never move the black pieces, a take-back
   * that landed on the opponent's turn was immediately answered and undone, and a walk through the
   * score sheet could not stop anywhere the engine would have played.
   *
   * So the phase settles to `idle` and the composition root calls `think()` when it means it.
   * `playerSide` and `opponent` stay on the options because callers pass them and the DECLARATION
   * still needs to know which way the board faces; nothing in here reads them any more.
   */

  let phase: Phase = 'idle';
  let selection: Square | null = null;
  let targets: readonly Square[] = [];
  let inFlight: MoveResult | null = null;
  /**
   * The square chosen to move TO, when it was chosen before the piece.
   *
   * ⚠️ NOT A PHASE. `Phase` is about what the input is allowed to do — a piece in flight must not
   * accept a click, the engine's loop needs to know when it may move something — and aiming
   * changes none of that. It is an ordinary idle board that happens to be remembering a square, so
   * it rides alongside `phase` rather than adding a sixth value every guard would have to learn.
   */
  let destination: Square | null = null;
  const aiming = options.aiming ?? true;
  const allowMove = options.allowMove;

  /** Works out which phase the position implies, once nothing is in flight. */
  function settle(): void {
    selection = null;
    targets = [];
    destination = null;
    inFlight = null;
    phase = rules.isGameOver() ? 'over' : 'idle';
  }

  function select(square: Square): Activation {
    selection = square;
    destination = null;
    targets = rules.legalTargets(square);
    phase = 'selected';
    return { kind: 'selected', square, targets };
  }

  /** Every piece of the side to move that could legally reach `square`. */
  function reachers(square: Square): Square[] {
    return rules.allMoves()
      .filter((move) => move.to.x === square.x && move.to.y === square.y)
      .map((move) => move.from);
  }

  function aim(square: Square): Activation {
    destination = square;
    selection = null;
    // ⚠️ The pieces that can GET here, not the squares one piece can go to. Same field, mirrored
    // meaning, and the shell draws it on the board so "which of mine reaches this?" is answered
    // the moment the question is asked.
    targets = reachers(square);
    phase = 'idle';
    return { kind: 'aimed', square, targets };
  }

  function play(from: Square, to: Square): MoveResult | null {
    const move = rules.move(from, to);
    if (!move) return null;
    selection = null;
    destination = null;
    targets = [];
    inFlight = move;
    phase = 'animating';
    return move;
  }

  /*
   * ⚠️ A WALK IS ONE PLY, FULL STOP, SINCE 2026-10-04. The Dev: "avançar e voltar devem passar a
   * «andar» um lance por vez e não dois como têm feito até agora."
   *
   * What stood here was `hasOpponent && canContinue && rules.turn() !== playerSide` — "the unit
   * ends when the player is on move again" — which made a take-back two plies: your move and the
   * reply to it. That unit only existed because `settle()` would hand a half-rewound board
   * straight back to the engine; with the opponent moving only when it is HANDED the board, there
   * is nothing to protect against and the unit is the ply.
   */

  function stepBack(): HistoryStep | null {
    if (phase === 'animating' || !rules.canUndo()) return null;
    const history = rules.history();
    const move = history[history.length - 1];
    rules.undo();
    const more = false;
    // Settled only when the unit is complete. Half a take-back is not a position anyone may play
    // from, and settling into it would hand the board back mid-rewind.
    if (!more) settle();
    return { move, more };
  }

  function stepForward(): HistoryStep | null {
    if (phase === 'animating' || !rules.canRedo()) return null;
    if (!rules.redo()) return null;
    const history = rules.history();
    const move = history[history.length - 1];
    const more = false;
    // If the redo stack ran out on the opponent's turn, `settle` says `thinking` and the
    // composition root asks them to move. That is the right answer, not an edge case.
    if (!more) settle();
    return { move, more };
  }

  settle();

  return {
    rules,
    phase: () => phase,
    selection: () => selection,
    destination: () => destination,
    legalTargets: () => targets,
    animating: () => inFlight,

    kingInCheck() {
      if (!rules.isCheck()) return null;
      const side = rules.turn();
      const king = rules.placements()
        .find((p) => p.piece.type === 'k' && p.piece.side === side);
      return king ? king.square : null;
    },

    outcome() {
      if (rules.isCheckmate()) {
        // The side to move is the one that has been mated, so the winner is the other.
        return { kind: 'checkmate', winner: rules.turn() === 'w' ? 'b' : 'w' };
      }
      // Order matters: chess.js counts stalemate as a draw, and stalemate is the more specific
      // thing to say — "afogamento" is not the same news as "empate".
      if (rules.isStalemate()) return { kind: 'stalemate' };
      if (rules.isDraw()) return { kind: 'draw' };
      return null;
    },

    activate(square) {
      if (phase === 'over') return { kind: 'ignored', reason: 'over' };
      if (phase === 'animating' || phase === 'thinking') {
        return { kind: 'ignored', reason: 'busy' };
      }

      if (selection && selection.x === square.x && selection.y === square.y) {
        selection = null;
        targets = [];
        phase = 'idle';
        return { kind: 'deselected' };
      }

      // The chosen destination, chosen again: a change of mind, and the mirror of a deselect.
      if (destination && destination.x === square.x && destination.y === square.y) {
        destination = null;
        targets = [];
        return { kind: 'unaimed' };
      }

      const piece = rules.pieceAt(square);

      /*
       * ⚠️ A WAITING DESTINATION GETS FIRST REFUSAL ON YOUR OWN PIECE, and the order of these two
       * branches is the whole of the second gesture. The line below says "your own piece,
       * whichever phase: pick it up" — true, and it would swallow the click that was meant to
       * answer "which piece goes there?".
       *
       * If the piece cannot reach the chosen square, picking it up is still the right answer: the
       * player has changed their mind about the destination rather than asked for something
       * impossible, and `select` clears it.
       */
      if (destination && piece && piece.side === rules.turn()) {
        // ⚠️ Captured, because the closure below loses the narrowing that `destination &&` just won.
        const goal = destination;
        if (allowMove
          && rules.legalTargets(square).some((t) => t.x === goal.x && t.y === goal.y)
          && !allowMove(square, goal)) {
          return { kind: 'refused', from: square, to: goal };
        }
        const move = play(square, goal);
        if (move) return { kind: 'moved', move };
      }

      // Your own piece, whichever phase: pick it up, or move the selection to it.
      if (piece && piece.side === rules.turn()) return select(square);

      if (phase === 'selected' && selection) {
        /*
         * ⚠️ ASKED ONLY OF MOVES THE RULES ALREADY ALLOW, and asked BEFORE `play`. A teacher has no
         * opinion about a move that was never going to happen — putting the filter in front of the
         * legality check would let it turn "that piece does not move that way" into "try again",
         * and the child would be told the wrong thing about their own mistake.
         */
        if (allowMove && targets.some((t) => t.x === square.x && t.y === square.y)
          && !allowMove(selection, square)) {
          return { kind: 'refused', from: selection, to: square };
        }
        const move = play(selection, square);
        if (move) return { kind: 'moved', move };
        return { kind: 'illegal', square };
      }

      /*
       * ⚠️ AN EMPTY SQUARE IS NOW AN ANSWER, NOT A SHRUG. It used to return `ignored: empty`,
       * which is what made piece-first the only order the game understood. It becomes a
       * destination — but only if some piece can actually reach it, because remembering a square
       * nothing can move to would be a mode the player cannot see and cannot leave.
       */
      if (aiming && !piece && phase === 'idle') {
        const who = reachers(square);
        if (who.length > 0) return aim(square);
      }

      return { kind: 'ignored', reason: piece ? 'not-your-turn' : 'empty' };
    },

    animationDone() {
      settle();
    },

    canTakeBack: () => phase !== 'animating' && rules.canUndo(),
    canReplay: () => phase !== 'animating' && rules.canRedo(),

    takeBackStep: stepBack,
    replayStep: stepForward,

    think() {
      if (phase === 'idle') phase = 'thinking';
    },

    takeBack() {
      let step = stepBack();
      if (!step) return false;
      while (step.more) {
        const next = stepBack();
        if (!next) { settle(); break; }
        step = next;
      }
      return true;
    },

    replay() {
      let step = stepForward();
      if (!step) return false;
      while (step.more) {
        const next = stepForward();
        if (!next) { settle(); break; }
        step = next;
      }
      return true;
    },

    applyOpponentMove(from, to, promotion) {
      if (phase !== 'thinking') return null;
      const move = rules.move(from, to, promotion ?? undefined);
      if (!move) return null;
      inFlight = move;
      phase = 'animating';
      return move;
    },
  };
}
