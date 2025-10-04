import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import useWallet from '../hooks/useWallet';
import { getApiBaseUrl, microToStx, type NetworkName } from '../lib/stacks';
import { fetchCallReadOnlyFunction, uintCV, standardPrincipalCV, ClarityType } from '@stacks/transactions';
import { getPuzzleInfo, type PuzzleInfo, getUserStats } from '../lib/contracts';
import ClaimPrizeModal from '../components/ClaimPrizeModal';
import { Crown, Filter, Hourglass, Trophy } from 'lucide-react';

const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';

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

function getContractIds(network: NetworkName) {
  const id = (network === 'testnet' ? (import.meta as any).env?.VITE_CONTRACT_TESTNET : (import.meta as any).env?.VITE_CONTRACT_MAINNET) as string | undefined;
  if (!id || typeof id !== 'string' || !id.includes('.')) throw new Error('Missing contract id env var');
  const [address, name] = id.split('.');
  return { address, name };
}

export default function MyWins() {
  const { network, getAddress, refresh } = useWallet();
  const address = getAddress() || '';
  const heightQ = useStacksHeight(network);

  const [filter, setFilter] = useState<'claimable' | 'claimed' | 'all'>('claimable');
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimData, setClaimData] = useState<{ id: number; difficulty: 'beginner'|'intermediate'|'expert'; prizePool: bigint } | null>(null);

  const entriesQ = useQuery<number[]>({
    queryKey: ['user-entries', network, address],
    enabled: !!address,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { address: contractAddress, name: contractName } = getContractIds(network);
      const cv: any = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-user-entries',
        functionArgs: [standardPrincipalCV(address)],
        senderAddress: address,
        network: (await import('../lib/stacks')).getNetwork(network),
      });
      if (cv?.type !== ClarityType.ResponseOk) return [];
      const list = cv.value;
      if (!list || !Array.isArray(list.list)) return [];
      const nums: number[] = [];
      for (const it of list.list) {
        try { nums.push(Number(it.value)); } catch {}
      }
      return nums;
    },
  });

  const winsQ = useQuery({
    queryKey: ['wins', network, address, entriesQ.data?.join(',')],
    enabled: !!address && Array.isArray(entriesQ.data),
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const ids = entriesQ.data || [];
      const out: Array<{ id: number; info: PuzzleInfo; solveTime: bigint }> = [];
      for (const id of ids) {
        try {
          const info = await getPuzzleInfo({ puzzleId: id, network });
          if ((info.winner || '').toLowerCase() !== address.toLowerCase()) continue;
          // fetch solve time
          const { address: contractAddress, name: contractName } = getContractIds(network);
          const cv: any = await fetchCallReadOnlyFunction({
            contractAddress,
            contractName,
            functionName: 'get-entry',
            functionArgs: [uintCV(id), standardPrincipalCV(address)],
            senderAddress: address,
            network: (await import('../lib/stacks')).getNetwork(network),
          });
          let st: bigint = 0n;
          if (cv?.type === ClarityType.ResponseOk && cv.value?.type === ClarityType.OptionalSome) {
            const t = cv.value.value;
            st = BigInt(t.data['solve-time']?.value ?? 0);
          }
          out.push({ id, info, solveTime: st });
        } catch {}
      }
      // sort by deadline desc
      return out.sort((a, b) => (a.info.deadline > b.info.deadline ? -1 : 1));
    },
  });

  const statsQ = useQuery({
    queryKey: ['user-stats', network, address],
    enabled: !!address,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
    queryFn: () => getUserStats({ address, network }),
  });

  const list = winsQ.data || [];
  const height = heightQ.data || 0;

  const filtered = useMemo(() => {
    return list.filter(({ info }) => {
      const claimable = Number(info.deadline) < height && Number(info.prizePool) > 0;
      if (filter === 'claimable') return claimable;
      if (filter === 'claimed') return Number(info.prizePool) === 0;
      return true;
    });
  }, [list, filter, height]);

  const totalWinnings = useMemo(() => {
    const v = statsQ.data?.totalWinnings ?? 0n;
    return microToStx(v);
  }, [statsQ.data]);

  if (!address) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-200 via-rose-200 to-blue-200 flex items-center justify-center">
        <div className={`${brutal} bg-white p-6 text-center`}>
          <div className="text-xl font-black mb-2">Connect your wallet</div>
          <div className="text-sm opacity-70">Sign in to view your wins and claim prizes.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-200 via-rose-200 to-blue-200 text-black relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <div className="text-2xl font-black">My Wins</div>
          <div className={`${brutal} bg-green-200 px-3 py-2 text-sm flex items-center gap-2`}><Crown className="h-4 w-4"/> Total Winnings: <span className="font-black">{totalWinnings} STX</span></div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button className={`${brutal} px-3 py-1 ${filter==='claimable'?'bg-black text-white':'bg-white'}`} onClick={()=>setFilter('claimable')}>Claimable</button>
          <button className={`${brutal} px-3 py-1 ${filter==='claimed'?'bg-black text-white':'bg-white'}`} onClick={()=>setFilter('claimed')}>Claimed</button>
          <button className={`${brutal} px-3 py-1 ${filter==='all'?'bg-black text-white':'bg-white'}`} onClick={()=>setFilter('all')}>All</button>
        </div>

        {winsQ.isLoading && (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${brutal} h-16 bg-gradient-to-r from-white to-zinc-100 animate-pulse`} />
            ))}
          </div>
        )}

        {!winsQ.isLoading && filtered.length === 0 && (
          <div className={`${brutal} bg-white p-6 text-center`}>Solve more puzzles to win prizes!</div>
        )}

        <div className="grid gap-3">
          {filtered.map(({ id, info, solveTime }) => {
            const isClaimed = Number(info.prizePool) === 0;
            const isReady = Number(info.prizePool) > 0 && Number(info.deadline) < height;
            const net = (BigInt(info.prizePool) * 95n) / 100n;
            const dateApprox = new Date(Date.now() - Math.max(0, (height - Number(info.deadline)) * 600 * 1000));
            const dateStr = dateApprox.toLocaleDateString();
            return (
              <motion.div key={id} className={`${brutal} bg-white/80 backdrop-blur p-3 flex items-center justify-between`}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-3">
                  <div className={`${brutal} bg-yellow-200 px-2 py-1 text-xs font-black uppercase`}>{info.difficulty}</div>
                  <div className="text-sm">Won on {dateStr}</div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-sm"><span className="font-black">Time:</span> {formatTime(solveTime)}</div>
                  <div className="text-sm"><span className="font-black">Prize:</span> {microToStx(net)} STX</div>
                  <div className={`${brutal} ${isClaimed?'bg-green-200':'bg-blue-200'} px-2 py-1 text-xs font-black`}>{isClaimed?'Claimed':'Ready to claim'}</div>
                  <button
                    className={`${brutal} px-3 py-2 ${isReady ? 'bg-black text-white hover:bg-zinc-800' : 'bg-zinc-300 text-white cursor-not-allowed'}`}
                    disabled={!isReady}
                    onClick={() => setClaimData({ id, difficulty: info.difficulty as any, prizePool: BigInt(info.prizePool) })}
                  >
                    Claim
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {claimData && (
          <ClaimPrizeModal
            open={!!claimData}
            onClose={() => setClaimData(null)}
            puzzleId={claimData.id}
            difficulty={claimData.difficulty}
            prizePoolMicro={claimData.prizePool}
            onSuccess={() => winsQ.refetch()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function formatTime(total: number | bigint) {
  const v = typeof total === 'bigint' ? Number(total) : total;
  const m = Math.floor(v / 60);
  const s = v % 60;
  return `${pad(m)}:${pad(s)}`;
}
