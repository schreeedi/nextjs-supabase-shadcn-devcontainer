import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <SiteHeader user={null} showAuthLinks={false} />

      <main className="flex flex-1 items-center justify-center p-4">
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
