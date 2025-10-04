import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, CheckCircle2, Clock, Trophy, Wallet, X, PartyPopper } from 'lucide-react';
import useWallet from '../hooks/useWallet';
import { fetchCallReadOnlyFunction, uintCV, standardPrincipalCV, ClarityType } from '@stacks/transactions';
import { getApiBaseUrl, microToStx, type NetworkName } from '../lib/stacks';
import { getPuzzleInfo, type PuzzleInfo } from '../lib/contracts';
import WalletConnect from '../components/WalletConnect';
import NotificationBell from '../components/NotificationBell';
import { Link } from 'react-router-dom';
import ClaimPrizeModal from '../components/ClaimPrizeModal';
import ShareButton from '../components/ShareButton';
import { useUserStats } from '../hooks/useBlockchain';

const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';

type WinItem = {
  id: number;
  info: PuzzleInfo;
  netPrize: bigint;
  claimed: boolean;
  claimable: boolean;
  solveTimeSec?: number;
  winTimestampSec?: number;
};

function getContractIds(network: NetworkName) {
  const id = network === 'testnet' ? (import.meta as any).env?.VITE_CONTRACT_TESTNET : (import.meta as any).env?.VITE_CONTRACT_MAINNET;
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

export default function MyWins() {
  const { network, getAddress } = useWallet();
  const address = getAddress() || '';
  const [wins, setWins] = useState<WinItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'claimable' | 'claimed' | 'all'>('claimable');
  const [claimOpen, setClaimOpen] = useState(false);
  const [selected, setSelected] = useState<WinItem | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [lastClaimAmountStx, setLastClaimAmountStx] = useState<string | null>(null);

  const statsQ = useUserStats(address, !!address);
  const heightQ = useStacksHeight(network);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!address) { setWins([]); return; }
      try {
        setLoading(true);
        setError(null);
        const { address: contractAddress, name: contractName } = getContractIds(network);
        const sender = address;
        const cvEntries: any = await fetchCallReadOnlyFunction({
          contractAddress,
          contractName,
          functionName: 'get-user-entries',
          functionArgs: [standardPrincipalCV(address)],
          senderAddress: sender,
          network: (await import('../lib/stacks')).getNetwork(network),
        });
        const ok = cvEntries?.type === ClarityType.ResponseOk ? (cvEntries as any).value : null;
        const arr = ok ? ((ok as any).list as any[]) : [];
        const ids: number[] = arr.map((cv: any) => Number(cv?.value ?? 0)).filter((n: number) => Number.isFinite(n) && n > 0);
        if (!ids.length) { if (alive) setWins([]); return; }
        const infos = await Promise.all(ids.map((id) => getPuzzleInfo({ puzzleId: id, network }))); 
        const withWins = infos.map((info, idx) => ({ info, id: ids[idx] }))
          .filter((p) => (p.info?.winner || null) === address);
        const height = heightQ.data ?? 0;
        const items: WinItem[] = withWins.map(({ id, info }) => {
          const gross = BigInt(info.stakeAmount) * BigInt(info.entryCount);
          const fee = (gross * 5n) / 100n;
          const net = gross - fee;
          const claimed = BigInt(info.prizePool) === 0n;
          const claimable = !claimed && height > Number(info.deadline);
          return { id, info, netPrize: net, claimed, claimable };
        });
        const addMeta = await Promise.all(items.map(async (it) => {
          try {
            const lb = await (await import('../lib/contracts')).getLeaderboard({ puzzleId: it.id, network });
            const you = lb.find((r) => (r.player || '').toUpperCase() === address.toUpperCase());
            const st = you?.solveTime ? Number(you.solveTime) : undefined;
            const ts = you?.timestamp ? Number(you.timestamp) : undefined;
            return { ...it, solveTimeSec: st, winTimestampSec: ts } as WinItem;
          } catch {
            return it;
          }
        }));
        if (!alive) return;
        setWins(addMeta.sort((a, b) => (b.id - a.id)));
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load wins');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [address, network, heightQ.data]);

  const filtered = useMemo(() => {
    if (filter === 'all') return wins;
    if (filter === 'claimable') return wins.filter((w) => !w.claimed);
    return wins.filter((w) => w.claimed);
  }, [wins, filter]);

  const totalWinnings = useMemo(() => statsQ.data ? microToStx(statsQ.data.totalWinnings) : '0', [statsQ.data]);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-yellow-200 via-rose-200 to-blue-200 text-black relative overflow-hidden`}>
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-2xl sm:text-3xl font-black">My Wins</div>
            <div className="text-xs opacity-70">Track and claim your prizes</div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/leaderboard" className={`${brutal} bg-white/80 hover:bg-white px-3 py-2 text-sm`}>Leaderboard</Link>
            <NotificationBell />
            <WalletConnect />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`${brutal} bg-green-200 p-4`}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><Trophy className="h-4 w-4"/> Total Winnings</div>
            <div className="text-2xl font-black">{totalWinnings} STX</div>
          </div>
          <div className={`${brutal} bg-blue-200 p-4`}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><Wallet className="h-4 w-4"/> Address</div>
            <div className="text-sm font-mono break-all">{address || '—'}</div>
          </div>
          <div className={`${brutal} bg-white p-4`}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><Clock className="h-4 w-4"/> Network Height</div>
            <div className="text-xl font-black">{heightQ.data ?? 0}</div>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <button className={`${brutal} px-3 py-2 ${filter === 'claimable' ? 'bg-black text-white' : 'bg-white hover:bg-zinc-200'}`} onClick={() => setFilter('claimable')}>Claimable</button>
          <button className={`${brutal} px-3 py-2 ${filter === 'claimed' ? 'bg-black text-white' : 'bg-white hover:bg-zinc-200'}`} onClick={() => setFilter('claimed')}>Claimed</button>
          <button className={`${brutal} px-3 py-2 ${filter === 'all' ? 'bg-black text-white' : 'bg-white hover:bg-zinc-200'}`} onClick={() => setFilter('all')}>All</button>
        </div>

        {loading && (
          <div className={`${brutal} bg-white p-4`}>Loading your wins…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className={`${brutal} bg-white p-6 text-center`}>
            <div className="text-lg font-black mb-1">No wins yet</div>
            <div className="text-sm opacity-70">Solve more puzzles to win prizes!</div>
          </div>
        )}

        <div className="grid gap-3">
          {filtered.map((w) => {
            const dateStr = w.winTimestampSec ? new Date(w.winTimestampSec * 1000).toLocaleString() : `After block ${String(w.info.deadline)}`;
            const prizeStr = microToStx(w.netPrize);
            const status = w.claimed ? 'Claimed' : 'Ready to claim';
            const canClaimNow = !w.claimed && (heightQ.data ?? 0) > Number(w.info.deadline);
            return (
              <div key={w.id} className={`${brutal} bg-white/85 backdrop-blur p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3`}>
                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-wider">#{w.id} • {(w.info.difficulty || '').toUpperCase()}</div>
                    <div className={`text-xs font-black ${w.claimed ? 'text-green-700' : 'text-blue-700'}`}>{status}</div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm">
                    <div className={`${brutal} bg-yellow-200 p-2`}>
                      <div className="flex items-center gap-1 text-[10px] uppercase font-black"><Calendar className="h-3 w-3"/> Date</div>
                      <div className="font-bold truncate" title={dateStr}>{dateStr}</div>
                    </div>
                    <div className={`${brutal} bg-blue-200 p-2`}>
                      <div className="flex items-center gap-1 text-[10px] uppercase font-black"><Clock className="h-3 w-3"/> Your Time</div>
                      <div className="font-black">{w.solveTimeSec !== undefined ? formatTimeSeconds(w.solveTimeSec) : '—'}</div>
                    </div>
                    <div className={`${brutal} bg-green-200 p-2`}>
                      <div className="flex items-center gap-1 text-[10px] uppercase font-black"><Trophy className="h-3 w-3"/> Prize</div>
                      <div className="font-black">{prizeStr} STX</div>
                    </div>
                    <div className={`${brutal} ${w.claimed ? 'bg-green-200' : 'bg-blue-200'} p-2`}>
                      <div className="text-[10px] uppercase font-black">Status</div>
                      <div className="font-black">{status}</div>
                    </div>
                  </div>
                </div>
                <div className="md:self-center">
                  {!w.claimed ? (
                    <button
                      className={`${brutal} px-4 py-2 ${canClaimNow ? 'bg-black text-white hover:bg-zinc-800' : 'bg-zinc-400 text-white cursor-not-allowed'}`}
                      onClick={() => { setSelected(w); setClaimOpen(true); }}
                      disabled={!canClaimNow}
                    >
                      Claim Prize
                    </button>
                  ) : (
                    <div className={`inline-flex items-center gap-2 text-green-700 font-bold`}><CheckCircle2 className="h-4 w-4"/> Claimed</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {celebrate && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/20" />
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 70 }).map((_, i) => (
                <motion.div key={i}
                  className="absolute w-2 h-2"
                  style={{ left: `${(i * 17) % 100}%`, top: '-10px', background: i % 3 === 0 ? '#f59e0b' : i % 3 === 1 ? '#ef4444' : '#10b981', boxShadow: '2px 2px 0 #000' }}
                  initial={{ y: -20, rotate: 0, opacity: 0 }}
                  animate={{ y: ['-10%', '110%'], rotate: [0, 360], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2.4 + (i % 10) * 0.18, delay: (i % 10) * 0.06 }}
                />
              ))}
            </div>
            <motion.div className={`relative bg-white p-5 ${brutal} max-w-sm w-full mx-3`}
              initial={{ scale: 0.9, rotate: -2 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
              <div className="flex items-center gap-3 mb-3">
                <PartyPopper className="h-6 w-6"/>
                <div className="text-lg font-black">Prize claimed!</div>
                <button className={`${brutal} bg-zinc-200 px-2 py-1 ml-auto`} onClick={() => setCelebrate(false)}><X className="h-4 w-4"/></button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm opacity-70">{lastClaimAmountStx ? `${lastClaimAmountStx} STX` : ''}</div>
                <ShareButton type="win" data={{ amountStx: lastClaimAmountStx || undefined }} url={typeof window !== 'undefined' ? window.location.origin : undefined} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ClaimPrizeModal
        open={claimOpen}
        onClose={() => { setClaimOpen(false); setSelected(null); }}
        puzzleId={selected?.id ?? 0}
        difficulty={selected?.info?.difficulty || ''}
        netPrizeMicro={selected?.netPrize ?? 0}
        canClaimNow={!selected?.claimed && (heightQ.data ?? 0) > Number(selected?.info?.deadline ?? 0)}
        onSuccess={() => {
          setClaimOpen(false);
          if (selected) {
            setWins((prev) => prev.map((w) => w.id === selected.id ? { ...w, claimed: true, claimable: false } : w));
            try { setLastClaimAmountStx(microToStx(selected.netPrize)); } catch {}
          }
          setSelected(null);
          setCelebrate(true);
          setTimeout(() => setCelebrate(false), 3000);
        }}
      />
    </div>
  );
}
