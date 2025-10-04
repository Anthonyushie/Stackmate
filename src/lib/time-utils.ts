import { formatDistanceToNow } from 'date-fns';

function toMs(timestamp: number): number {
  return timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
}

export function formatDuration(totalSeconds: number | bigint): string {
  const s = typeof totalSeconds === 'bigint' ? Number(totalSeconds) : Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

export function formatSolveTime(milliseconds: number | bigint): string {
  const ms = typeof milliseconds === 'bigint' ? Number(milliseconds) : Math.max(0, Math.floor(milliseconds));
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ss = seconds < 10 ? `0${seconds}` : String(seconds);
  return `${minutes}:${ss}`;
}

export function getTimeRemaining(deadline: number): { hours: number; minutes: number; seconds: number; isExpired: boolean; totalSeconds: number } {
  const now = Date.now();
  const end = toMs(deadline);
  const diffMs = end - now;
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds, isExpired: diffMs <= 0, totalSeconds };
}

export function formatRelativeTime(timestamp: number): string {
  const date = new Date(toMs(timestamp));
  return formatDistanceToNow(date, { addSuffix: true });
}
