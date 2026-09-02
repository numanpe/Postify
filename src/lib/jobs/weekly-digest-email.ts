import "server-only";
import type { Locale } from "@prisma/client";

// Real insight or an honest fallback — never both, never neither text
// silently. Computed in weekly-digest.ts against real EngagementSnapshot
// data with the same MIN_SAMPLE_SIZE=5 statistical-caution bar the rest
// of Creative DNA already uses (see aggregate.ts/learning.ts/
// smart-scheduler.ts) — a company with too little real data gets
// `insight: null`, never a fabricated pattern.
export type WeeklyDigestInsight =
  | { kind: "format"; winner: "video" | "photo"; ratio: number; sampleSize: number }
  | { kind: "day"; dayIndex: number; ratio: number; sampleSize: number };

export interface WeeklyDigestData {
  generatedCount: number;
  publishedCount: number;
  insight: WeeklyDigestInsight | null;
}

interface BuildWeeklyDigestEmailParams {
  companyName: string;
  locale: Locale;
  data: WeeklyDigestData;
  studioUrl: string;
  unsubscribeUrl: string;
}

const DAY_NAMES: Record<Locale, string[]> = {
  EN: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  AR: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
};

interface DigestStrings {
  subject: (company: string) => string;
  preheader: string;
  heading: string;
  generated: string;
  published: string;
  insightFormatVideo: (ratio: string, n: number) => string;
  insightFormatPhoto: (ratio: string, n: number) => string;
  insightDay: (day: string, ratio: string, n: number) => string;
  noInsightYet: string;
  cta: string;
  ctaGeneric: string;
  footer: string;
  unsubscribe: string;
}

const STRINGS: Record<Locale, DigestStrings> = {
  EN: {
    subject: (company: string) => `Your week on Postify — ${company}`,
    preheader: "Your weekly performance summary is ready.",
    heading: "Your week in review",
    generated: "generated",
    published: "published",
    insightFormatVideo: (ratio: string, n: number) =>
      `Videos got ${ratio}x more engagement than photos this week (based on ${n} measured posts).`,
    insightFormatPhoto: (ratio: string, n: number) =>
      `Photos got ${ratio}x more engagement than videos this week (based on ${n} measured posts).`,
    insightDay: (day: string, ratio: string, n: number) =>
      `Your ${day} posts perform ${ratio}x better than average, based on your published history (${n} posts measured).`,
    noInsightYet:
      "Not enough measured engagement yet for a real insight — keep publishing and we'll surface one as soon as the data supports it.",
    cta: "Create more content like this",
    ctaGeneric: "Open Studio",
    footer: "You're receiving this because weekly digests are on for your company.",
    unsubscribe: "Turn off weekly emails",
  },
  AR: {
    subject: (company: string) => `أسبوعك على بوستيفاي — ${company}`,
    preheader: "ملخص أدائك الأسبوعي جاهز.",
    heading: "أسبوعك في نظرة عامة",
    generated: "تم إنشاؤه",
    published: "تم نشره",
    insightFormatVideo: (ratio: string, n: number) =>
      `حصلت الفيديوهات على تفاعل أعلى بـ ${ratio} مرة من الصور هذا الأسبوع (بناءً على ${n} منشورًا تم قياسها).`,
    insightFormatPhoto: (ratio: string, n: number) =>
      `حصلت الصور على تفاعل أعلى بـ ${ratio} مرة من الفيديوهات هذا الأسبوع (بناءً على ${n} منشورًا تم قياسها).`,
    insightDay: (day: string, ratio: string, n: number) =>
      `منشوراتك يوم ${day} تحقق أداءً أفضل بـ ${ratio} مرة من المعدل، استنادًا إلى سجل نشرك (${n} منشورًا تم قياسها).`,
    noInsightYet:
      "لا تتوفر بيانات تفاعل كافية بعد لاستخلاص رؤية حقيقية — واصل النشر وسنعرضها لك بمجرد أن تدعمها البيانات.",
    cta: "أنشئ المزيد من هذا المحتوى",
    ctaGeneric: "افتح الاستوديو",
    footer: "تصلك هذه الرسالة لأن الملخص الأسبوعي مفعّل لشركتك.",
    unsubscribe: "إيقاف الرسائل الأسبوعية",
  },
};

function insightLine(t: DigestStrings, locale: Locale, insight: WeeklyDigestInsight | null): string {
  if (!insight) return t.noInsightYet;
  const ratio = insight.ratio.toFixed(1);
  if (insight.kind === "format") {
    return insight.winner === "video" ? t.insightFormatVideo(ratio, insight.sampleSize) : t.insightFormatPhoto(ratio, insight.sampleSize);
  }
  return t.insightDay(DAY_NAMES[locale][insight.dayIndex], ratio, insight.sampleSize);
}

export function buildWeeklyDigestSubject(companyName: string, locale: Locale): string {
  return STRINGS[locale].subject(companyName);
}

// Plain inline-styled HTML table layout — same zero-framework approach
// email.ts's existing password-reset send already uses, extended here
// with real dir="rtl" + right-aligned text for Arabic (this app's
// dual-language-first requirement applies to every real user-facing
// surface, an email included, not just the in-app UI).
export function buildWeeklyDigestHtml({ companyName, locale, data, studioUrl, unsubscribeUrl }: BuildWeeklyDigestEmailParams): string {
  const t = STRINGS[locale];
  const dir = locale === "AR" ? "rtl" : "ltr";
  const align = locale === "AR" ? "right" : "left";
  const ctaLabel = data.insight ? t.cta : t.ctaGeneric;

  return `<div dir="${dir}" style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a; text-align: ${align};">
  <p style="font-size: 12px; color: #888; display: none;">${t.preheader}</p>
  <h1 style="font-size: 20px; margin-bottom: 4px;">${t.heading}</h1>
  <p style="font-size: 14px; color: #555; margin-top: 0;">${companyName}</p>

  <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr>
      <td style="width: 50%; padding: 16px; background: #f5f4f0; border-radius: 8px 0 0 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold;">${data.generatedCount}</div>
        <div style="font-size: 13px; color: #666;">${t.generated}</div>
      </td>
      <td style="width: 50%; padding: 16px; background: #efeee9; border-radius: 0 8px 8px 0; text-align: center;">
        <div style="font-size: 28px; font-weight: bold;">${data.publishedCount}</div>
        <div style="font-size: 13px; color: #666;">${t.published}</div>
      </td>
    </tr>
  </table>

  <div style="padding: 16px; border: 1px solid #e5e3dc; border-radius: 8px; margin-bottom: 24px; font-size: 14px; line-height: 1.5;">
    ${insightLine(t, locale, data.insight)}
  </div>

  <p style="text-align: center; margin: 24px 0;">
    <a href="${studioUrl}" style="display: inline-block; background: #b5322f; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">${ctaLabel}</a>
  </p>

  <hr style="border: none; border-top: 1px solid #e5e3dc; margin: 24px 0;" />
  <p style="font-size: 12px; color: #999;">
    ${t.footer}
    <a href="${unsubscribeUrl}" style="color: #999;">${t.unsubscribe}</a>
  </p>
</div>`;
}
