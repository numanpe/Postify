import type { CompanyContext } from "@/lib/company-context";

// Shared by every BYOK provider so a real LLM's output is grounded in
// the same company context the free template uses — BYOK unlocks
// quality, not a different (generic) product.
export function buildCaptionPrompt(
  context: CompanyContext,
  topic: string,
): { system: string; user: string } {
  const { name, industry, tone, secondaryNiches } = context;

  const nicheLine = secondaryNiches.length
    ? ` The company also focuses on: ${secondaryNiches.join(", ")}.`
    : "";

  const system = [
    `You are a marketing copywriter for a company in the ${industry} industry.`,
    `Brand tone: ${tone}.`,
    "Write one concise, natural social media caption — at most two short sentences.",
    "No hashtags unless they read naturally. No generic filler.",
    "Never invent specific facts (prices, dates, promises) that weren't given to you.",
  ].join(" ");

  const user = `Company: ${name}.${nicheLine}\n\nWrite a short social media caption about: ${topic}`;

  return { system, user };
}
