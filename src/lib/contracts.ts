import { fetchCallReadOnlyFunction, ClarityType, cvToJSON, hexToCV, standardPrincipalCV, uintCV, bufferCV, cvToHex } from '@stacks/transactions';
import type { StacksNetwork } from '@stacks/network';
import { getNetwork, getApiBaseUrl, type NetworkName } from './stacks';

export type TxStatus = 'idle' | 'requesting_signature' | 'submitted' | 'pending' | 'success' | 'failed';

export interface ContractIds { address: string; name: string }

export type OnStatus = (status: TxStatus, data?: any) => void;

export interface EnterPuzzleParams { puzzleId: number | bigint; entryFee: bigint | number | string; sender?: string; network: NetworkName; onStatus?: OnStatus }
export interface SubmitSolutionParams { puzzleId: number | bigint; solution: string | Uint8Array; solveTime: number | bigint; sender?: string; network: NetworkName; onStatus?: OnStatus }
export interface ClaimPrizeParams { puzzleId: number | bigint; sender?: string; network: NetworkName; onStatus?: OnStatus }

export interface ReadPuzzleInfoParams { puzzleId: number | bigint; network: NetworkName }
export interface ReadLeaderboardParams { puzzleId: number | bigint; network: NetworkName }
export interface ReadUserStatsParams { address: string; network: NetworkName }

export interface PuzzleInfo {
  difficulty: string;
  prizePool: bigint;
  solutionHash: string;
  deadline: bigint;
  winner: string | null;
  isActive: boolean;
  entryCount: bigint;
  stakeAmount: bigint;
}

export interface LeaderboardEntry { player: string; solveTime: bigint; isCorrect: boolean; timestamp?: bigint; txId?: string }

const getContractIds = (network: NetworkName): ContractIds => {
  const id = network === 'testnet' ? (import.meta as any).env?.VITE_CONTRACT_TESTNET : (import.meta as any).env?.VITE_CONTRACT_MAINNET;
  if (!id || typeof id !== 'string' || !id.includes('.')) throw new Error('Missing contract id env var (VITE_CONTRACT_TESTNET/VITE_CONTRACT_MAINNET) like SPXXXX.puzzle-pool');
  const [address, name] = id.split('.');
  return { address, name };
};

const getProvider = (): any | null => {
  const w: any = globalThis as any;
  return w?.StacksProvider || w?.HiroWalletProvider || w?.LeatherProvider || w?.XverseProviders?.BitcoinProvider || null;
};

const toHexArg = (cv: any) => cvToHex(cv);

const pickSender = async (network: NetworkName, hint?: string): Promise<string | null> => {
  if (hint && typeof hint === 'string') return hint;
  try {
    const p = getProvider();
    if (p?.getAddresses) {
      const res = await p.getAddresses();
      const addrs: string[] = [];
      if (Array.isArray(res?.addresses?.stx)) addrs.push(...res.addresses.stx.map((x: any) => x?.address).filter((x: any) => typeof x === 'string'));
      if (Array.isArray(addrs) && addrs.length) {
        const prefix = network === 'testnet' ? 'ST' : 'SP';
        const best = addrs.find(a => a?.toUpperCase().startsWith(prefix)) || addrs[0];
        return best || null;
      }
    }
  } catch {}
  return null;
};

const pollTx = async (txId: string, network: NetworkName, onStatus?: OnStatus): Promise<'success' | 'failed'> => {
  const base = getApiBaseUrl(network);
  const url = `${base}/extended/v1/tx/${txId}`;
  let tries = 0;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const j = await res.json();
        const status = j.tx_status as string;
        if (status === 'success') {
          onStatus?.('success', { txId });
          return 'success';
        }
        if (status === 'abort_by_post_condition' || status === 'failed') {
          onStatus?.('failed', { txId, reason: j.error || j.tx_result });
          return 'failed';
        }
        onStatus?.('pending', { txId, status });
      }
    } catch {}
    tries += 1;
    await new Promise(r => setTimeout(r, Math.min(6000, 1000 + tries * 300)));
  }
};

