# Teaching: why a lesson is a table, and why three different things are the same lesson

> ⚠️ **This is a record of the reasoning, not a description of the code.** What it describes is
> built and running; the README says what exists. This file says why it has the shape it has, and
> what it cost to find out — including the parts that were wrong first.

Status: **the mechanism is complete; the content is an editorial decision that has not been made.**
The syllabus, the tactics and the book converter all ship. Which chapters of Capablanca to carry,
and who writes the pt-BR and es beside his English, is §7.

## 1. The problem, which is not "the game has no tutorial"

The game already taught you to *play*: an opponent, hints, protected mode, a move list in real
notation. What it could not do is let a child read its own instructions. The hint said **"Mova o
Cavalo para f3"** to somebody who had never heard of f3.

So the first lesson is algebraic notation, and everything else follows from being able to read the
board's own language.

## 2. A lesson is DATA, and that decision paid for itself twice

`render/pieces/geometry.ts` made this argument first and it transfers exactly: a table can be
reasoned about without a renderer. A lesson is a list of steps; a step is a FEN, a sentence and one
of three tasks — `play` a move, `mark` a set of squares, `pick` a written answer.

A move is asked for **by what has to be true of it**:

```ts
{ kind: 'play', want: { castle: 'king' } }      // not { san: 'O-O' }
{ kind: 'play', want: { enPassant: true } }
{ kind: 'play', want: { promotion: 'q' } }
```

The whole model rests on a fact that already existed: `MoveResult` carries `castle`, `enPassant`,
`promotion` and `captured` as first-class fields, because `chess/rules.ts` was written that way for
the game. The three special rules a beginner has to be taught explicitly were **already vocabulary**.
`MoveShape` is that record with every field optional, and matching is a conjunction of equalities.
No interpreter, and nothing to run.

⚠️ **The alternative was a predicate function per step**, which is a scripting language wearing a
type, and which no test can check: a function can only be *run*, and running it needs the position
it was written for.

**What that bought, concretely.** After the data model and the tutor were written — with **zero**
rendering work done — the syllabus was already fully testable, and the table test found four
defects nobody would have found by reading:

- The knight's second step listed the squares reachable from d5 while the piece was on d4.
- ⚠️ **Four of the eleven lessons were unplayable.** Two lone kings, king-and-bishop, and
  king-and-knight are insufficient material, so `isGameOver()` was already true, the phase settled
  to `over`, and the board answered every square with `ignored/over`. Each of those positions now
  carries one spare pawn as ballast, and the table test asserts the phase is `idle`.
- A `mark` task can produce a **move**: the squares to mark are exactly the squares the held piece
  can go to. `right` and `waiting` had to gain an `undo`.
- A `pick` has a board underneath it, where a child pushes a pawn while reading.

## 3. Correcting an answer: play it, then take it back

`chess/state.ts` has no hook before a move. Three ways through were considered:

| | |
|---|---|
| A predicate in `GameStateOptions` | Changes the most-tested module in the game to serve a case that is not its own |
| Play and undo | **Chosen.** Already the pattern protected mode uses, already announced, already proven |
| A lesson driver that bypasses `state.ts` | Loses the declaration, the sonar, the DOM mirror and the keyboard at a stroke |

And the pedagogy agrees with the architecture. `ui/blunder-bar.ts` argued it first: *somebody being
told their move gave the game away needs to be looking at the position while they decide*. A child
who moved the bishop like a rook **has to see the bishop standing on the wrong square** before it
comes back. A predicate that refused the move would teach nothing.

## 4. Three different things, one driver

This is the part that keeps paying. A `Lesson` is the only thing the driver knows about, so
everything that can be *expressed* as one gets the tutor, the panel, the column, back and forward,
the teacher gate and one idea of "wrong" for free.

| | Converter | Steps are |
|---|---|---|
| The syllabus | none — it is the table | hand-written, thirteen lessons |
| A Lichess tactic | `teach/puzzle-lesson.ts` | the student's plies of the solution |
| An annotated game | `teach/game-lesson.ts` | the moves the annotator stopped at |

Each converter is short enough to read in one sitting. A second driver would not have been, and
would have brought its own panel, its own menu and its own bugs in all three.

**The two decisions the converters had to make, and they came out differently:**

- ⚠️ **A puzzle has an opponent; a book does not.** A puzzle is a problem posed to one side, so the
  other side answers by itself. A book is a game being studied — one board, one person, playing it
  through — so the student plays both sides and there is no `side` field at all.
- ⚠️ **A book makes a step only of the ANNOTATED moves.** The annotator's choice of where to stop
  *is* the book. The plies in between fold into the next step's FEN, which is what `Step.fen` has
  meant since the first lesson. A step per ply would have to invent a sentence for a move nobody
  wrote about, and the only true one is "play Nf3", which hands over the answer.

**And two off-by-ones that read almost sensibly, which is the dangerous kind:**

- A puzzle's every step carries its **own** FEN. `teach/position.ts` rebuilds a step by replaying
  the `play` goals before it — and the opponent's replies are not goals, so going backwards would
  rebuild every step one ply short, from a position with the wrong side to move.
- A book's note sits on the position its move *produced*, so the note on ply *N* is
  `commentAt(N + 1)` while the position to play it from is `positions[N]`. Shifted by one, every
  note lands on the previous move and still reads like chess.

## 5. What the teacher is, and when it is allowed

A **toggle**, not a button, and in a lesson it stays locked until the third mistake **on that step**
— help that arrives before anyone has tried is not help. The lock lives in the mode rather than in
the control's `disabled` attribute, so a key press cannot get round it.

⚠️ **What it reveals is the arrows, never the squares.** Not every `show` is a hint:
`show.squares` can be the *question* — the notation lesson asks "which square is this?" — so
revealing it would answer the exercise. `askedBy` and `hintedBy` are two different functions for
that reason.

## 6. Accessibility decisions specific to this mode

- **A touched square answers blue for right and red for wrong**, and those two measure **1.06:1**
  against each other — measured *before* they were chosen. So the shape carries it: right is a
  filled square, wrong is a hollow ring, and the label says which (WCAG 1.4.1).
- **A lesson highlight is a third SHAPE, not a third colour.** It coincides with "selected" and
  "you may capture here" in the same turn, so a second ring in another hue would fail 1.4.1 in the
  one mode whose reason to exist is teaching.
- ⚠️ **Getting a step wrong is not an emergency.** The text goes to `#sr-status`, politely.
  `#sr-alert` is never written by a lesson: only check and mate are assertive, and a course must
  not train a child to hear their own mistake as an alarm.
- **The lesson panel does not steal focus**, and does not rebuild its buttons on every draw — the
  first version removed the button that had focus when a hint appeared, and the browser dropped
  focus to `<body>`. Not calling `.focus()` and not destroying focus are different promises.

## 7. Open: the content, which is not a technical question

The mechanism takes a public-domain book unchanged. What it is waiting on is editorial:

**Capablanca, *Chess Fundamentals* (1921)** is clear to use — he died in 1942, so it entered the
public domain in Brazil in 2013, and he wrote it in English himself, which means there is no
translator's separate term to clear. Undecided: **which chapters**, and **who writes the pt-BR and
es** beside his English, since those translations would be new work of ours and are the real cost.

The same shape of question stands behind Staunton's explanatory text for the openings and behind
the history module. `docs/LICENSES.md` carries which books are usable at all, including two that
look usable and are not.

Shipped meanwhile: **Morphy's Opera Game, 1858, with notes written here.** A game's moves are facts
and its notes are not; ours need no permission, so the mechanism could ship while the book is still
being chosen.
