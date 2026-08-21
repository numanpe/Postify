"use client";

import Link from "next/link";

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

// Desktop-only now (md: and above, 768px) — below that, BottomNav
// (src/components/bottom-nav.tsx) is the real navigation surface, not
// a hamburger+dropdown toggle. Splitting the breakpoint here (used to
// be sm:, 640px) to exactly match BottomNav's own md:hidden keeps
// there from ever being a dead zone where neither nav is visible, or a
// double-nav zone where both show at once.
export function AppNav() {
  const dict = useDict();

  const links: NavLink[] = [
    // All three now live under the one /studio/[mode] route (folded
    // together to reduce the Vercel Function count) — still three
    // distinct nav links pointing at their own URL, so this is the same
    // navigation experience as before, just fewer separate route files.
    { href: "/studio/captions", label: dict.nav.studio, icon: NavIcons.studio },
    { href: "/studio/poster", label: dict.nav.poster, icon: NavIcons.poster },
    { href: "/studio/video", label: dict.nav.video, icon: NavIcons.video },
    { href: "/campaigns", label: dict.nav.campaigns, icon: NavIcons.campaigns },
    { href: "/repurpose", label: dict.nav.repurpose, icon: NavIcons.repurpose },
    { href: "/publish", label: dict.nav.publish, icon: NavIcons.publish },
    { href: "/media", label: dict.nav.media, icon: NavIcons.media },
    { href: "/brand-kit", label: dict.nav.brandKit, icon: NavIcons.brandKit },
    { href: "/settings", label: dict.nav.settings, icon: NavIcons.settings },
  ];

  return (
    <nav className="hidden items-center gap-4 text-sm md:flex">
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
  );
}
