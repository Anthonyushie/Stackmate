import pkg from 'chess.js';
const Chess = pkg.Chess || pkg;

function test(fen, line) {
  const c = new Chess(fen);
  for (let i = 0; i < line.length; i++) {
    const san = line[i];
    const mv = c.move(san, { sloppy: true });
    if (!mv) return { ok: false, reason: `Illegal ${san} at ply ${i+1}`, pos: c.fen() };
    if (i % 2 === 0) {
      // after white move
      const moves = c.moves();
      // ensure it's a check (to constrain)
      if (!c.inCheck()) return { ok: false, reason: `White move ${san} not check`, pos: c.fen(), moves };
      if (i < line.length - 1 && moves.length !== 1) return { ok: false, reason: `Not forced at ply ${i+1}, legal replies ${moves.length}`, pos: c.fen(), moves };
    }
  }
  return { ok: (new Chess(c.fen())).isCheckmate() };
}

const cases = [
  { fen: '7k/4Q3/8/8/8/8/8/7K w - - 0 1', line: ['Qf8+','Kh7','Qg7#'] },
  { fen: '7k/5Q2/8/8/8/8/8/7K w - - 0 1', line: ['Qf8+','Kh7','Qg7#'] },
  { fen: '7k/5Q2/8/8/8/8/8/7K w - - 0 1', line: ['Qg7+','Qxg7','Qxg7#'] },
];

for (const c of cases) {
  const r = test(c.fen, c.line);
  console.log(c, '=>', r);
}
