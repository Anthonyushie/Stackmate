import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Trophy, Zap, Clock, Users, Coins, Crown, Target, Sparkles, Flame, Star, Network } from 'lucide-react';
import WalletConnect from '../components/WalletConnect';
import NotificationBell from '../components/NotificationBell';
import useWallet from '../hooks/useWallet';
import { useActivePuzzles } from '../hooks/useBlockchain';
import { getPuzzleInfo, getLeaderboard, type LeaderboardEntry, type PuzzleInfo } from '../lib/contracts';
import { getApiBaseUrl, microToStx, type NetworkName, getNetwork } from '../lib/stacks';
import { fetchCallReadOnlyFunction, uintCV, standardPrincipalCV, ClarityType } from '@stacks/transactions';
import PuzzleCard from '../components/PuzzleCard';
import EnterPuzzleModal from '../components/EnterPuzzleModal';
import PuzzleCardSkeleton from '../components/skeletons/PuzzleCardSkeleton';
import NeoButton from '../components/neo/NeoButton';
import NeoCard from '../components/neo/NeoCard';
import NeoBadge from '../components/neo/NeoBadge';
import { colors, shadows, animations, getRotation, normalizeDifficulty } from '../styles/neo-brutal-theme';

function getContractIds(network: NetworkName) {
  const DEFAULT_TESTNET = 'ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469.puzzle-pool';
  let id = (network === 'testnet' ? (import.meta as any).env?.VITE_CONTRACT_TESTNET : (import.meta as any).env?.VITE_CONTRACT_MAINNET) as string | undefined;
  if (!id || typeof id !== 'string' || !id.includes('.')) {
    if (network === 'testnet') id = DEFAULT_TESTNET;
  }
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

  const pairs = useMemo(() => {
    return (activeIds || []).map((id, i) => ({ id, info: infoQueries[i]?.data as PuzzleInfo | undefined }))
      .filter((p) => p.info) as Array<{ id: number; info: PuzzleInfo }>;
  }, [activeIds, infoQueries]);

  const byDifficulty = useMemo(() => {
    const pick = (d: string) => pairs.find((p) => normalizeDifficulty(p.info.difficulty || '') === d) || null;
    return {
      beginner: pick('beginner'),
      intermediate: pick('intermediate'),
      expert: pick('expert'),
    } as Record<'beginner'|'intermediate'|'expert', { id: number; info: PuzzleInfo } | null>;
  }, [pairs]);

  const displayList = useMemo(() => {
    const order: Array<{ key: 'beginner'|'intermediate'|'expert'; label: string; fallbackFee: string; color: string }>= [
      { key: 'beginner', label: 'Beginner', fallbackFee: '0.5', color: colors.beginner },
      { key: 'intermediate', label: 'Intermediate', fallbackFee: '2', color: colors.intermediate },
      { key: 'expert', label: 'Expert', fallbackFee: '5', color: colors.expert },
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
      queryKey: ['leaderboard', network, String(d.id)],
      queryFn: () => (d.id ? getLeaderboard({ puzzleId: d.id, network }) : Promise.resolve([])),
      enabled: Boolean(d.id),
      refetchInterval: 15000,
      refetchOnWindowFocus: false,
    })),
  });

  const leaders = useMemo(() => leaderboardsQueries.map((q) => (q.data || []) as LeaderboardEntry[]), [leaderboardsQueries]);

  const entryQueries = useQueries({
    queries: displayList.map((d) => ({
      queryKey: ['entry', network, String(d.id), address],
      enabled: Boolean(d.id && address),
      queryFn: async () => {
        if (!d.id || !address) return null;
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
        return cv?.type === ClarityType.ResponseOk ? cv.value : null;
      },
    })),
  });

  const allActive = useMemo(() => [...pairs].sort((a, b) => b.id - a.id), [pairs]);

  const allEntryQueries = useQueries({
    queries: allActive.map((p) => ({
      queryKey: ['entry', network, String(p.id), address, 'all'],
      enabled: Boolean(address),
      queryFn: async () => {
        if (!address) return null;
        const { address: contractAddress, name: contractName } = getContractIds(network);
        const stxNetwork = getNetwork(network);
        const cv: any = await fetchCallReadOnlyFunction({
          contractAddress,
          contractName,
          functionName: 'get-entry',
          functionArgs: [uintCV(p.id), standardPrincipalCV(address)],
          senderAddress: address,
          network: stxNetwork,
        });
        return cv?.type === ClarityType.ResponseOk ? cv.value : null;
      },
    })),
  });

  const globalStatsQ = useQuery({
    queryKey: ['global-stats', network],
    queryFn: async () => {
      const { address: contractAddress, name: contractName } = getContractIds(network);
      const stxNetwork = getNetwork(network);
      const cv: any = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-puzzle-count',
        functionArgs: [],
        senderAddress: contractAddress,
        network: stxNetwork,
      });
      const totalPuzzles = cv?.type === ClarityType.ResponseOk ? Number((cv as any).value?.value || 0) : 0;
      
      const totalStaked = pairs.reduce((sum, p) => sum + BigInt(p.info.prizePool || 0), 0n);
      const totalPlayers = pairs.reduce((sum, p) => sum + Number(p.info.entryCount || 0), 0);
      
      return { totalPuzzles, totalStaked, totalPlayers };
    },
    refetchInterval: 30000,
  });

  const stats = globalStatsQ.data || { totalPuzzles: 0, totalStaked: 0n, totalPlayers: 0 };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: colors.background }}>
      {/* Grain texture overlay */}
      <div className="grain-texture fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />
      
      {/* Floating geometric shapes in background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute',
            top: '10%',
            left: '5%',
            width: '200px',
            height: '200px',
            background: colors.accent2,
            border: `6px solid ${colors.border}`,
            opacity: 0.15,
          }}
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute',
            top: '60%',
            right: '10%',
            width: '150px',
            height: '150px',
            background: colors.accent1,
            border: `6px solid ${colors.border}`,
            opacity: 0.15,
            transform: 'rotate(45deg)',
          }}
        />
        <motion.div
          animate={{ y: [-20, 20, -20] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            bottom: '15%',
            left: '15%',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: colors.secondary,
            border: `6px solid ${colors.border}`,
            opacity: 0.15,
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-10 sm:mb-16">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ rotate: -2, x: -20, opacity: 0 }}
              animate={{ rotate: 2, x: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
              style={{
                background: colors.primary,
                border: `6px solid ${colors.border}`,
                boxShadow: shadows.brutal,
                padding: '16px 32px',
              }}
            >
              <Link to="/" className="text-brutal" style={{ fontSize: '32px', color: colors.dark, textDecoration: 'none' }}>
                STACKMATE
              </Link>
            </motion.div>
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
              style={{
                background: colors.intermediate,
                border: `4px solid ${colors.border}`,
                boxShadow: shadows.brutalSmall,
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Network className="h-4 w-4" />
              <span style={{ 
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 900, 
                fontSize: '14px', 
                textTransform: 'uppercase' 
              }}>
                TESTNET
              </span>
            </motion.div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/leaderboard">
              <NeoButton variant="secondary" size="sm">
                <Trophy className="inline h-4 w-4 mr-2" />
                Leaderboard
              </NeoButton>
            </Link>
            <NotificationBell />
            <WalletConnect />
          </div>
        </header>

        {/* Hero Section */}
        <section className="mb-16 sm:mb-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            >
              <motion.h1
                initial={{ rotate: -1 }}
                animate={{ rotate: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="text-brutal"
                style={{
                  fontSize: 'clamp(48px, 8vw, 96px)',
                  lineHeight: 0.95,
                  color: colors.dark,
                  marginBottom: '24px',
                  textShadow: `6px 6px 0px ${colors.primary}`,
                }}
              >
                SOLVE
                <br />
                CHESS
                <br />
                <span style={{ color: colors.secondary }}>WIN STX</span>
              </motion.h1>

              <motion.div
                style={{
                  background: colors.accent1,
                  border: `4px solid ${colors.border}`,
                  boxShadow: shadows.brutalSmall,
                  padding: '16px 24px',
                  marginBottom: '32px',
                  transform: 'rotate(-1deg)',
                }}
              >
                <p style={{ fontWeight: 900, fontSize: '20px', color: colors.dark }}>
                  FASTEST SOLVER TAKES THE ENTIRE PRIZE POOL
                </p>
              </motion.div>

              <div className="flex flex-wrap gap-4">
                <a href="#difficulties">
                  <NeoButton variant="primary" size="xl">
                    <Zap className="inline h-6 w-6 mr-3" />
                    PLAY NOW
                  </NeoButton>
                </a>
                <a href="#how">
                  <NeoButton variant="accent" size="lg">
                    <Target className="inline h-5 w-5 mr-2" />
                    HOW IT WORKS
                  </NeoButton>
                </a>
              </div>
            </motion.div>

            {/* Chess pieces visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: 3 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              style={{
                background: colors.primary,
                border: `8px solid ${colors.border}`,
                boxShadow: shadows.brutalLarge,
                padding: '48px',
                position: 'relative',
              }}
              className="stripes-pattern"
            >
              <div className="grid grid-cols-3 gap-6 text-7xl sm:text-8xl">
                {['♜', '♞', '♝', '♛', '♚', '♟'].map((piece, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}
                    className="text-center"
                    style={{ color: colors.dark }}
                  >
                    {piece}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Global Stats */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="grid grid-cols-3 gap-4 mt-12"
          >
            <motion.div
              whileHover={{ y: -4 }}
              style={{
                background: colors.beginner,
                border: `5px solid ${colors.border}`,
                boxShadow: shadows.brutal,
                padding: '24px',
                transform: `rotate(${getRotation(0)}deg)`,
              }}
            >
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
                TOTAL PUZZLES
              </div>
              <div className="text-brutal" style={{ fontSize: '48px', color: colors.dark }}>
                {stats.totalPuzzles}
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -4 }}
              style={{
                background: colors.intermediate,
                border: `5px solid ${colors.border}`,
                boxShadow: shadows.brutal,
                padding: '24px',
                transform: `rotate(${getRotation(1)}deg)`,
              }}
            >
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
                TOTAL PLAYERS
              </div>
              <div className="text-brutal" style={{ fontSize: '48px', color: colors.dark }}>
                {stats.totalPlayers}
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -4 }}
              style={{
                background: colors.expert,
                border: `5px solid ${colors.border}`,
                boxShadow: shadows.brutal,
                padding: '24px',
                transform: `rotate(${getRotation(2)}deg)`,
              }}
            >
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: colors.white }}>
                TOTAL STAKED
              </div>
              <div className="text-brutal" style={{ fontSize: '48px', color: colors.white }}>
                {microToStx(stats.totalStaked)}
                <span style={{ fontSize: '24px' }}> STX</span>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* Puzzle Cards Section */}
        <section id="difficulties" className="mb-16 sm:mb-24">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            style={{
              background: colors.dark,
              border: `6px solid ${colors.border}`,
              boxShadow: shadows.brutal,
              padding: '16px 32px',
              display: 'inline-block',
              marginBottom: '32px',
              transform: 'rotate(-1deg)',
            }}
          >
            <h2 className="text-brutal" style={{ fontSize: '40px', color: colors.primary }}>
              <Sparkles className="inline h-8 w-8 mr-3" />
              CHOOSE YOUR CHALLENGE
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {(activeLoading || infoQueries.some(q => q.isLoading)) && (
              <>
                <PuzzleCardSkeleton />
                <PuzzleCardSkeleton />
                <PuzzleCardSkeleton />
              </>
            )}
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
                  isActive={Boolean(info?.isActive)}
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

        {/* All Active Puzzles */}
        <section id="all-active" className="mb-16 sm:mb-24">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            style={{
              background: colors.dark,
              border: `6px solid ${colors.border}`,
              boxShadow: shadows.brutal,
              padding: '16px 32px',
              display: 'inline-block',
              marginBottom: '24px',
              transform: 'rotate(1deg)',
            }}
          >
            <h2 className="text-brutal" style={{ fontSize: '36px', color: colors.accent1 }}>
              ALL ACTIVE PUZZLES
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(activeLoading || infoQueries.some(q => q.isLoading)) && (
              <>
                <PuzzleCardSkeleton />
                <PuzzleCardSkeleton />
                <PuzzleCardSkeleton />
              </>
            )}
            {!activeLoading && allActive.length === 0 && (
              <NeoCard color={colors.white} rotate={-1} hoverable={false} style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '20px' }}>No active puzzles</div>
              </NeoCard>
            )}
            {allActive.map((p, idx) => {
              const info = p.info;
              const entered = Boolean(allEntryQueries[idx]?.data);
              const dKey = normalizeDifficulty(info.difficulty || '') as 'beginner'|'intermediate'|'expert';
              return (
                <NeoCard key={p.id} rotate={getRotation(idx)} hoverable>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
                    <div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', opacity: 0.7 }}>Puzzle</div>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '28px', letterSpacing: '-0.02em' }}>#{p.id}</div>
                    </div>
                    <NeoBadge color={colors.dark} size="md">{String(info.difficulty || '').toUpperCase()}</NeoBadge>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: colors.primary, border: `4px solid ${colors.border}`, padding: '12px' }}>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>Entry Fee</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '16px' }}>{microToStx(info.stakeAmount)} STX</div>
                    </div>
                    <div style={{ background: colors.success, border: `4px solid ${colors.border}`, padding: '12px' }}>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>Prize Pool</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '16px' }}>{microToStx(info.prizePool)} STX</div>
                    </div>
                    <div style={{ background: colors.accent, border: `4px solid ${colors.border}`, padding: '12px' }}>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>Players</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '16px' }}>{String(info.entryCount)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <Link to={`/puzzle/${p.id}`}>
                      <NeoButton variant="secondary" size="sm">View</NeoButton>
                    </Link>
                    <NeoButton
                      variant={entered ? 'secondary' : 'primary'}
                      size="sm"
                      disabled={!info.isActive || entered}
                      onClick={() => {
                        setEnterData({
                          puzzleId: p.id,
                          difficulty: dKey,
                          entryFeeMicro: info.stakeAmount,
                          prizePoolMicro: info.prizePool,
                          alreadyEntered: entered,
                        });
                        setEnterOpen(true);
                      }}
                    >
                      {entered ? 'Entered' : 'Enter'}
                    </NeoButton>
                  </div>
                </NeoCard>
              );
            })}
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how" className="mb-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            style={{
              background: colors.accent3,
              border: `6px solid ${colors.border}`,
              boxShadow: shadows.brutal,
              padding: '16px 32px',
              display: 'inline-block',
              marginBottom: '32px',
              transform: 'rotate(1deg)',
            }}
          >
            <h2 className="text-brutal" style={{ fontSize: '40px', color: colors.white }}>
              <Target className="inline h-8 w-8 mr-3" />
              HOW IT WORKS
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Zap className="h-12 w-12" />,
                title: 'ENTER',
                desc: 'Stake the entry fee to join a live puzzle. Every entry increases the prize pool.',
                color: colors.primary,
                rotate: -2,
              },
              {
                icon: <Clock className="h-12 w-12" />,
                title: 'SOLVE',
                desc: 'Race against time and other players to find the winning chess move.',
                color: colors.accent1,
                rotate: 1,
              },
              {
                icon: <Trophy className="h-12 w-12" />,
                title: 'WIN',
                desc: 'Fastest correct solution wins 95% of the prize pool in STX.',
                color: colors.beginner,
                rotate: -1,
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -8, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}
                style={{
                  background: item.color,
                  border: `6px solid ${colors.border}`,
                  boxShadow: shadows.brutal,
                  padding: '32px',
                  transform: `rotate(${item.rotate}deg)`,
                }}
              >
                <div style={{ color: colors.dark, marginBottom: '16px' }}>{item.icon}</div>
                <h3 className="text-brutal" style={{ fontSize: '28px', marginBottom: '12px', color: colors.dark }}>
                  {item.title}
                </h3>
                <p style={{ fontWeight: 700, fontSize: '16px', lineHeight: 1.5, color: colors.dark }}>
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      {/* Enter Modal */}
      <EnterPuzzleModal
        isOpen={enterOpen && Boolean(enterData)}
        onClose={() => {
          setEnterOpen(false);
          setEnterData(null);
        }}
        puzzleId={enterData?.puzzleId || 0}
        difficulty={enterData?.difficulty || 'beginner'}
        entryFeeMicro={enterData?.entryFeeMicro || 0}
        prizePoolMicro={enterData?.prizePoolMicro || 0}
        alreadyEntered={enterData?.alreadyEntered}
      />
    </div>
  );
}