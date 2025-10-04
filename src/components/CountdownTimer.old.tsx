import { useEffect, useMemo, useState } from 'react';
import { getTimeRemaining } from '../lib/time-utils';

export interface CountdownTimerProps {
  deadline: number; // Unix timestamp (seconds or milliseconds)
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

  const colorClass = useMemo(() => {
    if (isExpired) return 'text-zinc-500';
    if (totalSeconds < 300) return 'text-red-700 animate-pulse';
    if (totalSeconds < 3600) return 'text-red-700';
    if (totalSeconds < 6 * 3600) return 'text-yellow-700';
    return 'text-green-700';
  }, [isExpired, totalSeconds]);

  if (isExpired) {
    return <span className={`font-black ${className} ${colorClass}`}>Ended</span>;
  }

  const hh = hours >= 100 ? String(hours) : pad2(hours);
  const mm = pad2(minutes);
  const ss = pad2(seconds);

  return (
    <span className={`font-black ${className} ${colorClass}`}>{hh}:{mm}:{ss}</span>
  );
}
