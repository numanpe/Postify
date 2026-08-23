"use client";

export interface TopicSuggestion {
  label: string;
  topic: string;
}

// Part 1 of the malformed-topic fix (prevention half — topic-guard.ts
// is the backstop half). Shows a company's real, industry-relevant
// starting points by default, filtered live as the user types — never
// a restriction, free typing always still works. Selecting one fills
// the field with `topic` (grammatically safe for template
// substitution — see industry-packs.ts's own doc comment on why
// `label` and `topic` are deliberately different strings).
export function TopicSuggestions({
  suggestions,
  currentValue,
  onSelect,
  label,
}: {
  suggestions: TopicSuggestion[];
  currentValue: string;
  onSelect: (topic: string) => void;
  label: string;
}) {
  const query = currentValue.trim().toLowerCase();
  const filtered = query ? suggestions.filter((s) => s.label.toLowerCase().includes(query)) : suggestions;

  if (filtered.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {filtered.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onSelect(s.topic)}
            className="min-h-[36px] rounded-full border border-paper-border px-2.5 py-1 text-xs font-medium hover:bg-paper-card dark:border-night-border dark:hover:bg-night-card"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
