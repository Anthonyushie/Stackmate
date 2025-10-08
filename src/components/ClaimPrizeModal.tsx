import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, Trophy, X, Sparkles, Coins } from 'lucide-react';
import { microToStx } from '../lib/stacks';
import useWallet from '../hooks/useWallet';
import { useClaimPrize } from '../hooks/useContract';
import { colors, shadows } from '../styles/neo-brutal-theme';
import NeoButton from './neo/NeoButton';

export type Difficulty = 'beginner' | 'intermediate' | 'expert';

export interface ClaimPrizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  puzzleId: number | bigint;
  difficulty: Difficulty | string;
  netPrizeMicro: bigint | number | string;
  canClaimNow?: boolean;
  onSuccess?: (txId?: string) => void;
}

async function toastMsg(message: string, type: 'success' | 'error' | 'info' = 'info') {
  try {
    const m = await import('sonner');
    const toast = (m as any).toast as any;
    if (!toast) return;
    if (type === 'success') toast.success(message);
    else if (type === 'error') toast.error(message);
    else toast(message);
  } catch {
    try {
      const m2 = await import('react-hot-toast');
      const toast2 = (m2 as any).toast as any;
      if (!toast2) return;
      if (type === 'success') toast2.success(message);
      else if (type === 'error') toast2.error(message);
      else toast2(message);
    } catch {}
  }
}

