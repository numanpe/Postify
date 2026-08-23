import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { CompanyStatusActions } from "@/components/admin/company-status-actions";

export default async function AdminPage() {
  await requireAdmin();

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
  );
}
