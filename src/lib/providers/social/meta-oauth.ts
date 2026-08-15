import "server-only";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function getAppCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      "META_APP_ID/META_APP_SECRET are not set. Register a Meta Developer app (Business type, Facebook Login + Pages API products) and add its credentials before connecting a Page.",
    );
  }
  return { appId, appSecret };
}

function getRedirectUri(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL is not set — required to build the OAuth redirect_uri.");
  }
  return `${appUrl.replace(/\/$/, "")}/api/social/meta/callback`;
}

// Page-level permissions only — Postify never publishes to a personal
// profile, only Pages/Business assets the connecting user administers.
const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

export function buildAuthorizeUrl(state: string): string {
  const { appId } = getAppCredentials();
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

type GraphError = { error?: { message?: string } };

async function graphFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString());
  const body = (await response.json()) as T & GraphError;
  if (!response.ok || body.error) {
    throw new Error(
      body.error?.message ?? `Meta Graph API request to ${path} failed (${response.status}).`,
    );
  }
  return body;
}

export async function exchangeCodeForUserToken(code: string): Promise<string> {
  const { appId, appSecret } = getAppCredentials();
  const body = await graphFetch<{ access_token: string }>("/oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: getRedirectUri(),
    code,
  });
  return body.access_token;
}

// Short-lived (~1-2hr) user token -> long-lived (~60 day) user token. Page
// access tokens derived from a long-lived user token inherit that
// long-lived window, which is why Postify never re-derives a short-lived
// one.
export async function exchangeForLongLivedUserToken(shortLivedToken: string): Promise<string> {
  const { appId, appSecret } = getAppCredentials();
  const body = await graphFetch<{ access_token: string }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
  return body.access_token;
}

export type ConnectedPage = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramAccountId: string | null;
  instagramUsername: string | null;
};

// One call lists every Page the authorizing user administers; one call
// per Page discovers its linked Instagram Business account (Meta doesn't
// return that from /me/accounts directly). Publish calls against the IG
// account use this same Page access token — Instagram Graph API
// operations authenticate via the linked Page's token, not a separate
// IG-specific one.
export async function listConnectedPages(userAccessToken: string): Promise<ConnectedPage[]> {
  const pagesBody = await graphFetch<{
    data: { id: string; name: string; access_token: string }[];
  }>("/me/accounts", { access_token: userAccessToken, fields: "id,name,access_token" });

  return Promise.all(
    pagesBody.data.map(async (page) => {
      const igBody = await graphFetch<{
        instagram_business_account?: { id: string; username?: string };
      }>(`/${page.id}`, {
        access_token: page.access_token,
        fields: "instagram_business_account{id,username}",
      });

      return {
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        instagramAccountId: igBody.instagram_business_account?.id ?? null,
        instagramUsername: igBody.instagram_business_account?.username ?? null,
      };
    }),
  );
}