const requestContractCall = async (params: any): Promise<{ txId?: string; error?: string }> => {
  const provider = getProvider();
  if (!provider?.request) return { error: 'No wallet provider available' };
  const methods = ['stx_makeContractCall', 'stx_contractCall', 'contract_call', 'openContractCall'];
  for (const m of methods) {
    try {
      const res = await provider.request({ method: m, params });
      if (res?.txId || res?.txid || res?.tx_id) return { txId: res.txId || res.txid || res.tx_id };
      if (typeof res === 'string' && res.length > 10) return { txId: res };
    } catch (e: any) {
      if (e?.message?.includes('User canceled')) return { error: 'User canceled' };
    }
  }
  return { error: 'Wallet request failed' };
};

export async function enterPuzzle({ puzzleId, entryFee, sender, network, onStatus }: EnterPuzzleParams) {
  const { address: contractAddress, name: contractName } = getContractIds(network);
  const senderAddress = await pickSender(network, sender);
  if (!senderAddress) return { ok: false, error: 'No sender address' };
  const pc = [{ type: 'stx', principal: senderAddress, conditionCode: 'eq', amount: BigInt(entryFee).toString() }];
  const args = [uintCV(typeof puzzleId === 'bigint' ? puzzleId : BigInt(puzzleId))];
  const req = {
    contractAddress,
    contractName,
    functionName: 'enter-puzzle',
    functionArgs: args.map(toHexArg),
    postConditionMode: 'deny',
    postConditions: pc,
    network: network,
    anchorMode: 'any',
  };
  try {
    onStatus?.('requesting_signature');
    const r = await requestContractCall(req);
    if (r.error) return { ok: false, error: r.error };
    const txId = r.txId!;
    onStatus?.('submitted', { txId });
    const f = await pollTx(txId, network, onStatus);
    return { ok: f === 'success', txId };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'enterPuzzle failed' };
  }
}

export async function submitSolution({ puzzleId, solution, solveTime, sender, network, onStatus }: SubmitSolutionParams) {
  const { address: contractAddress, name: contractName } = getContractIds(network);
  const senderAddress = await pickSender(network, sender);
  if (!senderAddress) return { ok: false, error: 'No sender address' };
  const buf = typeof solution === 'string' ? (solution.startsWith('0x') ? solution.slice(2) : solution) : Buffer.from(solution).toString('hex');
  const args = [
    uintCV(typeof puzzleId === 'bigint' ? puzzleId : BigInt(puzzleId)),
    bufferCV(Buffer.from(buf, 'hex')),
    uintCV(typeof solveTime === 'bigint' ? solveTime : BigInt(solveTime)),
  ];
  const req = {
    contractAddress,
    contractName,
    functionName: 'submit-solution',
    functionArgs: args.map(toHexArg),
    postConditionMode: 'deny',
    postConditions: [],
    network: network,
    anchorMode: 'any',
  };
  try {
    onStatus?.('requesting_signature');
    const r = await requestContractCall(req);
    if (r.error) return { ok: false, error: r.error };
    const txId = r.txId!;
    onStatus?.('submitted', { txId });
    const f = await pollTx(txId, network, onStatus);
    return { ok: f === 'success', txId };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'submitSolution failed' };
  }
}

export async function claimPrize({ puzzleId, sender, network, onStatus }: ClaimPrizeParams) {
  const { address: contractAddress, name: contractName } = getContractIds(network);
  const senderAddress = await pickSender(network, sender);
  if (!senderAddress) return { ok: false, error: 'No sender address' };
  const args = [uintCV(typeof puzzleId === 'bigint' ? puzzleId : BigInt(puzzleId))];
  const req = {
    contractAddress,
    contractName,
    functionName: 'claim-prize',
    functionArgs: args.map(toHexArg),
    postConditionMode: 'deny',
    postConditions: [],
    network: network,
    anchorMode: 'any',
  };
  try {
    onStatus?.('requesting_signature');
    const r = await requestContractCall(req);
    if (r.error) return { ok: false, error: r.error };
    const txId = r.txId!;
    onStatus?.('submitted', { txId });
    const f = await pollTx(txId, network, onStatus);
    return { ok: f === 'success', txId };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'claimPrize failed' };
  }
}

