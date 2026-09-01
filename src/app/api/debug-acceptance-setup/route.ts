import { db } from "@/lib/db";
import { generatePosterCore } from "@/lib/poster/generate";
import { generateVideoCore } from "@/lib/video/generate";
import { getCompanyContext } from "@/lib/company-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";

export const maxDuration = 300;

interface Profile {
  key: string;
  name: string;
  primaryIndustry: string;
  secondaryNiches: string[];
  locale: "EN" | "AR";
  targetMarket: string;
  businessDescription: string;
  brandColors: { primaryColor: string; secondaryColor: string; accentColor: string };
  poster: { headline: string; subhead: string; cta: string };
  videoTopic: string;
  campaignObjective: string;
}

const PROFILES: Profile[] = [
  {
    key: "agriculture",
    name: "Rooted Valley Farms",
    primaryIndustry: "Agriculture",
    secondaryNiches: ["Heirloom Apple Orchards"],
    locale: "EN",
    targetMarket: "Yakima Valley, Washington",
    businessDescription:
      "A family-run orchard growing heirloom apple varieties and stone fruit, selling direct to local families through a Saturday farm stand and a small CSA box program.",
    brandColors: { primaryColor: "#3F5D33", secondaryColor: "#F4EBD0", accentColor: "#C1440E" },
    poster: {
      headline: "This Week's Heirloom Apple Harvest",
      subhead: "Picked fresh, sold local",
      cta: "Visit the farm stand Saturday",
    },
    videoTopic: "our heirloom apple harvest",
    campaignObjective: "Promote this week's heirloom apple harvest and Saturday farm stand",
  },
  {
    key: "education",
    name: "Bright Path Tutoring Center",
    primaryIndustry: "Education",
    secondaryNiches: ["Small-Group Math Tutoring"],
    locale: "EN",
    targetMarket: "Austin, Texas",
    businessDescription:
      "A small-group tutoring center for grades 3-8 focused on math and reading fundamentals, with a low 4-student-to-1-tutor ratio and a free initial assessment.",
    brandColors: { primaryColor: "#1E3A5F", secondaryColor: "#FFFFFF", accentColor: "#F2A93B" },
    poster: {
      headline: "Fall Enrollment Now Open",
      subhead: "Small-group tutoring, grades 3-8",
      cta: "Book a free assessment",
    },
    videoTopic: "our small-group tutoring program",
    campaignObjective: "Drive fall enrollment sign-ups for small-group tutoring",
  },
  {
    key: "real-estate-ar",
    name: "دار الشرق العقارية",
    primaryIndustry: "Real Estate",
    secondaryNiches: ["شقق بإطلالة بحرية"],
    locale: "AR",
    targetMarket: "دبي، الإمارات",
    businessDescription:
      "وكالة عقارية في دبي متخصصة في الشقق السكنية الفاخرة ذات الإطلالات البحرية، تقدم جولات خاصة ومعاينة فورية للوحدات الجديدة.",
    brandColors: { primaryColor: "#0B3D57", secondaryColor: "#F5F0E6", accentColor: "#B08D57" },
    poster: {
      headline: "شقتك الجديدة بانتظارك",
      subhead: "إطلالات بحرية فاخرة",
      cta: "احجز جولتك اليوم",
    },
    videoTopic: "أحدث عرض شقق سكنية بإطلالة بحرية",
    campaignObjective: "الترويج لأحدث عروض الشقق السكنية بإطلالة بحرية",
  },
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const only = url.searchParams.get("company");
  const profiles = only ? PROFILES.filter((p) => p.key === only) : PROFILES;
  if (profiles.length === 0) {
    return Response.json({ error: `no profile matching "${only}"` }, { status: 400 });
  }

  const results: unknown[] = [];

  for (const profile of profiles) {
    const user = await db.user.create({
      data: { email: `acceptance-test-${profile.key}-${Date.now()}@throwaway.invalid`, name: "Acceptance Test" },
    });
    const company = await db.company.create({
      data: {
        name: `${profile.name} THROWAWAY`,
        primaryIndustry: profile.primaryIndustry,
        secondaryNiches: profile.secondaryNiches,
        locale: profile.locale,
        targetMarket: profile.targetMarket,
        businessDescription: profile.businessDescription,
      },
    });
    await db.companyMember.create({ data: { userId: user.id, companyId: company.id, role: "OWNER" } });
    await db.brandKit.create({ data: { companyId: company.id, ...profile.brandColors } });

    const entry: Record<string, unknown> = { key: profile.key, companyId: company.id, name: profile.name };

    try {
      const poster = await generatePosterCore({
        companyId: company.id,
        userId: user.id,
        headline: profile.poster.headline,
        subhead: profile.poster.subhead,
        cta: profile.poster.cta,
        aspectRatio: "SQUARE",
        template: "BOLD_HEADLINE",
        backgroundSource: "AI",
      });
      const posterRow = await db.poster.findUnique({ where: { id: poster.posterId }, select: { assetId: true } });
      entry.poster = {
        posterId: poster.posterId,
        assetId: posterRow?.assetId,
        warnings: poster.warnings,
        backgroundProviderName: poster.backgroundProviderName,
        fallbackFrom: poster.fallbackFrom,
      };
    } catch (error) {
      entry.poster = { error: error instanceof Error ? error.message : String(error) };
    }

    try {
      const video = await generateVideoCore({
        companyId: company.id,
        userId: user.id,
        topic: profile.videoTopic,
        aspectRatio: "STORY",
        useNarration: true,
      });
      const videoRow = await db.video.findUnique({
        where: { id: video.videoId },
        select: { assetId: true, script: true, hasNarration: true },
      });
      entry.video = {
        videoId: video.videoId,
        assetId: videoRow?.assetId,
        script: videoRow?.script,
        hasNarration: videoRow?.hasNarration,
        warnings: video.warnings,
        fallbackFrom: video.fallbackFrom,
      };
    } catch (error) {
      entry.video = { error: error instanceof Error ? error.message : String(error) };
    }

    try {
      const context = await getCompanyContext(company.id);
      const textProvider = await getTextProviderForCompany(company.id);
      const today = new Date().toISOString().slice(0, 10);
      const brief = await textProvider.generateCampaignBrief({
        context,
        objective: profile.campaignObjective,
        itemCount: 3,
        scheduledDates: [today, today, today],
        connectedPlatforms: [],
      });
      entry.campaignBrief = { providerName: brief.providerName, campaignType: brief.campaignType, items: brief.items };
    } catch (error) {
      entry.campaignBrief = { error: error instanceof Error ? error.message : String(error) };
    }

    results.push(entry);
  }

  return Response.json({ results });
}
