import { cancelPublishJob, retryPublishJob } from "@/lib/actions/publish";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

interface JobRow {
  id: string;
  caption: string;
  status: string;
  scheduledFor: Date | null;
  errorMessage: string | null;
  externalPostUrl: string | null;
  socialAccount: { platform: string; displayName: string };
  poster: { headline: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "text-ink-soft dark:text-ink-soft-dark",
  SCHEDULED: "text-blue-700 dark:text-blue-400",
  PUBLISHING: "text-blue-700 dark:text-blue-400",
  PUBLISHED: "text-green-700 dark:text-green-400",
  FAILED: "text-red-700 dark:text-red-400",
};

export async function PublishJobList({ jobs }: { jobs: JobRow[] }) {
  if (jobs.length === 0) return null;

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const platformLabels: Record<string, string> = {
    FACEBOOK: dict.publish.platformFacebook,
    INSTAGRAM: dict.publish.platformInstagram,
  };
  const statusLabels: Record<string, string> = dict.status;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-ink-soft dark:text-ink-soft-dark">{dict.publish.history}</h2>
      <ul className="flex flex-col gap-2">
        {jobs.map((job) => (
          <li
            key={job.id}
            className="flex flex-col gap-1 rounded-md border border-paper-border dark:border-night-border px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {platformLabels[job.socialAccount.platform] ?? job.socialAccount.platform} —{" "}
                {job.socialAccount.displayName}
              </span>
              <span className={STATUS_STYLES[job.status] ?? "text-ink-soft dark:text-ink-soft-dark"}>
                {statusLabels[job.status] ?? job.status}
              </span>
            </div>
            <p className="truncate text-ink-soft dark:text-ink-soft-dark" title={job.caption}>
              {job.poster?.headline ?? dict.publish.posterRemoved} — {job.caption}
            </p>
            {job.scheduledFor && (
              <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
                {job.status === "SCHEDULED" ? dict.publish.scheduledFor : dict.publish.attempted}{" "}
                {job.scheduledFor.toLocaleString(locale)}
              </p>
            )}
            {job.status === "FAILED" && job.errorMessage && (
              <p className="text-xs text-red-600 dark:text-red-400">{job.errorMessage}</p>
            )}
            {job.status === "PUBLISHED" && job.externalPostUrl && (
              <a
                href={job.externalPostUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-700 dark:text-blue-400 underline"
              >
                {dict.publish.viewPost}
              </a>
            )}
            <div className="flex gap-3">
              {job.status === "FAILED" && (
                <form action={retryPublishJob.bind(null, job.id)}>
                  <button type="submit" className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark">
                    {dict.common.retry}
                  </button>
                </form>
              )}
              {(job.status === "SCHEDULED" || job.status === "FAILED" || job.status === "DRAFT") && (
                <form action={cancelPublishJob.bind(null, job.id)}>
                  <button type="submit" className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark">
                    {dict.common.cancel}
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
