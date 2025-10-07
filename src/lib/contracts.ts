import { fetchCallReadOnlyFunction, ClarityType, cvToJSON, hexToCV, standardPrincipalCV, uintCV, bufferCV, cvToHex, Pc, postConditionToHex } from '@stacks/transactions';
import type { StacksNetwork } from '@stacks/network';
import { getNetwork, getApiBaseUrl, type NetworkName } from './stacks';
import { txManager } from '../hooks/useTransaction';

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
  const DEFAULT_TESTNET = 'ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469.puzzle-pool';
  let id = network === 'testnet' ? (import.meta as any).env?.VITE_CONTRACT_TESTNET : (import.meta as any).env?.VITE_CONTRACT_MAINNET;
  if (!id || typeof id !== 'string' || !id.includes('.')) {
    if (network === 'testnet') id = DEFAULT_TESTNET;
  }
  if (!id || typeof id !== 'string' || !id.includes('.')) throw new Error('Missing contract id env var (VITE_CONTRACT_TESTNET/VITE_CONTRACT_MAINNET) like SPXXXX.puzzle-pool');
  const [address, name] = id.split('.');
  return { address, name };
};

const getProvider = (): any | null => {
  const w: any = globalThis as any;
  // Prefer LeatherProvider (newer API), then fall back
  return w?.LeatherProvider || w?.StacksProvider || w?.HiroWalletProvider || w?.XverseProviders?.BitcoinProvider || null;
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
          txManager.success(txId);
          onStatus?.('success', { txId });
          return 'success';
        }
        if (status === 'abort_by_post_condition' || status === 'failed') {
          txManager.failed(txId, j.error || j.tx_result);
          onStatus?.('failed', { txId, reason: j.error || j.tx_result });
          return 'failed';
        }
        txManager.confirming(txId);
        onStatus?.('pending', { txId, status });
      }
    } catch {}
    tries += 1;
    await new Promise(r => setTimeout(r, Math.min(6000, 1000 + tries * 300)));
  }
};

const requestContractCall = async (params: any): Promise<{ txId?: string; error?: string }> => {
  const provider = getProvider();
  console.log('[requestContractCall] Provider found:', provider ? 'YES' : 'NO', provider?.constructor?.name);
  if (!provider?.request) return { error: 'No wallet provider available' };

  // Normalize arguments for wallet RPCs
  const normalizePostConditionMode = (mode: any): 'allow' | 'deny' => {
    if (typeof mode === 'string') return mode.toLowerCase() === 'allow' ? 'allow' : 'deny';
    // 1 = allow, 2 = deny in legacy enums
    return mode === 1 ? 'allow' : 'deny';
  };
  const normalizePostConditions = (pcs: any[]): string[] => {
    if (!Array.isArray(pcs)) return [];
    return pcs.map((pc: any) => {
      if (typeof pc === 'string') return pc.startsWith('0x') ? pc : `0x${pc}`;
      try {
        const hex = postConditionToHex(pc);
        return hex.startsWith('0x') ? hex : `0x${hex}`;
      } catch {
        // Fall back to JSON string for debugging if conversion fails
        return JSON.stringify(pc);
      }
    });
  };

  const buildParamsFor = (method: string) => {
    const base = {
      contract: `${params.contractAddress}.${params.contractName}`,
      functionName: params.functionName,
      functionArgs: params.functionArgs,
      network: params.network,
      anchorMode: params.anchorMode,
    } as any;

    if (method === 'openContractCall' || method === 'contract_call') {
      return {
        ...base,
        postConditionMode: normalizePostConditionMode(params.postConditionMode),
        postConditions: params.postConditions || [], // pass typed objects for openContractCall
      };
    }

    return {
      ...base,
      postConditionMode: normalizePostConditionMode(params.postConditionMode),
      postConditions: normalizePostConditions(params.postConditions || []), // hex strings for stx_* methods
    };
  };

  async function tryCall(method: string, style: 'two-arg' | 'object'): Promise<{ txId?: string; error?: string } | null> {
    try {
      console.log(`[requestContractCall] Trying ${method} (${style})...`);
      const callParams = buildParamsFor(method);
      console.log(`[requestContractCall] Calling ${method} with params:`, JSON.stringify(callParams, null, 2));
      let res: any;
      if (style === 'two-arg') {
        res = await provider.request(method, callParams);
      } else {
        res = await provider.request({ method, params: callParams });
      }
      console.log(`[requestContractCall] ${method} (${style}) response:`, res);
      
      // Check for JSON-RPC error format
      if (res?.error) {
        console.error(`[requestContractCall] ${method} (${style}) JSON-RPC error:`, res.error);
        const errorMsg = res.error?.message || res.error?.data || JSON.stringify(res.error);
        if (errorMsg?.toLowerCase?.().includes('user') && errorMsg?.toLowerCase?.().includes('cancel')) {
          return { error: 'User canceled' };
        }
        // Don't return error yet, let it continue to try other methods
        return null;
      }
      
      const txId = res?.txId || res?.txid || res?.tx_id || res?.result?.txid || res?.result?.txId || (typeof res === 'string' ? res : null);
      if (txId && String(txId).length > 10) {
        console.log(`[requestContractCall] SUCCESS with ${method} (${style}), txId:`, txId);
        return { txId };
      }
    } catch (e: any) {
      console.warn(`[requestContractCall] ${method} (${style}) caught exception:`, e);
      const msg = e?.message || e?.error?.message || '';
      if (msg?.toLowerCase?.().includes('user') && msg?.toLowerCase?.().includes('cancel')) return { error: 'User canceled' };
    }
    return null;
  }

  const attempts: Array<[string, 'two-arg' | 'object']> = [
    ['stx_callContract', 'two-arg'],
    ['stx_callContract', 'object'],
    ['stx_contractCall', 'object'],
    ['stx_makeContractCall', 'object'],
    ['contract_call', 'object'],
    ['openContractCall', 'object'],
  ];

  for (const [m, style] of attempts) {
    const r = await tryCall(m, style);
    if (r) return r;
  }

  console.error('[requestContractCall] All methods failed. No wallet response.');
  return { error: 'Wallet request failed' };
};

