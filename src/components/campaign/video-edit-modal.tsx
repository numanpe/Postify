"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";

import {
  editVideoAsset,
  editVideoScript,
  swapVideoSceneMedia,
  editVideoScenes,
  uploadSceneMediaAsset,
} from "@/lib/actions/video-edit";
import { suggestVideoScriptEdit, type SuggestVideoScriptEditState } from "@/lib/actions/video-script-ai-edit";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { BottomSheet, type BottomSheetHandle } from "@/components/ui/bottom-sheet";
import { useDict } from "@/components/i18n/locale-provider";
import { ActionIcons, NavIcons, SectionIcons } from "@/components/icons";
import { SceneThumbnailStrip } from "@/components/campaign/scene-thumbnail-strip";
import { MusicPicker } from "@/components/video/music-picker";

export interface VideoSceneForEdit {
  id: string;
  order: number;
  kind: "REAL_PHOTO" | "REAL_VIDEO" | "AI_STILL";
  mediaAssetId: string | null;
  scriptKey: string | null;
  durationSec: number | null;
  overlayText: string | null;
  mediaAsset: { id: string; fileName: string } | null;
  // Resolved server-side (src/lib/video/scene-thumbnails.ts's
  // resolveSceneThumbnailUrl) — the real uploaded photo for
  // REAL_PHOTO, the real captured frame/image for REAL_VIDEO/AI_STILL,
  // or null for a scene from before this feature existed (shown as a
  // real "no preview" placeholder, never a fake image).
  thumbnailUrl: string | null;
}

export interface SceneMediaAssetOption {
  id: string;
  fileName: string;
  mimeType: string;
  // Real Media Library preview URL (PickableMediaAsset.url, src/lib/media.ts)
  // — added for the visual picker redesign (2026-09-07). Only ever a
  // real, renderable image for image/* assets; video/* assets show a
  // real video-icon badge instead of attempting a frame preview — the
  // same honest limitation the main Media Library grid already has
  // (media/page.tsx shows raw mimeType text for videos, no thumbnail
  // extraction exists yet for a plain uploaded video), not a fake
  // preview.
  url: string;
}

interface VideoScript {
  hook: string;
  context: string;
  value: string;
  message: string;
  cta: string;
}

type MusicMood = "CALM" | "CONFIDENT" | "UPBEAT" | "WARM";

interface VideoEditModalProps {
  videoId: string;
  videoUrl: string;
  hasNarration: boolean;
  script: VideoScript;
  scenes: VideoSceneForEdit[];
  sceneMediaAssets: SceneMediaAssetOption[];
  musicTrack: MusicMood | null;
  musicVolume: number;
}

// Refreshes this Server Component subtree's data in place (new
// videoUrl/scenes/script props) without a full page reload, once a save
// actually succeeds — the real "let the user see the before/after"
// requirement, not a silent overwrite. router.refresh() re-runs the
// data fetch, not a client-router navigation, so the sheet itself stays
// open across it.
function useRefreshOnSuccess(success: boolean | undefined) {
  const router = useRouter();
  useEffect(() => {
    if (success) router.refresh();
  }, [success, router]);
}

