import { StacksMainnet, StacksTestnet, type StacksNetwork } from '@stacks/network';
import { fetchWithRetry } from './api-client';

export type NetworkName = 'mainnet' | 'testnet';

export interface NetworkConfig {
  name: NetworkName;
  network: StacksNetwork;
  apiBaseUrl: string;
  explorerBaseUrl: string;
}

export const NETWORKS: Record<NetworkName, NetworkConfig> = {
  mainnet: {
    name: 'mainnet',
    network: new StacksMainnet(),
    apiBaseUrl: 'https://api.hiro.so',
    explorerBaseUrl: 'https://explorer.hiro.so',
  },
  testnet: {
    name: 'testnet',
    network: new StacksTestnet(),
    apiBaseUrl: 'https://api.testnet.hiro.so',
    explorerBaseUrl: 'https://explorer.hiro.so/testnet',
  },
};

export const getNetwork = (name: NetworkName): StacksNetwork => {
  const isDev = typeof window !== 'undefined' && (import.meta as any).env?.DEV;
  if (isDev) {
    const proxyUrl = name === 'testnet' ? 'http://localhost:5173/hiro' : 'http://localhost:5173/hiro-mainnet';
    return name === 'testnet' ? new StacksTestnet({ url: proxyUrl }) : new StacksMainnet({ url: proxyUrl });
  }
  return NETWORKS[name].network;
};
export const getApiBaseUrl = (name: NetworkName): string => {
  const isDev = typeof window !== 'undefined' && (import.meta as any).env?.DEV;
  if (isDev) {
    return name === 'testnet' ? '/hiro' : '/hiro-mainnet';
  }
  return NETWORKS[name].apiBaseUrl;
};

export const getExplorerAddressUrl = (name: NetworkName, address: string) =>
  `${NETWORKS[name].explorerBaseUrl}/address/${address}?chain=stacks`;

export const MICROSTX = 1_000_000n;

export const microToStx = (micro: bigint | number | string): string => {
  const value = typeof micro === 'bigint' ? micro : BigInt(micro);
  const whole = value / MICROSTX;
  const frac = value % MICROSTX;

  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
  return fracStr.length ? `${whole.toString()}.${fracStr}` : whole.toString();
};

export interface StxBalance {
  micro: string;
  stx: string;
}

export async function fetchStxBalance(address: string, network: NetworkName): Promise<StxBalance> {
  const url = `${getApiBaseUrl(network)}/extended/v1/address/${address}/balances`;
  const res = await fetchWithRetry(url, undefined, { maxRetries: 2, initialDelayMs: 2000 });
  if (!res.ok) throw new Error(`Failed to fetch balance (${res.status})`);
  const json: any = await res.json();
  const micro: string = json?.stx?.balance ?? '0';
  return { micro, stx: microToStx(micro) };
}

export const truncateMiddle = (str: string, front = 6, back = 4) =>
  str.length <= front + back + 3
    ? str
    : `${str.slice(0, front)}…${str.slice(-back)}`;
