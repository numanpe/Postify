import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Real Cloudflare siteverify call — no SDK needed, it's a single POST.
// If TURNSTILE_SECRET_KEY isn't configured, signup proceeds without a
// CAPTCHA gate (same "never a broken state without the optional key" — see
// signUp's real caller and this project's other platform-key fallbacks
// like PLATFORM_GEMINI_API_KEY) rather than locking every signup out.
export async function verifyTurnstile(token: string | null): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.warn("[turnstile] TURNSTILE_SECRET_KEY not configured — signup CAPTCHA is not enforced.");
    return true;
  }
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: secretKey, response: token }),
    });
    const result = (await response.json()) as { success: boolean };
    return result.success === true;
  } catch (error) {
    // A real Cloudflare outage shouldn't block every signup — same
    // fail-open reasoning as rate-limit.ts.
    console.warn("[turnstile] Verification request failed — allowing signup through.", error);
    return true;
  }
}
