"use server";

import { z } from "zod";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import { getCompanyContext } from "@/lib/company-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { ProviderError } from "@/lib/providers/text/types";
import { replyToComment, sendConversationMessage } from "@/lib/providers/aggregator/zernio-inbox";
import { AggregatorProviderError } from "@/lib/providers/aggregator/types";

export type InboxDraftState = { error: string } | { text: string; providerName: string } | undefined;

const DraftSchema = z.object({
  incomingMessage: z.string().trim().min(1).max(4000),
  kind: z.enum(["comment", "dm"]),
  authorName: z.string().trim().max(200).optional(),
});

// Part 2's real AI-drafted reply — reuses the exact same provider
// resolution (BYOK -> shared free pool -> template, never fake, never
// silently different per caller) every other generation action in this
// app already goes through. Returns only text for the caller to put in
// an editable textarea; nothing here ever sends anything.
export async function generateInboxReplyDraft(_prevState: InboxDraftState, formData: FormData): Promise<InboxDraftState> {
  const { company } = await requireCompany();

  const parsed = DraftSchema.safeParse({
    incomingMessage: formData.get("incomingMessage"),
    kind: formData.get("kind"),
    authorName: formData.get("authorName") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const context = await getCompanyContext(company.id);
  const provider = await getTextProviderForCompany(company.id);

  try {
    const result = await provider.generateReply({
      context,
      incomingMessage: parsed.data.incomingMessage,
      kind: parsed.data.kind,
      authorName: parsed.data.authorName,
    });
    return { text: result.text, providerName: result.providerName };
  } catch (error) {
    if (error instanceof ProviderError) {
      return { error: `${error.providerName}: ${error.message}` };
    }
    throw error;
  }
}

export type SendReplyState = { error: string } | { success: true } | undefined;

const SendCommentSchema = z.object({
  kind: z.literal("comment"),
  postId: z.string().min(1),
  commentId: z.string().min(1),
  accountId: z.string().min(1),
  message: z.string().trim().min(1, "Write a reply before sending.").max(4000),
});

const SendDmSchema = z.object({
  kind: z.literal("dm"),
  conversationId: z.string().min(1),
  accountId: z.string().min(1),
  message: z.string().trim().min(1, "Write a reply before sending.").max(4000),
});

// The ONLY function anywhere in this app that actually posts an inbox
// reply to Zernio — always a real, explicit user click on this exact
// form (inbox-reply-form.tsx has no auto-submit path). Draft generation
// above never calls this. Re-derives the company's own Zernio
// credential from the authenticated session rather than trusting
// anything about the target from the client beyond which of their own
// account's threads to reply to (same trust boundary
// createPublishJob's socialAccountId already relies on).
export async function sendInboxReply(_prevState: SendReplyState, formData: FormData): Promise<SendReplyState> {
  const { company } = await requireCompany();

  const kind = formData.get("kind");
  const raw = {
    kind,
    postId: formData.get("postId") || undefined,
    commentId: formData.get("commentId") || undefined,
    conversationId: formData.get("conversationId") || undefined,
    accountId: formData.get("accountId"),
    message: formData.get("message"),
  };

  const parsed = kind === "comment" ? SendCommentSchema.safeParse(raw) : SendDmSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const credential = await db.aggregatorCredential.findUnique({
    where: { companyId_provider: { companyId: company.id, provider: "ZERNIO" } },
  });
  if (!credential) {
    return { error: "Zernio isn't connected for this company anymore." };
  }
  const apiKey = decryptSecret(credential.encryptedKey);

  try {
    if (parsed.data.kind === "comment") {
      await replyToComment(apiKey, parsed.data.postId, parsed.data.accountId, parsed.data.message, parsed.data.commentId);
    } else {
      await sendConversationMessage(apiKey, parsed.data.conversationId, parsed.data.accountId, parsed.data.message);
    }
    return { success: true };
  } catch (error) {
    if (error instanceof AggregatorProviderError) {
      return { error: error.message };
    }
    throw error;
  }
}
