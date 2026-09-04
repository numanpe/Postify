import "server-only";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Real defense-in-depth against brute-force/enumeration/abuse on the
// auth surface — never core functionality the app should die without.
// Fails OPEN (allows the request through, logs a warning) on a missing
// config or a real Redis outage: this project's own priority order ranks
// reliability above security when they conflict, and one Redis hiccup
// should never lock every user out of login.
const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : null;

// One limiter per real abuse surface, not one shared bucket — a signup
// burst shouldn't consume a different user's login attempts, and each
// surface has a real, different-shaped abuse pattern (brute-force login
// is fast/repeated; a real signup or reset request is rare).
const limiters = redis
  ? {
      login: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 m"), prefix: "ratelimit:login" }),
      signup: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 h"), prefix: "ratelimit:signup" }),
      "password-reset": new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        prefix: "ratelimit:password-reset",
      }),
      // 15-feature request, Tier 1 #3 (2026-09-04) — the one genuinely
      // new PUBLIC, unauthenticated write endpoint this app has (submit
      // a testimonial, which triggers a real poster generation). A
      // human filling out a real form a handful of times is normal; a
      // script hammering it to burn quota or spam junk text is not.
      "testimonial-submit": new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 h"),
        prefix: "ratelimit:testimonial-submit",
      }),
    }
  : null;

export type RateLimitAction = "login" | "signup" | "password-reset" | "testimonial-submit";

// x-forwarded-for is the real client IP on Vercel (and behind any
// standard reverse proxy) — req.ip isn't available from a Server Action,
// only from a Route Handler/middleware, so this is the one real signal
// available here. Falls back to a shared bucket (not per-IP) if the
// header is genuinely absent (e.g. plain `next dev` with no proxy) —
// still real protection against a single bad actor, just not per-client
// in that specific environment.
export async function checkRateLimit(action: RateLimitAction): Promise<{ allowed: true } | { allowed: false }> {
  if (!limiters) {
    console.warn(`[rate-limit] Upstash not configured — "${action}" is unthrottled.`);
    return { allowed: true };
  }

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  try {
    const { success } = await limiters[action].limit(ip);
    return { allowed: success };
  } catch (error) {
    console.warn(`[rate-limit] Upstash call failed for "${action}" — allowing the request through.`, error);
    return { allowed: true };
  }
}
