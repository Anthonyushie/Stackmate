// Fetch wrapper with retry and backoff for Hiro API calls

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const opts = { ...defaultRetryOptions, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      
      // 429 (rate limit) or 5xx (server error) - retry
      if (res.status === 429 || res.status >= 500) {
        if (attempt < opts.maxRetries) {
          console.warn(`[fetchWithRetry] ${res.status} on ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${opts.maxRetries})`);
          await sleep(delay);
          delay = Math.min(delay * opts.backoffFactor, opts.maxDelayMs);
          continue;
        }
      }
      
      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt < opts.maxRetries) {
        console.warn(`[fetchWithRetry] Network error on ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${opts.maxRetries})`, err);
        await sleep(delay);
        delay = Math.min(delay * opts.backoffFactor, opts.maxDelayMs);
        continue;
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${opts.maxRetries} retries`);
}
