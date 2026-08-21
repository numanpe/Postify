"use client";

import { useId, useState } from "react";

import { useDict } from "@/components/i18n/locale-provider";
import { SocialPreviewIcons } from "@/components/icons";

type PreviewPlatform = "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "TIKTOK";

export interface SocialMediaPreviewerProps {
  mediaUrl: string;
  mediaType: "image" | "video";
  mediaWidth: number;
  mediaHeight: number;
  companyName: string;
  logoUrl?: string | null;
  captionText?: string | null;
  hashtags?: string[];
}

const TAB_ORDER: PreviewPlatform[] = ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK"];

const TAB_ACCENT: Record<PreviewPlatform, string> = {
  INSTAGRAM: "border-b-2 border-fuchsia-500 text-fuchsia-600 dark:text-fuchsia-400",
  FACEBOOK: "border-b-2 border-blue-600 text-blue-700 dark:text-blue-400",
  LINKEDIN: "border-b-2 border-sky-700 text-sky-700 dark:text-sky-400",
  TIKTOK: "border-b-2 border-ink dark:border-ink-dark text-ink dark:text-ink-dark",
};

function Avatar({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- fixed small avatar, not a Next/Image-worthy asset
    return <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-paper dark:bg-primary-dark dark:text-night">
      {initial}
    </span>
  );
}

function Media({
  mediaUrl,
  mediaType,
  fit,
  className,
}: {
  mediaUrl: string;
  mediaType: "image" | "video";
  fit: "cover" | "contain";
  className?: string;
}) {
  const fitClass = fit === "cover" ? "object-cover" : "object-contain";
  if (mediaType === "video") {
    return (
      <video
        src={mediaUrl}
        muted
        loop
        autoPlay
        playsInline
        className={`h-full w-full bg-black ${fitClass} ${className ?? ""}`}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- arbitrary source dims, rendered inside a fixed mockup frame
  return <img src={mediaUrl} alt="" className={`h-full w-full ${fitClass} ${className ?? ""}`} />;
}

function CaptionText({
  companyName,
  captionText,
  hashtags,
  placeholder,
  inline,
}: {
  companyName: string;
  captionText?: string | null;
  hashtags?: string[];
  placeholder: string;
  inline: boolean;
}) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {inline && <span className="font-semibold">{companyName} </span>}
      {captionText ? (
        <>
          {captionText}
          {hashtags && hashtags.length > 0 && (
            <span className="text-sky-700 dark:text-sky-400"> {hashtags.join(" ")}</span>
          )}
        </>
      ) : (
        <span className="text-ink-soft dark:text-ink-soft-dark">{placeholder}</span>
      )}
    </p>
  );
}

