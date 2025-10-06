// Global fetch interceptor for dev mode to route all Hiro API calls through Vite proxy

const originalFetch = window.fetch;

const isDev = import.meta.env.DEV;

if (isDev) {
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
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

    // Intercept Hiro API calls and route through proxy
    if (url.includes('api.testnet.hiro.so')) {
      url = url.replace('https://api.testnet.hiro.so', '/hiro');
      console.log('[fetch-intercept] Proxying testnet request:', url);
    } else if (url.includes('api.hiro.so') && !url.includes('testnet')) {
      url = url.replace('https://api.hiro.so', '/hiro-mainnet');
      console.log('[fetch-intercept] Proxying mainnet request:', url);
    }

    // Call original fetch with modified URL
    if (typeof input === 'string') {
      return originalFetch(url, init);
    } else if (input instanceof URL) {
      return originalFetch(new URL(url), init);
    } else if (input instanceof Request) {
      return originalFetch(new Request(url, input), init);
    }
    
    return originalFetch(url, init);
  };

  console.log('[fetch-intercept] Dev mode: Hiro API calls will be proxied through Vite');
}

export {};
