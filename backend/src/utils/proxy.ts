import { ProxyAgent } from "undici";

const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.HTTP_PROXY;

let cachedAgent: ProxyAgent | undefined;

export function getProxyDispatcher(): ProxyAgent | undefined {
  if (cachedAgent) return cachedAgent;
  if (proxyUrl) {
    try {
      cachedAgent = new ProxyAgent(proxyUrl);
      return cachedAgent;
    } catch (e) {
      console.warn("[Proxy] Failed to create ProxyAgent:", e);
      return undefined;
    }
  }
  return undefined;
}

export async function fetchWithProxy(
  url: string | URL,
  init?: RequestInit
): Promise<Response> {
  const dispatcher = getProxyDispatcher();
  const options: any = { ...init };
  if (dispatcher) {
    options.dispatcher = dispatcher;
  }
  return fetch(url, options);
}
