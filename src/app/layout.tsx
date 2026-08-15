import type { Metadata, Viewport } from "next";
import { Fraunces, Karla } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "900"],
  variable: "--font-fraunces",
  display: "swap",
});

const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-karla",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Postify",
  description: "AI marketing content platform",
  appleWebApp: { title: "Postify" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#C1272D" },
    { media: "(prefers-color-scheme: dark)", color: "#E14B4B" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" className={`${fraunces.variable} ${karla.variable}`}>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased dark:bg-night dark:text-ink-dark">
        {children}
      </body>
    </html>
  );
}
