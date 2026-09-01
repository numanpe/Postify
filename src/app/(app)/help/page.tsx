import { getLocale } from "@/lib/i18n/get-locale";
import { HELP_CONTENT } from "@/lib/i18n/help-content";
import { NavIcons } from "@/components/icons";

// Part 3's real help page. No requireCompany() of its own — reads no
// company-scoped data, and the (app) route group's layout.tsx already
// gates every page under it on requireCompany(), so this only ever
// renders for an authenticated user with an active company anyway.
export default async function HelpPage() {
  const locale = await getLocale();
  const content = HELP_CONTENT[locale];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <NavIcons.help size={20} aria-hidden="true" />
          {content.pageTitle}
        </h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{content.pageIntro}</p>
      </div>

      <nav aria-label={content.pageTitle} className="flex flex-wrap gap-2 text-sm">
        {content.sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-full border border-paper-border px-3 py-1 text-ink-soft hover:text-ink dark:border-night-border dark:text-ink-soft-dark dark:hover:text-ink-dark"
          >
            {section.title}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-8">
        {content.sections.map((section) => (
          <section key={section.id} id={section.id} className="flex scroll-mt-4 flex-col gap-2">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="text-sm leading-relaxed text-ink-soft dark:text-ink-soft-dark">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
