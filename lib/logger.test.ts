import { describe, it, expect, vi } from "vitest";
import {
  createLogger,
  maskEmails,
  parseLevel,
  redact,
  type LogLevel,
} from "@/lib/logger";

const fixed = () => new Date("2026-01-02T03:04:05.000Z");

function capture(level?: LogLevel) {
  const write = vi.fn();
  const logger = createLogger(
    { service: "test" },
    { level, write, now: fixed },
  );
  const lines = () =>
    write.mock.calls.map(([lvl, line]) => ({ lvl, ...JSON.parse(line) }));
  return { logger, lines };
}

describe("redact", () => {
  it("masks secret-looking keys at any depth", () => {
    expect(
      redact({
        password: "x",
        nested: { accessToken: "t", api_key: "k" },
        list: [{ Authorization: "Bearer y" }],
      }),
    ).toEqual({
      password: "[redacted]",
      nested: { accessToken: "[redacted]", api_key: "[redacted]" },
      list: [{ Authorization: "[redacted]" }],
    });
  });

  it("keeps keys that only contain a secret word", () => {
    expect(redact({ inputTokens: 12, tokenCount: 3 })).toEqual({
      inputTokens: 12,
      tokenCount: 3,
    });
  });

  it("flattens errors and stops at a depth limit", () => {
    const out = redact({ err: new TypeError("boom") }) as {
      err: { name: string; message: string };
    };
    expect(out.err).toMatchObject({ name: "TypeError", message: "boom" });

    let deep: Record<string, unknown> = {};
    const root = deep;
    for (let i = 0; i < 10; i++) deep = deep.next = {};
    expect(JSON.stringify(redact(root))).toContain("[depth]");
  });
});

describe("empty fields", () => {
  it("drops undefined, null, empty strings, arrays and objects at any depth", () => {
    expect(
      redact({
        a: undefined,
        b: null,
        c: "",
        d: [],
        e: {},
        f: { g: null },
        keep: { n: 0, f: false, s: "x" },
      }),
    ).toEqual({ keep: { n: 0, f: false, s: "x" } });
  });

  it("keeps dates", () => {
    const d = new Date("2026-01-01T00:00:00Z");
    expect(redact({ d })).toEqual({ d });
  });
});

describe("maskEmails", () => {
  it("masks addresses in free text", () => {
    expect(maskEmails("mail to ada@example.com failed")).toBe(
      "mail to a…@example.com failed",
    );
    expect(maskEmails("no address here")).toBe("no address here");
  });
});

describe("parseLevel", () => {
  it("accepts known levels and falls back to info", () => {
    expect(parseLevel("debug")).toBe("debug");
    expect(parseLevel("verbose")).toBe("info");
    expect(parseLevel(undefined)).toBe("info");
  });
});

describe("createLogger", () => {
  it("writes one JSON line with level, time, msg and context", () => {
    const { logger, lines } = capture();
    logger.info("started", { port: 3000, unset: undefined, empty: "" });
    expect(lines()).toEqual([
      {
        lvl: "info",
        level: "info",
        time: "2026-01-02T03:04:05.000Z",
        msg: "started",
        service: "test",
        port: 3000,
      },
    ]);
  });

  it("drops entries below the configured level", () => {
    const { logger, lines } = capture("warn");
    logger.debug("a");
    logger.info("b");
    logger.warn("c");
    logger.error("d");
    expect(lines().map((l) => l.msg)).toEqual(["c", "d"]);
  });

  it("child loggers add fields and keep the parent's settings", () => {
    const { logger, lines } = capture("info");
    logger.child({ job: "j1" }).debug("hidden");
    logger.child({ job: "j1" }).warn("shown", { secret: "s" });
    expect(lines()).toEqual([
      expect.objectContaining({
        msg: "shown",
        job: "j1",
        secret: "[redacted]",
      }),
    ]);
  });

  it("routes warn/error to stderr and the rest to stdout by default", () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger({}, { level: "debug" });
    logger.info("i");
    logger.error("e");
    expect(out).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledTimes(1);
  });
});
