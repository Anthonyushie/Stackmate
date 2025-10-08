import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Coins, Loader2, Shield, Wallet, X, Zap } from 'lucide-react';
import { microToStx } from '../lib/stacks';
import useWallet from '../hooks/useWallet';
import { useEnterPuzzle } from '../hooks/useContract';
import { useNavigate } from 'react-router-dom';
import { colors, shadows, getDifficultyColor } from '../styles/neo-brutal-theme';
import NeoButton from './neo/NeoButton';

export type Difficulty = 'beginner' | 'intermediate' | 'expert';

export interface EnterPuzzleModalProps {
  isOpen: boolean;
  onClose: () => void;
  puzzleId: number | bigint;
  difficulty: Difficulty;
  entryFeeMicro: bigint | number | string;
  prizePoolMicro: bigint | number | string; 
  alreadyEntered?: boolean;
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

export default function EnterPuzzleModal({ isOpen, onClose, puzzleId, difficulty, entryFeeMicro, prizePoolMicro, alreadyEntered = false }: EnterPuzzleModalProps) {
  console.log('[EnterPuzzleModal] Render', { isOpen, puzzleId, difficulty, entryFeeMicro, prizePoolMicro, alreadyEntered });
  const navigate = useNavigate();
  const { network, balance, address } = useWallet();
  const enter = useEnterPuzzle();

  const [agree, setAgree] = useState(false);
  const [status, setStatus] = useState<'idle' | 'requesting_signature' | 'submitted' | 'pending' | 'success' | 'failed'>('idle');
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setAgree(false);
      setStatus('idle');
      setTxId(null);
      setError(null);
    }
  }, [isOpen]);

  const entryStx = useMemo(() => microToStx(entryFeeMicro), [entryFeeMicro]);
  const prizeStx = useMemo(() => microToStx(prizePoolMicro), [prizePoolMicro]);
  const yourStx = balance?.stx ?? '0';
  const yourMicro = (() => {
    try { return BigInt(balance?.micro ?? '0'); } catch { return 0n; }
  })();
  const needMicro = (() => {
    try { return BigInt(entryFeeMicro as any); } catch { return 0n; }
  })();
  const insufficient = yourMicro < needMicro;

  const canConfirm = isOpen && !alreadyEntered && !insufficient && agree && status !== 'requesting_signature' && status !== 'pending' && status !== 'submitted';

  async function handleConfirm() {
    setError(null);
    if (alreadyEntered) { setError('You already entered this puzzle.'); await toastMsg('Already entered this puzzle', 'error'); return; }
    if (insufficient) { setError('Insufficient STX balance for entry fee.'); await toastMsg('Insufficient STX balance', 'error'); return; }
    if (!agree) { setError('You must accept the terms before continuing.'); await toastMsg('Please accept the terms', 'info'); return; }

    try {
      const res = await enter.mutateAsync({
        puzzleId,
        entryFee: needMicro,
        onStatus: (s, d) => {
          setStatus(s);
          if (d?.txId) setTxId(d.txId);
          if (s === 'requesting_signature') toastMsg('Open your wallet to sign the entry', 'info');
          if (s === 'submitted') toastMsg('Transaction submitted. Waiting for confirmation…', 'info');
          if (s === 'success') toastMsg('Entry confirmed! Time to solve 🎯', 'success');
          if (s === 'failed') toastMsg('Entry failed. Please try again.', 'error');
        },
      });
      if (!res?.ok) {
        setError(res?.error || 'Entry failed');
        setStatus('failed');
        return;
      }
      setStatus('success');
      // Navigate immediately to prevent redirect issues
      onClose?.();
      navigate(`/solve/${difficulty}/${String(puzzleId)}`);
    } catch (e: any) {
      setError(e?.message || 'Entry failed');
      setStatus('failed');
    }
  }

  const diffColor = getDifficultyColor(difficulty);

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ 
            zIndex: 999999,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'auto',
          }}
        >
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
            onClick={() => (status === 'idle' ? onClose() : null)} 
          />

          <motion.div
            initial={{ scale: 0.8, rotate: -5, y: 50 }}
            animate={{ scale: 1, rotate: 2, y: 0 }}
            exit={{ scale: 0.8, rotate: 5, y: 50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              position: 'relative',
              maxWidth: '600px',
              width: '100%',
              background: diffColor,
              border: `8px solid ${colors.border}`,
              boxShadow: shadows.brutalLarge,
              padding: '32px',
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

            {/* Title */}
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: '40px',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              marginBottom: '24px',
              color: colors.dark,
            }}>
              ENTER PUZZLE
            </h2>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                background: colors.white,
                border: `4px solid ${colors.border}`,
                boxShadow: shadows.brutalSmall,
                padding: '16px',
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}>
                  DIFFICULTY
                </div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: '24px',
                  textTransform: 'uppercase',
                }}>
                  {difficulty}
                </div>
              </div>

              <div style={{
                background: colors.primary,
                border: `4px solid ${colors.border}`,
                boxShadow: shadows.brutalSmall,
                padding: '16px',
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}>
                  ENTRY FEE
                </div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: '24px',
                }}>
                  {entryStx} STX
                </div>
              </div>

              <div style={{
                background: colors.accent2,
                border: `4px solid ${colors.border}`,
                boxShadow: shadows.brutalSmall,
                padding: '16px',
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}>
                  CURRENT PRIZE
                </div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: '24px',
                }}>
                  {prizeStx} STX
                </div>
              </div>

              <div style={{
                background: insufficient ? colors.error : colors.white,
                border: `4px solid ${colors.border}`,
                boxShadow: shadows.brutalSmall,
                padding: '16px',
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                  color: insufficient ? colors.white : colors.dark,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <Wallet className="h-3 w-3" /> YOUR BALANCE
                </div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: '24px',
                  color: insufficient ? colors.white : colors.dark,
                }}>
                  {yourStx} STX
                </div>
              </div>
            </div>

            {/* Warning messages */}
            {insufficient && (
              <motion.div
                initial={{ opacity: 0, x: [-10, 10, -10, 10, 0] }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  background: colors.error,
                  border: `4px solid ${colors.border}`,
                  boxShadow: shadows.brutalSmall,
                  padding: '16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'start',
                  gap: '12px',
                }}
              >
                <AlertTriangle className="h-5 w-5 mt-1" style={{ color: colors.white }} />
                <div>
                  <div style={{ fontWeight: 900, fontSize: '16px', color: colors.white }}>LOW BALANCE</div>
                  <div style={{ fontSize: '14px', opacity: 0.9, color: colors.white }}>
                    You don't have enough STX to cover the entry fee.
                  </div>
                </div>
              </motion.div>
            )}

            {alreadyEntered && (
              <div style={{
                background: colors.dark,
                color: colors.white,
                border: `4px solid ${colors.border}`,
                boxShadow: shadows.brutalSmall,
                padding: '16px',
                marginBottom: '16px',
                fontWeight: 900,
                fontSize: '14px',
                textTransform: 'uppercase',
              }}>
                YOU HAVE ALREADY ENTERED THIS PUZZLE
              </div>
            )}

            {/* Terms checkbox */}
            <div style={{
              background: colors.white,
              border: `4px solid ${colors.border}`,
              boxShadow: shadows.brutalSmall,
              padding: '16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'start',
              gap: '12px',
            }}>
              <Shield className="h-5 w-5 mt-1" />
              <label style={{ flex: 1, cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '14px' }}>
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  style={{ marginRight: '12px', transform: 'scale(1.2)' }}
                />
                I understand winner takes all
              </label>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
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
              }}>
                {status === 'requesting_signature' && 'WAITING FOR WALLET SIGNATURE…'}
                {status === 'submitted' && 'TRANSACTION SUBMITTED. WAITING FOR CONFIRMATION…'}
                {status === 'pending' && 'TRANSACTION PENDING…'}
                {status === 'success' && 'ENTRY CONFIRMED! TIME TO SOLVE 🎯'}
                {status === 'failed' && 'ENTRY FAILED. PLEASE TRY AGAIN.'}
                {txId && (
                  <div style={{ fontSize: '10px', marginTop: '8px', opacity: 0.8, wordBreak: 'break-all' }}>
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
                variant={canConfirm ? "primary" : "secondary"}
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
                    PROCESSING…
                  </>
                ) : (
                  <>
                    <Zap className="inline h-5 w-5 mr-2" />
                    CONFIRM ENTRY
                  </>
                )}
              </NeoButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
