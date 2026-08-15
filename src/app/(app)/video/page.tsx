import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { VideoForm } from "@/components/video/video-form";

export default async function VideoPage() {
  const { company } = await requireCompany();

  const [assets, videos, openAiCredential] = await Promise.all([
    // Excludes brand logos and previously-generated posters/videos —
    // none of those are real B-roll footage (see Phase 3's photo-picker
    // fix for the same category of bug with poster backgrounds).
    db.mediaAsset.findMany({
      where: {
        companyId: company.id,
        posterOutput: null,
        videoOutput: null,
        brandKitLogo: null,
        OR: [{ mimeType: { startsWith: "image/" } }, { mimeType: { startsWith: "video/" } }],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, fileName: true, mimeType: true },
    }),
    db.video.findMany({
      where: { companyId: company.id },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
    }),
    db.providerCredential.findUnique({
      where: { companyId_provider: { companyId: company.id, provider: "OPENAI" } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Video Studio</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
          Generate a short video for {company.name}: script, real/AI B-roll, captions, music, and
          your branding.
        </p>
      </div>

      <VideoForm assets={assets} hasOpenAiKey={!!openAiCredential} />

      {videos.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-ink-soft dark:text-ink-soft-dark">Previous videos</h2>
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            {videos.map((video) => (
              <li
                key={video.id}
                className="flex flex-col gap-1 rounded-lg border border-paper-border dark:border-night-border p-2"
              >
                <video
                  src={storage.url(video.asset.storageKey)}
                  controls
                  className="w-full rounded-md bg-black"
                />
                <p className="truncate text-xs font-medium" title={video.topic}>
                  {video.topic}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
