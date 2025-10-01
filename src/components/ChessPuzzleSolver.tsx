import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Move, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { motion, AnimatePresence } from 'framer-motion';

type SolveStats = {
  puzzleId: string;
  moves: string[];
  timeSeconds: number;
  penalties: number;
  hintsUsed: number;
};

export interface ChessPuzzleSolverProps {
  puzzleId: string;
  fen: string;
  solution: string[]; // SAN moves, full line including opponent replies
  onSolve?: (stats: SolveStats) => void;
}

const brutal =
  'rounded-none border-[3px] border-black shadow-[6px_6px_0_#000] active:shadow-[2px_2px_0_#000] active:translate-x-[4px] active:translate-y-[4px] transition-all';

const unicode: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

export default function ChessPuzzleSolver({ puzzleId, fen, solution, onSolve }: ChessPuzzleSolverProps) {
  const [game, setGame] = useState(() => new Chess(fen));
  const [boardFen, setBoardFen] = useState(fen);
  const [index, setIndex] = useState(0); // pointer into solution array
  const [history, setHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [wrongShakeKey, setWrongShakeKey] = useState(0);
  const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);

  const [elapsed, setElapsed] = useState(0); // in seconds
  const [penalties, setPenalties] = useState(0);
  const [solved, setSolved] = useState(false);

  const boardWrapRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(480);

  // Timer
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [puzzleId]);

  // Resize observer for responsive board
  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setBoardSize(Math.max(280, Math.min(640, w)));
    });
    ro.observe(el);
    setBoardSize(Math.max(280, Math.min(640, el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  // Reset on new puzzle
  useEffect(() => {
    const g = new Chess(fen);
    setGame(g);
    setBoardFen(fen);
    setIndex(0);
    setHistory([]);
    setLastMove(null);
    setHintMove(null);
    setSolved(false);
    setElapsed(0);
    setPenalties(0);
    setHintsUsed(0);
  }, [fen, puzzleId]);

  const nextExpectedSan = solution[index] ?? null;

  // Auto-play opponent reply after a correct player move
  const maybeAutoPlayOpponent = useCallback(() => {
    // If next move in solution exists and it is opponent's move (by alternation), we auto-play it.
    // Since solution is full line starting from side-to-move in FEN, we alternate: after user plays move at index i, we auto-play i+1
    if (index >= solution.length) return;
    const g = new Chess(game.fen());
    // If it's opponent turn compared to original start after index moves are applied, we can check parity:
    // We just advanced index by 1 on the user move, so i is now odd -> auto-play.
    const i = index;
    if (i < solution.length && i % 2 === 1) {
      const san = solution[i];
      try {
        const mv = g.move(san, { sloppy: true });
        if (mv) {
          setGame(g);
          setBoardFen(g.fen());
          setHistory((h) => [...h, san]);
          setLastMove({ from: mv.from as Square, to: mv.to as Square });
          setIndex(i + 1);
        }
      } catch {}
    }
  }, [index, solution, game]);

  useEffect(() => {
    if (index === solution.length && !solved) {
      setSolved(true);
      const stats: SolveStats = {
        puzzleId,
        moves: history,
        timeSeconds: elapsed + penalties,
        penalties,
        hintsUsed,
      };
      onSolve?.(stats);
    } else {
      // after each state change, attempt opponent move if needed
      maybeAutoPlayOpponent();
    }
  }, [index]);

  // Board colors (Neo-brutalist palette)
  const boardStyle = useMemo(() => ({
    borderRadius: 0,
    boxShadow: 'inset 0 0 0 3px #000',
  }), []);

  const customDark = '#111827';
  const customLight = '#fde68a';

  // Square styles for feedback
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { background: 'rgba(16,185,129,0.35)' };
      styles[lastMove.to] = { background: 'rgba(16,185,129,0.5)' };
    }
    if (hintMove) {
      styles[hintMove.from] = { background: 'rgba(59,130,246,0.35)' };
      styles[hintMove.to] = { background: 'rgba(59,130,246,0.5)' };
    }
    return styles;
  }, [lastMove, hintMove]);

  const customPieces = useMemo(() => {
    const map: Record<string, (props: { squareWidth: number }) => JSX.Element> = {};
    (['wK','wQ','wR','wB','wN','wP','bK','bQ','bR','bB','bN','bP'] as const).forEach((k) => {
      map[k] = ({ squareWidth }) => (
        <div
          className="flex items-center justify-center font-bold"
          style={{
            width: squareWidth,
            height: squareWidth,
            fontSize: squareWidth * 0.65,
            textShadow: '2px 2px 0 #000',
            color: k.startsWith('w') ? '#111' : '#111',
            background: 'transparent',
          }}
        >
          <span className={k.startsWith('w') ? 'text-white' : 'text-black'}>{unicode[k]}</span>
        </div>
      );
    });
    return map;
  }, []);

  const onDrop = useCallback((sourceSquare: Square, targetSquare: Square) => {
    if (solved) return false;
    const g = new Chess(game.fen());
    // Find a legal move matching from-to
    const legal = g.moves({ verbose: true }) as Move[];
    const candidates = legal.filter((m) => m.from === sourceSquare && m.to === targetSquare);
    if (candidates.length === 0) {
      // wrong
      setWrongShakeKey((k) => k + 1);
      return false;
    }
    // Prefer queen promotion when needed
    const mv = candidates.find((m) => (m.promotion ? m.promotion === 'q' : true)) || candidates[0];
    const expected = solution[index];
    // Try to make the move and get SAN
    const made = g.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    if (!made) {
      setWrongShakeKey((k) => k + 1);
      return false;
    }
    const san = made.san;
    if (san !== expected) {
      // Revert if wrong
      setWrongShakeKey((k) => k + 1);
      return false;
    }
    // Correct
    setGame(g);
    setBoardFen(g.fen());
    setHistory((h) => [...h, san]);
    setLastMove({ from: mv.from as Square, to: mv.to as Square });
    setHintMove(null);
    setIndex((i) => i + 1);
    return true;
  }, [game, index, solution, solved]);

  const useHint = useCallback(() => {
    if (solved || !nextExpectedSan) return;
    const g = new Chess(game.fen());
    // Find the move squares for the next SAN
    try {
      const verboseMoves = g.moves({ verbose: true }) as Move[];
      for (const m of verboseMoves) {
        const tmp = new Chess(g.fen());
        const made = tmp.move({ from: m.from, to: m.to, promotion: m.promotion });
        if (made?.san === nextExpectedSan) {
          setHintMove({ from: m.from as Square, to: m.to as Square });
          setHintsUsed((c) => c + 1);
          setPenalties((p) => p + 30);
          break;
        }
      }
    } catch {}
  }, [game, nextExpectedSan, solved]);

  const timeDisplay = useMemo(() => {
    const total = elapsed + penalties;
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${pad(s)}`;
  }, [elapsed, penalties]);

  return (
    <div className="w-full grid lg:grid-cols-2 gap-6">
      <motion.div
        key={wrongShakeKey}
        ref={boardWrapRef}
        className={`bg-yellow-200 p-3 ${brutal}`}
        initial={{ x: 0 }}
        animate={{ x: [0, -6, 6, -3, 3, 0] }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-black uppercase tracking-wider">Puzzle #{puzzleId}</div>
          <div className="text-xs font-black">Time: {timeDisplay} {penalties > 0 && <span className="opacity-60">(+{penalties}s)</span>}</div>
        </div>
        <Chessboard
          id={`puzzle-${puzzleId}`}
          position={boardFen}
          onPieceDrop={onDrop}
          customBoardStyle={boardStyle}
          customDarkSquareStyle={{ backgroundColor: customDark }}
          customLightSquareStyle={{ backgroundColor: customLight }}
          customSquareStyles={squareStyles}
          boardWidth={boardSize}
          animationDuration={300}
          areArrowsAllowed={false}
          customPieces={customPieces}
        />
        <div className="mt-3 flex gap-2">
          <button className={`px-3 py-2 bg-blue-300 hover:bg-blue-400 ${brutal}`} onClick={useHint} disabled={solved}>Hint (-30s)</button>
          <button className={`px-3 py-2 bg-purple-300 hover:bg-purple-400 ${brutal}`} onClick={() => {
            // Reset
            const g = new Chess(fen);
            setGame(g);
            setBoardFen(fen);
            setIndex(0);
            setHistory([]);
            setLastMove(null);
            setHintMove(null);
            setSolved(false);
            setElapsed(0);
            setPenalties(0);
            setHintsUsed(0);
          }}>Reset</button>
        </div>
      </motion.div>

      <div className={`bg-white dark:bg-zinc-900 p-4 ${brutal}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-black">Move History</div>
          <div className="text-xs opacity-60">{history.length}/{solution.length}</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {history.map((san, i) => (
            <div key={i} className="px-2 py-1 bg-green-100 dark:bg-green-900 border border-black">{i + 1}. {san}</div>
          ))}
          {index < solution.length && (
            <div className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 border border-black">Next: {solution[index]}</div>
          )}
        </div>
        <div className="mt-4">
          <div className="text-xs font-bold uppercase mb-2">Instructions</div>
          <ul className="list-disc ml-5 text-xs space-y-1">
            <li>Reproduce the solution exactly. The opponent replies automatically.</li>
            <li>Use Hint to reveal the next move path (30s penalty).</li>
            <li>Wrong moves will shake the board in red.</li>
          </ul>
        </div>
      </div>

      <AnimatePresence>
        {solved && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40" />
            <motion.div
              className={`relative bg-white p-6 ${brutal}`}
              initial={{ scale: 0.8, rotate: -2 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div className="text-2xl font-black mb-2">Puzzle Solved!</div>
              <div className="text-sm mb-4">Time: {timeDisplay} {penalties > 0 && <span className="opacity-60">(incl. penalties)</span>}</div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                {history.map((san, i) => (
                  <div key={i} className="px-2 py-1 bg-green-100 border border-black">{i + 1}. {san}</div>
                ))}
              </div>
              <div className="flex justify-end">
                <button className={`px-4 py-2 bg-green-300 hover:bg-green-400 ${brutal}`} onClick={() => setSolved(false)}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
