// Fixed, real test-account credentials shared between global-setup
// (which creates the rows in Postgres) and auth.setup.ts (which logs
// in through the real /auth/login form as these users). Not secrets —
// these are local/dev-database-only accounts created and destroyed by
// every test run, never real user data.
export const EN_USER = { email: "e2e-social-preview-en@postify.test", password: "e2e-test-password-123" };
export const AR_USER = { email: "e2e-social-preview-ar@postify.test", password: "e2e-test-password-123" };

export const SEED_IDS_PATH = "tests/.tmp/seed-ids.json";

export interface SeedIds {
  enCompanyId: string;
  enUserId: string;
  arCompanyId: string;
  arUserId: string;
}
