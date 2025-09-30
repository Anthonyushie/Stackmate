import { create } from 'zustand';
import {
  connect as stacksConnect,
  disconnect as stacksDisconnect,
  isConnected as stacksIsConnected,
  getStxAddress,
  getSelectedProviderId,
  setSelectedProviderId,
  clearSelectedProviderId,
  getStacksProvider,
} from '@stacks/connect';
import { fetchStxBalance, getNetwork, type NetworkName, type StxBalance } from '../lib/stacks';

export type WalletProviderId = 'Hiro' | 'Xverse' | 'Leather';

export interface WalletState {
  network: NetworkName;
  providerId: WalletProviderId | null;
  address: string | null;
  balance: StxBalance | null;
  isConnecting: boolean;
  isFetchingBalance: boolean;
  error: string | null;
  connect: (provider?: WalletProviderId) => Promise<void>;
  disconnect: () => Promise<void>;
  switchNetwork: (network: NetworkName) => Promise<void>;
  refresh: () => Promise<void>;
  getAddress: () => string | null;
}

async function resolveAddress(): Promise<string | null> {
  try {
    const addr = await getStxAddress();
    if (addr) return addr;
  } catch {}
  try {
    const provider: any = (await getStacksProvider?.()) ?? null;
    if (provider?.request) {
      const res: any = await provider.request('stx_getAddresses');
      const first = res?.addresses?.[0]?.address ?? res?.[0]?.address;
      if (first) return first as string;
    }
  } catch {}
  return null;
}

export const useWallet = create<WalletState>((set, get) => ({
  network: 'testnet',
  providerId: null,
  address: null,
  balance: null,
  isConnecting: false,
  isFetchingBalance: false,
  error: null,
  getAddress: () => get().address,
  connect: async (provider) => {
    set({ isConnecting: true, error: null });
    try {
      if (provider) setSelectedProviderId(provider);
      getNetwork(get().network);
      await stacksConnect({ network: get().network as any });
      const addr = await resolveAddress();
      const prov = (await getSelectedProviderId?.()) as WalletProviderId | null;
      set({ address: addr, providerId: prov });
      if (addr) {
        const balance = await fetchStxBalance(addr, get().network);
        set({ balance });
      }
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to connect wallet' });
    } finally {
      set({ isConnecting: false });
    }
  },
  disconnect: async () => {
    try {
      await stacksDisconnect();
    } catch {}
    try { clearSelectedProviderId?.(); } catch {}
    set({ providerId: null, address: null, balance: null });
  },
  switchNetwork: async (network) => {
    set({ network });
    const addr = get().address;
    if (addr) {
      try {
        set({ isFetchingBalance: true });
        const balance = await fetchStxBalance(addr, network);
        set({ balance });
      } finally {
        set({ isFetchingBalance: false });
      }
    }
  },
  refresh: async () => {
    const connected = await stacksIsConnected().catch(() => false);
    if (!connected) return;
    const addr = await resolveAddress();
    if (addr) {
      set({ address: addr });
      const balance = await fetchStxBalance(addr, get().network);
      set({ balance });
    }
  },
}));

export default useWallet;
