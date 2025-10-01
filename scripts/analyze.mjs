import pkg from 'chess.js';
const Chess = pkg.Chess || pkg;

function analyze(fen, line) {
  const c = new Chess(fen);
  console.log('Start FEN:', fen);
  console.log('Legal moves from start:', c.moves());
  for (const san of line) {
    console.log('Play', san);
    if (san === 'Kh7') {
      console.log('Before Kh7 legal moves for black:', c.moves());
    }
    let mv;
    try { mv = c.move(san, { sloppy: true }); } catch (e) { console.log('Exception moving', san, e.message); break; }
    console.log('result', !!mv);
    if (!mv) {
      console.log('Illegal at this step. Current legal:', c.moves());
      return;
    }
    console.log('After move FEN:', c.fen());
    console.log('Legal moves:', c.moves());
  }
  console.log('Checkmate?', c.isCheckmate());
}

analyze('7k/4Q3/7K/8/8/8/8/8 w - - 0 1', ['Qf8+','Kh7','Qg7#']);
