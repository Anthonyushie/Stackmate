import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useWallet from './useWallet';
import { getPuzzleInfo, getLeaderboard, type PuzzleInfo } from '../lib/contracts';
import { fetchCallReadOnlyFunction, standardPrincipalCV, uintCV, ClarityType } from '@stacks/transactions';
import { getApiBaseUrl, getNetwork, microToStx, type NetworkName } from '../lib/stacks';

export type NotificationType = 'win' | 'new_puzzle' | 'deadline_soon' | 'overtaken';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  puzzleId?: number;
  difficulty?: string;
  amountStx?: string;
  rankChange?: { from: number; to: number };
  createdAt: number; // ms
  read: boolean;
}

interface MetaState {
  lastSeenPuzzleCount?: number;
  winNotified?: Record<string, boolean>; // key: puzzleId
  deadlineWarned?: Record<string, boolean>;
  prevRanks?: Record<string, number>; // key: puzzleId
}

function getContractIds(network: NetworkName) {
  const id = network === 'testnet' ? (import.meta as any).env?.VITE_CONTRACT_TESTNET : (import.meta as any).env?.VITE_CONTRACT_MAINNET;
  if (!id || typeof id !== 'string' || !id.includes('.')) throw new Error('Missing contract id env var');
  const [address, name] = id.split('.');
  return { address, name };
}

function storageKeys(network: NetworkName, address: string | null) {
  const who = address || 'guest';
  return {
    notif: `stackmate:notifs:${network}:${who}`,
    meta: `stackmate:notifs:meta:${network}:${who}`,
  };
}

function now() { return Date.now(); }

