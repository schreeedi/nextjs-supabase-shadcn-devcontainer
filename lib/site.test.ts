import { describe, it, expect } from "vitest";
import { authCallbackUrl, siteIndexable, siteUrl } from "@/lib/site";

const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv;

describe("siteUrl", () => {
  it("prefers SITE_URL, then NEXT_PUBLIC_SITE_URL, then localhost", () => {
    expect(
      siteUrl(
        env({
          SITE_URL: "https://a.example",
          NEXT_PUBLIC_SITE_URL: "https://b.example",
        }),
      ),
    ).toBe("https://a.example");
    expect(siteUrl(env({ NEXT_PUBLIC_SITE_URL: "https://b.example" }))).toBe(
      "https://b.example",
    );
    expect(siteUrl(env({}))).toBe("http://localhost:3000");
  });

  it("strips trailing slashes", () => {
    expect(siteUrl(env({ SITE_URL: "https://a.example//" }))).toBe(
      "https://a.example",
    );
  });
});

describe("authCallbackUrl", () => {
  it("builds the callback from SITE_URL at runtime", () => {
    // Deployments set SITE_URL only (docs/deployment.md) — login must work.
    expect(authCallbackUrl(null, env({ SITE_URL: "https://a.example/" }))).toBe(
      "https://a.example/auth/callback",
    );
  });

  it("carries the next path through the OAuth round trip", () => {
    expect(
      authCallbackUrl(
        "/app/dashboard?tab=1",
        env({ SITE_URL: "https://a.example" }),
      ),
    ).toBe("https://a.example/auth/callback?next=%2Fapp%2Fdashboard%3Ftab%3D1");
  });
});

describe("siteIndexable", () => {
  it("is indexable without SITE_ENV or for production", () => {
    expect(siteIndexable(env({}))).toBe(true);
    expect(siteIndexable(env({ SITE_ENV: "" }))).toBe(true);
    expect(siteIndexable(env({ SITE_ENV: " Production " }))).toBe(true);
    expect(siteIndexable(env({ SITE_ENV: "prod" }))).toBe(true);
  });

  it("is not indexable for any other environment", () => {
    expect(siteIndexable(env({ SITE_ENV: "staging" }))).toBe(false);
    expect(siteIndexable(env({ SITE_ENV: "preview" }))).toBe(false);
  });
});
