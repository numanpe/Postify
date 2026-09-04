"use client";

import { useActionState, useState } from "react";

import {
  saveAggregatorCredential,
  updateAggregatorAccountMap,
  addAggregatorAccount,
  renameAggregatorAccount,
  removeAggregatorAccount,
  setDefaultAggregatorAccount,
  removeAggregatorCredential,
  setPublishingMode,
  confirmZernioAccountSelection,
} from "@/lib/actions/aggregator-credentials";
import { AGGREGATOR_PROVIDERS } from "@/lib/providers/aggregator/types";
import { platformLabel } from "@/lib/platform-labels";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";
import { NavIcons, ActionIcons } from "@/components/icons";
import { Zap } from "lucide-react";
import type { PublishingMode, SocialAggregatorProvider, SocialPlatform } from "@prisma/client";

const SOCIAL_PLATFORMS: SocialPlatform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "TIKTOK"];
// Zernio's own real connect-endpoint slugs (see zernio-connect.ts) —
// lowercase, distinct from the SocialPlatform enum above, one link per
// platform right in this UI.
const ZERNIO_CONNECT_PLATFORMS: { slug: string; platform: SocialPlatform }[] = [
  { slug: "facebook", platform: "FACEBOOK" },
  { slug: "instagram", platform: "INSTAGRAM" },
  { slug: "linkedin", platform: "LINKEDIN" },
  { slug: "tiktok", platform: "TIKTOK" },
];

export interface PendingZernioConnect {
  credentialId: string;
  platform: string;
  profileId: string;
  tempToken: string;
  userProfile: string;
  pages: { id: string; name: string }[];
}

interface AggregatorAccountRow {
  id: string;
  platform: SocialPlatform;
  accountId: string;
  label: string;
  isDefault: boolean;
}

interface AggregatorCredentialRow {
  id: string;
  provider: SocialAggregatorProvider;
  keyPreview: string;
  accountMap: unknown;
  accounts: AggregatorAccountRow[];
}

