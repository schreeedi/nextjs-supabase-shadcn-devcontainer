import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { FacebookHashCleanup } from "@/components/facebook-hash-cleanup";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import "./globals.css";

// next/font self-hosts the font (no request to Google, no layout shift from
// a late swap); its default `display: "swap"` keeps text visible while loading.
const inter = Inter({ subsets: ["latin"] });

// Pages set their own `title` (→ "Page – My App"), `description` and
// `alternates.canonical`. Deliberately NOT here:
// - alternates.canonical / openGraph.url: every page would inherit "/" as its
//   canonical or shared URL. Each page sets its own (app/page.tsx).
// - title/description in openGraph/twitter: every subpage would show the
//   home page's text when shared. A page's openGraph replaces this block
//   entirely, so repeat type/siteName there when overriding.
// - robots index/follow: that's the default. Spelled out here it would also
//   land on the 404 page next to Next's own noindex.
// Static pages bake these values in at build time — set SITE_URL for builds.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_NAME, template: `%s – ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image" },
  robots: { googleBot: { "max-image-preview": "large" } },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: next-themes sets class/style on <html> before
    // hydration. Only affects this element, not its children.
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <FacebookHashCleanup />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
