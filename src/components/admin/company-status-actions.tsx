"use client";

import { useTransition } from "react";

import { setCompanyStatus } from "@/lib/actions/admin";

type CompanyStatus = "ACTIVE" | "SUSPENDED" | "BANNED";

export function CompanyStatusActions({ companyId, status }: { companyId: string; status: CompanyStatus }) {
  const [pending, startTransition] = useTransition();

  function set(newStatus: CompanyStatus) {
    startTransition(() => {
      void setCompanyStatus(companyId, newStatus);
    });
  }

  return (
    <div className="flex gap-3">
      {status !== "ACTIVE" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => set("ACTIVE")}
          className="text-xs font-medium underline disabled:opacity-50"
        >
          Reactivate
        </button>
      )}
      {status !== "SUSPENDED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => set("SUSPENDED")}
          className="text-xs font-medium underline disabled:opacity-50"
        >
          Suspend
        </button>
      )}
      {status !== "BANNED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => set("BANNED")}
          className="text-xs font-medium text-red-600 underline disabled:opacity-50 dark:text-red-400"
        >
          Ban
        </button>
      )}
    </div>
  );
}
