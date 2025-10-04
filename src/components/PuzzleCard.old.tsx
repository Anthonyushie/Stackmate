import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Users, Clock, Coins, Play, CheckCircle2, Crown } from 'lucide-react';

export type Difficulty = 'beginner' | 'intermediate' | 'expert';

export interface PuzzleCardProps {
  difficulty: Difficulty;
  entryFee: string | number | bigint;
  prizePool: string | number | bigint;
  playerCount: number;
  userBestTime?: number | bigint | null;
  deadline: number | Date;
  onEnter: () => Promise<void> | void;
  entered?: boolean;
  winner?: boolean;
  className?: string;
}

const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';

function fmtStx(v: string | number | bigint): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'bigint') return v.toString();
  return Number.isFinite(v) ? String(v) : String(v);
}

function fmtTime(total: number | bigint | null | undefined) {
  if (total === null || total === undefined) return '—';
  const n = typeof total === 'bigint' ? Number(total) : total;
  const m = Math.floor(n / 60);
  const s = n % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
}

function deadlineToMs(deadline: number | Date): number {
  if (deadline instanceof Date) return deadline.getTime();
  // heuristics: treat numbers larger than 1e12 as ms, otherwise seconds
  return deadline > 1e12 ? deadline : deadline * 1000;
}

function useCountdown(deadline: number | Date) {
  const target = deadlineToMs(deadline);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const label = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  return { secondsLeft: diff, label };
}

const schemes: Record<Difficulty, { badge: string; accented: string; light: string; dark: string } > = {
  beginner: { badge: 'bg-emerald-300', accented: 'bg-emerald-200', light: 'from-emerald-200 to-emerald-100', dark: 'from-emerald-800/60 to-emerald-700/40' },
  intermediate: { badge: 'bg-cyan-300', accented: 'bg-cyan-200', light: 'from-cyan-200 to-cyan-100', dark: 'from-cyan-800/60 to-cyan-700/40' },
  expert: { badge: 'bg-violet-300', accented: 'bg-violet-200', light: 'from-violet-200 to-violet-100', dark: 'from-violet-800/60 to-violet-700/40' },
};

export default function PuzzleCard({
  difficulty,
  entryFee,
  prizePool,
  playerCount,
  userBestTime,
  deadline,
  onEnter,
  entered = false,
  winner = false,
  className = '',
}: PuzzleCardProps) {
  const scheme = schemes[difficulty];
  const { label: countdown, secondsLeft } = useCountdown(deadline);
  const ended = secondsLeft <= 0;

  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);
  const prevPrize = useRef<string>('');
  const pp = fmtStx(prizePool);

  useEffect(() => {
    if (prevPrize.current && prevPrize.current !== pp) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 800);
      return () => clearTimeout(t);
    }
    prevPrize.current = pp;
  }, [pp]);

  const canEnter = !loading && !entered && !ended;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4, rotate: -0.2 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={`${brutal} bg-white/80 dark:bg-zinc-900/60 backdrop-blur p-5 relative overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 -z-10 opacity-60">
        <div className={`absolute -inset-6 bg-gradient-to-br ${scheme.light} dark:${scheme.dark}`} />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 ${brutal} ${scheme.badge} text-black text-xs font-black uppercase tracking-wider`}>{difficulty}</div>
          <div className={`px-2 py-1 ${brutal} ${scheme.accented} text-black text-[10px] font-black uppercase tracking-wider`}>Entry {fmtStx(entryFee)} STX</div>
        </div>
        <div className="flex gap-2">
          {winner && (
            <div className={`px-2 py-1 ${brutal} bg-yellow-300 text-black text-[10px] font-black uppercase tracking-wider flex items-center gap-1`}>
              <Crown className="h-3 w-3" /> Winner
            </div>
          )}
          {entered && (
            <div className={`px-2 py-1 ${brutal} bg-black text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1`}>
              <CheckCircle2 className="h-3 w-3" /> Entered
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <motion.div animate={pulse ? { scale: [1, 1.05, 1] } : {}} transition={{ duration: 0.6 }} className={`${brutal} bg-white/90 dark:bg-zinc-800/60 p-3`}>
          <div className="flex items-center gap-2 text-[10px] uppercase font-black"><Coins className="h-3 w-3" /> Prize Pool</div>
          <div className="text-xl font-black">{pp} STX</div>
        </motion.div>
        <div className={`${brutal} bg-white/90 dark:bg-zinc-800/60 p-3`}>
          <div className="flex items-center gap-2 text-[10px] uppercase font-black"><Users className="h-3 w-3" /> Players</div>
          <div className="text-xl font-black">{playerCount}</div>
        </div>
        <div className={`${brutal} bg-white/90 dark:bg-zinc-800/60 p-3`}>
          <div className="flex items-center gap-2 text-[10px] uppercase font-black"><Clock className="h-3 w-3" /> Your Best</div>
          <div className="text-xl font-black">{fmtTime(userBestTime)}</div>
        </div>
        <div className={`${brutal} bg-white/90 dark:bg-zinc-800/60 p-3`}>
          <div className="flex items-center gap-2 text-[10px] uppercase font-black"><Clock className="h-3 w-3" /> Deadline</div>
          <div className={`text-base font-black ${ended ? 'text-red-600' : ''}`}>{ended ? 'Ended' : countdown}</div>
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={async () => {
            if (!canEnter) return;
            try {
              setLoading(true);
              await Promise.resolve(onEnter());
            } finally {
              setLoading(false);
            }
          }}
          disabled={!canEnter}
          className={`${brutal} inline-flex items-center justify-center gap-2 px-4 py-3 ${canEnter ? 'bg-black text-white hover:bg-zinc-800' : 'bg-zinc-400 text-white cursor-not-allowed'} w-full`}
        >
          <Play className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-black tracking-tight">{loading ? 'Entering…' : entered ? 'Already Entered' : ended ? 'Closed' : 'Enter Puzzle'}</span>
        </button>
      </div>
    </motion.div>
  );
}
