"use client";

import { useActionState } from "react";

import { confirmDigestUnsubscribe } from "@/lib/actions/digest-unsubscribe";
import { Button } from "@/components/ui/button";

const STRINGS = {
  EN: { confirm: "Turn off", pending: "Turning off…", done: "Done — you won't get any more weekly emails." },
  AR: { confirm: "إيقاف", pending: "جارٍ الإيقاف…", done: "تم — لن تصلك رسائل أسبوعية بعد الآن." },
} as const;

export function DigestUnsubscribeForm({
  companyId,
  token,
  confirmLabel,
  note,
  locale,
}: {
  companyId: string;
  token: string;
  confirmLabel: string;
  note: string;
  locale: "EN" | "AR";
}) {
  const [state, action, pending] = useActionState(confirmDigestUnsubscribe, undefined);
  const t = STRINGS[locale];

  if (state?.status === "success") {
    return <p role="status" className="text-sm text-green-700 dark:text-green-400">{t.done}</p>;
  }

  return (
    <form action={action} className="flex flex-col items-center gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="token" value={token} />
      <p className="text-sm">{confirmLabel}</p>
      <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{note}</p>
      <Button type="submit" pending={pending} pendingLabel={t.pending}>
        {t.confirm}
      </Button>
      {state?.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
