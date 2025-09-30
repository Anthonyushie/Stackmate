import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Loader2, LogOut, Wallet, Copy, Network, Link } from 'lucide-react';
import useWallet, { type WalletProviderId } from '../hooks/useWallet';
import { truncateMiddle } from '../lib/stacks';

const brutal =
  'rounded-none border-[3px] border-black shadow-[6px_6px_0_#000] active:shadow-[2px_2px_0_#000] active:translate-x-[4px] active:translate-y-[4px] transition-all';

const WALLET_OPTIONS: Array<{ id: WalletProviderId; name: string }> = [
  { id: 'LeatherProvider', name: 'Leather' },
  { id: 'XverseProviders.BitcoinProvider', name: 'Xverse' },
  { id: 'HiroWalletProvider', name: 'Hiro' },
];

const getProviderDisplayName = (providerId: WalletProviderId | null): string => {
  if (!providerId) return '';
  const wallet = WALLET_OPTIONS.find(w => w.id === providerId);
  return wallet?.name ?? providerId;
};

const ProviderOption = ({ id, name, onClick }: { id: WalletProviderId; name: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-4 py-2 bg-white hover:bg-yellow-200 ${brutal}`}
  >
    <span className="font-semibold">{name}</span>
    <span className="text-xs ml-2 opacity-70">Stacks wallet</span>
  </button>
);

export default function WalletConnect({ className = '' }: { className?: string }) {
  const { connect, disconnect, address, balance, providerId, isConnecting, network, switchNetwork, refresh } = useWallet();
  const [open, setOpen] = useState(false);
  const [showProviders, setShowProviders] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  const label = useMemo(() => {
    if (isConnecting) return 'Connecting…';
    if (!address) return 'Connect Wallet';
    const bal = balance?.stx ? `${balance.stx} STX` : '— STX';
    return `${truncateMiddle(address)} • ${bal}`;
  }, [isConnecting, address, balance]);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={() => {
          if (!address) {
            setShowProviders((v) => !v);
          } else {
            setOpen((v) => !v);
          }
        }}
        disabled={isConnecting}
        className={`flex items-center gap-2 px-4 py-3 bg-yellow-300 hover:bg-yellow-400 ${brutal}`}
      >
        {isConnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        <span className="text-sm font-black tracking-tight">{label}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {!address && showProviders && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            className="absolute left-0 mt-3 w-[260px] z-50"
          >
            <div className={`p-3 bg-pink-200 ${brutal}`}>
              <div className="text-xs font-bold mb-2">Choose a wallet</div>
              <div className="grid gap-2">
                {WALLET_OPTIONS.map((wallet) => (
                  <ProviderOption
                    key={wallet.id}
                    id={wallet.id}
                    name={wallet.name}
                    onClick={async () => {
                      setShowProviders(false);
                      await connect(wallet.id).catch(() => {});
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {address && open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            className="absolute right-0 mt-3 min-w-[260px] z-50"
          >
            <div className={`bg-white p-3 ${brutal}`}>
              <div className="mb-2">
                <div className="text-[10px] uppercase tracking-widest font-black opacity-60">Connected</div>
                <div className="text-sm font-bold">{truncateMiddle(address)}</div>
                <div className="text-xs">{balance?.stx ?? '—'} STX</div>
                {providerId && <div className="text-[10px] mt-1">via {getProviderDisplayName(providerId)}</div>}
              </div>
              <div className="grid gap-2">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(address);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 bg-green-200 hover:bg-green-300 ${brutal}`}
                >
                  <Copy className="h-4 w-4" /> Copy address
                </button>
                <button
                  onClick={async () => {
                    await disconnect();
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 bg-red-200 hover:bg-red-300 ${brutal}`}
                >
                  <LogOut className="h-4 w-4" /> Disconnect
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => switchNetwork('testnet')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 bg-blue-200 hover:bg-blue-300 ${brutal} ${
                      network === 'testnet' ? 'ring-2 ring-black' : ''
                    }`}
                  >
                    <Network className="h-4 w-4" /> Testnet
                  </button>
                  <button
                    onClick={() => switchNetwork('mainnet')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 bg-orange-200 hover:bg-orange-300 ${brutal} ${
                      network === 'mainnet' ? 'ring-2 ring-black' : ''
                    }`}
                  >
                    <Network className="h-4 w-4" /> Mainnet
                  </button>
                </div>
                <a
                  href={`https://explorer.hiro.so/${network === 'testnet' ? 'testnet/' : ''}address/${address}?chain=stacks`}
                  target="_blank"
                  className={`flex items-center gap-2 px-3 py-2 bg-purple-200 hover:bg-purple-300 ${brutal}`}
                  rel="noreferrer"
                >
                  <Link className="h-4 w-4" /> View on explorer
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