export async function enterPuzzle({ puzzleId, entryFee, sender, network, onStatus }: EnterPuzzleParams) {
  const { address: contractAddress, name: contractName } = getContractIds(network);
  const senderAddress = await pickSender(network, sender);
  if (!senderAddress) return { ok: false, error: 'No sender address' };
  
  const entryAmount = BigInt(entryFee);
  const pc = Pc.principal(senderAddress).willSendEq(entryAmount).ustx();
  
  const args = [uintCV(typeof puzzleId === 'bigint' ? puzzleId : BigInt(puzzleId))];
  const req = {
    contractAddress,
    contractName,
    functionName: 'enter-puzzle',
    functionArgs: args.map(toHexArg),
    postConditionMode: 'deny',
    postConditions: [pc],
    network: network,
    anchorMode: 'any',
  };
  try {
    txManager.open('enter-puzzle', network);
    onStatus?.('requesting_signature');
    const r = await requestContractCall(req);
    if (r.error) return { ok: false, error: r.error };
    const txId = r.txId!;
    txManager.submitted(txId, network, 'enter-puzzle');
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
    txManager.open('submit-solution', network);
    onStatus?.('requesting_signature');
    const r = await requestContractCall(req);
    if (r.error) return { ok: false, error: r.error };
    const txId = r.txId!;
    txManager.submitted(txId, network, 'submit-solution');
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
    txManager.open('claim-prize', network);
    onStatus?.('requesting_signature');
    const r = await requestContractCall(req);
    if (r.error) return { ok: false, error: r.error };
    const txId = r.txId!;
    txManager.submitted(txId, network, 'claim-prize');
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
  const url = `${base}/extended/v1/address/${principal}/transactions?limit=50`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    let items = Array.isArray(data.results) ? data.results : [];
  const PAGE_LIMIT = 50;
  let offset = items.length;
  for (;;) {
    if (items.length < PAGE_LIMIT) break;
    const pageUrl = `${base}/extended/v1/address/${principal}/transactions?limit=${PAGE_LIMIT}&offset=${offset}`;
    const res2 = await fetch(pageUrl);
    if (!res2.ok) break;
    const data2 = await res2.json();
    const next = Array.isArray(data2.results) ? data2.results : [];
    if (!next.length) break;
    items = items.concat(next);
    if (next.length < PAGE_LIMIT) break;
    offset += next.length;
  }
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
