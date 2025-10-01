import pkg from 'chess.js';
const Chess = pkg.Chess || pkg;

function test(fen, moves) {
  const c = new Chess(fen);
  console.log('start', fen);
  for (const san of moves) {
    const mv = c.move(san, { sloppy: true });
    console.log('move', san, !!mv);
  }
  console.log('checkmate?', c.isCheckmate());
}

// Test 1: h8 black king, h6 white king, f7 white queen — move Qg7#
test('7k/5Q2/7K/8/8/8/8/8 w - - 0 1', ['Qg7#']);

// Test 2: h8 black king, h6 white king, g7 white queen — move Qh7#
test('7k/6Q1/7K/8/8/8/8/8 w - - 0 1', ['Qh7#']);

// Attempt mate in 2: starting pieces such that first is check, second mate
// Position: K h6, Q f6, k h8
// Line: Qg7+ Qx? only king move Kh7 then Qg7#? Let's test Qg7+ then Qx??
test('7k/8/5Q1K/8/8/8/8/8 w - - 0 1', ['Qg7+','Qx??']);
