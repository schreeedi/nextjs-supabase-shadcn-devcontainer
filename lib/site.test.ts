import { describe, it, expect } from "vitest";
import { siteIndexable, siteUrl } from "@/lib/site";

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
