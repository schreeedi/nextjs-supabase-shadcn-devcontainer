import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/",
      "node_modules/",
      "supabase/",
      "coverage/",
      "dist/",
      ".claude/",
      ".agents/",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    // `_name` means "intentionally unused": a parameter that only serves as a
    // cache key, or a field kept out of a rest destructuring.
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default config;
