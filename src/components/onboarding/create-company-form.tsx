"use client";

import { useActionState } from "react";

import { createCompany } from "@/lib/actions/company";
import { INDUSTRIES } from "@/lib/industries";

export function CreateCompanyForm() {
  const [state, action, pending] = useActionState(createCompany, undefined);

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Company name
        </label>
        <input
          id="name"
          name="name"
          required
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="primaryIndustry" className="text-sm font-medium">
          Primary industry
        </label>
        <select
          id="primaryIndustry"
          name="primaryIndustry"
          required
          defaultValue=""
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
        >
          <option value="" disabled>
            Select an industry
          </option>
          {INDUSTRIES.map((industry) => (
            <option key={industry} value={industry}>
              {industry}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="secondaryNiches" className="text-sm font-medium">
          Secondary niches{" "}
          <span className="font-normal text-neutral-500">(optional, comma-separated)</span>
        </label>
        <input
          id="secondaryNiches"
          name="secondaryNiches"
          placeholder="e.g. Livestock, B2B"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-base font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create company"}
      </button>
    </form>
  );
}
