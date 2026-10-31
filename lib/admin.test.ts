import { describe, it, expect } from "vitest";
import { adminUserIds, isAdmin, isUuid } from "@/lib/admin";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const env = (ids?: string) =>
  (ids === undefined ? {} : { ADMIN_USER_IDS: ids }) as NodeJS.ProcessEnv;

describe("isUuid", () => {
  it("accepts uuids only", () => {
    expect(isUuid(A)).toBe(true);
    expect(isUuid(A.toUpperCase())).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(`${A}x`)).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe("adminUserIds / isAdmin", () => {
  it("nobody is admin when unset or empty", () => {
    expect(adminUserIds(env())).toEqual([]);
    expect(adminUserIds(env(""))).toEqual([]);
    expect(isAdmin(A, env())).toBe(false);
  });

  it("parses a comma-separated list, trims and ignores junk", () => {
    expect(adminUserIds(env(` ${A} ,, ${B.toUpperCase()}, nope`))).toEqual([
      A,
      B,
    ]);
  });

  it("matches listed ids case-insensitively", () => {
    expect(isAdmin(A.toUpperCase(), env(A))).toBe(true);
    expect(isAdmin(B, env(A))).toBe(false);
    expect(isAdmin(null, env(A))).toBe(false);
    expect(isAdmin("", env(A))).toBe(false);
  });
});
