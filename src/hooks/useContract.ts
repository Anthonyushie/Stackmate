import { useMutation, useQuery } from '@tanstack/react-query';
import { enterPuzzle, submitSolution, claimPrize, getPuzzleInfo, getLeaderboard, getUserStats, type TxStatus } from '../lib/contracts';
import useWallet from './useWallet';

export function useEnterPuzzle() {
  const { network, getAddress } = useWallet();
  return useMutation({
    mutationFn: async ({ puzzleId, entryFee, onStatus }: { puzzleId: number | bigint; entryFee: bigint | number | string; onStatus?: (s: TxStatus, d?: any) => void }) => {
      return enterPuzzle({ puzzleId, entryFee, sender: getAddress() || undefined, network, onStatus });
    },
  });
}

export function useSubmitSolution() {
  const { network, getAddress } = useWallet();
  return useMutation({
    mutationFn: async ({ puzzleId, solution, solveTime, onStatus }: { puzzleId: number | bigint; solution: string | Uint8Array; solveTime: number | bigint; onStatus?: (s: TxStatus, d?: any) => void }) => {
      return submitSolution({ puzzleId, solution, solveTime, sender: getAddress() || undefined, network, onStatus });
    },
  });
}

export function useClaimPrize() {
  const { network, getAddress } = useWallet();
  return useMutation({
    mutationFn: async ({ puzzleId, onStatus }: { puzzleId: number | bigint; onStatus?: (s: TxStatus, d?: any) => void }) => {
      return claimPrize({ puzzleId, sender: getAddress() || undefined, network, onStatus });
    },
  });
}

export function usePuzzleInfo(puzzleId: number | bigint, enabled = true) {
  const { network } = useWallet();
  return useQuery({
    queryKey: ['puzzle-info', network, String(puzzleId)],
    queryFn: () => getPuzzleInfo({ puzzleId, network }),
    enabled: enabled && puzzleId !== undefined && puzzleId !== null,
  });
}

export function useLeaderboard(puzzleId: number | bigint, enabled = true) {
  const { network } = useWallet();
  return useQuery({
    queryKey: ['leaderboard', network, String(puzzleId)],
    queryFn: () => getLeaderboard({ puzzleId, network }),
    enabled: enabled && puzzleId !== undefined && puzzleId !== null,
  });
}

export function useUserStats(address?: string, enabled = true) {
  const { network, getAddress } = useWallet();
  const addr = address || getAddress() || '';
  return useQuery({
    queryKey: ['user-stats', network, addr],
    queryFn: () => getUserStats({ address: addr, network }),
    enabled: enabled && !!addr,
  });
}
