import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import WalletConnect from '../components/WalletConnect';
import NotificationBell from '../components/NotificationBell';
import { Link as RouterLink } from 'react-router-dom';
import useWallet from '../hooks/useWallet';
import ChessPuzzleSolver from '../components/ChessPuzzleSolver';
import { getPuzzlesByDifficulty, type Puzzle } from '../lib/puzzles-db';
import { useQuery } from '@tanstack/react-query';
import { getPuzzleInfo, type PuzzleInfo } from '../lib/contracts';

const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';

export default function PuzzlePage() {
  const params = useParams();
  const puzzleIdParam = params.id || '1';
  const numericId = Number(puzzleIdParam);
  const { network } = useWallet();

  const { data: info, isLoading, error } = useQuery<PuzzleInfo>({
    queryKey: ['puzzle-info', network, puzzleIdParam],
    queryFn: () => getPuzzleInfo({ puzzleId: numericId, network }),
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });

  const chosen = useMemo(() => {
    if (!info) return null as Puzzle | null;
    const d = (info.difficulty || '').toLowerCase();
    const list = getPuzzlesByDifficulty((d as any) || 'beginner');
    if (!list.length) return null;
    const idx = Math.abs((numericId || 1) - 1) % list.length;
    return list[idx];
  }, [info, numericId]);

  const bgGrad = 'from-yellow-200 via-rose-200 to-blue-200 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900';

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgGrad} text-black dark:text-white relative overflow-hidden`}>
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <header className="flex items-center justify-between mb-6">
          <Link to="/" className={`${brutal} bg-white/80 dark:bg-zinc-900/60 backdrop-blur px-4 py-2 text-xl font-black tracking-tight`}>Stackmate</Link>
          <div className="flex items-center gap-2">
            <RouterLink to="/leaderboard" className={`${brutal} bg-white/80 hover:bg-white px-3 py-2 text-sm`}>Leaderboard</RouterLink>
            <NotificationBell />
            <WalletConnect />
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 20 }}
          className={`${brutal} bg-white/80 dark:bg-zinc-900/60 backdrop-blur p-4 sm:p-6 mb-6`}
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-wider opacity-70">Puzzle</div>
              <div className="text-xl font-black">#{puzzleIdParam}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className={`${brutal} bg-yellow-200 p-2 text-black`}>
                <div className="uppercase font-black">Difficulty</div>
                <div className="font-black text-sm">{info?.difficulty ?? '—'}</div>
              </div>
              <div className={`${brutal} bg-blue-200 p-2 text-black`}>
                <div className="uppercase font-black">Prize Pool</div>
                <div className="font-black text-sm">{info ? String(info.prizePool) : '—'} µSTX</div>
              </div>
              <div className={`${brutal} bg-green-200 p-2 text-black`}>
                <div className="uppercase font-black">Players</div>
                <div className="font-black text-sm">{info ? String(info.entryCount) : '—'}</div>
              </div>
              <div className={`${brutal} bg-pink-200 p-2 text-black`}>
                <div className="uppercase font-black">Deadline</div>
                <div className="font-black text-sm">{info ? String(info.deadline) : '—'}</div>
              </div>
            </div>
          </div>
        </motion.div>

        <div>
          {isLoading && (
            <div className="my-4">
              {/* Skeleton for solver area */}
              <div className={`${brutal} bg-white/80 dark:bg-zinc-900/60 backdrop-blur p-4`}>
                <div className="skeleton h-72 w-full" />
              </div>
            </div>
          )}
          {error && (
            <div className={`${brutal} bg-red-200 p-6 text-black`}>Failed to load puzzle info</div>
          )}
          {chosen && (
            <ChessPuzzleSolver puzzleId={String(puzzleIdParam)} fen={chosen.fen} solution={chosen.solution} />
          )}
          {!isLoading && !chosen && !error && (
            <div className={`${brutal} bg-white/80 dark:bg-zinc-900/60 backdrop-blur p-6 text-center`}>No puzzle found</div>
          )}
        </div>
      </div>
    </div>
  );
}
