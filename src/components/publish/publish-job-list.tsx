import { cancelPublishJob, retryPublishJob } from "@/lib/actions/publish";

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

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook Page",
  INSTAGRAM: "Instagram",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "text-neutral-500",
  SCHEDULED: "text-blue-700",
  PUBLISHING: "text-blue-700",
  PUBLISHED: "text-green-700",
  FAILED: "text-red-700",
};

export function PublishJobList({ jobs }: { jobs: JobRow[] }) {
  if (jobs.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-neutral-500">Publish history</h2>
      <ul className="flex flex-col gap-2">
        {jobs.map((job) => (
          <li
            key={job.id}
            className="flex flex-col gap-1 rounded-md border border-neutral-200 px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {PLATFORM_LABELS[job.socialAccount.platform] ?? job.socialAccount.platform} —{" "}
                {job.socialAccount.displayName}
              </span>
              <span className={STATUS_STYLES[job.status] ?? "text-neutral-500"}>{job.status}</span>
            </div>
            <p className="truncate text-neutral-600" title={job.caption}>
              {job.poster?.headline ?? "(poster removed)"} — {job.caption}
            </p>
            {job.scheduledFor && (
              <p className="text-xs text-neutral-400">
                {job.status === "SCHEDULED" ? "Scheduled for" : "Attempted"} {job.scheduledFor.toLocaleString()}
              </p>
            )}
            {job.status === "FAILED" && job.errorMessage && (
              <p className="text-xs text-red-600">{job.errorMessage}</p>
            )}
            {job.status === "PUBLISHED" && job.externalPostUrl && (
              <a
                href={job.externalPostUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-700 underline"
              >
                View post
              </a>
            )}
            <div className="flex gap-3">
              {job.status === "FAILED" && (
                <form action={retryPublishJob.bind(null, job.id)}>
                  <button type="submit" className="text-xs font-medium text-neutral-500 hover:text-neutral-900">
                    Retry
                  </button>
                </form>
              )}
              {(job.status === "SCHEDULED" || job.status === "FAILED" || job.status === "DRAFT") && (
                <form action={cancelPublishJob.bind(null, job.id)}>
                  <button type="submit" className="text-xs font-medium text-neutral-500 hover:text-neutral-900">
                    Cancel
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
