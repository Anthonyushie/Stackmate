import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Chess, type Move, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Trophy, Clock, Users, Lightbulb, RotateCcw, FlagTriangleRight, X } from 'lucide-react';
import useWallet from '../hooks/useWallet';
import { getPuzzlesByDifficulty, type Puzzle, hashSolution } from '../lib/puzzles-db';
import { getPuzzleInfo, getLeaderboard, type LeaderboardEntry } from '../lib/contracts';
import { getApiBaseUrl, microToStx, type NetworkName, getNetwork } from '../lib/stacks';
import { fetchCallReadOnlyFunction, uintCV, standardPrincipalCV, ClarityType } from '@stacks/transactions';
import { useSubmitSolution } from '../hooks/useContract';
import ShareButton from '../components/ShareButton';
import { formatSolveTime } from '../lib/time-utils';

const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

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

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const [penalties, setPenalties] = useState(0);

  // Chess state
  const [game, setGame] = useState<Chess | null>(null);
  const [boardFen, setBoardFen] = useState('');
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(null);
  const [wrongShakeKey, setWrongShakeKey] = useState(0);
  const [solved, setSolved] = useState(false);
  const [boardSize, setBoardSize] = useState(720);
  const boardWrapRef = useRef<HTMLDivElement>(null);

  // Derived puzzle from local DB by difficulty and numericId index
  const localPuzzle: Puzzle | null = useMemo(() => {
    const list = getPuzzlesByDifficulty(difficulty as any);
    if (!list || !list.length) return null;
    if (!Number.isFinite(numericId) || numericId <= 0) return list[0];
    const idx = (Math.abs(numericId - 1)) % list.length;
    return list[idx];
  }, [difficulty, numericId]);

  // Fetch on-chain puzzle info and ensure user entered
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
        // Check difficulty consistency
        if ((inf?.difficulty || '').toLowerCase() !== (difficulty || '').toLowerCase()) {
          console.warn('Route difficulty does not match on-chain difficulty. Proceeding with on-chain difficulty.');
        }
        // Check entry
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
        // Leaderboard initial
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

  // Refresh leaderboard every 10s
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

  // Resize observer
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

  // Initialize chess engine on puzzle
  useEffect(() => {
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
  }, [localPuzzle?.id, localPuzzle?.fen]);

  // Timer
  useEffect(() => {
    if (!localPuzzle) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [localPuzzle?.id]);

  // Redirect if not entered (after load)
  useEffect(() => {
    if (loading) return;
    if (!entered) {
      // redirect to home
      navigate('/', { replace: true });
    }
  }, [loading, entered]);

  const nextExpectedSan = useMemo(() => localPuzzle?.solution[index] ?? null, [localPuzzle?.solution, index]);

  // Autoplay opponent reply on odd index
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
        const res: any = await submit.mutateAsync({ puzzleId: numericId, solution: hash, solveTime: totalTime, onStatus: (s, d) => { if (d?.txId) setTxId(d.txId); } });
        if (!res?.ok) {
          setSubmitError(res?.error || 'Submit failed');
        } else {
          setSubmitError(null);
          // Force refresh leaderboard after a short delay
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

  // Styles
  const boardStyle = useMemo(() => ({ borderRadius: 0, boxShadow: 'inset 0 0 0 3px #000' }), []);
  const customDark = '#111827';
  const customLight = '#fde68a';
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

  // Loading & errors
  if (loading) {
    const ChessBoardSkeleton = (await import('../components/skeletons/ChessBoardSkeleton')).default;
    return <ChessBoardSkeleton />;
  }
  if (error || !localPuzzle || !info) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-200 via-rose-200 to-blue-200 flex items-center justify-center">
        <div className={`${brutal} bg-white p-6 text-center`}>
          <div className="text-xl font-black mb-2">Puzzle not available</div>
          <div className="text-sm opacity-70 mb-4">{error || 'This puzzle could not be loaded.'}</div>
          <button className={`${brutal} px-4 py-2 bg-black text-white`} onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    );
  }

  const gridCols = 'grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 lg:gap-6';

  return (
    <div className={`min-h-screen bg-gradient-to-br from-yellow-200 via-rose-200 to-blue-200 text-black relative overflow-hidden`}> 
      <motion.div
        key={wrongShakeKey}
        initial={{ x: 0 }}
        animate={{ x: [0, -6, 6, -3, 3, 0] }}
        transition={{ duration: 0.3 }}
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8"
      >
        <div className={`${gridCols}`}>
          <div ref={boardWrapRef} className={`${brutal} bg-yellow-200 p-3 flex items-center justify-center`}>
            {boardFen && (
              <Chessboard
                {...({
                  position: boardFen,
                  onPieceDrop: onDrop,
                  customBoardStyle: boardStyle,
                  customDarkSquareStyle: { backgroundColor: customDark },
                  customLightSquareStyle: { backgroundColor: customLight },
                  customSquareStyles: squareStyles,
                  boardWidth: boardSize,
                  animationDuration: 300,
                  areArrowsAllowed: false,
                } as any)}
              />
            )}
          </div>

          <div className={`${brutal} bg-white/80 backdrop-blur p-4 sm:p-6 lg:p-6 flex flex-col`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-black uppercase tracking-wider">#{numericId} • {(info?.difficulty || '').toUpperCase()}</div>
              <div className="text-xs font-black">Time: {formatTime(totalTime)} {penalties > 0 && <span className="opacity-60">(+{penalties}s)</span>}</div>
            </div>
            <div className="text-lg font-black mb-1">{localPuzzle.description}</div>
            <div className="text-xs opacity-70 mb-4">Start position: {localPuzzle.fen}</div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`${brutal} bg-green-200 p-3`}>
                <div className="flex items-center gap-2 text-[10px] uppercase font-black"><Trophy className="h-3 w-3" /> Prize Pool</div>
                <div className="text-xl font-black">{microToStx(info.prizePool)} STX</div>
              </div>
              <div className={`${brutal} bg-blue-200 p-3`}>
                <div className="flex items-center gap-2 text-[10px] uppercase font-black"><Users className="h-3 w-3" /> Players</div>
                <div className="text-xl font-black">{String(info.entryCount)}</div>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-xs font-bold uppercase mb-2">Leaderboard</div>
              <div className="grid gap-2 max-h-[320px] overflow-auto pr-1">
                {leaders.length === 0 && (
                  <div className={`${brutal} bg-white p-2 text-xs`}>No entries yet</div>
                )}
                {leaders.slice(0, 12).map((r, i) => (
                  <div key={String(r.player)+i} className={`${brutal} bg-white p-2 flex items-center justify-between text-xs`}>
                    <div className="font-black">{i + 1}.</div>
                    <div className="font-mono">{r.player?.slice(0,6)}…{r.player?.slice(-4)}</div>
                    <div className="font-black">{formatTime(Number(r.solveTime))}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto flex flex-wrap gap-2">
              <button className={`px-3 py-2 bg-blue-300 hover:bg-blue-400 ${brutal}`} onClick={useHint}><Lightbulb className="h-4 w-4 inline mr-1"/>Hint (-30s)</button>
              <button className={`px-3 py-2 bg-yellow-300 hover:bg-yellow-400 ${brutal}`} onClick={() => {
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
              }}><RotateCcw className="h-4 w-4 inline mr-1"/>Reset</button>
              <button className={`px-3 py-2 bg-red-300 hover:bg-red-400 ${brutal}`} onClick={() => {
                if (confirm('Give up and exit? You can re-enter later.')) navigate('/');
              }}><FlagTriangleRight className="h-4 w-4 inline mr-1"/>Give up and exit</button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Celebration Modal */}
      <AnimatePresence>
        {solved && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40" />
            {/* Confetti */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 60 }).map((_, i) => (
                <motion.div key={i}
                  className="absolute w-2 h-2"
                  style={{ left: `${(i * 13) % 100}%`, top: '-10px', background: i % 3 === 0 ? '#f59e0b' : i % 3 === 1 ? '#ef4444' : '#10b981', boxShadow: '2px 2px 0 #000' }}
                  initial={{ y: -20, rotate: 0, opacity: 0 }}
                  animate={{ y: ['-10%', '110%'], rotate: [0, 360], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2.2 + (i % 10) * 0.15, delay: (i % 10) * 0.05 }}
                />
              ))}
            </div>
            <motion.div className={`relative bg-white p-6 ${brutal} max-w-lg w-full mx-3`}
              initial={{ scale: 0.8, rotate: -2 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-black">Puzzle Solved!</div>
                <button onClick={() => setSolved(false)} className={`${brutal} bg-zinc-200 px-2 py-1`}><X className="h-4 w-4"/></button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className={`${brutal} bg-yellow-200 p-2`}>
                  <div className="uppercase font-black">Your Time</div>
                  <div className="text-lg font-black">{formatTime(totalTime)} {penalties > 0 && <span className="opacity-60">(+{penalties}s)</span>}</div>
                </div>
                <div className={`${brutal} bg-green-200 p-2`}>
                  <div className="uppercase font-black">Current Rank</div>
                  <div className="text-lg font-black">#{yourRank}</div>
                </div>
              </div>

              <div className="mb-3">
                <div className="text-xs font-bold uppercase mb-2">Submission</div>
                <div className={`${brutal} p-2 ${submitting ? 'bg-blue-200' : submitError ? 'bg-red-200' : 'bg-white'}`}>
                  {submitting && <div className="text-xs font-black">Submitting your result…</div>}
                  {!submitting && submitError && (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="font-black">{submitError}</div>
                      <button className={`${brutal} bg-black text-white px-2 py-1`} onClick={async () => {
                        submittedRef.current = false;
                        setTxId(null);
                        setSubmitError(null);
                        setSolved(true);
                      }}>Retry</button>
                    </div>
                  )}
                  {!submitting && !submitError && txId && (
                    <div className="text-xs">Tx submitted: <span className="font-mono break-all">{txId}</span></div>
                  )}
                  {!submitting && !submitError && !txId && (
                    <div className="text-xs opacity-70">Submitted.</div>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <div className="text-xs font-bold uppercase mb-2">Leaderboard</div>
                <div className="grid gap-2 max-h-[200px] overflow-auto pr-1">
                  {leaders.slice(0, 8).map((r, i) => (
                    <div key={String(r.player)+i} className={`${brutal} bg-white p-2 flex items-center justify-between text-xs`}>
                      <div className="font-black">{i + 1}.</div>
                      <div className="font-mono">{r.player?.slice(0,6)}…{r.player?.slice(-4)}</div>
                      <div className="font-black">{formatTime(Number(r.solveTime))}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <ShareButton type="solve" data={{ durationText: formatTime(totalTime) }} url={typeof window !== 'undefined' ? `${window.location.origin}/puzzle/${numericId}` : undefined} />
                <button className={`${brutal} bg-green-300 hover:bg-green-400 px-3 py-2`} onClick={() => {
                  setSolved(false);
                  navigate('/');
                }}>Solve Another</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getContractIds(network: NetworkName) {
  const id = network === 'testnet' ? (import.meta as any).env?.VITE_CONTRACT_TESTNET : (import.meta as any).env?.VITE_CONTRACT_MAINNET;
  if (!id || typeof id !== 'string' || !id.includes('.')) throw new Error('Missing contract id env var');
  const [address, name] = id.split('.');
  return { address, name };
}