export default function useNotifications() {
  const { network, getAddress } = useWallet();
  const address = getAddress();
  const keys = storageKeys(network, address);

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const raw = localStorage.getItem(keys.notif);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  const metaRef = useRef<MetaState>(() => {
    try {
      const raw = localStorage.getItem(keys.meta);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }) as React.MutableRefObject<MetaState>;

  useEffect(() => {
    // reload when identity key changes
    try {
      const rawNotif = localStorage.getItem(keys.notif);
      setNotifications(rawNotif ? JSON.parse(rawNotif) : []);
      const rawMeta = localStorage.getItem(keys.meta);
      metaRef.current = rawMeta ? JSON.parse(rawMeta) : {};
    } catch {
      setNotifications([]);
      metaRef.current = {};
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, address]);

  const save = useCallback((list: NotificationItem[], meta?: MetaState) => {
    try { localStorage.setItem(keys.notif, JSON.stringify(list)); } catch {}
    if (meta) {
      try { localStorage.setItem(keys.meta, JSON.stringify(meta)); } catch {}
    }
  }, [keys.notif, keys.meta]);

  const addNotification = useCallback((n: NotificationItem) => {
    setNotifications((prev) => {
      // prevent exact duplicate ids
      if (prev.some(x => x.id === n.id)) return prev;
      const next = [n, ...prev].slice(0, 100);
      save(next);
      return next;
    });
  }, [save]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map(n => n.id === id ? { ...n, read: true } : n);
      save(next);
      return next;
    });
  }, [save]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map(n => ({ ...n, read: true }));
      save(next);
      return next;
    });
  }, [save]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const pollOnce = useCallback(async () => {
    try {
      const addr = address;
      const { address: contractAddress, name: contractName } = getContractIds(network);
      const stxNetwork = getNetwork(network);

      // New puzzles check via puzzle count
      const countCv: any = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-puzzle-count',
        functionArgs: [],
        senderAddress: addr || contractAddress,
        network: stxNetwork,
      });
      const okCount = countCv?.type === ClarityType.ResponseOk ? (countCv as any).value : null;
      const total = okCount ? (okCount as any).value as bigint : 0n;
      const totalNum = Number(total);

      const meta = metaRef.current || {};
      const winNotified = { ...(meta.winNotified || {}) };
      const deadlineWarned = { ...(meta.deadlineWarned || {}) };
      const prevRanks = { ...(meta.prevRanks || {}) };

      if (Number.isFinite(totalNum)) {
        const lastSeen = meta.lastSeenPuzzleCount ?? 0;
        if (totalNum > lastSeen) {
          // Notify per new puzzle id (lastSeen+1..totalNum)
          const newIds = Array.from({ length: totalNum - lastSeen }, (_, i) => i + lastSeen + 1);
          for (const id of newIds) {
            try {
              const info = await getPuzzleInfo({ puzzleId: id, network });
              const msg = info?.difficulty ? `New ${String(info.difficulty).charAt(0).toUpperCase() + String(info.difficulty).slice(1)} puzzle available` : 'New puzzle available';
              addNotification({
                id: `new:${id}`,
                type: 'new_puzzle',
                message: msg,
                puzzleId: id,
                difficulty: info?.difficulty,
                createdAt: now(),
                read: false,
              });
            } catch {}
          }
          metaRef.current = { ...meta, lastSeenPuzzleCount: totalNum, winNotified, deadlineWarned, prevRanks };
          save(notifications, metaRef.current);
        }
      }

      if (!addr) return; // user-specific checks below

      // Fetch user entries
      const entriesCv: any = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-user-entries',
        functionArgs: [standardPrincipalCV(addr)],
        senderAddress: addr,
        network: stxNetwork,
      });
      const okEntries = entriesCv?.type === ClarityType.ResponseOk ? (entriesCv as any).value : null;
      const entryIds: number[] = okEntries ? ((okEntries as any).list as any[]).map((cv: any) => Number(cv?.value ?? 0)).filter((n: number) => Number.isFinite(n) && n > 0) : [];

      // Current chain height for deadline checks
      let height = 0;
      try {
        const res = await fetch(`${getApiBaseUrl(network)}/v2/info`);
        const j: any = await res.json();
        height = Number(j?.stacks_tip_height ?? j?.stacks_tip?.height ?? j?.burn_block_height ?? 0) || 0;
      } catch {}

      // Iterate entries: wins, deadline soon, overtaken
      for (const id of entryIds) {
        try {
          const info: PuzzleInfo = await getPuzzleInfo({ puzzleId: id, network });

          // Win notification
          const youWon = info?.winner && addr && info.winner.toLowerCase() === addr.toLowerCase();
          if (youWon && !winNotified[String(id)]) {
            const gross = BigInt(info.stakeAmount) * BigInt(info.entryCount);
            const fee = (gross * 5n) / 100n;
            const net = gross - fee;
            const amount = microToStx(net);
            const diff = (info?.difficulty || '');
            const label = diff ? (diff.charAt(0).toUpperCase() + diff.slice(1)) : '';
            addNotification({
              id: `win:${id}`,
              type: 'win',
              message: `You won ${label} puzzle! Claim ${amount} STX`,
              puzzleId: id,
              difficulty: info?.difficulty,
              amountStx: amount,
              createdAt: now(),
              read: false,
            });
            winNotified[String(id)] = true;
          }

          // Deadline soon (<= 1 hour) for active puzzles
          const active = Boolean(info?.isActive);
          const dlBlock = Number(info?.deadline || 0);
          const blocksLeft = Math.max(0, dlBlock - (height || 0));
          const secondsLeft = blocksLeft * 600; // approx 10 minutes per block
          if (active && secondsLeft > 0 && secondsLeft <= 3600 && !deadlineWarned[String(id)]) {
            addNotification({
              id: `deadline:${id}`,
              type: 'deadline_soon',
              message: 'Puzzle deadline in 1 hour',
              puzzleId: id,
              difficulty: info?.difficulty,
              createdAt: now(),
              read: false,
            });
            deadlineWarned[String(id)] = true;
          }

          // Overtaken detection (leaderboard rank worsened)
          try {
            const lb = await getLeaderboard({ puzzleId: id, network });
            const idx = lb.findIndex(x => (x.player || '').toLowerCase() === addr.toLowerCase());
            if (idx >= 0) {
              const rank = idx + 1;
              const prev = prevRanks[String(id)];
              if (typeof prev === 'number' && rank > prev) {
                addNotification({
                  id: `overtaken:${id}:${rank}`,
                  type: 'overtaken',
                  message: 'Someone overtook your position!',
                  puzzleId: id,
                  difficulty: info?.difficulty,
                  rankChange: { from: prev, to: rank },
                  createdAt: now(),
                  read: false,
                });
              }
              prevRanks[String(id)] = rank;
            }
          } catch {}
        } catch {}
      }

      metaRef.current = { lastSeenPuzzleCount: metaRef.current?.lastSeenPuzzleCount ?? totalNum, winNotified, deadlineWarned, prevRanks };
      save(notifications, metaRef.current);
    } catch {}
  }, [address, network, notifications, save, addNotification]);

  useEffect(() => {
    let id: any;
    let stopped = false;

    const run = async () => {
      if (document.visibilityState !== 'visible') return;
      await pollOnce();
    };

    run();
    id = setInterval(run, 30_000);

    const onVis = () => { if (!stopped && document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { stopped = true; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [pollOnce]);

  return {
    notifications: useMemo(() => [...notifications].sort((a, b) => b.createdAt - a.createdAt), [notifications]),
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
