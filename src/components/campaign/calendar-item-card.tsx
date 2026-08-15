import Image from "next/image";

import { storage } from "@/lib/storage";
import { approveCampaignItem, regenerateCampaignItem, removeCampaignItem } from "@/lib/actions/campaign";
import type { CampaignItemStatus } from "@prisma/client";

const STATUS_STYLES: Record<CampaignItemStatus, string> = {
  PENDING: "bg-paper-card dark:bg-night-card text-ink-soft dark:text-ink-soft-dark",
  GENERATING: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  READY: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  FAILED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  APPROVED: "bg-green-600 text-white",
};

interface CalendarItemCardProps {
  item: {
    id: string;
    angle: string;
    status: CampaignItemStatus;
    errorMessage: string | null;
    poster: {
      asset: { storageKey: string; width: number | null; height: number | null };
    } | null;
  };
}

// Server component — the "Manage" disclosure is a native <details>
// element and every action is a plain bound server action form, so no
// client-side state is needed for what's otherwise a fully interactive
// card (approve / edit + regenerate / remove).
export function CalendarItemCard({ item }: CalendarItemCardProps) {
  return (
    <div
      data-campaign-item-id={item.id}
      className="flex flex-col gap-1 rounded-md border border-paper-border dark:border-night-border bg-paper dark:bg-night-card p-1.5 text-xs"
    >
      <span className={`w-fit rounded px-1.5 py-0.5 font-medium ${STATUS_STYLES[item.status]}`}>
        {item.status}
      </span>

      {item.poster?.asset && (
        <Image
          src={storage.url(item.poster.asset.storageKey)}
          alt={item.angle}
          width={item.poster.asset.width ?? 200}
          height={item.poster.asset.height ?? 200}
          className="aspect-square w-full rounded object-cover"
          unoptimized
        />
      )}

      <p className="line-clamp-2 text-ink-soft dark:text-ink-soft-dark" title={item.angle}>
        {item.angle}
      </p>

      {item.errorMessage && (
        <p className="text-red-600 dark:text-red-400" title={item.errorMessage}>
          {item.errorMessage.length > 40 ? `${item.errorMessage.slice(0, 40)}…` : item.errorMessage}
        </p>
      )}

      <details>
        <summary className="cursor-pointer text-ink-soft dark:text-ink-soft-dark">Manage</summary>
        <div className="mt-1 flex flex-col gap-1">
          {item.status === "READY" && (
            <form action={approveCampaignItem.bind(null, item.id)}>
              <button
                type="submit"
                className="w-full rounded bg-primary px-1.5 py-0.5 text-paper dark:bg-primary-dark dark:text-night"
              >
                Approve
              </button>
            </form>
          )}

          <form action={regenerateCampaignItem.bind(null, item.id)} className="flex flex-col gap-1">
            <textarea
              name="angle"
              defaultValue={item.angle}
              rows={2}
              className="rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-1 py-0.5"
            />
            <button type="submit" className="rounded border border-paper-border dark:border-night-border px-1.5 py-0.5">
              {item.status === "FAILED" ? "Retry" : "Regenerate"}
            </button>
          </form>

          <form action={removeCampaignItem.bind(null, item.id)}>
            <button
              type="submit"
              className="w-full rounded border border-paper-border dark:border-night-border px-1.5 py-0.5 text-red-600 dark:text-red-400"
            >
              Remove
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
