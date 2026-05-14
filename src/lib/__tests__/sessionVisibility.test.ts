import { describe, it, expect } from "vitest";
import {
  getMovedAwayKeys,
  isMovedAway,
  isEffectivelyInactive,
  kstDateKey,
} from "../sessionVisibility";

describe("sessionVisibility", () => {
  it("kstDateKey returns KST date for a UTC timestamp before 09:00 UTC", () => {
    // 2026-05-15 00:00 UTC = 2026-05-15 09:00 KST
    expect(kstDateKey("2026-05-15T00:00:00.000Z")).toBe("2026-05-15");
    // 2026-05-14 23:00 UTC = 2026-05-15 08:00 KST
    expect(kstDateKey("2026-05-14T23:00:00.000Z")).toBe("2026-05-15");
  });

  it("getMovedAwayKeys scopes by student_name by default", () => {
    const sessions = [
      // Original 5/15 session — NOT cancellation-flagged
      { scheduled_at: "2026-05-15T10:00:00Z", student_name: "황재민" },
      // Makeup session on 5/17 records origin 5/15
      {
        scheduled_at: "2026-05-17T10:00:00Z",
        student_name: "황재민",
        reschedule_origin_dates: ["2026-05-15"],
      },
    ];
    const moved = getMovedAwayKeys(sessions);
    expect(moved.has("황재민__2026-05-15")).toBe(true);
    expect(isMovedAway(sessions[0], moved)).toBe(true);
    expect(isMovedAway(sessions[1], moved)).toBe(false);
  });

  it("isEffectivelyInactive catches both cancellation and moved-away rows", () => {
    const sessions = [
      { scheduled_at: "2026-05-15T10:00:00Z", student_name: "황재민" },
      {
        scheduled_at: "2026-05-17T10:00:00Z",
        student_name: "황재민",
        reschedule_origin_dates: ["2026-05-15"],
      },
      {
        scheduled_at: "2026-05-20T10:00:00Z",
        student_name: "황재민",
        cancellation_type: "sick",
      },
    ];
    const moved = getMovedAwayKeys(sessions);
    expect(isEffectivelyInactive(sessions[0], moved)).toBe(true); // moved away
    expect(isEffectivelyInactive(sessions[1], moved)).toBe(false); // active makeup
    expect(isEffectivelyInactive(sessions[2], moved)).toBe(true); // cancelled
  });

  it("scoped=false works for single-student contexts (sidebar)", () => {
    const sessions = [
      { scheduled_at: "2026-05-15T10:00:00Z" },
      {
        scheduled_at: "2026-05-17T10:00:00Z",
        reschedule_origin_dates: ["2026-05-15"],
      },
    ];
    const moved = getMovedAwayKeys(sessions, { scoped: false });
    expect(moved.has("2026-05-15")).toBe(true);
    expect(isMovedAway(sessions[0], moved, { scoped: false })).toBe(true);
  });

  it("ignores self-referential origin (rescheduled then back to same KST date)", () => {
    const sessions = [
      {
        scheduled_at: "2026-05-15T10:00:00Z",
        student_name: "X",
        reschedule_origin_dates: ["2026-05-15"],
      },
    ];
    const moved = getMovedAwayKeys(sessions);
    expect(moved.size).toBe(0);
  });
});
