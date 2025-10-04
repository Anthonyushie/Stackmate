import { create } from 'zustand';
import { getApiBaseUrl, type NetworkName } from '../lib/stacks';

export type TxVisibleStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

export interface TxRecord {
  id: string;
  txId?: string;
  label?: string;
  status: TxVisibleStatus;
  network: NetworkName;
  url?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface TxStore {
  items: TxRecord[];
  upsert: (r: TxRecord) => void;
  update: (idOrTx: string, patch: Partial<TxRecord>) => void;
  remove: (idOrTx: string) => void;
  reset: () => void;
}

const LS_KEY = 'stackmate:tx:recent';

function loadRecent(): TxRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 10);
  } catch {
    return [];
  }
}

function saveRecent(items: TxRecord[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, 10)));
  } catch {}
}

export const useTxStore = create<TxStore>((set, get) => ({
  items: [],
  upsert: (r) => set((s) => {
    const next = [r, ...s.items.filter(x => x.id !== r.id && x.txId !== r.txId)];
    saveRecent(next);
    return { items: next };
  }),
  update: (idOrTx, patch) => set((s) => {
    const next = s.items.map((it) => (it.id === idOrTx || it.txId === idOrTx ? { ...it, ...patch, updatedAt: Date.now() } : it));
    saveRecent(next);
    return { items: next };
  }),
  remove: (idOrTx) => set((s) => {
    const next = s.items.filter((it) => it.id !== idOrTx && it.txId !== idOrTx);
    saveRecent(next);
    return { items: next };
  }),
  reset: () => set({ items: [] }),
}));

function explorerBase(network: NetworkName) {
  return network === 'testnet' ? 'https://explorer.hiro.so/testnet' : 'https://explorer.hiro.so';
}

export function explorerTxUrl(network: NetworkName, txId?: string | null) {
  if (!txId) return '';
  return `${explorerBase(network)}/txid/${txId}?chain=stacks`;
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

export interface SendTxOptions {
  label?: string;
  network: NetworkName;
  run: () => Promise<{ txId?: string } | string>;
  onStatus?: (s: TxVisibleStatus, d?: any) => void;
}

export async function pollTransaction(txId: string, network: NetworkName, onStatus?: (s: TxVisibleStatus, d?: any) => void) {
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
          onStatus?.('error', { txId, reason: j.error || j.tx_result });
          return 'error';
        }
        onStatus?.('confirming', { txId, status });
      }
    } catch {}
    tries += 1;
    await new Promise(r => setTimeout(r, Math.min(6000, 1000 + tries * 300)));
  }
}

export async function sendTransaction({ label, network, run, onStatus }: SendTxOptions) {
  const id = makeId();
  useTxStore.getState().upsert({ id, label, status: 'pending', network, createdAt: Date.now(), updatedAt: Date.now() });
  onStatus?.('pending');
  try {
    const r = await run();
    const txId = typeof r === 'string' ? r : r?.txId;
    if (txId) {
      useTxStore.getState().update(id, { txId, status: 'confirming', url: explorerTxUrl(network, txId) });
      onStatus?.('confirming', { txId });
      const f = await pollTransaction(txId, network, (s, d) => {
        if (s === 'confirming') useTxStore.getState().update(id, { status: 'confirming' });
        if (s === 'success') useTxStore.getState().update(id, { status: 'success' });
        if (s === 'error') useTxStore.getState().update(id, { status: 'error', error: d?.reason });
        onStatus?.(s, d);
      });
      return { ok: f === 'success', txId };
    } else {
      useTxStore.getState().update(id, { status: 'error', error: 'No txId returned' });
      onStatus?.('error', { reason: 'No txId returned' });
      return { ok: false };
    }
  } catch (e: any) {
    useTxStore.getState().update(id, { status: 'error', error: e?.message || 'Transaction failed' });
    onStatus?.('error', { reason: e?.message });
    return { ok: false };
  }
}

export function resetTransaction(idOrTx: string) {
  useTxStore.getState().remove(idOrTx);
}

// Non-React manager so lib code can hook into updates
export const txManager = {
  open(label: string, network: NetworkName) {
    const id = makeId();
    useTxStore.getState().upsert({ id, label, status: 'pending', network, createdAt: Date.now(), updatedAt: Date.now() });
    return id;
  },
  submitted(txId: string, network: NetworkName, label?: string) {
    const rec: TxRecord = {
      id: txId,
      txId,
      label: label || 'contract-call',
      status: 'confirming',
      network,
      url: explorerTxUrl(network, txId),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    useTxStore.getState().upsert(rec);
  },
  confirming(txId: string) {
    useTxStore.getState().update(txId, { status: 'confirming' });
  },
  success(txId: string) {
    useTxStore.getState().update(txId, { status: 'success' });
  },
  failed(txId: string, reason?: string) {
    useTxStore.getState().update(txId, { status: 'error', error: reason });
  },
  dismiss(idOrTx: string) {
    useTxStore.getState().remove(idOrTx);
  },
};

export function useTransaction() {
  const items = useTxStore((s) => s.items);
  const active = items.find((x) => x.status === 'pending' || x.status === 'confirming');
  return {
    items,
    active,
    sendTransaction,
    resetTransaction,
  };
}
