import pkg from 'chess.js';
const Chess = pkg.Chess || pkg;
console.log('class?', typeof Chess);
const c = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
console.log('fen', c.fen());
