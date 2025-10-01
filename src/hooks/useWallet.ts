import { create } from 'zustand';
import {
  connect as stacksConnect,
  disconnect as stacksDisconnect,
  getLocalStorage,
  getSelectedProviderId,
  setSelectedProviderId,
  clearSelectedProviderId,
} from '@stacks/connect';
import { fetchStxBalance, type NetworkName, type StxBalance } from '../lib/stacks';

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

const STACKS_ADDR_REGEX = /^(SP|ST)[A-Z0-9]{20,}$/i;

function isValidAddress(addr: any): addr is string {
  return typeof addr === 'string' && addr.length > 0 && STACKS_ADDR_REGEX.test(addr);
}

function pickAddressForNetwork(addresses: string[], network: NetworkName): string | null {
  const norm = addresses.filter((a) => isValidAddress(a));
  if (!norm.length) return null;
  const preferPrefix = network === 'testnet' ? 'ST' : 'SP';
  const preferred = norm.find((a) => a.toUpperCase().startsWith(preferPrefix));
  return preferred ?? norm[0];
}

function collectAddressesFromStorage(storage: any): string[] {
  const out: string[] = [];
  try {
    if (!storage) return out;

    const pushFromItem = (item: any) => {
      if (typeof item === 'string') {
        out.push(item);
        return;
      }
      if (item && typeof item === 'object') {
        if (typeof item.address === 'string') out.push(item.address);
        if (typeof item.stxAddress === 'string') out.push(item.stxAddress);
        if (item.addresses) {
          const a = item.addresses;
          if (typeof a?.mainnet === 'string') out.push(a.mainnet);
          if (typeof a?.testnet === 'string') out.push(a.testnet);
          if (Array.isArray(a)) a.forEach((x) => typeof x === 'string' && out.push(x));
        }
      }
    };

    if (Array.isArray(storage)) {
      storage.forEach(pushFromItem);
    }

    if (typeof storage === 'string') {
      out.push(storage);
      return out;
    }

    if (storage.addresses) {
      const { addresses } = storage;
      Object.keys(addresses).forEach((k) => {
        const arrOrObj = addresses[k];
        if (Array.isArray(arrOrObj)) {
          arrOrObj.forEach(pushFromItem);
        } else {
          pushFromItem(arrOrObj);
        }
      });
    }

    if (storage.stxAddresses) {
      const { stxAddresses } = storage;
      Object.keys(stxAddresses).forEach((k) => {
        const v = stxAddresses[k];
        if (Array.isArray(v)) v.forEach(pushFromItem);
        else pushFromItem(v);
      });
    }

    if (Array.isArray(storage.accounts)) {
      for (const acc of storage.accounts) {
        pushFromItem(acc);
      }
    }

    if (storage?.accounts?.stx) {
      const s = storage.accounts.stx;
      pushFromItem(s?.mainnet);
      pushFromItem(s?.testnet);
    }

    if (typeof storage?.result === 'string') out.push(storage.result);
    if (Array.isArray(storage?.result)) storage.result.forEach(pushFromItem);
    if (storage?.result?.addresses) {
      const ra = storage.result.addresses;
      if (Array.isArray(ra)) ra.forEach(pushFromItem);
      else pushFromItem(ra);
    }
  } catch {}
  return out.filter((addr) => typeof addr === 'string' && addr.length > 0);
}

function getAddressFromStorage(network: NetworkName): string | null {
  try {
    const storage = getLocalStorage();
    console.log('[useWallet] Local storage snapshot:', JSON.stringify(storage, null, 2));
    const candidates = collectAddressesFromStorage(storage);
    if (!candidates.length) {
      console.warn('[useWallet] No STX addresses found in storage');
      return null;
    }
    const selected = pickAddressForNetwork(candidates, network);
    if (!selected) {
      console.warn('[useWallet] No address matched expected network, using first available');
      return candidates[0] ?? null;
    }
    return selected;
  } catch (e) {
    console.error('[useWallet] Error reading storage:', e);
    return null;
  }
}

async function getAddressFromProvider(network: NetworkName): Promise<string | null> {
  try {
    const w: any = globalThis as any;
    const providers: any[] = [
      w?.StacksProvider,
      w?.HiroWalletProvider,
      w?.LeatherProvider,
      w?.XverseProviders?.BitcoinProvider,
    ].filter(Boolean);

    for (const p of providers) {
      try {
        if (typeof p?.getAddresses === 'function') {
          const res = await p.getAddresses();
          const all = collectAddressesFromStorage(res) || [];
          const chosen = pickAddressForNetwork(all, network);
          if (chosen) return chosen;
        }
      } catch {}
      try {
        const possible: string[] = [];
        if (typeof p?.selectedAddress === 'string') possible.push(p.selectedAddress);
        if (typeof p?.stxAddress === 'string') possible.push(p.stxAddress);
        if (typeof p?.address === 'string') possible.push(p.address);
        if (p?.selectedAccount?.addresses) {
          const a = p.selectedAccount.addresses;
          if (typeof a?.mainnet === 'string') possible.push(a.mainnet);
          if (typeof a?.testnet === 'string') possible.push(a.testnet);
        }
        const chosen = pickAddressForNetwork(possible, network);
        if (chosen) return chosen;
      } catch {}
      try {
        if (typeof p?.request === 'function') {
          // Try a couple of common method names defensively
          const methods = ['stx_getAddresses', 'getAddresses'];
          for (const m of methods) {
            try {
              const res = await p.request({ method: m });
              const all = collectAddressesFromStorage(res) || [];
              const chosen = pickAddressForNetwork(all, network);
              if (chosen) return chosen;
            } catch {}
          }
        }
      } catch {}
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
      console.log('[useWallet] Starting connection with provider:', provider);

      if (provider) {
        console.log('[useWallet] Setting provider ID:', provider);
        setSelectedProviderId(provider);
      }

      console.log('[useWallet] Calling stacksConnect()...');
      const result = await stacksConnect();
      console.log('[useWallet] stacksConnect result:', result);

      let addr = getAddressFromStorage(get().network);
      if (!addr) {
        addr = await getAddressFromProvider(get().network);
      }

      if (addr && !isValidAddress(addr)) {
        console.error('[useWallet] Invalid address format:', addr, typeof addr);
        addr = null;
      }

      const prov = (getSelectedProviderId() as WalletProviderId | null) ?? provider ?? null;

      console.log('[useWallet] Resolved address:', addr);
      console.log('[useWallet] Resolved provider:', prov);

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
    let addr = getAddressFromStorage(network) ?? (await getAddressFromProvider(network));
    if (addr && !isValidAddress(addr)) {
      console.error('[useWallet] Invalid address in switchNetwork:', addr);
      addr = null;
    }
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
    let addr = getAddressFromStorage(get().network) ?? (await getAddressFromProvider(get().network));
    if (addr && !isValidAddress(addr)) {
      console.error('[useWallet] Invalid address in refresh:', addr);
      addr = null;
    }
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
