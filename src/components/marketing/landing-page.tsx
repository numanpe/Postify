import Link from "next/link";
import {
  Image as ImageIcon,
  Video,
  Sparkles,
  CalendarDays,
  FolderOpen,
  Send,
  Key,
  Languages,
  type LucideIcon,
} from "lucide-react";

// The app's only public, unauthenticated page — everything else lives
// behind requireUser()/requireCompany() (src/lib/session.ts). Per
// dictionaries.ts's documented scope boundary, pre-auth pages stay
// English-only (no company/locale exists yet to read a preference from),
// so this page is not run through useDict()/the Dictionary type — same
// boundary /auth/login and /auth/signup already live inside.
//
// Every claim below is grounded in a real, shipped capability (poster
// engine, video engine, Creative DNA, campaigns/calendar, media library,
// Meta/LinkedIn/TikTok publish adapters, BYOK provider layer) — no
// invented metrics, customer logos, or testimonials, per CLAUDE.md's "no
// fake functionality" rule extended to marketing claims.

interface Capability {
  icon: LucideIcon;
  title: string;
  body: string;
}

const capabilities: Capability[] = [
  {
    icon: ImageIcon,
    title: "Posters that look designed, not generated",
    body: "Real photos with smart cropping, AI backgrounds, or your brand colors — laid out on a real grid, with contrast and readability checked automatically before you ever see a draft.",
  },
  {
    icon: Video,
    title: "Reels, not slideshows",
    body: "A real script — hook, context, value, call to action — with voice narration, auto-ducked music, and word-level captions. Quality-gated for black frames, clipped audio, and timing before export.",
  },
  {
    icon: Sparkles,
    title: "Creative DNA, learned from your brand",
    body: "Your colors, fonts, tone, and what you've explicitly liked or rejected — private to your company, never shared, and only shifts with real evidence, not one lucky post.",
  },
  {
    icon: CalendarDays,
    title: "A week of content, planned for you",
    body: "Ask for a campaign, get a full plan on a visual calendar — every post editable, approvable, or replaceable before anything goes out.",
  },
  {
    icon: FolderOpen,
    title: "One private media library",
    body: "Your photos, video, and logos, auto-tagged on upload and searchable in plain language — never swapped for an AI stand-in when the real asset already exists.",
  },
  {
    icon: Send,
    title: "Publish where customers already are",
    body: "Connect Facebook and Instagram and post directly — no exporting, re-uploading, or resizing by hand. LinkedIn and TikTok connect too, currently in limited/private mode pending platform review.",
  },
];

export function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink dark:bg-night dark:text-ink-dark">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="font-display text-lg font-semibold">Postify</span>
        <nav className="flex items-center gap-3 text-sm font-medium">
          <Link
            href="/auth/login"
            className="text-ink-soft hover:text-ink dark:text-ink-soft-dark dark:hover:text-ink-dark"
          >
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex min-h-[40px] items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-paper hover:bg-primary/90 dark:bg-primary-dark dark:text-night dark:hover:bg-primary-dark/90"
          >
            Start free
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-3xl px-4 pb-14 pt-10 text-center sm:px-6 sm:pb-20 sm:pt-16">
          <p className="text-sm font-medium uppercase tracking-wide text-accent dark:text-accent-dark">
            Free to start · No credit card
          </p>
          <h1 className="mt-3 text-balance font-display text-4xl font-black leading-[1.1] sm:text-5xl">
            Marketing content your business would actually publish.
          </h1>
          <p className="mt-5 text-lg text-ink-soft dark:text-ink-soft-dark sm:text-xl">
            Postify turns your brand into publish-ready posters, reels, and campaigns —
            in English and Arabic — using AI that learns your business instead of
            reskinning a generic template.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/signup"
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-primary px-6 text-base font-medium text-paper hover:bg-primary/90 dark:bg-primary-dark dark:text-night dark:hover:bg-primary-dark/90 sm:w-auto"
            >
              Start free
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg border border-paper-border px-6 text-base font-medium text-ink hover:bg-paper-card dark:border-night-border dark:text-ink-dark dark:hover:bg-night-card sm:w-auto"
            >
              Log in
            </Link>
          </div>
        </section>

        {/* Capabilities */}
        <section className="border-t border-paper-border bg-paper-card/60 py-14 dark:border-night-border dark:bg-night-card/40 sm:py-20">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">
              Everything a content team does, in one place
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-paper-border bg-paper p-5 dark:border-night-border dark:bg-night"
                >
                  <item.icon size={22} className="text-primary dark:text-primary-dark" aria-hidden="true" />
                  <h3 className="mt-3 font-display text-base font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft dark:text-ink-soft-dark">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Free-first / BYOK + bilingual */}
        <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <Key size={22} className="text-accent dark:text-accent-dark" aria-hidden="true" />
              <h3 className="mt-3 font-display text-lg font-bold">Free by default, premium if you want it</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft dark:text-ink-soft-dark">
                Core generation works out of the box — no API key, no card. If you want
                higher-end quality, paste your own key for OpenAI, Anthropic, ElevenLabs,
                or similar. It&rsquo;s used server-side only, never required, and never
                exposed in your browser or logs.
              </p>
            </div>
            <div>
              <Languages size={22} className="text-accent dark:text-accent-dark" aria-hidden="true" />
              <h3 className="mt-3 font-display text-lg font-bold">English and Arabic, both first-class</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft dark:text-ink-soft-dark">
                Real right-to-left layout, correct Arabic typography, and natural
                translation — not an English layout with Arabic text dropped in
                backwards.
              </p>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-paper-border py-14 text-center dark:border-night-border sm:py-20">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Create your first post in two minutes
          </h2>
          <div className="mt-7">
            <Link
              href="/auth/signup"
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-primary px-6 text-base font-medium text-paper hover:bg-primary/90 dark:bg-primary-dark dark:text-night dark:hover:bg-primary-dark/90"
            >
              Start free
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-paper-border px-4 py-6 text-center text-sm text-ink-soft dark:border-night-border dark:text-ink-soft-dark sm:px-6">
        © {year} Postify
      </footer>
    </div>
  );
}
