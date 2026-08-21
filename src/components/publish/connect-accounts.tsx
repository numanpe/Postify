import type { SocialPlatform } from "@prisma/client";

import { disconnectSocialAccount } from "@/lib/actions/publish";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { requiresAppReview } from "@/lib/providers/social/platform-status";

interface ConnectedAccount {
  id: string;
  platform: string;
  displayName: string;
  tokenExpiresAt: Date;
}

export async function ConnectAccounts({ accounts }: { accounts: ConnectedAccount[] }) {
  const dict = getDictionary(await getLocale()).publish;
  const platformLabels: Record<string, string> = {
    FACEBOOK: dict.platformFacebook,
    INSTAGRAM: dict.platformInstagram,
    LINKEDIN: dict.platformLinkedIn,
    TIKTOK: dict.platformTikTok,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-ink-soft dark:text-ink-soft-dark">{dict.connectedAccounts}</h2>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/social/meta/callback"
            className="rounded-md border border-paper-border dark:border-night-border px-3 py-1.5 text-sm font-medium hover:bg-paper-card dark:hover:bg-night-card"
          >
            {dict.connectButton}
          </a>
          <a
            href="/api/social/linkedin/callback"
            className="rounded-md border border-paper-border dark:border-night-border px-3 py-1.5 text-sm font-medium hover:bg-paper-card dark:hover:bg-night-card"
          >
            {dict.connectLinkedIn}
          </a>
          <a
            href="/api/social/tiktok/callback"
            className="rounded-md border border-paper-border dark:border-night-border px-3 py-1.5 text-sm font-medium hover:bg-paper-card dark:hover:bg-night-card"
          >
            {dict.connectTikTok}
          </a>
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.noAccounts}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map((account) => {
            const expired = account.tokenExpiresAt < new Date();
            const pendingReview = requiresAppReview(account.platform as SocialPlatform);
            return (
              <li
                key={account.id}
                className="flex flex-col gap-1 rounded-md border border-paper-border dark:border-night-border px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span>
                    {platformLabels[account.platform] ?? account.platform} — {account.displayName}
                    {expired && <span className="ms-2 text-xs text-amber-600 dark:text-amber-400">{dict.reconnectNeeded}</span>}
                  </span>
                  <form action={disconnectSocialAccount.bind(null, account.id)}>
                    <button
                      type="submit"
                      className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark"
                    >
                      {dict.disconnect}
                    </button>
                  </form>
                </div>
                {pendingReview && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">{dict.pendingAppReview}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
