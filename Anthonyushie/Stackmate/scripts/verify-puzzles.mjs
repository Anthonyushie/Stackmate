import fs from 'fs';
import pkg from 'chess.js';
const { Chess } = pkg;

const puzzles = JSON.parse(fs.readFileSync(new URL('../src/data/puzzles.json', import.meta.url)));

function verifyPuzzle(p) {
  let chess;
  try {
    chess = new Chess(p.fen);
  } catch {
    return { ok: false, reason: `Invalid FEN: ${p.fen}` };
  }
  let moveNo = 0;
  try {
    for (const san of p.solution) {
      moveNo++;
      const mv = chess.move(san, { sloppy: true });
      if (!mv) return { ok: false, reason: `Illegal move at step ${moveNo}: ${san}` };
    }
  } catch (e) {
    return { ok: false, reason: e.message };
  }
  if (!chess.isCheckmate()) {
    return { ok: false, reason: 'Final position is not checkmate' };
  }
  return { ok: true };
}

const buckets = ['beginner', 'intermediate', 'expert'];
let allOk = true;
for (const b of buckets) {
  for (const p of puzzles[b]) {
    const r = verifyPuzzle(p);
    if (!r.ok) {
      allOk = false;
      console.error(`[FAIL] ${p.id} (${b}): ${r.reason}`);
    } else {
      console.log(`[OK] ${p.id} (${b})`);
    }
  }
}

if (!allOk) process.exit(1);
console.log('All puzzles verified.');
