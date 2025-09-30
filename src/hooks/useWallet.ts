import { create } from 'zustand';
import {
  connect as stacksConnect,
  disconnect as stacksDisconnect,
  getLocalStorage,
  getSelectedProviderId,
  setSelectedProviderId,
  clearSelectedProviderId,
} from '@stacks/connect';
import { fetchStxBalance, getNetwork, type NetworkName, type StxBalance } from '../lib/stacks';

export type WalletProviderId = 'LeatherProvider' | 'XverseProviders.BitcoinProvider' | 'HiroWalletProvider';

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

function getAddressFromStorage(network: NetworkName): string | null {
  try {
    const storage = getLocalStorage();
    if (!storage?.addresses) return null;
    const networkAddresses = storage.addresses[network];
    if (!networkAddresses || networkAddresses.length === 0) return null;
    return networkAddresses[0];
  } catch {
    return null;
  }
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
      if (provider) {
        setSelectedProviderId(provider);
      }
      
      await stacksConnect();
      
      const addr = getAddressFromStorage(get().network);
      const prov = getSelectedProviderId() as WalletProviderId | null;
      
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
    try {
      clearSelectedProviderId();
    } catch {}
    set({ providerId: null, address: null, balance: null });
  },
  switchNetwork: async (network) => {
    set({ network });
    const addr = getAddressFromStorage(network);
    set({ address: addr });
    
    if (addr) {
      try {
        set({ isFetchingBalance: true });
        const balance = await fetchStxBalance(addr, network);
        set({ balance });
      } finally {
        set({ isFetchingBalance: false });
      }
    } else {
      set({ balance: null });
    }
  },
  refresh: async () => {
    const addr = getAddressFromStorage(get().network);
    if (addr) {
      set({ address: addr });
      try {
        const balance = await fetchStxBalance(addr, get().network);
        set({ balance });
      } catch {}
    }
  },
}));

export default useWallet;
