"use client";

import { useActionState } from "react";

import { createCampaign } from "@/lib/actions/campaign";

export function CampaignForm() {
  const [state, action, pending] = useActionState(createCampaign, undefined);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="objective" className="text-sm font-medium">
          What&apos;s this campaign about?
        </label>
        <input
          id="objective"
          name="objective"
          required
          placeholder="e.g. our spring sale"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
        />
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="startDate" className="text-sm font-medium">
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={today}
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </div>
        <div className="flex w-28 flex-col gap-1">
          <label htmlFor="days" className="text-sm font-medium">
            Days
          </label>
          <input
            id="days"
            name="days"
            type="number"
            min={1}
            max={14}
            defaultValue={7}
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-base font-medium text-white disabled:opacity-60"
      >
        {pending ? "Planning…" : "Create campaign"}
      </button>
    </form>
  );
}
