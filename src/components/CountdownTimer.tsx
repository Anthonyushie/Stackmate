import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getTimeRemaining } from '../lib/time-utils';
import { colors, shadows } from '../styles/neo-brutal-theme';

export interface CountdownTimerProps {
  deadline: number;
  className?: string;
}

function pad2(n: number) { return n < 10 ? `0${n}` : String(n); }

export default function CountdownTimer({ deadline, className = '' }: CountdownTimerProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const time = useMemo(() => getTimeRemaining(deadline), [deadline, tick]);

  const { hours, minutes, seconds, isExpired, totalSeconds } = time;

  const bgColor = useMemo(() => {
    if (isExpired) return colors.dark;
    if (totalSeconds < 300) return colors.error;
    if (totalSeconds < 3600) return colors.secondary;
    if (totalSeconds < 6 * 3600) return colors.accent;
    return colors.success;
  }, [isExpired, totalSeconds]);

  const shouldPulse = !isExpired && totalSeconds < 300;

  if (isExpired) {
    return (
      <motion.div
        style={{
          display: 'inline-flex',
          padding: '12px 24px',
          background: colors.dark,
          border: `6px solid ${colors.border}`,
          boxShadow: shadows.brutal,
        }}
        className={className}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 900,
            fontSize: 'clamp(24px, 4vw, 32px)',
            color: colors.white,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          ENDED
        </span>
      </motion.div>
    );
  }

  const hh = hours >= 100 ? String(hours) : pad2(hours);
  const mm = pad2(minutes);
  const ss = pad2(seconds);

  return (
    <motion.div
      animate={shouldPulse ? { scale: [1, 1.05, 1] } : {}}
      transition={{ repeat: Infinity, duration: 1 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '16px 24px',
        background: bgColor,
        border: `6px solid ${colors.border}`,
        boxShadow: shadows.brutal,
      }}
      className={className}
    >
      {/* Hours */}
      <DigitGroup digits={hh} />
      <Separator />
      {/* Minutes */}
      <DigitGroup digits={mm} />
      <Separator />
      {/* Seconds */}
      <DigitGroup digits={ss} />
    </motion.div>
  );
}

function DigitGroup({ digits }: { digits: string }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {digits.split('').map((d, i) => (
        <Digit key={i} value={d} />
      ))}
    </div>
  );
}

function Digit({ value }: { value: string }) {
  return (
    <div
      style={{
        width: 'clamp(24px, 4vw, 32px)',
        height: 'clamp(36px, 6vw, 48px)',
        background: colors.dark,
        border: `3px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 900,
        fontSize: 'clamp(20px, 3.5vw, 28px)',
        color: colors.primary,
        textShadow: `0 0 8px ${colors.primary}, 2px 2px 0px ${colors.border}`,
        letterSpacing: '-0.02em',
      }}
    >
      {value}
    </div>
  );
}

function Separator() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '6px',
          height: '6px',
          background: colors.dark,
          border: `2px solid ${colors.border}`,
        }}
      />
      <div
        style={{
          width: '6px',
          height: '6px',
          background: colors.dark,
          border: `2px solid ${colors.border}`,
        }}
      />
    </div>
  );
}