const resultOk = (cv: any) => cv?.type === ClarityType.ResponseOk ? (cv as any).value : null;

export async function getPuzzleInfo({ puzzleId, network }: ReadPuzzleInfoParams): Promise<PuzzleInfo> {
  const { address: contractAddress, name: contractName } = getContractIds(network);
  const senderAddress = (await pickSender(network)) || contractAddress;
  const stxNetwork: StacksNetwork = getNetwork(network);
  const cv = await fetchCallReadOnlyFunction({
    contractAddress,
    contractName,
    functionName: 'get-puzzle-info',
    functionArgs: [uintCV(typeof puzzleId === 'bigint' ? puzzleId : BigInt(puzzleId))],
    senderAddress,
    network: stxNetwork,
  });
  const v: any = resultOk(cv);
  if (!v) throw new Error('Puzzle not found');
  const j: any = cvToJSON(v);
  const getNum = (x: any) => BigInt(x?.value ?? x);
  return {
    difficulty: j.value?.difficulty?.value ?? '',
    prizePool: getNum(j.value?.['prize-pool']),
    solutionHash: (j.value?.['solution-hash']?.value as string) ?? '',
    deadline: getNum(j.value?.deadline),
    winner: j.value?.winner?.value?.value ?? null,
    isActive: Boolean(j.value?.['is-active']?.value),
    entryCount: getNum(j.value?.['entry-count']),
    stakeAmount: getNum(j.value?.['stake-amount']),
  };
}

export async function getUserStats({ address, network }: ReadUserStatsParams) {
  const { address: contractAddress, name: contractName } = getContractIds(network);
  const stxNetwork: StacksNetwork = getNetwork(network);
  const senderAddress = (await pickSender(network)) || contractAddress;
  const cv = await fetchCallReadOnlyFunction({
    contractAddress,
    contractName,
    functionName: 'get-user-stats',
    functionArgs: [standardPrincipalCV(address)],
    senderAddress,
    network: stxNetwork,
  });
  const v: any = resultOk(cv);
  if (!v) throw new Error('No stats');
  const j: any = cvToJSON(v);
  const toBig = (x: any) => BigInt(x?.value ?? x);
  return {
    totalEntries: toBig(j.value?.['total-entries']),
    totalWins: toBig(j.value?.['total-wins']),
    totalWinnings: toBig(j.value?.['total-winnings']),
  } as { totalEntries: bigint; totalWins: bigint; totalWinnings: bigint };
}

export async function getLeaderboard({ puzzleId, network }: ReadLeaderboardParams): Promise<LeaderboardEntry[]> {
  const { address: contractAddress, name: contractName } = getContractIds(network);
  const base = getApiBaseUrl(network);
  const principal = contractAddress;
  const url = `${base}/extended/v1/address/${principal}/transactions?limit=200`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data.results) ? data.results : [];
    const out: LeaderboardEntry[] = [];
    for (const tx of items) {
      if (tx?.tx_type !== 'contract_call') continue;
      if (tx?.contract_call?.contract_id !== `${contractAddress}.${contractName}`) continue;
      if (tx?.contract_call?.function_name !== 'submit-solution') continue;
      const args = tx?.contract_call?.function_args || [];
      try {
        const pidCv = hexToCV(args[0]?.hex || args[0]?.repr || '');
        const solveCv = hexToCV(args[2]?.hex || args[2]?.repr || '');
        const ok = tx?.tx_result?.repr?.includes('true');
        const pid = (pidCv as any)?.value as bigint;
        if (typeof pid === 'bigint' && pid === (typeof puzzleId === 'bigint' ? puzzleId : BigInt(puzzleId))) {
          const st = (solveCv as any)?.value as bigint;
          out.push({ player: tx?.sender_address, solveTime: st ?? 0n, isCorrect: Boolean(ok), timestamp: BigInt(tx?.burn_block_time ?? 0), txId: tx?.tx_id });
        }
      } catch {}
    }
    return out.filter(x => x.isCorrect).sort((a, b) => (a.solveTime < b.solveTime ? -1 : a.solveTime > b.solveTime ? 1 : 0));
  } catch {
    return [];
  }
}