export function VideoEditModal({
  videoId,
  videoUrl,
  hasNarration,
  script,
  scenes,
  sceneMediaAssets,
  musicTrack,
  musicVolume,
}: VideoEditModalProps) {
  const dict = useDict().video;
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [trimState, trimAction, trimPending] = useActionState(editVideoAsset.bind(null, videoId), undefined);

  return (
    <>
      <button
        type="button"
        onClick={() => sheetRef.current?.showModal()}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-paper-border dark:border-night-border px-1.5 py-0.5"
      >
        <ActionIcons.editVideo size={14} aria-hidden="true" />
        {dict.editVideo}
      </button>
      <BottomSheet ref={sheetRef} title={dict.editVideo} closeLabel={dict.editVideoCancel}>
        <div className="flex flex-col gap-5 pb-3">
          {/* max-h caps a tall 9:16 Story video so the trim controls
              right below stay reachable without an extra scroll on a
              phone-sized viewport — object-contain keeps the full frame
              visible (letterboxed) rather than cropping it to fit. */}
          <div className="relative">
            <video
              src={videoUrl}
              // Real first-scene thumbnail (already captured server-side,
              // see scene-thumbnails.ts) instead of the browser's default
              // black frame while metadata loads — a real, relevant
              // preview image, not a placeholder graphic.
              poster={scenes[0]?.thumbnailUrl ?? undefined}
              controls
              className="max-h-[38vh] w-full rounded bg-black object-contain"
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                setDuration(d);
                setTrimStart(0);
                setTrimEnd(d);
                setVideoLoaded(true);
              }}
            />
            {!videoLoaded && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded bg-black/40 text-xs font-medium text-white">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                {dict.editVideoLoading}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-paper-border p-3 dark:border-night-border">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <ActionIcons.trim size={16} aria-hidden="true" />
              {dict.editVideoTrimSectionTitle}
            </h3>
            <form action={trimAction} className="flex flex-col gap-3">
              <input type="hidden" name="trimStart" value={trimStart} />
              <input type="hidden" name="trimEnd" value={trimEnd} />

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">{dict.editVideoTrimStart}</label>
                  <span className="rounded-full bg-paper-card px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-ink-soft dark:bg-night-card dark:text-ink-soft-dark">
                    {trimStart.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={trimStart}
                  disabled={duration === 0}
                  onChange={(e) => setTrimStart(Math.min(Number(e.target.value), trimEnd - 0.5))}
                  className="min-h-[48px] accent-current"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">{dict.editVideoTrimEnd}</label>
                  <span className="rounded-full bg-paper-card px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-ink-soft dark:bg-night-card dark:text-ink-soft-dark">
                    {trimEnd.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={trimEnd}
                  disabled={duration === 0}
                  onChange={(e) => setTrimEnd(Math.max(Number(e.target.value), trimStart + 0.5))}
                  className="min-h-[48px] accent-current"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor={`overlay-${videoId}`} className="text-xs font-medium">
                  {dict.editVideoOverlayText}
                </label>
                <input
                  id={`overlay-${videoId}`}
                  name="overlayText"
                  type="text"
                  maxLength={80}
                  placeholder={dict.editVideoOverlayPlaceholder}
                  className="rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-base"
                />
              </div>

              {trimState && "error" in trimState && (
                <p role="alert" className="text-red-600 dark:text-red-400">
                  {trimState.error}
                </p>
              )}
              {trimState && "success" in trimState && (
                <p role="status" className="text-green-700 dark:text-green-400">
                  {dict.editVideoSaved}
                </p>
              )}

              <Button type="submit" size="sm" pending={trimPending} pendingLabel={dict.editVideoSaving}>
                {dict.editVideoSave}
              </Button>
            </form>
          </div>

          <hr className="border-paper-border dark:border-night-border" />

          {hasNarration ? (
            <>
              <ScriptEditorSection videoId={videoId} script={script} musicTrack={musicTrack} musicVolume={musicVolume} />
              <hr className="border-paper-border dark:border-night-border" />
              <NarratedSceneList videoId={videoId} scenes={scenes} sceneMediaAssets={sceneMediaAssets} />
            </>
          ) : (
            <NonNarratedSceneEditor
              videoId={videoId}
              scenes={scenes}
              sceneMediaAssets={sceneMediaAssets}
              musicTrack={musicTrack}
              musicVolume={musicVolume}
            />
          )}
        </div>
      </BottomSheet>
    </>
  );
}

const SCRIPT_KEYS = ["hook", "context", "value", "message", "cta"] as const;

function ScriptEditorSection({
  videoId,
  script,
  musicTrack,
  musicVolume,
}: {
  videoId: string;
  script: VideoScript;
  musicTrack: MusicMood | null;
  musicVolume: number;
}) {
  const dict = useDict().video;
  const [fields, setFields] = useState<VideoScript>(script);
  const [state, action, pending] = useActionState(editVideoScript.bind(null, videoId), undefined);
  useRefreshOnSuccess(state && "success" in state ? true : undefined);

  const labels: Record<(typeof SCRIPT_KEYS)[number], string> = {
    hook: dict.scriptEditorHook,
    context: dict.scriptEditorContext,
    value: dict.scriptEditorValue,
    message: dict.scriptEditorMessage,
    cta: dict.scriptEditorCta,
  };
  const activeCount = SCRIPT_KEYS.filter((key) => fields[key].trim()).length;

  // Lifted out of AiScriptSuggestions (2026-09-07) so a per-section
  // "Regenerate with AI" button — right next to that section's own
  // "Remove this section," per this feature's real request — can
  // trigger the exact same suggestion request/diff-preview the
  // freeform/quick-action inputs already use, all landing in the one
  // AiScriptSuggestions panel the user already knows to look at,
  // instead of duplicating that preview UI five more times.
  const [aiState, aiAction, aiPending] = useActionState(suggestVideoScriptEdit, undefined);
  const [aiOutcome, setAiOutcome] = useState<"applied" | "discarded" | null>(null);
  // Which section (if any) a REGENERATE button triggered the current
  // request for — purely so that section's own button can show a real
  // "Regenerating…" pending state instead of a generic one.
  const [regeneratingKey, setRegeneratingKey] = useState<(typeof SCRIPT_KEYS)[number] | null>(null);

  function runAiInstruction(text: string, sectionKey: (typeof SCRIPT_KEYS)[number] | null) {
    setAiOutcome(null);
    setRegeneratingKey(sectionKey);
    const formData = new FormData();
    formData.set("videoId", videoId);
    formData.set("instruction", text);
    startTransition(() => aiAction(formData));
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <SectionIcons.script size={16} aria-hidden="true" />
          {dict.scriptEditorTitle}
        </h3>
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.scriptEditorHint}</p>
      </div>

      {SCRIPT_KEYS.map((key) => {
        const isLastActive = activeCount === 1 && fields[key].trim().length > 0;
        const isRegeneratingThis = aiPending && regeneratingKey === key;
        return (
          <div key={key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`script-${videoId}-${key}`} className="text-xs font-medium">
                {labels[key]}
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={aiPending}
                  onClick={() =>
                    runAiInstruction(
                      `Rewrite only the ${key} section with completely fresh, different wording — keep every other section exactly as-is.`,
                      key,
                    )
                  }
                  className="flex items-center gap-1 rounded-full border border-paper-border px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-primary hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-night-border dark:text-ink-soft-dark dark:hover:border-primary-dark dark:hover:text-ink-dark"
                >
                  {isRegeneratingThis ? <Spinner /> : <ActionIcons.aiGenerate size={12} aria-hidden="true" />}
                  {isRegeneratingThis ? dict.aiScriptEditSubmitting : dict.scriptEditorRegenerateSection}
                </button>
                <button
                  type="button"
                  disabled={isLastActive}
                  title={isLastActive ? dict.scriptEditorRemoveLastWarning : undefined}
                  aria-label={dict.scriptEditorRemoveSection}
                  onClick={() => setFields((f) => ({ ...f, [key]: "" }))}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-paper-border text-ink-soft transition-colors hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-night-border dark:text-ink-soft-dark dark:hover:border-red-900 dark:hover:text-red-400"
                >
                  <ActionIcons.remove size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
            <textarea
              id={`script-${videoId}-${key}`}
              name={key}
              rows={2}
              value={fields[key]}
              onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
              className="rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-base"
            />
          </div>
        );
      })}

      <AiScriptSuggestions
        videoId={videoId}
        labels={labels}
        currentScript={fields}
        state={aiState}
        pending={aiPending}
        outcome={aiOutcome}
        setOutcome={setAiOutcome}
        runInstruction={(text) => runAiInstruction(text, null)}
        onApply={(updated) => setFields(updated)}
      />

      <MusicPicker dict={dict} defaultTrack={musicTrack} defaultVolume={musicVolume} />

      <p className="text-xs text-amber-600 dark:text-amber-400">{dict.editReRendersWholeVideo}</p>
      {state && "error" in state && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <>
          <p role="status" className="text-green-700 dark:text-green-400">
            {dict.scriptEditorSaved} {dict.editSuccessPreview}
          </p>
          {state.warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-600 dark:text-amber-400">
              {warning}
            </p>
          ))}
        </>
      )}

      <Button type="submit" size="sm" pending={pending} pendingLabel={dict.scriptEditorSaving}>
        {dict.scriptEditorSave}
      </Button>
    </form>
  );
}

