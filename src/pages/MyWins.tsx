import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, Trophy, X, PartyPopper, Flame } from 'lucide-react';
import useWallet from '../hooks/useWallet';
import { fetchCallReadOnlyFunction, standardPrincipalCV, ClarityType } from '@stacks/transactions';
import { getApiBaseUrl, microToStx, type NetworkName } from '../lib/stacks';
import { getPuzzleInfo, type PuzzleInfo } from '../lib/contracts';
import ClaimPrizeModal from '../components/ClaimPrizeModal';
import ShareButton from '../components/ShareButton';
import { useUserStats } from '../hooks/useBlockchain';
import Header from '../components/Header';
import { colors, shadows, getDifficultyColor } from '../styles/neo-brutal-theme';
import NeoButton from '../components/neo/NeoButton';
import NeoBadge from '../components/neo/NeoBadge';

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
  const [_error, setError] = useState<string | null>(null);
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
    <div style={{ minHeight: '100vh', background: colors.light, position: 'relative', overflow: 'hidden' }}>
      <div className="grain-texture" style={{ position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none' }} />
      
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '1400px', margin: '0 auto', padding: '32px 20px' }}>
        <Header />

        {/* Page Title */}
        <motion.div
          initial={{ rotate: -1, y: -10, opacity: 0 }}
          animate={{ rotate: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
          style={{
            display: 'inline-block',
            padding: '16px 32px',
            background: colors.success,
            border: `6px solid ${colors.border}`,
            boxShadow: shadows.brutal,
            marginBottom: '24px',
          }}
        >
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: 'clamp(32px, 5vw, 48px)',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              color: colors.dark,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <Trophy className="h-10 w-10" />
            MY WINS
          </h1>
        </motion.div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <motion.div
            initial={{ rotate: -1, y: 20, opacity: 0 }}
            animate={{ rotate: -1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
            style={{
              padding: '20px',
              background: colors.primary,
              border: `6px solid ${colors.border}`,
              boxShadow: shadows.brutal,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Trophy className="h-5 w-5" />
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '12px', textTransform: 'uppercase' }}>
                TOTAL WINNINGS
              </span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 'clamp(28px, 4vw, 36px)', color: colors.dark }}>
              {totalWinnings} STX
            </div>
          </motion.div>

          <motion.div
            initial={{ rotate: 1, y: 20, opacity: 0 }}
            animate={{ rotate: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
            style={{
              padding: '20px',
              background: colors.accent,
              border: `6px solid ${colors.border}`,
              boxShadow: shadows.brutal,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Flame className="h-5 w-5" />
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '12px', textTransform: 'uppercase' }}>
                TOTAL WINS
              </span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 'clamp(28px, 4vw, 36px)', color: colors.dark }}>
              {wins.length}
            </div>
          </motion.div>

          <motion.div
            initial={{ rotate: -1, y: 20, opacity: 0 }}
            animate={{ rotate: 0, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, delay: 0.3 }}
            style={{
              padding: '20px',
              background: colors.white,
              border: `6px solid ${colors.border}`,
              boxShadow: shadows.brutal,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Clock className="h-5 w-5" />
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '12px', textTransform: 'uppercase' }}>
                CLAIMABLE
              </span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 'clamp(28px, 4vw, 36px)', color: colors.dark }}>
              {wins.filter(w => !w.claimed).length}
            </div>
          </motion.div>
        </div>

        {/* Filter Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <NeoButton
            variant={filter === 'claimable' ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setFilter('claimable')}
          >
            CLAIMABLE ({wins.filter(w => !w.claimed).length})
          </NeoButton>
          <NeoButton
            variant={filter === 'claimed' ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setFilter('claimed')}
          >
            CLAIMED ({wins.filter(w => w.claimed).length})
          </NeoButton>
          <NeoButton
            variant={filter === 'all' ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setFilter('all')}
          >
            ALL ({wins.length})
          </NeoButton>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ display: 'grid', gap: '16px' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: [0.4, 0.7, 0.4], y: 0 }}
                transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1 }}
                style={{
                  height: '200px',
                  background: colors.white,
                  border: `6px solid ${colors.border}`,
                  boxShadow: shadows.brutal,
                }}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
            style={{
              padding: '60px 40px',
              background: colors.white,
              border: `6px solid ${colors.border}`,
              boxShadow: shadows.brutal,
              textAlign: 'center',
            }}
          >
            <Trophy className="h-16 w-16 mx-auto mb-4" style={{ color: colors.dark, opacity: 0.3 }} />
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 900,
                fontSize: '28px',
                textTransform: 'uppercase',
                marginBottom: '12px',
                color: colors.dark,
              }}
            >
              {filter === 'claimable' ? 'NO CLAIMABLE WINS' : filter === 'claimed' ? 'NO CLAIMED WINS' : 'NO WINS YET'}
            </h2>
            <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '14px', opacity: 0.7, marginBottom: '24px' }}>
              Solve more puzzles to win prizes!
            </p>
            <NeoButton variant="primary" size="lg" onClick={() => window.location.href = '/'}>
              <Flame className="h-5 w-5 inline mr-2" />
              START SOLVING
            </NeoButton>
          </motion.div>
        )}

        {/* Wins Grid */}
        <div style={{ display: 'grid', gap: '16px' }}>
          {filtered.map((w, index) => {
            const dateStr = w.winTimestampSec ? new Date(w.winTimestampSec * 1000).toLocaleString() : `After block ${String(w.info.deadline)}`;
            const prizeStr = microToStx(w.netPrize);
            const canClaimNow = !w.claimed && (heightQ.data ?? 0) > Number(w.info.deadline);
            const difficultyColor = getDifficultyColor(w.info.difficulty?.toLowerCase() as any);
            const rotation = index % 3 === 0 ? -1 : index % 3 === 1 ? 1 : 0;

            return (
              <motion.div
                key={w.id}
                initial={{ rotate: rotation, y: 20, opacity: 0 }}
                animate={{ rotate: rotation, y: 0, opacity: 1 }}
                whileHover={{ rotate: 0, y: -4, boxShadow: shadows.brutalLarge }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                style={{
                  padding: '24px',
                  background: w.claimed ? colors.white : colors.primary,
                  border: `${w.claimed ? '4px' : '6px'} solid ${colors.border}`,
                  boxShadow: w.claimed ? shadows.brutalSmall : shadows.brutal,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <NeoBadge color={difficultyColor} size="lg">
                      #{w.id}
                    </NeoBadge>
                    <div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', opacity: 0.7 }}>
                        {w.info.difficulty?.toUpperCase()}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '14px' }}>
                        {dateStr}
                      </div>
                    </div>
                  </div>
                  
                  {w.claimed ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 className="h-6 w-6" style={{ color: colors.success }} />
                      <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', color: colors.success }}>
                        CLAIMED
                      </span>
                    </div>
                  ) : (
                    <NeoBadge color={colors.error} size="md" pulse>
                      UNCLAIMED
                    </NeoBadge>
                  )}
                </div>

                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  <div
                    style={{
                      padding: '12px',
                      background: colors.success,
                      border: `4px solid ${colors.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <Trophy className="h-4 w-4" />
                      <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '10px', textTransform: 'uppercase' }}>
                        PRIZE
                      </span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '18px', color: colors.dark }}>
                      {prizeStr} STX
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '12px',
                      background: colors.accent,
                      border: `4px solid ${colors.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <Clock className="h-4 w-4" />
                      <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '10px', textTransform: 'uppercase' }}>
                        TIME
                      </span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '18px', color: colors.dark }}>
                      {w.solveTimeSec !== undefined ? formatTimeSeconds(w.solveTimeSec) : '—'}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                {!w.claimed && (
                  <NeoButton
                    variant={canClaimNow ? 'primary' : 'secondary'}
                    size="lg"
                    onClick={() => { setSelected(w); setClaimOpen(true); }}
                    disabled={!canClaimNow}
                    style={{ width: '100%' }}
                  >
                    <Trophy className="h-5 w-5 inline mr-2" />
                    {canClaimNow ? 'CLAIM PRIZE NOW' : 'NOT YET CLAIMABLE'}
                  </NeoButton>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Celebration Modal */}
      <AnimatePresence>
        {celebrate && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
              onClick={() => setCelebrate(false)}
            />

            {/* Confetti */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 70 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    left: `${(i * 7) % 100}%`,
                    top: '-10px',
                    width: '16px',
                    height: '16px',
                    background: i % 3 === 0 ? colors.primary : i % 3 === 1 ? colors.error : colors.success,
                    border: `3px solid ${colors.border}`,
                  }}
                  initial={{ y: -20, rotate: 0, opacity: 0 }}
                  animate={{ y: ['0vh', '110vh'], rotate: [0, 720], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2.5 + (i % 10) * 0.2, delay: (i % 10) * 0.05 }}
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
                padding: '40px',
                background: colors.success,
                border: `8px solid ${colors.border}`,
                boxShadow: shadows.brutalLarge,
              }}
            >
              <button
                onClick={() => setCelebrate(false)}
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <PartyPopper className="h-12 w-12" style={{ color: colors.dark }} />
                <h2
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 900,
                    fontSize: 'clamp(32px, 5vw, 40px)',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.02em',
                    color: colors.dark,
                    textShadow: `4px 4px 0px ${colors.border}`,
                  }}
                >
                  CLAIMED!
                </h2>
              </div>

              <div
                style={{
                  padding: '20px',
                  background: colors.dark,
                  border: `4px solid ${colors.border}`,
                  marginBottom: '24px',
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
                  Prize Amount
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 900,
                    fontSize: 'clamp(28px, 5vw, 36px)',
                    color: colors.primary,
                    textShadow: `0 0 10px ${colors.primary}`,
                  }}
                >
                  {lastClaimAmountStx} STX
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <ShareButton
                  type="win"
                  data={{ amountStx: lastClaimAmountStx || undefined }}
                  url={typeof window !== 'undefined' ? window.location.origin : undefined}
                />
                <NeoButton variant="primary" size="lg" onClick={() => setCelebrate(false)}>
                  AWESOME!
                </NeoButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Claim Prize Modal */}
      <ClaimPrizeModal
        isOpen={claimOpen}
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
        }}
      />
    </div>
  );
}
