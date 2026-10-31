import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static checks on supabase/migrations — no database needed, so they run in
// every `npm run check`. The CLI orders migrations by the 14-digit version and
// silently skips or reorders badly named files.

const DIR = join(import.meta.dirname, "..", "supabase", "migrations");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql"));
const versions = files.map((f) => f.slice(0, 14));

/** "20261031152809" → Date (UTC, as written by `supabase migration new`). */
function versionDate(v: string): Date {
  const [y, mo, d, h, mi, s] = [0, 4, 6, 8, 10, 12].map((i, n) =>
    Number(v.slice(i, i + (n === 0 ? 4 : 2))),
  ) as [number, number, number, number, number, number];
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
}

describe("supabase/migrations", () => {
  it("has migrations", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s is named <14-digit version>_<snake_case>.sql", (f) => {
    expect(f).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
  });

  it("has unique versions", () => {
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("has no version in the future (use `supabase migration new`)", () => {
    const soon = Date.now() + 24 * 60 * 60 * 1000;
    expect(versions.filter((v) => versionDate(v).getTime() > soon)).toEqual([]);
  });
});
