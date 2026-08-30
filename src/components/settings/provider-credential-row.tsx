"use client";

import { useRef } from "react";

import {
  promoteProviderCredentialToShared,
  removeProviderCredential,
  removeSharedProviderCredential,
} from "@/lib/actions/provider-credentials";
import { BottomSheet, type BottomSheetHandle } from "@/components/ui/bottom-sheet";
import { useDict } from "@/components/i18n/locale-provider";

interface ProviderCredentialRowProps {
  id: string;
  providerLabel: string;
  keyPreview: string;
  scope: "SHARED" | "COMPANY_ONLY";
  companyName: string;
  canShare: boolean;
  impactCompanyNames: string[];
}

// One row per provider, showing whichever credential is actually active
// for this company (same company-first-then-shared priority the
// resolvers use — see shared-provider-credential.ts) — never both, to
// avoid implying two keys are in play when only one is ever used.
export function ProviderCredentialRow({
  id,
  providerLabel,
  keyPreview,
  scope,
  companyName,
  canShare,
  impactCompanyNames,
}: ProviderCredentialRowProps) {
  const dict = useDict().settings;
  const common = useDict().common;
  const shareSheetRef = useRef<BottomSheetHandle>(null);
  const stopSheetRef = useRef<BottomSheetHandle>(null);

  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-paper-border dark:border-night-border px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span>
          {providerLabel} — •••• {keyPreview}
        </span>
        <form
          action={
            scope === "SHARED" ? removeSharedProviderCredential.bind(null, id) : removeProviderCredential.bind(null, id)
          }
        >
          <button
            type="submit"
            className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark"
          >
            {common.remove}
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-ink-soft dark:text-ink-soft-dark">
          {scope === "SHARED" ? dict.scopeSharedBadge : dict.scopeCompanyOnlyBadge(companyName)}
        </span>

        {scope === "COMPANY_ONLY" && canShare && (
          <button
            type="button"
            onClick={() => shareSheetRef.current?.showModal()}
            className="text-xs font-medium underline decoration-dotted"
          >
            {dict.shareCredentialButton}
          </button>
        )}
        {scope === "SHARED" && (
          <button
            type="button"
            onClick={() => stopSheetRef.current?.showModal()}
            className="text-xs font-medium underline decoration-dotted"
          >
            {dict.stopSharingButton}
          </button>
        )}
      </div>

      {scope === "COMPANY_ONLY" && canShare && (
        <BottomSheet ref={shareSheetRef} title={dict.shareCredentialConfirmTitle} closeLabel={dict.shareCredentialCancel}>
          <div className="flex flex-col gap-3 pb-3">
            <p className="text-sm">{dict.shareCredentialConfirmBody(providerLabel)}</p>
            <div className="flex gap-2">
              <form action={promoteProviderCredentialToShared.bind(null, id)}>
                <button
                  type="submit"
                  className="inline-flex min-h-[48px] items-center rounded-lg bg-primary px-4 text-base font-medium text-paper hover:bg-primary/90 dark:bg-primary-dark dark:text-night dark:hover:bg-primary-dark/90"
                >
                  {dict.shareCredentialConfirmSubmit}
                </button>
              </form>
              <button
                type="button"
                onClick={() => shareSheetRef.current?.close()}
                className="min-h-[48px] px-3 text-sm font-medium text-ink-soft dark:text-ink-soft-dark"
              >
                {dict.shareCredentialCancel}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {scope === "SHARED" && (
        <BottomSheet ref={stopSheetRef} title={dict.stopSharingConfirmTitle} closeLabel={dict.stopSharingCancel}>
          <div className="flex flex-col gap-3 pb-3">
            <p className="text-sm">
              {impactCompanyNames.length > 0
                ? dict.stopSharingImpactBody(impactCompanyNames.join(", "))
                : dict.stopSharingNoImpactBody}
            </p>
            <div className="flex gap-2">
              <form action={removeSharedProviderCredential.bind(null, id)}>
                <button
                  type="submit"
                  className="inline-flex min-h-[48px] items-center rounded-lg bg-red-600 px-4 text-base font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                >
                  {dict.stopSharingConfirmSubmit}
                </button>
              </form>
              <button
                type="button"
                onClick={() => stopSheetRef.current?.close()}
                className="min-h-[48px] px-3 text-sm font-medium text-ink-soft dark:text-ink-soft-dark"
              >
                {dict.stopSharingCancel}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </li>
  );
}
