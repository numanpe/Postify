"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";

import {
  editVideoAsset,
  editVideoScript,
  swapVideoSceneMedia,
  editVideoScenes,
  uploadSceneMediaAsset,
  type SwapSceneMediaState,
} from "@/lib/actions/video-edit";
import { Button } from "@/components/ui/button";
import { BottomSheet, type BottomSheetHandle } from "@/components/ui/bottom-sheet";
import { useDict } from "@/components/i18n/locale-provider";
import { ActionIcons } from "@/components/icons";
import { SceneThumbnailStrip } from "@/components/campaign/scene-thumbnail-strip";

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
}

interface VideoScript {
  hook: string;
  context: string;
  value: string;
  message: string;
  cta: string;
}

interface VideoEditModalProps {
  videoId: string;
  videoUrl: string;
  hasNarration: boolean;
  script: VideoScript;
  scenes: VideoSceneForEdit[];
  sceneMediaAssets: SceneMediaAssetOption[];
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

          <form action={trimAction} className="flex flex-col gap-3">
            <input type="hidden" name="trimStart" value={trimStart} />
            <input type="hidden" name="trimEnd" value={trimEnd} />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">
                {dict.editVideoTrimStart}: {trimStart.toFixed(1)}s
              </label>
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
              <label className="text-xs font-medium">
                {dict.editVideoTrimEnd}: {trimEnd.toFixed(1)}s
              </label>
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

          <hr className="border-paper-border dark:border-night-border" />

          {hasNarration ? (
            <>
              <ScriptEditorSection videoId={videoId} script={script} />
              <hr className="border-paper-border dark:border-night-border" />
              <NarratedSceneList videoId={videoId} scenes={scenes} sceneMediaAssets={sceneMediaAssets} />
            </>
          ) : (
            <NonNarratedSceneEditor videoId={videoId} scenes={scenes} sceneMediaAssets={sceneMediaAssets} />
          )}
        </div>
      </BottomSheet>
    </>
  );
}

const SCRIPT_KEYS = ["hook", "context", "value", "message", "cta"] as const;

