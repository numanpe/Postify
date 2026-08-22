"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { useDict } from "@/components/i18n/locale-provider";
import { NavIcons } from "@/components/icons";
import { BottomSheet, type BottomSheetHandle } from "@/components/ui/bottom-sheet";

// Replaces AppNav's old hamburger+dropdown below md: (768px) — a real
// fixed bottom nav instead of a top-corner menu toggle, since that's
// the reachable-by-thumb pattern real mobile apps use. Same primary/
// overflow split as AppNav's desktop row (app-nav.tsx) — one nav
// model across breakpoints, not two different curations of what's
// "primary."
export function BottomNav() {
  const dict = useDict();
  const pathname = usePathname();
  const moreSheetRef = useRef<BottomSheetHandle>(null);

  // Reworked from the original create/campaigns/brand-kit/settings split:
  // Brand Kit and Settings are config pages typically set once, not
  // revisited often, while Publish and Media are core, frequently-used
  // parts of the create -> publish workflow that don't belong buried in
  // an overflow sheet.
  const primary = [
    { href: "/studio", label: dict.nav.createContent, icon: NavIcons.studio },
    { href: "/campaigns", label: dict.nav.campaigns, icon: NavIcons.campaigns },
    { href: "/publish", label: dict.nav.publish, icon: NavIcons.publish },
    { href: "/media", label: dict.nav.media, icon: NavIcons.media },
  ];
  const overflow = [
    { href: "/brand-kit", label: dict.nav.brandKit, icon: NavIcons.brandKit },
    { href: "/settings", label: dict.nav.settings, icon: NavIcons.settings },
    { href: "/repurpose", label: dict.nav.repurpose, icon: NavIcons.repurpose },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-50 flex border-t border-slate-800 bg-slate-900/90 backdrop-blur-md md:hidden"
        aria-label={dict.nav.menu}
      >
        {primary.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium ${
              isActive(item.href) ? "text-white" : "text-slate-400"
            }`}
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            <item.icon size={20} aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => moreSheetRef.current?.showModal()}
          className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-slate-400"
        >
          <Menu size={20} aria-hidden="true" />
          <span className="truncate">{dict.nav.menu}</span>
        </button>
      </nav>

      <BottomSheet ref={moreSheetRef} title={dict.nav.menu} closeLabel={dict.nav.menu}>
        <div className="flex flex-col gap-1 pb-3">
          {overflow.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => moreSheetRef.current?.close()}
              className="flex min-h-[48px] items-center gap-3 rounded-md px-2 text-sm font-medium text-ink hover:bg-paper-card dark:text-ink-dark dark:hover:bg-night"
            >
              <item.icon size={20} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex min-h-[48px] w-full items-center gap-3 rounded-md px-2 text-sm font-medium text-ink hover:bg-paper-card dark:text-ink-dark dark:hover:bg-night"
            >
              <NavIcons.signOut size={20} aria-hidden="true" />
              {dict.nav.signOut}
            </button>
          </form>
        </div>
      </BottomSheet>
    </>
  );
}
