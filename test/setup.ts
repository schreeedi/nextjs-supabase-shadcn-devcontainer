// Global cleanup after every test — complements unstubEnvs/unstubGlobals/
// restoreMocks in vitest.config.mts: fake timers (vi.useFakeTimers) would
// otherwise leak into the next test when a test fails before useRealTimers.
import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
});
