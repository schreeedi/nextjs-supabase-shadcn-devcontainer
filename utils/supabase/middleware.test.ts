import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// A session refresh hands the new cookies AND cache headers to setAll. The
// headers (Cache-Control: no-store …) keep CDNs from serving one user's
// session cookie to another — they must reach every response that carries
// the cookies, redirects included.

const NO_STORE = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

let claims: { sub: string } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    { cookies }: { cookies: { setAll: (...args: unknown[]) => void } },
  ) => ({
    auth: {
      getClaims: async () => {
        // Simulates a refresh: new session cookie plus cache headers.
        cookies.setAll(
          [{ name: "sb-test-auth-token", value: "fresh", options: {} }],
          NO_STORE,
        );
        return { data: claims ? { claims } : null };
      },
      getUser: async () => ({
        data: { user: claims ? { id: claims.sub } : null },
      }),
    },
  }),
}));

const { updateSession } = await import("@/utils/supabase/middleware");

const request = (path: string) =>
  new NextRequest(`http://localhost:3000${path}`);

describe("updateSession", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test");
    claims = null;
  });

  it("sets the refreshed cookie and no-store headers on the pass-through response", async () => {
    claims = { sub: "user-1" };
    const res = await updateSession(request("/app/dashboard"));
    expect(res.cookies.get("sb-test-auth-token")?.value).toBe("fresh");
    expect(res.headers.get("cache-control")).toBe(NO_STORE["Cache-Control"]);
    expect(res.headers.get("pragma")).toBe("no-cache");
    expect(res.headers.get("expires")).toBe("0");
  });

  it("keeps cookie and no-store headers on a redirect", async () => {
    const res = await updateSession(request("/app/dashboard"));
    expect(res.status).toBe(307);
    expect(res.cookies.get("sb-test-auth-token")?.value).toBe("fresh");
    expect(res.headers.get("cache-control")).toBe(NO_STORE["Cache-Control"]);
  });
});
