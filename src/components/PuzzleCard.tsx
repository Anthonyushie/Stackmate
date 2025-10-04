import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Users, Clock, Coins, Play, CheckCircle2, Crown, Zap } from 'lucide-react';
import { colors, shadows, getDifficultyColor } from '../styles/neo-brutal-theme';
import NeoButton from './neo/NeoButton';

export type Difficulty = 'beginner' | 'intermediate' | 'expert';

export interface PuzzleCardProps {
  difficulty: Difficulty;
  entryFee: string | number | bigint;
  prizePool: string | number | bigint;
  playerCount: number;
  userBestTime?: number | bigint | null;
  deadline: number | Date;
  onEnter: () => Promise<void> | void;
  entered?: boolean;
  winner?: boolean;
  className?: string;
}

function fmtStx(v: string | number | bigint): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'bigint') return v.toString();
  return Number.isFinite(v) ? String(v) : String(v);
}

function fmtTime(total: number | bigint | null | undefined) {
  if (total === null || total === undefined) return '—';
  const n = typeof total === 'bigint' ? Number(total) : total;
  const m = Math.floor(n / 60);
  const s = n % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
}

function deadlineToMs(deadline: number | Date): number {
  if (deadline instanceof Date) return deadline.getTime();
  return deadline > 1e12 ? deadline : deadline * 1000;
}

function useCountdown(deadline: number | Date) {
  const target = deadlineToMs(deadline);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const label = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  return { secondsLeft: diff, label };
}

const difficultyRotations: Record<Difficulty, number> = {
  beginner: -2,
  intermediate: 1,
  expert: -1,
};

