import { describe, it, expect, vi } from "vitest";

// We need to mock jsPDF since the module imports it at top level
vi.mock("jspdf", () => ({ default: vi.fn() }));
vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));

import { buildSettlementRows } from "../exportSettlementPdf";

const BASE_PAY = 11000;

describe("buildSettlementRows", () => {
  const periodStart = "2025-03-01";
  const periodEnd = "2025-03-31";

  // Use a fixed "now" far in the future so all sessions count as past
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-04-01T00:00:00+09:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("calculates 초급(A1/A2) pay correctly: BASE + 14000", () => {
    const sessions = [
      { scheduled_at: "2025-03-10T10:00:00+09:00", student_name: "김철수", level: "A1" },
    ];
    const rows = buildSettlementRows(sessions, [], periodStart, periodEnd);
    expect(rows).toHaveLength(1);
    expect(rows[0].pay).toBe(BASE_PAY + 14000); // 25000
    expect(rows[0].type).toBe("수업");
  });

  it("calculates 중급(B1/B2) pay correctly: BASE + 19000", () => {
    const sessions = [
      { scheduled_at: "2025-03-15T14:00:00+09:00", student_name: "이영희", level: "B2" },
    ];
    const rows = buildSettlementRows(sessions, [], periodStart, periodEnd);
    expect(rows[0].pay).toBe(BASE_PAY + 19000); // 30000
  });

  it("calculates 고급(C1/C2) pay correctly: BASE + 24000", () => {
    const sessions = [
      { scheduled_at: "2025-03-20T09:00:00+09:00", student_name: "박민수", level: "C1" },
    ];
    const rows = buildSettlementRows(sessions, [], periodStart, periodEnd);
    expect(rows[0].pay).toBe(BASE_PAY + 24000); // 35000
  });

  it("uses flatRate for 대표 instead of level-based calculation", () => {
    const sessions = [
      { scheduled_at: "2025-03-05T10:00:00+09:00", student_name: "김철수", level: "A1" },
      { scheduled_at: "2025-03-06T10:00:00+09:00", student_name: "이영희", level: "C2" },
    ];
    const flatRate = 50000;
    const rows = buildSettlementRows(sessions, [], periodStart, periodEnd, 20000, flatRate);
    expect(rows).toHaveLength(2);
    expect(rows[0].pay).toBe(50000);
    expect(rows[1].pay).toBe(50000);
  });

  it("excludes meetings when flatRate (대표) is set", () => {
    const sessions = [
      { scheduled_at: "2025-03-10T10:00:00+09:00", student_name: "김철수", level: "B1" },
    ];
    const meetings = [
      { scheduled_at: "2025-03-12T14:00:00+09:00", duration_minutes: 60, notes: "팀 미팅" },
    ];
    const rows = buildSettlementRows(sessions, meetings, periodStart, periodEnd, 20000, 50000);
    expect(rows).toHaveLength(1); // Only session, no meeting
    expect(rows[0].type).toBe("수업");
  });

  it("includes meetings for regular instructors with BASE_PAY rate", () => {
    const meetings = [
      { scheduled_at: "2025-03-15T14:00:00+09:00", duration_minutes: 90, notes: "업무 미팅" },
    ];
    const rows = buildSettlementRows([], meetings, periodStart, periodEnd);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("미팅");
    expect(rows[0].durationHours).toBe(1.5);
    expect(rows[0].pay).toBe(Math.round(1.5 * BASE_PAY)); // 16500
  });

  it("calculates cumulative totals correctly", () => {
    const sessions = [
      { scheduled_at: "2025-03-01T10:00:00+09:00", student_name: "A", level: "B1" },
      { scheduled_at: "2025-03-02T10:00:00+09:00", student_name: "B", level: "B1" },
      { scheduled_at: "2025-03-03T10:00:00+09:00", student_name: "C", level: "A1" },
    ];
    const rows = buildSettlementRows(sessions, [], periodStart, periodEnd);
    const pay1 = BASE_PAY + 19000; // 30000
    const pay2 = BASE_PAY + 19000; // 30000
    const pay3 = BASE_PAY + 14000; // 25000
    expect(rows[0].cumulative).toBe(pay1);
    expect(rows[1].cumulative).toBe(pay1 + pay2);
    expect(rows[2].cumulative).toBe(pay1 + pay2 + pay3);
  });

  it("filters out sessions outside period range", () => {
    const sessions = [
      { scheduled_at: "2025-02-28T23:00:00+09:00", student_name: "Before", level: "B1" },
      { scheduled_at: "2025-03-15T10:00:00+09:00", student_name: "Inside", level: "B1" },
      { scheduled_at: "2025-04-01T01:00:00+09:00", student_name: "After", level: "B1" },
    ];
    const rows = buildSettlementRows(sessions, [], periodStart, periodEnd);
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toContain("Inside");
  });

  it("filters out future sessions (beyond current time)", () => {
    vi.setSystemTime(new Date("2025-03-15T00:00:00+09:00"));
    const sessions = [
      { scheduled_at: "2025-03-10T10:00:00+09:00", student_name: "Past", level: "B1" },
      { scheduled_at: "2025-03-20T10:00:00+09:00", student_name: "Future", level: "B1" },
    ];
    const rows = buildSettlementRows(sessions, [], periodStart, periodEnd);
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toContain("Past");
  });

  it("sorts rows chronologically", () => {
    const sessions = [
      { scheduled_at: "2025-03-20T10:00:00+09:00", student_name: "Later", level: "B1" },
      { scheduled_at: "2025-03-05T10:00:00+09:00", student_name: "Earlier", level: "B1" },
    ];
    const meetings = [
      { scheduled_at: "2025-03-10T14:00:00+09:00", duration_minutes: 60, notes: "미팅" },
    ];
    const rows = buildSettlementRows(sessions, meetings, periodStart, periodEnd);
    expect(rows[0].description).toContain("Earlier");
    expect(rows[1].type).toBe("미팅");
    expect(rows[2].description).toContain("Later");
  });

  it("returns empty array for no sessions or meetings", () => {
    const rows = buildSettlementRows([], [], periodStart, periodEnd);
    expect(rows).toHaveLength(0);
  });

  it("defaults unknown level to 중급 rate (19000)", () => {
    const sessions = [
      { scheduled_at: "2025-03-10T10:00:00+09:00", student_name: "Unknown", level: "X9" },
    ];
    const rows = buildSettlementRows(sessions, [], periodStart, periodEnd);
    expect(rows[0].pay).toBe(BASE_PAY + 19000);
  });
});