// AI-powered script editing (2026-09-06) — quick-action + freeform
// instructions, both routed through the same suggestVideoScriptEdit
// action (a single instruction string; a quick action is just a
// preset instruction, not a separate code path). This is a SUGGESTION
// step only: it never touches the outer ScriptEditorSection form's own
// save/re-render path directly — onApply just updates that form's local
// `fields` state (same as if the user had typed the new text
// themselves), so the existing "Save script" button and its real
// full-re-render behavior stay the single, unchanged way an edit
// actually applies. Nested inside ScriptEditorSection's own <form> —
// every interactive element here is type="button" so nothing here can
// accidentally submit that outer form (same rule SceneMediaUploadField
// above already establishes for the same reason).
function AiScriptSuggestions({
  videoId,
  labels,
  currentScript,
  state,
  pending,
  outcome,
  setOutcome,
  runInstruction,
  onApply,
}: {
  videoId: string;
  labels: Record<(typeof SCRIPT_KEYS)[number], string>;
  currentScript: VideoScript;
  // Lifted into ScriptEditorSection (2026-09-07) so the per-section
  // "Regenerate with AI" buttons and this panel's own quick-action/
  // freeform inputs all share one real request + one diff-preview UI,
  // instead of duplicating it five more times.
  state: SuggestVideoScriptEditState;
  pending: boolean;
  outcome: "applied" | "discarded" | null;
  setOutcome: (outcome: "applied" | "discarded" | null) => void;
  runInstruction: (text: string) => void;
  onApply: (script: VideoScript) => void;
}) {
  const dict = useDict().video;
  const [instruction, setInstruction] = useState("");

  const quickActions: { label: string; instruction: string }[] = [
    {
      label: dict.aiScriptEditQuickPunchier,
      instruction: "Make the whole script punchier and more energetic, while keeping it natural spoken language.",
    },
    { label: dict.aiScriptEditQuickShorten, instruction: "Shorten the script overall, keeping the key message intact." },
    {
      label: dict.aiScriptEditQuickStrongerCta,
      instruction: "Make the call-to-action (cta) section stronger and more compelling.",
    },
    { label: dict.aiScriptEditQuickSimplify, instruction: "Simplify the language throughout — use simpler, everyday words." },
  ];

  const showDiff = state?.status === "success" && outcome === null;
  const changedKeys = showDiff
    ? SCRIPT_KEYS.filter((key) => state.updatedScript[key] !== currentScript[key])
    : [];

  return (
    <div className="flex flex-col gap-2 rounded border border-paper-border dark:border-night-border p-2">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold">
        <ActionIcons.aiGenerate size={14} aria-hidden="true" />
        {dict.aiScriptEditTitle}
      </h4>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark">{dict.aiScriptEditQuickActionsLabel}</span>
        <div className="flex flex-wrap gap-1.5">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              type="button"
              disabled={pending}
              onClick={() => runInstruction(qa.instruction)}
              className="rounded-full border border-paper-border px-2 py-1 text-xs transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-night-border dark:hover:border-primary-dark"
            >
              {qa.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`ai-script-instruction-${videoId}`} className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark">
          {dict.aiScriptEditFreeformLabel}
        </label>
        <div className="flex gap-1.5">
          <input
            id={`ai-script-instruction-${videoId}`}
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={dict.aiScriptEditFreeformPlaceholder}
            className="flex-1 rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-base"
          />
          <Button
            type="button"
            size="sm"
            pending={pending}
            pendingLabel={dict.aiScriptEditSubmitting}
            disabled={!instruction.trim()}
            onClick={() => runInstruction(instruction.trim())}
          >
            {dict.aiScriptEditSubmit}
          </Button>
        </div>
      </div>

      {state?.status === "unavailable" && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.reason}
        </p>
      )}
      {state?.status === "cannotApply" && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {dict.aiScriptEditCannotApply} {state.explanation}
        </p>
      )}
      {state?.status === "error" && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      {showDiff && (
        <div className="flex flex-col gap-2 rounded border border-paper-border dark:border-night-border p-2 text-xs">
          <p className="font-medium">{dict.aiScriptEditBeforeAfterTitle}</p>
          <p className="text-ink-soft dark:text-ink-soft-dark">{state.explanation}</p>
          {/* changedKeys is never empty here in practice — the action's
              own parseVideoScriptEditResponse already throws a real
              error (surfaced above as state.status === "error") rather
              than returning a "success" with no actual diff, the same
              silent-no-op guard editPosterSpec established. */}
          {changedKeys.map((key) => (
            <div key={key} className="flex flex-col gap-0.5">
              <span className="font-medium">{labels[key]}</span>
              <p className="text-ink-soft line-through dark:text-ink-soft-dark">{currentScript[key]}</p>
              <p>{state.updatedScript[key]}</p>
            </div>
          ))}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                onApply(state.updatedScript);
                setOutcome("applied");
              }}
              className="rounded bg-primary px-2 py-1 font-medium text-paper dark:bg-primary-dark dark:text-night"
            >
              {dict.aiScriptEditApply}
            </button>
            <button
              type="button"
              onClick={() => setOutcome("discarded")}
              className="text-start text-ink-soft underline dark:text-ink-soft-dark"
            >
              {dict.aiScriptEditDiscard}
            </button>
          </div>
        </div>
      )}
      {outcome === "applied" && (
        <p role="status" className="text-xs text-green-700 dark:text-green-400">
          {dict.aiScriptEditApplied}
        </p>
      )}
    </div>
  );
}

