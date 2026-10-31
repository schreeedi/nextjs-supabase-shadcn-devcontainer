import { describe, expect, it } from "vitest";
import { requestId } from "@/lib/request-id";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("requestId", () => {
  it("keeps a well-formed id from the reverse proxy", () => {
    expect(requestId("3f2b9c1e-7a4d-4b8e-9c2f-1a2b3c4d5e6f")).toBe(
      "3f2b9c1e-7a4d-4b8e-9c2f-1a2b3c4d5e6f",
    );
    expect(requestId("nginx_a1B2.c3:d4")).toBe("nginx_a1B2.c3:d4");
  });

  it("generates one when the header is missing or empty", () => {
    expect(requestId(null)).toMatch(UUID);
    expect(requestId("")).toMatch(UUID);
  });

  it("replaces client-supplied junk instead of logging it", () => {
    // Log injection / log bloat: the header is attacker-controlled.
    expect(requestId("a\nlevel=error msg=forged")).toMatch(UUID);
    expect(requestId("<script>")).toMatch(UUID);
    expect(requestId("x".repeat(65))).toMatch(UUID);
  });
});
