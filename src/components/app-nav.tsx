"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { useDict } from "@/components/i18n/locale-provider";
import { NavIcons } from "@/components/icons";
import type { LucideIcon } from "lucide-react";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const linkClass =
  "font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark";

// Client component only because the mobile menu needs open/close state —
// everything else here is identical to the old inline nav in
// (app)/layout.tsx. Below the sm breakpoint the 9 links + sign-out no
// longer fit in one row (a real, measured overflow bug — see the mobile
// audit that found it), so this collapses to a hamburger toggle there;
// at sm: and above it's the same always-visible horizontal row as before.
// Reads the dictionary via useDict() (client-side, from the locale
// string alone) rather than a `dict` prop — dictionaries.ts's
// interpolated entries are function values, and Server Components can't
// pass functions as props to a Client Component. See locale-provider.tsx's
// own doc comment for the same constraint.
export function AppNav() {
  const dict = useDict();
  const [open, setOpen] = useState(false);

  const links: NavLink[] = [
    { href: "/studio", label: dict.nav.studio, icon: NavIcons.studio },
    { href: "/poster", label: dict.nav.poster, icon: NavIcons.poster },
    { href: "/video", label: dict.nav.video, icon: NavIcons.video },
    { href: "/campaigns", label: dict.nav.campaigns, icon: NavIcons.campaigns },
    { href: "/repurpose", label: dict.nav.repurpose, icon: NavIcons.repurpose },
    { href: "/publish", label: dict.nav.publish, icon: NavIcons.publish },
    { href: "/media", label: dict.nav.media, icon: NavIcons.media },
    { href: "/brand-kit", label: dict.nav.brandKit, icon: NavIcons.brandKit },
    { href: "/settings", label: dict.nav.settings, icon: NavIcons.settings },
  ];

  return (
    <>
      {/* Hamburger — hidden at sm: and above, where the full row fits. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={dict.nav.menu}
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-paper-border dark:border-night-border sm:hidden"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Full row — hidden below sm:, always visible at sm: and above
          regardless of the toggle state. */}
      <nav className="hidden items-center gap-4 text-sm sm:flex">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={`${linkClass} flex items-center gap-1.5`}>
            <link.icon size={16} aria-hidden="true" />
            {link.label}
          </Link>
        ))}
        <form action={signOutAction}>
          <button type="submit" className={`${linkClass} flex items-center gap-1.5`}>
            <NavIcons.signOut size={16} aria-hidden="true" />
            {dict.nav.signOut}
          </button>
        </form>
      </nav>

      {/* Mobile dropdown — stacked, full-width, only rendered below sm:
          and only when toggled open. */}
      {open && (
        <nav className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-paper-border bg-paper p-3 text-sm shadow-lg dark:border-night-border dark:bg-night sm:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`${linkClass} min-h-11 flex items-center gap-2 px-2`}
            >
              <link.icon size={18} aria-hidden="true" />
              {link.label}
            </Link>
          ))}
          <form action={signOutAction}>
            <button type="submit" className={`${linkClass} min-h-11 flex w-full items-center gap-2 px-2`}>
              <NavIcons.signOut size={18} aria-hidden="true" />
              {dict.nav.signOut}
            </button>
          </form>
        </nav>
      )}
    </>
  );
}
