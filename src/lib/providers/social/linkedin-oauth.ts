import "server-only";

const AUTH_BASE = "https://www.linkedin.com/oauth/v2";
const API_BASE = "https://api.linkedin.com/rest";
// LinkedIn versions its REST APIs by calendar month (YYYYMM) via this
// header, not URL versioning — bump periodically; a stale-but-still-
// supported version doesn't break, LinkedIn just stops adding new
// fields to it. Verified against the current Posts API reference
// (Microsoft Learn / li-lms-2026-08) at the time this was written.
const LINKEDIN_VERSION = "202601";

function getAppCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET are not set. Register a LinkedIn Developer app and apply for the Community Management API product (posting as an Organization requires LinkedIn's own approval — see LINKEDIN_REQUIRES_APP_REVIEW in publish/platform-status.ts) before connecting a Page.",
    );
  }
  return { clientId, clientSecret };
}

function getRedirectUri(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL is not set — required to build the OAuth redirect_uri.");
  }
  return `${appUrl.replace(/\/$/, "")}/api/social/linkedin/callback`;
}

// w_organization_social: required to post as an Organization — verified
// directly against LinkedIn's current Posts API docs before this was
// written. r_organization_admin: required to list which organizations
// the authenticating member administers (so Postify can show a real
// picker instead of asking for a raw org URN) — this second scope's
// exact product bundling was NOT independently verified the same way
// (my research focused on the publish path, not the org-listing
// endpoint). If the authorize step rejects it, that's this gating, and
// the fix is confirming the right product is attached in the LinkedIn
// Developer Console, not a code change — same disclosed-risk pattern
// meta-oauth.ts already uses for its own scope gating.
const SCOPES = ["w_organization_social", "r_organization_admin"].join(" ");

export function buildAuthorizeUrl(state: string): string {
  const { clientId } = getAppCredentials();
  const url = new URL(`${AUTH_BASE}/authorization`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SCOPES);
  return url.toString();
}

export interface LinkedInToken {
  accessToken: string;
  expiresInSec: number;
}

export async function exchangeCodeForToken(code: string): Promise<LinkedInToken> {
  const { clientId, clientSecret } = getAppCredentials();
  const response = await fetch(`${AUTH_BASE}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? `LinkedIn token exchange failed (${response.status}).`);
  }
  // LinkedIn access tokens are typically ~60 days; fall back to that if
  // expires_in is somehow absent rather than treating the token as
  // permanent.
  return { accessToken: body.access_token, expiresInSec: body.expires_in ?? 60 * 24 * 60 * 60 };
}

function linkedInHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Linkedin-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

export interface ConnectedOrganization {
  orgId: string;
  orgUrn: string;
  orgName: string;
}

// GET /rest/organizationAcls?q=roleAssignee lists every organization
// URN the authenticated member has a role on; a second call per org
// resolves its display name — mirrors meta-oauth.ts's listConnectedPages
// two-step shape (list, then enrich each).
export async function listAdministeredOrganizations(accessToken: string): Promise<ConnectedOrganization[]> {
  const aclUrl = new URL(`${API_BASE}/organizationAcls`);
  aclUrl.searchParams.set("q", "roleAssignee");
  const aclResponse = await fetch(aclUrl.toString(), { headers: linkedInHeaders(accessToken) });
  const aclBody = (await aclResponse.json()) as {
    elements?: { organization?: string }[];
    message?: string;
  };
  if (!aclResponse.ok) {
    throw new Error(aclBody.message ?? `LinkedIn organization lookup failed (${aclResponse.status}).`);
  }

  const orgUrns = [
    ...new Set((aclBody.elements ?? []).map((e) => e.organization).filter((v): v is string => !!v)),
  ];

  return Promise.all(
    orgUrns.map(async (urn) => {
      const orgId = urn.split(":").pop() ?? urn;
      const orgResponse = await fetch(`${API_BASE}/organizations/${orgId}`, {
        headers: linkedInHeaders(accessToken),
      });
      const orgBody = (await orgResponse.json()) as { localizedName?: string };
      return { orgId, orgUrn: urn, orgName: orgBody.localizedName ?? urn };
    }),
  );
}

export { linkedInHeaders, API_BASE as LINKEDIN_API_BASE };
