"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { editVideoAsset, editVideoScript, swapVideoSceneMedia, editVideoScenes } from "@/lib/actions/video-edit";
import { Button } from "@/components/ui/button";
import { BottomSheet, type BottomSheetHandle } from "@/components/ui/bottom-sheet";
import { useDict } from "@/components/i18n/locale-provider";
import { ActionIcons } from "@/components/icons";

export interface VideoSceneForEdit {
  id: string;
  order: number;
  kind: "REAL_PHOTO" | "REAL_VIDEO" | "AI_STILL";
  mediaAssetId: string | null;
  scriptKey: string | null;
  durationSec: number | null;
  overlayText: string | null;
  mediaAsset: { id: string; fileName: string } | null;
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
          <video
            src={videoUrl}
            controls
            className="w-full rounded bg-black"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              setDuration(d);
              setTrimStart(0);
              setTrimEnd(d);
            }}
          />

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

            {trimState && "error" in trimState && <p className="text-red-600 dark:text-red-400">{trimState.error}</p>}
            {trimState && "success" in trimState && (
              <p className="text-green-700 dark:text-green-400">{dict.editVideoSaved}</p>
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
      {state && "error" in state && <p className="text-red-600 dark:text-red-400">{state.error}</p>}
      {state && "success" in state && (
        <p className="text-green-700 dark:text-green-400">
          {dict.scriptEditorSaved} {dict.editSuccessPreview}
        </p>
      )}

      <Button type="submit" size="sm" pending={pending} pendingLabel={dict.scriptEditorSaving}>
        {dict.scriptEditorSave}
      </Button>
    </form>
  );
}

