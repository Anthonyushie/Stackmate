import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import useWallet from '../hooks/useWallet';
import { getLeaderboard, type LeaderboardEntry } from '../lib/contracts';
import { truncateMiddle } from '../lib/stacks';

export interface LiveLeaderboardProps {
  puzzleId: number | bigint;
  className?: string;
  limit?: number;
  refreshIntervalMs?: number;
}

const brutal = 'rounded-none border-[3px] border-black shadow-[6px_6px_0_#000]';

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function formatTime(total: number | bigint) {
  const v = typeof total === 'bigint' ? Number(total) : total;
  const m = Math.floor(v / 60);
  const s = v % 60;
  return `${pad(m)}:${pad(s)}`;
}

function medal(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

export default function LiveLeaderboard({ puzzleId, className = '', limit = 10, refreshIntervalMs = 10000 }: LiveLeaderboardProps) {
  const { network, getAddress } = useWallet();
  const address = (getAddress() || '').toLowerCase();

  const q = useQuery<LeaderboardEntry[]>({
    queryKey: ['live-leaderboard', network, String(puzzleId)],
    queryFn: async () => {
      const list = await getLeaderboard({ puzzleId, network });
      return list.filter(x => x.isCorrect).sort((a, b) => (a.solveTime < b.solveTime ? -1 : a.solveTime > b.solveTime ? 1 : 0));
    },
    refetchInterval: refreshIntervalMs,
    refetchOnWindowFocus: false,
  });

  const full = q.data || [];
  const userIndex = useMemo(() => full.findIndex(e => (e.player || '').toLowerCase() === address), [full, address]);
  const top = useMemo(() => full.slice(0, limit), [full, limit]);
  const showUserExtra = userIndex >= limit && userIndex >= 0;
  const userEntry = showUserExtra ? full[userIndex] : null;

  const listRef = useRef<HTMLDivElement>(null);
  const userRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to user's position when present
    if (userRowRef.current && listRef.current) {
      userRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [userIndex, full.length]);

  const loading = q.isLoading && !q.data;

  return (
    <div className={`${brutal} bg-white/80 dark:bg-zinc-900/60 backdrop-blur p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-black uppercase tracking-wider">Live Leaderboard</div>
        <div className="text-[10px] opacity-60">Updates every {Math.floor(refreshIntervalMs/1000)}s</div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`${brutal} bg-gradient-to-r from-white to-zinc-100 dark:from-zinc-800 dark:to-zinc-700 h-8 animate-pulse`} />
          ))}
        </div>
      )}

      {!loading && (
        <div ref={listRef} className="grid gap-2 max-h-[340px] overflow-auto pr-1">
          <AnimatePresence initial={false}>
            {top.map((row, i) => {
              const rank = i + 1;
              const isYou = (row.player || '').toLowerCase() === address;
              return (
                <motion.div
                  key={(row.player || '') + String(row.solveTime) + String(i)}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                  ref={isYou ? userRowRef : undefined}
                  className={`${brutal} ${isYou ? 'bg-yellow-200' : 'bg-white'} p-2 flex items-center justify-between`}
                >
                  <div className="w-10 text-left font-black">{medal(rank)}</div>
                  <div className="flex-1 font-mono truncate px-2">{truncateMiddle(row.player || '')}{isYou && <span className="ml-2 text-[10px] bg-black text-white px-1 py-[1px] ${brutal}">YOU</span>}</div>
                  <div className="w-16 text-right font-black">{formatTime(row.solveTime)}</div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* If the user's rank is outside the top limit, show their row pinned */}
          {showUserExtra && userEntry && (
            <motion.div
              key={(userEntry.player || '') + String(userEntry.solveTime) + '-you'}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 26 }}
              ref={userRowRef}
              className={`${brutal} bg-yellow-200 p-2 flex items-center justify-between`}
            >
              <div className="w-10 text-left font-black">{medal(userIndex + 1)}</div>
              <div className="flex-1 font-mono truncate px-2">{truncateMiddle(userEntry.player || '')}<span className="ml-2 text-[10px] bg-black text-white px-1 py-[1px] ${brutal}">YOU</span></div>
              <div className="w-16 text-right font-black">{formatTime(userEntry.solveTime)}</div>
            </motion.div>
          )}

          {/* Empty/low entries state */}
          {full.length > 0 && full.length < 3 && (
            <div className={`${brutal} bg-white p-2 text-xs text-center`}>Waiting for more solvers…</div>
          )}

          {full.length === 0 && (
            <div className={`${brutal} bg-white p-2 text-xs text-center`}>No entries yet</div>
          )}
        </div>
      )}
    </div>
  );
}
