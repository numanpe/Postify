import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Postify",
  description: "AI marketing content platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
