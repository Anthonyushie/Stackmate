import puzzles from '../data/puzzles.json';
import { Chess } from 'chess.js';

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
  for (const d of ['beginner','intermediate','expert'] as Difficulty[]) {
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
    const chess = new Chess(fen);
    return chess.validate_fen(fen).valid;
  } catch {
    return false;
  }
}

export function validateSolution(puzzleId: string, moves: string[]): { ok: boolean; reason?: string } {
  const p = getPuzzleById(puzzleId);
  if (!p) return { ok: false, reason: 'Puzzle not found' };
  if (!ensureFenLegal(p.fen)) return { ok: false, reason: 'Invalid FEN' };

  try {
    const chess = new Chess(p.fen);
    for (const mv of moves) {
      const res = chess.move(mv, { sloppy: true });
      if (res === null) return { ok: false, reason: `Illegal move: ${mv}` };
    }
    return { ok: true };
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
  // Fallback for non-browser environments (Node.js)
  try {
    const { createHash } = await import('crypto');
    const h = createHash('sha256').update(Buffer.from(input)).digest('hex');
    return '0x' + h;
  } catch {
    // Last-resort naive hash (not cryptographically secure)
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input[i]) >>> 0;
    return '0x' + h.toString(16).padStart(64, '0').slice(0, 64);
  }
}
