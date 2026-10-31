import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type ServerClient = ReturnType<typeof createRawClient>;
type GetUserResult = Awaited<ReturnType<ServerClient["auth"]["getUser"]>>;

// Only ONE auth-server round trip for getUser() per request: layout, page and
// server actions would otherwise each call /auth/v1/user. React cache() is
// request-scoped; the key is the auth cookies, so a login/logout/refresh in the
// same request never returns the previous user.
const getUserOnce = cache(
  async (_authCookies: string): Promise<GetUserResult> =>
    createRawClient(await cookies()).auth.getUser(),
);

function authCookieKey(cookieStore: CookieStore): string {
  return cookieStore
    .getAll()
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => `${c.name}=${c.value}`)
    .join(";");
}

export async function createClient() {
  const cookieStore = await cookies();
  const client = createRawClient(cookieStore);
  const getUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = ((jwt?: string) =>
    jwt
      ? getUser(jwt)
      : getUserOnce(authCookieKey(cookieStore))) as typeof getUser;
  return client;
}

function createRawClient(cookieStore: CookieStore) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component — safe to ignore
            // (middleware handles session refresh)
          }
        },
      },
    },
  );
}