function ScriptEditorSection({ videoId, script }: { videoId: string; script: VideoScript }) {
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

  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold">{dict.scriptEditorTitle}</h3>
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.scriptEditorHint}</p>
      </div>

      {SCRIPT_KEYS.map((key) => {
        const isLastActive = activeCount === 1 && fields[key].trim().length > 0;
        return (
          <div key={key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor={`script-${videoId}-${key}`} className="text-xs font-medium">
                {labels[key]}
              </label>
              <button
                type="button"
                disabled={isLastActive}
                title={isLastActive ? dict.scriptEditorRemoveLastWarning : undefined}
                onClick={() => setFields((f) => ({ ...f, [key]: "" }))}
                className="text-xs font-medium text-ink-soft underline hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 dark:text-ink-soft-dark dark:hover:text-ink-dark"
              >
                {dict.scriptEditorRemoveSection}
              </button>
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

      <p className="text-xs text-amber-600 dark:text-amber-400">{dict.editReRendersWholeVideo}</p>
      {state && "error" in state && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <p role="status" className="text-green-700 dark:text-green-400">
          {dict.scriptEditorSaved} {dict.editSuccessPreview}
        </p>
      )}

      <Button type="submit" size="sm" pending={pending} pendingLabel={dict.scriptEditorSaving}>
        {dict.scriptEditorSave}
      </Button>
    </form>
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
      <h3 className="text-sm font-semibold">{dict.sceneEditorTitle}</h3>
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
        onThumbnailClick={(i) => {
          if (scenes[i].scriptKey) setOpenSwapIndex(i);
        }}
        onJumpToScript={jumpToScript}
      />

      {openSwapIndex !== null && scenes[openSwapIndex]?.scriptKey && (
        <SceneMediaSwapButton
          sceneMediaAssets={sceneMediaAssets}
          videoId={videoId}
          scriptKey={scenes[openSwapIndex].scriptKey}
          onClose={() => setOpenSwapIndex(null)}
        />
      )}
    </div>
  );
}

// A real upload, immediately — not deferred to whatever "Save" the
// caller submits later. Shared by both SceneMediaSwapButton modes so
// there's one real upload path (uploadSceneMediaAsset,
// src/lib/actions/video-edit.ts), not two.
//
// No <form> here on purpose: every caller already renders this inside
// another <form> (the scene editor's own Save, or the narrated swap's
// own submit) — a nested <form> is invalid HTML and browsers don't
// define real nested-submit behavior. useActionState's dispatch works
// the same way called directly with a FormData as it does bound to a
// form's action, so a plain onChange building that FormData is enough.
function SceneMediaUploadField({
  onUploaded,
}: {
  onUploaded: (media: { assetId: string; fileName: string; mimeType: string }) => void;
}) {
  const dict = useDict().video;
  const [state, action, pending] = useActionState(uploadSceneMediaAsset, undefined);

  useEffect(() => {
    if (state && "assetId" in state) onUploaded({ assetId: state.assetId, fileName: state.fileName, mimeType: state.mimeType });
    // onUploaded intentionally excluded — callers pass a fresh closure
    // each render; re-firing on identity change (not just a real new
    // upload) would re-report the same upload repeatedly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="flex flex-col gap-1">
      <label className="w-fit cursor-pointer text-start text-xs underline">
        {pending ? dict.sceneMediaUploading : dict.sceneMediaUploadLabel}
        <input
          type="file"
          accept="image/*,video/*"
          disabled={pending}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const formData = new FormData();
            formData.set("file", file);
            startTransition(() => action(formData));
          }}
        />
      </label>
      {state && "error" in state && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
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
  const [selectedAssetId, setSelectedAssetId] = useState(sceneMediaAssets[0]?.id ?? "");
  const boundAction = scriptKey ? swapVideoSceneMedia.bind(null, videoId, scriptKey) : undefined;
  const [state, action, pending] = useActionState(boundAction ?? swapVideoSceneMedia.bind(null, videoId, ""), undefined);
  useRefreshOnSuccess(state && "success" in state ? true : undefined);

  if (onPicked) {
    // Local (non-narrated editor) mode — no server action here, just
    // report the pick back up to the parent's in-progress scene list.
    return (
      <div className="flex flex-col gap-2 rounded border border-paper-border dark:border-night-border p-2 text-xs">
        <p className="font-medium">{dict.sceneMediaSwapPickTitle}</p>
        {sceneMediaAssets.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              aria-label={dict.sceneMediaSwapPickTitle}
              className="flex-1 rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-base"
            >
              {sceneMediaAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fileName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const asset = sceneMediaAssets.find((a) => a.id === selectedAssetId);
                if (asset) onPicked({ assetId: asset.id, fileName: asset.fileName });
                onClose();
              }}
              className="rounded bg-primary px-2 py-1 font-medium text-paper dark:bg-primary-dark dark:text-night"
            >
              {dict.sceneMediaSwapSave}
            </button>
          </div>
        )}
        {/* Uploading is itself the pick here — no separate "Save" step,
            same as choosing an existing asset above then tapping the
            row's own save button. */}
        <SceneMediaUploadField
          onUploaded={(media) => {
            onPicked(media);
            onClose();
          }}
        />
        <button
          type="button"
          onClick={() => {
            onPicked({ regenerateAi: true });
            onClose();
          }}
          className="text-start underline"
        >
          {dict.sceneMediaSwapGenerateAi}
        </button>
        <button type="button" onClick={() => onClose()} className="text-start text-ink-soft dark:text-ink-soft-dark">
          {dict.sceneMediaSwapCancel}
        </button>
      </div>
    );
  }

  return (
    <SceneMediaSwapForm
      dict={dict}
      sceneMediaAssets={sceneMediaAssets}
      selectedAssetId={selectedAssetId}
      setSelectedAssetId={setSelectedAssetId}
      action={action}
      pending={pending}
      state={state}
      onClose={onClose}
    />
  );
}

// Narrated mode's real-form branch, split out only so the new upload
// field can extend its own local copy of the asset list (the freshly
// uploaded file needs to show up as a selectable option before the
// user hits "Use this" — this component isn't the right place to keep
// that extra state).
function SceneMediaSwapForm({
  dict,
  sceneMediaAssets,
  selectedAssetId,
  setSelectedAssetId,
  action,
  pending,
  state,
  onClose,
}: {
  dict: ReturnType<typeof useDict>["video"];
  sceneMediaAssets: SceneMediaAssetOption[];
  selectedAssetId: string;
  setSelectedAssetId: (id: string) => void;
  action: (formData: FormData) => void;
  pending: boolean;
  state: SwapSceneMediaState;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState(sceneMediaAssets);

  return (
    <form action={action} className="flex flex-col gap-2 rounded border border-paper-border dark:border-night-border p-2 text-xs">
      <p className="font-medium">{dict.sceneMediaSwapPickTitle}</p>
      {assets.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            name="assetId"
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
            aria-label={dict.sceneMediaSwapPickTitle}
            className="flex-1 rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-base"
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fileName}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" pending={pending} pendingLabel={dict.sceneMediaSwapSaving}>
            {dict.sceneMediaSwapSave}
          </Button>
        </div>
      )}
      <SceneMediaUploadField
        onUploaded={(media) => {
          setAssets((prev) => [{ id: media.assetId, fileName: media.fileName, mimeType: media.mimeType }, ...prev]);
          setSelectedAssetId(media.assetId);
        }}
      />
      <button
        type="submit"
        name="regenerateAi"
        value="true"
        disabled={pending}
        className="text-start underline disabled:opacity-60"
      >
        {dict.sceneMediaSwapGenerateAi}
      </button>
      <button type="button" onClick={() => onClose()} className="text-start text-ink-soft dark:text-ink-soft-dark">
        {dict.sceneMediaSwapCancel}
      </button>
      {state && "error" in state && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <p role="status" className="text-green-700 dark:text-green-400">
          {dict.sceneMediaSwapSaved}
        </p>
      )}
    </form>
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
}: {
  videoId: string;
  scenes: VideoSceneForEdit[];
  sceneMediaAssets: SceneMediaAssetOption[];
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
      <h3 className="text-sm font-semibold">{dict.sceneEditorTitle}</h3>

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

      {state && "error" in state && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <p role="status" className="text-green-700 dark:text-green-400">
          {dict.sceneEditorSaved} {dict.editSuccessPreview}
        </p>
      )}

      <Button type="submit" size="sm" pending={pending} pendingLabel={dict.sceneEditorSaving}>
        {dict.sceneEditorSave}
      </Button>
    </form>
  );
}
