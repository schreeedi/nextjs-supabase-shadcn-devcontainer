import { createClient } from "@/utils/supabase/server";
import { redirectToPath, safeNextPath } from "@/lib/nav";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // Never trust ?next= as-is: an absolute or protocol-relative value would
  // turn the login flow into an open redirect.
  const next = safeNextPath(searchParams.get("next")) ?? "/app/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    // Relative Location: no need to know (or trust x-forwarded-host for) the
    // public origin — see lib/nav.ts.
    if (!error) return redirectToPath(next);
  }

  // OAuth error — redirect to error page
  return redirectToPath("/error");
}
