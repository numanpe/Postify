import "server-only";

import { db } from "@/lib/db";
import { fetchWithRetry } from "../http";

// Built against docs.zernio.com's real, current documentation (fetched
// and verified on 2026-09-04 before this file was written): the
// embedded "headless" connect flow, profile creation, and page-
// selection endpoints — all real request/response shapes below are
// taken directly from those docs, not guessed. Same base URL the
// publish-side zernio-adapter.ts already uses.
const API_BASE = "https://zernio.com/api/v1";

export class ZernioConnectError extends Error {}

// Zernio's own real platform slugs (confirmed via docs.zernio.com's
// quickstart, "replace twitter with any of these:") mapped to this
// app's SocialPlatform enum — only the 4 platforms Postify actually
// supports elsewhere are included here.
export const ZERNIO_PLATFORM_SLUGS = ["facebook", "instagram", "linkedin", "tiktok"] as const;
export type ZernioPlatformSlug = (typeof ZERNIO_PLATFORM_SLUGS)[number];
export const ZERNIO_SLUG_TO_SOCIAL_PLATFORM: Record<ZernioPlatformSlug, "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "TIKTOK"> = {
  facebook: "FACEBOOK",
  instagram: "INSTAGRAM",
  linkedin: "LINKEDIN",
  tiktok: "TIKTOK",
};
export function isZernioPlatformSlug(value: string): value is ZernioPlatformSlug {
  return (ZERNIO_PLATFORM_SLUGS as readonly string[]).includes(value);
}

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

// Every real account connection in Zernio is scoped to a profile (their
// docs: "Profiles group your social accounts together... one profile
// per customer" for a multi-tenant integration like this one) — but
// this app's real architecture is per-company BYOK (each company brings
// its own separate Zernio account), not one Postify-level account
// managing many customer profiles. So "one profile" here just means the
// single real profile this company's own Zernio account uses for
// everything it connects through Postify — created once, reused always.
export async function ensureZernioProfile(credentialId: string, apiKey: string): Promise<string> {
  const credential = await db.aggregatorCredential.findUnique({
    where: { id: credentialId },
    select: { zernioProfileId: true },
  });
  if (credential?.zernioProfileId) return credential.zernioProfileId;

  const response = await fetchWithRetry(
    `${API_BASE}/profiles`,
    {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({ name: "Postify", description: "Accounts connected through Postify" }),
    },
    20_000,
  );
  if (!response.ok) {
    throw new ZernioConnectError(`Couldn't set up your Zernio profile (${response.status}).`);
  }
  const result = (await response.json()) as { profile?: { _id?: string } };
  const profileId = result.profile?._id;
  if (!profileId) {
    throw new ZernioConnectError("Zernio didn't return a profile id.");
  }

  await db.aggregatorCredential.update({ where: { id: credentialId }, data: { zernioProfileId: profileId } });
  return profileId;
}

export async function startHeadlessConnect(
  apiKey: string,
  platform: string,
  profileId: string,
  redirectUrl: string,
): Promise<{ authUrl: string }> {
  const url = new URL(`${API_BASE}/connect/${platform}`);
  url.searchParams.set("profileId", profileId);
  url.searchParams.set("redirect_url", redirectUrl);
  url.searchParams.set("headless", "true");

  const response = await fetchWithRetry(url.toString(), { headers: authHeaders(apiKey) }, 20_000);
  if (!response.ok) {
    throw new ZernioConnectError(`Zernio couldn't start the connection (${response.status}).`);
  }
  const result = (await response.json()) as { authUrl?: string };
  if (!result.authUrl) {
    throw new ZernioConnectError("Zernio didn't return a real authorization link.");
  }
  return { authUrl: result.authUrl };
}

export interface SelectablePage {
  id: string;
  name: string;
}

export async function listSelectablePages(
  apiKey: string,
  platform: string,
  profileId: string,
  tempToken: string,
): Promise<SelectablePage[]> {
  const url = new URL(`${API_BASE}/connect/${platform}/select-page`);
  url.searchParams.set("profileId", profileId);
  url.searchParams.set("tempToken", tempToken);

  const response = await fetchWithRetry(url.toString(), { headers: authHeaders(apiKey) }, 20_000);
  if (!response.ok) {
    throw new ZernioConnectError(
      `Zernio couldn't list your real ${platform} pages — the connection may have expired. Try connecting again.`,
    );
  }
  const result = (await response.json()) as { pages?: { id: string; name: string }[] };
  return result.pages ?? [];
}

export interface ConfirmedAccount {
  accountId: string;
}

// One real call per selected page — the API takes a single pageId, so a
// multi-select confirmation on our side (the picker UI) means one
// sequential call per chosen account, not one batch call.
export async function confirmPageSelection(
  apiKey: string,
  platform: string,
  params: { profileId: string; pageId: string; tempToken: string; userProfile: unknown; redirectUrl: string },
): Promise<ConfirmedAccount> {
  const response = await fetchWithRetry(
    `${API_BASE}/connect/${platform}/select-page`,
    {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        profileId: params.profileId,
        pageId: params.pageId,
        tempToken: params.tempToken,
        userProfile: params.userProfile,
        redirect_url: params.redirectUrl,
      }),
    },
    20_000,
  );
  if (!response.ok) {
    throw new ZernioConnectError(`Zernio couldn't finish connecting that account (${response.status}).`);
  }
  const result = (await response.json()) as { account?: { accountId?: string } };
  if (!result.account?.accountId) {
    throw new ZernioConnectError("Zernio didn't return a real connected account id.");
  }
  return { accountId: result.account.accountId };
}
