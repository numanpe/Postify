import { disconnectSocialAccount } from "@/lib/actions/publish";

interface ConnectedAccount {
  id: string;
  platform: string;
  displayName: string;
  tokenExpiresAt: Date;
}

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook Page",
  INSTAGRAM: "Instagram",
};

export function ConnectAccounts({ accounts }: { accounts: ConnectedAccount[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-500">Connected accounts</h2>
        <a
          href="/api/social/meta/connect"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
        >
          Connect Facebook / Instagram
        </a>
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No accounts connected yet. Connecting requires a Facebook Page you administer — an Instagram
          Business account linked to that Page connects automatically.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map((account) => {
            const expired = account.tokenExpiresAt < new Date();
            return (
              <li
                key={account.id}
                className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm"
              >
                <span>
                  {PLATFORM_LABELS[account.platform] ?? account.platform} — {account.displayName}
                  {expired && <span className="ml-2 text-xs text-amber-600">reconnect needed</span>}
                </span>
                <form action={disconnectSocialAccount.bind(null, account.id)}>
                  <button
                    type="submit"
                    className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
                  >
                    Disconnect
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
