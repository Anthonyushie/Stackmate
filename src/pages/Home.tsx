import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import WalletConnect from '../components/WalletConnect';
import useWallet from '../hooks/useWallet';
import { useActivePuzzles } from '../hooks/useBlockchain';
import { getPuzzleInfo, getLeaderboard, type LeaderboardEntry, type PuzzleInfo } from '../lib/contracts';
import { getApiBaseUrl, microToStx, type NetworkName, getNetwork } from '../lib/stacks';
import { fetchCallReadOnlyFunction, uintCV, standardPrincipalCV, ClarityType } from '@stacks/transactions';
import PuzzleCard from '../components/PuzzleCard';
import EnterPuzzleModal from '../components/EnterPuzzleModal';
import { Trophy, Zap, Clock, Users, Coins, Crown, Target, Sparkles } from 'lucide-react';

const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';

function getContractIds(network: NetworkName) {
  const id = (network === 'testnet' ? (import.meta as any).env?.VITE_CONTRACT_TESTNET : (import.meta as any).env?.VITE_CONTRACT_MAINNET) as string | undefined;
  if (!id || typeof id !== 'string' || !id.includes('.')) throw new Error('Missing contract id env var');
  const [address, name] = id.split('.');
  return { address, name };
}

function useStacksHeight(network: NetworkName) {
  return useQuery<number>({
    queryKey: ['stacks-height', network],
    queryFn: async () => {
      const res = await fetch(`${getApiBaseUrl(network)}/v2/info`);
      const j: any = await res.json();
      const h = Number(j?.stacks_tip_height ?? j?.stacks_tip?.height ?? j?.burn_block_height ?? 0);
      return Number.isFinite(h) ? h : 0;
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: false,
    staleTime: 8000,
  });
}

function formatTimeSeconds(total: number | bigint) {
  const n = typeof total === 'bigint' ? Number(total) : total;
  const m = Math.floor(n / 60);
  const s = n % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
}

function blocksToEta(blocksLeft: number) {
  const sec = Math.max(0, Math.floor(blocksLeft * 600));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [h ? `${h}h` : null, m ? `${m}m` : null, (!h && !m) ? `${s}s` : null].filter(Boolean);
  return parts.join(' ');
}

function Piece({ glyph, x, y, delay = 0 }: { glyph: string; x: string; y: string; delay?: number }) {
  return (
    <motion.span
      className="absolute select-none pointer-events-none text-black/40 dark:text-white/20"
      style={{ left: x, top: y }}
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: [0, -6, 0, 6, 0], opacity: 1 }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <span className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl">{glyph}</span>
    </motion.span>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`${brutal} bg-white/80 dark:bg-zinc-900/60 backdrop-blur p-5`}>{children}</div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className={`${brutal} ${accent} p-4 text-black dark:text-zinc-900`}> 
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">{icon}<span>{label}</span></div>
      <div className="text-2xl font-black mt-1">{value}</div>
    </div>
  );
}