// Narrated videos: every scene's order/duration is read-only (both
// follow the real narration timing — see scene-editor.ts), so the
// strip renders with no remove/add/reorder controls at all — not
// disabled buttons cluttering the UI, per this feature's own scope.
// Swap-media (tap a thumbnail) is the one real, safe per-scene action
// here; a second tap target, the script-section badge, makes the
// "this scene = this part of the script" connection visible instead of
// just explained in a caption — tapping it scrolls to and briefly
// highlights the real matching textarea in the script editor above.
function NarratedSceneList({
  videoId,
  scenes,
  sceneMediaAssets,
}: {
  videoId: string;
  scenes: VideoSceneForEdit[];
  sceneMediaAssets: SceneMediaAssetOption[];
}) {
  const dict = useDict().video;
  const [openSwapIndex, setOpenSwapIndex] = useState<number | null>(null);

  const scriptLabels: Record<string, string> = {
    hook: dict.scriptEditorHook,
    context: dict.scriptEditorContext,
    value: dict.scriptEditorValue,
    message: dict.scriptEditorMessage,
    cta: dict.scriptEditorCta,
  };

  function jumpToScript(index: number) {
    const scriptKey = scenes[index].scriptKey;
    if (!scriptKey) return;
    const el = document.getElementById(`script-${videoId}-${scriptKey}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus();
    el.classList.add("ring-2", "ring-primary", "dark:ring-primary-dark");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-primary", "dark:ring-primary-dark"), 1500);
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <SectionIcons.scenes size={16} aria-hidden="true" />
        {dict.sceneEditorTitle}
      </h3>
      <p className="text-xs text-amber-600 dark:text-amber-400">{dict.sceneReorderDisabledNarrated}</p>
      <p className="text-xs text-amber-600 dark:text-amber-400">{dict.sceneDurationDisabledNarrated}</p>
      <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.sceneRemoveGuidanceNarrated}</p>

      <SceneThumbnailStrip
        editable={false}
        items={scenes.map((scene) => ({
          key: scene.id,
          thumbnailUrl: scene.thumbnailUrl,
          overlayText: "",
          durationSec: null,
          scriptLabel: scene.scriptKey ? (scriptLabels[scene.scriptKey] ?? scene.scriptKey) : null,
        }))}
        onThumbnailClick={(i) => setOpenSwapIndex(i)}
        onJumpToScript={jumpToScript}
      />

      {openSwapIndex !== null &&
        (scenes[openSwapIndex]?.scriptKey ? (
          <SceneMediaSwapButton
            sceneMediaAssets={sceneMediaAssets}
            videoId={videoId}
            scriptKey={scenes[openSwapIndex].scriptKey}
            onClose={() => setOpenSwapIndex(null)}
          />
        ) : (
          // Real, honest dead end — not a silent no-op. A handful of
          // narrated videos rendered before VideoScene.scriptKey existed
          // have no way to identify which script section a scene belongs
          // to (the swap action matches scenes to sections by that key),
          // and there's no real data to backfill it from. Tapping such a
          // scene used to do nothing at all; this at least explains why
          // and offers the one real way out (re-rendering via a script
          // edit gives every scene a real scriptKey again).
          <div className="flex flex-col gap-2 rounded border border-paper-border dark:border-night-border p-2 text-xs">
            <p className="text-ink-soft dark:text-ink-soft-dark">{dict.sceneMediaSwapUnavailableLegacy}</p>
            <button
              type="button"
              onClick={() => setOpenSwapIndex(null)}
              className="w-fit text-start text-ink-soft underline dark:text-ink-soft-dark"
            >
              {dict.sceneMediaSwapCancel}
            </button>
          </div>
        ))}
    </div>
  );
}

// Visual redesign (2026-09-07) — a real grid of actual thumbnails,
// replacing a plain <select> of filenames (a user picked "WhatsApp
// Image 2026-08-11 at 6.29.41 PM.jpeg" blind, never seeing the photo).
// Shared by both SceneMediaSwapButton modes. Images render their real
// Media Library preview (asset.url — see PickableMediaAsset's own doc
// comment, src/lib/media.ts); video assets show a real video-icon
// badge instead of a fake/placeholder frame — this app has no frame-
// extraction for a plain uploaded video yet (the main Media Library
// grid has the same honest limitation), so showing one here would be
// exactly the kind of fake preview CLAUDE.md's "no fake functionality"
// rule prohibits.
function MediaThumbnailGrid({
  assets,
  onSelect,
  disabled,
  dict,
}: {
  assets: SceneMediaAssetOption[];
  onSelect: (asset: SceneMediaAssetOption) => void;
  disabled?: boolean;
  dict: ReturnType<typeof useDict>["video"];
}) {
  if (assets.length === 0) return null;
  return (
    <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
      {assets.map((asset) => (
        <button
          key={asset.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(asset)}
          aria-label={asset.fileName}
          title={asset.fileName}
          className="aspect-square overflow-hidden rounded-lg border border-paper-border bg-paper-card transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-night-border dark:bg-night-card dark:hover:border-primary-dark"
        >
          {asset.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element -- a real Media Library thumbnail from arbitrary storage, not a static asset next/image can optimize
            <img src={asset.url} alt={asset.fileName} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center">
              <NavIcons.video size={18} aria-hidden="true" className="text-ink-soft dark:text-ink-soft-dark" />
              <span className="line-clamp-1 text-[10px] text-ink-soft dark:text-ink-soft-dark">{dict.kindVideo}</span>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// A real drag-and-drop dropzone, immediately uploading — not deferred
// to whatever "Save" the caller submits later. Shared by both
// SceneMediaSwapButton modes so there's one real upload path
// (uploadSceneMediaAsset, src/lib/actions/video-edit.ts), not two.
//
// No <form> here on purpose: every caller already renders this inside
// another <form> or a direct-dispatch picker panel (the scene editor's
// own Save, or the narrated swap's own actions) — a nested <form> is
// invalid HTML and browsers don't define real nested-submit behavior.
// useActionState's dispatch works the same way called directly with a
// FormData as it does bound to a form's action, so onDrop/onChange
// building that FormData is enough.
function UploadDropzone({
  onUploaded,
}: {
  onUploaded: (media: { assetId: string; fileName: string; mimeType: string; url: string }) => void;
}) {
  const dict = useDict().video;
  const [state, action, pending] = useActionState(uploadSceneMediaAsset, undefined);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state && "assetId" in state) onUploaded(state);
    // onUploaded intentionally excluded — callers pass a fresh closure
    // each render; re-firing on identity change (not just a real new
    // upload) would re-report the same upload repeatedly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(() => action(formData));
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={pending}
        onClick={() => !pending && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (pending) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!pending) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (!pending) handleFiles(e.dataTransfer.files);
        }}
        className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-3 text-center transition-colors ${
          pending ? "cursor-not-allowed opacity-70" : "cursor-pointer"
        } ${
          isDragOver
            ? "border-primary bg-primary/5 dark:border-primary-dark dark:bg-primary-dark/10"
            : "border-paper-border hover:border-primary/60 dark:border-night-border dark:hover:border-primary-dark/60"
        }`}
      >
        {pending ? <Spinner /> : <ActionIcons.uploadMedia size={18} aria-hidden="true" className="text-ink-soft dark:text-ink-soft-dark" />}
        <span className="text-xs font-medium">{pending ? dict.sceneMediaUploading : dict.sceneMediaDropHint}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          disabled={pending}
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {state && "error" in state && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </div>
  );
}

// The "generate a new AI background" affordance — a real, labeled
// action with its own icon, distinct from the plain-text link it
// replaces. `pending` only ever reflects a REAL in-flight request
// (the narrated/real-form mode's actual swapVideoSceneMedia call);
// non-narrated mode defers the real generation to the batch "Save
// scenes" submit, so it never shows a spinner for work that isn't
// actually happening yet — see this button's two call sites.
function GenerateAiButton({ onClick, pending, dict }: { onClick: () => void; pending: boolean; dict: ReturnType<typeof useDict>["video"] }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-dashed border-paper-border px-3 py-2 text-xs font-medium transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-70 dark:border-night-border dark:hover:border-primary-dark"
    >
      {pending ? <Spinner /> : <ActionIcons.aiGenerate size={16} aria-hidden="true" />}
      {pending ? dict.sceneMediaSwapGenerating : dict.sceneMediaSwapGenerateAi}
    </button>
  );
}

