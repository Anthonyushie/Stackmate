import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Chess, type Move, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Trophy, Users, Lightbulb, RotateCcw, FlagTriangleRight, X, PartyPopper, Flame } from 'lucide-react';
import useWallet from '../hooks/useWallet';
import { getPuzzlesByDifficulty, type Puzzle, hashSolution } from '../lib/puzzles-db';
import { getPuzzleInfo, getLeaderboard, type LeaderboardEntry } from '../lib/contracts';
import { microToStx, type NetworkName, getNetwork } from '../lib/stacks';
import { fetchCallReadOnlyFunction, uintCV, standardPrincipalCV, ClarityType } from '@stacks/transactions';
import { useSubmitSolution } from '../hooks/useContract';
import ShareButton from '../components/ShareButton';
import ChessBoardSkeleton from '../components/skeletons/ChessBoardSkeleton';
import LiveLeaderboard from '../components/LiveLeaderboard';
import { colors, shadows, getDifficultyColor } from '../styles/neo-brutal-theme';
import NeoButton from '../components/neo/NeoButton';
import NeoBadge from '../components/neo/NeoBadge';
import NeoCard from '../components/neo/NeoCard';
import Header from '../components/Header';

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

const unicode: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

export default function SolvePuzzle() {
  const { difficulty = 'beginner', puzzleId = '' } = useParams();
  const navigate = useNavigate();
  const { network, getAddress } = useWallet();
  const address = getAddress() || '';

  const numericId = Number(puzzleId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<any | null>(null);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [entered, setEntered] = useState<boolean>(false);
  const submit = useSubmitSolution();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const submittedRef = useRef(false);

  const [elapsed, setElapsed] = useState(0);
  const [penalties, setPenalties] = useState(0);

  const [game, setGame] = useState<Chess | null>(null);
  const [boardFen, setBoardFen] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(null);
  const [wrongShakeKey, setWrongShakeKey] = useState(0);
  const [solved, setSolved] = useState(false);
  const [boardSize, setBoardSize] = useState(720);
  const boardWrapRef = useRef<HTMLDivElement>(null);

  const localPuzzle: Puzzle | null = useMemo(() => {
    const list = getPuzzlesByDifficulty(difficulty as any);
    console.log('[SolvePuzzle] Getting puzzle for difficulty:', difficulty, 'puzzleId:', numericId);
    console.log('[SolvePuzzle] Available puzzles:', list?.length || 0);
    if (!list || !list.length) {
      console.warn('[SolvePuzzle] No puzzles found for difficulty:', difficulty);
      return null;
    }
    if (!Number.isFinite(numericId) || numericId <= 0) {
      console.log('[SolvePuzzle] Invalid puzzleId, using first puzzle');
      return list[0];
    }
    const idx = (Math.abs(numericId - 1)) % list.length;
    console.log('[SolvePuzzle] Selected puzzle index:', idx, 'puzzle:', list[idx]?.id, 'FEN:', list[idx]?.fen);
    return list[idx];
  }, [difficulty, numericId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        if (!Number.isFinite(numericId) || numericId <= 0) throw new Error('Invalid puzzle id');
        const inf = await getPuzzleInfo({ puzzleId: numericId, network });
        if (!alive) return;
        setInfo(inf);
        if ((inf?.difficulty || '').toLowerCase() !== (difficulty || '').toLowerCase()) {
          console.warn('Route difficulty does not match on-chain difficulty. Proceeding with on-chain difficulty.');
        }
        if (!address) {
          setEntered(false);
        } else {
          const { address: contractAddress, name: contractName } = getContractIds(network);
          const stxNetwork = getNetwork(network);
          const cv: any = await fetchCallReadOnlyFunction({
            contractAddress,
            contractName,
            functionName: 'get-entry',
            functionArgs: [uintCV(numericId), standardPrincipalCV(address)],
            senderAddress: address,
            network: stxNetwork,
          });
          if (cv?.type === ClarityType.ResponseOk) {
            const opt = cv.value;
            setEntered(opt?.type === ClarityType.OptionalSome);
          } else {
            setEntered(false);
          }
        }
        const lb = await getLeaderboard({ puzzleId: numericId, network });
        if (!alive) return;
        setLeaders(lb);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load puzzle');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [numericId, network, address, difficulty]);

  useEffect(() => {
    let timer: any;
    let alive = true;
    const tick = async () => {
      try {
        const lb = await getLeaderboard({ puzzleId: numericId, network });
        if (!alive) return;
        setLeaders(lb);
      } catch {}
      timer = setTimeout(tick, 10000);
    };
    if (Number.isFinite(numericId) && numericId > 0) tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [numericId, network]);

  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setBoardSize(Math.max(300, Math.min(1000, w)));
    });
    ro.observe(el);
    setBoardSize(Math.max(300, Math.min(1000, el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!localPuzzle) {
      console.log('[SolvePuzzle] No localPuzzle available');
      return;
    }
    console.log('[SolvePuzzle] Loading puzzle:', { id: localPuzzle.id, fen: localPuzzle.fen, solution: localPuzzle.solution });
    try {
      const g = new Chess(localPuzzle.fen);
      setGame(g);
      setBoardFen(localPuzzle.fen);
      setIndex(0);
      setHistory([]);
      setLastMove(null);
      setHintMove(null);
      setSolved(false);
      setElapsed(0);
      setPenalties(0);
      console.log('[SolvePuzzle] Puzzle loaded successfully, boardFen set to:', localPuzzle.fen);
    } catch (e) {
      console.error('[SolvePuzzle] Error loading puzzle:', e);
    }
  }, [localPuzzle?.id, localPuzzle?.fen]);

  useEffect(() => {
    if (!localPuzzle) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [localPuzzle?.id]);

  useEffect(() => {
    if (loading) return;
    if (!entered) {
      navigate('/', { replace: true });
    }
  }, [loading, entered]);

  const nextExpectedSan = useMemo(() => localPuzzle?.solution[index] ?? null, [localPuzzle?.solution, index]);

  const maybeAutoPlayOpponent = useCallback(() => {
    if (!game || !localPuzzle) return;
    if (index >= localPuzzle.solution.length) return;
    if (index % 2 === 1) {
      const g = new Chess(game.fen());
      const san = localPuzzle.solution[index];
      try {
        const mv = g.move(san);
        if (mv) {
          setGame(g);
          setBoardFen(g.fen());
          setHistory((h) => [...h, san]);
          setLastMove({ from: mv.from as Square, to: mv.to as Square });
          setIndex((i) => i + 1);
        }
      } catch {}
    }
  }, [game, localPuzzle, index]);

  useEffect(() => {
    if (!localPuzzle) return;
    if (index === localPuzzle.solution.length && !solved) {
      setSolved(true);
    } else {
      maybeAutoPlayOpponent();
    }
  }, [index, localPuzzle?.solution?.length]);

  const onDrop = useCallback((sourceSquare: Square, targetSquare: Square) => {
    if (solved || !game || !localPuzzle) return false;
    const g = new Chess(game.fen());
    const legal = g.moves({ verbose: true }) as Move[];
    const candidates = legal.filter((m) => m.from === sourceSquare && m.to === targetSquare);
    if (candidates.length === 0) {
      setWrongShakeKey((k) => k + 1);
      return false;
    }
    const mv = candidates.find((m) => (m.promotion ? m.promotion === 'q' : true)) || candidates[0];
    const expected = localPuzzle.solution[index];
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
  }, [game, index, localPuzzle, solved]);

  const useHint = useCallback(() => {
    if (solved || !nextExpectedSan || !game) return;
    const g = new Chess(game.fen());
    try {
      const verboseMoves = g.moves({ verbose: true }) as Move[];
      for (const m of verboseMoves) {
        const tmp = new Chess(g.fen());
        const made = tmp.move({ from: m.from, to: m.to, promotion: m.promotion });
        if (made?.san === nextExpectedSan) {
          setHintMove({ from: m.from as Square, to: m.to as Square });
          setPenalties((p) => p + 30);
          break;
        }
      }
    } catch {}
  }, [game, nextExpectedSan, solved]);

  const totalTime = useMemo(() => elapsed + penalties, [elapsed, penalties]);

  useEffect(() => {
    if (!solved || !entered || !localPuzzle) return;
    if (submittedRef.current) return;
    submittedRef.current = true;
    (async () => {
      try {
        setSubmitting(true);
        setSubmitError(null);
        const hash = await hashSolution(history);
        const res: any = await submit.mutateAsync({ puzzleId: numericId, solution: hash, solveTime: totalTime, onStatus: (_s, d) => { if (d?.txId) setTxId(d.txId); } });
        if (!res?.ok) {
          setSubmitError(res?.error || 'Submit failed');
        } else {
          setSubmitError(null);
          try { const lb = await getLeaderboard({ puzzleId: numericId, network }); setLeaders(lb); } catch {}
        }
      } catch (e: any) {
        setSubmitError(e?.message || 'Submit failed');
      } finally {
        setSubmitting(false);
      }
    })();
  }, [solved]);

  const yourRank = useMemo(() => {
    if (!leaders || !leaders.length) return 1;
    const t = BigInt(totalTime);
    const better = leaders.filter((l) => l.isCorrect && l.solveTime < t).length;
    return better + 1;
  }, [leaders, totalTime]);

  const boardStyle = useMemo(() => ({ borderRadius: 0, boxShadow: `inset 0 0 0 6px ${colors.border}` }), []);
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
    const map: Record<string, (props: { squareWidth: number }) => React.ReactElement> = {};
    (['wK','wQ','wR','wB','wN','wP','bK','bQ','bR','bB','bN','bP'] as const).forEach((k) => {
      map[k] = ({ squareWidth }) => (
        <div
          style={{
            width: squareWidth,
            height: squareWidth,
            fontSize: squareWidth * 0.65,
            textShadow: `3px 3px 0 ${colors.border}`,
            color: k.startsWith('w') ? '#fff' : '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {unicode[k]}
        </div>
      );
    });
    return map;
  }, []);

  if (loading) {
    return <ChessBoardSkeleton />;
  }
  if (error || !localPuzzle || !info) {
    return (
      <div style={{ minHeight: '100vh', background: colors.light, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <NeoCard color={colors.error} rotate={-2}>
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '32px', marginBottom: '16px', textTransform: 'uppercase' }}>
              PUZZLE NOT AVAILABLE
            </h2>
            <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '14px', marginBottom: '24px', opacity: 0.7 }}>
              {error || 'This puzzle could not be loaded.'}
            </p>
            <NeoButton variant="primary" size="lg" onClick={() => navigate('/')}>
              GO HOME
            </NeoButton>
          </div>
        </NeoCard>
      </div>
    );
  }

  const difficultyColor = getDifficultyColor(difficulty as any);

  return (
    <div style={{ minHeight: '100vh', background: colors.light, position: 'relative', overflow: 'hidden' }}>
      {/* Floating background shapes */}
      <div className="grain-texture" style={{ position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none' }} />
      
      <motion.div
        key={wrongShakeKey}
        initial={{ x: 0 }}
        animate={{ x: wrongShakeKey > 0 ? [0, -10, 10, -5, 5, 0] : 0 }}
        transition={{ duration: 0.4 }}
        style={{ position: 'relative', zIndex: 10, maxWidth: '1600px', margin: '0 auto', padding: '32px 20px' }}
      >
        <Header />

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            {/* Board Section */}
            <div ref={boardWrapRef}>
              <motion.div
                initial={{ rotate: -1, y: 20, opacity: 0 }}
                animate={{ rotate: -1, y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                style={{
                  padding: '20px',
                  background: difficultyColor,
                  border: `6px solid ${colors.border}`,
                  boxShadow: shadows.brutal,
                }}
              >
                {/* Puzzle Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <NeoBadge color={colors.dark} size="lg">
                    #{numericId} • {(info?.difficulty || '').toUpperCase()}
                  </NeoBadge>
                  <div
                    style={{
                      padding: '12px 20px',
                      background: colors.dark,
                      border: `5px solid ${colors.border}`,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 900,
                      fontSize: 'clamp(20px, 4vw, 28px)',
                      color: colors.primary,
                      textShadow: `0 0 8px ${colors.primary}`,
                    }}
                  >
                    {formatTime(totalTime)}
                    {penalties > 0 && (
                      <span style={{ fontSize: '14px', opacity: 0.7 }}> (+{penalties}s)</span>
                    )}
                  </div>
                </div>

                {/* Chess Board */}
                {!boardFen || !localPuzzle ? (
                  <div style={{ 
                    aspectRatio: '1', 
                    background: colors.accent, 
                    border: `6px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 900,
                    fontSize: '24px'
                  }}>
                    LOADING BOARD...
                  </div>
                ) : (
                  <Chessboard
                    {...({
                      position: boardFen,
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
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
                  <NeoButton variant="accent" size="md" onClick={useHint} disabled={solved}>
                    <Lightbulb className="h-4 w-4 inline mr-2" />
                    HINT (-30s)
                  </NeoButton>
                  <NeoButton variant="secondary" size="md" onClick={() => {
                    if (!localPuzzle) return;
                    const g = new Chess(localPuzzle.fen);
                    setGame(g);
                    setBoardFen(localPuzzle.fen);
                    setIndex(0);
                    setHistory([]);
                    setLastMove(null);
                    setHintMove(null);
                    setSolved(false);
                    setElapsed(0);
                    setPenalties(0);
                  }}>
                    <RotateCcw className="h-4 w-4 inline mr-2" />
                    RESET
                  </NeoButton>
                  <NeoButton variant="danger" size="md" onClick={() => {
                    if (confirm('Give up and exit? You can re-enter later.')) navigate('/');
                  }}>
                    <FlagTriangleRight className="h-4 w-4 inline mr-2" />
                    GIVE UP
                  </NeoButton>
                </div>
              </motion.div>
            </div>

            {/* Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Puzzle Info */}
              <motion.div
                initial={{ rotate: 1, y: 20, opacity: 0 }}
                animate={{ rotate: 1, y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                style={{
                  padding: '20px',
                  background: colors.white,
                  border: `6px solid ${colors.border}`,
                  boxShadow: shadows.brutal,
                }}
              >
                <h3
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 900,
                    fontSize: 'clamp(20px, 4vw, 28px)',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.02em',
                    marginBottom: '16px',
                    color: colors.dark,
                  }}
                >
                  {localPuzzle.description || 'SOLVE THE PUZZLE'}
                </h3>

                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div
                    style={{
                      padding: '12px',
                      background: colors.success,
                      border: `4px solid ${colors.border}`,
                      boxShadow: shadows.brutalSmall,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Trophy className="h-4 w-4" />
                      <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '10px', textTransform: 'uppercase' }}>
                        PRIZE POOL
                      </span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 'clamp(18px, 3vw, 24px)', color: colors.dark }}>
                      {microToStx(info.prizePool)} STX
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '12px',
                      background: colors.accent,
                      border: `4px solid ${colors.border}`,
                      boxShadow: shadows.brutalSmall,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Users className="h-4 w-4" />
                      <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '10px', textTransform: 'uppercase' }}>
                        PLAYERS
                      </span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 'clamp(18px, 3vw, 24px)', color: colors.dark }}>
                      {String(info.entryCount)}
                    </div>
                  </div>
                </div>

                {/* Move Progress */}
                <div
                  style={{
                    padding: '12px',
                    background: colors.primary,
                    border: `4px solid ${colors.border}`,
                    boxShadow: shadows.brutalSmall,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '12px', textTransform: 'uppercase' }}>
                      PROGRESS
                    </span>
                    <NeoBadge color={colors.dark} size="sm">
                      {history.length}/{localPuzzle.solution.length}
                    </NeoBadge>
                  </div>
                  {index < localPuzzle.solution.length && (
                    <motion.div
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      style={{
                        padding: '8px 12px',
                        background: colors.dark,
                        border: `3px solid ${colors.border}`,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: '14px',
                        color: colors.primary,
                        textAlign: 'center',
                      }}
                    >
                      NEXT MOVE: {localPuzzle.solution[index]}
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* Live Leaderboard */}
              <motion.div
                initial={{ rotate: -1, y: 20, opacity: 0 }}
                animate={{ rotate: 0, y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
              >
                <LiveLeaderboard puzzleId={numericId} limit={8} />
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Celebration Modal */}
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
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
              onClick={() => setSolved(false)}
            />

            {/* Confetti */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 60 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    left: `${(i * 7) % 100}%`,
                    top: '-10px',
                    width: '16px',
                    height: '16px',
                    background: i % 4 === 0 ? colors.primary : i % 4 === 1 ? colors.secondary : i % 4 === 2 ? colors.accent : colors.success,
                    border: `3px solid ${colors.border}`,
                  }}
                  initial={{ y: -20, rotate: 0, opacity: 0 }}
                  animate={{ y: ['0vh', '110vh'], rotate: [0, 720], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2.5 + (i % 10) * 0.2, delay: (i % 10) * 0.05 }}
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0.7, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{
                position: 'relative',
                maxWidth: '600px',
                width: '90%',
                padding: '40px',
                background: colors.success,
                border: `8px solid ${colors.border}`,
                boxShadow: `0 0 0 4px ${colors.success}, ${shadows.brutalLarge}`,
              }}
            >
              <button
                onClick={() => setSolved(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  padding: '8px',
                  background: colors.dark,
                  border: `4px solid ${colors.border}`,
                  cursor: 'pointer',
                }}
              >
                <X className="h-6 w-6" style={{ color: colors.white }} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                <PartyPopper className="h-16 w-16" style={{ color: colors.dark }} />
                <h2
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 900,
                    fontSize: 'clamp(36px, 6vw, 56px)',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.02em',
                    color: colors.dark,
                    textShadow: `6px 6px 0px ${colors.border}`,
                  }}
                >
                  SOLVED!
                </h2>
              </div>

              {/* Results Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div
                  style={{
                    padding: '20px',
                    background: colors.dark,
                    border: `5px solid ${colors.border}`,
                  }}
                >
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', color: colors.white, marginBottom: '8px' }}>
                    YOUR TIME
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 'clamp(28px, 5vw, 36px)', color: colors.primary, textShadow: `0 0 10px ${colors.primary}` }}>
                    {formatTime(totalTime)}
                  </div>
                  {penalties > 0 && (
                    <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '10px', color: colors.white, opacity: 0.7, marginTop: '4px' }}>
                      (+{penalties}s penalties)
                    </div>
                  )}
                </div>

                <div
                  style={{
                    padding: '20px',
                    background: colors.primary,
                    border: `5px solid ${colors.border}`,
                  }}
                >
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', color: colors.dark, marginBottom: '8px' }}>
                    YOUR RANK
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 'clamp(28px, 5vw, 36px)', color: colors.dark }}>
                    #{yourRank}
                  </div>
                </div>
              </div>

              {/* Submission Status */}
              <div
                style={{
                  padding: '16px',
                  background: submitting ? colors.accent : submitError ? colors.error : colors.white,
                  border: `4px solid ${colors.border}`,
                  marginBottom: '24px',
                }}
              >
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px' }}>
                  SUBMISSION
                </div>
                {submitting && (
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '14px' }}>
                    Submitting your result to blockchain…
                  </div>
                )}
                {!submitting && submitError && (
                  <div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '14px', marginBottom: '8px', color: colors.white }}>
                      {submitError}
                    </div>
                    <NeoButton variant="primary" size="sm" onClick={() => {
                      submittedRef.current = false;
                      setTxId(null);
                      setSubmitError(null);
                      setSolved(true);
                    }}>
                      RETRY
                    </NeoButton>
                  </div>
                )}
                {!submitting && !submitError && txId && (
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '11px', wordBreak: 'break-all' }}>
                    TX: {txId}
                  </div>
                )}
                {!submitting && !submitError && !txId && (
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '14px', opacity: 0.7 }}>
                    Submitted successfully!
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <ShareButton type="solve" data={{ durationText: formatTime(totalTime) }} url={typeof window !== 'undefined' ? `${window.location.origin}/puzzle/${numericId}` : undefined} />
                <NeoButton variant="primary" size="lg" onClick={() => {
                  setSolved(false);
                  navigate('/');
                }}>
                  <Flame className="h-5 w-5 inline mr-2" />
                  SOLVE ANOTHER
                </NeoButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getContractIds(network: NetworkName) {
  const DEFAULT_TESTNET = 'ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469.puzzle-pool';
  let id = network === 'testnet' ? (import.meta as any).env?.VITE_CONTRACT_TESTNET : (import.meta as any).env?.VITE_CONTRACT_MAINNET;
  if (!id || typeof id !== 'string' || !id.includes('.')) {
    if (network === 'testnet') id = DEFAULT_TESTNET;
  }
  if (!id || typeof id !== 'string' || !id.includes('.')) throw new Error('Missing contract id env var');
  const [address, name] = id.split('.');
  return { address, name };
}
