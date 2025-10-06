// Global fetch interceptor for dev mode to route all Hiro API calls through Vite proxy

const originalFetch = window.fetch;

const isDev = import.meta.env.DEV;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (isDev) {
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

    const isHiroRequest = url.includes('api.testnet.hiro.so') || url.includes('api.hiro.so');

    // Intercept Hiro API calls and route through proxy
    if (url.includes('api.testnet.hiro.so')) {
      url = url.replace('https://api.testnet.hiro.so', '/hiro');
      console.log('[fetch-intercept] Proxying testnet request:', url);
    } else if (url.includes('api.hiro.so') && !url.includes('testnet')) {
      url = url.replace('https://api.hiro.so', '/hiro-mainnet');
      console.log('[fetch-intercept] Proxying mainnet request:', url);
    }

    // Retry logic for Hiro requests
    if (isHiroRequest) {
      const maxRetries = 3;
      let delay = 1000;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          let response: Response;

          if (typeof input === 'string') {
            response = await originalFetch(url, init);
          } else if (input instanceof URL) {
            response = await originalFetch(new URL(url), init);
          } else if (input instanceof Request) {
            response = await originalFetch(new Request(url, input), init);
          } else {
            response = await originalFetch(url, init);
          }

          // Retry on 429 or 5xx
          if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
            console.warn(`[fetch-intercept] ${response.status} on ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await sleep(delay);
            delay = Math.min(delay * 2, 10000);
            continue;
          }

          return response;
        } catch (err) {
          if (attempt < maxRetries) {
            console.warn(`[fetch-intercept] Network error on ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, err);
            await sleep(delay);
            delay = Math.min(delay * 2, 10000);
            continue;
          }
          throw err;
        }
      }
    }

    // Non-Hiro requests - pass through normally
    if (typeof input === 'string') {
      return originalFetch(url, init);
    } else if (input instanceof URL) {
      return originalFetch(new URL(url), init);
    } else if (input instanceof Request) {
      return originalFetch(new Request(url, input), init);
    }
    
    return originalFetch(url, init);
  };

  console.log('[fetch-intercept] Dev mode: Hiro API calls will be proxied through Vite with retry on 429/5xx');
}

export {};
