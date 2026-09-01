import { db } from "@/lib/db";
import { getCompanyContext } from "@/lib/company-context";
import { buildCaptionPrompt, buildScriptPrompt } from "@/lib/providers/text/prompt";

// Real Gemini quota is exhausted from today's testing, so this checks
// the actual prompt construction directly (zero API cost) rather than
// a full round-trip — still real evidence the fix is wired correctly,
// not a synthetic assertion.
export async function GET() {
  const company = await db.company.create({
    data: { name: "Verify Arabic BYOK THROWAWAY", primaryIndustry: "Real Estate", locale: "AR" },
  });
  const companyEn = await db.company.create({
    data: { name: "Verify English BYOK THROWAWAY", primaryIndustry: "Real Estate", locale: "EN" },
  });

  try {
    const contextAr = await getCompanyContext(company.id);
    const contextEn = await getCompanyContext(companyEn.id);

    const captionAr = buildCaptionPrompt(contextAr, "أحدث عرض شقق سكنية بإطلالة بحرية");
    const captionEn = buildCaptionPrompt(contextEn, "our newest residential listing");
    const scriptAr = buildScriptPrompt(contextAr, "أحدث عرض شقق سكنية بإطلالة بحرية");
    const scriptEn = buildScriptPrompt(contextEn, "our newest residential listing");

    return Response.json({ captionAr, captionEn, scriptAr, scriptEn });
  } finally {
    await db.company.delete({ where: { id: company.id } });
    await db.company.delete({ where: { id: companyEn.id } });
  }
}
