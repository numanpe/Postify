async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// One retry for network-level failures only (timeout/abort/connection
// reset) — a fresh AbortController per attempt. Non-2xx HTTP responses
// are not retried here; callers classify those themselves (e.g. don't
// retry a 401).
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs = 20_000,
): Promise<Response> {
  try {
    return await fetchWithTimeout(url, init, timeoutMs);
  } catch {
    return fetchWithTimeout(url, init, timeoutMs);
  }
}
