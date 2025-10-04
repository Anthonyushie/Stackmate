import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Calendar, CheckCircle2, Clock, Coins, Flame, Hourglass, Medal, Percent, Star, Trophy, Zap } from 'lucide-react'
import WalletConnect from '../components/WalletConnect'
import useWallet from '../hooks/useWallet'
import { fetchCallReadOnlyFunction, standardPrincipalCV, uintCV, ClarityType } from '@stacks/transactions'
import { getApiBaseUrl, microToStx, type NetworkName, getNetwork } from '../lib/stacks'
import { getPuzzleInfo, type PuzzleInfo } from '../lib/contracts'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from 'recharts'

const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]'

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
  const address = getAddress() || ''
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
  }, [entriesQ.data, entryDetailQueries.map((q) => q.data).join('|'), puzzleInfoQueries.map((q) => q.data ? JSON.stringify(q.data) : '').join('|'), address])

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
      { key: 'first', label: 'First Win', achieved: firstWin, icon: <Trophy className="h-4 w-4"/>, desc: 'Win your first puzzle' },
      { key: 'ten', label: '10 Puzzles Solved', achieved: tenSolved, icon: <Medal className="h-4 w-4"/>, desc: 'Solve 10 puzzles' },
      { key: 'speed', label: 'Speed Demon', achieved: speedDemon, icon: <Zap className="h-4 w-4"/>, desc: 'Solve in under 1 min' },
      { key: 'streak', label: 'Consistent', achieved: consistent, icon: <Flame className="h-4 w-4"/>, desc: '5 day streak' },
      { key: 'marathon', label: 'Marathoner', achieved: marathon, icon: <Hourglass className="h-4 w-4"/>, desc: 'Enter 50 puzzles' },
      { key: 'bank', label: 'Bankroller', achieved: Number(totalWinningsStx) >= 100, icon: <Coins className="h-4 w-4"/>, desc: 'Win 100+ STX' },
    ]
  }, [statsQ.data, solvedTimes, currentStreak, solvedRows])

  const bgGrad = 'from-yellow-200 via-rose-200 to-blue-200 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900'

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgGrad} text-black dark:text-white relative overflow-hidden`}>
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <header className="flex items-center justify-between mb-6">
          <div className={`${brutal} bg-white/80 dark:bg-zinc-900/60 backdrop-blur px-4 py-2 text-xl font-black tracking-tight`}>Profile</div>
          <WalletConnect />
        </header>

        <section className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${brutal} bg-white/85 p-4`}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><Star className="h-4 w-4"/> Total Entered</div>
            <div className="text-2xl font-black">{String(statsQ.data?.totalEntries ?? 0n)}</div>
          </div>
          <div className={`${brutal} bg-green-200 p-4`}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><Trophy className="h-4 w-4"/> Total Solved</div>
            <div className="text-2xl font-black">{String(statsQ.data?.totalWins ?? 0n)}</div>
          </div>
          <div className={`${brutal} bg-blue-200 p-4`}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><Percent className="h-4 w-4"/> Win Rate</div>
            <div className="text-2xl font-black">{winRatePct}%</div>
          </div>
          <div className={`${brutal} bg-yellow-200 p-4`}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><Coins className="h-4 w-4"/> Total STX Won</div>
            <div className="text-2xl font-black">{microToStx(statsQ.data?.totalWinnings ?? 0n)} STX</div>
          </div>
          <div className={`${brutal} bg-pink-200 p-4`}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><Clock className="h-4 w-4"/> Avg Solve Time</div>
            <div className="text-2xl font-black">{avgSolve ? formatTime(avgSolve) : '—'}</div>
          </div>
          <div className={`${brutal} bg-white p-4`}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><Medal className="h-4 w-4"/> Best Solve Time</div>
            <div className="text-2xl font-black">{bestSolve ? formatTime(bestSolve) : '—'}</div>
          </div>
          <div className={`${brutal} bg-orange-200 p-4 md:col-span-3`}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><Flame className="h-4 w-4"/> Current Streak</div>
            <div className="text-2xl font-black">{currentStreak} day{currentStreak === 1 ? '' : 's'}</div>
          </div>
        </section>

        <section className="mb-10">
          <div className="flex items-center gap-2 mb-2"><Percent className="h-4 w-4"/><div className="text-xs font-black uppercase tracking-wider">Win Rate Over Time</div></div>
          <div className={`${brutal} bg-white/85 backdrop-blur p-3 h-64`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000020" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any, n: any) => n === 'rate' ? [`${v}%`, 'Win Rate'] : v} />
                <Area type="monotone" dataKey="rate" stroke="#16a34a" fillOpacity={1} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mb-10">
          <div className="flex items-center gap-2 mb-2"><Medal className="h-4 w-4"/><div className="text-xs font-black uppercase tracking-wider">Achievements</div></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {achievements.map((a) => (
              <div key={a.key} className={`${brutal} ${a.achieved ? 'bg-green-200' : 'bg-white'} p-3 flex items-start gap-3`}>
                <div className={`h-8 w-8 ${brutal} flex items-center justify-center ${a.achieved ? 'bg-black text-white' : 'bg-zinc-200 text-black'}`}>{a.icon}</div>
                <div>
                  <div className="font-black">{a.label}</div>
                  <div className="text-xs opacity-70">{a.desc}</div>
                </div>
                <div className="ml-auto self-center">{a.achieved ? <CheckCircle2 className="h-5 w-5 text-green-700"/> : <Clock className="h-5 w-5 opacity-50"/>}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4"/><div className="text-xs font-black uppercase tracking-wider">History</div></div>
            <div className="text-xs opacity-70">{rows.length} entries</div>
          </div>
          <div className={`${brutal} bg-white/90 backdrop-blur overflow-hidden`}>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-100">
                  <tr>
                    <th className="text-left p-2 cursor-pointer" onClick={() => { setSortBy('date'); setSortDir(sortBy === 'date' && sortDir === 'desc' ? 'asc' : 'desc') }}>Date</th>
                    <th className="text-left p-2 cursor-pointer" onClick={() => { setSortBy('difficulty'); setSortDir(sortBy === 'difficulty' && sortDir === 'desc' ? 'asc' : 'desc') }}>Difficulty</th>
                    <th className="text-left p-2 cursor-pointer" onClick={() => { setSortBy('time'); setSortDir(sortBy === 'time' && sortDir === 'desc' ? 'asc' : 'desc') }}>Your Time</th>
                    <th className="text-left p-2 cursor-pointer" onClick={() => { setSortBy('result'); setSortDir(sortBy === 'result' && sortDir === 'desc' ? 'asc' : 'desc') }}>Result</th>
                    <th className="text-left p-2 cursor-pointer" onClick={() => { setSortBy('prize'); setSortDir(sortBy === 'prize' && sortDir === 'desc' ? 'asc' : 'desc') }}>Prize</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((r) => (
                    <tr key={r.id} className="border-t border-zinc-200">
                      <td className="p-2 whitespace-nowrap">{r.date ? r.date.toLocaleString() : '—'}</td>
                      <td className="p-2 whitespace-nowrap">{r.difficulty || '—'}</td>
                      <td className="p-2 whitespace-nowrap">{Number(r.yourTime) ? `${formatTime(Number(r.yourTime))}` : '—'}</td>
                      <td className="p-2 whitespace-nowrap">{r.result}</td>
                      <td className="p-2 whitespace-nowrap">{r.prizeMicro ? `${microToStx(r.prizeMicro)} STX` : '—'}</td>
                    </tr>
                  ))}
                  {pagedRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-3 text-center text-xs">No entries yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between p-2 border-t border-zinc-200 text-xs">
              <div>Page {page} of {totalPages}</div>
              <div className="flex items-center gap-2">
                <button className={`${brutal} px-2 py-1 bg-white disabled:opacity-50`} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p-1))}>Prev</button>
                <button className={`${brutal} px-2 py-1 bg-white disabled:opacity-50`} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p+1))}>Next</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
