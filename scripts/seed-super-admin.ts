// One-time operational script, not part of the app's runtime — run
// manually with:
//   NODE_OPTIONS=--conditions=react-server npx tsx scripts/seed-super-admin.ts
// (the react-server condition is required because src/lib/db.ts and its
// dependents use `import "server-only"`, which throws under plain Node
// without it — same pattern this project already uses for other
// standalone scripts.)
//
// Grants exactly one Super Admin (Part C1) for numanpe@gmail.com.
//
// SECURITY NOTE: this file contains no password, placeholder or real,
// anywhere. Checked the real database before writing this script
// (read-only) and found the account already exists as a normal user
// with a real password its owner set themselves through the app's
// normal signup flow — there is nothing to seed a placeholder
// credential for. This script only flips adminRole to SUPER_ADMIN on
// the existing row; it never reads, writes, or logs passwordHash. If
// the account did not exist yet, this script would refuse to silently
// create one with a guessed password — see the `existing` branch below.
import { PrismaClient } from "@prisma/client";

const SUPER_ADMIN_EMAIL = "numanpe@gmail.com";

async function main() {
  const db = new PrismaClient();

  const existing = await db.user.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
    select: { id: true, adminRole: true },
  });

  if (!existing) {
    // Deliberately does not create an account here. Fabricating a
    // placeholder-password user and mailing a reset link is reasonable
    // when nothing exists yet, but since the real account already
    // exists in every environment this script has been run against so
    // far, adding that path now would be speculative code with no way
    // to verify it actually works — build it for real if this
    // situation is ever hit.
    console.error(
      `No user found for ${SUPER_ADMIN_EMAIL}. Refusing to create one automatically — ` +
        `sign up normally first, then re-run this script to grant Super Admin.`,
    );
    await db.$disconnect();
    process.exitCode = 1;
    return;
  }

  if (existing.adminRole === "SUPER_ADMIN") {
    console.log(`${SUPER_ADMIN_EMAIL} is already a Super Admin. Nothing to do.`);
    await db.$disconnect();
    return;
  }

  await db.user.update({
    where: { id: existing.id },
    data: { adminRole: "SUPER_ADMIN" },
  });
  console.log(`Granted Super Admin to ${SUPER_ADMIN_EMAIL}. Existing password untouched.`);

  await db.$disconnect();
}

main();
