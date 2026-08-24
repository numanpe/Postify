import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { CompanyStatusActions } from "@/components/admin/company-status-actions";

export default async function AdminPage() {
  await requireAdmin();

  // Part 4.3 of free-ai-plan.md: real aggregate usage (counts only,
  // never prompt/response content) for the shared "Free AI" pool, most
  // recent first — lets an admin see actual usage against the
  // provider's real (not our guessed) daily limit over time.
  const sharedAiUsage = await db.sharedAiUsage.findMany({
    orderBy: { date: "desc" },
    take: 14,
  });

  const companies = await db.company.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      primaryIndustry: true,
      createdAt: true,
      members: {
        where: { role: "OWNER" },
        take: 1,
        select: { user: { select: { email: true } } },
      },
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Free AI pool usage</h1>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-paper-border dark:border-night-border">
                <th className="py-2 pr-4 font-medium">Date (UTC)</th>
                <th className="py-2 pr-4 font-medium">Provider</th>
                <th className="py-2 pr-4 font-medium">Successful generations</th>
                <th className="py-2 pr-4 font-medium">Exhausted</th>
              </tr>
            </thead>
            <tbody>
              {sharedAiUsage.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-ink-soft dark:text-ink-soft-dark">
                    No usage recorded yet.
                  </td>
                </tr>
              ) : (
                sharedAiUsage.map((row) => (
                  <tr key={row.id} className="border-b border-paper-border dark:border-night-border">
                    <td className="py-2 pr-4">{row.date.toLocaleDateString()}</td>
                    <td className="py-2 pr-4">{row.provider}</td>
                    <td className="py-2 pr-4">{row.successCount}</td>
                    <td className="py-2 pr-4">
                      {row.exhaustedAt ? `Yes, at ${row.exhaustedAt.toLocaleTimeString()}` : "No"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Companies</h1>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-paper-border dark:border-night-border">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Owner</th>
                <th className="py-2 pr-4 font-medium">Industry</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Created</th>
                <th className="py-2 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b border-paper-border dark:border-night-border">
                  <td className="py-2 pr-4">{company.name}</td>
                  <td className="py-2 pr-4">{company.members[0]?.user.email ?? "—"}</td>
                  <td className="py-2 pr-4">{company.primaryIndustry}</td>
                  <td className="py-2 pr-4">{company.status}</td>
                  <td className="py-2 pr-4">{company.createdAt.toLocaleDateString()}</td>
                  <td className="py-2 pr-4">
                    <CompanyStatusActions companyId={company.id} status={company.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
