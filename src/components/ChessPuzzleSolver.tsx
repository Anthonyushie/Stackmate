import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Move, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, RotateCcw, PartyPopper } from 'lucide-react';
import type { JSX } from 'react/jsx-runtime';
import { colors, shadows } from '../styles/neo-brutal-theme';
import NeoButton from './neo/NeoButton';
import NeoBadge from './neo/NeoBadge';

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
  solution: string[];
  onSolve?: (stats: SolveStats) => void;
}

const unicode: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

export default function ChessPuzzleSolver({ puzzleId, fen, solution, onSolve }: ChessPuzzleSolverProps) {
  const [game, setGame] = useState(() => new Chess(fen));
  const [boardFen, setBoardFen] = useState(fen);
  const renderFen = useMemo(() => {
    const f = boardFen || fen || 'start';
    try { new Chess(f); } catch { return 'start'; }
    return f;
  }, [boardFen, fen]);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [wrongShakeKey, setWrongShakeKey] = useState(0);
  const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);

  const [elapsed, setElapsed] = useState(0);
  const [penalties, setPenalties] = useState(0);
  const [solved, setSolved] = useState(false);

  const boardWrapRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(480);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [puzzleId]);

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

  const maybeAutoPlayOpponent = useCallback(() => {
    if (index >= solution.length) return;
    const g = new Chess(game.fen());
    const i = index;
    if (i < solution.length && i % 2 === 1) {
      const san = solution[i];
      try {
        const mv = g.move(san);
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
      maybeAutoPlayOpponent();
    }
  }, [index]);

  const boardStyle = useMemo(() => ({
    borderRadius: 0,
    boxShadow: `inset 0 0 0 6px ${colors.border}`,
  }), []);

  const customDark = '#111827';
  const customLight = '#fde68a';

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { background: colors.success, opacity: 0.5 };
      styles[lastMove.to] = { background: colors.success, opacity: 0.7 };
    }
    if (hintMove) {
      styles[hintMove.from] = { background: colors.accent, opacity: 0.5, boxShadow: `inset 0 0 0 4px ${colors.accent}` };
      styles[hintMove.to] = { background: colors.accent, opacity: 0.7, boxShadow: `inset 0 0 0 4px ${colors.accent}` };
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
            textShadow: `3px 3px 0 ${colors.border}`,
            color: k.startsWith('w') ? '#fff' : '#000',
            background: 'transparent',
          }}
        >
          <span>{unicode[k]}</span>
        </div>
      );
    });
    return map;
  }, []);

  const onDrop = useCallback((sourceSquare: Square, targetSquare: Square) => {
    if (solved) return false;
    const g = new Chess(game.fen());
    const legal = g.moves({ verbose: true }) as Move[];
    const candidates = legal.filter((m) => m.from === sourceSquare && m.to === targetSquare);
    if (candidates.length === 0) {
      setWrongShakeKey((k) => k + 1);
      return false;
    }
    const mv = candidates.find((m) => (m.promotion ? m.promotion === 'q' : true)) || candidates[0];
    const expected = solution[index];
    const made = g.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    if (!made) {
      setWrongShakeKey((k) => k + 1);
      return false;
    }
    const san = made.san;
    if (san !== expected) {
      setWrongShakeKey((k) => k + 1);
      return false;
    }
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

  const reset = useCallback(() => {
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
  }, [fen]);

  return (
    <div className="w-full grid lg:grid-cols-[2fr_1fr] gap-6">
      {/* Board Section */}
      <motion.div
        key={wrongShakeKey}
        ref={boardWrapRef}
        initial={{ x: 0 }}
        animate={{ x: wrongShakeKey > 0 ? [0, -8, 8, -4, 4, 0] : 0 }}
        transition={{ duration: 0.4 }}
        style={{
          padding: '16px',
          background: colors.primary,
          border: `6px solid ${colors.border}`,
          boxShadow: shadows.brutal,
          transform: 'rotate(-1deg)',
        }}
      >
        {/* Timer and Puzzle ID */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <NeoBadge color={colors.dark} size="md">
            PUZZLE #{puzzleId}
          </NeoBadge>
          <div
            style={{
              padding: '8px 16px',
              background: colors.dark,
              border: `4px solid ${colors.border}`,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 900,
              fontSize: 'clamp(16px, 3vw, 20px)',
              color: colors.primary,
              textShadow: `0 0 6px ${colors.primary}`,
            }}
          >
            {timeDisplay}
            {penalties > 0 && (
              <span style={{ fontSize: '12px', opacity: 0.7 }}> (+{penalties}s)</span>
            )}
          </div>
        </div>

        {/* Chess Board */}
        <Chessboard
          key={`board-${puzzleId}-${renderFen}`}
          {...({
            position: renderFen,
            onPieceDrop: onDrop,
            customBoardStyle: boardStyle,
            customDarkSquareStyle: { backgroundColor: customDark },
            customLightSquareStyle: { backgroundColor: customLight },
            customSquareStyles: squareStyles,
            boardWidth: boardSize,
            animationDuration: 200,
            areArrowsAllowed: false,
            customPieces: customPieces,
          } as any)}
        />

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
          <NeoButton variant="accent" size="md" onClick={useHint} disabled={solved}>
            <Lightbulb className="h-4 w-4 inline mr-2" />
            HINT (-30s)
          </NeoButton>
          <NeoButton variant="secondary" size="md" onClick={reset}>
            <RotateCcw className="h-4 w-4 inline mr-2" />
            RESET
          </NeoButton>
        </div>
      </motion.div>

      {/* Move History & Instructions */}
      <div
        style={{
          padding: '20px',
          background: colors.white,
          border: `6px solid ${colors.border}`,
          boxShadow: shadows.brutal,
          transform: 'rotate(1deg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: 'clamp(18px, 3vw, 24px)',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              color: colors.dark,
            }}
          >
            MOVE HISTORY
          </h3>
          <NeoBadge color={colors.accent} size="sm">
            {history.length}/{solution.length}
          </NeoBadge>
        </div>

        {/* Move Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', marginBottom: '16px' }}>
          {history.map((san, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300 }}
              style={{
                padding: '8px',
                background: colors.success,
                border: `3px solid ${colors.border}`,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                fontSize: '12px',
                textAlign: 'center',
                color: colors.dark,
              }}
            >
              {i + 1}. {san}
            </motion.div>
          ))}
          {index < solution.length && (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{
                padding: '8px',
                background: colors.primary,
                border: `3px solid ${colors.border}`,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                fontSize: '12px',
                textAlign: 'center',
                color: colors.dark,
              }}
            >
              NEXT: {solution[index]}
            </motion.div>
          )}
        </div>

        {/* Instructions */}
        <div
          style={{
            marginTop: 'auto',
            padding: '16px',
            background: colors.accent,
            border: `4px solid ${colors.border}`,
            boxShadow: shadows.brutalSmall,
          }}
        >
          <h4
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: '14px',
              textTransform: 'uppercase',
              marginBottom: '8px',
              color: colors.dark,
            }}
          >
            INSTRUCTIONS
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {[
              'Reproduce the solution exactly',
              'Opponent replies automatically',
              'Use Hint for 30s penalty',
              'Wrong moves shake the board',
            ].map((text, i) => (
              <li
                key={i}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 700,
                  fontSize: '12px',
                  marginBottom: '6px',
                  paddingLeft: '16px',
                  position: 'relative',
                  color: colors.dark,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    fontWeight: 900,
                  }}
                >
                  →
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {solved && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            />

            {/* Confetti */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 40 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    left: `${(i * 7) % 100}%`,
                    top: '-10px',
                    width: '12px',
                    height: '12px',
                    background: i % 4 === 0 ? colors.primary : i % 4 === 1 ? colors.secondary : i % 4 === 2 ? colors.accent : colors.success,
                    border: `2px solid ${colors.border}`,
                  }}
                  initial={{ y: -20, rotate: 0, opacity: 0 }}
                  animate={{ y: ['0vh', '110vh'], rotate: [0, 360], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2 + (i % 10) * 0.2, delay: (i % 10) * 0.05 }}
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0.8, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{
                position: 'relative',
                maxWidth: '500px',
                width: '90%',
                padding: '32px',
                background: colors.success,
                border: `8px solid ${colors.border}`,
                boxShadow: shadows.brutalLarge,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '24px',
                }}
              >
                <PartyPopper className="h-12 w-12" style={{ color: colors.dark }} />
                <h2
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 900,
                    fontSize: 'clamp(32px, 5vw, 48px)',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.02em',
                    color: colors.dark,
                    textShadow: `4px 4px 0px ${colors.border}`,
                  }}
                >
                  SOLVED!
                </h2>
              </div>

              <div
                style={{
                  padding: '20px',
                  background: colors.dark,
                  border: `4px solid ${colors.border}`,
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 700,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    color: colors.white,
                    marginBottom: '8px',
                  }}
                >
                  Your Time
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 900,
                    fontSize: 'clamp(36px, 6vw, 48px)',
                    color: colors.primary,
                    textShadow: `0 0 10px ${colors.primary}`,
                  }}
                >
                  {timeDisplay}
                </div>
                {penalties > 0 && (
                  <div
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 700,
                      fontSize: '12px',
                      color: colors.white,
                      opacity: 0.7,
                    }}
                  >
                    (includes {penalties}s penalties)
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <NeoButton variant="primary" size="lg" onClick={() => setSolved(false)}>
                  CLOSE
                </NeoButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
