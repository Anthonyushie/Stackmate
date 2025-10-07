// Global fetch interceptor for dev mode to route all Hiro API calls through Vite proxy
// Adds concurrency limiting, Retry-After handling, and jittered backoff for resilience

const originalFetch = window.fetch;

const isDev = import.meta.env.DEV;

declare global {
  interface Window {
    __HIRO_INTERCEPT_ACTIVE?: boolean;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryAfter(header: string | null | undefined): number | null {
  if (!header) return null;
  const s = header.trim();
  // Seconds
  if (/^\d+$/.test(s)) {
    const secs = parseInt(s, 10);
    return Number.isFinite(secs) ? secs * 1000 : null;
  }
  // HTTP-date
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const ms = t - Date.now();
    return ms > 0 ? ms : 0;
  }
  return null;
}

function nextDelay(prev: number, factor: number, max: number): number {
  const base = Math.min(prev * factor, max);
  // 50-100% jitter of the base delay
  const jittered = Math.floor(base / 2 + Math.random() * (base / 2));
  return Math.max(100, jittered);
}

// Simple global concurrency limiter for Hiro calls
const MAX_CONCURRENT = Number((import.meta as any).env?.VITE_HIRO_MAX_CONCURRENT ?? 2);
const MIN_GAP_MS = Number((import.meta as any).env?.VITE_HIRO_MIN_GAP_MS ?? 150);
let active = 0;
const queue: Array<() => void> = [];
let lastStart = 0;

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = async () => {
      try {
        const now = Date.now();
        const waitGap = Math.max(0, MIN_GAP_MS - (now - lastStart));
        if (waitGap) await sleep(waitGap);
        lastStart = Date.now();
        active++;
        try {
          const result = await task();
          resolve(result);
        } finally {
          active--;
          const next = queue.shift();
          if (next) next();
        }
      } catch (e) {
        reject(e);
      }
    };

    if (active < MAX_CONCURRENT) run();
    else queue.push(run);
  });
}

if (isDev) {
  // Signal to the rest of the app that the interceptor is active
  window.__HIRO_INTERCEPT_ACTIVE = true;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let url: string;

    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      url = String(input);
    }

    // Identify Hiro requests (direct host or via local proxy path)
    let isHiroRequest = url.includes('api.testnet.hiro.so') || url.includes('api.hiro.so') || url.includes('/hiro') || url.includes('/hiro-mainnet');

    // Intercept Hiro API calls and route through proxy (host -> proxy path)
    if (url.includes('api.testnet.hiro.so')) {
      url = url.replace('https://api.testnet.hiro.so', '/hiro');
      console.log('[fetch-intercept] Proxying testnet request:', url);
      isHiroRequest = true;
    } else if (url.includes('api.hiro.so') && !url.includes('testnet')) {
      url = url.replace('https://api.hiro.so', '/hiro-mainnet');
      console.log('[fetch-intercept] Proxying mainnet request:', url);
      isHiroRequest = true;
    }

    // Retry + concurrency logic for Hiro requests
    if (isHiroRequest) {
      const maxRetries = Number((import.meta as any).env?.VITE_HIRO_MAX_RETRIES ?? 3);
      let delay = Number((import.meta as any).env?.VITE_HIRO_INITIAL_DELAY_MS ?? 1000);
      const maxDelay = Number((import.meta as any).env?.VITE_HIRO_MAX_DELAY_MS ?? 10000);
      const factor = Number((import.meta as any).env?.VITE_HIRO_BACKOFF_FACTOR ?? 2);

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const doFetch = async (): Promise<Response> => {
            if (typeof input === 'string') return originalFetch(url, init);
            if (input instanceof URL) return originalFetch(new URL(url), init);
            if (input instanceof Request) return originalFetch(new Request(url, input), init);
            return originalFetch(url, init);
          };

          // Concurrency limit Hiro requests
          const response = await schedule(doFetch);

          // Retry on 429 or 5xx
          if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
            const header = response.headers.get('retry-after');
            const headerDelay = parseRetryAfter(header);
            const wait = Math.min(Math.max(100, headerDelay ?? delay), maxDelay);
            console.warn(`[fetch-intercept] ${response.status} on ${url}, retrying in ${wait}ms (attempt ${attempt + 1}/${maxRetries})`);
            await sleep(wait);
            delay = nextDelay(delay, factor, maxDelay);
            continue;
          }

          return response;
        } catch (err) {
          if (attempt < maxRetries) {
            const wait = Math.min(Math.max(100, delay), 10000);
            console.warn(`[fetch-intercept] Network error on ${url}, retrying in ${wait}ms (attempt ${attempt + 1}/${maxRetries})`, err);
            await sleep(wait);
            delay = nextDelay(delay, 2, 10000);
            continue;
          }
          throw err;
        }
      }
    }

    // Non-Hiro (or after retries exhausted) - pass through normally
    if (typeof input === 'string') {
      return originalFetch(url, init);
    } else if (input instanceof URL) {
      return originalFetch(new URL(url), init);
    } else if (input instanceof Request) {
      return originalFetch(new Request(url, input), init);
    }

    return originalFetch(url, init);
  };

  console.log('[fetch-intercept] Dev mode: Hiro calls proxied via Vite with concurrency limit and Retry-After/backoff handling');
}

export {};
