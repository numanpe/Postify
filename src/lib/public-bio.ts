import "server-only";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getOrCreateLongLivedPublicAssetLink } from "@/lib/public-asset-links";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "company";
}

// Lazily generates and persists a real, unique, URL-safe slug the
// first time it's actually needed (Settings showing the real share
// link, or a bio page render) — never pre-filled/guessed at company
// creation, since most companies will never turn this feature on.
export async function ensurePublicBioSlug(companyId: string): Promise<string> {
  const company = await db.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { publicBioSlug: true, name: true },
  });
  if (company.publicBioSlug) return company.publicBioSlug;

  const base = slugify(company.name);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}-${crypto.randomBytes(3).toString("hex")}`;
    try {
      await db.company.update({ where: { id: companyId }, data: { publicBioSlug: candidate } });
      return candidate;
    } catch (error) {
      // P2002 = unique constraint violation (real slug collision, rare
      // but possible with a 6-hex-char suffix) — retry with a fresh
      // suffix. Any other error is real and should propagate.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new Error("Could not generate a unique bio page URL after 5 attempts.");
}

export interface PublicBioPoster {
  id: string;
  headline: string;
  subhead: string | null;
  imageUrl: string;
}

export interface PublicBioData {
  companyName: string;
  locale: "EN" | "AR";
  businessDescription: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  whatsappNumber: string | null;
  posters: PublicBioPoster[];
}

const GALLERY_LIMIT = 6;
// Real, disclosed constraint (see cleanupMediaStorage's own doc comment):
// a poster's actual image file is deleted from storage right after a
// confirmed successful publish, to reclaim space — so "recent posts"
// here genuinely means "recent posters whose file is still in storage",
// not "recent posts that went out on social," which would almost
// always be empty. Scanning a bit past GALLERY_LIMIT before filtering
// out cleaned-up ones, rather than showing fewer than intended when a
// few of the very latest happen to already be gone.
const RECENT_POSTER_SCAN = 20;

// Public, unauthenticated read — no company-membership check (this is
// the whole point: anyone with the real link can view it). Returns
// null for a slug that doesn't exist, a company that turned this off,
// or a suspended/banned company — the bio page itself renders a plain
// 404 either way, never distinguishing "never existed" from "turned
// off" to a random visitor.
export async function getPublicBioData(slug: string): Promise<PublicBioData | null> {
  const company = await db.company.findUnique({
    where: { publicBioSlug: slug },
    include: { brandKit: { include: { logoAsset: true } } },
  });
  if (!company || !company.publicBioEnabled || company.status !== "ACTIVE") return null;

  const recentPosters = await db.poster.findMany({
    where: { companyId: company.id, asset: { storageDeletedAt: null } },
    include: { asset: true },
    orderBy: { createdAt: "desc" },
    take: RECENT_POSTER_SCAN,
  });
  const featured = recentPosters.slice(0, GALLERY_LIMIT);

  const [logoUrl, posterUrls] = await Promise.all([
    company.brandKit?.logoAsset ? getOrCreateLongLivedPublicAssetLink(company.brandKit.logoAsset.id) : Promise.resolve(null),
    Promise.all(featured.map((p) => getOrCreateLongLivedPublicAssetLink(p.asset.id))),
  ]);

  return {
    companyName: company.name,
    locale: company.locale,
    businessDescription: company.businessDescription,
    primaryColor: company.brandKit?.primaryColor ?? null,
    secondaryColor: company.brandKit?.secondaryColor ?? null,
    accentColor: company.brandKit?.accentColor ?? null,
    logoUrl,
    websiteUrl: company.websiteUrl,
    whatsappNumber: company.whatsappNumber,
    posters: featured.map((p, i) => ({ id: p.id, headline: p.headline, subhead: p.subhead, imageUrl: posterUrls[i] })),
  };
}