export default function Home() {
  const { network, getAddress } = useWallet();
  const address = getAddress() || '';
  const [enterOpen, setEnterOpen] = useState(false);
  const [enterData, setEnterData] = useState<{
    puzzleId: number;
    difficulty: 'beginner' | 'intermediate' | 'expert';
    entryFeeMicro: bigint | number | string;
    prizePoolMicro: bigint | number | string;
    alreadyEntered?: boolean;
  } | null>(null);

  const { data: activeIds = [], isLoading: activeLoading } = useActivePuzzles();
  const heightQ = useStacksHeight(network);

  const infoQueries = useQueries({
    queries: (activeIds || []).map((id) => ({
      queryKey: ['puzzle-info', network, String(id)],
      queryFn: () => getPuzzleInfo({ puzzleId: id, network }),
      enabled: activeIds.length > 0,
      refetchInterval: 15000,
      refetchOnWindowFocus: false,
    })),
  });

  const infos = useMemo(() => infoQueries.map((q) => q.data).filter(Boolean) as PuzzleInfo[], [infoQueries]);

  const pairs = useMemo(() => {
    return (activeIds || []).map((id, i) => ({ id, info: infoQueries[i]?.data as PuzzleInfo | undefined }))
      .filter((p) => p.info) as Array<{ id: number; info: PuzzleInfo }>;
  }, [activeIds, infoQueries]);

  const byDifficulty = useMemo(() => {
    const pick = (d: string) => pairs.find((p) => (p.info.difficulty || '').toLowerCase() === d) || null;
    return {
      beginner: pick('beginner'),
      intermediate: pick('intermediate'),
      expert: pick('expert'),
    } as Record<'beginner'|'intermediate'|'expert', { id: number; info: PuzzleInfo } | null>;
  }, [pairs]);

  const displayList = useMemo(() => {
    const order: Array<{ key: 'beginner'|'intermediate'|'expert'; label: string; fallbackFee: string; color: string }>= [
      { key: 'beginner', label: 'Beginner', fallbackFee: '0.5', color: 'bg-yellow-300' },
      { key: 'intermediate', label: 'Intermediate', fallbackFee: '2', color: 'bg-blue-300' },
      { key: 'expert', label: 'Expert', fallbackFee: '5', color: 'bg-pink-300' },
    ];
    return order.map((o) => {
      const pair = (byDifficulty as any)[o.key] as { id: number; info: PuzzleInfo } | null;
      return {
        key: o.key,
        label: o.label,
        id: pair?.id,
        info: pair?.info ?? null,
        fallbackFee: o.fallbackFee,
        color: o.color,
      };
    });
  }, [byDifficulty]);

  const leaderboardsQueries = useQueries({
    queries: displayList.map((d) => ({
      queryKey: ['leaderboard', network, d.label, String(d.id ?? '0')],
      queryFn: () => (d.id ? getLeaderboard({ puzzleId: d.id, network }) : Promise.resolve([] as LeaderboardEntry[])),
      enabled: Boolean(d.id),
      refetchInterval: 20000,
      refetchOnWindowFocus: false,
    })),
  });

  const entryQueries = useQueries({
    queries: displayList.map((d) => ({
      queryKey: ['entry', network, address, String(d.id ?? '')],
      enabled: Boolean(address && d.id),
      refetchInterval: 15000,
      refetchOnWindowFocus: false,
      queryFn: async () => {
        if (!address || !d.id) return null;
        const { address: contractAddress, name: contractName } = getContractIds(network);
        const stxNetwork = getNetwork(network);
        const cv: any = await fetchCallReadOnlyFunction({
          contractAddress,
          contractName,
          functionName: 'get-entry',
          functionArgs: [uintCV(d.id), standardPrincipalCV(address)],
          senderAddress: address,
          network: stxNetwork,
        });
        if (cv?.type !== ClarityType.ResponseOk) return null;
        const opt = cv.value;
        if (opt?.type === ClarityType.OptionalSome) {
          const t = opt.value;
          const st = BigInt(t.data['solve-time']?.value ?? 0);
          const ts = BigInt(t.data['timestamp']?.value ?? 0);
          const ic = t.data['is-correct'];
          const isCorrect = ic?.type === ClarityType.BoolTrue;
          return { solveTime: st, timestamp: ts, isCorrect } as { solveTime: bigint; timestamp: bigint; isCorrect: boolean };
        }
        return null;
      },
    })),
  });

  const leaders = leaderboardsQueries.map((q) => (q.data || []) as LeaderboardEntry[]);

  const stats = useMemo(() => {
    const totalActivePrize = infos.reduce((acc, p) => acc + Number(p.prizePool), 0);
    const totalPlayers = infos.reduce((acc, p) => acc + Number(p.entryCount), 0);
    const correct = leaders.flat().filter((x) => x.isCorrect).length;
    return {
      totalSolved: correct,
      totalPrizeStx: microToStx(BigInt(totalActivePrize)),
      activePlayers: totalPlayers,
    };
  }, [infos, leaders]);

  const bgGrad = 'from-yellow-200 via-rose-200 to-blue-200 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900';

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgGrad} text-black dark:text-white relative overflow-hidden`}> 
      <div className="absolute inset-0 pointer-events-none">
        <Piece glyph="♔" x="5%" y="10%" />
        <Piece glyph="♕" x="80%" y="15%" delay={1} />
        <Piece glyph="♖" x="15%" y="70%" delay={2} />
        <Piece glyph="♘" x="65%" y="65%" delay={3} />
        <Piece glyph="♟" x="40%" y="30%" delay={1.5} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-20">
        <header className="flex items-center justify-between mb-8 sm:mb-12">
          <div className={`${brutal} bg-white/80 dark:bg-zinc-900/60 backdrop-blur px-4 py-2 text-xl font-black tracking-tight`}>Stackmate</div>
          <WalletConnect />
        </header>

        <section className="mb-14 sm:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className={`${brutal} bg-white/80 dark:bg-zinc-900/60 backdrop-blur p-6 sm:p-10 relative overflow-hidden`}
          >
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05]">
                  Solve Chess Puzzles, Win STX
                </h1>
                <p className="mt-4 text-base sm:text-lg opacity-80">
                  Fastest solver takes the entire prize pool
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a href="#difficulties" className={`px-5 py-3 bg-yellow-300 hover:bg-yellow-400 ${brutal} inline-flex items-center gap-2`}>
                    <Zap className="h-4 w-4" /> Play Now
                  </a>
                  <a href="#how" className={`px-5 py-3 bg-blue-300 hover:bg-blue-400 ${brutal} inline-flex items-center gap-2`}>
                    <Target className="h-4 w-4" /> How it works
                  </a>
                </div>
              </div>
              <div className="relative min-h-[240px] lg:min-h-[320px]">
                <motion.div
                  initial={{ rotate: -2, scale: 0.95 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 180, damping: 16 }}
                  className={`${brutal} bg-gradient-to-br from-white/80 to-yellow-100/70 dark:from-zinc-800/80 dark:to-zinc-700/70 backdrop-blur p-6`}
                >
                  <div className="grid grid-cols-3 gap-2 text-4xl sm:text-5xl lg:text-6xl">
                    <div className="text-center">♜</div>
                    <div className="text-center">♞</div>
                    <div className="text-center">♝</div>
                    <div className="text-center">♛</div>
                    <div className="text-center">♚</div>
                    <div className="text-center">♟</div>
                  </div>
                </motion.div>
                <motion.div
                  className="absolute -inset-3 -z-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8 }}
                  style={{ background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0, rgba(0,0,0,0.06) 10px, transparent 10px, transparent 20px)' }}
                />
              </div>
            </div>
          </motion.div>
        </section>

        <section id="difficulties" className="mb-16 sm:mb-20">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-2xl sm:text-3xl font-black">Choose Your Challenge</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {displayList.map((d, idx) => {
              const info = d.info as PuzzleInfo | null;
              const id = d.id as number | undefined;
              const lb = leaders[idx] || [];
              const best = lb
                .filter((x) => x.player?.toLowerCase() === address.toLowerCase())
                .map((x) => x.solveTime)
                .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[0] || null;
              const height = heightQ.data || 0;
              const deadBlock = info ? Number(info.deadline) : 0;
              const blocksLeft = Math.max(0, deadBlock - height);
              const approxDeadline = Date.now() + blocksLeft * 600_000;
              const entered = Boolean(entryQueries[idx]?.data);
              const winner = info?.winner && address && info.winner.toLowerCase() === address.toLowerCase();
              return (
                <PuzzleCard
                  key={d.label}
                  difficulty={d.key}
                  entryFee={info ? microToStx(info.stakeAmount) : d.fallbackFee}
                  prizePool={info ? microToStx(info.prizePool) : '0'}
                  playerCount={info ? Number(info.entryCount) : 0}
                  userBestTime={best as any}
                  deadline={approxDeadline}
                  entered={entered}
                  winner={Boolean(winner)}
                  onEnter={async () => {
                    if (!id || !info) return;
                    setEnterData({
                      puzzleId: id,
                      difficulty: d.key,
                      entryFeeMicro: info.stakeAmount,
                      prizePoolMicro: info.prizePool,
                      alreadyEntered: entered,
                    });
                    setEnterOpen(true);
                  }}
                />
              );
            })}
          </div>
        </section>

        <section id="how" className="mb-16 sm:mb-20">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5" />
            <h2 className="text-2xl sm:text-3xl font-black">How It Works</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5" />
                <div className="text-lg font-black">Enter</div>
              </div>
              <p className="text-sm mt-2 opacity-80">Stake the entry fee to join a live puzzle. Every entry increases the prize pool.</p>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5" />
                <div className="text-lg font-black">Solve</div>
              </div>
              <p className="text-sm mt-2 opacity-80">Recreate the exact move sequence faster than everyone else. Hints add time penalties.</p>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5" />
                <div className="text-lg font-black">Win</div>
              </div>
              <p className="text-sm mt-2 opacity-80">After the deadline, the fastest correct solver takes it all. Funds settle on-chain.</p>
            </Card>
          </div>
        </section>

        <section className="mb-20">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5" />
            <h2 className="text-2xl sm:text-3xl font-black">Stats</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Stat icon={<Clock className="h-4 w-4" />} label="Total Puzzles Solved" value={String(stats.totalSolved)} accent="bg-yellow-300" />
            <Stat icon={<Coins className="h-4 w-4" />} label="Total STX in Pools" value={`${stats.totalPrizeStx} STX`} accent="bg-blue-300" />
            <Stat icon={<Users className="h-4 w-4" />} label="Active Players" value={String(stats.activePlayers)} accent="bg-pink-300" />
          </div>
        </section>

        <section className="mb-8">
          <div className={`${brutal} bg-white/80 dark:bg-zinc-900/60 backdrop-blur p-3 overflow-hidden`}>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4" />
              <div className="text-xs font-black uppercase tracking-wider">Recent Winners</div>
            </div>
            <div className="relative h-8">
              <motion.div
                className="absolute whitespace-nowrap"
                initial={{ x: 0 }}
                animate={{ x: ['0%', '-100%'] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                {(leaders.flat().slice(0, 12)).map((w, i) => (
                  <span key={i} className="inline-flex items-center gap-2 mr-8 text-sm">
                    <Crown className="h-4 w-4" />
                    <span className="font-black">{w.player?.slice(0, 6)}…{w.player?.slice(-4)}</span>
                    <span className="opacity-70">{formatTimeSeconds(w.solveTime)}s</span>
                  </span>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {enterData && (
          <EnterPuzzleModal
            open={enterOpen}
            onClose={() => { setEnterOpen(false); setEnterData(null); }}
            puzzleId={enterData.puzzleId}
            difficulty={enterData.difficulty}
            entryFeeMicro={enterData.entryFeeMicro}
            prizePoolMicro={enterData.prizePoolMicro}
            alreadyEntered={enterData.alreadyEntered}
          />
        )}

        <footer className="pb-8 text-xs opacity-70">Built for Stacks • Neo‑Brutalist UI • Framer Motion</footer>
      </div>
    </div>
  );
}
