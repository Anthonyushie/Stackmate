import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, Shield, Trophy, Wallet, X } from 'lucide-react';
import { microToStx } from '../lib/stacks';
import useWallet from '../hooks/useWallet';
import { useClaimPrize } from '../hooks/useContract';

export type Difficulty = 'beginner' | 'intermediate' | 'expert';

export interface ClaimPrizeModalProps {
  open: boolean;
  onClose: () => void;
  puzzleId: number | bigint;
  difficulty: Difficulty | string;
  netPrizeMicro: bigint | number | string;
  canClaimNow?: boolean;
  onSuccess?: (txId?: string) => void;
}

const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';

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

export default function ClaimPrizeModal({ open, onClose, puzzleId, difficulty, netPrizeMicro, canClaimNow = true, onSuccess }: ClaimPrizeModalProps) {
  const { balance, refresh } = useWallet();
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

  const netStx = useMemo(() => microToStx(netPrizeMicro), [netPrizeMicro]);
  const yourStx = balance?.stx ?? '0';

  const canConfirm = open && canClaimNow && status !== 'requesting_signature' && status !== 'pending' && status !== 'submitted';

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
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => (status === 'idle' ? onClose() : null)} />

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
                <div className="text-lg font-black">{String(difficulty)}</div>
              </div>
              <div className={`${brutal} bg-green-200 p-3`}>
                <div className="flex items-center gap-2 text-[10px] uppercase font-black"><Trophy className="h-3 w-3"/> Net Prize</div>
                <div className="text-lg font-black">{netStx} STX</div>
              </div>
              <div className={`${brutal} bg-white p-3`}>
                <div className="flex items-center gap-2 text-[10px] uppercase font-black"><Wallet className="h-3 w-3"/> Your Balance</div>
                <div className="text-lg font-black">{yourStx} STX</div>
              </div>
              <div className={`${brutal} ${canClaimNow ? 'bg-blue-200' : 'bg-zinc-200'} p-3`}>
                <div className="text-[10px] uppercase font-black">Status</div>
                <div className="text-lg font-black">{canClaimNow ? 'Ready to claim' : 'Available after deadline'}</div>
              </div>
            </div>

            {error && (
              <div className={`mt-3 ${brutal} bg-red-200 p-3 text-sm`}>{error}</div>
            )}

            {status !== 'idle' && (
              <div className={`mt-3 ${brutal} ${status === 'success' ? 'bg-green-200' : status === 'failed' ? 'bg-red-200' : 'bg-blue-200'} p-3 text-sm`}>
                {status === 'requesting_signature' && 'Waiting for wallet signature…'}
                {status === 'submitted' && 'Transaction submitted. Waiting for confirmation…'}
                {status === 'pending' && 'Transaction pending…'}
                {status === 'success' && (
                  <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4"/> Prize claimed! 🎉</span>
                )}
                {status === 'failed' && 'Claim failed. Please try again.'}
                {txId && (
                  <div className="text-xs mt-1 opacity-70 break-all">txId: {txId}</div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button className={`${brutal} bg-zinc-200 hover:bg-zinc-300 px-4 py-2`} onClick={() => (status === 'idle' ? onClose() : null)} disabled={status !== 'idle'}>Cancel</button>
              <button
                className={`${brutal} px-4 py-2 ${canConfirm ? 'bg-black text-white hover:bg-zinc-800' : 'bg-zinc-400 text-white cursor-not-allowed'}`}
                onClick={handleConfirm}
                disabled={!canConfirm}
              >
                {status === 'requesting_signature' || status === 'submitted' || status === 'pending' ? (
                  <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Processing…</span>
                ) : (
                  <span className="inline-flex items-center gap-2"><Trophy className="h-4 w-4"/> Confirm Claim</span>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
