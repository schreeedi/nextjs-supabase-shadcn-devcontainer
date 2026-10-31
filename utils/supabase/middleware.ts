import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PAGES = ["/login", "/signup"];
// Require a session; /admin additionally checks ADMIN_USER_IDS per page.
const PROTECTED_PREFIXES = ["/app", "/admin"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { pathname } = request.nextUrl;

  // Refresh session — do NOT remove this. getClaims() verifies the JWT locally
  // against the project's JWKS instead of calling /auth/v1/user on every
  // request, and refreshes an expired session like getUser() does. (With a
  // symmetric HS256 key it falls back to getUser() by itself.)
  const { data } = await supabase.auth.getClaims();
  let signedIn = Boolean(data?.claims.sub);

  // On the auth pages we redirect signed-in users away. A locally valid JWT of
  // a user who was deleted or signed out elsewhere would otherwise bounce
  // /login → /app → (page: getUser() = null) → /login … forever. Ask the auth
  // server here — these pages are rare, the extra round trip is cheap.
  if (signedIn && AUTH_PAGES.includes(pathname)) {
    const { data: fresh } = await supabase.auth.getUser();
    signedIn = Boolean(fresh.user);
  }

  // Redirects are separate responses: if getClaims() refreshed the session
  // above, the new cookies sit on supabaseResponse only. Copy them over, or the
  // browser keeps the already-used refresh token and is logged out next time.
  const redirectTo = (url: URL) => {
    const res = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      res.cookies.set(cookie);
    }
    return res;
  };

  // Protect everything under /app and /admin
  if (
    !signedIn &&
    PROTECTED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember the target (links from mails, bookmarks); login and the OAuth
    // callback validate it with safeNextPath().
    url.search = "";
    const target = pathname + request.nextUrl.search;
    if (request.method === "GET" && target !== "/app/dashboard") {
      url.searchParams.set("next", target);
    }
    return redirectTo(url);
  }

  // Redirect signed-in users away from the login/signup pages
  if (signedIn && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/dashboard";
    url.search = "";
    return redirectTo(url);
  }

  return supabaseResponse;
}
