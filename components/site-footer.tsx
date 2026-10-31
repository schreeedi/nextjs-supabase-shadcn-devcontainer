import { SITE_NAME } from "@/lib/site";
import { CurrentYear } from "@/components/current-year";

// Legal pages (terms, privacy, imprint) are open work — see ROADMAP.md. No
// placeholder links until they exist.
export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-6 text-sm text-muted-foreground sm:justify-start">
        <p>
          © <CurrentYear /> {SITE_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
