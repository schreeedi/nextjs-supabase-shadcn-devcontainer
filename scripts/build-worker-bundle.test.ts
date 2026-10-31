import { describe, expect, it } from "vitest";
import {
  buildWorkerBundle,
  WORKER_DIST,
  WORKER_ENTRIES,
} from "@/scripts/build-worker-bundle.mjs";

// The worker only ever runs as this bundle. Whatever esbuild can't resolve or
// what drags Next into the worker would otherwise only show up when the
// worker starts — or when the first job lazily loads the module.
const result = await buildWorkerBundle({ write: false });
const inputs = Object.keys(result.metafile.inputs);

describe("scripts/build-worker-bundle.mjs", () => {
  it("builds without warnings, one file per entry", () => {
    expect(result.warnings).toEqual([]);
    const outputs = Object.keys(result.metafile.outputs);
    for (const name of Object.keys(WORKER_ENTRIES)) {
      expect(outputs).toContain(`${WORKER_DIST}/${name}.mjs`);
    }
  });

  it("bundles own code from lib/ (TypeScript via the @/ alias)", () => {
    expect(inputs).toContain("lib/logger.ts");
  });

  it("keeps npm packages external and never pulls in Next or app/", () => {
    expect(inputs.filter((i) => i.startsWith("node_modules/"))).toEqual([]);
    expect(
      inputs.filter((i) => i.startsWith("app/") || i.startsWith("components/")),
    ).toEqual([]);
    const imports = Object.values(result.metafile.outputs).flatMap((o) =>
      o.imports.map((imp) => imp.path),
    );
    expect(
      imports.filter((p) => p === "next" || p.startsWith("next/")),
    ).toEqual([]);
  });
});
