"use client";

import { createContext, useContext } from "react";

import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n/dictionaries";

const LocaleContext = createContext<{ locale: Locale; dict: Dictionary } | null>(null);

// Only the locale string crosses the server->client boundary — the
// dictionary itself has function values (e.g. subtitle(name)), and
// React Server Components can't serialize functions as client props.
// dictionaries.ts is plain, server-only-free data, so resolving it here
// on the client from just the locale is what actually works.
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={{ locale, dict: getDictionary(locale) }}>{children}</LocaleContext.Provider>;
}

function useLocaleContext() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useDict/useLocale must be used inside <LocaleProvider>.");
  return ctx;
}

export function useDict(): Dictionary {
  return useLocaleContext().dict;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}
