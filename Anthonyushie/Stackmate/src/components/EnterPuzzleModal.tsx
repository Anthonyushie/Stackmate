import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Coins, Loader2, Shield, Wallet, X } from 'lucide-react';
import { microToStx, type NetworkName } from '../lib/stacks';
import useWallet from '../hooks/useWallet';
import { useEnterPuzzle } from '../hooks/useContract';
import { useNavigate } from 'react-router-dom';

export type Difficulty = 'beginner' | 'intermediate' | 'expert';

export interface EnterPuzzleModalProps {
  open: boolean;
  onClose: () => void;
  puzzleId: number | bigint;
  difficulty: Difficulty;
  entryFeeMicro: bigint | number | string;
  prizePoolMicro: bigint | number | string;
  alreadyEntered?: boolean;
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

export default function EnterPuzzleModal({ open, onClose, puzzleId, difficulty, entryFeeMicro, prizePoolMicro, alreadyEntered = false }: EnterPuzzleModalProps) {
  const navigate = useNavigate();
  const { network, balance, address, isConnecting, refresh } = useWallet();
  const enter = useEnterPuzzle();

  const [agree, setAgree] = useState(false);
  const [status, setStatus] = useState<'idle' | 'requesting_signature' | 'submitted' | 'pending' | 'success' | 'failed'>('idle');
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAgree(false);
      setStatus('idle');
      setTxId(null);
      setError(null);
    }
  }, [open]);

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

  const canConfirm = open && !alreadyEntered && !insufficient && agree && status !== 'requesting_signature' && status !== 'pending' && status !== 'submitted';

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
      // Redirect to solve page after a short delay
      setTimeout(() => {
        navigate(`/solve/${difficulty}/${String(puzzleId)}`);
        onClose?.();
      }, 1200);
    } catch (e: any) {
      setError(e?.message || 'Entry failed');
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
              <div className="text-xl font-black">Enter Puzzle</div>
              <button className={`${brutal} bg-zinc-200 px-2 py-1`} onClick={() => (status === 'idle' ? onClose() : null)}><X className="h-4 w-4"/></button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className={`${brutal} bg-yellow-200 p-3`}>
                <div className="text-[10px] uppercase font-black">Difficulty</div>
                <div className="text-lg font-black">{difficulty}</div>
              </div>
              <div className={`${brutal} bg-blue-200 p-3`}>
                <div className="text-[10px] uppercase font-black">Entry Fee</div>
                <div className="text-lg font-black">{entryStx} STX</div>
              </div>
              <div className={`${brutal} bg-green-200 p-3`}>
                <div className="text-[10px] uppercase font-black">Current Prize</div>
                <div className="text-lg font-black">{prizeStx} STX</div>
              </div>
              <div className={`${brutal} bg-white p-3`}>
                <div className="flex items-center gap-2 text-[10px] uppercase font-black"><Wallet className="h-3 w-3"/> Your Balance</div>
                <div className="text-lg font-black">{yourStx} STX</div>
              </div>
            </div>

            {insufficient && (
              <div className={`mt-3 ${brutal} bg-red-200 p-3 text-sm flex items-start gap-2`}>
                <AlertTriangle className="h-4 w-4 mt-[2px]"/>
                <div>
                  <div className="font-black">Low balance</div>
                  <div className="opacity-80 text-xs">You don’t have enough STX to cover the entry fee.</div>
                </div>
              </div>
            )}

            {alreadyEntered && (
              <div className={`mt-3 ${brutal} bg-black text-white p-3 text-sm`}>You have already entered this puzzle.</div>
            )}

            <div className={`mt-3 ${brutal} bg-white p-3 text-sm flex items-start gap-2`}>
              <Shield className="h-4 w-4 mt-[2px]"/>
              <label className="flex-1 cursor-pointer select-none">
                <input type="checkbox" className="mr-2 align-middle" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>I understand winner takes all</span>
              </label>
            </div>

            {error && (
              <div className={`mt-3 ${brutal} bg-red-200 p-3 text-sm`}>{error}</div>
            )}

            {status !== 'idle' && (
              <div className={`mt-3 ${brutal} ${status === 'success' ? 'bg-green-200' : status === 'failed' ? 'bg-red-200' : 'bg-blue-200'} p-3 text-sm`}> 
                {status === 'requesting_signature' && 'Waiting for wallet signature…'}
                {status === 'submitted' && 'Transaction submitted. Waiting for confirmation…'}
                {status === 'pending' && 'Transaction pending…'}
                {status === 'success' && 'Entry confirmed! Time to solve 🎯'}
                {status === 'failed' && 'Entry failed. Please try again.'}
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
                  <span className="inline-flex items-center gap-2"><Coins className="h-4 w-4"/> Confirm Entry</span>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
