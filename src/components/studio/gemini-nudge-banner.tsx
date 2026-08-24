"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

const DISMISS_KEY = "postify:gemini-nudge-dismissed";

function subscribe() {
  // localStorage never changes from outside this tab in a way this
  // component needs to react to — a no-op subscription is correct here,
  // same reasoning voice-input-button.tsx's browser-feature check uses.
  return () => {};
}
function getDismissedSnapshot(): boolean {
  return localStorage.getItem(DISMISS_KEY) === "1";
}
function getServerSnapshot(): boolean {
  // Never shown during SSR/first paint — corrected client-side on
  // mount, avoiding a hydration mismatch (the server can't know
  // localStorage's contents).
  return true;
}

// Part 3c.4: a gentle, dismissible, one-time nudge shown after several
// template-based generations (src/lib/gemini-nudge.ts computes `show`
// server-side). Dismissal is real but intentionally lightweight
// (localStorage, not a new Company column) — losing it on a cleared
// browser isn't a correctness problem, just means the nudge can
// reappear, which is a fine failure mode for a one-time suggestion.
export function GeminiNudgeBanner({ show, text, dismissLabel }: { show: boolean; text: string; dismissLabel: string }) {
  const previouslyDismissed = useSyncExternalStore(subscribe, getDismissedSnapshot, getServerSnapshot);
  const [justDismissed, setJustDismissed] = useState(false);

  if (!show || previouslyDismissed || justDismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm dark:border-primary-dark/30 dark:bg-primary-dark/10">
      <p>
        <Link href="/settings" className="font-medium underline">
          {text}
        </Link>
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setJustDismissed(true);
        }}
        aria-label={dismissLabel}
        className="shrink-0 text-ink-soft hover:text-ink dark:text-ink-soft-dark dark:hover:text-ink-dark"
      >
        ✕
      </button>
    </div>
  );
}
