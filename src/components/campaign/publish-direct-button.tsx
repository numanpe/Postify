"use client";

import { useActionState } from "react";

import { publishCampaignItemDirect } from "@/lib/actions/campaign-publish";
import { useDict } from "@/components/i18n/locale-provider";
import { ActionIcons } from "@/components/icons";

// Same real disabled-while-pending guard as PublishViaAggregatorButton,
// for the "Direct API Publish" path (backed by a real PublishJob row and
// processSinglePublishJob's own compare-and-swap lock on
// PublishJob.status).
export function PublishDirectButton({
  itemId,
  accounts,
}: {
  itemId: string;
  accounts: { id: string; displayName: string }[];
}) {
  const dict = useDict().publishing;
  const [, action, pending] = useActionState(async (_prevState: null, formData: FormData) => {
    await publishCampaignItemDirect(itemId, formData);
    return null;
  }, null);

  return (
    <form action={action} className="flex flex-col gap-1">
      <select
        name="socialAccountId"
        required
        disabled={pending}
        aria-label={dict.selectAccount}
        className="rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-1 py-0.5 text-base disabled:opacity-60"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.displayName}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-paper-border dark:border-night-border px-1.5 py-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ActionIcons.publishDirect size={14} aria-hidden="true" />
        {pending ? dict.publishing : dict.publishDirect}
      </button>
    </form>
  );
}