// Real UX gap found live (2026-09-03): a saved credential used to
// collapse to just "•••• 1762" + Remove, with zero visibility into
// whether accountMap actually had anything in it, and no way to add or
// fix account IDs afterward short of deleting the whole credential and
// re-typing the API key. Confirmed via direct DB evidence that this is
// exactly how a real user ends up with a saved, "Currently in use"
// credential and a genuinely empty accountMap. This form shows the real
// current state and lets it be fixed in place.
function AccountMapStatus({
  credentialId,
  provider,
  accountMap,
}: {
  credentialId: string;
  provider: SocialAggregatorProvider;
  accountMap: unknown;
}) {
  const dict = useDict();
  const t = dict.publishing;
  const [state, action, pending] = useActionState(updateAggregatorAccountMap, undefined);

  const map = (accountMap ?? {}) as Record<string, string>;
  const isUploadPost = provider === "UPLOAD_POST";
  const mappedPlatforms = isUploadPost
    ? map["_PROFILE_"]
      ? ["_PROFILE_"]
      : []
    : Object.keys(map).filter((key) => key !== "_PROFILE_");
  const currentRaw = Object.entries(map)
    .map(([platform, accountId]) => `${platform}:${accountId}`)
    .join(", ");

  return (
    <div className="flex flex-col gap-2">
      {mappedPlatforms.length === 0 ? (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{t.accountMapMissingWarning}</p>
      ) : (
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
          {t.accountMapConnectedPrefix}
          {isUploadPost ? map["_PROFILE_"] : mappedPlatforms.map((p) => platformLabel(dict, p as SocialPlatform)).join(", ")}
        </p>
      )}
      <form action={action} className="flex flex-col gap-1.5">
        <input type="hidden" name="credentialId" value={credentialId} />
        <input
          name="accountMapRaw"
          type="text"
          defaultValue={currentRaw}
          placeholder={t.accountMapPlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 font-mono text-sm"
        />
        {state?.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        <Button type="submit" size="sm" pending={pending} pendingLabel={t.saving}>
          {t.updateAccountMapButton}
        </Button>
      </form>
    </div>
  );
}

function AccountRow({ account, showDefaultControls }: { account: AggregatorAccountRow; showDefaultControls: boolean }) {
  const dict = useDict();
  const t = dict.publishing;
  const commonDict = dict.common;
  const [renaming, setRenaming] = useState(false);
  const [renameState, renameAction, renamePending] = useActionState(renameAggregatorAccount, undefined);

  if (renaming) {
    return (
      <form action={renameAction} className="flex items-center gap-1.5">
        <input type="hidden" name="accountId" value={account.id} />
        <input
          name="label"
          type="text"
          defaultValue={account.label}
          autoFocus
          className="min-w-0 flex-1 rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-sm"
        />
        <Button type="submit" size="sm" pending={renamePending} pendingLabel={t.saving}>
          {commonDict.save}
        </Button>
        <button type="button" onClick={() => setRenaming(false)} className="text-xs text-ink-soft dark:text-ink-soft-dark">
          {commonDict.cancel}
        </button>
        {renameState?.error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{renameState.error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex min-w-0 flex-col">
        <span className="truncate">{account.label}</span>
        <span className="truncate font-mono text-xs text-ink-soft dark:text-ink-soft-dark">{account.accountId}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        {showDefaultControls &&
          (account.isDefault ? (
            <span className="text-green-700 dark:text-green-400">{t.defaultBadge}</span>
          ) : (
            <form action={setDefaultAggregatorAccount.bind(null, account.id)}>
              <button type="submit" className="font-medium underline">
                {t.makeDefaultButton}
              </button>
            </form>
          ))}
        <button type="button" onClick={() => setRenaming(true)} className="font-medium underline">
          {t.renameButton}
        </button>
        <form action={removeAggregatorAccount.bind(null, account.id)}>
          <button type="submit" className="text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark">
            {commonDict.remove}
          </button>
        </form>
      </div>
    </div>
  );
}

// The real finishing step of the embedded headless connect flow — see
// settings/page.tsx's own handling of the zernioConnect=1 redirect and
// confirmZernioAccountSelection's own doc comment. Renders every real
// page Zernio returned so the user genuinely picks which one(s) to add
// (never auto-selecting the first one), each with its own label input
// so multiple pages stay distinguishable the same way manually-added
// accounts already are.
function ZernioAccountPicker({ pending }: { pending: PendingZernioConnect }) {
  const dict = useDict().publishing;
  const [state, action, pending_] = useActionState(confirmZernioAccountSelection, undefined);

  if (state && "success" in state && state.success) {
    return <p role="status" className="text-sm text-green-700 dark:text-green-400">{dict.zernioPickerSuccess(state.addedCount)}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-2 rounded-md border border-paper-border dark:border-night-border p-3">
      <input type="hidden" name="credentialId" value={pending.credentialId} />
      <input type="hidden" name="platform" value={pending.platform} />
      <input type="hidden" name="profileId" value={pending.profileId} />
      <input type="hidden" name="tempToken" value={pending.tempToken} />
      <input type="hidden" name="userProfile" value={pending.userProfile} />
      <p className="text-sm font-medium">{dict.zernioPickerTitle}</p>
      <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.zernioPickerHint}</p>
      {pending.pages.map((page) => (
        <div key={page.id} className="flex items-center gap-2">
          <input type="checkbox" name={`selected_${page.id}`} id={`zpage-${page.id}`} className="h-4 w-4 accent-current" />
          <input type="hidden" name={`pageName_${page.id}`} value={page.name} />
          <label htmlFor={`zpage-${page.id}`} className="w-1/3 shrink-0 truncate text-sm">
            {page.name}
          </label>
          <input
            name={`label_${page.id}`}
            type="text"
            defaultValue={page.name}
            placeholder={dict.zernioPickerLabelPlaceholder}
            className="min-w-0 flex-1 rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-sm"
          />
        </div>
      ))}
      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {dict.zernioConnectErrorPrefix}
          {state.error}
        </p>
      )}
      <Button type="submit" size="sm" pending={pending_}>
        {dict.zernioPickerConfirm}
      </Button>
    </form>
  );
}

function AddAccountForm({ credentialId }: { credentialId: string }) {
  const t = useDict().publishing;
  const dict = useDict();
  const [state, action, pending] = useActionState(addAggregatorAccount, undefined);

  return (
    <form action={action} className="flex flex-col gap-1.5 rounded-md border border-dashed border-paper-border dark:border-night-border p-2">
      <input type="hidden" name="credentialId" value={credentialId} />
      <div className="flex gap-1.5">
        <select
          name="platform"
          required
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1.5 text-sm"
        >
          {SOCIAL_PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {platformLabel(dict, p)}
            </option>
          ))}
        </select>
        <input
          name="accountId"
          type="text"
          required
          placeholder={t.accountIdPlaceholder}
          className="min-w-0 flex-1 rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1.5 font-mono text-sm"
        />
      </div>
      <input
        name="label"
        type="text"
        required
        placeholder={t.accountLabelPlaceholder}
        className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1.5 text-sm"
      />
      {state?.error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <Button type="submit" size="sm" pending={pending} pendingLabel={t.saving}>
        {t.addAccountButton}
      </Button>
    </form>
  );
}

// 2026-09-03 multi-account redesign — Part 3: a saved credential used to
// only ever hold one account per platform (see
// project_zernio_accountmap_edit_in_settings). Real connected accounts
// now render grouped by platform, each with its own real label, default
// marker (only meaningful once a platform has more than one — the
// CampaignItem/recurring-plan path always uses the default), rename, and
// remove, plus an always-visible add-account form.
function AggregatorAccountsManager({
  credentialId,
  provider,
  accounts,
  pendingZernioConnect,
}: {
  credentialId: string;
  provider: SocialAggregatorProvider;
  accounts: AggregatorAccountRow[];
  pendingZernioConnect: PendingZernioConnect | null;
}) {
  const dict = useDict();
  const t = dict.publishing;
  const isZernio = provider === "ZERNIO";

  const byPlatform = new Map<SocialPlatform, AggregatorAccountRow[]>();
  for (const account of accounts) {
    const list = byPlatform.get(account.platform) ?? [];
    list.push(account);
    byPlatform.set(account.platform, list);
  }

  return (
    <div className="flex flex-col gap-2">
      {accounts.length === 0 ? (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{t.accountMapMissingWarning}</p>
      ) : (
        [...byPlatform.entries()].map(([platform, list]) => (
          <div key={platform} className="flex flex-col gap-1">
            <p className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark">{platformLabel(dict, platform)}</p>
            <div className="flex flex-col gap-1 rounded-md border border-paper-border dark:border-night-border p-2">
              {list.map((account) => (
                <AccountRow key={account.id} account={account} showDefaultControls={list.length > 1} />
              ))}
            </div>
          </div>
        ))
      )}

      {isZernio && (
        <div className="flex flex-wrap gap-2">
          {ZERNIO_CONNECT_PLATFORMS.map(({ slug, platform }) => (
            <a
              key={slug}
              href={`/api/aggregator/zernio/connect?credentialId=${credentialId}&platform=${slug}`}
              className="rounded-md border border-paper-border dark:border-night-border px-2.5 py-1.5 text-xs font-medium hover:bg-paper-card dark:hover:bg-night-card"
            >
              {t.connectViaZernio} {platformLabel(dict, platform)}
            </a>
          ))}
        </div>
      )}

      {isZernio && pendingZernioConnect?.credentialId === credentialId && (
        <ZernioAccountPicker pending={pendingZernioConnect} />
      )}

      {isZernio ? (
        <details className="rounded-md border border-dashed border-paper-border dark:border-night-border p-2">
          <summary className="cursor-pointer text-xs font-medium">{t.connectManually}</summary>
          <div className="mt-2">
            <AddAccountForm credentialId={credentialId} />
          </div>
        </details>
      ) : (
        <AddAccountForm credentialId={credentialId} />
      )}
    </div>
  );
}

function AggregatorCredentialForm({
  provider,
  displayName,
  existing,
  pendingZernioConnect,
  zernioConnectError,
}: {
  provider: SocialAggregatorProvider;
  displayName: string;
  existing?: AggregatorCredentialRow;
  pendingZernioConnect?: PendingZernioConnect | null;
  zernioConnectError?: string | null;
}) {
  const dict = useDict().publishing;
  const commonDict = useDict().common;
  const [state, action, pending] = useActionState(saveAggregatorCredential, undefined);

  if (existing) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
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
        {provider === "ZERNIO" && zernioConnectError && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {dict.zernioConnectErrorPrefix}
            {zernioConnectError}
          </p>
        )}
        {provider === "UPLOAD_POST" ? (
          <AccountMapStatus credentialId={existing.id} provider={provider} accountMap={existing.accountMap} />
        ) : (
          <AggregatorAccountsManager
            credentialId={existing.id}
            provider={provider}
            accounts={existing.accounts}
            pendingZernioConnect={provider === "ZERNIO" ? (pendingZernioConnect ?? null) : null}
          />
        )}
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
      {provider === "UPLOAD_POST" ? (
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
      ) : null}
      {/* 2026-09-03 multi-account redesign: for every provider except
          Upload-Post, real account IDs are now added one at a time, with
          a real label, right after saving — see AggregatorAccountsManager
          below. No accountMapRaw field here any more for those (it would
          have silently gone nowhere: getRealPublishTargets/
          attemptAggregatorPublish no longer read accountMap for anything
          but Upload-Post's profile). */}
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <Button type="submit" size="sm" pending={pending} pendingLabel={dict.saving}>
        {dict.saveAndUse.replace("Zernio", displayName)}
      </Button>
    </form>
  );
}

