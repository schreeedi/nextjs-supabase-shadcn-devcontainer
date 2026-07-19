import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
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
      "Sign in with Google or Microsoft — no passwords to remember, backed by Supabase Auth.",
  },
  {
    title: "Personal dashboard",
    description:
      "Everything you need in one place, available the moment you sign in.",
  },
  {
    title: "Fast and modern",
    description:
      "Built on Next.js 15 with server rendering for a snappy experience on every device.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            My App
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/login">Sign up</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-24 text-center md:py-32">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight md:text-6xl">
            Your work, all in one place
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Sign in with your Google or Microsoft account and get started in
            seconds — no setup, no passwords.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/auth/login">Get started for free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/auth/login">Log in</Link>
            </Button>
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
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} My App. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground">
              Terms
            </a>
            <a href="#" className="hover:text-foreground">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
