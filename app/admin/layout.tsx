import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-session";
import { ModeToggle } from "@/components/mode-toggle";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// The layout check hides the shell from non-admins; every page checks again
// itself (see requireAdminPage — layouts don't re-run on client navigation).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <nav className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 text-sm">
          <Link href="/admin" className="font-semibold" prefetch={false}>
            Admin
          </Link>
          <Link
            href="/app/dashboard"
            className="text-muted-foreground hover:text-foreground"
            prefetch={false}
          >
            Back to app
          </Link>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4">{children}</main>
    </div>
  );
}