export function PublishingSettings({
  publishingMode,
  credentials,
  pendingZernioConnect,
  zernioConnectError,
}: {
  publishingMode: PublishingMode;
  credentials: AggregatorCredentialRow[];
  pendingZernioConnect?: PendingZernioConnect | null;
  zernioConnectError?: string | null;
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
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.modeAggregatorConnectHint}</p>

        <AggregatorCredentialForm
          provider="ZERNIO"
          displayName="Zernio"
          existing={zernioCredential}
          pendingZernioConnect={pendingZernioConnect}
          zernioConnectError={zernioConnectError}
        />

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

      {/* Advanced — direct platform connection (currently tester-gated
          on our side, see directApiTesterNote) plus the rest of the
          real, verified aggregator providers. Zernio above is the
          primary path for real users precisely because this section
          isn't — moved here, not removed, per the real distinction
          between "developer/tester" and "real user" access. */}
      <details className="rounded-md border border-paper-border dark:border-night-border p-3">
        <summary className="cursor-pointer text-sm font-medium">{dict.advancedOptions}</summary>
        <ul className="mt-2 flex flex-col gap-3">
          <li className="flex flex-col gap-2 rounded-md border border-paper-border dark:border-night-border p-2 text-sm">
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
            <p className="text-ink-soft dark:text-ink-soft-dark">{dict.modeDirectApiDescription}</p>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{dict.directApiTesterNote}</p>
            <a href="/publish" className="font-medium underline">
              {dict.goToDirectMeta}
            </a>
            <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.tiktokNotIntegrated}</p>
          </li>
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
