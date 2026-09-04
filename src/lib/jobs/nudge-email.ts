import "server-only";
import type { Locale } from "@prisma/client";

interface BuildNudgeEmailParams {
  companyName: string;
  locale: Locale;
  quietDays: number;
  studioUrl: string;
  unsubscribeUrl: string;
}

interface NudgeStrings {
  subject: (company: string) => string;
  preheader: string;
  heading: (days: number) => string;
  body: string;
  cta: string;
  footer: string;
  unsubscribe: string;
}

const STRINGS: Record<Locale, NudgeStrings> = {
  EN: {
    subject: (company: string) => `It's been a while, ${company}`,
    preheader: "Your customers haven't seen a new post from you in a bit.",
    heading: (days: number) => `You've been quiet for ${days} days`,
    body: "A short break is normal — but staying visible is what keeps customers thinking of you first. Postify can put together a real poster or reel in under two minutes, free.",
    cta: "Create something now",
    footer: "You're receiving this because inactivity reminders are on for your company.",
    unsubscribe: "Turn off these reminders",
  },
  AR: {
    subject: (company: string) => `مضى وقت طويل يا ${company}`,
    preheader: "لم ير عملاؤك منشورًا جديدًا منكم منذ فترة.",
    heading: (days: number) => `مضى ${days} يومًا دون نشاط`,
    body: "التوقف لفترة قصيرة أمر طبيعي — لكن البقاء حاضرين هو ما يبقي عملاءكم يفكرون بكم أولًا. يمكن لبوستيفاي إنشاء ملصق أو ريل حقيقي في أقل من دقيقتين، مجانًا.",
    cta: "أنشئ محتوى الآن",
    footer: "تصلك هذه الرسالة لأن تذكيرات عدم النشاط مفعّلة لشركتك.",
    unsubscribe: "إيقاف هذه التذكيرات",
  },
};

export function buildNudgeSubject(companyName: string, locale: Locale): string {
  return STRINGS[locale].subject(companyName);
}

// Same zero-framework inline-styled layout as weekly-digest-email.ts,
// including real dir="rtl" for Arabic — one shared visual language for
// every automated email this app sends, not a one-off template.
export function buildNudgeHtml({ companyName, locale, quietDays, studioUrl, unsubscribeUrl }: BuildNudgeEmailParams): string {
  const t = STRINGS[locale];
  const dir = locale === "AR" ? "rtl" : "ltr";
  const align = locale === "AR" ? "right" : "left";

  return `<div dir="${dir}" style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a; text-align: ${align};">
  <p style="font-size: 12px; color: #888; display: none;">${t.preheader}</p>
  <h1 style="font-size: 20px; margin-bottom: 4px;">${t.heading(quietDays)}</h1>
  <p style="font-size: 14px; color: #555; margin-top: 0;">${companyName}</p>

  <div style="padding: 16px; border: 1px solid #e5e3dc; border-radius: 8px; margin: 20px 0; font-size: 14px; line-height: 1.5;">
    ${t.body}
  </div>

  <p style="text-align: center; margin: 24px 0;">
    <a href="${studioUrl}" style="display: inline-block; background: #b5322f; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">${t.cta}</a>
  </p>

  <hr style="border: none; border-top: 1px solid #e5e3dc; margin: 24px 0;" />
  <p style="font-size: 12px; color: #999;">
    ${t.footer}
    <a href="${unsubscribeUrl}" style="color: #999;">${t.unsubscribe}</a>
  </p>
</div>`;
}
