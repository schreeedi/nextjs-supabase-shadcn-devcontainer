import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { FacebookHashCleanup } from "@/components/facebook-hash-cleanup";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import "./globals.css";

// next/font self-hosts the font (no request to Google, no layout shift from
// a late swap); `display: "swap"` keeps text visible while it loads.
const inter = Inter({ subsets: ["latin"], display: "swap" });

// Pages set their own `title` (→ "Page – My App"), `description` and
// `alternates.canonical`. Deliberately NOT here:
// - alternates.canonical: every page would inherit "/" as its canonical URL.
// - title/description in openGraph/twitter: every subpage would show the
//   home page's text when shared. A page's openGraph replaces this block
//   entirely, so repeat type/siteName there when overriding.
// Static pages bake these values in at build time — set SITE_URL for builds.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_NAME, template: `%s – ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { type: "website", siteName: SITE_NAME, url: "/" },
  twitter: { card: "summary_large_image" },
  robots: {
    index: true,
    follow: true,
    googleBot: { "max-image-preview": "large" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <FacebookHashCleanup />
        {children}
      </body>
    </html>
  );
}