// Real cross-platform layout differences, not one generic template
// reskinned: feed-style platforms (Instagram feed, Facebook, LinkedIn)
// show media at its true aspect ratio like the real apps do (no crop);
// full-bleed vertical formats (Instagram Story, TikTok) crop to fill a
// fixed 9:16 frame, with an honest warning when the source isn't
// already vertical, since that crop is real and would otherwise be a
// surprise at actual publish time. No fabricated like/comment counts
// anywhere — this is a layout preview, not a claim about performance.
export function SocialMediaPreviewer(props: SocialMediaPreviewerProps) {
  const { mediaUrl, mediaType, mediaWidth, mediaHeight, companyName, logoUrl, captionText, hashtags } = props;
  const dict = useDict().socialPreview;
  const [tab, setTab] = useState<PreviewPlatform>("INSTAGRAM");
  const uid = useId();
  const tabId = (platform: PreviewPlatform) => `${uid}-tab-${platform}`;
  const panelId = `${uid}-panel`;

  const sourceRatio = mediaWidth / mediaHeight;
  const isVertical = Math.abs(sourceRatio - 9 / 16) < 0.08;
  const showInstagramStory = sourceRatio < 0.75; // portrait-leaning source -> Story, not Feed

  const tabLabel: Record<PreviewPlatform, string> = {
    INSTAGRAM: dict.tabInstagram,
    FACEBOOK: dict.tabFacebook,
    LINKEDIN: dict.tabLinkedin,
    TIKTOK: dict.tabTiktok,
  };

  return (
    <div className="flex flex-col gap-3">
      <nav role="tablist" className="flex gap-4 border-b border-paper-border text-sm font-medium dark:border-night-border">
        {TAB_ORDER.map((platform) => (
          <button
            key={platform}
            type="button"
            role="tab"
            id={tabId(platform)}
            aria-selected={tab === platform}
            aria-controls={panelId}
            tabIndex={tab === platform ? 0 : -1}
            onClick={() => setTab(platform)}
            className={`-mb-px pb-2 ${tab === platform ? TAB_ACCENT[platform] : "text-ink-soft dark:text-ink-soft-dark"}`}
          >
            {tabLabel[platform]}
          </button>
        ))}
      </nav>

      <div id={panelId} role="tabpanel" aria-labelledby={tabId(tab)} className="flex justify-center py-2">
        {tab === "INSTAGRAM" &&
          (showInstagramStory ? (
            <VerticalFrame
              mediaUrl={mediaUrl}
              mediaType={mediaType}
              isVertical={isVertical}
              cropWarning={dict.cropWarning}
              overlay={
                <div className="flex items-center gap-2 p-2.5">
                  <Avatar name={companyName} logoUrl={logoUrl} />
                  <span className="text-sm font-semibold text-white drop-shadow">{companyName}</span>
                  <span className="text-xs text-white/80 drop-shadow">{dict.justNow}</span>
                </div>
              }
            />
          ) : (
            <FeedCard
              companyName={companyName}
              logoUrl={logoUrl}
              mediaUrl={mediaUrl}
              mediaType={mediaType}
              sourceRatio={sourceRatio}
              timestamp={dict.justNow}
              subtitle={undefined}
              captionAbove={false}
              captionText={captionText}
              hashtags={hashtags}
              captionPlaceholder={dict.captionPlaceholder}
              icons={[
                { Icon: SocialPreviewIcons.like, key: "like" },
                { Icon: SocialPreviewIcons.comment, key: "comment" },
                { Icon: SocialPreviewIcons.send, key: "send" },
              ]}
              trailingIcon={SocialPreviewIcons.save}
            />
          ))}

        {tab === "FACEBOOK" && (
          <FeedCard
            companyName={companyName}
            logoUrl={logoUrl}
            mediaUrl={mediaUrl}
            mediaType={mediaType}
            sourceRatio={sourceRatio}
            timestamp={dict.justNow}
            subtitle={undefined}
            captionAbove
            captionText={captionText}
            hashtags={hashtags}
            captionPlaceholder={dict.captionPlaceholder}
            icons={[
              { Icon: SocialPreviewIcons.thumbsUp, key: "like" },
              { Icon: SocialPreviewIcons.comment, key: "comment" },
              { Icon: SocialPreviewIcons.share, key: "share" },
            ]}
          />
        )}

        {tab === "LINKEDIN" && (
          <FeedCard
            companyName={companyName}
            logoUrl={logoUrl}
            mediaUrl={mediaUrl}
            mediaType={mediaType}
            sourceRatio={sourceRatio}
            timestamp={dict.justNow}
            subtitle={dict.companyPage}
            captionAbove
            captionText={captionText}
            hashtags={hashtags}
            captionPlaceholder={dict.captionPlaceholder}
            icons={[
              { Icon: SocialPreviewIcons.thumbsUp, key: "like" },
              { Icon: SocialPreviewIcons.comment, key: "comment" },
              { Icon: SocialPreviewIcons.repost, key: "repost" },
              { Icon: SocialPreviewIcons.send, key: "send" },
            ]}
          />
        )}

        {tab === "TIKTOK" && (
          <VerticalFrame
            mediaUrl={mediaUrl}
            mediaType={mediaType}
            isVertical={isVertical}
            cropWarning={dict.cropWarning}
            dark
            overlay={
              <div className="flex h-full">
                <div className="flex flex-1 flex-col justify-end gap-1.5 p-3">
                  <span className="text-sm font-semibold text-white drop-shadow">{companyName}</span>
                  <CaptionText
                    companyName={companyName}
                    captionText={captionText}
                    hashtags={hashtags}
                    placeholder={dict.captionPlaceholder}
                    inline={false}
                  />
                  <div className="flex items-center gap-1.5 text-xs text-white/90 drop-shadow">
                    <SocialPreviewIcons.sound size={12} aria-hidden="true" />
                    <span className="truncate">
                      {dict.originalAudio} — {companyName}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-end gap-4 p-3">
                  <Avatar name={companyName} logoUrl={logoUrl} />
                  {[SocialPreviewIcons.like, SocialPreviewIcons.comment, SocialPreviewIcons.share].map(
                    (Icon, i) => (
                      <Icon key={i} size={26} className="text-white drop-shadow" aria-hidden="true" />
                    ),
                  )}
                </div>
              </div>
            }
          />
        )}
      </div>

      <p className="text-center text-xs text-ink-soft dark:text-ink-soft-dark">{dict.disclaimer}</p>
    </div>
  );
}

