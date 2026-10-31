import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// No Supabase secret key in tracked files — not even the well-known local
// default. GitHub push protection rejects the whole push (every commit that
// contains one), and a template copies it into every derived repo.
// Local keys come from `supabase status` (scripts/local-env.sh).

const ROOT = new URL("..", import.meta.url).pathname;

function trackedFilesMatching(pattern: string): string[] {
  try {
    return execFileSync("git", ["grep", "-lE", pattern], {
      cwd: ROOT,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
  } catch {
    return []; // git grep exits 1 when nothing matches
  }
}

describe("tracked files", () => {
  it("contain no Supabase secret key (sb_secret_…)", () => {
    expect(trackedFilesMatching("sb_secret_[A-Za-z0-9_-]{10,}")).toEqual([]);
  });

  it("contain no service-role JWT", () => {
    // base64 of {"…"role":"service_role"…} as it appears in a JWT payload
    expect(
      trackedFilesMatching("InNlcnZpY2Vfcm9sZSI|c2VydmljZV9yb2xl"),
    ).toEqual([]);
  });
});
