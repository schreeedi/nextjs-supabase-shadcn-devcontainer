import { describe, it, expect } from "vitest";
import { getInitials, getProviderLabel } from "@/lib/user";

describe("getProviderLabel", () => {
  it("maps known provider ids to friendly labels", () => {
    expect(getProviderLabel("google")).toBe("Google");
    expect(getProviderLabel("azure")).toBe("Microsoft");
  });

  it("falls back to the raw id for unknown providers", () => {
    expect(getProviderLabel("github")).toBe("github");
    expect(getProviderLabel("unknown")).toBe("unknown");
  });
});

describe("getInitials", () => {
  it("takes the first letter of the first two name parts", () => {
    expect(getInitials("Ada Lovelace", "ada@example.com")).toBe("AL");
    expect(getInitials("Grace Brewster Hopper")).toBe("GB");
  });

  it("uppercases and handles single-word names", () => {
    expect(getInitials("prince")).toBe("P");
  });

  it("collapses extra whitespace between name parts", () => {
    expect(getInitials("  Ada   Lovelace  ")).toBe("AL");
  });

  it("falls back to the email when no name is given", () => {
    expect(getInitials(null, "ada@example.com")).toBe("AD");
    expect(getInitials("", "zoe@example.com")).toBe("ZO");
    expect(getInitials("   ", "yo@example.com")).toBe("YO");
  });

  it("returns an empty string when nothing is available", () => {
    expect(getInitials()).toBe("");
    expect(getInitials(null, null)).toBe("");
  });
});
