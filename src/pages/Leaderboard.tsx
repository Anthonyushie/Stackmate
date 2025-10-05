import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trophy, Flame, Zap, Crown } from 'lucide-react';
import useWallet from '../hooks/useWallet';
import { getPuzzleInfo, getLeaderboard, type PuzzleInfo, type LeaderboardEntry } from '../lib/contracts';
import { fetchCallReadOnlyFunction, ClarityType } from '@stacks/transactions';
import { getNetwork, type NetworkName } from '../lib/stacks';
import { Link } from 'react-router-dom';
import LeaderboardSkeleton from '../components/skeletons/LeaderboardSkeleton';
import Header from '../components/Header';
import { colors, shadows, getDifficultyColor } from '../styles/neo-brutal-theme';
import NeoBadge from '../components/neo/NeoBadge';
import NeoInput from '../components/neo/NeoInput';

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

function hashToHsl(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const sat = 65;
  const light = 60;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function dayKey(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function concurrentMap<T, R>(arr: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(arr.length);
  let idx = 0;
  const workers: Promise<void>[] = [];
  const work = async () => {
    while (idx < arr.length) {
      const i = idx++;
      try { out[i] = await fn(arr[i], i); } catch (e: any) { out[i] = await Promise.resolve(undefined as any); }
    }
  };
  for (let k = 0; k < Math.max(1, Math.min(limit, arr.length)); k++) workers.push(work());
  await Promise.all(workers);
  return out;
}

export default function LeaderboardPage() {
  const { network, getAddress } = useWallet();
  const address = (getAddress() || '').toLowerCase();
  const [filter, setFilter] = useState('');

  const q = useQuery({
    queryKey: ['global-leaderboard', network],
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { address: contractAddress, name: contractName } = getContractIds(network);
      const stxNetwork = getNetwork(network);

      const countCv: any = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-puzzle-count',
        functionArgs: [],
        senderAddress: contractAddress,
        network: stxNetwork,
      });
      const okCount = countCv?.type === ClarityType.ResponseOk ? (countCv as any).value : null;
      const total = okCount ? (okCount as any).value as bigint : 0n;
      const max = Number(total);
      if (!Number.isFinite(max) || max <= 0) {
        return { players: [], today: { beginner: [], intermediate: [], expert: [] }, hof: {} } as any;
      }

      const ids = Array.from({ length: max }, (_, i) => i + 1);

      const infos = await concurrentMap(ids, 6, async (id) => {
        try { const info = await getPuzzleInfo({ puzzleId: id, network }); return { id, info }; } catch { return { id, info: null as any }; }
      });

      const infoMap = new Map<number, PuzzleInfo>();
      for (const p of infos) { if (p?.info) infoMap.set(p.id, p.info); }

      const lbs = await concurrentMap(ids, 5, async (id) => {
        try { const list = await getLeaderboard({ puzzleId: id, network }); return { id, list }; } catch { return { id, list: [] as LeaderboardEntry[] }; }
      });

      type WinnerRow = { puzzleId: number; address: string; difficulty: string; netPrize: bigint; timestamp: number; solveTime: number };
      const winners: WinnerRow[] = [];
      const correctEntries: Array<{ puzzleId: number; address: string; difficulty: string; timestamp: number; solveTime: number }> = [];

      for (const { id, list } of lbs) {
        const info = infoMap.get(id);
        if (!info) continue;
        const diff = (info.difficulty || '').toLowerCase();
        for (const e of list) {
          if (!e?.isCorrect) continue;
          const ts = e.timestamp ? Number(e.timestamp) : 0;
          const st = e.solveTime ? Number(e.solveTime) : 0;
          correctEntries.push({ puzzleId: id, address: (e.player || '').toLowerCase(), difficulty: diff, timestamp: ts, solveTime: st });
        }
        const winner = (info.winner || '').toLowerCase();
        if (winner) {
          const gross = BigInt(info.stakeAmount) * BigInt(info.entryCount);
          const fee = (gross * 5n) / 100n;
          const net = gross - fee;
          const you = list.find((r) => (r.player || '').toLowerCase() === winner);
          const ts = you?.timestamp ? Number(you.timestamp) : 0;
          const st = you?.solveTime ? Number(you.solveTime) : 0;
          winners.push({ puzzleId: id, address: winner, difficulty: diff, netPrize: net, timestamp: ts, solveTime: st });
        }
      }

      const uniquePlayers = Array.from(new Set(winners.map(w => w.address))).filter(Boolean);

      const stats = await concurrentMap(uniquePlayers, 6, async (addr) => {
        try {
          const { getUserStats } = await import('../lib/contracts');
          const s = await getUserStats({ address: addr, network });
          return { address: addr, totalWins: Number(s.totalWins), totalWinnings: BigInt(s.totalWinnings) };
        } catch {
          const wWins = winners.filter(w => w.address === addr);
          const totalWins = wWins.length;
          const totalWinnings = wWins.reduce((a, w) => a + w.netPrize, 0n);
          return { address: addr, totalWins, totalWinnings };
        }
      });

      const players = stats
        .map(s => ({ ...s, totalWinningsStx: (Number(s.totalWinnings) / 1_000_000).toFixed(2) }))
        .sort((a, b) => (a.totalWinnings < b.totalWinnings ? 1 : a.totalWinnings > b.totalWinnings ? -1 : (b.totalWins - a.totalWins)))
        .slice(0, 100);

      const todayKey = dayKey(Math.floor(Date.now() / 1000));
      const bestByDiff: Record<'beginner'|'intermediate'|'expert', Array<{ address: string; solveTime: number; puzzleId: number }>> = {
        beginner: [], intermediate: [], expert: []
      };
      const seen = new Set<string>();
      const byDiff = (d: string) => (d === 'intermediate' || d === 'expert') ? d : 'beginner';
      const todayEntries = correctEntries.filter(e => dayKey(e.timestamp) === todayKey);
      todayEntries.sort((a, b) => (a.solveTime - b.solveTime));
      for (const e of todayEntries) {
        const key = `${e.difficulty}:${e.address}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const diffKey = byDiff(e.difficulty) as 'beginner'|'intermediate'|'expert';
        (bestByDiff[diffKey] as any).push({ address: e.address, solveTime: e.solveTime, puzzleId: e.puzzleId });
      }
      (bestByDiff as any).beginner = bestByDiff.beginner.slice(0, 5);
      (bestByDiff as any).intermediate = bestByDiff.intermediate.slice(0, 5);
      (bestByDiff as any).expert = bestByDiff.expert.slice(0, 5);

      let biggest = winners.slice().sort((a, b) => (a.netPrize < b.netPrize ? 1 : -1))[0] || null;

      const winsByDayUser = new Map<string, number>();
      for (const w of winners) {
        const dk = dayKey(w.timestamp || 0);
        const k = `${w.address}:${dk}`;
        winsByDayUser.set(k, (winsByDayUser.get(k) || 0) + 1);
      }
      let mostWinsDay: { address: string; count: number; day: string } | null = null;
      for (const [k, v] of winsByDayUser.entries()) {
        const [addr, day] = k.split(':');
        if (!mostWinsDay || v > mostWinsDay.count) mostWinsDay = { address: addr, count: v, day };
      }

      const winsByUserDays = new Map<string, Set<string>>();
      for (const w of winners) {
        const dk = dayKey(w.timestamp || 0);
        if (!winsByUserDays.has(w.address)) winsByUserDays.set(w.address, new Set());
        winsByUserDays.get(w.address)!.add(dk);
      }
      function streakLen(days: Set<string>): number {
        const arr = Array.from(days.values()).sort();
        let best = 0; let cur = 0; let prev: Date | null = null;
        for (const ds of arr) {
          const d = new Date(ds + 'T00:00:00Z');
          if (!prev) { cur = 1; } else {
            const next = new Date(prev); next.setDate(next.getDate() + 1);
            if (d.getTime() === next.getTime()) cur += 1; else cur = 1;
          }
          if (cur > best) best = cur; prev = d;
        }
        return best;
      }
      let longestStreak: { address: string; length: number } | null = null;
      for (const [addr, days] of winsByUserDays.entries()) {
        const len = streakLen(days);
        if (!longestStreak || len > longestStreak.length) longestStreak = { address: addr, length: len };
      }

      const fastest = correctEntries.slice().sort((a, b) => (a.solveTime - b.solveTime))[0] || null;

      return {
        players,
        today: bestByDiff,
        hof: {
          biggest,
          mostWinsDay,
          longestStreak,
          fastest,
        },
        maps: { infoMap },
      };
    }
  });

  const data = q.data as any;
  const players: Array<{ address: string; totalWins: number; totalWinnings: bigint; totalWinningsStx: string }> = data?.players || [];
  const today = data?.today || { beginner: [], intermediate: [], expert: [] };
  const hof = data?.hof || {};

  const filtered = useMemo(() => {
    const f = (filter || '').trim().toLowerCase();
    if (!f) return players;
    return players.filter(p => p.address.includes(f));
  }, [players, filter]);

  if (q.isLoading && !q.data) {
    return (
      <div style={{ minHeight: '100vh', background: colors.light }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 20px' }}>
          <Header />
          <LeaderboardSkeleton rows={10} />
        </div>
      </div>
    );
  }

  function Avatar({ addr, size = 28 }: { addr: string; size?: number }) {
    const bg = hashToHsl(addr);
    const ch = (addr || 'U')[2]?.toUpperCase() || 'U';
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: bg,
          border: `3px solid ${colors.border}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          fontSize: `${size * 0.5}px`,
          color: colors.dark,
        }}
      >
        {ch}
      </div>
    );
  }

  function fmtTime(sec: number) {
    const m = Math.floor(sec / 60); const s = sec % 60; const ss = s < 10 ? `0${s}` : String(s); return `${m}:${ss}`;
  }

  function getMedalIcon(rank: number) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  }

  function getRankColor(rank: number) {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return colors.white;
  }

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
            padding: '20px 40px',
            background: colors.primary,
            border: `6px solid ${colors.border}`,
            boxShadow: shadows.brutal,
            marginBottom: '24px',
          }}
        >
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: 'clamp(36px, 6vw, 56px)',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              color: colors.dark,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <Trophy className="h-12 w-12" />
            LEADERBOARD
          </h1>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
            Updates every 60s
          </div>
        </motion.div>

        {/* All-Time Leaderboard */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
          style={{ marginBottom: '40px' }}
        >
          <div
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: colors.accent,
              border: `5px solid ${colors.border}`,
              boxShadow: shadows.brutalSmall,
              marginBottom: '16px',
            }}
          >
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '24px', textTransform: 'uppercase', margin: 0, color: colors.dark, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Crown className="h-6 w-6" />
              ALL-TIME CHAMPIONS
            </h2>
          </div>

          {/* Search */}
          <div style={{ marginBottom: '16px', maxWidth: '400px' }}>
            <NeoInput
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search address..."
              label=""
            />
          </div>

          {/* Leaderboard Cards */}
          <div style={{ display: 'grid', gap: '12px' }}>
            {filtered.slice(0, 50).map((p, i) => {
              const rank = i + 1;
              const isYou = p.address === address;
              const medal = getMedalIcon(rank);
              const bgColor = getRankColor(rank);
              const rotation = i % 3 === 0 ? -1 : i % 3 === 1 ? 1 : 0;

              return (
                <motion.div
                  key={p.address}
                  initial={{ rotate: rotation, y: 20, opacity: 0 }}
                  animate={{ rotate: rotation, y: 0, opacity: 1 }}
                  whileHover={{ rotate: 0, y: -4, boxShadow: shadows.brutalLarge }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25, delay: Math.min(i * 0.02, 0.5) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px 20px',
                    background: isYou ? colors.primary : bgColor,
                    border: `${isYou ? '6px' : '4px'} solid ${colors.border}`,
                    boxShadow: isYou ? shadows.brutal : shadows.brutalSmall,
                  }}
                >
                  {/* Rank */}
                  <div
                    style={{
                      minWidth: '56px',
                      height: '56px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: medal ? 'transparent' : colors.dark,
                      border: medal ? 'none' : `4px solid ${colors.border}`,
                      borderRadius: '50%',
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 900,
                      fontSize: medal ? '36px' : '24px',
                      color: medal ? 'transparent' : colors.primary,
                      textShadow: medal ? 'none' : `0 0 6px ${colors.primary}`,
                    }}
                  >
                    {medal || rank}
                  </div>

                  {/* Avatar */}
                  <Avatar addr={p.address} size={48} />

                  {/* Address */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      to={`/profile?address=${encodeURIComponent(p.address)}`}
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: 'clamp(13px, 2vw, 16px)',
                        color: colors.dark,
                        textDecoration: 'none',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.address.slice(0, 8)}...{p.address.slice(-6)}
                    </Link>
                    {isYou && (
                      <NeoBadge color={colors.dark} size="sm">
                        YOU
                      </NeoBadge>
                    )}
                  </div>

                  {/* Wins */}
                  <div
                    style={{
                      padding: '8px 12px',
                      background: colors.success,
                      border: `3px solid ${colors.border}`,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>
                      WINS
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '18px', color: colors.dark }}>
                      {p.totalWins}
                    </div>
                  </div>

                  {/* Winnings */}
                  <div
                    style={{
                      padding: '8px 16px',
                      background: colors.dark,
                      border: `3px solid ${colors.border}`,
                      textAlign: 'center',
                      minWidth: '120px',
                    }}
                  >
                    <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', color: colors.white, marginBottom: '2px' }}>
                      TOTAL WON
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '18px', color: colors.primary, textShadow: `0 0 6px ${colors.primary}` }}>
                      {p.totalWinningsStx} STX
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {filtered.length === 0 && (
              <div
                style={{
                  padding: '40px',
                  background: colors.white,
                  border: `4px solid ${colors.border}`,
                  boxShadow: shadows.brutalSmall,
                  textAlign: 'center',
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 700,
                  fontSize: '14px',
                  opacity: 0.7,
                }}
              >
                No results found
              </div>
            )}
          </div>
        </motion.div>

        {/* Today's Best Times */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
          style={{ marginBottom: '40px' }}
        >
          <div
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: colors.success,
              border: `5px solid ${colors.border}`,
              boxShadow: shadows.brutalSmall,
              marginBottom: '16px',
            }}
          >
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '24px', textTransform: 'uppercase', margin: 0, color: colors.dark, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap className="h-6 w-6" />
              TODAY'S BEST TIMES
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {(['beginner','intermediate','expert'] as const).map((dkey, idx) => {
              const diffColor = getDifficultyColor(dkey);
              const rotation = idx === 0 ? -1 : idx === 1 ? 1 : 0;
              return (
                <motion.div
                  key={dkey}
                  initial={{ rotate: rotation, y: 20, opacity: 0 }}
                  animate={{ rotate: rotation, y: 0, opacity: 1 }}
                  whileHover={{ rotate: 0, y: -4, boxShadow: shadows.brutalLarge }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.25 + idx * 0.05 }}
                  style={{
                    padding: '20px',
                    background: diffColor,
                    border: `6px solid ${colors.border}`,
                    boxShadow: shadows.brutal,
                  }}
                >
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '18px', textTransform: 'uppercase', marginBottom: '16px', color: colors.dark }}>
                    {dkey}
                  </div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {(today[dkey] || []).map((row: any, ridx: number) => (
                      <div
                        key={row.address+ridx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px',
                          background: colors.white,
                          border: `3px solid ${colors.border}`,
                        }}
                      >
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '16px', minWidth: '24px' }}>
                          {ridx + 1}.
                        </div>
                        <Avatar addr={row.address} size={32} />
                        <Link
                          to={`/profile?address=${encodeURIComponent(row.address)}`}
                          style={{
                            flex: 1,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            fontSize: '12px',
                            color: colors.dark,
                            textDecoration: 'none',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {row.address.slice(0,6)}...{row.address.slice(-4)}
                        </Link>
                        <div
                          style={{
                            padding: '4px 8px',
                            background: colors.dark,
                            border: `2px solid ${colors.border}`,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 900,
                            fontSize: '13px',
                            color: colors.primary,
                          }}
                        >
                          {fmtTime(row.solveTime)}
                        </div>
                      </div>
                    ))}
                    {(today[dkey] || []).length === 0 && (
                      <div
                        style={{
                          padding: '16px',
                          background: colors.white,
                          border: `3px solid ${colors.border}`,
                          textAlign: 'center',
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: 700,
                          fontSize: '12px',
                          opacity: 0.7,
                        }}
                      >
                        No solves yet today
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Hall of Fame */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, delay: 0.3 }}
        >
          <div
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: colors.secondary,
              border: `5px solid ${colors.border}`,
              boxShadow: shadows.brutalSmall,
              marginBottom: '16px',
            }}
          >
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '24px', textTransform: 'uppercase', margin: 0, color: colors.white, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame className="h-6 w-6" />
              HALL OF FAME
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Biggest Win */}
            <motion.div
              initial={{ rotate: -1, scale: 0.9 }}
              animate={{ rotate: -1, scale: 1 }}
              whileHover={{ rotate: 0, y: -4, boxShadow: shadows.brutalLarge }}
              transition={{ type: 'spring', stiffness: 300 }}
              style={{
                padding: '20px',
                background: colors.primary,
                border: `5px solid ${colors.border}`,
                boxShadow: shadows.brutal,
              }}
            >
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', marginBottom: '12px', color: colors.dark }}>
                BIGGEST SINGLE WIN
              </div>
              {hof.biggest ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Avatar addr={hof.biggest.address} size={36} />
                    <Link
                      to={`/profile?address=${encodeURIComponent(hof.biggest.address)}`}
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: '13px',
                        color: colors.dark,
                        textDecoration: 'none',
                      }}
                    >
                      {hof.biggest.address.slice(0,6)}...{hof.biggest.address.slice(-4)}
                    </Link>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '28px', color: colors.dark }}>
                    {(Number(hof.biggest.netPrize)/1_000_000).toFixed(2)} STX
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                    Puzzle #{hof.biggest.puzzleId}
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', opacity: 0.7 }}>—</div>
              )}
            </motion.div>

            {/* Most Wins in a Day */}
            <motion.div
              initial={{ rotate: 1, scale: 0.9 }}
              animate={{ rotate: 1, scale: 1 }}
              whileHover={{ rotate: 0, y: -4, boxShadow: shadows.brutalLarge }}
              transition={{ type: 'spring', stiffness: 300 }}
              style={{
                padding: '20px',
                background: colors.accent,
                border: `5px solid ${colors.border}`,
                boxShadow: shadows.brutal,
              }}
            >
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', marginBottom: '12px', color: colors.dark }}>
                MOST WINS IN A DAY
              </div>
              {hof.mostWinsDay ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Avatar addr={hof.mostWinsDay.address} size={36} />
                    <Link
                      to={`/profile?address=${encodeURIComponent(hof.mostWinsDay.address)}`}
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: '13px',
                        color: colors.dark,
                        textDecoration: 'none',
                      }}
                    >
                      {hof.mostWinsDay.address.slice(0,6)}...{hof.mostWinsDay.address.slice(-4)}
                    </Link>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '28px', color: colors.dark }}>
                    {hof.mostWinsDay.count} WINS
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                    {hof.mostWinsDay.day}
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', opacity: 0.7 }}>—</div>
              )}
            </motion.div>

            {/* Longest Streak */}
            <motion.div
              initial={{ rotate: -1, scale: 0.9 }}
              animate={{ rotate: 0, scale: 1 }}
              whileHover={{ rotate: 0, y: -4, boxShadow: shadows.brutalLarge }}
              transition={{ type: 'spring', stiffness: 300 }}
              style={{
                padding: '20px',
                background: colors.success,
                border: `5px solid ${colors.border}`,
                boxShadow: shadows.brutal,
              }}
            >
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', marginBottom: '12px', color: colors.dark }}>
                LONGEST STREAK
              </div>
              {hof.longestStreak ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Avatar addr={hof.longestStreak.address} size={36} />
                    <Link
                      to={`/profile?address=${encodeURIComponent(hof.longestStreak.address)}`}
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: '13px',
                        color: colors.dark,
                        textDecoration: 'none',
                      }}
                    >
                      {hof.longestStreak.address.slice(0,6)}...{hof.longestStreak.address.slice(-4)}
                    </Link>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '28px', color: colors.dark }}>
                    {hof.longestStreak.length} DAYS
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', opacity: 0.7 }}>—</div>
              )}
            </motion.div>

            {/* Fastest Solve */}
            <motion.div
              initial={{ rotate: 1, scale: 0.9 }}
              animate={{ rotate: 1, scale: 1 }}
              whileHover={{ rotate: 0, y: -4, boxShadow: shadows.brutalLarge }}
              transition={{ type: 'spring', stiffness: 300 }}
              style={{
                padding: '20px',
                background: colors.secondary,
                border: `5px solid ${colors.border}`,
                boxShadow: shadows.brutal,
              }}
            >
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', marginBottom: '12px', color: colors.white }}>
                FASTEST SOLVE EVER
              </div>
              {hof.fastest ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Avatar addr={hof.fastest.address} size={36} />
                    <Link
                      to={`/profile?address=${encodeURIComponent(hof.fastest.address)}`}
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: '13px',
                        color: colors.white,
                        textDecoration: 'none',
                      }}
                    >
                      {hof.fastest.address.slice(0,6)}...{hof.fastest.address.slice(-4)}
                    </Link>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '28px', color: colors.white }}>
                    {fmtTime(hof.fastest.solveTime)}
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '11px', opacity: 0.7, marginTop: '4px', color: colors.white }}>
                    Puzzle #{hof.fastest.puzzleId}
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', opacity: 0.7, color: colors.white }}>—</div>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
