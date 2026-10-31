import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedInSwitch } from "@/components/signed-in";
import { ModeToggle } from "@/components/mode-toggle";
import { SITE_NAME } from "@/lib/site";

// Server component without a session lookup, so pages using it can be static.
// The signed-in hint comes from the session cookie on the client.
export function SiteHeader({
  showAuthLinks = true,
}: {
  showAuthLinks?: boolean;
}) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {SITE_NAME}
        </Link>
        <nav className="flex items-center gap-2">
          <ModeToggle />
          {showAuthLinks && (
            <SignedInSwitch
              signedIn={
                <Button asChild>
                  {/* No prefetch: every prefetch of an /app page runs the
                      proxy's session check. */}
                  <Link href="/app/dashboard" prefetch={false}>
                    Dashboard
                  </Link>
                </Button>
              }
              signedOut={
                <>
                  <Button variant="ghost" asChild>
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/signup">Sign up</Link>
                  </Button>
                </>
              }
            />
          )}
        </nav>
      </div>
    </header>
  );
}
