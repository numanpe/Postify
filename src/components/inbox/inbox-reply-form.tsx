"use client";

import { useActionState } from "react";

import { generateInboxReplyDraft, sendInboxReply } from "@/lib/actions/inbox";
import { Button } from "@/components/ui/button";
import type { InboxItem } from "@/lib/inbox";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// Narrowed to only the plain-string fields this component actually
// uses — dict.inbox also carries function-typed entries
// (unsupportedPlatformsNote, accountIssueNote), and a Server Component
// passing those across the Client Component boundary throws (same real
// class of bug as feedback_rsc_boundary_bugs; caught live while
// verifying this feature). Same fix pattern already used for
// dict.onboarding's geminiStep* props.
type InboxDict = Pick<Dictionary["inbox"], "generateDraft" | "generatingDraft" | "replyPlaceholder" | "send" | "sending" | "sent">;

// Part 2's real "never auto-send" surface: Generate draft only ever
// fills this textarea (generateInboxReplyDraft never touches Zernio at
// all — see its own doc comment), and Send is a distinct, explicit
// button the user must click after reviewing/editing whatever's in the
// box, real draft or not.
export function InboxReplyForm({ item, dict }: { item: InboxItem; dict: InboxDict }) {
  const [draftState, draftAction, draftPending] = useActionState(generateInboxReplyDraft, undefined);
  const [sendState, sendAction, sendPending] = useActionState(sendInboxReply, undefined);

  // Uncontrolled textarea, deliberately not useState+useEffect — a new
  // draft's text is the real key here, so remounting the field (React
  // resets an uncontrolled input's defaultValue when its key changes)
  // is the correct primitive, not synchronizing state from an effect.
  const draftText = draftState && "text" in draftState ? draftState.text : "";

  const sent = sendState && "success" in sendState;

  return (
    <div className="flex flex-col gap-2">
      <form action={draftAction}>
        <input type="hidden" name="incomingMessage" value={item.text} />
        <input type="hidden" name="kind" value={item.kind} />
        <input type="hidden" name="authorName" value={item.authorName} />
        <button
          type="submit"
          disabled={draftPending}
          className="text-xs font-medium underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {draftPending ? dict.generatingDraft : dict.generateDraft}
        </button>
      </form>
      {draftState && "error" in draftState && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {draftState.error}
        </p>
      )}

      {sent ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {dict.sent}
        </p>
      ) : (
        <form action={sendAction} className="flex flex-col gap-2">
          <input type="hidden" name="kind" value={item.kind} />
          {item.replyRef.kind === "comment" ? (
            <>
              <input type="hidden" name="postId" value={item.replyRef.postId} />
              <input type="hidden" name="commentId" value={item.replyRef.commentId} />
            </>
          ) : (
            <input type="hidden" name="conversationId" value={item.replyRef.conversationId} />
          )}
          <input type="hidden" name="accountId" value={item.replyRef.accountId} />

          <textarea
            key={draftText}
            name="message"
            required
            rows={2}
            maxLength={4000}
            defaultValue={draftText}
            placeholder={dict.replyPlaceholder}
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-sm"
          />
          {sendState && "error" in sendState && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {sendState.error}
            </p>
          )}
          <Button type="submit" size="sm" pending={sendPending} pendingLabel={dict.sending}>
            {dict.send}
          </Button>
        </form>
      )}
    </div>
  );
}
