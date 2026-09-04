"use client";

import { useActionState } from "react";

import { confirmDigestUnsubscribe, type UnsubscribeKind } from "@/lib/actions/digest-unsubscribe";
import { Button } from "@/components/ui/button";

const PENDING_LABEL: Record<"EN" | "AR", string> = { EN: "Turning off…", AR: "جارٍ الإيقاف…" };
const CONFIRM_LABEL: Record<"EN" | "AR", string> = { EN: "Turn off", AR: "إيقاف" };

export function DigestUnsubscribeForm({
  companyId,
  token,
  type,
  confirmLabel,
  note,
  doneLabel,
  locale,
}: {
  companyId: string;
  token: string;
  type: UnsubscribeKind;
  confirmLabel: string;
  note: string;
  doneLabel: string;
  locale: "EN" | "AR";
}) {
  const [state, action, pending] = useActionState(confirmDigestUnsubscribe, undefined);

  if (state?.status === "success") {
    return <p role="status" className="text-sm text-green-700 dark:text-green-400">{doneLabel}</p>;
  }

  return (
    <form action={action} className="flex flex-col items-center gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="type" value={type} />
      <p className="text-sm">{confirmLabel}</p>
      <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{note}</p>
      <Button type="submit" pending={pending} pendingLabel={PENDING_LABEL[locale]}>
        {CONFIRM_LABEL[locale]}
      </Button>
      {state?.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
