import { describe, it, expect } from "vitest";
import { formatStudentName } from "../formatStudentName";

describe("formatStudentName", () => {
  it("returns Korean name with English name separated by slash", () => {
    expect(formatStudentName("조은순", "Joy")).toBe("조은순 / Joy");
  });

  it("returns only Korean name when English name is undefined", () => {
    expect(formatStudentName("황재민")).toBe("황재민");
  });

  it("returns only Korean name when English name is null", () => {
    expect(formatStudentName("김민수", null)).toBe("김민수");
  });

  it("returns only Korean name when English name is empty string", () => {
    expect(formatStudentName("박지은", "")).toBe("박지은");
  });
});