// A small labeled section wrapper — the real visual hierarchy/grouping
// this redesign asked for (pick existing / upload new / generate new
// as three clearly separated groups, not a flat list of options).
function PickerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h5 className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft dark:text-ink-soft-dark">{title}</h5>
      {children}
    </div>
  );
}

// Shared by both narrated (media-swap-only) and non-narrated (full
// editor) scenes — a small inline picker: a real Media Library asset,
// a fresh upload, or a fresh AI background. Used directly with
// swapVideoSceneMedia for narrated scenes; the non-narrated editor
// instead captures the pick into its own local scene-row state (see
// NonNarratedSceneEditor).
//
// Mounted only while open — the caller (NarratedSceneList /
// NonNarratedSceneEditor) tracks which scene's picker is open and
// conditionally renders this, triggered by a real thumbnail tap (Part 4
// of the visual-editor spec) instead of the original list row's own
// "Swap media" button, which this replaces.
function SceneMediaSwapButton({
  videoId,
  scriptKey,
  sceneMediaAssets,
  onPicked,
  onClose,
}: {
  videoId: string;
  scriptKey: string | null;
  sceneMediaAssets: SceneMediaAssetOption[];
  onPicked?: (media: { assetId: string; fileName: string } | { regenerateAi: true }) => void;
  onClose: () => void;
}) {
  const dict = useDict().video;
  const boundAction = scriptKey ? swapVideoSceneMedia.bind(null, videoId, scriptKey) : undefined;
  const [state, action, pending] = useActionState(boundAction ?? swapVideoSceneMedia.bind(null, videoId, ""), undefined);
  useRefreshOnSuccess(state && "success" in state ? true : undefined);

  if (onPicked) {
    // Local (non-narrated editor) mode — no server action here, just
    // report the pick back up to the parent's in-progress scene list.
    // A single click/drop/generate-tap applies the choice immediately
    // (real professional-picker behavior — no separate confirm step),
    // then closes.
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-paper-border p-3 text-xs dark:border-night-border">
        <p className="font-medium">{dict.sceneMediaSwapPickTitle}</p>
        {sceneMediaAssets.length > 0 && (
          <PickerSection title={dict.sceneMediaSwapLibrarySection}>
            <MediaThumbnailGrid
              assets={sceneMediaAssets}
              dict={dict}
              onSelect={(asset) => {
                onPicked({ assetId: asset.id, fileName: asset.fileName });
                onClose();
              }}
            />
          </PickerSection>
        )}
        <PickerSection title={dict.sceneMediaSwapUploadSection}>
          <UploadDropzone
            onUploaded={(media) => {
              onPicked(media);
              onClose();
            }}
          />
        </PickerSection>
        <PickerSection title={dict.sceneMediaSwapGenerateSection}>
          <GenerateAiButton
            pending={false}
            dict={dict}
            onClick={() => {
              onPicked({ regenerateAi: true });
              onClose();
            }}
          />
        </PickerSection>
        <button type="button" onClick={() => onClose()} className="min-h-[44px] text-start text-ink-soft dark:text-ink-soft-dark">
          {dict.sceneMediaSwapCancel}
        </button>
      </div>
    );
  }

  // Narrated mode: a real request, dispatched directly (same no-<form>
  // reasoning as UploadDropzone above — this panel already sits
  // outside any wrapping <form>, but stays consistent with the local
  // branch's direct-dispatch shape rather than mixing patterns).
  function swap(formData: FormData) {
    startTransition(() => action(formData));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-paper-border p-3 text-xs dark:border-night-border">
      <p className="font-medium">{dict.sceneMediaSwapPickTitle}</p>
      {sceneMediaAssets.length > 0 && (
        <PickerSection title={dict.sceneMediaSwapLibrarySection}>
          <MediaThumbnailGrid
            assets={sceneMediaAssets}
            dict={dict}
            disabled={pending}
            onSelect={(asset) => {
              const formData = new FormData();
              formData.set("assetId", asset.id);
              swap(formData);
            }}
          />
        </PickerSection>
      )}
      <PickerSection title={dict.sceneMediaSwapUploadSection}>
        <UploadDropzone
          onUploaded={(media) => {
            const formData = new FormData();
            formData.set("assetId", media.assetId);
            swap(formData);
          }}
        />
      </PickerSection>
      <PickerSection title={dict.sceneMediaSwapGenerateSection}>
        <GenerateAiButton
          pending={pending}
          dict={dict}
          onClick={() => {
            const formData = new FormData();
            formData.set("regenerateAi", "true");
            swap(formData);
          }}
        />
      </PickerSection>
      <button type="button" onClick={() => onClose()} className="min-h-[44px] text-start text-ink-soft dark:text-ink-soft-dark">
        {dict.sceneMediaSwapCancel}
      </button>
      {state && "error" in state && (
        <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <>
          <p role="status" className="text-green-700 dark:text-green-400">
            {dict.sceneMediaSwapSaved}
          </p>
          {state.warnings.map((warning) => (
            <p key={warning} className="text-amber-600 dark:text-amber-400">
              {warning}
            </p>
          ))}
        </>
      )}
    </div>
  );
}

