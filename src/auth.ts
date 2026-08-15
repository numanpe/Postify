import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

const PUBLIC_PATHS = new Set(["/", "/login", "/signup"]);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
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
        if (!user) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
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
