"use client";

import { useActionState } from "react";

import { publishCampaignItemViaAggregator } from "@/lib/actions/campaign-publish";
import { useDict } from "@/components/i18n/locale-provider";
import { ActionIcons } from "@/components/icons";

// Real disabled-while-pending guard for a literal double-click/double-tap
// on this card's most-used publish path — the actual common trigger for
// the race this button's server action now also locks against
// (CampaignItem.publishingLockedAt). This is the fast, visible layer;
// the server-side lock is what closes the rarer genuine-concurrent-request
// case (e.g. two open tabs).
export function PublishViaAggregatorButton({ itemId, providerName }: { itemId: string; providerName: string }) {
  const dict = useDict().publishing;
  const [, action, pending] = useActionState(async () => {
    await publishCampaignItemViaAggregator(itemId);
    return null;
  }, null);

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-paper-border dark:border-night-border px-1.5 py-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ActionIcons.publishProvider size={14} aria-hidden="true" />
        {pending ? dict.publishing : dict.publishViaProvider(providerName)}
      </button>
    </form>
  );
}
