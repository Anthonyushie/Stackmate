import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTransaction, useTxStore, explorerTxUrl } from '../hooks/useTransaction';
import useWallet from '../hooks/useWallet';

const brutal = 'rounded-none border-[3px] border-black shadow-[6px_6px_0_#000]';

export default function TransactionStatus() {
  const { items } = useTransaction();
  const dismiss = useTxStore((s) => s.remove);
  const current = useMemo(() => {
    // Prefer active; otherwise show most recent non-idle
    const active = items.find((x) => x.status === 'pending' || x.status === 'confirming');
    return active || items[0] || null;
  }, [items]);

  const autoDismiss = current && current.status === 'success';

  useEffect(() => {
    if (!autoDismiss || !current) return;
    const t = setTimeout(() => dismiss(current.id || current.txId || ''), 3000);
    return () => clearTimeout(t);
  }, [autoDismiss, current]);

  if (!current) return null;

  const { network } = useWallet();
  const url = current.url || explorerTxUrl(network, current.txId);

  const statusText =
    current.status === 'pending' ? 'Pending' :
    current.status === 'confirming' ? 'Confirming' :
    current.status === 'success' ? 'Success' : 'Failed';

  const barClass =
    current.status === 'pending' ? 'bg-yellow-400' :
    current.status === 'confirming' ? 'bg-blue-400' :
    current.status === 'success' ? 'bg-green-500' : 'bg-red-500';

  return (
    <AnimatePresence>
      <motion.div
        key={current.id}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-3"
      >
        <div className={`max-w-lg w-full ${brutal} bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-3`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-black uppercase tracking-wider">Transaction</div>
            <button className={`${brutal} bg-zinc-200 px-2 py-1`} onClick={() => dismiss(current.id || current.txId || '')}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {current.status === 'pending' && <Loader2 className="h-4 w-4 animate-spin" />}
            {current.status === 'confirming' && <Loader2 className="h-4 w-4 animate-spin" />}
            {current.status === 'success' && <CheckCircle2 className="h-4 w-4" />}
            {current.status === 'error' && <AlertTriangle className="h-4 w-4" />}
            <div className="font-bold">{statusText}</div>
            {current.txId && (
              <a className="text-xs underline ml-2" href={url} target="_blank" rel="noreferrer">View on Explorer</a>
            )}
          </div>

          <div className="h-2 mt-3 overflow-hidden ${brutal}">
            <motion.div
              key={current.status}
              className={`h-full ${barClass}`}
              initial={{ width: '10%' }}
              animate={{ width: current.status === 'success' ? '100%' : current.status === 'error' ? '100%' : ['20%','40%','60%','80%','60%'] }}
              transition={{ duration: current.status === 'confirming' ? 2 : 1.8, repeat: current.status === 'confirming' || current.status === 'pending' ? Infinity : 0 }}
            />
          </div>

          {current.error && (
            <div className="text-[10px] mt-2">{current.error}</div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
