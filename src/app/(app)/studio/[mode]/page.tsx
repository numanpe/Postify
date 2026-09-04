import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { GenerateCaptionForm } from "@/components/studio/generate-caption-form";
import { PosterForm } from "@/components/poster/poster-form";
import { RegenerateBackgroundButton } from "@/components/poster/regenerate-background-button";
import { VideoForm } from "@/components/video/video-form";
import { getPreferredTemplateOrder } from "@/lib/creative-dna/template-preference";
import { TEMPLATE_IDS } from "@/lib/poster/template-ids";
import { SocialPreviewModal } from "@/components/social-preview/social-preview-modal";
import { VideoEditModal } from "@/components/campaign/video-edit-modal";
import { resolveSceneThumbnailUrl } from "@/lib/video/scene-thumbnails";
import { NavIcons } from "@/components/icons";
import type { VideoScriptSections } from "@/lib/providers/text/types";
import { getCompanyContext, getTopicSuggestionChips } from "@/lib/company-context";
import { getPickableMediaAssets } from "@/lib/media";

const MODES = ["captions", "poster", "video"] as const;
type Mode = (typeof MODES)[number];

// The "previous posters"/"previous videos" galleries below are a
// secondary, at-a-glance reference inside the create-content tool, not
// the primary way to browse full history (Media Library already is) —
// a simple recency cap is the right-sized fix, not full pagination.
const PREVIOUS_CREATIONS_LIMIT = 12;

