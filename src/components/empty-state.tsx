import type { LucideIcon } from "lucide-react";

// One shared shape for every "nothing here yet" moment — icon, a plain
// headline, and an encouraging line of guidance, instead of a bare
// sentence of text or a blank area. Server-renderable (no client state),
// so every empty state in the app (Media Library, Poster/Video Studio,
// Campaigns) can use it directly.
export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-paper-border dark:border-night-border px-6 py-10 text-center">
      <Icon size={28} className="text-ink-soft dark:text-ink-soft-dark" aria-hidden="true" />
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-ink-soft dark:text-ink-soft-dark">{hint}</p>}
    </div>
  );
}
