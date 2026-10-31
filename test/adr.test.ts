import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Keeps docs/adr/ navigable: sequential unique numbers, every ADR in the
// index, every ADR with a status line, every repo path it cites still there.

const ROOT = join(import.meta.dirname, "..");
const DIR = join(ROOT, "docs", "adr");
const adrs = readdirSync(DIR).filter(
  (f) => /^\d{3}-/.test(f) && f !== "000-template.md",
);
const index = readFileSync(join(DIR, "README.md"), "utf8");

describe("docs/adr", () => {
  it("files are named NNN-kebab-title.md", () => {
    for (const f of adrs) expect(f).toMatch(/^\d{3}-[a-z0-9-]+\.md$/);
  });

  it("numbers are unique and without gaps", () => {
    const numbers = adrs
      .map((f) => Number(f.slice(0, 3)))
      .sort((a, b) => a - b);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  it.each(adrs)("%s is listed in the index", (f) => {
    expect(index).toContain(`(${f})`);
  });

  it.each(adrs)("%s has a title matching its number and a status", (f) => {
    const text = readFileSync(join(DIR, f), "utf8");
    expect(text.split("\n")[0]).toMatch(
      new RegExp(`^# ADR-${f.slice(0, 3)}: `),
    );
    expect(text).toMatch(
      /\*\*Status:\*\* (Proposed|Accepted|Deprecated|Superseded by ADR-\d{3})/,
    );
  });

  it.each(adrs)("%s only cites repo paths that exist", (f) => {
    const text = readFileSync(join(DIR, f), "utf8");
    const paths = [
      ...text.matchAll(
        /`((?:lib|app|components|scripts|supabase|utils|docs|test)\/[^`*]+?)`/g,
      ),
    ]
      .map((m) => m[1]!)
      .filter((p) => !p.includes("*"));
    for (const p of paths) expect(existsSync(join(ROOT, p)), p).toBe(true);
  });
});
