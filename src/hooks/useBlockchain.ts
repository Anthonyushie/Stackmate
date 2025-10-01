import { useQuery } from '@tanstack/react-query';
import { getPuzzleInfo as rpcGetPuzzleInfo, getLeaderboard as rpcGetLeaderboard, getUserStats as rpcGetUserStats, type PuzzleInfo, type LeaderboardEntry } from '../lib/contracts';
import { fetchCallReadOnlyFunction, uintCV, ClarityType, standardPrincipalCV } from '@stacks/transactions';
import { getNetwork, type NetworkName, fetchStxBalance, type StxBalance } from '../lib/stacks';
import useWallet from './useWallet';

function getContractIds(network: NetworkName) {
  const id = network === 'testnet' ? (import.meta as any).env?.VITE_CONTRACT_TESTNET : (import.meta as any).env?.VITE_CONTRACT_MAINNET;
  if (!id || typeof id !== 'string' || !id.includes('.')) throw new Error('Missing contract id env var');
  const [address, name] = id.split('.');
  return { address, name };
}

export function usePuzzleInfo(puzzleId?: number | bigint, enabled = true) {
  const { network } = useWallet();
  return useQuery<PuzzleInfo>({
    queryKey: ['puzzle-info', network, String(puzzleId ?? '')],
    queryFn: async () => {
      if (puzzleId === undefined || puzzleId === null) throw new Error('Missing puzzleId');
      return rpcGetPuzzleInfo({ puzzleId: puzzleId!, network });
    },
    enabled: enabled && puzzleId !== undefined && puzzleId !== null,
    refetchInterval: 10000,
    refetchOnWindowFocus: false,
  });
}

export function useLeaderboard(puzzleId?: number | bigint, enabled = true) {
  const { network } = useWallet();
  return useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', network, String(puzzleId ?? '')],
    queryFn: async () => {
      if (puzzleId === undefined || puzzleId === null) throw new Error('Missing puzzleId');
      const list = await rpcGetLeaderboard({ puzzleId: puzzleId!, network });
      return [...list].sort((a, b) => (a.solveTime < b.solveTime ? -1 : a.solveTime > b.solveTime ? 1 : 0));
    },
    enabled: enabled && puzzleId !== undefined && puzzleId !== null,
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });
}

export function useUserStats(address?: string, enabled = true) {
  const { network, getAddress } = useWallet();
  const addr = address || getAddress() || '';
  return useQuery<{ totalEntries: bigint; totalWins: bigint; totalWinnings: bigint }>({
    queryKey: ['user-stats', network, addr],
    queryFn: () => rpcGetUserStats({ address: addr, network }),
    enabled: enabled && !!addr,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });
}

async function fetchActivePuzzlesInternal(network: NetworkName, senderAddress?: string): Promise<number[]> {
  const { address: contractAddress, name: contractName } = getContractIds(network);
  const stxNetwork = getNetwork(network);
  const sender = senderAddress || contractAddress;
  const countCv = await fetchCallReadOnlyFunction({
    contractAddress,
    contractName,
    functionName: 'get-puzzle-count',
    functionArgs: [],
    senderAddress: sender,
    network: stxNetwork,
  });
  const ok = countCv.type === ClarityType.ResponseOk ? (countCv as any).value : null;
  const total = ok ? (ok as any).value as bigint : 0n;
  if (total <= 0n) return [];
  const ids: number[] = [];
  const max = Number(total);
  for (let i = 1; i <= max; i++) {
    try {
      const cv = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'is-puzzle-active',
        functionArgs: [uintCV(i)],
        senderAddress: sender,
        network: stxNetwork,
      });
      const v = cv.type === ClarityType.ResponseOk ? (cv as any).value : null;
      const active = v ? Boolean((v as any).value) : false;
      if (active) ids.push(i);
    } catch {}
  }
  return ids;
}

export function useActivePuzzles() {
  const { network, getAddress } = useWallet();
  return useQuery<number[]>({
    queryKey: ['active-puzzles', network],
    queryFn: () => fetchActivePuzzlesInternal(network, getAddress() || undefined),
    refetchInterval: 20000,
    refetchOnWindowFocus: false,
  });
}

export function useUserBalance(address?: string) {
  const { network, getAddress } = useWallet();
  const addr = address || getAddress() || '';
  return useQuery<StxBalance>({
    queryKey: ['stx-balance', network, addr],
    queryFn: async () => {
      if (!addr) throw new Error('Missing address');
      return fetchStxBalance(addr, network);
    },
    enabled: !!addr,
    refetchInterval: 10000,
    refetchOnWindowFocus: false,
  });
}
