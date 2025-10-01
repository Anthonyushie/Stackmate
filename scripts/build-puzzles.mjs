import fs from 'fs';
import pkg from 'chess.js';
const Chess = pkg.Chess || pkg;

const DATASET_API = 'https://datasets-server.huggingface.co/rows?dataset=Lichess%2Fchess-puzzles&config=default&split=train&offset={OFFSET}&length=100';

function hasTheme(themes, t) {
  return Array.isArray(themes) && themes.includes(t);
}

function uciToSanSequence(fen, uciMoves) {
  const c = new Chess(fen);
  const sans = [];
  for (const u of uciMoves.split(' ')) {
    const from = u.slice(0, 2);
    const to = u.slice(2, 4);
    const promotion = u.length > 4 ? u[4] : undefined;
    const mv = c.move({ from, to, promotion });
    if (!mv) return { ok: false, reason: `Illegal ${u}`, sans };
    sans.push(mv.san);
  }
  return { ok: true, sans, checkmate: c.isCheckmate() };
}

async function fetchRows(offset) {
  const url = DATASET_API.replace('{OFFSET}', String(offset));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  return res.json();
}

function descFor(themes, id) {
  const mi = themes.find(t => /^mateIn\d$/.test(t));
  const n = mi ? mi.replace('mateIn','') : '';
  return `Lichess ${id}: Mate in ${n}`;
}

async function build() {
  const need = { beginner: 20, intermediate: 20, expert: 20 };
  const buckets = { beginner: [], intermediate: [], expert: [] };
  let offset = 0;
  while (need.beginner + need.intermediate + need.expert > 0 && offset < 100000) {
    const page = await fetchRows(offset);
    for (const { row } of page.rows) {
      const { FEN, Moves, Themes, PuzzleId } = row;
      const mi1 = hasTheme(Themes, 'mateIn1');
      const mi2 = hasTheme(Themes, 'mateIn2');
      const mi3 = hasTheme(Themes, 'mateIn3');
      const mi4 = hasTheme(Themes, 'mateIn4');
      if (!(mi1 || mi2 || mi3 || mi4)) continue;
      const { ok, sans, checkmate } = uciToSanSequence(FEN, Moves);
      if (!ok || !checkmate) continue;
      let difficulty;
      if (mi1) difficulty = 'beginner';
      else if (mi2) difficulty = 'intermediate';
      else if (mi3 || mi4) difficulty = 'expert';
      if (!difficulty) continue;
      if (need[difficulty] <= 0) continue;
      const item = {
        id: '',
        fen: FEN,
        solution: sans,
        description: descFor(Themes, PuzzleId),
        difficulty,
        estimatedSolveTime: '30s',
        source: { dataset: 'Lichess chess-puzzles', puzzleId: PuzzleId, url: row.PuzzleUrl }
      };
      buckets[difficulty].push(item);
      need[difficulty]--;
      if (need.beginner + need.intermediate + need.expert === 0) break;
    }
    offset += page.num_rows_per_page || 100;
  }

  // assign ids
  const assignIds = (arr, prefix) => arr.forEach((p, i) => p.id = `${prefix}${i+1}`);
  assignIds(buckets.beginner, 'b');
  assignIds(buckets.intermediate, 'i');
  assignIds(buckets.expert, 'e');

  if (buckets.beginner.length !== 20 || buckets.intermediate.length !== 20 || buckets.expert.length !== 20) {
    throw new Error(`Incomplete set: b=${buckets.beginner.length}, i=${buckets.intermediate.length}, e=${buckets.expert.length}`);
  }

  const out = { beginner: buckets.beginner, intermediate: buckets.intermediate, expert: buckets.expert };
  const json = JSON.stringify(out, null, 2);
  fs.writeFileSync(new URL('../src/data/puzzles.json', import.meta.url), json);
}

build().then(()=>console.log('Built puzzles.json')).catch(e=>{console.error(e);process.exit(1)});
