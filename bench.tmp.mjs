import { Chess } from 'chess.js';

const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1';
const N = 3000;

function time(label, fn) {
  const g = new Chess(FEN);
  const t0 = performance.now();
  for (let i = 0; i < N; i++) fn(g);
  const us = (performance.now() - t0) / N * 1000;
  console.log(`${label.padEnd(30)} ${us.toFixed(2).padStart(8)} us`);
}

time('moves()', (g) => g.moves());
time('moves({verbose:true})', (g) => g.moves({ verbose: true }));
time('isCheck()', (g) => g.isCheck());
time('isCheckmate()', (g) => g.isCheckmate());
time('isDraw()', (g) => g.isDraw());
time('board()', (g) => g.board());
time('move+undo', (g) => { g.move('e5'); g.undo(); });
