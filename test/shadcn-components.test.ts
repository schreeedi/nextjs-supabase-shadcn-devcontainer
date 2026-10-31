import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// `npx shadcn add` from the current registry imports `cn` from the npm package
// "cn" and installs it. This project keeps its own cn (lib/utils.ts: clsx +
// tailwind-merge) — after every `shadcn add`, point the imports back:
//   sed -i 's#from "cn"#from "@/lib/utils"#' components/ui/*.tsx && npm uninstall cn

const ROOT = join(import.meta.dirname, "..");
const UI = join(ROOT, "components", "ui");
const files = readdirSync(UI).filter((f) => f.endsWith(".tsx"));

describe("components/ui", () => {
  it.each(files)("%s imports cn from @/lib/utils", (f) => {
    const src = readFileSync(join(UI, f), "utf8");
    expect(src).not.toMatch(/from\s+["']cn["']/);
  });

  it.each(files)("%s uses the unified radix-ui package", (f) => {
    const src = readFileSync(join(UI, f), "utf8");
    expect(src).not.toMatch(/from\s+["']@radix-ui\/react-/);
  });

  it("package.json has no cn or @radix-ui/react-* dependency", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(
      deps.filter((d) => d === "cn" || d.startsWith("@radix-ui/react-")),
    ).toEqual([]);
  });
});
