import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

const PUBLIC_PATHS = new Set(["/", "/auth/login", "/auth/signup"]);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await db.user.findUnique({ where: { email } });
        // A Google-only user (no passwordHash) attempting the
        // credentials form isn't a wrong-password case — it's a
        // different login method entirely. Either way, no password to
        // check against means this can't succeed.
        if (!user || !user.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    // Only registered when real credentials exist — omitting the
    // provider entirely (rather than passing undefined clientId/
    // clientSecret to Google()) keeps "Continue with Google" correctly
    // absent from the UI until a real OAuth app is configured, instead
    // of showing a button that fails with a confusing provider error.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    // No database adapter is configured here (JWT sessions only, same
    // as the existing Credentials flow) — so unlike a typical NextAuth
    // OAuth setup, there's no Account table auto-linking a Google
    // identity to a User row. This callback does that linking manually,
    // by email: an existing password-based User signing in with Google
    // for the first time becomes the same account (same company
    // memberships), not a silent duplicate — Google only verifies
    // emails it actually controls, so trusting account.provider ===
    // "google" + a matching email here is safe. A brand-new email
    // creates a real User row with passwordHash: null (Google-only).
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!user.email) return false;

      const existing = await db.user.findUnique({ where: { email: user.email } });
      if (existing) {
        user.id = existing.id;
        return true;
      }

      const created = await db.user.create({
        data: { email: user.email, name: user.name ?? undefined, passwordHash: null },
      });
      user.id = created.id;
      return true;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
    // Optimistic check only (per Next.js auth guidance: proxy/middleware
    // should not hit the database). Company membership is enforced in
    // requireCompany() at the data-access layer, not here.
    authorized({ auth: session, request }) {
      if (PUBLIC_PATHS.has(request.nextUrl.pathname)) return true;
      return !!session?.user;
    },
  },
});
