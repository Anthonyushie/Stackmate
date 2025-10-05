import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';
import useWallet from '../hooks/useWallet';
import { getLeaderboard, type LeaderboardEntry } from '../lib/contracts';
import { truncateMiddle } from '../lib/stacks';
import { colors, shadows } from '../styles/neo-brutal-theme';
import NeoBadge from './neo/NeoBadge';

export interface LiveLeaderboardProps {
  puzzleId: number | bigint;
  className?: string;
  limit?: number;
  refreshIntervalMs?: number;
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function formatTime(total: number | bigint) {
  const v = typeof total === 'bigint' ? Number(total) : total;
  const m = Math.floor(v / 60);
  const s = v % 60;
  return `${pad(m)}:${pad(s)}`;
}

function getMedalIcon(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

function getRankColor(rank: number) {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return colors.white;
}

export default function LiveLeaderboard({ puzzleId, className = '', limit = 10, refreshIntervalMs = 10000 }: LiveLeaderboardProps) {
  const { network, getAddress } = useWallet();
  const address = (getAddress() || '').toLowerCase();

  const q = useQuery<LeaderboardEntry[]>({
    queryKey: ['live-leaderboard', network, String(puzzleId)],
    queryFn: async () => {
      const list = await getLeaderboard({ puzzleId, network });
      return list.filter(x => x.isCorrect).sort((a, b) => (a.solveTime < b.solveTime ? -1 : a.solveTime > b.solveTime ? 1 : 0));
    },
    refetchInterval: refreshIntervalMs,
    refetchOnWindowFocus: false,
  });

  const full = q.data || [];
  const userIndex = useMemo(() => full.findIndex(e => (e.player || '').toLowerCase() === address), [full, address]);
  const top = useMemo(() => full.slice(0, limit), [full, limit]);
  const showUserExtra = userIndex >= limit && userIndex >= 0;
  const userEntry = showUserExtra ? full[userIndex] : null;

  const listRef = useRef<HTMLDivElement>(null);
  const userRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userRowRef.current && listRef.current) {
      userRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [userIndex, full.length]);

  const loading = q.isLoading && !q.data;

  return (
    <div className={className}>
      {/* Header */}
      <motion.div
        initial={{ rotate: -1, y: -10, opacity: 0 }}
        animate={{ rotate: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300 }}
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          background: colors.accent,
          border: `6px solid ${colors.border}`,
          boxShadow: shadows.brutal,
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900,
            fontSize: 'clamp(18px, 3vw, 24px)',
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            color: colors.dark,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Trophy className="h-6 w-6" />
          LIVE LEADERBOARD
        </div>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: '10px',
            textTransform: 'uppercase',
            opacity: 0.7,
            marginTop: '4px',
          }}
        >
          Updates every {Math.floor(refreshIntervalMs/1000)}s
        </div>
      </motion.div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0.4, 0.7, 0.4], y: 0 }}
              transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1 }}
              style={{
                height: '64px',
                background: colors.white,
                border: `4px solid ${colors.border}`,
                boxShadow: shadows.brutalSmall,
              }}
            />
          ))}
        </div>
      )}

      {/* Leaderboard entries */}
      {!loading && (
        <div ref={listRef} style={{ display: 'grid', gap: '12px', maxHeight: '480px', overflowY: 'auto', paddingRight: '8px' }}>
          <AnimatePresence initial={false}>
            {top.map((row, i) => {
              const rank = i + 1;
              const isYou = (row.player || '').toLowerCase() === address;
              const medal = getMedalIcon(rank);
              const bgColor = getRankColor(rank);
              const rotation = i % 3 === 0 ? -1 : i % 3 === 1 ? 1 : 0;

              return (
                <motion.div
                  key={(row.player || '') + String(row.solveTime) + String(i)}
                  layout
                  initial={{ opacity: 0, y: 20, rotate: rotation }}
                  animate={{ opacity: 1, y: 0, rotate: rotation }}
                  exit={{ opacity: 0, y: -20 }}
                  whileHover={{ y: -4, rotate: 0, boxShadow: shadows.brutalLarge }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  ref={isYou ? userRowRef : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    background: isYou ? colors.primary : bgColor,
                    border: `${isYou ? '6px' : '4px'} solid ${colors.border}`,
                    boxShadow: isYou ? shadows.brutal : shadows.brutalSmall,
                    position: 'relative',
                  }}
                >
                  {/* Rank Circle */}
                  <div
                    style={{
                      minWidth: medal ? '48px' : '48px',
                      height: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: medal ? 'transparent' : colors.dark,
                      border: medal ? 'none' : `4px solid ${colors.border}`,
                      borderRadius: '50%',
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 900,
                      fontSize: medal ? '32px' : '20px',
                      color: medal ? 'transparent' : colors.primary,
                      textShadow: medal ? 'none' : `0 0 4px ${colors.primary}`,
                    }}
                  >
                    {medal || rank}
                  </div>

                  {/* Player address */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: 'clamp(12px, 2vw, 14px)',
                        color: colors.dark,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {truncateMiddle(row.player || '')}
                    </div>
                    {isYou && (
                      <NeoBadge color={colors.dark} size="sm">
                        YOU
                      </NeoBadge>
                    )}
                  </div>

                  {/* Solve time */}
                  <div
                    style={{
                      padding: '8px 12px',
                      background: colors.dark,
                      border: `3px solid ${colors.border}`,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 900,
                      fontSize: 'clamp(14px, 2.5vw, 18px)',
                      color: colors.primary,
                      textShadow: `0 0 4px ${colors.primary}`,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {formatTime(row.solveTime)}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* User's row if outside top limit */}
          {showUserExtra && userEntry && (
            <motion.div
              key={(userEntry.player || '') + String(userEntry.solveTime) + '-you'}
              layout
              initial={{ opacity: 0, y: 20, rotate: -1 }}
              animate={{ opacity: 1, y: 0, rotate: -1 }}
              whileHover={{ y: -4, rotate: 0, boxShadow: shadows.brutalLarge }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              ref={userRowRef}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: colors.primary,
                border: `6px solid ${colors.border}`,
                boxShadow: shadows.brutal,
                marginTop: '8px',
              }}
            >
              <div
                style={{
                  minWidth: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: colors.dark,
                  border: `4px solid ${colors.border}`,
                  borderRadius: '50%',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: '20px',
                  color: colors.primary,
                  textShadow: `0 0 4px ${colors.primary}`,
                }}
              >
                {userIndex + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                    fontSize: 'clamp(12px, 2vw, 14px)',
                    color: colors.dark,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {truncateMiddle(userEntry.player || '')}
                </div>
                <NeoBadge color={colors.dark} size="sm">
                  YOU
                </NeoBadge>
              </div>

              <div
                style={{
                  padding: '8px 12px',
                  background: colors.dark,
                  border: `3px solid ${colors.border}`,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 900,
                  fontSize: 'clamp(14px, 2.5vw, 18px)',
                  color: colors.primary,
                  textShadow: `0 0 4px ${colors.primary}`,
                  letterSpacing: '-0.02em',
                }}
              >
                {formatTime(userEntry.solveTime)}
              </div>
            </motion.div>
          )}

          {/* Empty/low entries state */}
          {full.length > 0 && full.length < 3 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                padding: '16px',
                background: colors.white,
                border: `4px solid ${colors.border}`,
                boxShadow: shadows.brutalSmall,
                textAlign: 'center',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                fontSize: '14px',
                textTransform: 'uppercase',
                opacity: 0.6,
              }}
            >
              Waiting for more solvers…
            </motion.div>
          )}

          {full.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                padding: '16px',
                background: colors.white,
                border: `4px solid ${colors.border}`,
                boxShadow: shadows.brutalSmall,
                textAlign: 'center',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                fontSize: '14px',
                textTransform: 'uppercase',
                opacity: 0.6,
              }}
            >
              No entries yet
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
