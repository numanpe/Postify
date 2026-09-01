import { db } from "@/lib/db";

export async function GET() {
  const companies = await db.company.findMany({
    where: { name: { endsWith: "THROWAWAY" } },
    select: { id: true, name: true },
  });
  const memberships = await db.companyMember.findMany({
    where: { companyId: { in: companies.map((c) => c.id) } },
    select: { userId: true },
  });
  for (const company of companies) {
    await db.company.delete({ where: { id: company.id } });
  }
  for (const membership of memberships) {
    await db.user.delete({ where: { id: membership.userId } }).catch(() => null);
  }
  return Response.json({ deletedCompanies: companies.map((c) => c.name), deletedUsers: memberships.length });
}