export default function PuzzleCard({
  difficulty,
  entryFee,
  prizePool,
  playerCount,
  userBestTime,
  deadline,
  onEnter,
  entered = false,
  winner = false,
  className = '',
}: PuzzleCardProps) {
  const bgColor = getDifficultyColor(difficulty);
  const { label: countdown, secondsLeft } = useCountdown(deadline);
  const ended = secondsLeft <= 0;

  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);
  const prevPrize = useRef<string>('');
  const pp = fmtStx(prizePool);

  useEffect(() => {
    if (prevPrize.current && prevPrize.current !== pp) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 800);
      return () => clearTimeout(t);
    }
    prevPrize.current = pp;
  }, [pp]);

  const canEnter = !loading && !entered && !ended;
  const rotation = difficultyRotations[difficulty];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9, rotate: rotation }}
      whileInView={{ opacity: 1, y: 0, scale: 1, rotate: rotation }}
      viewport={{ once: true }}
      whileHover={{ y: -12, rotate: 0, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      style={{
        backgroundColor: bgColor,
        border: `6px solid ${colors.border}`,
        boxShadow: shadows.brutal,
        padding: '32px',
        position: 'relative',
        overflow: 'hidden',
      }}
      className={className}
    >
      {/* Stripe pattern overlay */}
      <div 
        className="stripes-pattern absolute inset-0 pointer-events-none"
        style={{ opacity: 0.1 }}
      />

      {/* Header with badges */}
      <div className="flex items-start justify-between gap-3 mb-6 relative z-10">
        <div style={{
          background: colors.dark,
          border: `4px solid ${colors.border}`,
          boxShadow: shadows.brutalSmall,
          padding: '8px 16px',
          transform: 'rotate(-2deg)',
        }}>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900,
            fontSize: '20px',
            textTransform: 'uppercase',
            color: colors.white,
            letterSpacing: '-0.02em',
          }}>
            {difficulty}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {winner && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300 }}
              style={{
                background: colors.primary,
                border: `3px solid ${colors.border}`,
                boxShadow: shadows.brutalSmall,
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Crown className="h-4 w-4" style={{ color: colors.dark }} />
              <span style={{ fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', color: colors.dark }}>
                WINNER
              </span>
            </motion.div>
          )}
          {entered && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{
                background: colors.accent2,
                border: `3px solid ${colors.border}`,
                boxShadow: shadows.brutalSmall,
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 className="h-4 w-4" style={{ color: colors.dark }} />
              <span style={{ fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', color: colors.dark }}>
                ENTERED
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Entry fee badge */}
      <div style={{
        background: colors.white,
        border: `4px solid ${colors.border}`,
        boxShadow: shadows.brutalSmall,
        padding: '12px 16px',
        marginBottom: '24px',
        transform: 'rotate(1deg)',
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '14px',
          fontWeight: 700,
          marginBottom: '4px',
          color: colors.dark,
        }}>
          ENTRY FEE
        </div>
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          fontSize: '24px',
          color: colors.dark,
        }}>
          {fmtStx(entryFee)} STX
        </div>
      </div>

      {/* Prize Pool - MASSIVE */}
      <motion.div
        animate={pulse ? { 
          scale: [1, 1.1, 1], 
          rotate: [0, -3, 3, 0] 
        } : {}}
        transition={{ duration: 0.5, type: 'spring', stiffness: 300 }}
        style={{
          background: colors.dark,
          border: `6px solid ${colors.border}`,
          boxShadow: shadows.brutalLarge,
          padding: '24px',
          marginBottom: '20px',
          textAlign: 'center',
          transform: 'rotate(-2deg)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <Trophy className="h-6 w-6" style={{ color: colors.primary }} />
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '16px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: colors.primary,
          }}>
            PRIZE POOL
          </div>
        </div>
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          fontSize: '56px',
          color: colors.white,
          lineHeight: 1,
          textShadow: `4px 4px 0px ${colors.primary}`,
        }}>
          {pp}
        </div>
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          fontSize: '32px',
          color: colors.primary,
          marginTop: '4px',
        }}>
          STX
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div style={{
          background: colors.white,
          border: `3px solid ${colors.border}`,
          boxShadow: shadows.brutalSmall,
          padding: '12px',
          textAlign: 'center',
        }}>
          <Users className="h-4 w-4 mx-auto mb-2" style={{ color: colors.dark }} />
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 700,
            marginBottom: '4px',
            color: colors.dark,
          }}>
            PLAYERS
          </div>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900,
            fontSize: '24px',
            color: colors.dark,
          }}>
            {playerCount}
          </div>
        </div>

        <div style={{
          background: colors.white,
          border: `3px solid ${colors.border}`,
          boxShadow: shadows.brutalSmall,
          padding: '12px',
          textAlign: 'center',
        }}>
          <Clock className="h-4 w-4 mx-auto mb-2" style={{ color: colors.dark }} />
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 700,
            marginBottom: '4px',
            color: colors.dark,
          }}>
            YOUR BEST
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            fontSize: '18px',
            color: colors.dark,
          }}>
            {fmtTime(userBestTime)}
          </div>
        </div>

        <div style={{
          background: ended ? colors.error : colors.white,
          border: `3px solid ${colors.border}`,
          boxShadow: shadows.brutalSmall,
          padding: '12px',
          textAlign: 'center',
        }}>
          <Clock className="h-4 w-4 mx-auto mb-2" style={{ color: ended ? colors.white : colors.dark }} />
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 700,
            marginBottom: '4px',
            color: ended ? colors.white : colors.dark,
          }}>
            {ended ? 'ENDED' : 'TIME LEFT'}
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            fontSize: '14px',
            color: ended ? colors.white : colors.dark,
          }}>
            {ended ? '00:00' : countdown}
          </div>
        </div>
      </div>

      {/* Enter Button */}
      <motion.button
        whileHover={canEnter ? { scale: 1.02, y: -2 } : {}}
        whileTap={canEnter ? { scale: 0.98, y: 2 } : {}}
        onClick={async () => {
          if (!canEnter) return;
          try {
            setLoading(true);
            await Promise.resolve(onEnter());
          } finally {
            setLoading(false);
          }
        }}
        disabled={!canEnter}
        style={{
          width: '100%',
          background: canEnter ? colors.dark : '#999',
          border: `5px solid ${colors.border}`,
          boxShadow: canEnter ? shadows.brutal : shadows.brutalSmall,
          padding: '20px',
          cursor: canEnter ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          fontSize: '24px',
          textTransform: 'uppercase',
          color: colors.white,
          letterSpacing: '-0.02em',
        }}
      >
        {loading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Zap className="h-6 w-6" />
            </motion.div>
            ENTERING...
          </>
        ) : entered ? (
          <>
            <CheckCircle2 className="h-6 w-6" />
            ENTERED
          </>
        ) : ended ? (
          <>
            <Clock className="h-6 w-6" />
            CLOSED
          </>
        ) : (
          <>
            <Play className="h-6 w-6" fill="currentColor" />
            ENTER NOW
          </>
        )}
      </motion.button>
    </motion.div>
  );
}
