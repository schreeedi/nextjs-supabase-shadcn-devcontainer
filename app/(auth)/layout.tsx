import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import type { Metadata } from "next";

// Login/signup pages: no search value, keep them out of the index.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <SiteHeader showAuthLinks={false} />

      <main className="flex flex-1 items-center justify-center p-4">
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