export default function ClaimPrizeModal({ isOpen, onClose, puzzleId, difficulty, netPrizeMicro, canClaimNow = true, onSuccess }: ClaimPrizeModalProps) {
  const { balance, refresh } = useWallet();
  const claim = useClaimPrize();

  const [status, setStatus] = useState<'idle' | 'requesting_signature' | 'submitted' | 'pending' | 'success' | 'failed'>('idle');
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setTxId(null);
      setError(null);
    }
  }, [isOpen]);

  const netStx = useMemo(() => microToStx(netPrizeMicro), [netPrizeMicro]);
  const yourStx = balance?.stx ?? '0';

  const canConfirm = isOpen && canClaimNow && status !== 'requesting_signature' && status !== 'pending' && status !== 'submitted';

  async function handleConfirm() {
    setError(null);
    if (!canClaimNow) {
      await toastMsg('Prize can be claimed after the deadline', 'info');
      return;
    }
    try {
      const res = await claim.mutateAsync({
        puzzleId,
        onStatus: (s, d) => {
          setStatus(s);
          if (d?.txId) setTxId(d.txId);
          if (s === 'requesting_signature') toastMsg('Open your wallet to sign the claim', 'info');
          if (s === 'submitted') toastMsg('Transaction submitted. Waiting for confirmation…', 'info');
          if (s === 'success') toastMsg('Prize claimed! 🎉', 'success');
          if (s === 'failed') toastMsg('Claim failed. Try again.', 'error');
        },
      });
      if (!res?.ok) {
        setError(res?.error || 'Claim failed');
        setStatus('failed');
        return;
      }
      setStatus('success');
      try { await refresh(); } catch {}
      onSuccess?.(txId || undefined);
      setTimeout(() => { onClose?.(); }, 1000);
    } catch (e: any) {
      setError(e?.message || 'Claim failed');
      setStatus('failed');
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
            onClick={() => (status === 'idle' ? onClose() : null)} 
          />

          <motion.div
            initial={{ scale: 0.5, rotate: -10, y: 100 }}
            animate={{ scale: 1, rotate: -2, y: 0 }}
            exit={{ scale: 0.5, rotate: 10, y: 100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              position: 'relative',
              maxWidth: '600px',
              width: '100%',
              background: status === 'success' ? colors.success : colors.primary,
              border: `8px solid ${colors.border}`,
              boxShadow: shadows.brutalLarge,
              padding: '40px',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => (status === 'idle' ? onClose() : null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: colors.dark,
                color: colors.white,
                border: `4px solid ${colors.border}`,
                padding: '8px',
                cursor: status === 'idle' ? 'pointer' : 'not-allowed',
                opacity: status === 'idle' ? 1 : 0.5,
              }}
            >
              <X size={24} strokeWidth={3} />
            </button>

            {/* Trophy animation */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ 
                scale: status === 'success' ? [1, 1.2, 1] : 1, 
                rotate: status === 'success' ? [0, -10, 10, 0] : 0 
              }}
              transition={{ duration: 0.6, ease: 'easeInOut', repeat: status === 'success' ? 3 : 0 }}
              style={{
                marginBottom: '24px',
                textAlign: 'center',
              }}
            >
              <Trophy 
                size={80} 
                style={{ 
                  color: status === 'success' ? colors.white : colors.dark,
                  filter: `drop-shadow(4px 4px 0px ${colors.border})`,
                }} 
              />
            </motion.div>

            {/* Title */}
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: '48px',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              marginBottom: '32px',
              color: status === 'success' ? colors.white : colors.dark,
              textAlign: 'center',
              lineHeight: 0.9,
            }}>
              {status === 'success' ? 'YOU WON!' : 'CLAIM PRIZE'}
            </h2>

            {/* Prize amount - MASSIVE */}
            <motion.div
              animate={status === 'success' ? { 
                scale: [1, 1.1, 1], 
                rotate: [0, -2, 2, 0] 
              } : {}}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{
                background: colors.dark,
                border: `6px solid ${colors.border}`,
                boxShadow: shadows.brutalLarge,
                padding: '32px',
                marginBottom: '24px',
                textAlign: 'center',
              }}
            >
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '14px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: colors.primary,
                marginBottom: '12px',
              }}>
                YOUR PRIZE
              </div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 900,
                fontSize: '72px',
                color: colors.white,
                lineHeight: 1,
                textShadow: `6px 6px 0px ${colors.success}`,
              }}>
                {netStx}
              </div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 900,
                fontSize: '36px',
                color: colors.success,
                marginTop: '8px',
              }}>
                STX
              </div>
            </motion.div>

            {/* Your balance */}
            <div style={{
              background: colors.white,
              border: `4px solid ${colors.border}`,
              boxShadow: shadows.brutalSmall,
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}>
                CURRENT BALANCE
              </div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 900,
                fontSize: '24px',
              }}>
                {yourStx} STX
              </div>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, x: [-10, 10, -10, 10, 0] }}
                animate={{ opacity: 1 }}
                style={{
                  background: colors.error,
                  color: colors.white,
                  border: `4px solid ${colors.border}`,
                  boxShadow: shadows.brutalSmall,
                  padding: '16px',
                  marginBottom: '16px',
                  fontWeight: 900,
                }}
              >
                {error}
              </motion.div>
            )}

            {/* Status message */}
            {status !== 'idle' && (
              <div style={{
                background: status === 'success' ? colors.success : status === 'failed' ? colors.error : colors.accent1,
                color: status === 'success' || status === 'failed' ? colors.white : colors.dark,
                border: `4px solid ${colors.border}`,
                boxShadow: shadows.brutalSmall,
                padding: '16px',
                marginBottom: '16px',
                fontWeight: 900,
                textTransform: 'uppercase',
              }}>
                {status === 'requesting_signature' && '⏳ WAITING FOR WALLET SIGNATURE…'}
                {status === 'submitted' && '📡 TRANSACTION SUBMITTED…'}
                {status === 'pending' && '⏳ TRANSACTION PENDING…'}
                {status === 'success' && '🎉 PRIZE CLAIMED!'}
                {status === 'failed' && '❌ CLAIM FAILED. TRY AGAIN.'}
                {txId && (
                  <div style={{ fontSize: '10px', marginTop: '8px', opacity: 0.8, wordBreak: 'break-all', textTransform: 'none' }}>
                    txId: {txId}
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <NeoButton
                variant="secondary"
                size="lg"
                onClick={() => (status === 'idle' ? onClose() : null)}
                disabled={status !== 'idle'}
              >
                CANCEL
              </NeoButton>

              <NeoButton
                variant="success"
                size="lg"
                onClick={handleConfirm}
                disabled={!canConfirm}
              >
                {status === 'requesting_signature' || status === 'submitted' || status === 'pending' ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{ display: 'inline-block' }}
                    >
                      <Loader2 className="inline h-5 w-5 mr-2" />
                    </motion.div>
                    CLAIMING…
                  </>
                ) : status === 'success' ? (
                  <>
                    <CheckCircle2 className="inline h-5 w-5 mr-2" />
                    CLAIMED!
                  </>
                ) : (
                  <>
                    <Trophy className="inline h-5 w-5 mr-2" />
                    CLAIM NOW
                  </>
                )}
              </NeoButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
