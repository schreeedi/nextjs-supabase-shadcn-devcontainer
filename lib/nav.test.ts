import { describe, it, expect } from "vitest";
import { redirectToPath, safeNextPath } from "@/lib/nav";

describe("safeNextPath", () => {
  it("accepts internal absolute paths incl. query and hash", () => {
    expect(safeNextPath("/app/dashboard")).toBe("/app/dashboard");
    expect(safeNextPath("/app?tab=1#x")).toBe("/app?tab=1#x");
  });

  it("rejects empty values", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
  });

  it("rejects backslashes and control characters", () => {
    expect(safeNextPath("/\\evil.example")).toBeNull();
    expect(safeNextPath("/\t/evil.example")).toBeNull();
    expect(safeNextPath("/\n/evil.example")).toBeNull();
  });
});

describe("redirectToPath", () => {
  it("returns a relative 302 by default", () => {
    const res = redirectToPath("/login");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("honours a custom status", () => {
    expect(redirectToPath("/", 303).status).toBe(303);
  });
});
