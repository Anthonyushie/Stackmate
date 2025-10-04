import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Coins, Loader2, Trophy, X } from 'lucide-react';
import { microToStx, type NetworkName } from '../lib/stacks';
import useWallet from '../hooks/useWallet';
import { useClaimPrize } from '../hooks/useContract';

export type Difficulty = 'beginner' | 'intermediate' | 'expert';

export interface ClaimPrizeModalProps {
  open: boolean;
  onClose: () => void;
  puzzleId: number | bigint;
  difficulty: Difficulty;
  prizePoolMicro: bigint | number | string;
  onSuccess?: () => void;
}

const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';

export default function ClaimPrizeModal({ open, onClose, puzzleId, difficulty, prizePoolMicro, onSuccess }: ClaimPrizeModalProps) {
  const { network, refresh } = useWallet();
  const claim = useClaimPrize();

  const [status, setStatus] = useState<'idle' | 'requesting_signature' | 'submitted' | 'pending' | 'success' | 'failed'>('idle');
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStatus('idle');
      setTxId(null);
      setError(null);
    }
  }, [open]);

  // Platform fee 5%
  const netMicro = useMemo(() => {
    try {
      const v = BigInt(prizePoolMicro as any);
      return (v * 95n) / 100n;
    } catch {
      return 0n;
    }
  }, [prizePoolMicro]);
  const prizeStx = microToStx(netMicro);

  async function handleConfirm() {
    setError(null);
    try {
      const res: any = await claim.mutateAsync({ puzzleId, onStatus: (s, d) => { setStatus(mapStatus(s)); if (d?.txId) setTxId(d.txId); } });
      if (!res?.ok) {
        setStatus('failed');
        setError(res?.error || 'Claim failed');
        return;
      }
      setStatus('success');
      await refresh().catch(() => {});
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 1200);
    } catch (e: any) {
      setStatus('failed');
      setError(e?.message || 'Claim failed');
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => (status === 'idle' ? onClose() : null)} />

          {/* Simple confetti on success */}
          <AnimatePresence>
            {status === 'success' && (
              <motion.div className="pointer-events-none absolute inset-0 overflow-hidden"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <motion.div key={i}
                    className="absolute w-2 h-2"
                    style={{ left: `${(i * 23) % 100}%`, top: '-10px', background: i % 3 === 0 ? '#f59e0b' : i % 3 === 1 ? '#10b981' : '#3b82f6', boxShadow: '2px 2px 0 #000' }}
                    initial={{ y: -20, rotate: 0, opacity: 0 }}
                    animate={{ y: ['-10%', '110%'], rotate: [0, 360], opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 2.2 + (i % 10) * 0.2, delay: (i % 10) * 0.05 }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ scale: 0.9, rotate: -1, y: 8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`relative max-w-lg w-[96%] sm:w-[520px] ${brutal} bg-white/80 dark:bg-zinc-900/70 backdrop-blur p-5`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xl font-black">Claim Prize</div>
              <button className={`${brutal} bg-zinc-200 px-2 py-1`} onClick={() => (status === 'idle' ? onClose() : null)}><X className="h-4 w-4"/></button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className={`${brutal} bg-yellow-200 p-3`}>
                <div className="text-[10px] uppercase font-black">Difficulty</div>
                <div className="text-lg font-black">{difficulty}</div>
              </div>
              <div className={`${brutal} bg-green-200 p-3`}>
                <div className="text-[10px] uppercase font-black">Prize (net)</div>
                <div className="text-lg font-black">{prizeStx} STX</div>
              </div>
            </div>

            {error && (
              <div className={`mt-3 ${brutal} bg-red-200 p-3 text-sm flex items-center gap-2`}>
                <AlertTriangle className="h-4 w-4" />
                <div>{error}</div>
              </div>
            )}

            {status !== 'idle' && (
              <div className={`mt-3 ${brutal} ${status === 'success' ? 'bg-green-200' : status === 'failed' ? 'bg-red-200' : 'bg-blue-200'} p-3 text-sm`}> 
                {status === 'requesting_signature' && 'Waiting for wallet signature…'}
                {status === 'submitted' && 'Transaction submitted. Waiting for confirmation…'}
                {status === 'pending' && 'Transaction pending…'}
                {status === 'success' && 'Prize claimed! 🎉'}
                {status === 'failed' && 'Claim failed. Please try again.'}
                {txId && (
                  <div className="text-xs mt-1 opacity-70 break-all">txId: {txId}</div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button className={`${brutal} bg-zinc-200 hover:bg-zinc-300 px-4 py-2`} onClick={() => (status === 'idle' ? onClose() : null)} disabled={status !== 'idle'}>Cancel</button>
              <button
                className={`${brutal} px-4 py-2 ${status === 'idle' ? 'bg-black text-white hover:bg-zinc-800' : 'bg-zinc-400 text-white cursor-not-allowed'}`}
                onClick={handleConfirm}
                disabled={status !== 'idle'}
              >
                {status === 'idle' ? <span className="inline-flex items-center gap-2"><Trophy className="h-4 w-4"/> Claim</span> : <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Processing…</span>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function mapStatus(s: any): 'idle' | 'requesting_signature' | 'submitted' | 'pending' | 'success' | 'failed' {
  if (s === 'requesting_signature') return 'requesting_signature';
  if (s === 'submitted') return 'submitted';
  if (s === 'pending') return 'pending';
  if (s === 'success') return 'success';
  if (s === 'failed') return 'failed';
  return 'idle';
}
