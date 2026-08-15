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

// system #4's structure: hook -> context -> value -> message -> CTA.
// Asks for strict JSON so callers can parse structured sections rather
// than trying to split a single blob of prose.
export function buildScriptPrompt(
  context: CompanyContext,
  topic: string,
): { system: string; user: string } {
  const { name, industry, tone, secondaryNiches } = context;

  const nicheLine = secondaryNiches.length
    ? ` The company also focuses on: ${secondaryNiches.join(", ")}.`
    : "";

  const system = [
    `You are a video creative director for a company in the ${industry} industry.`,
    `Brand tone: ${tone}.`,
    "Write a short-form video voiceover script (15-30 seconds spoken) with exactly five sections:",
    "hook (grabs attention in the first line), context (sets up the situation), value (the benefit to the viewer),",
    "message (ties directly to the specific topic given), cta (a clear call to action).",
    "Each section is 1-2 short spoken sentences — natural spoken language, not written copy.",
    "No hashtags, no emoji, no stage directions. Never invent specific facts (prices, dates, promises) not given to you.",
    'Respond with ONLY a JSON object: {"hook": "...", "context": "...", "value": "...", "message": "...", "cta": "..."}',
  ].join(" ");

  const user = `Company: ${name}.${nicheLine}\n\nWrite a video script about: ${topic}`;

  return { system, user };
}

// A coherent multi-day plan, not itemCount unrelated topics — asks
// explicitly for a marketing arc (announce/build interest/prove value/
// create urgency/etc.) across the requested number of days.
export function buildCampaignPlanPrompt(
  context: CompanyContext,
  objective: string,
  itemCount: number,
): { system: string; user: string } {
  const { name, industry, tone, secondaryNiches } = context;

  const nicheLine = secondaryNiches.length
    ? ` The company also focuses on: ${secondaryNiches.join(", ")}.`
    : "";

  const system = [
    `You are a marketing campaign strategist for a company in the ${industry} industry.`,
    `Brand tone: ${tone}.`,
    `Plan exactly ${itemCount} distinct daily post angles for one campaign with a single objective.`,
    "The angles must form a coherent arc across the days (e.g. announce, build interest, highlight a benefit,",
    "social proof, create urgency, recap) — not the same idea repeated, and not unrelated topics.",
    "Each angle is a short phrase (under 12 words) describing that day's specific focus, not full ad copy.",
    "Never invent specific facts (prices, dates, promises) that weren't given to you.",
    `Respond with ONLY a JSON object: {"angles": ["...", ...]} with exactly ${itemCount} strings in order.`,
  ].join(" ");

  const user = `Company: ${name}.${nicheLine}\n\nCampaign objective: ${objective}`;

  return { system, user };
}