// Folded from three separate pages (/studio, /poster, /video) into one
// dynamic route to reduce this deployment's Vercel Function count
// (Hobby plan's real, empirically-confirmed 12-function cap). Nav still
// shows three distinct links (see app-nav.tsx) — each just points at its
// own /studio/{mode} URL now, so the actual user-facing navigation is
// unchanged. No generation logic moved: GenerateCaptionForm/PosterForm/
// VideoForm are the exact same components, each still fetching only the
// data its own mode needs.
export default async function StudioModePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (!MODES.includes(mode as Mode)) {
    notFound();
  }

  const { company } = await requireCompany();
  const dict = getDictionary(await getLocale());
  const topicSuggestions =
    mode === "captions" || mode === "video" ? getTopicSuggestionChips(await getCompanyContext(company.id)) : [];

  const tabs: { mode: Mode; label: string; icon: typeof NavIcons.studio }[] = [
    { mode: "captions", label: dict.nav.studio, icon: NavIcons.studio },
    { mode: "poster", label: dict.nav.poster, icon: NavIcons.poster },
    { mode: "video", label: dict.nav.video, icon: NavIcons.video },
  ];

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 border-b border-paper-border dark:border-night-border pb-2 text-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.mode}
            href={`/studio/${tab.mode}`}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${
              tab.mode === mode
                ? "bg-primary text-paper dark:bg-primary-dark dark:text-night"
                : "text-ink-soft hover:bg-paper-card dark:text-ink-soft-dark dark:hover:bg-night-card"
            }`}
          >
            <tab.icon size={16} aria-hidden="true" />
            {tab.label}
          </Link>
        ))}
      </nav>

      {mode === "captions" && <CaptionsMode companyName={company.name} topicSuggestions={topicSuggestions} />}
      {mode === "poster" && <PosterMode companyId={company.id} companyName={company.name} />}
      {mode === "video" && (
        <VideoMode
          companyId={company.id}
          companyName={company.name}
          voiceEngine={company.voiceEngine}
          topicSuggestions={topicSuggestions}
        />
      )}
    </div>
  );
}

async function CaptionsMode({
  companyName,
  topicSuggestions,
}: {
  companyName: string;
  topicSuggestions: { label: string; topic: string }[];
}) {
  const dict = getDictionary(await getLocale());
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.studio.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.studio.subtitle(companyName)}</p>
      </div>
      <GenerateCaptionForm topicSuggestions={topicSuggestions} />
    </div>
  );
}

// Same private-per-file convention public-asset-links.ts/weekly-digest.ts
// already use rather than a shared export — this is the only call site
// that needs it for a poster's QR-code placeholder suggestion.
function getAppUrl(): string | null {
  const url = process.env.APP_URL;
  return url ? url.replace(/\/$/, "") : null;
}

async function PosterMode({ companyId, companyName }: { companyId: string; companyName: string }) {
  const dict = getDictionary(await getLocale());

  const [photoAssets, posters, brandKit, preferredTemplates, companyForQr] = await Promise.all([
    // Shared with every other real media picker in the app (media.ts's
    // own doc comment) — this specific call site previously never
    // excluded storageDeletedAt, a real bug: a photo cleaned up by
    // cleanupMediaStorage could still be picked here and render broken.
    getPickableMediaAssets(companyId, { includeVideo: false }),
    // Capped, most-recent-first — the same real growth-risk pagination
    // already closed for Media Library/Campaigns: a company's poster
    // history only grows, and this is a secondary "recent creations"
    // gallery inside the create-content tool, not the primary place to
    // browse full history (Media Library already is).
    db.poster.findMany({
      where: { companyId },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
      take: PREVIOUS_CREATIONS_LIMIT,
    }),
    db.brandKit.findUnique({ where: { companyId }, include: { logoAsset: true } }),
    getPreferredTemplateOrder(companyId, TEMPLATE_IDS),
    // Only the existing slug, never lazily generated here — this is a
    // placeholder suggestion on a form, not a real "visit my bio page"
    // moment, so it shouldn't create one on every poster-page load.
    db.company.findUnique({ where: { id: companyId }, select: { publicBioSlug: true } }),
  ]);
  const companyLogoUrl = brandKit?.logoAsset ? storage.url(brandKit.logoAsset.storageKey) : null;
  const appUrl = getAppUrl();
  const suggestedQrUrl =
    companyForQr?.publicBioSlug && appUrl ? `${appUrl}/bio/${companyForQr.publicBioSlug}` : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.poster.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.poster.subtitle(companyName)}</p>
      </div>

      <PosterForm
        photoAssets={photoAssets}
        defaultBackgroundSource={photoAssets.length > 0 ? "PHOTO" : "BRAND"}
        preferredTemplateOrder={preferredTemplates.map((t) => t.template)}
        suggestedQrUrl={suggestedQrUrl}
      />

      {posters.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-ink-soft dark:text-ink-soft-dark">{dict.poster.previousPosters}</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {posters.map((poster, index) => (
              <li
                key={poster.id}
                className="flex flex-col gap-1 rounded-lg border border-paper-border dark:border-night-border p-2"
              >
                <Image
                  src={storage.url(poster.asset.storageKey)}
                  alt={poster.headline}
                  width={poster.asset.width ?? 400}
                  height={poster.asset.height ?? 400}
                  className="w-full rounded-md object-cover"
                  unoptimized
                  // Only the first (most recent) poster is realistically
                  // above the fold — a real dev warning caught this grid
                  // otherwise having no priority image at all, which
                  // left Next guessing at the LCP candidate.
                  priority={index === 0}
                />
                <p className="truncate text-xs font-medium" title={poster.headline}>
                  {poster.headline}
                </p>
                {poster.asset.width && poster.asset.height && (
                  <SocialPreviewModal
                    mediaUrl={storage.url(poster.asset.storageKey)}
                    mediaType="image"
                    mediaWidth={poster.asset.width}
                    mediaHeight={poster.asset.height}
                    companyName={companyName}
                    logoUrl={companyLogoUrl}
                    // Real bug, found live (2026-09-03): this used to
                    // pass poster.headline here, which is already baked
                    // into the poster's own pixels by the render
                    // pipeline — the previewer's overlay then drew that
                    // same text a second time on top of the image
                    // itself. A Studio-generated poster has no separate,
                    // independently-composed social caption (unlike a
                    // campaign item's own real item.captionText, see
                    // calendar-item-card.tsx), so the honest fix is no
                    // caption here, not a duplicated one — the
                    // previewer's own placeholder makes that clear
                    // rather than fabricating one.
                    captionText={null}
                  />
                )}
                {poster.backgroundSource === "AI" && <RegenerateBackgroundButton posterId={poster.id} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

async function VideoMode({
  companyId,
  companyName,
  voiceEngine,
  topicSuggestions,
}: {
  companyId: string;
  companyName: string;
  voiceEngine: "FREE" | "BYOK";
  topicSuggestions: { label: string; topic: string }[];
}) {
  const dict = getDictionary(await getLocale());

  const [assets, videos, voiceCredential, brandKit] = await Promise.all([
    // Shared with every other real media picker in the app (media.ts's
    // own doc comment). Now newest-first, not oldest-first — the old
    // ordering here was the one real inconsistency among all five
    // picker call sites, with no documented reason for it, found while
    // consolidating them into one shared function.
    getPickableMediaAssets(companyId, { includeVideo: true }),
    // Capped, most-recent-first — same real growth-risk rationale as
    // the poster gallery above.
    db.video.findMany({
      where: { companyId },
      include: {
        asset: true,
        scenes: {
          include: { mediaAsset: { select: { id: true, fileName: true, storageKey: true } } },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: PREVIOUS_CREATIONS_LIMIT,
    }),
    db.providerCredential.findFirst({
      where: { companyId, provider: { in: ["OPENAI", "ELEVENLABS", "FISH_AUDIO"] } },
    }),
    db.brandKit.findUnique({ where: { companyId }, include: { logoAsset: true } }),
  ]);
  const companyLogoUrl = brandKit?.logoAsset ? storage.url(brandKit.logoAsset.storageKey) : null;

  // FREE (the default) always works — no key needed. BYOK only works
  // once a matching credential is saved. Mirrors the exact contract
  // getVoiceProviderForCompany() uses server-side.
  const narrationAvailable = voiceEngine === "FREE" || !!voiceCredential;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.video.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.video.subtitle(companyName)}</p>
      </div>

      <VideoForm assets={assets} narrationAvailable={narrationAvailable} topicSuggestions={topicSuggestions} />

      {videos.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-ink-soft dark:text-ink-soft-dark">{dict.video.previousVideos}</h2>
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            {videos.map((video) => (
              <li
                key={video.id}
                className="flex flex-col gap-1 rounded-lg border border-paper-border dark:border-night-border p-2"
              >
                <video src={storage.url(video.asset.storageKey)} controls className="w-full rounded-md bg-black" />
                <p className="truncate text-xs font-medium" title={video.topic}>
                  {video.topic}
                </p>
                {video.asset.width && video.asset.height && (
                  <SocialPreviewModal
                    mediaUrl={storage.url(video.asset.storageKey)}
                    mediaType="video"
                    mediaWidth={video.asset.width}
                    mediaHeight={video.asset.height}
                    companyName={companyName}
                    logoUrl={companyLogoUrl}
                    captionText={video.topic}
                  />
                )}
                <VideoEditModal
                  videoId={video.id}
                  videoUrl={storage.url(video.asset.storageKey)}
                  hasNarration={video.hasNarration}
                  script={video.script as unknown as VideoScriptSections}
                  scenes={video.scenes.map((scene) => ({
                    ...scene,
                    mediaAsset: scene.mediaAsset ? { id: scene.mediaAsset.id, fileName: scene.mediaAsset.fileName } : null,
                    thumbnailUrl: resolveSceneThumbnailUrl(scene),
                  }))}
                  sceneMediaAssets={assets}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
