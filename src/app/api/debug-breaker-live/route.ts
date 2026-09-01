import { db } from "@/lib/db";
import { getCompanyContext } from "@/lib/company-context";
import { resolveSharedOrTemplateTextProvider } from "@/lib/providers/text/shared-pool";

export async function GET() {
  const company = await db.company.create({
    data: { name: "Verify Breaker Live THROWAWAY", primaryIndustry: "Agriculture", locale: "EN" },
  });

  try {
    const before = await db.sharedAiUsage.findUnique({
      where: { provider_date: { provider: "GEMINI", date: new Date(new Date().toISOString().slice(0, 10)) } },
    });

    const context = await getCompanyContext(company.id);
    const provider = await resolveSharedOrTemplateTextProvider();
    const result = await provider.generateCaption({ context, topic: "this week's tomato harvest" });

    const after = await db.sharedAiUsage.findUnique({
      where: { provider_date: { provider: "GEMINI", date: new Date(new Date().toISOString().slice(0, 10)) } },
    });

    return Response.json({
      beforeExhaustedAt: before?.exhaustedAt ?? null,
      resolvedProviderName: provider.name,
      resultProviderName: result.providerName,
      text: result.text,
      afterExhaustedAt: after?.exhaustedAt ?? null,
      afterSuccessCount: after?.successCount ?? null,
    });
  } finally {
    await db.company.delete({ where: { id: company.id } });
  }
}
