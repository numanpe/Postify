import { requireCompany } from "@/lib/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getInboxItems } from "@/lib/inbox";
import { platformLabel } from "@/lib/publish-targets";
import { EmptyState } from "@/components/empty-state";
import { NavIcons } from "@/components/icons";
import { InboxReplyForm } from "@/components/inbox/inbox-reply-form";

// Part 2 of the 5-feature request: real comments/DMs surfaced from the
// company's Zernio connection (the one aggregator whose real inbox API
// was verified — src/lib/inbox.ts's own doc comment), with an
// AI-drafted reply the user reviews and explicitly sends. No auto-send
// anywhere on this page.
export default async function InboxPage() {
  const { company } = await requireCompany();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.inbox;

  const result = await getInboxItems(company);

  // Plain-string subset only — see InboxReplyForm's own doc comment on
  // why passing the full dict.inbox object (which also carries
  // function-typed entries) across the Server->Client boundary throws.
  const replyFormDict = {
    generateDraft: t.generateDraft,
    generatingDraft: t.generatingDraft,
    replyPlaceholder: t.replyPlaceholder,
    send: t.send,
    sending: t.sending,
    sent: t.sent,
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{t.subtitle}</p>
      </div>

      {result.status === "not_connected" && (
        <EmptyState
          icon={NavIcons.inbox}
          title={t.notConnectedTitle}
          hint={t.notConnectedHint}
          action={{ href: "/settings", label: t.connectSettingsLink }}
        />
      )}

      {result.status === "unavailable" && (
        <EmptyState icon={NavIcons.inbox} title={t.unavailableTitle} hint={result.reason} />
      )}

      {result.status === "ok" && (
        <>
          {result.unsupportedPlatforms.length > 0 && (
            <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
              {t.unsupportedPlatformsNote(result.unsupportedPlatforms.map((p) => platformLabel(dict, p)).join(", "))}
            </p>
          )}
          {result.accountFailures.map((failure, i) => (
            <p key={i} className="text-xs text-red-600 dark:text-red-400" role="alert">
              {t.accountIssueNote(failure.platform, failure.error)}
            </p>
          ))}

          {result.items.length === 0 ? (
            <EmptyState icon={NavIcons.inbox} title={t.emptyTitle} hint={t.emptyHint} />
          ) : (
            <ul className="flex flex-col gap-3">
              {result.items.map((item) => (
                <li key={item.id} className="rounded-lg border border-paper-border dark:border-night-border p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-paper-card dark:bg-night-card px-2 py-0.5 font-medium">
                        {platformLabel(dict, item.platform)}
                      </span>
                      <span className="text-ink-soft dark:text-ink-soft-dark">
                        {item.kind === "comment" ? t.commentLabel : t.dmLabel}
                      </span>
                      <span className="font-medium">{item.authorName}</span>
                    </div>
                    <time className="text-xs text-ink-soft dark:text-ink-soft-dark" dateTime={item.createdAt.toISOString()}>
                      {item.createdAt.toLocaleDateString(locale === "ar" ? "ar" : "en", { month: "short", day: "numeric" })}
                    </time>
                  </div>
                  <p className="mb-3 text-sm">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">
                        {item.text}
                      </a>
                    ) : (
                      item.text
                    )}
                  </p>
                  <InboxReplyForm item={item} dict={replyFormDict} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
