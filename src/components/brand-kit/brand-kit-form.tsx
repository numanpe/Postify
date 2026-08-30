"use client";

import { useActionState, useState } from "react";
import Image from "next/image";

import { updateBrandKit } from "@/lib/actions/brand-kit";
import { extractBrandFromWebsite } from "@/lib/actions/brand-extract";
import { applyExtractedBusinessContext } from "@/lib/actions/company";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

type BrandKitDefaults = {
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  fontHeading: string | null;
  fontBody: string | null;
} | null;

const fieldClass =
  "rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base";
const chipButtonClass =
  "rounded-full border border-paper-border dark:border-night-border px-2.5 py-1 text-xs font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark hover:border-ink dark:hover:border-ink-dark";

export function BrandKitForm({ brandKit }: { brandKit: BrandKitDefaults }) {
  const [state, action, pending] = useActionState(updateBrandKit, undefined);
  const dict = useDict().brandKit;

  // Controlled so the website importer (below) can populate them for
  // review — the user can still freely edit anything before saving.
  // Nothing here reaches the server until the real Save Brand Kit
  // submit; extraction itself never writes to BrandKit.
  const [primaryColor, setPrimaryColor] = useState(brandKit?.primaryColor ?? "");
  const [secondaryColor, setSecondaryColor] = useState(brandKit?.secondaryColor ?? "");
  const [accentColor, setAccentColor] = useState(brandKit?.accentColor ?? "");
  const [fontHeading, setFontHeading] = useState(brandKit?.fontHeading ?? "");
  const [fontBody, setFontBody] = useState(brandKit?.fontBody ?? "");
  const [importedLogoUrl, setImportedLogoUrl] = useState<string | null>(null);

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <WebsiteImportPanel
        onApplyLogo={setImportedLogoUrl}
        onApplyColor={(slot, hex) => {
          if (slot === "primary") setPrimaryColor(hex);
          if (slot === "secondary") setSecondaryColor(hex);
          if (slot === "accent") setAccentColor(hex);
        }}
        onApplyFont={(slot, name) => {
          if (slot === "heading") setFontHeading(name);
          if (slot === "body") setFontBody(name);
        }}
        importedLogoUrl={importedLogoUrl}
      />

      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="logo" className="text-sm font-medium">
            {dict.logo}
          </label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/*"
            className="text-sm"
            // A manually chosen file always wins over an imported URL —
            // matches updateBrandKit's own precedence — so picking a
            // file here clears the imported-logo preview/hidden field.
            onChange={(event) => {
              if (event.target.files && event.target.files.length > 0) setImportedLogoUrl(null);
            }}
          />
          {importedLogoUrl && (
            <div className="mt-1 flex items-center gap-2">
              {/* unoptimized — arbitrary external domain (the company's
                  own website), not yet imported into this app's
                  storage, so it can't be added to next.config.ts's
                  remotePatterns allowlist in advance. Still gets
                  next/image's explicit-dimension layout-shift
                  prevention over a plain <img>. */}
              <Image
                src={importedLogoUrl}
                alt=""
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 rounded border border-paper-border object-contain dark:border-night-border"
              />
              <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.importLogoApplied}</p>
            </div>
          )}
          <input type="hidden" name="logoImportUrl" value={importedLogoUrl ?? ""} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="primaryColor" className="text-sm font-medium">
              {dict.primary}
            </label>
            <input
              id="primaryColor"
              name="primaryColor"
              placeholder="#1A2B3C"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className={`${fieldClass} px-2 py-1`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="secondaryColor" className="text-sm font-medium">
              {dict.secondary}
            </label>
            <input
              id="secondaryColor"
              name="secondaryColor"
              placeholder="#1A2B3C"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className={`${fieldClass} px-2 py-1`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="accentColor" className="text-sm font-medium">
              {dict.accent}
            </label>
            <input
              id="accentColor"
              name="accentColor"
              placeholder="#1A2B3C"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className={`${fieldClass} px-2 py-1`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="fontHeading" className="text-sm font-medium">
            {dict.headingFont}
          </label>
          <input
            id="fontHeading"
            name="fontHeading"
            value={fontHeading}
            onChange={(e) => setFontHeading(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="fontBody" className="text-sm font-medium">
            {dict.bodyFont}
          </label>
          <input
            id="fontBody"
            name="fontBody"
            value={fontBody}
            onChange={(e) => setFontBody(e.target.value)}
            className={fieldClass}
          />
        </div>

        {state?.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}

        <Button type="submit" pending={pending} pendingLabel={dict.saving}>
          {dict.save}
        </Button>
      </form>
    </div>
  );
}

function WebsiteImportPanel({
  onApplyLogo,
  onApplyColor,
  onApplyFont,
  importedLogoUrl,
}: {
  onApplyLogo: (url: string) => void;
  onApplyColor: (slot: "primary" | "secondary" | "accent", hex: string) => void;
  onApplyFont: (slot: "heading" | "body", name: string) => void;
  importedLogoUrl: string | null;
}) {
  const [state, action, pending] = useActionState(extractBrandFromWebsite, undefined);
  const dict = useDict().brandKit;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-paper-border dark:border-night-border p-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{dict.importTitle}</h2>
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.importSubtitle}</p>
      </div>

      <form action={action} className="flex gap-2">
        <input
          name="websiteUrl"
          type="text"
          placeholder={dict.importPlaceholder}
          required
          className={`${fieldClass} flex-1`}
        />
        <Button type="submit" size="sm" pending={pending} pendingLabel={dict.importExtracting}>
          {dict.importButton}
        </Button>
      </form>

      {state?.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      {state?.status === "success" && (
        <div className="flex flex-col gap-4 border-t border-paper-border dark:border-night-border pt-3">
          <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.importReviewHint}</p>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{dict.importLogoFound}</span>
            {state.assets.logoUrl ? (
              <div className="flex items-center gap-2">
                {/* unoptimized — same external-domain reason as the
                    other logo preview above. */}
                <Image
                  src={state.assets.logoUrl}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10 rounded border border-paper-border object-contain dark:border-night-border"
                />
                <button
                  type="button"
                  onClick={() => state.assets.logoUrl && onApplyLogo(state.assets.logoUrl)}
                  className={chipButtonClass}
                >
                  {importedLogoUrl === state.assets.logoUrl ? dict.importApplied : dict.importUseLogo}
                </button>
              </div>
            ) : (
              <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.importNoLogo}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{dict.importColorsFound}</span>
            {state.assets.colors.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {state.assets.colors.map((hex) => (
                  <li key={hex} className="flex items-center gap-2">
                    <span
                      className="h-5 w-5 shrink-0 rounded border border-paper-border dark:border-night-border"
                      style={{ backgroundColor: hex }}
                      aria-hidden="true"
                    />
                    <span className="w-20 shrink-0 font-mono text-xs">{hex}</span>
                    <button type="button" onClick={() => onApplyColor("primary", hex)} className={chipButtonClass}>
                      {dict.importUseAsPrimary}
                    </button>
                    <button type="button" onClick={() => onApplyColor("secondary", hex)} className={chipButtonClass}>
                      {dict.importUseAsSecondary}
                    </button>
                    <button type="button" onClick={() => onApplyColor("accent", hex)} className={chipButtonClass}>
                      {dict.importUseAsAccent}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.importNoColors}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{dict.importFontsFound}</span>
            {state.assets.fontFamilies.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {state.assets.fontFamilies.map((name) => (
                  <li key={name} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs">{name}</span>
                    <button type="button" onClick={() => onApplyFont("heading", name)} className={chipButtonClass}>
                      {dict.importUseAsHeading}
                    </button>
                    <button type="button" onClick={() => onApplyFont("body", name)} className={chipButtonClass}>
                      {dict.importUseAsBody}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.importNoFonts}</p>
            )}
          </div>

          <BusinessContextReview businessContext={state.businessContext} />
        </div>
      )}
    </div>
  );
}

// Part A2: business context (description/tone/likely products), shown
// in the same review pass as the visual assets above, but saved via its
// own action (applyExtractedBusinessContext) since it writes to
// Company/CreativeDna, not BrandKit — genuinely different models.
// Nothing here is applied until this section's own Apply button is
// clicked, same review-before-apply rule as the rest of this panel.
function BusinessContextReview({
  businessContext,
}: {
  businessContext: { description: string; products: string[]; tone: string; providerName: string } | null;
}) {
  const dict = useDict().brandKit;
  const [state, action, pending] = useActionState(applyExtractedBusinessContext, undefined);
  const [description, setDescription] = useState(businessContext?.description ?? "");
  const [tone, setTone] = useState(businessContext?.tone ?? "");
  const [addedNiches, setAddedNiches] = useState<string[]>([]);

  if (!businessContext) {
    return (
      <div className="flex flex-col gap-1 border-t border-paper-border dark:border-night-border pt-3">
        <span className="text-xs font-medium">{dict.importContextFound}</span>
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.importNoContext}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 border-t border-paper-border dark:border-night-border pt-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="importDescription" className="text-xs font-medium">
          {dict.importDescriptionFound}
        </label>
        <textarea
          id="importDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={`${fieldClass} text-sm`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="importTone" className="text-xs font-medium">
          {dict.importToneFound}
        </label>
        <input id="importTone" value={tone} onChange={(e) => setTone(e.target.value)} className={fieldClass} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium">{dict.importProductsFound}</span>
        {businessContext.products.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {businessContext.products.map((product) => {
              const added = addedNiches.includes(product);
              return (
                <li key={product}>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => setAddedNiches((prev) => [...prev, product])}
                    className={`${chipButtonClass} disabled:cursor-default disabled:opacity-60`}
                  >
                    {added ? `${product} ✓` : `+ ${product}`}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.importNoProducts}</p>
        )}
      </div>

      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="businessDescription" value={description} />
        <input type="hidden" name="tone" value={tone} />
        <input type="hidden" name="additionalNiches" value={addedNiches.join(",")} />
        {state && "error" in state && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        {state && "success" in state && (
          <p role="status" className="text-xs text-green-700 dark:text-green-400">
            {dict.importApplied}
          </p>
        )}
        <Button type="submit" size="sm" pending={pending} pendingLabel={dict.saving}>
          {dict.importApplyContext}
        </Button>
      </form>
    </div>
  );
}
