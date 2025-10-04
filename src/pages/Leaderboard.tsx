import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import useWallet from '../hooks/useWallet';
import { getPuzzleInfo, getLeaderboard, type PuzzleInfo, type LeaderboardEntry } from '../lib/contracts';
import { fetchCallReadOnlyFunction, ClarityType, uintCV } from '@stacks/transactions';
import { getNetwork, type NetworkName } from '../lib/stacks';
import { Link } from 'react-router-dom';
import LeaderboardSkeleton from '../components/skeletons/LeaderboardSkeleton';

const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';

function getContractIds(network: NetworkName) {
  const id = network === 'testnet' ? (import.meta as any).env?.VITE_CONTRACT_TESTNET : (import.meta as any).env?.VITE_CONTRACT_MAINNET;
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

      // Fetch total puzzle count
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

      // Fetch puzzle infos with concurrency limit
      const infos = await concurrentMap(ids, 6, async (id) => {
        try { const info = await getPuzzleInfo({ puzzleId: id, network }); return { id, info }; } catch { return { id, info: null as any }; }
      });

      // Map id->info
      const infoMap = new Map<number, PuzzleInfo>();
      for (const p of infos) { if (p?.info) infoMap.set(p.id, p.info); }

      // Fetch leaderboards for all puzzles
      const lbs = await concurrentMap(ids, 5, async (id) => {
        try { const list = await getLeaderboard({ puzzleId: id, network }); return { id, list }; } catch { return { id, list: [] as LeaderboardEntry[] }; }
      });

      // Aggregate winners and entries
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

      // Unique winning players
      const uniquePlayers = Array.from(new Set(winners.map(w => w.address))).filter(Boolean);

      // Fetch user stats for winners only (authoritative totals)
      const stats = await concurrentMap(uniquePlayers, 6, async (addr) => {
        try {
          const { getUserStats } = await import('../lib/contracts');
          const s = await getUserStats({ address: addr, network });
          return { address: addr, totalWins: Number(s.totalWins), totalWinnings: BigInt(s.totalWinnings) };
        } catch {
          // Fallback: compute from winners list
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

      // Today's best times per difficulty
      const todayKey = dayKey(Math.floor(Date.now() / 1000));
      const bestByDiff: Record<'beginner'|'intermediate'|'expert', Array<{ address: string; solveTime: number; puzzleId: number }>> = {
        beginner: [], intermediate: [], expert: []
      };
      const seen = new Set<string>();
      const byDiff = (d: string) => (d === 'intermediate' || d === 'expert') ? d : 'beginner';
      const todayEntries = correctEntries.filter(e => dayKey(e.timestamp) === todayKey);
      // Sort by solve time asc, then pick top across distinct addresses
      todayEntries.sort((a, b) => (a.solveTime - b.solveTime));
      for (const e of todayEntries) {
        const key = `${e.difficulty}:${e.address}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const diffKey = byDiff(e.difficulty) as 'beginner'|'intermediate'|'expert';
        (bestByDiff[diffKey] as any).push({ address: e.address, solveTime: e.solveTime, puzzleId: e.puzzleId });
      }
      // trim to top 5 per diff
      (bestByDiff as any).beginner = bestByDiff.beginner.slice(0, 5);
      (bestByDiff as any).intermediate = bestByDiff.intermediate.slice(0, 5);
      (bestByDiff as any).expert = bestByDiff.expert.slice(0, 5);

      // Hall of Fame
      // Biggest single win
      let biggest = winners.slice().sort((a, b) => (a.netPrize < b.netPrize ? 1 : -1))[0] || null;

      // Most wins in a day
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

      // Longest streak (consecutive daily wins)
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

      // Fastest solve ever
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

  if (q.isLoading && !q.data) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-yellow-200 via-rose-200 to-blue-200 text-black relative overflow-hidden`}>
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <header className="flex items-center justify-between mb-6">
            <div className={`${brutal} bg-white/80 backdrop-blur px-4 py-2 text-xl font-black tracking-tight`}>Global Leaderboard</div>
            <div className="text-xs opacity-70">Updates every 60s</div>
          </header>
          <LeaderboardSkeleton rows={10} />
        </div>
      </div>
    );
  }
  const data = q.data as any;
  const players: Array<{ address: string; totalWins: number; totalWinnings: bigint; totalWinningsStx: string }> = data?.players || [];
  const today = data?.today || { beginner: [], intermediate: [], expert: [] };
  const hof = data?.hof || {};

  const filtered = useMemo(() => {
    const f = (filter || '').trim().toLowerCase();
    if (!f) return players;
    return players.filter(p => p.address.includes(f));
  }, [players, filter]);

  function Avatar({ addr, size = 28 }: { addr: string; size?: number }) {
    const bg = hashToHsl(addr);
    const ch = (addr || 'U')[2]?.toUpperCase() || 'U';
    return (
      <div className="inline-flex items-center justify-center rounded-full border-[2px] border-black" style={{ width: size, height: size, background: bg }}>
        <span className="text-xs font-black" style={{ color: '#000' }}>{ch}</span>
      </div>
    );
  }

  function fmtTime(sec: number) {
    const m = Math.floor(sec / 60); const s = sec % 60; const ss = s < 10 ? `0${s}` : String(s); return `${m}:${ss}`;
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-yellow-200 via-rose-200 to-blue-200 text-black relative overflow-hidden`}>
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <header className="flex items-center justify-between mb-6">
          <div className={`${brutal} bg-white/80 backdrop-blur px-4 py-2 text-xl font-black tracking-tight`}>Global Leaderboard</div>
          <div className="text-xs opacity-70">Updates every 60s</div>
        </header>

        {/* All-time leaderboard */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-black uppercase tracking-wider">All-time leaderboard</div>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search address" className={`${brutal} bg-white px-3 py-2 text-sm w-60`} />
          </div>
          <div className={`${brutal} bg-white/90 backdrop-blur overflow-hidden`}>
            <div className="max-h-[460px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-100">
                  <tr>
                    <th className="text-left p-2">Rank</th>
                    <th className="text-left p-2">Player</th>
                    <th className="text-right p-2">Wins</th>
                    <th className="text-right p-2">Total STX Won</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const isYou = p.address === address;
                    return (
                      <tr key={p.address} className={`border-t border-zinc-200 hover:bg-yellow-100 transition-colors ${isYou ? 'bg-yellow-200' : ''}`}>
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Avatar addr={p.address} />
                            <a href={`/profile?address=${encodeURIComponent(p.address)}`} className="font-mono hover:underline">{p.address.slice(0, 6)}…{p.address.slice(-4)}</a>
                          </div>
                        </td>
                        <td className="p-2 text-right font-black">{p.totalWins}</td>
                        <td className="p-2 text-right font-black">{p.totalWinningsStx} STX</td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={4} className="p-3 text-center text-xs opacity-70">No results</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Today's best times */}
        <section className="mb-10">
          <div className="text-xs font-black uppercase tracking-wider mb-2">Today's best times</div>
          <div className="grid md:grid-cols-3 gap-4">
            {(['beginner','intermediate','expert'] as const).map((dkey) => (
              <div key={dkey} className={`${brutal} bg-white p-3`}>
                <div className="text-xs font-black uppercase tracking-wider mb-2">{dkey}</div>
                <div className="grid gap-2">
                  {(today[dkey] || []).map((row: any, idx: number) => (
                    <div key={row.address+idx} className={`${brutal} bg-white hover:bg-yellow-50 p-2 flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <Avatar addr={row.address} />
                        <a href={`/profile?address=${encodeURIComponent(row.address)}`} className="font-mono hover:underline">{row.address.slice(0,6)}…{row.address.slice(-4)}</a>
                      </div>
                      <div className="font-black">{fmtTime(row.solveTime)}</div>
                    </div>
                  ))}
                  {(today[dkey] || []).length === 0 && (
                    <div className={`${brutal} bg-zinc-100 p-2 text-xs text-center`}>No solves yet today</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Hall of Fame */}
        <section className="mb-6">
          <div className="text-xs font-black uppercase tracking-wider mb-2">Hall of Fame</div>
          <div className="grid md:grid-cols-4 gap-4">
            <div className={`${brutal} bg-yellow-200 p-3`}>
              <div className="text-[11px] uppercase font-black mb-1">Biggest single win</div>
              {hof.biggest ? (
                <div>
                  <div className="flex items-center gap-2 mb-1"><Avatar addr={hof.biggest.address}/><a href={`/profile?address=${encodeURIComponent(hof.biggest.address)}`} className="font-mono hover:underline">{hof.biggest.address.slice(0,6)}…{hof.biggest.address.slice(-4)}</a></div>
                  <div className="text-lg font-black">{(Number(hof.biggest.netPrize)/1_000_000).toFixed(2)} STX</div>
                  <div className="text-[11px] opacity-70">Puzzle #{hof.biggest.puzzleId}</div>
                </div>
              ) : (<div className="text-xs opacity-70">—</div>)}
            </div>
            <div className={`${brutal} bg-blue-200 p-3`}>
              <div className="text-[11px] uppercase font-black mb-1">Most wins in a day</div>
              {hof.mostWinsDay ? (
                <div>
                  <div className="flex items-center gap-2 mb-1"><Avatar addr={hof.mostWinsDay.address}/><a href={`/profile?address=${encodeURIComponent(hof.mostWinsDay.address)}`} className="font-mono hover:underline">{hof.mostWinsDay.address.slice(0,6)}…{hof.mostWinsDay.address.slice(-4)}</a></div>
                  <div className="text-lg font-black">{hof.mostWinsDay.count} wins</div>
                  <div className="text-[11px] opacity-70">{hof.mostWinsDay.day}</div>
                </div>
              ) : (<div className="text-xs opacity-70">—</div>)}
            </div>
            <div className={`${brutal} bg-green-200 p-3`}>
              <div className="text-[11px] uppercase font-black mb-1">Longest streak</div>
              {hof.longestStreak ? (
                <div>
                  <div className="flex items-center gap-2 mb-1"><Avatar addr={hof.longestStreak.address}/><a href={`/profile?address=${encodeURIComponent(hof.longestStreak.address)}`} className="font-mono hover:underline">{hof.longestStreak.address.slice(0,6)}…{hof.longestStreak.address.slice(-4)}</a></div>
                  <div className="text-lg font-black">{hof.longestStreak.length} days</div>
                </div>
              ) : (<div className="text-xs opacity-70">—</div>)}
            </div>
            <div className={`${brutal} bg-pink-200 p-3`}>
              <div className="text-[11px] uppercase font-black mb-1">Fastest solve ever</div>
              {hof.fastest ? (
                <div>
                  <div className="flex items-center gap-2 mb-1"><Avatar addr={hof.fastest.address}/><a href={`/profile?address=${encodeURIComponent(hof.fastest.address)}`} className="font-mono hover:underline">{hof.fastest.address.slice(0,6)}…{hof.fastest.address.slice(-4)}</a></div>
                  <div className="text-lg font-black">{fmtTime(hof.fastest.solveTime)}</div>
                  <div className="text-[11px] opacity-70">Puzzle #{hof.fastest.puzzleId}</div>
                </div>
              ) : (<div className="text-xs opacity-70">—</div>)}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
