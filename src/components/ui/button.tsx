import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./spinner";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pending?: boolean;
  pendingLabel?: ReactNode;
  children: ReactNode;
  // A prop, not a className override — two Tailwind classes of equal
  // specificity (text-base vs text-sm) race on generated stylesheet
  // order, not on className string order, so "override via className"
  // isn't reliable for anything this base className already sets.
  size?: "sm" | "base";
}

// The one primary-CTA treatment used everywhere a form submits: brand-red
// fill, built-in spinner swap while pending. Secondary/inline text actions
// (Remove, Cancel, Retry) stay plain buttons styled at the call site —
// this component is only for the "big button that does the main thing."
export function Button({
  pending = false,
  pendingLabel,
  children,
  className = "",
  size = "base",
  disabled,
  ...props
}: ButtonProps) {
  // py-2 (not py-1.5) keeps "sm" visually compact while landing closer
  // to a real tappable height on touch screens — a mobile audit measured
  // the old py-1.5 at 32px, under the ~40-44px tap-target guideline.
  // min-h-[48px] is a direct guarantee on top of that padding math
  // rather than trusting text/line-height alone to clear the real
  // 48px touch-target floor.
  const sizeClasses = size === "sm" ? "min-h-[48px] px-3 py-2 text-sm" : "min-h-[48px] px-4 py-2 text-base";

  return (
    <button
      {...props}
      disabled={disabled || pending}
      className={`inline-flex items-center gap-2 rounded-lg bg-primary font-medium text-paper transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-primary-dark dark:text-night dark:hover:bg-primary-dark/90 ${sizeClasses} ${className}`}
    >
      {pending && <Spinner />}
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}
