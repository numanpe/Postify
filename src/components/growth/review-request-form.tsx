"use client";

import { useActionState, useRef, useState } from "react";

import { draftReviewRequest } from "@/lib/actions/review-request";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

// Deep-link recipient is the CUSTOMER, not the business itself (a
// message can't usefully target "yourself" when the point is asking a
// different person to leave a review) — customerPhone is optional; left
// blank, wa.me opens WhatsApp's own contact picker so the business
// picks who to send to each time, which is the actually useful pattern
// for a message that goes to a different customer on every send. The
// business's OWN WhatsApp number (Company.whatsappNumber) is what gates
// this feature being available at all (see the page's own check) —
// proof they've set up their own business WhatsApp, not the deep
// link's own destination.
function buildWhatsAppHref(text: string, customerPhone: string): string {
  const digits = customerPhone.replace(/[^0-9]/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function ReviewRequestForm() {
  const [state, action, pending] = useActionState(draftReviewRequest, undefined);
  const dict = useDict().reviewRequest;
  const [customerPhone, setCustomerPhone] = useState("");
  const attemptRef = useRef(0);
  const attemptInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <form
        action={action}
        onSubmit={() => {
          attemptRef.current += 1;
          if (attemptInputRef.current) attemptInputRef.current.value = String(attemptRef.current);
        }}
        className="flex flex-col gap-3"
      >
        <input ref={attemptInputRef} type="hidden" name="attempt" defaultValue={0} />

        <div className="flex flex-col gap-2">
          <label htmlFor="customerPhone" className="text-sm font-medium">
            {dict.customerPhoneLabel}
          </label>
          <input
            id="customerPhone"
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="+971 5X XXX XXXX"
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          />
          <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.customerPhoneHint}</p>
        </div>

        <Button type="submit" pending={pending} pendingLabel="…">
          {state ? dict.regenerate : dict.title}
        </Button>
      </form>

      {state?.status === "success" && (
        <div className="flex flex-col gap-3 rounded-md border border-paper-border p-4 dark:border-night-border">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark">{dict.messagePreviewLabel}</span>
            <p className="text-sm">{state.text}</p>
          </div>
          <a
            href={buildWhatsAppHref(state.text, customerPhone)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-paper dark:bg-primary-dark dark:text-night"
          >
            {dict.openWhatsapp}
          </a>
        </div>
      )}
    </div>
  );
}
