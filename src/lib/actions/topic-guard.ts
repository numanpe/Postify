import "server-only";

import type { TextProvider } from "@/lib/providers/text/types";
import type { CompanyContext } from "@/lib/company-context";
import { FREE_TEXT_PROVIDER_NAME } from "@/lib/providers/text/template-provider";
import { SHARED_POOL_PROVIDER_NAME } from "@/lib/providers/text/shared-pool";
import { validateTopic } from "@/lib/topic-validation";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

export interface TopicGuardResult {
  topic: string;
  // True only when the raw input was flagged AND a BYOK provider
  // successfully inferred a real subject — lets callers show the user
  // what was actually used instead of silently swapping their text
  // (same "never silently overwrite" rule the scene/script editor
  // already follows elsewhere in this app).
  wasClarified: boolean;
}

export class TopicGuardError extends Error {}

// The real backstop half of the malformed-topic fix — topic-suggestions
// .tsx is the prevention half. Called from every real server action
// that takes a free-typed topic/objective before it reaches a caption/
// script/campaign-brief template. A suggestion click always produces
// clean text, so this only ever actually intervenes on free-typed
// input — never blocks a suggestion, never blocks a normal topic.
export async function guardTopic(
  rawTopic: string,
  textProvider: TextProvider,
  context: Pick<CompanyContext, "name" | "industry">,
): Promise<TopicGuardResult> {
  const validation = validateTopic(rawTopic);
  if (!validation.flagged) {
    return { topic: rawTopic, wasClarified: false };
  }

  const dict = getDictionary(await getLocale()).topicGuard;

  // Free tier: no real language understanding available to reinterpret
  // malformed input sensibly — block and ask, per the explicit
  // instruction not to attempt automatic reinterpretation here.
  //
  // Real bug found and fixed while verifying this: every real caller
  // gets `textProvider` from getTextProviderForCompany(), which always
  // wraps the actual provider in withDeletionAvoidance() — a PLAIN
  // OBJECT LITERAL, never the real class instance (same reason
  // deletion-avoidance.ts's own doc comment gives for using explicit
  // per-method delegation instead of a spread). `instanceof
  // TemplateTextProvider` against that wrapper is therefore always
  // false for every real call site — confirmed live: the free tier
  // was silently taking the BYOK branch below (still correctly
  // blocking, since the free clarifyTopic() honestly returns null, but
  // with the wrong message). `.name` is the one property the wrapper
  // does forward correctly (`name: provider.name`), so it's the real,
  // reliable signal here — same value already used to identify a
  // resolved provider in this codebase's own error messages.
  // The shared "Free AI" pool (shared-pool.ts) reports its own name
  // here too — it never gets real clarifyTopic() capability either
  // (see its own comment), so it needs the exact same block-and-ask
  // treatment as the plain template, not the BYOK branch below.
  if (textProvider.name === FREE_TEXT_PROVIDER_NAME || textProvider.name === SHARED_POOL_PROVIDER_NAME) {
    throw new TopicGuardError(dict.blockedGeneric);
  }

  // BYOK: a real, separate LLM call infers the actual intended
  // subject — the raw flagged text is never the one that reaches
  // generateCaption/generateScript/generateCampaignBrief below.
  const clarified = await textProvider.clarifyTopic({
    rawInput: rawTopic,
    companyName: context.name,
    industry: context.industry,
  });
  if (!clarified.clarifiedTopic) {
    throw new TopicGuardError(dict.blockedNoClarify);
  }
  return { topic: clarified.clarifiedTopic, wasClarified: true };
}
