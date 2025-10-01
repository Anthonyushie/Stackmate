import { Chess, type Move, type PieceSymbol, type Square, validateFen } from 'chess.js';

export type ValidationSuccess = {
  legal: true;
  san: string;
  uci: string;
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
  nextFen: string;
};

export type ValidationFailure = {
  legal: false;
  reason: string;
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

export type Hint = {
  san: string;
  uci: string;
  from: Square;
  to: Square;
};

function isCoordLike(input: string): boolean {
  const s = input.trim();
  return /^[a-h][1-8][-]?[a-h][1-8](?:=?[qrbnQRBN])?$/i.test(s);
}

function sanitizeCoordinate(input: string): string {
  return input.trim().replace(/\s+/g, '').replace('-', '').toLowerCase();
}

function coordToParts(coord: string): { from: Square; to: Square; promo?: PieceSymbol } | null {
  const s = sanitizeCoordinate(coord);
  const m = /^([a-h][1-8])([a-h][1-8])(?:=?([qrbn]))?$/.exec(s);
  if (!m) return null;
  const from = m[1] as Square;
  const to = m[2] as Square;
  const promo = (m[3] as PieceSymbol | undefined) || undefined;
  return { from, to, promo };
}

function toUci(from: Square, to: Square, promotion?: PieceSymbol): string {
  return `${from}${to}${promotion ? promotion : ''}`;
}

function normalizeSan(input: string): string {
  return input
    .trim()
    .replace(/0-0/gi, 'O-O')
    .replace(/0-0-0/gi, 'O-O-O')
    .replace(/[+#]+$/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function normalizeCoord(input: string): string {
  return sanitizeCoordinate(input);
}

function stringsEqualLoose(a: string, b: string): boolean {
  if (a === b) return true;
  const aSan = normalizeSan(a);
  const bSan = normalizeSan(b);
  if (aSan === bSan) return true;
  const aUci = normalizeCoord(a);
  const bUci = normalizeCoord(b);
  return aUci === bUci;
}

export function validateMove(fen: string, move: string): ValidationResult {
  try {
    const fenCheck = validateFen(fen);
    if (!fenCheck.ok) return { legal: false, reason: `Invalid FEN: ${fenCheck.error || 'format error'}` };

    const chess = new Chess(fen);

    let result: Move | null = null;

    if (isCoordLike(move)) {
      const parts = coordToParts(move);
      if (!parts) return { legal: false, reason: 'Malformed coordinate move' };
      const { from, to, promo } = parts;

      let promotion: PieceSymbol | undefined = promo;

      const piece = chess.get(from);
      if (piece && piece.type === 'p') {
        const toRank = to[1];
        if (piece.color === 'w' && toRank === '8') {
          if (!promotion) promotion = 'q';
        } else if (piece.color === 'b' && toRank === '1') {
          if (!promotion) promotion = 'q';
        }
      }

      result = chess.move({ from, to, promotion });
    } else {
      result = chess.move(move);
    }

    if (!result) return { legal: false, reason: 'Illegal move in current position' };

    const promotion = (result as any).promotion as PieceSymbol | undefined;
    const from = result.from as Square;
    const to = result.to as Square;
    const uci = toUci(from, to, promotion);

    return {
      legal: true,
      san: result.san,
      uci,
      from,
      to,
      promotion,
      nextFen: chess.fen(),
    };
  } catch (e: any) {
    return { legal: false, reason: e?.message || 'Validation failed' };
  }
}

export function checkSolution(currentMoves: string[], correctSolution: string[]): { match: boolean; mismatchIndex?: number } {
  const len = currentMoves.length;
  for (let i = 0; i < len; i++) {
    const a = currentMoves[i];
    const b = correctSolution[i];
    if (typeof a !== 'string' || typeof b !== 'string') {
      return { match: false, mismatchIndex: i };
    }
    if (!stringsEqualLoose(a, b)) {
      return { match: false, mismatchIndex: i };
    }
  }
  return { match: true };
}

export function isSolutionComplete(currentMoves: string[], solution: string[]): boolean {
  const { match } = checkSolution(currentMoves, solution);
  return match && currentMoves.length === solution.length;
}

export function getHint(fen: string, solution: string[], currentMoveIndex: number): Hint | null {
  try {
    const fenCheck = validateFen(fen);
    if (!fenCheck.ok) return null;
    if (currentMoveIndex < 0 || currentMoveIndex >= solution.length) return null;

    const expected = solution[currentMoveIndex];
    const chess = new Chess(fen);

    const legal = chess.moves({ verbose: true }) as Move[];
    for (const m of legal) {
      const tmp = new Chess(chess.fen());
      const made = tmp.move({ from: m.from, to: m.to, promotion: m.promotion });
      if (!made) continue;

      const san = made.san;
      const candidateUci = toUci(m.from as Square, m.to as Square, (made as any).promotion);

      if (stringsEqualLoose(san, expected) || stringsEqualLoose(candidateUci, expected)) {
        return {
          san,
          uci: candidateUci,
          from: m.from as Square,
          to: m.to as Square,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function calculateScore(solveTime: number, hintsUsed: number): number {
  if (!Number.isFinite(solveTime) || solveTime < 0) solveTime = 0;
  if (!Number.isFinite(hintsUsed) || hintsUsed < 0) hintsUsed = 0;

  const penaltySecondsFromHints = 30 * hintsUsed;
  const total = solveTime + penaltySecondsFromHints;
  const score = 1000 - total;
  return Math.max(0, Math.round(score));
}
