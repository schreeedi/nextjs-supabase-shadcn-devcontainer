import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
  },
  resolve: {
    // Mirror the `@/*` -> `./*` alias from tsconfig.json
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
