import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Loader2, LogOut, Wallet, Copy, Network, Link as LinkIcon } from 'lucide-react';
import useWallet, { type WalletProviderId } from '../hooks/useWallet';
import { truncateMiddle } from '../lib/stacks';
import { colors, shadows } from '../styles/neo-brutal-theme';

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
  <motion.button
    whileHover={{ x: -2, y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    style={{
      width: '100%',
      textAlign: 'left',
      padding: '12px 16px',
      background: colors.white,
      border: `4px solid ${colors.border}`,
      boxShadow: shadows.brutalSmall,
      fontFamily: "'Inter', sans-serif",
      fontWeight: 900,
      fontSize: '14px',
      textTransform: 'uppercase',
      cursor: 'pointer',
    }}
  >
    <div>{name}</div>
    <div style={{ fontSize: '10px', opacity: 0.7, textTransform: 'none' }}>Stacks wallet</div>
  </motion.button>
);

export default function WalletConnect({ className = '' }: { className?: string }) {
  const { connect, disconnect, address, balance, providerId, isConnecting, network, switchNetwork, refresh } = useWallet();
  const [open, setOpen] = useState(false);
  const [showProviders, setShowProviders] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  const label = useMemo(() => {
    if (isConnecting) return 'CONNECTING…';
    if (!address) return 'CONNECT WALLET';
    const bal = balance?.stx ? `${balance.stx} STX` : '— STX';
    return `${truncateMiddle(address)} • ${bal}`;
  }, [isConnecting, address, balance]);

  const isConnected = Boolean(address);

  return (
    <div className={`relative inline-block ${className}`}>
      <motion.button
        whileHover={!isConnecting ? { x: -2, y: -2 } : {}}
        whileTap={!isConnecting ? { scale: 0.98 } : {}}
        onClick={() => {
          if (!address) {
            setShowProviders((v) => !v);
          } else {
            setOpen((v) => !v);
          }
        }}
        disabled={isConnecting}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: 'clamp(10px, 2vw, 12px) clamp(12px, 3vw, 20px)',
          background: isConnected ? colors.accent2 : colors.primary,
          border: `5px solid ${colors.border}`,
          boxShadow: shadows.brutal,
          cursor: isConnecting ? 'not-allowed' : 'pointer',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 900,
          fontSize: 'clamp(11px, 2.5vw, 14px)',
          textTransform: 'uppercase',
          color: colors.dark,
          opacity: isConnecting ? 0.7 : 1,
          position: 'relative',
        }}
      >
        {/* Connected indicator dot */}
        {isConnected && (
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: colors.accent2,
              border: `3px solid ${colors.border}`,
              boxShadow: shadows.brutalSmall,
            }}
          />
        )}

        {isConnecting ? (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <Loader2 className="h-5 w-5" />
          </motion.div>
        ) : (
          <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
        )}
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{isConnected ? truncateMiddle(address, 4, 3) : 'CONNECT'}</span>
        <motion.div
          animate={{ rotate: open || showProviders ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </motion.button>

      {/* Provider Selection Dropdown */}
      <AnimatePresence>
        {!address && showProviders && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              marginTop: '12px',
              width: '100%',
              maxWidth: '280px',
              zIndex: 50,
            }}
          >
            <div
              style={{
                padding: '16px',
                background: colors.secondary,
                border: `6px solid ${colors.border}`,
                boxShadow: shadows.brutalLarge,
              }}
            >
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                  color: colors.white,
                }}
              >
                CHOOSE A WALLET
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
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

      {/* Connected Account Dropdown */}
      <AnimatePresence>
        {address && open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              position: 'absolute',
              right: 0,
              marginTop: '12px',
              width: '100vw',
              maxWidth: '320px',
              zIndex: 50,
            }}
          >
            <div
              style={{
                background: colors.white,
                padding: '20px',
                border: `6px solid ${colors.border}`,
                boxShadow: shadows.brutalLarge,
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    opacity: 0.6,
                    marginBottom: '4px',
                  }}
                >
                  CONNECTED
                </div>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '16px',
                    fontWeight: 900,
                    marginBottom: '4px',
                  }}
                >
                  {truncateMiddle(address)}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  {balance?.stx ?? '—'} STX
                </div>
                {providerId && (
                  <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>
                    via {getProviderDisplayName(providerId)}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: '8px' }}>
                <motion.button
                  whileHover={{ x: -2, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    await navigator.clipboard.writeText(address);
                    setOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    background: colors.accent2,
                    border: `4px solid ${colors.border}`,
                    boxShadow: shadows.brutalSmall,
                    cursor: 'pointer',
                    fontWeight: 900,
                    fontSize: '12px',
                    textTransform: 'uppercase',
                  }}
                >
                  <Copy className="h-4 w-4" /> COPY ADDRESS
                </motion.button>

                <motion.button
                  whileHover={{ x: -2, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    await disconnect();
                    setOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    background: colors.error,
                    border: `4px solid ${colors.border}`,
                    boxShadow: shadows.brutalSmall,
                    cursor: 'pointer',
                    fontWeight: 900,
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    color: colors.white,
                  }}
                >
                  <LogOut className="h-4 w-4" /> DISCONNECT
                </motion.button>

                <div style={{
                  background: colors.intermediate,
                  border: `4px solid ${colors.border}`,
                  boxShadow: shadows.brutalSmall,
                  padding: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}>
                    <Network className="h-4 w-4" />
                    <span style={{ fontWeight: 900, fontSize: '12px', textTransform: 'uppercase' }}>
                      TESTNET ONLY
                    </span>
                  </div>
                </div>

                <motion.a
                  whileHover={{ x: -2, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  href={`https://explorer.hiro.so/testnet/address/${address}?chain=stacks`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    background: colors.accent1,
                    border: `4px solid ${colors.border}`,
                    boxShadow: shadows.brutalSmall,
                    cursor: 'pointer',
                    fontWeight: 900,
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    color: colors.dark,
                  }}
                >
                  <LinkIcon className="h-4 w-4" /> VIEW ON EXPLORER
                </motion.a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
