import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";
import type { Database } from "@/types/database";

// Fixed ids: the E2E server gets ADMIN_USER_IDS=<admin id> (playwright.config),
// and a crashed run is cleaned up by the next one.
export const E2E_USERS = {
  user: {
    id: "00000000-0000-4000-8000-00000000e2e1",
    email: "e2e-user@example.test",
    fullName: "E2E User",
  },
  admin: {
    id: "00000000-0000-4000-8000-00000000e2e2",
    email: "e2e-admin@example.test",
    fullName: "E2E Admin",
  },
  // Target of the admin plan-change journey (its plan gets changed).
  member: {
    id: "00000000-0000-4000-8000-00000000e2e3",
    email: "e2e-member@example.test",
    fullName: "E2E Member",
  },
  // Signs out — signOut() revokes ALL of a user's sessions, so nobody else
  // may share this user.
  leaver: {
    id: "00000000-0000-4000-8000-00000000e2e4",
    email: "e2e-leaver@example.test",
    fullName: "E2E Leaver",
  },
} as const;

export type E2EUser = (typeof E2E_USERS)[keyof typeof E2E_USERS];

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set for E2E — run npm run env:local`);
  }
  return value;
}

export function serviceClient() {
  return createClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** (Re)create the user — handle_new_user gives them a Free profile. */
export async function recreateUser(user: E2EUser): Promise<void> {
  const svc = serviceClient();
  await svc.auth.admin.deleteUser(user.id); // leftover of a crashed run
  const { error } = await svc.auth.admin.createUser({
    id: user.id,
    email: user.email,
    email_confirm: true,
    user_metadata: { full_name: user.fullName },
  });
  if (error) throw new Error(`create ${user.email}: ${error.message}`);
}

export async function deleteUser(user: E2EUser): Promise<void> {
  const svc = serviceClient();
  await svc.from("admin_audit").delete().eq("target_user_id", user.id);
  await svc.auth.admin.deleteUser(user.id);
}

/**
 * Session cookies exactly as the app writes them (docs/adr/004). OAuth can't be clicked
 * through in a test, so the service role issues a magic link and we redeem
 * it with the same @supabase/ssr client the app uses. Works with the email
 * provider off — only the service role can generate the token.
 */
export async function sessionCookies(
  user: E2EUser,
): Promise<{ name: string; value: string }[]> {
  const { data, error } = await serviceClient().auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (error) throw new Error(`magic link ${user.email}: ${error.message}`);

  const jar = new Map<string, string>();
  const ssr = createServerClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => {
          for (const { name, value } of cookies) {
            if (value) jar.set(name, value);
            else jar.delete(name);
          }
        },
      },
    },
  );
  const verified = await ssr.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (verified.error) {
    throw new Error(`verify ${user.email}: ${verified.error.message}`);
  }
  if (jar.size === 0) throw new Error(`no session cookie for ${user.email}`);
  return [...jar].map(([name, value]) => ({ name, value }));
}

/** Put a fresh session for `user` into the browser context. */
export async function signIn(
  context: BrowserContext,
  user: E2EUser,
  baseURL: string,
): Promise<void> {
  const { hostname } = new URL(baseURL);
  await context.addCookies(
    (await sessionCookies(user)).map((c) => ({
      ...c,
      domain: hostname,
      path: "/",
      sameSite: "Lax" as const,
    })),
  );
}
