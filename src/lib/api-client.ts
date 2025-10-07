// Fetch wrapper with retry, jittered backoff, Retry-After handling, and optional concurrency limiting for Hiro API calls

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  respectRetryAfter?: boolean;
  limitConcurrency?: boolean;
  maxConcurrent?: number;
  minGapMs?: number;
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
  respectRetryAfter: true,
  limitConcurrency: true,
  maxConcurrent: Number((import.meta as any).env?.VITE_HIRO_MAX_CONCURRENT ?? 4),
  minGapMs: Number((import.meta as any).env?.VITE_HIRO_MIN_GAP_MS ?? 120),
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryAfter(header: string | null | undefined): number | null {
  if (!header) return null;
  const s = header.trim();
  if (/^\d+$/.test(s)) {
    const secs = parseInt(s, 10);
    return Number.isFinite(secs) ? secs * 1000 : null;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const delta = t - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

function nextDelay(prev: number, factor: number, max: number): number {
  const base = Math.min(prev * factor, max);
  // 50-100% jitter of the base delay
  const jittered = Math.floor(base / 2 + Math.random() * (base / 2));
  return Math.max(100, jittered);
}

// Lightweight concurrency limiter (used when the dev fetch interceptor is not active)
let activeHiro = 0;
const queueHiro: Array<() => void> = [];
let lastStartHiro = 0;

function schedule<T>(task: () => Promise<T>, maxConcurrent: number, minGapMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = async () => {
      try {
        const now = Date.now();
        const waitGap = Math.max(0, minGapMs - (now - lastStartHiro));
        if (waitGap) await sleep(waitGap);
        lastStartHiro = Date.now();
        activeHiro++;
        try {
          const result = await task();
          resolve(result);
        } finally {
          activeHiro--;
          const next = queueHiro.shift();
          if (next) next();
        }
      } catch (e) {
        reject(e);
      }
    };

    if (activeHiro < maxConcurrent) run();
    else queueHiro.push(run);
  });
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const opts = { ...defaultRetryOptions, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelayMs;

  const isHiro = /api\.hiro\.so|api\.testnet\.hiro\.so|\/hiro(?:-mainnet)?\b/.test(url);
  const interceptActive = typeof window !== 'undefined' && (window as any).__HIRO_INTERCEPT_ACTIVE;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const doFetch = () => fetch(url, init);
      const res = (opts.limitConcurrency && isHiro && !interceptActive)
        ? await schedule(doFetch, opts.maxConcurrent, opts.minGapMs)
        : await doFetch();

      // 429 (rate limit) or 5xx (server error) - retry
      if (res.status === 429 || res.status >= 500) {
        if (attempt < opts.maxRetries) {
          let wait = delay;
          if (opts.respectRetryAfter && res.status === 429) {
            const headerDelay = parseRetryAfter(res.headers.get('retry-after'));
            if (headerDelay != null) wait = Math.max(wait, headerDelay);
          }
          wait = Math.min(Math.max(100, wait), opts.maxDelayMs);
          console.warn(`[fetchWithRetry] ${res.status} on ${url}, retrying in ${wait}ms (attempt ${attempt + 1}/${opts.maxRetries})`);
          await sleep(wait);
          delay = nextDelay(delay, opts.backoffFactor, opts.maxDelayMs);
          continue;
        }
      }

      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt < opts.maxRetries) {
        const wait = Math.min(Math.max(100, delay), opts.maxDelayMs);
        console.warn(`[fetchWithRetry] Network error on ${url}, retrying in ${wait}ms (attempt ${attempt + 1}/${opts.maxRetries})`, err);
        await sleep(wait);
        delay = nextDelay(delay, opts.backoffFactor, opts.maxDelayMs);
        continue;
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${opts.maxRetries} retries`);
}
