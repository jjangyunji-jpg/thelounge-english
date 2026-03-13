import { describe, it, expect } from "vitest";
import { cn, toKST, isSameDayKST, todayKSTString, nowKST } from "../utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("resolves conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("handles undefined and null", () => {
    expect(cn("base", undefined, null)).toBe("base");
  });
});

describe("toKST", () => {
  it("converts a UTC ISO string to KST Date", () => {
    // 2024-01-15T00:00:00Z (UTC midnight) → KST 09:00
    const result = toKST("2024-01-15T00:00:00Z");
    expect(result.getHours()).toBe(9);
    expect(result.getDate()).toBe(15);
  });

  it("accepts Date objects", () => {
    const utcDate = new Date("2024-06-01T15:00:00Z");
    const result = toKST(utcDate);
    // 15:00 UTC + 9 = 00:00 next day KST
    expect(result.getHours()).toBe(0);
    expect(result.getDate()).toBe(2);
  });
});

describe("isSameDayKST", () => {
  it("returns true for same KST day", () => {
    // Both are 2024-01-15 in KST
    expect(isSameDayKST("2024-01-15T01:00:00+09:00", "2024-01-15T23:00:00+09:00")).toBe(true);
  });

  it("returns false for different KST days", () => {
    expect(isSameDayKST("2024-01-15T00:00:00+09:00", "2024-01-16T00:00:00+09:00")).toBe(false);
  });

  it("handles UTC dates that cross KST day boundary", () => {
    // 2024-01-14T23:00:00Z = 2024-01-15T08:00:00 KST
    // 2024-01-15T00:00:00Z = 2024-01-15T09:00:00 KST
    expect(isSameDayKST("2024-01-14T23:00:00Z", "2024-01-15T00:00:00Z")).toBe(true);
  });
});

describe("nowKST", () => {
  it("returns a Date object", () => {
    expect(nowKST()).toBeInstanceOf(Date);
  });
});

describe("todayKSTString", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = todayKSTString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
