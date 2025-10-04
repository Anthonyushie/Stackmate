import { useMemo, useState } from 'react';
import { Share2, Twitter, Copy } from 'lucide-react';
import { generateShareText, shareToTwitter, copyToClipboard, type ShareType } from '../lib/share-utils';

const brutal = 'rounded-none border-[3px] border-black shadow-[6px_6px_0_#000]';

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

export interface ShareButtonProps {
  type: ShareType;
  data?: any;
  url?: string;
  className?: string;
  label?: string;
}

export default function ShareButton({ type, data, url, className = '', label = 'Share' }: ShareButtonProps) {
  const text = useMemo(() => generateShareText(type, data), [type, data]);
  const shareUrl = useMemo(() => url || (typeof window !== 'undefined' ? window.location.origin : ''), [url]);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        className={`${brutal} bg-blue-300 hover:bg-blue-400 px-3 py-2 inline-flex items-center gap-2`}
        onClick={() => shareToTwitter(text, shareUrl)}
      >
        <Twitter className="h-4 w-4" /> Tweet
      </button>
      <button
        className={`${brutal} bg-white hover:bg-zinc-100 px-3 py-2 inline-flex items-center gap-2`}
        onClick={async () => {
          const ok = await copyToClipboard(`${text}${shareUrl ? ` ${shareUrl}` : ''}`);
          toastMsg(ok ? 'Link copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
        }}
      >
        <Copy className="h-4 w-4" /> Copy link
      </button>
    </div>
  );
}
