"use client";

import { useRef } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { useDict } from "@/components/i18n/locale-provider";
import { NavIcons } from "@/components/icons";
import { BottomSheet, type BottomSheetHandle } from "@/components/ui/bottom-sheet";
import type { LucideIcon } from "lucide-react";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const linkClass =
  "font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark";

// Desktop-only now (md: and above, 768px) — below that, BottomNav
// (src/components/bottom-nav.tsx) is the real navigation surface.
// Consolidated to 4 primary items + a "More" overflow reusing the same
// BottomSheet primitive BottomNav's own "More" sheet uses — one
// overflow pattern, not a different one per breakpoint.
//
// Primary is the core create -> publish workflow (Create Content,
// Campaigns, Publish, Media) — all frequently revisited. Brand Kit and
// Settings moved to "More": both are config pages typically set once,
// not something worth an always-visible slot. Repurpose stays in
// "More" too — a real, distinct entry point (transforming existing
// assets, not the Create Content wizard's blank-prompt start), just
// not frequent enough for the primary 4.
export function AppNav() {
  const dict = useDict();
  const moreSheetRef = useRef<BottomSheetHandle>(null);

  const primary: NavLink[] = [
    { href: "/studio", label: dict.nav.createContent, icon: NavIcons.studio },
    { href: "/campaigns", label: dict.nav.campaigns, icon: NavIcons.campaigns },
    { href: "/publish", label: dict.nav.publish, icon: NavIcons.publish },
    { href: "/media", label: dict.nav.media, icon: NavIcons.media },
  ];
  const overflow: NavLink[] = [
    { href: "/brand-kit", label: dict.nav.brandKit, icon: NavIcons.brandKit },
    { href: "/settings", label: dict.nav.settings, icon: NavIcons.settings },
    { href: "/repurpose", label: dict.nav.repurpose, icon: NavIcons.repurpose },
    { href: "/inbox", label: dict.nav.inbox, icon: NavIcons.inbox },
    { href: "/help", label: dict.nav.help, icon: NavIcons.help },
    { href: "/create-company?new=1", label: dict.company.addAnother, icon: NavIcons.addCompany },
  ];

  return (
    <>
      <nav className="hidden items-center gap-4 text-sm md:flex">
        {primary.map((link) => (
          <Link key={link.href} href={link.href} className={`${linkClass} flex items-center gap-1.5`}>
            <link.icon size={16} aria-hidden="true" />
            {link.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => moreSheetRef.current?.showModal()}
          className={`${linkClass} flex items-center gap-1.5`}
        >
          <Menu size={16} aria-hidden="true" />
          {dict.nav.menu}
        </button>
        <form action={signOutAction}>
          <button type="submit" className={`${linkClass} flex items-center gap-1.5`}>
            <NavIcons.signOut size={16} aria-hidden="true" />
            {dict.nav.signOut}
          </button>
        </form>
      </nav>

      <BottomSheet ref={moreSheetRef} title={dict.nav.menu} closeLabel={dict.nav.menu}>
        <div className="flex flex-col gap-1 pb-3">
          {overflow.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => moreSheetRef.current?.close()}
              className="flex min-h-[48px] items-center gap-3 rounded-md px-2 text-sm font-medium text-ink hover:bg-paper-card dark:text-ink-dark dark:hover:bg-night"
            >
              <link.icon size={20} aria-hidden="true" />
              {link.label}
            </Link>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