function VerticalFrame({
  mediaUrl,
  mediaType,
  isVertical,
  cropWarning,
  overlay,
  dark,
}: {
  mediaUrl: string;
  mediaType: "image" | "video";
  isVertical: boolean;
  cropWarning: string;
  overlay: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative aspect-[9/16] w-[240px] overflow-hidden rounded-xl border border-paper-border dark:border-night-border ${dark ? "bg-black" : "bg-paper-card dark:bg-night-card"}`}
      >
        <Media mediaUrl={mediaUrl} mediaType={mediaType} fit="cover" className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25">
          {overlay}
        </div>
      </div>
      {!isVertical && <p className="max-w-[240px] text-center text-xs text-amber-600 dark:text-amber-400">{cropWarning}</p>}
    </div>
  );
}

function FeedCard({
  companyName,
  logoUrl,
  mediaUrl,
  mediaType,
  sourceRatio,
  timestamp,
  subtitle,
  captionAbove,
  captionText,
  hashtags,
  captionPlaceholder,
  icons,
  trailingIcon,
}: {
  companyName: string;
  logoUrl?: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  sourceRatio: number;
  timestamp: string;
  subtitle: string | undefined;
  captionAbove: boolean;
  captionText?: string | null;
  hashtags?: string[];
  captionPlaceholder: string;
  icons: { Icon: (typeof SocialPreviewIcons)[keyof typeof SocialPreviewIcons]; key: string }[];
  trailingIcon?: (typeof SocialPreviewIcons)[keyof typeof SocialPreviewIcons];
}) {
  // Feed platforms don't crop like Stories/TikTok do — they show the
  // real aspect ratio, capped so an extreme ratio doesn't blow out the
  // card layout, exactly mirroring how these apps actually render it.
  const cappedRatio = Math.min(Math.max(sourceRatio, 0.8), 1.91);
  const TrailingIcon = trailingIcon;

  return (
    <div className="w-[320px] overflow-hidden rounded-md border border-paper-border bg-paper text-ink dark:border-night-border dark:bg-night-card dark:text-ink-dark">
      <div className="flex items-center gap-2 p-2.5">
        <Avatar name={companyName} logoUrl={logoUrl} />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{companyName}</span>
          <span className="text-xs text-ink-soft dark:text-ink-soft-dark">{subtitle ? `${subtitle} · ${timestamp}` : timestamp}</span>
        </div>
      </div>

      {captionAbove && (
        <div className="px-2.5 pb-2">
          <CaptionText
            companyName={companyName}
            captionText={captionText}
            hashtags={hashtags}
            placeholder={captionPlaceholder}
            inline={false}
          />
        </div>
      )}

      <div className="w-full bg-paper-card dark:bg-night" style={{ aspectRatio: cappedRatio }}>
        <Media mediaUrl={mediaUrl} mediaType={mediaType} fit="contain" />
      </div>

      <div className="flex items-center gap-4 p-2.5">
        {icons.map(({ Icon, key }) => (
          <Icon key={key} size={20} className="text-ink-soft dark:text-ink-soft-dark" aria-hidden="true" />
        ))}
        {TrailingIcon && <TrailingIcon size={20} className="ms-auto text-ink-soft dark:text-ink-soft-dark" aria-hidden="true" />}
      </div>

      {!captionAbove && (
        <div className="px-2.5 pb-2.5">
          <CaptionText
            companyName={companyName}
            captionText={captionText}
            hashtags={hashtags}
            placeholder={captionPlaceholder}
            inline
          />
        </div>
      )}
    </div>
  );
}
