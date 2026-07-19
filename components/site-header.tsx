import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

export function SiteHeader({
  user,
  showAuthLinks = true,
}: {
  user: User | null;
  showAuthLinks?: boolean;
}) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          My App
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <Button asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            showAuthLinks && (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/auth/login">Log in</Link>
                </Button>
                <Button asChild>
                  <Link href="/auth/login">Sign up</Link>
                </Button>
              </>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
