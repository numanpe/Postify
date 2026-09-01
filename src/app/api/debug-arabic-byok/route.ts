import { db } from "@/lib/db";
import { getCompanyContext } from "@/lib/company-context";
import { GeminiTextProvider } from "@/lib/providers/text/gemini-provider";

export async function GET() {
  const apiKey = process.env.PLATFORM_GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "PLATFORM_GEMINI_API_KEY not set" }, { status: 500 });
  }

  const company = await db.company.create({
    data: { name: "Verify Arabic BYOK THROWAWAY", primaryIndustry: "Real Estate", locale: "AR" },
  });

  try {
    const context = await getCompanyContext(company.id);
    const provider = new GeminiTextProvider(apiKey);

    const caption = await provider.generateCaption({ context, topic: "أحدث عرض شقق سكنية بإطلالة بحرية" });
    const script = await provider.generateScript({ context, topic: "أحدث عرض شقق سكنية بإطلالة بحرية" });

    return Response.json({ caption: caption.text, script: script.script });
  } finally {
    await db.company.delete({ where: { id: company.id } });
  }
}
