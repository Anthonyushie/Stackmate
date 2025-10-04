import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Calendar, CheckCircle2, Clock, Coins, Flame, Hourglass, Medal, Percent, Star, Trophy, Zap, ChevronLeft, ChevronRight } from 'lucide-react'
import useWallet from '../hooks/useWallet'
import { fetchCallReadOnlyFunction, standardPrincipalCV, uintCV, ClarityType } from '@stacks/transactions'
import { microToStx, type NetworkName, getNetwork } from '../lib/stacks'
import { getPuzzleInfo, type PuzzleInfo } from '../lib/contracts'
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from 'recharts'
import { useSearchParams } from 'react-router-dom'
import ProfileStatsSkeleton from '../components/skeletons/ProfileStatsSkeleton'
import Header from '../components/Header'
import { colors, shadows, getDifficultyColor } from '../styles/neo-brutal-theme'
import NeoButton from '../components/neo/NeoButton'
import NeoBadge from '../components/neo/NeoBadge'

function getContractIds(network: NetworkName) {
  const id = network === 'testnet' ? (import.meta as any).env?.VITE_CONTRACT_TESTNET : (import.meta as any).env?.VITE_CONTRACT_MAINNET
  if (!id || typeof id !== 'string' || !id.includes('.')) throw new Error('Missing contract id env var')
  const [address, name] = id.split('.')
  return { address, name }
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}` }
function formatTime(total: number | bigint) {
  const v = typeof total === 'bigint' ? Number(total) : total
  const m = Math.floor(v / 60)
  const s = v % 60
  return `${pad(m)}:${pad(s)}`
}

function dayKey(tsSec: number) {
  const d = new Date(tsSec * 1000)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export default function Profile() {
  const { network, getAddress } = useWallet()
  const [params] = useSearchParams()
  const paramAddress = (params.get('address') || '').trim()
  const walletAddress = getAddress() || ''
  const address = paramAddress || walletAddress
  const [sortBy, setSortBy] = useState<'date'|'difficulty'|'time'|'result'|'prize'>('date')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const statsQ = useQuery<{ totalEntries: bigint; totalWins: bigint; totalWinnings: bigint }>({
    queryKey: ['user-stats', network, address],
    queryFn: async () => {
      if (!address) throw new Error('no address')
      const { address: contractAddress, name: contractName } = getContractIds(network)
      const stxNetwork = getNetwork(network)
      const sender = address || contractAddress
      const cv: any = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-user-stats',
        functionArgs: [standardPrincipalCV(address)],
        senderAddress: sender,
        network: stxNetwork,
      })
      if (cv?.type !== ClarityType.ResponseOk) throw new Error('no stats')
      const val: any = cv.value
      const e = BigInt(val.data['total-entries']?.value ?? 0)
      const w = BigInt(val.data['total-wins']?.value ?? 0)
      const tw = BigInt(val.data['total-winnings']?.value ?? 0)
      return { totalEntries: e, totalWins: w, totalWinnings: tw }
    },
    enabled: !!address,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  })

  const entriesQ = useQuery<number[]>({
    queryKey: ['user-entries', network, address],
    queryFn: async () => {
      const { address: contractAddress, name: contractName } = getContractIds(network)
      const stxNetwork = getNetwork(network)
      const sender = address || contractAddress
      const cv: any = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-user-entries',
        functionArgs: [standardPrincipalCV(address)],
        senderAddress: sender,
        network: stxNetwork,
      })
      const ok = cv?.type === ClarityType.ResponseOk ? (cv as any).value : null
      const arr = ok ? ((ok as any).list as any[]) : []
      const ids: number[] = arr.map((cv: any) => Number(cv?.value ?? 0)).filter((n: number) => Number.isFinite(n) && n > 0)
      return ids
    },
    enabled: !!address,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  })

  const entryDetailQueries = useQueries({
    queries: (entriesQ.data || []).map((id) => ({
      queryKey: ['entry-detail', network, address, String(id)],
      enabled: !!address,
      refetchInterval: 30000,
      refetchOnWindowFocus: false,
      queryFn: async () => {
        const { address: contractAddress, name: contractName } = getContractIds(network)
        const stxNetwork = getNetwork(network)
        const cv: any = await fetchCallReadOnlyFunction({
          contractAddress,
          contractName,
          functionName: 'get-entry',
          functionArgs: [uintCV(id), standardPrincipalCV(address)],
          senderAddress: address,
          network: stxNetwork,
        })
        if (cv?.type !== ClarityType.ResponseOk) return null
        const opt = cv.value
        if (opt?.type === ClarityType.OptionalSome) {
          const t = opt.value
          const solveTime = BigInt(t.data['solve-time']?.value ?? 0)
          const timestamp = BigInt(t.data['timestamp']?.value ?? 0)
          const ic = t.data['is-correct']
          const isCorrect = ic?.type === ClarityType.BoolTrue
          return { id, solveTime, timestamp, isCorrect } as { id: number; solveTime: bigint; timestamp: bigint; isCorrect: boolean }
        }
        return { id, solveTime: 0n, timestamp: 0n, isCorrect: false }
      }
    }))
  })

  const puzzleInfoQueries = useQueries({
    queries: (entriesQ.data || []).map((id) => ({
      queryKey: ['puzzle-info', network, String(id)],
      queryFn: () => getPuzzleInfo({ puzzleId: id, network }),
      enabled: (entriesQ.data || []).length > 0,
      refetchInterval: 30000,
      refetchOnWindowFocus: false,
    }))
  })

  const rows = useMemo(() => {
    const ids = entriesQ.data || []
    const details = new Map<number, { id: number; solveTime: bigint; timestamp: bigint; isCorrect: boolean }>()
    entryDetailQueries.forEach((q) => { const d = q.data as any; if (d && typeof d.id === 'number') details.set(d.id, d) })
    const infos = new Map<number, PuzzleInfo>()
    puzzleInfoQueries.forEach((q, idx) => { const id = ids[idx]; if (id && q.data) infos.set(id, q.data) })
    const out = ids.map((id) => {
      const d = details.get(id)
      const info = infos.get(id)
      const ts = d?.timestamp ? Number(d.timestamp) : 0
      const date = ts ? new Date(ts * 1000) : null
      const youWon = info?.winner && address && info.winner.toLowerCase() === address.toLowerCase()
      const gross = info ? BigInt(info.stakeAmount) * BigInt(info.entryCount) : 0n
      const fee = gross ? (gross * 5n) / 100n : 0n
      const net = youWon ? (gross - fee) : 0n
      return {
        id,
        date,
        difficulty: info?.difficulty || '',
        yourTime: d?.solveTime ?? 0n,
        result: youWon ? 'Won' : (d?.isCorrect ? 'Solved' : 'Lost'),
        prizeMicro: net,
      }
    })
    return out
  }, [JSON.stringify(entriesQ.data || []), JSON.stringify(entryDetailQueries.map((q) => q.data)), JSON.stringify(puzzleInfoQueries.map((q) => q.data)), address])

  const solvedRows = useMemo(() => rows.filter((r) => r.result === 'Won' || r.result === 'Solved'), [rows])
  const solvedTimes = useMemo(() => solvedRows.map((r) => Number(r.yourTime)).filter((n) => Number.isFinite(n) && n > 0), [solvedRows])
  const avgSolve = useMemo(() => {
    if (!solvedTimes.length) return 0
    const sum = solvedTimes.reduce((a, b) => a + b, 0)
    return Math.round(sum / solvedTimes.length)
  }, [solvedTimes])
  const bestSolve = useMemo(() => solvedTimes.length ? Math.min(...solvedTimes) : 0, [solvedTimes])

  const currentStreak = useMemo(() => {
    const solved = rows.filter((r) => r.result === 'Won' || r.result === 'Solved' ).filter((r) => r.date)
    if (!solved.length) return 0
    const days = new Set(solved.map((r) => dayKey(Math.floor(r.date!.getTime()/1000))))
    const today = new Date(); today.setHours(0,0,0,0)
    let streak = 0
    for (;;) {
      const key = today.toISOString().slice(0,10)
      if (days.has(key)) { streak += 1; today.setDate(today.getDate()-1) } else { break }
    }
    return streak
  }, [rows])

  const winRatePct = useMemo(() => {
    const t = Number(statsQ.data?.totalEntries || 0n)
    const w = Number(statsQ.data?.totalWins || 0n)
    if (!t) return 0
    return Math.round((w / t) * 100)
  }, [statsQ.data])

  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; entries: number; wins: number }>()
    rows.forEach((r) => {
      if (!r.date) return
      const key = dayKey(Math.floor(r.date.getTime()/1000))
      if (!map.has(key)) map.set(key, { date: key, entries: 0, wins: 0 })
      const obj = map.get(key)!
      obj.entries += 1
      if (r.result === 'Won') obj.wins += 1
    })
    const arr = Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    let cumWins = 0
    let cumEntries = 0
    return arr.map((d) => {
      cumWins += d.wins
      cumEntries += d.entries
      const rate = cumEntries ? Math.round((cumWins / cumEntries) * 100) : 0
      return { ...d, rate }
    })
  }, [rows])

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1
      if (sortBy === 'date') return mult * (((a.date?.getTime()||0) - (b.date?.getTime()||0)))
      if (sortBy === 'difficulty') return mult * a.difficulty.localeCompare(b.difficulty)
      if (sortBy === 'time') return mult * (Number(a.yourTime) - Number(b.yourTime))
      if (sortBy === 'result') return mult * a.result.localeCompare(b.result)
      if (sortBy === 'prize') return mult * (Number(a.prizeMicro) - Number(b.prizeMicro))
      return 0
    })
    return copy
  }, [rows, sortBy, sortDir])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, page])

  const totalPages = useMemo(() => Math.max(1, Math.ceil((rows.length || 0) / pageSize)), [rows.length])

  const loadingAny = statsQ.isLoading || entriesQ.isLoading || entryDetailQueries.some(q => q.isLoading) || puzzleInfoQueries.some(q => q.isLoading)

  const achievements = useMemo(() => {
    const totalWins = Number(statsQ.data?.totalWins || 0n)
    const totalEntries = Number(statsQ.data?.totalEntries || 0n)
    const totalWinningsStx = microToStx(statsQ.data?.totalWinnings || 0n)
    const speedDemon = solvedTimes.some((t) => t > 0 && t < 60)
    const consistent = currentStreak >= 5
    const firstWin = totalWins >= 1
    const tenSolved = solvedRows.length >= 10
    const marathon = totalEntries >= 50
    return [
      { key: 'first', label: 'First Win', achieved: firstWin, icon: Trophy, desc: 'Win your first puzzle' },
      { key: 'ten', label: '10 Puzzles', achieved: tenSolved, icon: Medal, desc: 'Solve 10 puzzles' },
      { key: 'speed', label: 'Speed Demon', achieved: speedDemon, icon: Zap, desc: 'Solve in under 1 min' },
      { key: 'streak', label: 'Consistent', achieved: consistent, icon: Flame, desc: '5 day streak' },
      { key: 'marathon', label: 'Marathoner', achieved: marathon, icon: Hourglass, desc: 'Enter 50 puzzles' },
      { key: 'bank', label: 'Bankroller', achieved: Number(totalWinningsStx) >= 100, icon: Coins, desc: 'Win 100+ STX' },
    ]
  }, [statsQ.data, solvedTimes, currentStreak, solvedRows])

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
            background: colors.accent,
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
            }}
          >
            PROFILE
          </h1>
          {paramAddress && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
              Viewing: {paramAddress.slice(0, 8)}...{paramAddress.slice(-6)}
            </div>
          )}
        </motion.div>

        {loadingAny && <ProfileStatsSkeleton />}
        
        {!loadingAny && (
          <>
            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              {[
                { icon: Star, label: 'Total Entered', value: String(statsQ.data?.totalEntries ?? 0n), color: colors.white, rotation: -1 },
                { icon: Trophy, label: 'Total Solved', value: String(solvedRows.length), color: colors.success, rotation: 1 },
                { icon: Percent, label: 'Win Rate', value: `${winRatePct}%`, color: colors.accent, rotation: -1 },
                { icon: Coins, label: 'Total STX Won', value: `${microToStx(statsQ.data?.totalWinnings ?? 0n)} STX`, color: colors.primary, rotation: 1 },
                { icon: Clock, label: 'Avg Solve Time', value: avgSolve ? formatTime(avgSolve) : '—', color: colors.secondary, rotation: 0 },
                { icon: Medal, label: 'Best Solve', value: bestSolve ? formatTime(bestSolve) : '—', color: colors.white, rotation: -1 },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ rotate: stat.rotation, y: 20, opacity: 0 }}
                  animate={{ rotate: stat.rotation, y: 0, opacity: 1 }}
                  whileHover={{ rotate: 0, y: -4, boxShadow: shadows.brutalLarge }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.05 }}
                  style={{
                    padding: '20px',
                    background: stat.color,
                    border: `5px solid ${colors.border}`,
                    boxShadow: shadows.brutal,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <stat.icon className="h-5 w-5" style={{ color: colors.dark }} />
                    <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', color: colors.dark }}>
                      {stat.label}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 'clamp(24px, 3vw, 32px)', color: colors.dark }}>
                    {stat.value}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Current Streak - Full Width */}
            <motion.div
              initial={{ rotate: -1, y: 20, opacity: 0 }}
              animate={{ rotate: -1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.3 }}
              style={{
                padding: '24px',
                background: colors.error,
                border: `6px solid ${colors.border}`,
                boxShadow: shadows.brutal,
                marginBottom: '32px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <Flame className="h-6 w-6" style={{ color: colors.white }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', color: colors.white }}>
                  CURRENT STREAK
                </span>
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 'clamp(40px, 6vw, 56px)', color: colors.white, textShadow: `4px 4px 0px ${colors.border}` }}>
                {currentStreak} DAY{currentStreak === 1 ? '' : 'S'}
              </div>
            </motion.div>

            {/* Achievements Section */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.4 }}
              style={{ marginBottom: '32px' }}
            >
              <div
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  background: colors.primary,
                  border: `5px solid ${colors.border}`,
                  boxShadow: shadows.brutalSmall,
                  marginBottom: '16px',
                }}
              >
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '20px', textTransform: 'uppercase', margin: 0, color: colors.dark }}>
                  ACHIEVEMENTS
                </h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                {achievements.map((a, i) => {
                  const IconComponent = a.icon;
                  return (
                    <motion.div
                      key={a.key}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, delay: 0.45 + i * 0.05 }}
                      style={{
                        padding: '16px',
                        background: a.achieved ? colors.success : colors.white,
                        border: `4px solid ${colors.border}`,
                        boxShadow: shadows.brutalSmall,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        opacity: a.achieved ? 1 : 0.6,
                      }}
                    >
                      <div
                        style={{
                          minWidth: '40px',
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: a.achieved ? colors.dark : colors.white,
                          border: `3px solid ${colors.border}`,
                        }}
                      >
                        <IconComponent className="h-5 w-5" style={{ color: a.achieved ? colors.primary : colors.dark }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '14px', color: colors.dark }}>
                          {a.label}
                        </div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>
                          {a.desc}
                        </div>
                      </div>
                      {a.achieved && (
                        <CheckCircle2 className="h-5 w-5" style={{ color: colors.dark }} />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Win Rate Chart */}
            <motion.div
              initial={{ rotate: 1, y: 20, opacity: 0 }}
              animate={{ rotate: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.5 }}
              style={{ marginBottom: '32px' }}
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
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '20px', textTransform: 'uppercase', margin: 0, color: colors.white }}>
                  WIN RATE OVER TIME
                </h2>
              </div>

              <div
                style={{
                  padding: '20px',
                  background: colors.white,
                  border: `6px solid ${colors.border}`,
                  boxShadow: shadows.brutal,
                  height: '300px',
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.success} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={colors.success} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0" stroke={colors.border} strokeWidth={2} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
                      stroke={colors.border}
                      strokeWidth={2}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
                      stroke={colors.border}
                      strokeWidth={2}
                    />
                    <Tooltip
                      formatter={(v: any, n: any) => n === 'rate' ? [`${v}%`, 'Win Rate'] : v}
                      contentStyle={{
                        background: colors.white,
                        border: `4px solid ${colors.border}`,
                        borderRadius: 0,
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 700,
                      }}
                    />
                    <Area
                      type="stepAfter"
                      dataKey="rate"
                      stroke={colors.success}
                      strokeWidth={4}
                      fillOpacity={1}
                      fill="url(#grad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* History Section */}
            <motion.div
              initial={{ rotate: -1, y: 20, opacity: 0 }}
              animate={{ rotate: 0, y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.6 }}
            >
              <div
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  background: colors.primary,
                  border: `5px solid ${colors.border}`,
                  boxShadow: shadows.brutalSmall,
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Calendar className="h-5 w-5" />
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '20px', textTransform: 'uppercase', margin: 0, color: colors.dark }}>
                    HISTORY
                  </h2>
                  <NeoBadge color={colors.dark} size="sm">
                    {rows.length}
                  </NeoBadge>
                </div>
              </div>

              {/* Sort Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {(['date', 'difficulty', 'time', 'result', 'prize'] as const).map((sort) => (
                  <NeoButton
                    key={sort}
                    variant={sortBy === sort ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => {
                      if (sortBy === sort) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                      else setSortBy(sort);
                    }}
                  >
                    {sort.toUpperCase()} {sortBy === sort && (sortDir === 'desc' ? '↓' : '↑')}
                  </NeoButton>
                ))}
              </div>

              {/* History Table */}
              <div
                style={{
                  background: colors.white,
                  border: `6px solid ${colors.border}`,
                  boxShadow: shadows.brutal,
                  overflow: 'hidden',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead
                      style={{
                        background: colors.dark,
                        color: colors.white,
                      }}
                    >
                      <tr>
                        <th style={{ padding: '12px', textAlign: 'left', fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', borderRight: `2px solid ${colors.border}` }}>Date</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', borderRight: `2px solid ${colors.border}` }}>Difficulty</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', borderRight: `2px solid ${colors.border}` }}>Time</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', borderRight: `2px solid ${colors.border}` }}>Result</th>
                        <th style={{ padding: '12px', textAlign: 'right', fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '12px', textTransform: 'uppercase' }}>Prize</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((r, i) => {
                        const rowBg = i % 2 === 0 ? colors.white : '#f5f5f5';
                        const resultColor = r.result === 'Won' ? colors.success : r.result === 'Solved' ? colors.accent : colors.error;
                        return (
                          <tr
                            key={r.id}
                            style={{
                              background: rowBg,
                              borderTop: `2px solid ${colors.border}`,
                            }}
                          >
                            <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', borderRight: `1px solid ${colors.border}` }}>
                              {r.date ? r.date.toLocaleString() : '—'}
                            </td>
                            <td style={{ padding: '12px', borderRight: `1px solid ${colors.border}` }}>
                              <NeoBadge color={getDifficultyColor(r.difficulty?.toLowerCase() as any)} size="sm">
                                {r.difficulty || '—'}
                              </NeoBadge>
                            </td>
                            <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '13px', borderRight: `1px solid ${colors.border}` }}>
                              {Number(r.yourTime) ? formatTime(Number(r.yourTime)) : '—'}
                            </td>
                            <td style={{ padding: '12px', borderRight: `1px solid ${colors.border}` }}>
                              <span
                                style={{
                                  padding: '4px 8px',
                                  background: resultColor,
                                  border: `2px solid ${colors.border}`,
                                  fontFamily: "'Inter', sans-serif",
                                  fontWeight: 900,
                                  fontSize: '11px',
                                  textTransform: 'uppercase',
                                  color: colors.dark,
                                }}
                              >
                                {r.result}
                              </span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '13px' }}>
                              {r.prizeMicro ? `${microToStx(r.prizeMicro)} STX` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                      {pagedRows.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '20px', textAlign: 'center', fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '14px', opacity: 0.7 }}>
                            No entries yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    background: colors.dark,
                    borderTop: `4px solid ${colors.border}`,
                  }}
                >
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '12px', color: colors.white }}>
                    Page {page} of {totalPages}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <NeoButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p-1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </NeoButton>
                    <NeoButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p+1))}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </NeoButton>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}
