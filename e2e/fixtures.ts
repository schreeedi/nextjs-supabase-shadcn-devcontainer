import { test as base, expect } from "@playwright/test";

// Every test fails on console errors and uncaught exceptions — that is where
// hydration mismatches and CSP violations show up.
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        // The browser logs a 404 *document* (the not-found test) as an error;
        // a 404 on any script, style or image still fails.
        const isDocument404 =
          msg.text().includes("status of 404") &&
          msg.location().url === page.url();
        if (!isDocument404) errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));
      await use(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
