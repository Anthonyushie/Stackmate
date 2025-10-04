import puzzles from '../data/puzzles.json';
import { Chess, validateFen } from 'chess.js'; // ✅ import validateFen

export type Difficulty = 'beginner' | 'intermediate' | 'expert';

export interface Puzzle {
  id: string;
  fen: string;
  solution: string[];
  description: string;
  difficulty: Difficulty;
}

export interface PuzzleDB {
  beginner: Puzzle[];
  intermediate: Puzzle[];
  expert: Puzzle[];
}

const DB = puzzles as PuzzleDB;

export function getPuzzlesByDifficulty(difficulty: Difficulty): Puzzle[] {
  return [...(DB[difficulty] || [])];
}

export function getPuzzleById(id: string): Puzzle | undefined {
  for (const d of ['beginner', 'intermediate', 'expert'] as Difficulty[]) {
    const found = DB[d].find(p => p.id === id);
    if (found) return found;
  }
  return undefined;
}

export function getRandomPuzzle(difficulty: Difficulty): Puzzle | undefined {
  const list = getPuzzlesByDifficulty(difficulty);
  if (!list.length) return undefined;
  return list[Math.floor(Math.random() * list.length)];
}

function ensureFenLegal(fen: string): boolean {
  try {
    return validateFen(fen).ok; // ✅ use top-level validateFen
  } catch {
    return false;
  }
}

export function validateSolution(
  puzzleId: string,
  moves: string[]
): { ok: boolean; reason?: string } {
  const p = getPuzzleById(puzzleId);
  if (!p) return { ok: false, reason: 'Puzzle not found' };
  if (!ensureFenLegal(p.fen)) return { ok: false, reason: 'Invalid FEN' };

  try {
    const chess = new Chess(p.fen);

    // 1. Play moves to ensure legality
    for (const mv of moves) {
      const res = chess.move(mv); // ✅ no sloppy mode
      if (res === null) return { ok: false, reason: `Illegal move: ${mv}` };
    }

    // 2. Compare with stored solution
    const correct = p.solution.map(m => m.trim());
    const user = moves.map(m => m.trim());

    if (correct.length !== user.length) {
      return { ok: false, reason: 'Incorrect number of moves' };
    }
    for (let i = 0; i < correct.length; i++) {
      if (correct[i] !== user[i]) {
        return {
          ok: false,
          reason: `Move ${i + 1} incorrect: expected ${correct[i]}, got ${user[i]}`
        };
      }
    }

    return { ok: true }; // ✅ solution matches
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Validation error' };
  }
}

export async function hashSolution(moves: string[]): Promise<string> {
  const encoder = new TextEncoder();
  const input = encoder.encode(moves.join(' '));
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', input);
    const bytes = new Uint8Array(digest);
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  try {
    const { createHash } = await import('crypto');
    const h = createHash('sha256').update(Buffer.from(input)).digest('hex');
    return '0x' + h;
  } catch {
    // last-resort fallback
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input[i]) >>> 0;
    return '0x' + h.toString(16).padStart(64, '0').slice(0, 64);
  }
}
