// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/openings/en — why anyone plays each opening, in English.
//
// Not a translation of `pt.ts` and not a transcription of Staunton: the same three sentences
// written again, because an English sentence that reads like a translated Portuguese one is worse
// than either. The structure is kept on purpose — what the opening DOES, why anyone would, and
// what it costs — because every opening costs something and hiding that teaches a child that some
// moves are free.
//
// ⚠️ The moves are in the SAN the move list prints, which is this notation anyway. See
// `i18n/openings/index.ts` for why that is a decision rather than a default.

import type { OpeningStrings } from './index.ts';

export const en: OpeningStrings = {
  /* ---------------- 1.e4 e5 ---------------- */
  'opening.kingpawn':
    'The king\'s pawn opens a road for the bishop and the queen in a single move, which is why 1.e4 '
    + 'is the most played first move in history. Someone who opens this way wants their pieces out '
    + 'fast.',
  'opening.italian':
    'The bishop goes to c4 and stares straight at f7, the weakest square on the board at the start. '
    + 'It is the oldest opening still played in tournaments and the best one to learn from: '
    + 'everything that happens in it is visible. The price is that your opponent knows it too.',
  'opening.ruylopez':
    'The bishop goes to b5 and attacks the knight defending the e5 pawn. The point is not to win '
    + 'that pawn now — it is to pester its defender for the rest of the game. It is called the '
    + 'Spanish Opening, and it has been the champions\' favourite for four hundred years.',
  'opening.fourknights':
    'All four knights come out before anything else happens. It is symmetrical, solid and almost '
    + 'trap-free, so a learner can follow every move. Games like this are decided later, in the '
    + 'middlegame, not in the opening.',
  'opening.scotch':
    'White breaks the centre open on move three with d4 and trades the pawn at once. The board opens '
    + 'and the pieces get room, but the queen tends to come out early, and whatever comes out early '
    + 'gets chased.',
  'opening.vienna':
    'The knight goes to c3 first, keeping the f4 push in reserve. It is a calm way to prepare a '
    + 'violent attack, and that is exactly why it fools people: it looks slow and is not.',
  'opening.bishops':
    'The bishop aims at f7 on move two, before any knight moves. It is direct and leaves White an '
    + 'unusual number of choices. The cost is a centre left unsupported for a few moves.',
  'opening.center':
    'White opens the centre immediately and accepts bringing the queen out to recapture. You gain '
    + 'time and space; you lose peace of mind, because an exposed queen is what knights are for.',
  'opening.kgaccepted':
    'White offered the f2 pawn and Black took it. Now White has the centre and an open file for the '
    + 'rook, and Black has an extra pawn and a draughtier king. It is the most romantic opening of '
    + 'the nineteenth century and the most dangerous for both players.',
  'opening.kgdeclined':
    'Black turned the pawn down and held the centre instead. This is the grown-up answer: a present '
    + 'you never accept is one you never have to give back. The game gets less wild and much longer.',
  'opening.petrov':
    'Black answers by attacking rather than defending: the knight goes to f6 and asks the e4 pawn '
    + 'for payment. Trading in the centre simplifies everything, which is wonderful when you are '
    + 'behind on the clock and dull when you wanted a complicated game.',
  'opening.philidor':
    'Black holds the e5 pawn with d6, with a pawn. It is solid, and it was the recommendation of '
    + 'Philidor, the game\'s first great theorist. The flaw is space: the f8 bishop sits behind its '
    + 'own pawn for quite a while.',

  /* ---------------- 1.e4, answered otherwise ---------------- */
  'opening.sicilian':
    'Black does not answer in the centre at all: c5 comes from the side and already offers to trade '
    + 'a wing pawn for a centre pawn. It is the most played defence in the world because it is not '
    + 'looking for a draw — it is looking for imbalance. In exchange, Black\'s king takes longer to '
    + 'get safe.',
  'opening.french':
    'Black prepares d5 with e6 and accepts that the c8 bishop is shut in for now. The trade is '
    + 'plain: less space today, a structure that is very hard to break tomorrow. People who enjoy '
    + 'defending love this one.',
  'opening.carokann':
    'The same idea as the French — get to d5 — but prepared with c6, so the c8 bishop stays free. It '
    + 'is for someone who wants solidity without paying in trapped pieces. The cost is time: c6 '
    + 'develops nothing.',
  'opening.scandinavian':
    'Black plays d5 on move one and trades in the centre immediately. It is easy to learn and has '
    + 'almost nothing to memorise. But the black queen comes out very early, and White gains moves '
    + 'by chasing her.',
  'opening.alekhine':
    'The knight goes to f6 at once, inviting the white pawns to chase it. The plan is to let White '
    + 'advance too far and then attack that pawn wall from underneath. It is a bet: if the wall '
    + 'holds, Black has no room.',
  'opening.pirc':
    'Black gives up the centre on purpose and builds a house for the king with g6 and a bishop on '
    + 'g7. That bishop watches the whole board along the long diagonal. The risk is well known: if '
    + 'the counter-attack never comes, only the squeeze is left.',
  'opening.modern':
    'The Pirc\'s idea without the commitment: g6 first, and the knight decides where it belongs '
    + 'later. It gives Black maximum flexibility and White the freest hand in the centre.',

  /* ---------------- 1.d4 ---------------- */
  'opening.queenpawn':
    'The queen\'s pawn advances already defended by the queen herself, and that is the whole '
    + 'difference between 1.d4 and 1.e4. Games tend to be more closed and to turn on plans rather '
    + 'than on immediate tactics.',
  'opening.qgd':
    'White offers the c4 pawn and Black declines, holding d5 with e6. This is the world '
    + 'championship opening: little luck, a great deal of planning. The c8 bishop pays for it, just '
    + 'as in the French.',
  'opening.qga':
    'Black takes the c4 pawn knowing it will not be kept. The profit is elsewhere: a centre pawn '
    + 'traded for freedom for the pieces. Playing this way means accepting less centre in return for '
    + 'never being cramped.',
  'opening.slav':
    'Black holds d5 with c6 instead of e6, so the c8 bishop can still come out to f5 or g4. It is '
    + 'the solid way to meet the Queen\'s Gambit without shutting anything in. The price is that the '
    + 'c6 pawn is standing on its own knight\'s square.',
  'opening.semislav':
    'Black plays both c6 and e6, taking the best of both and the worst too: the structure becomes '
    + 'very firm and the c8 bishop very stuck. Some of the hardest and most studied positions in '
    + 'chess come from here.',
  'opening.nimzo':
    'The bishop goes to b4 and pins the c3 knight — the knight White needs in order to push e4. It '
    + 'is the most respected defence to 1.d4, and it fights for the centre with pieces instead of '
    + 'pawns. Black usually gives that bishop up for the knight, and that is part of the plan.',
  'opening.kingsindian':
    'Black lets White take the centre, tucks the king behind g6 with a bishop on g7, and only then '
    + 'strikes with e5 or c5. It is pure counter-attack, and it is the favourite of players who play '
    + 'to win. It also punishes anyone who does not know the plan.',
  'opening.queensindian':
    'Black puts the bishop on b7 and watches the centre along the long diagonal, from a distance. It '
    + 'is solid, flexible and nearly impossible to attack early. It also draws rather easily.',
  'opening.grunfeld':
    'Black answers in the centre with d5 and invites White to take everything with pawns. The idea '
    + 'is that an enormous white pawn wall is also an enormous target, and it will be shot at from '
    + 'the sides. It needs nerve and accuracy.',
  'opening.benoni':
    'Black meets d4 with c5 from the side, accepting less space in return for an open file and a '
    + 'later push with e5 or b5. It is sharp: decisive games and few draws.',
  'opening.dutch':
    'Black plays f5 and points at White\'s king from move one. It is aggressive and rare. The price '
    + 'is immediate and permanent: the e6 square and Black\'s own king\'s diagonal are weaker for '
    + 'good.',

  /* ---------------- no centre pawn on move one ---------------- */
  'opening.english':
    'White starts on the wing with c4 and fights for the centre from a distance. It can turn into '
    + 'almost any other opening later, which is why so many champions use it: it hides the plan.',
  'opening.reti':
    'The knight comes out before any centre pawn, and White settles the centre only after seeing '
    + 'what Black does. This is the idea that changed chess in the 1920s: occupy the centre with '
    + 'pieces instead of pawns.',
};
