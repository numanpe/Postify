import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";
import { DigestUnsubscribeForm } from "@/components/digest/digest-unsubscribe-form";

// Standalone top-level route (same convention as src/app/admin) rather
// than nested under (auth) — that group's layout redirects any
// logged-in session to "/", which would be wrong here: the company
// owner clicking this link from their real inbox is very often ALSO
// logged into the app in the same browser, and still needs to see this
// page, not get bounced.
//
// Deliberately its own page rather than a mode on the shared
// (auth)/auth/[mode] route this app already consolidated auth screens
// into to reduce Vercel Function count — reusing that route here would
// have reintroduced the exact "bounces a logged-in real user" bug above.
export default async function DigestUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; token?: string; type?: string }>;
}) {
  const { company: companyId, token, type: typeRaw } = await searchParams;
  // Existing real links already sent (weekly-digest.ts) never carry
  // ?type= at all — defaulting to "digest" keeps every one of those
  // working exactly as before.
  const type: "digest" | "nudge" = typeRaw === "nudge" ? "nudge" : "digest";

  const valid = Boolean(companyId && token && verifyUnsubscribeToken(companyId, token));
  const company = valid ? await db.company.findUnique({ where: { id: companyId! }, select: { name: true, locale: true } }) : null;

  // The root layout's <html dir> reflects the VISITING browser's own
  // session locale (or "ltr" if signed out) — not necessarily this
  // company's locale, since an unsubscribe link is often opened
  // signed-out or in a different session entirely. This inner wrapper
  // carries the real dir/alignment for the company's own locale instead,
  // the same pattern the digest email itself already uses.
  const locale = company?.locale ?? "EN";
  const dir = locale === "AR" ? "rtl" : "ltr";
  const isValid = Boolean(company);

  const strings =
    locale === "AR"
      ? type === "nudge"
        ? {
            title: "إيقاف تذكيرات عدم النشاط",
            invalid: "هذا الرابط غير صالح أو منتهي الصلاحية.",
            confirmFor: (name: string) => `إيقاف تذكيرات "قلة النشاط" عن "${name}"؟`,
            note: "لن تفقد أي بيانات — يمكنك إعادة تفعيلها لاحقًا من الإعدادات.",
            done: "تم — لن تصلك تذكيرات عدم النشاط بعد الآن.",
          }
        : {
            title: "إلغاء الاشتراك في الملخص الأسبوعي",
            invalid: "هذا الرابط غير صالح أو منتهي الصلاحية.",
            confirmFor: (name: string) => `إيقاف الرسائل الأسبوعية عن "${name}"؟`,
            note: "لن تفقد أي بيانات — يمكنك إعادة تفعيلها لاحقًا من الإعدادات.",
            done: "تم — لن تصلك رسائل أسبوعية بعد الآن.",
          }
      : type === "nudge"
        ? {
            title: "Turn off inactivity reminders",
            invalid: "This unsubscribe link is invalid or has expired.",
            confirmFor: (name: string) => `Turn off "you've gone quiet" reminders for "${name}"?`,
            note: "No data is lost — you can turn this back on later from Settings.",
            done: "Done — you won't get any more inactivity reminders.",
          }
        : {
            title: "Unsubscribe from weekly digest",
            invalid: "This unsubscribe link is invalid or has expired.",
            confirmFor: (name: string) => `Turn off weekly emails for "${name}"?`,
            note: "No data is lost — you can turn this back on later from Settings.",
            done: "Done — you won't get any more weekly emails.",
          };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-12" dir={dir}>
      <h1 className="text-2xl font-semibold">{strings.title}</h1>
      {!isValid ? (
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark" role="alert">
          {strings.invalid}
        </p>
      ) : (
        <DigestUnsubscribeForm
          companyId={companyId!}
          token={token!}
          type={type}
          confirmLabel={strings.confirmFor(company!.name)}
          note={strings.note}
          doneLabel={strings.done}
          locale={locale}
        />
      )}
    </main>
  );
}
