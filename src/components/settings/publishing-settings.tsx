"use client";

import { useActionState } from "react";

import {
  saveAggregatorCredential,
  removeAggregatorCredential,
  setPublishingMode,
} from "@/lib/actions/aggregator-credentials";
import { AGGREGATOR_PROVIDERS } from "@/lib/providers/aggregator/types";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";
import { NavIcons, ActionIcons } from "@/components/icons";
import { Zap } from "lucide-react";
import type { PublishingMode, SocialAggregatorProvider } from "@prisma/client";

interface AggregatorCredentialRow {
  id: string;
  provider: SocialAggregatorProvider;
  keyPreview: string;
}

function AggregatorCredentialForm({
  provider,
  displayName,
  existing,
}: {
  provider: SocialAggregatorProvider;
  displayName: string;
  existing?: AggregatorCredentialRow;
}) {
  const dict = useDict().publishing;
  const commonDict = useDict().common;
  const [state, action, pending] = useActionState(saveAggregatorCredential, undefined);

  if (existing) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span>•••• {existing.keyPreview}</span>
        <form action={removeAggregatorCredential.bind(null, existing.id)}>
          <button
            type="submit"
            className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark"
          >
            {commonDict.remove}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="provider" value={provider} />
      <div className="flex flex-col gap-1">
        <label htmlFor={`${provider}-apiKey`} className="text-sm font-medium">
          {dict.apiKeyLabel}
        </label>
        <input
          id={`${provider}-apiKey`}
          name="apiKey"
          type="password"
          autoComplete="off"
          required
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 font-mono text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${provider}-accountMap`} className="text-sm font-medium">
          {dict.accountMapLabel}
        </label>
        <input
          id={`${provider}-accountMap`}
          name="accountMapRaw"
          type="text"
          placeholder={dict.accountMapPlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 font-mono text-base"
        />
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.accountMapHint}</p>
      </div>
      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <Button type="submit" size="sm" pending={pending} pendingLabel={dict.saving}>
        {dict.saveAndUse.replace("Zernio", displayName)}
      </Button>
    </form>
  );
}

export function PublishingSettings({
  publishingMode,
  credentials,
}: {
  publishingMode: PublishingMode;
  credentials: AggregatorCredentialRow[];
}) {
  const dict = useDict().publishing;

  const credentialFor = (provider: SocialAggregatorProvider) => credentials.find((c) => c.provider === provider);
  const zernioCredential = credentialFor("ZERNIO");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <NavIcons.publish size={18} aria-hidden="true" />
          {dict.settingsTitle}
        </h2>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.settingsSubtitle}</p>
      </div>

      {/* Manual — always available, zero setup */}
      <div className="flex flex-col gap-2 rounded-md border border-paper-border dark:border-night-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium">
            <ActionIcons.download size={16} aria-hidden="true" />
            {dict.modeManualTitle}
          </span>
          {publishingMode === "MANUAL" ? (
            <span className="text-xs text-green-700 dark:text-green-400">{dict.currentMethod}</span>
          ) : (
            <form action={setPublishingMode}>
              <input type="hidden" name="mode" value="MANUAL" />
              <button type="submit" className="text-xs font-medium underline">
                {dict.useThisMethod}
              </button>
            </form>
          )}
        </div>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.modeManualDescription}</p>
      </div>

      {/* Zernio — recommended automated provider */}
      <div className="flex flex-col gap-2 rounded-md border border-paper-border dark:border-night-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium">
            <Zap size={16} aria-hidden="true" />
            {dict.modeAggregatorTitle} <span className="text-xs font-normal text-ink-soft dark:text-ink-soft-dark">{dict.modeAggregatorRecommended}</span>
          </span>
          {publishingMode === "AGGREGATOR" && (
            <span className="text-xs text-green-700 dark:text-green-400">{dict.currentMethod}</span>
          )}
        </div>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.modeAggregatorDescription}</p>

        <AggregatorCredentialForm provider="ZERNIO" displayName="Zernio" existing={zernioCredential} />

        {zernioCredential && publishingMode !== "AGGREGATOR" && (
          <form action={setPublishingMode}>
            <input type="hidden" name="mode" value="AGGREGATOR" />
            <input type="hidden" name="provider" value="ZERNIO" />
            <button type="submit" className="text-xs font-medium underline">
              {dict.useThisMethod}
            </button>
          </form>
        )}
      </div>

      {/* Direct API — Meta is real, TikTok is honestly not */}
      <div className="flex flex-col gap-2 rounded-md border border-paper-border dark:border-night-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium">
            <ActionIcons.publishDirect size={16} aria-hidden="true" />
            {dict.modeDirectApiTitle}
          </span>
          {publishingMode === "DIRECT_API" ? (
            <span className="text-xs text-green-700 dark:text-green-400">{dict.currentMethod}</span>
          ) : (
            <form action={setPublishingMode}>
              <input type="hidden" name="mode" value="DIRECT_API" />
              <button type="submit" className="text-xs font-medium underline">
                {dict.useThisMethod}
              </button>
            </form>
          )}
        </div>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.modeDirectApiDescription}</p>
        <a href="/publish" className="text-sm font-medium underline">
          {dict.goToDirectMeta}
        </a>
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.tiktokNotIntegrated}</p>
      </div>

      {/* Advanced — the rest of the real, verified providers, plus the
          one honestly not implemented yet */}
      <details className="rounded-md border border-paper-border dark:border-night-border p-3">
        <summary className="cursor-pointer text-sm font-medium">{dict.advancedOptions}</summary>
        <ul className="mt-2 flex flex-col gap-3">
          {AGGREGATOR_PROVIDERS.filter((p) => p.provider !== "ZERNIO").map((p) => (
            <li key={p.provider} className="flex flex-col gap-1 rounded-md border border-paper-border dark:border-night-border p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{p.displayName}</span>
                {!p.implemented && (
                  <span className="rounded bg-paper-card dark:bg-night-card px-1.5 py-0.5 text-xs text-ink-soft dark:text-ink-soft-dark">
                    {dict.comingSoon}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{p.pricingSummary}</p>
              {p.implemented ? (
                <AggregatorCredentialForm provider={p.provider} displayName={p.displayName} existing={credentialFor(p.provider)} />
              ) : (
                <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{p.unimplementedReason}</p>
              )}
              {p.implemented && credentialFor(p.provider) && publishingMode !== "AGGREGATOR" && (
                <form action={setPublishingMode}>
                  <input type="hidden" name="mode" value="AGGREGATOR" />
                  <input type="hidden" name="provider" value={p.provider} />
                  <button type="submit" className="text-xs font-medium underline">
                    {dict.useThisMethod}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
