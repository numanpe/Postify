"use client";

import { useState, useTransition } from "react";

import { markPromoCodeRedeemed } from "@/lib/actions/promo-codes";
import { useDict } from "@/components/i18n/locale-provider";

export function PromoCodeRow({
  id,
  code,
  label,
  redemptionCount,
}: {
  id: string;
  code: string;
  label: string | null;
  redemptionCount: number;
}) {
  const dict = useDict().promoCodes;
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — the code is
      // already visible on screen either way, nothing else to do.
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-paper-border p-3 dark:border-night-border">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-base font-semibold tracking-wider">{code}</span>
        {label && <span className="text-xs text-ink-soft dark:text-ink-soft-dark">{label}</span>}
        <span className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.redeemedCount(redemptionCount)}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-paper-border px-3 py-2 text-xs font-medium hover:bg-paper-card dark:border-night-border dark:hover:bg-night-card"
        >
          {copied ? dict.copiedToast : dict.copyCode}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => markPromoCodeRedeemed(id))}
          className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-60 dark:bg-primary-dark dark:text-night"
        >
          {dict.markRedeemed}
        </button>
      </div>
    </li>
  );
}