// Narrated videos: every scene is read-only order/duration (both follow
// the real narration timing — see scene-editor.ts) with an explicit,
// visible explanation rather than hidden controls. Swap-media is the
// one real, safe per-scene action here.
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
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{dict.sceneEditorTitle}</h3>
      <p className="text-xs text-amber-600 dark:text-amber-400">{dict.sceneReorderDisabledNarrated}</p>
      <p className="text-xs text-amber-600 dark:text-amber-400">{dict.sceneDurationDisabledNarrated}</p>
      <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.sceneRemoveGuidanceNarrated}</p>

      <ul className="flex flex-col gap-2">
        {scenes.map((scene) => (
          <li
            key={scene.id}
            className="flex items-center justify-between gap-2 rounded border border-paper-border dark:border-night-border p-2 text-sm"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark">
                {scene.scriptKey ?? `#${scene.order + 1}`}
              </span>
              <span>{scene.mediaAsset?.fileName ?? (scene.kind === "AI_STILL" ? "AI background" : "—")}</span>
            </div>
            <SceneMediaSwapButton
              disabled={!scene.scriptKey}
              sceneMediaAssets={sceneMediaAssets}
              videoId={videoId}
              scriptKey={scene.scriptKey}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

// Shared by both narrated (media-swap-only) and non-narrated (full
// editor) scenes — a small inline picker: a real Media Library asset,
// or a fresh AI background. Used directly with swapVideoSceneMedia for
// narrated scenes; the non-narrated editor instead captures the pick
// into its own local scene-row state (see NonNarratedSceneEditor).
function SceneMediaSwapButton({
  videoId,
  scriptKey,
  sceneMediaAssets,
  disabled,
  onPicked,
}: {
  videoId: string;
  scriptKey: string | null;
  sceneMediaAssets: SceneMediaAssetOption[];
  disabled?: boolean;
  onPicked?: (media: { assetId: string; fileName: string } | { regenerateAi: true }) => void;
}) {
  const dict = useDict().video;
  const [open, setOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(sceneMediaAssets[0]?.id ?? "");
  const boundAction = scriptKey ? swapVideoSceneMedia.bind(null, videoId, scriptKey) : undefined;
  const [state, action, pending] = useActionState(boundAction ?? swapVideoSceneMedia.bind(null, videoId, ""), undefined);
  useRefreshOnSuccess(state && "success" in state ? true : undefined);

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="shrink-0 rounded border border-paper-border dark:border-night-border px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40"
      >
        {dict.sceneMediaSwap}
      </button>
    );
  }

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
                setOpen(false);
              }}
              className="rounded bg-primary px-2 py-1 font-medium text-paper dark:bg-primary-dark dark:text-night"
            >
              {dict.sceneMediaSwapSave}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            onPicked({ regenerateAi: true });
            setOpen(false);
          }}
          className="text-start underline"
        >
          {dict.sceneMediaSwapGenerateAi}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-start text-ink-soft dark:text-ink-soft-dark">
          {dict.sceneMediaSwapCancel}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 rounded border border-paper-border dark:border-night-border p-2 text-xs">
      <p className="font-medium">{dict.sceneMediaSwapPickTitle}</p>
      {sceneMediaAssets.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            name="assetId"
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
            className="flex-1 rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-base"
          >
            {sceneMediaAssets.map((a) => (
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
      <button
        type="submit"
        name="regenerateAi"
        value="true"
        disabled={pending}
        className="text-start underline disabled:opacity-60"
      >
        {dict.sceneMediaSwapGenerateAi}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-start text-ink-soft dark:text-ink-soft-dark">
        {dict.sceneMediaSwapCancel}
      </button>
      {state && "error" in state && <p className="text-red-600 dark:text-red-400">{state.error}</p>}
      {state && "success" in state && <p className="text-green-700 dark:text-green-400">{dict.sceneMediaSwapSaved}</p>}
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
}

const DEFAULT_SCENE_DURATION = 4.5;

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
    })),
  );
  const [state, action, pending] = useActionState(editVideoScenes.bind(null, videoId), undefined);
  useRefreshOnSuccess(state && "success" in state ? true : undefined);

  function move(index: number, delta: number) {
    setRows((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function remove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }
  function addScene() {
    setRows((prev) => [
      ...prev,
      { clientKey: `new-${Date.now()}`, mediaLabel: "—", durationSec: DEFAULT_SCENE_DURATION, overlayText: "" },
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

      <ul className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <li key={row.clientKey} className="flex flex-col gap-2 rounded border border-paper-border dark:border-night-border p-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark">
                {dict.sceneCurrentMedia}: {row.pendingMedia ? "regenerateAi" in row.pendingMedia ? "AI background" : row.pendingMedia.fileName : row.mediaLabel}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={dict.sceneMoveUp}
                  className="min-h-[36px] min-w-[36px] rounded border border-paper-border dark:border-night-border disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={dict.sceneMoveDown}
                  className="min-h-[36px] min-w-[36px] rounded border border-paper-border dark:border-night-border disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">{dict.sceneOverlayTextLabel}</label>
              <input
                type="text"
                value={row.overlayText}
                onChange={(e) =>
                  setRows((prev) => prev.map((r, j) => (j === i ? { ...r, overlayText: e.target.value } : r)))
                }
                className="rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-base"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">
                {dict.sceneDurationLabel}: {row.durationSec.toFixed(1)}s
              </label>
              <input
                type="range"
                min={1.5}
                max={10}
                step={0.5}
                value={row.durationSec}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, j) => (j === i ? { ...r, durationSec: Number(e.target.value) } : r)),
                  )
                }
                className="min-h-[36px] accent-current"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <SceneMediaSwapButton
                videoId={videoId}
                scriptKey={null}
                sceneMediaAssets={sceneMediaAssets}
                onPicked={(media) =>
                  setRows((prev) =>
                    prev.map((r, j) =>
                      j === i
                        ? { ...r, pendingMedia: media, mediaLabel: "regenerateAi" in media ? "AI background" : media.fileName }
                        : r,
                    ),
                  )
                }
              />
              <button
                type="button"
                disabled={rows.length === 1}
                onClick={() => remove(i)}
                className="text-xs font-medium text-red-600 underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400"
              >
                {dict.sceneRemoveButton}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addScene}
        disabled={rows.length >= 10}
        className="rounded border border-dashed border-paper-border dark:border-night-border px-2 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
      >
        {dict.sceneAddButton}
      </button>

      {state && "error" in state && <p className="text-red-600 dark:text-red-400">{state.error}</p>}
      {state && "success" in state && (
        <p className="text-green-700 dark:text-green-400">
          {dict.sceneEditorSaved} {dict.editSuccessPreview}
        </p>
      )}

      <Button type="submit" size="sm" pending={pending} pendingLabel={dict.sceneEditorSaving}>
        {dict.sceneEditorSave}
      </Button>
    </form>
  );
}
