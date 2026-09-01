import { db } from "@/lib/db";
import { getCompanyContext } from "@/lib/company-context";
import { GeminiTextProvider, GeminiQuotaExhaustedError } from "@/lib/providers/text/gemini-provider";
import { ProviderError } from "@/lib/providers/text/types";

export async function GET() {
  const apiKey = process.env.PLATFORM_GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "PLATFORM_GEMINI_API_KEY not set" }, { status: 500 });
  }

  const company = await db.company.create({
    data: { name: "Verify Gemini Live THROWAWAY", primaryIndustry: "Agriculture", locale: "EN" },
  });

  try {
    const context = await getCompanyContext(company.id);
    const provider = new GeminiTextProvider(apiKey);
    try {
      const result = await provider.generateCaption({ context, topic: "this week's tomato harvest" });
      const endsWithPunctuation = /[.!?]["')\]]?\s*$/.test(result.text.trim());
      return Response.json({
        status: "success",
        text: result.text,
        length: result.text.length,
        endsWithPunctuation,
        providerName: result.providerName,
      });
    } catch (error) {
      if (error instanceof GeminiQuotaExhaustedError) {
        return Response.json({ status: "quota_exhausted", message: error.message });
      }
      if (error instanceof ProviderError) {
        return Response.json({ status: "provider_error", message: error.message });
      }
      throw error;
    }
  } finally {
    await db.company.delete({ where: { id: company.id } });
  }
}
