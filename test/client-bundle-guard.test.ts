import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Walks the import graph of every "use client" module (own code only) and
// fails when it reaches server-only code. Next would either fail the build
// late or — worse — ship secrets/service-role code to the browser.

const ROOT = join(import.meta.dirname, "..");
const SOURCE_DIRS = ["app", "components", "lib", "utils"];

const FORBIDDEN_PACKAGES = [
  /^node:/,
  /^(fs|path|crypto|child_process|os|net|tls)$/,
  /^server-only$/,
  /^next\/headers$/,
];
const FORBIDDEN_FILES = [
  "utils/supabase/server.ts",
  "utils/supabase/service.ts",
  "utils/supabase/middleware.ts",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [path]
      : [];
  });
}

const IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

function importsOf(file: string): { spec: string; typeOnly: boolean }[] {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(IMPORT_RE)].map((m) => ({
    spec: (m[1] ?? m[2])!,
    typeOnly: /^\s*(?:import|export)\s+type\s/.test(m[0].trimStart()),
  }));
}

/** Resolve an own-code import to a file path, or null for packages. */
function resolveLocal(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = join(dirname(from), spec);
  else return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function violations(entry: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const queue: { file: string; chain: string[] }[] = [
    { file: entry, chain: [] },
  ];
  while (queue.length) {
    const { file, chain } = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const here = [...chain, relative(ROOT, file)];
    for (const { spec, typeOnly } of importsOf(file)) {
      if (typeOnly) continue; // erased at compile time
      if (FORBIDDEN_PACKAGES.some((re) => re.test(spec))) {
        found.push(`${here.join(" → ")} → ${spec}`);
        continue;
      }
      const local = resolveLocal(file, spec);
      if (!local) continue;
      // A "use server" module imported from the client becomes action
      // references; its server imports never reach the bundle.
      if (/^\s*["']use server["']/.test(readFileSync(local, "utf8"))) continue;
      if (FORBIDDEN_FILES.includes(relative(ROOT, local))) {
        found.push(`${here.join(" → ")} → ${relative(ROOT, local)}`);
        continue;
      }
      queue.push({ file: local, chain: here });
    }
  }
  return found;
}

const clientModules = SOURCE_DIRS.flatMap((d) => walk(join(ROOT, d))).filter(
  (f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")),
);

describe("client bundle guard", () => {
  it("finds client modules to check", () => {
    expect(clientModules.length).toBeGreaterThan(0);
  });

  it.each(clientModules.map((f) => [relative(ROOT, f), f]))(
    "%s reaches no server-only code",
    (_name, file) => {
      expect(violations(file)).toEqual([]);
    },
  );

  it("detects a violation (self-test)", () => {
    expect(violations(join(ROOT, "app/api/health/ready/route.ts"))).toContain(
      "app/api/health/ready/route.ts → utils/supabase/service.ts",
    );
  });
});
