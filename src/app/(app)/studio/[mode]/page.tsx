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
import { VideoForm } from "@/components/video/video-form";
import { getPreferredTemplateOrder } from "@/lib/creative-dna/template-preference";
import { TEMPLATE_IDS } from "@/lib/poster/template-ids";
import { SocialPreviewModal } from "@/components/social-preview/social-preview-modal";
import { NavIcons } from "@/components/icons";

const MODES = ["captions", "poster", "video"] as const;
type Mode = (typeof MODES)[number];

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

      {mode === "captions" && <CaptionsMode companyName={company.name} />}
      {mode === "poster" && <PosterMode companyId={company.id} companyName={company.name} />}
      {mode === "video" && <VideoMode companyId={company.id} companyName={company.name} voiceEngine={company.voiceEngine} />}
    </div>
  );
}

async function CaptionsMode({ companyName }: { companyName: string }) {
  const dict = getDictionary(await getLocale());
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.studio.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.studio.subtitle(companyName)}</p>
      </div>
      <GenerateCaptionForm />
    </div>
  );
}

async function PosterMode({ companyId, companyName }: { companyId: string; companyName: string }) {
  const dict = getDictionary(await getLocale());

  const [photoAssets, posters, brandKit, preferredTemplates] = await Promise.all([
    // Excludes posterOutput and brandKitLogo assets — a generated
    // poster or the brand logo are both real MediaAssets, but offering
    // either back as a "photo" background would let a poster get
    // composited into another poster, or the logo used as a background
    // photo (confusing, and exactly the kind of synthetic-on-synthetic
    // output CLAUDE.md's authenticity rule is against). Only genuinely
    // uploaded photos belong here.
    db.mediaAsset.findMany({
      where: {
        companyId,
        mimeType: { startsWith: "image/" },
        posterOutput: null,
        brandKitLogo: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, fileName: true },
    }),
    db.poster.findMany({
      where: { companyId },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
    }),
    db.brandKit.findUnique({ where: { companyId }, include: { logoAsset: true } }),
    getPreferredTemplateOrder(companyId, TEMPLATE_IDS),
  ]);
  const companyLogoUrl = brandKit?.logoAsset ? storage.url(brandKit.logoAsset.storageKey) : null;

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
                    captionText={poster.headline}
                  />
                )}
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
}: {
  companyId: string;
  companyName: string;
  voiceEngine: "FREE" | "BYOK";
}) {
  const dict = getDictionary(await getLocale());

  const [assets, videos, voiceCredential, brandKit] = await Promise.all([
    // Excludes brand logos and previously-generated posters/videos —
    // none of those are real B-roll footage (see Phase 3's photo-picker
    // fix for the same category of bug with poster backgrounds).
    db.mediaAsset.findMany({
      where: {
        companyId,
        posterOutput: null,
        videoOutput: null,
        brandKitLogo: null,
        OR: [{ mimeType: { startsWith: "image/" } }, { mimeType: { startsWith: "video/" } }],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, fileName: true, mimeType: true },
    }),
    db.video.findMany({
      where: { companyId },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
    }),
    db.providerCredential.findFirst({
      where: { companyId, provider: { in: ["OPENAI", "ELEVENLABS"] } },
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

      <VideoForm assets={assets} narrationAvailable={narrationAvailable} />

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
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
