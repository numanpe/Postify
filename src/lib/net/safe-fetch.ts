import "server-only";
import { promises as dns } from "node:dns";
import net from "node:net";

// SSRF guard for fetching a URL the user directly supplies (a pasted
// website) or a URL extracted FROM that user-controlled site's own
// HTML (an og:image/logo/favicon URL — equally attacker-influenced,
// since the site owner wrote that HTML). Both the initial hostname and
// every redirect hop are resolved and checked before any request
// reaches them — a public-looking hostname can still redirect to an
// internal address, so re-validating only the first hop isn't enough.
export class UnsafeUrlError extends Error {}

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const a = parts[0];
    const b = parts[1];
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254 cloud metadata
    if (a === 0) return true; // "this" network
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true; // loopback / unspecified
    if (/^fe[89ab][0-9a-f]?:/.test(normalized)) return true; // link-local fe80::/10
    if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true; // unique local fc00::/7
    if (normalized.startsWith("::ffff:")) {
      const embedded = normalized.slice("::ffff:".length);
      if (net.isIPv4(embedded)) return isPrivateOrReservedIp(embedded);
    }
    return false;
  }
  return true; // not a parseable IP literal — treat as unsafe rather than guess
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (hostname === "localhost") {
    throw new UnsafeUrlError(`${hostname} points to a local/internal address`);
  }
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new UnsafeUrlError(`${hostname} points to a local/internal address`);
    }
    return;
  }
  let addresses: string[];
  try {
    addresses = (await dns.lookup(hostname, { all: true })).map((r) => r.address);
  } catch {
    throw new UnsafeUrlError(`couldn't resolve ${hostname}`);
  }
  if (addresses.length === 0 || addresses.some(isPrivateOrReservedIp)) {
    throw new UnsafeUrlError(`${hostname} points to a local/internal address`);
  }
}

// Behaves like a normal following fetch() to the caller, but resolves
// and validates every hop first. redirect: "manual" on Node's fetch
// (undici) returns a real, readable 3xx response with its Location
// header intact — unlike a browser's opaque cross-origin redirect
// response — so this can inspect and re-validate each hop itself
// instead of letting the runtime follow blindly.
export async function fetchPublic(
  initialUrl: string | URL,
  init: RequestInit = {},
  maxRedirects = 5,
): Promise<{ response: Response; finalUrl: URL }> {
  let current = typeof initialUrl === "string" ? new URL(initialUrl) : initialUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new UnsafeUrlError(`${current.protocol} is not a supported protocol`);
    }
    await assertPublicHost(current.hostname);

    const response = await fetch(current.toString(), { ...init, redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, finalUrl: current };
      current = new URL(location, current);
      continue;
    }
    return { response, finalUrl: current };
  }
  throw new UnsafeUrlError("too many redirects");
}
