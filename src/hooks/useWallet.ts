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
    console.log('[useWallet] Full localStorage:', JSON.stringify(storage, null, 2));
    
    if (!storage?.addresses) {
      console.warn('[useWallet] No addresses in storage');
      return null;
    }
    
    console.log('[useWallet] Available networks:', Object.keys(storage.addresses));
    
    const networkAddresses = storage.addresses[network];
    console.log(`[useWallet] ${network} addresses:`, networkAddresses);
    
    if (!networkAddresses || networkAddresses.length === 0) {
      console.warn(`[useWallet] No ${network} address found`);
      console.log('[useWallet] Trying mainnet instead...');
      const mainnetAddresses = storage.addresses['mainnet'];
      if (mainnetAddresses && mainnetAddresses.length > 0) {
        console.log('[useWallet] Found mainnet address:', mainnetAddresses[0]);
        return mainnetAddresses[0];
      }
      return null;
    }
    
    return networkAddresses[0];
  } catch (e) {
    console.error('[useWallet] Error reading storage:', e);
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
      console.log('[useWallet] Starting connection with provider:', provider);
      
      if (provider) {
        console.log('[useWallet] Setting provider ID:', provider);
        setSelectedProviderId(provider);
      }
      
      console.log('[useWallet] Calling stacksConnect()...');
      const result = await stacksConnect();
      console.log('[useWallet] stacksConnect result:', result);
      
      const addr = getAddressFromStorage(get().network);
      const prov = getSelectedProviderId() as WalletProviderId | null;
      
      console.log('[useWallet] Retrieved address:', addr);
      console.log('[useWallet] Retrieved provider:', prov);
      
      set({ address: addr, providerId: prov });
      
      if (addr) {
        console.log('[useWallet] Fetching balance...');
        const balance = await fetchStxBalance(addr, get().network);
        console.log('[useWallet] Balance:', balance);
        set({ balance });
      } else {
        console.warn('[useWallet] No address found after connection');
        set({ error: 'Connected but no address found. Try disconnecting and reconnecting.' });
      }
    } catch (e: any) {
      console.error('[useWallet] Connection error:', e);
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
