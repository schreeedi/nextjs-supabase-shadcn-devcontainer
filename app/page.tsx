import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SignedInSwitch } from "@/components/signed-in";
import { JsonLd } from "@/components/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "/" } };
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    title: "Secure authentication",
    description:
      "Sign in with Google or Facebook — no passwords to remember, backed by Supabase Auth.",
  },
  {
    title: "Personal dashboard",
    description:
      "Everything you need in one place, available the moment you sign in.",
  },
  {
    title: "Fast and modern",
    description:
      "Built on Next.js 16 with server rendering for a snappy experience on every device.",
  },
];

// Static: no session lookup on the server (see components/signed-in.tsx).
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          description: SITE_DESCRIPTION,
          url: siteUrl(),
        }}
      />
      {/* Header */}
      <SiteHeader />

      {/* Hero */}
      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-24 text-center md:py-32">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight md:text-6xl">
            Your work, all in one place
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Sign in with your Google or Facebook account and get started in
            seconds — no setup, no passwords.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SignedInSwitch
              signedIn={
                <Button size="lg" asChild>
                  <Link href="/app/dashboard" prefetch={false}>
                    Go to dashboard
                  </Link>
                </Button>
              }
              signedOut={
                <>
                  <Button size="lg" asChild>
                    <Link href="/signup">Get started for free</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/login">Log in</Link>
                  </Button>
                </>
              }
            />
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-16 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
