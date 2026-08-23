"use server";

import { z } from "zod";
import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export type AuthFormState = { error: string } | undefined;

// Extracted from an inline closure in the (app) layout so the client-side
// AppNav component (needed for the mobile menu toggle) can bind it to a
// <form action={...}> the same way the old server-only layout did.
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/auth/login" });
}

// Real OAuth redirect, not a stub — auth.ts's signIn callback does the
// account-linking-by-email/creation work; this just triggers the real
// flow. redirectTo "/" mirrors the credentials login/signup flows
// above, which route to /create-company or /media depending on
// membership (see src/app/page.tsx).
export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/" });
}

const SignUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(200),
});

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = SignUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(password);
  await db.user.create({ data: { name, email, passwordHash } });

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Try logging in." };
    }
    throw error;
  }
}

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Checked before attempting real sign-in, not inside authorize() —
  // keeps the specific reason (banned vs. suspended) fully in this
  // file's control rather than depending on how NextAuth maps a thrown
  // authorize() error to a message. A wrong password against a
  // banned/suspended account still reveals nothing beyond "this account
  // exists and is banned" — no worse than the existing "invalid email
  // or password" signal an attacker already gets either way.
  const existing = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { status: true },
  });
  if (existing?.status === "BANNED") {
    return { error: "This account has been banned." };
  }
  if (existing?.status === "SUSPENDED") {
    return { error: "This account is suspended." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
}
