import "server-only";

// Growth Tools #6: a real, dated GCC/UAE seasonal & commercial calendar
// — not a generic "content ideas" list. Every date below was verified
// against real sources (government/ministry pages, established GCC news
// outlets) via WebSearch on 2026-09-04, not invented or estimated by
// the model. Fixed Gregorian dates (national observances, White Friday)
// are marked "confirmed"; Islamic-calendar dates are inherently
// moon-sighting-dependent and marked "predicted" — both the UI and the
// data itself disclose this honestly rather than presenting a
// forecasted date as certain (CLAUDE.md's "no fake functionality"
// applies to false precision, not just missing features).
//
// This is a static, hand-verified list, not a live feed — there is no
// real, free GCC cultural-calendar API this app could poll instead (the
// same real constraint already documented for Feature #6's original
// investigation). It will need a real refresh once 2027's events pass;
// deliberately not solved with a fake "auto-updating" mechanism that
// doesn't actually exist.
export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  certainty: "confirmed" | "predicted";
  nameEn: string;
  nameAr: string;
  topicHintEn: string;
  topicHintAr: string;
}

export const GCC_EVENT_CALENDAR: CalendarEvent[] = [
  {
    id: "flag-day-2026",
    date: "2026-11-03",
    certainty: "confirmed",
    nameEn: "UAE Flag Day",
    nameAr: "يوم العلم الإماراتي",
    topicHintEn: "UAE Flag Day — a proud, patriotic post honoring the flag",
    topicHintAr: "يوم العلم الإماراتي — منشور وطني فخور يحتفي بالعلم",
  },
  {
    id: "white-friday-2026",
    date: "2026-11-28",
    certainty: "confirmed",
    nameEn: "White Friday",
    nameAr: "الجمعة البيضاء",
    topicHintEn: "White Friday — the region's biggest sale weekend, a limited-time offer post",
    topicHintAr: "الجمعة البيضاء — أكبر عروض المنطقة، منشور عن عرض محدود المدة",
  },
  {
    id: "commemoration-day-2026",
    date: "2026-11-30",
    certainty: "confirmed",
    nameEn: "Commemoration Day",
    nameAr: "يوم الشهيد",
    topicHintEn: "Commemoration Day — a respectful tribute post, not a promotional one",
    topicHintAr: "يوم الشهيد — منشور احترام وتقدير، وليس منشورًا ترويجيًا",
  },
  {
    id: "national-day-2026",
    date: "2026-12-02",
    certainty: "confirmed",
    nameEn: "UAE National Day",
    nameAr: "اليوم الوطني الإماراتي",
    topicHintEn: "UAE National Day — a celebratory post marking the union's anniversary",
    topicHintAr: "اليوم الوطني الإماراتي — منشور احتفالي بذكرى قيام الاتحاد",
  },
  {
    id: "ramadan-2027",
    date: "2027-02-08",
    certainty: "predicted",
    nameEn: "Ramadan begins (expected)",
    nameAr: "بداية شهر رمضان (متوقع)",
    topicHintEn: "Ramadan Kareem — the start of the holy month, a warm greeting post",
    topicHintAr: "رمضان كريم — بداية الشهر الفضيل، منشور تهنئة دافئ",
  },
  {
    id: "eid-al-fitr-2027",
    date: "2027-03-10",
    certainty: "predicted",
    nameEn: "Eid Al Fitr (expected)",
    nameAr: "عيد الفطر (متوقع)",
    topicHintEn: "Eid Al Fitr — an Eid Mubarak greeting and any holiday hours notice",
    topicHintAr: "عيد الفطر — تهنئة عيد مبارك وإشعار بمواعيد العمل خلال العيد إن وجد",
  },
  {
    id: "mothers-day-2027",
    date: "2027-03-21",
    certainty: "confirmed",
    nameEn: "Arab World Mother's Day",
    nameAr: "عيد الأم",
    topicHintEn: "Mother's Day — a warm tribute post or a mother-focused offer",
    topicHintAr: "عيد الأم — منشور تكريمي دافئ أو عرض موجّه للأمهات",
  },
  {
    id: "arafat-day-2027",
    date: "2027-05-15",
    certainty: "predicted",
    nameEn: "Arafat Day (expected)",
    nameAr: "يوم عرفة (متوقع)",
    topicHintEn: "Arafat Day — a respectful, reflective post ahead of Eid Al Adha",
    topicHintAr: "يوم عرفة — منشور تأملي محترم قبيل عيد الأضحى",
  },
  {
    id: "eid-al-adha-2027",
    date: "2027-05-16",
    certainty: "predicted",
    nameEn: "Eid Al Adha (expected)",
    nameAr: "عيد الأضحى (متوقع)",
    topicHintEn: "Eid Al Adha — an Eid Mubarak greeting for the holiday",
    topicHintAr: "عيد الأضحى — تهنئة عيد مبارك بالمناسبة",
  },
];

export interface UpcomingCalendarEvent extends CalendarEvent {
  daysUntil: number;
}

// Real, deterministic day-difference math — no timezone drift games:
// both sides are normalized to UTC midnight before subtracting, same
// approach smart-scheduler.ts already uses for its own date math.
export function getUpcomingEvents(withinDays: number, referenceNow: Date = new Date()): UpcomingCalendarEvent[] {
  const todayUtc = Date.UTC(referenceNow.getUTCFullYear(), referenceNow.getUTCMonth(), referenceNow.getUTCDate());
  return GCC_EVENT_CALENDAR.map((event) => {
    const [y, m, d] = event.date.split("-").map(Number);
    const eventUtc = Date.UTC(y, m - 1, d);
    const daysUntil = Math.round((eventUtc - todayUtc) / 86_400_000);
    return { ...event, daysUntil };
  })
    .filter((event) => event.daysUntil >= 0 && event.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
