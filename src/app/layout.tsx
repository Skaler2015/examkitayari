import type { Metadata } from "next";
import "./globals.css";
import { env } from "@/lib/env";
import { websiteJsonLd, organizationJsonLd } from "@/server/seo/schema";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${env.siteName} — Latest Govt Jobs, Admit Card, Result & Answer Key`,
    template: `%s | ${env.siteName}`,
  },
  description:
    "ExamsKiTayari.com — official Indian competitive-exam updates: government jobs, admit cards, results, answer keys, cut offs and exam dates, sourced from official websites.",
  keywords: ["sarkari result", "govt jobs", "admit card", "result", "answer key", "exam", "recruitment"],
  openGraph: {
    type: "website",
    siteName: env.siteName,
    url: env.siteUrl,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
