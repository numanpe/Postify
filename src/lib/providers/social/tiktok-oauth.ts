import "server-only";

const AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize";
const TOKEN_BASE = "https://open.tiktokapis.com/v2/oauth/token/";
const API_BASE = "https://open.tiktokapis.com/v2";

function getAppCredentials(): { clientKey: string; clientSecret: string } {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error(
      "TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET are not set. Register a TikTok Developer app and request the Content Posting API's video.publish scope (see TIKTOK_REQUIRES_APP_REVIEW in publish/platform-status.ts — an unaudited app can only publish privately) before connecting an account.",
    );
  }
  return { clientKey, clientSecret };
}

function getRedirectUri(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL is not set — required to build the OAuth redirect_uri.");
  }
  return `${appUrl.replace(/\/$/, "")}/api/social/tiktok/callback`;
}

// video.publish is the only scope this integration needs — it covers
// both direct FILE_UPLOAD publishing and status polling on TikTok's
// Content Posting API. Verified against TikTok's current developer
// docs: apps that haven't passed TikTok's audit are restricted to
// SELF_ONLY (private) posts regardless of scope — see
// platform-status.ts, enforced in tiktok-provider.ts by hardcoding
// privacy_level rather than exposing a control that would silently fail.
const SCOPES = "video.publish";

export function buildAuthorizeUrl(state: string): string {
  const { clientKey } = getAppCredentials();
  const url = new URL(AUTH_BASE);
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

export interface TikTokToken {
  accessToken: string;
  openId: string;
  expiresInSec: number;
}

export async function exchangeCodeForToken(code: string): Promise<TikTokToken> {
  const { clientKey, clientSecret } = getAppCredentials();
  const response = await fetch(TOKEN_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(),
    }),
  });
  const body = (await response.json()) as {
    access_token?: string;
    open_id?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token || !body.open_id) {
    throw new Error(body.error_description ?? body.error ?? `TikTok token exchange failed (${response.status}).`);
  }
  return { accessToken: body.access_token, openId: body.open_id, expiresInSec: body.expires_in ?? 86400 };
}

export interface TikTokAccountInfo {
  openId: string;
  displayName: string;
}

export async function getAccountInfo(accessToken: string): Promise<TikTokAccountInfo> {
  const url = new URL(`${API_BASE}/user/info/`);
  url.searchParams.set("fields", "open_id,display_name");
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as {
    data?: { user?: { open_id?: string; display_name?: string } };
    error?: { message?: string; code?: string };
  };
  if (!response.ok || body.error?.code === "error") {
    throw new Error(body.error?.message ?? `TikTok user info fetch failed (${response.status}).`);
  }
  const user = body.data?.user;
  if (!user?.open_id) {
    throw new Error("TikTok user info response was missing open_id.");
  }
  return { openId: user.open_id, displayName: user.display_name ?? user.open_id };
}

export { API_BASE as TIKTOK_API_BASE };
