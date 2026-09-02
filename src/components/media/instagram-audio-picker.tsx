"use client";

import { useState, useTransition } from "react";

import { searchTrendingInstagramAudioAction } from "@/lib/actions/instagram-audio";
import { useDict } from "@/components/i18n/locale-provider";
import type { InstagramAudioAsset } from "@/lib/providers/aggregator/zernio-audio";

// Part 3's real trending-audio picker, embedded inside ShareAssetModal's
// own <form> (never a nested <form> — this only ever uses type="button"
// interactions plus one hidden input, so it submits as part of the
// parent Share form without needing its own). Calls
// searchTrendingInstagramAudioAction directly (useTransition, not
// useActionState) specifically because it lives nested inside another
// form and can't have a <form> of its own to bind an action to.
//
// Same useDict() client hook ShareAssetModal itself already uses —
// deliberately not a prop from the parent, since a Pick<>'d dict prop
// would need re-deriving here too and this component sits entirely
// inside the client tree already (no Server->Client boundary to cross).
export function InstagramAudioPicker() {
  const dict = useDict().media;
  const [expanded, setExpanded] = useState(false);
  const [audioType, setAudioType] = useState<"music" | "original_sound">("music");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InstagramAudioAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InstagramAudioAsset | null>(null);
  const [pending, startTransition] = useTransition();

  function runSearch(nextQuery: string, nextType: "music" | "original_sound") {
    startTransition(async () => {
      const state = await searchTrendingInstagramAudioAction(nextType, nextQuery || undefined);
      if ("error" in state) {
        setError(state.error);
        setResults(null);
      } else {
        setError(null);
        setResults(state.results);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-paper-border dark:border-night-border p-3">
      <input type="hidden" name="instagramAudioId" value={selected?.audioId ?? ""} />
      {!expanded ? (
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            runSearch("", audioType);
          }}
          className="text-left text-xs font-medium underline underline-offset-2"
        >
          {dict.audioBrowse}
        </button>
      ) : (
        <>
          <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.audioHint}</p>
          <select
            value={audioType}
            onChange={(e) => {
              const next = e.target.value as "music" | "original_sound";
              setAudioType(next);
              runSearch(query, next);
            }}
            className="min-h-[48px] rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-sm"
          >
            <option value="music">{dict.audioMusic}</option>
            <option value="original_sound">{dict.audioOriginalSound}</option>
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.audioSearchPlaceholder}
              className="min-h-[48px] flex-1 rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => runSearch(query, audioType)}
              disabled={pending}
              className="rounded-md border border-paper-border dark:border-night-border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {dict.audioSearch}
            </button>
          </div>

          {pending && <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.audioLoading}</p>}
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {results && results.length === 0 && !pending && (
            <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.audioNoResults}</p>
          )}
          {results && results.length > 0 && (
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
              {results.map((asset) => (
                <li key={asset.audioId}>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="_instagramAudioPick"
                      checked={selected?.audioId === asset.audioId}
                      onChange={() => setSelected(asset)}
                      className="accent-current"
                    />
                    <span>
                      {asset.title ?? dict.audioUntitled}
                      {asset.displayArtist ? ` — ${asset.displayArtist}` : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {selected && (
            <p className="text-xs">
              {dict.audioSelectedLabel} {selected.title ?? dict.audioUntitled}{" "}
              <button type="button" onClick={() => setSelected(null)} className="underline underline-offset-2">
                {dict.audioClear}
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}