interface SceneRow {
  clientKey: string;
  existingSceneId?: string;
  mediaLabel: string;
  pendingMedia?: { assetId: string; fileName: string } | { regenerateAi: true };
  durationSec: number;
  overlayText: string;
  // The real existing scene's captured thumbnail — kept as-is across a
  // pending media swap (the new image/frame doesn't exist yet, only
  // after a real re-render), so the strip never shows a fake preview,
  // just the honest "still the old image until you save" state.
  thumbnailUrl: string | null;
}

const DEFAULT_SCENE_DURATION = 4.5;
// Mirrors MAX_SCENES in src/lib/video/scene-editor.ts (a server-only
// module this client component can't import from directly) — kept as
// the same real client-side cap the original list editor already
// enforced here, not a new limit.
const MAX_SCENES_CLIENT = 10;

function NonNarratedSceneEditor({
  videoId,
  scenes,
  sceneMediaAssets,
  musicTrack,
  musicVolume,
}: {
  videoId: string;
  scenes: VideoSceneForEdit[];
  sceneMediaAssets: SceneMediaAssetOption[];
  musicTrack: MusicMood | null;
  musicVolume: number;
}) {
  const dict = useDict().video;
  const [rows, setRows] = useState<SceneRow[]>(() =>
    scenes.map((s) => ({
      clientKey: s.id,
      existingSceneId: s.id,
      mediaLabel: s.mediaAsset?.fileName ?? (s.kind === "AI_STILL" ? "AI background" : "—"),
      durationSec: s.durationSec ?? DEFAULT_SCENE_DURATION,
      overlayText: s.overlayText ?? "",
      thumbnailUrl: s.thumbnailUrl,
    })),
  );
  const [openSwapIndex, setOpenSwapIndex] = useState<number | null>(null);
  const [state, action, pending] = useActionState(editVideoScenes.bind(null, videoId), undefined);
  useRefreshOnSuccess(state && "success" in state ? true : undefined);

  function reorder(from: number, to: number) {
    setRows((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    // Simplest correct behavior for the rare "reorder while a swap
    // picker is open" overlap — closing it avoids the picker silently
    // pointing at a different scene than the one the user opened it for.
    setOpenSwapIndex(null);
  }
  function remove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setOpenSwapIndex(null);
  }
  function addScene() {
    setRows((prev) => [
      ...prev,
      { clientKey: `new-${Date.now()}`, mediaLabel: "—", durationSec: DEFAULT_SCENE_DURATION, overlayText: "", thumbnailUrl: null },
    ]);
  }

  const payload = JSON.stringify(
    rows.map((r) => ({
      existingSceneId: r.existingSceneId,
      media: r.pendingMedia,
      durationSec: r.durationSec,
      overlayText: r.overlayText,
    })),
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="scenes" value={payload} />
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <SectionIcons.scenes size={16} aria-hidden="true" />
        {dict.sceneEditorTitle}
      </h3>

      <SceneThumbnailStrip
        editable
        items={rows.map((row) => ({
          key: row.clientKey,
          thumbnailUrl: row.thumbnailUrl,
          overlayText: row.overlayText,
          durationSec: row.durationSec,
          scriptLabel: null,
        }))}
        onThumbnailClick={(i) => setOpenSwapIndex(i)}
        onRemove={remove}
        onAdd={addScene}
        onReorder={reorder}
        onDurationChange={(i, durationSec) =>
          setRows((prev) => prev.map((r, j) => (j === i ? { ...r, durationSec } : r)))
        }
        maxItems={MAX_SCENES_CLIENT}
      />

      {/* On-screen text stays independently editable per scene, same as
          the original list rows — unrelated to whether that scene's
          media-swap picker (triggered from its thumbnail, see the strip
          above) happens to be open right now. */}
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={row.clientKey} className="flex items-center gap-2">
            <label htmlFor={`overlay-text-${row.clientKey}`} className="w-12 shrink-0 text-xs font-medium text-ink-soft dark:text-ink-soft-dark">
              #{i + 1}
            </label>
            <input
              id={`overlay-text-${row.clientKey}`}
              type="text"
              value={row.overlayText}
              placeholder={dict.sceneOverlayTextLabel}
              onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, overlayText: e.target.value } : r)))}
              className="flex-1 rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-base"
            />
          </div>
        ))}
      </div>

      {openSwapIndex !== null &&
        (() => {
          const openRow = rows[openSwapIndex];
          if (!openRow) return null;
          return (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark">
                {dict.sceneCurrentMedia}:{" "}
                {openRow.pendingMedia
                  ? "regenerateAi" in openRow.pendingMedia
                    ? "AI background"
                    : openRow.pendingMedia.fileName
                  : openRow.mediaLabel}
              </span>
              <SceneMediaSwapButton
                videoId={videoId}
                scriptKey={null}
                sceneMediaAssets={sceneMediaAssets}
                onClose={() => setOpenSwapIndex(null)}
                onPicked={(media) =>
                  setRows((prev) =>
                    prev.map((r, j) =>
                      j === openSwapIndex
                        ? { ...r, pendingMedia: media, mediaLabel: "regenerateAi" in media ? "AI background" : media.fileName }
                        : r,
                    ),
                  )
                }
              />
            </div>
          );
        })()}

      <MusicPicker dict={dict} defaultTrack={musicTrack} defaultVolume={musicVolume} />

      {state && "error" in state && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <>
          <p role="status" className="text-green-700 dark:text-green-400">
            {dict.sceneEditorSaved} {dict.editSuccessPreview}
          </p>
          {state.warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-600 dark:text-amber-400">
              {warning}
            </p>
          ))}
        </>
      )}

      <Button type="submit" size="sm" pending={pending} pendingLabel={dict.sceneEditorSaving}>
        {dict.sceneEditorSave}
      </Button>
    </form>
  );
}
