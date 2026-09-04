import Link from "next/link";

import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { NavIcons, ActionIcons } from "@/components/icons";

// Hub for the free growth-tools batch (2026-09-04) — a single nav entry
// (not one per feature) since this is explicitly a growing family of
// small tools, not one feature; consolidating avoids bloating the
// "More" overflow menu as later tiers add more of these. Each card
// below links to its own real, working page — never a placeholder
// "Coming soon" card, per CLAUDE.md's no-fake-functionality rule.
export default async function GrowthHubPage() {
  const dict = getDictionary(await getLocale()).growth;

  const tools = [
    { href: "/growth/reviews", title: dict.reviewsTitle, desc: dict.reviewsDesc, icon: ActionIcons.share },
    { href: "/growth/testimonials", title: dict.testimonialsTitle, desc: dict.testimonialsDesc, icon: NavIcons.media },
    { href: "/growth/promo-codes", title: dict.promoCodesTitle, desc: dict.promoCodesDesc, icon: NavIcons.growth },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.subtitle}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="flex flex-col gap-2 rounded-lg border border-paper-border p-4 hover:bg-paper-card dark:border-night-border dark:hover:bg-night-card"
          >
            <tool.icon size={20} aria-hidden="true" className="text-primary dark:text-primary-dark" />
            <span className="font-medium">{tool.title}</span>
            <span className="text-sm text-ink-soft dark:text-ink-soft-dark">{tool.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
