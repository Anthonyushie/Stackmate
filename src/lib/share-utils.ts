export type ShareType = 'solve' | 'win' | 'invite';

export function generateShareText(type: ShareType, data?: any): string {
  if (type === 'solve') {
    const t = data?.durationText || data?.duration || '';
    return `I just solved a chess puzzle in ${t}! Think you can beat me? 🏆`;
  }
  if (type === 'win') {
    const amt = data?.amountStx || data?.amount || '';
    return `I won ${amt} STX playing chess puzzles! 💰`;
  }
  return 'Join me solving chess puzzles for STX';
}

export function shareToTwitter(text: string, url?: string) {
  try {
    const base = 'https://twitter.com/intent/tweet';
    const params = new URLSearchParams();
    params.set('text', text);
    if (url) params.set('url', url);
    const href = `${base}?${params.toString()}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  } catch {}
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {}
  return false;
}
