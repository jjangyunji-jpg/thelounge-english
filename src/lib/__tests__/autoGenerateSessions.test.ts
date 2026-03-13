import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: () => ({
        select: () => ({
          eq: vi.fn(),
        }),
      }),
      functions: {
        invoke: vi.fn(),
      },
    },
  };
});

// Import after mock setup
import { autoGenerateSessions } from "../autoGenerateSessions";
import { supabase } from "@/integrations/supabase/client";

// Helper to get the mock references fresh each time
function setupMocks(periodsData: any) {
  const eqMock = vi.fn().mockResolvedValue({ data: periodsData, error: null });
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  (supabase.from as any) = vi.fn(() => ({ select: selectMock }));
  return eqMock;
}

describe("autoGenerateSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when no active periods exist", async () => {
    setupMocks([]);
    const result = await autoGenerateSessions();
    expect(result).toEqual({ totalCreated: 0 });
  });

  it("returns 0 when periods query returns null", async () => {
    setupMocks(null);
    const result = await autoGenerateSessions();
    expect(result).toEqual({ totalCreated: 0 });
  });

  it("calls generate-sessions for each active period and sums created", async () => {
    setupMocks([{ id: "p1" }, { id: "p2" }]);
    (supabase.functions.invoke as any) = vi.fn()
      .mockResolvedValueOnce({ data: { created: 3 }, error: null })
      .mockResolvedValueOnce({ data: { created: 2 }, error: null });

    const result = await autoGenerateSessions();
    expect(result).toEqual({ totalCreated: 5 });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
  });

  it("passes effectiveDate and studentName when provided", async () => {
    setupMocks([{ id: "p1" }]);
    (supabase.functions.invoke as any) = vi.fn()
      .mockResolvedValue({ data: { created: 1 }, error: null });

    await autoGenerateSessions("2024-03-01", "황재민");
    expect(supabase.functions.invoke).toHaveBeenCalledWith("generate-sessions", {
      body: { period_id: "p1", effective_date: "2024-03-01", student_name: "황재민" },
    });
  });

  it("handles edge function errors gracefully", async () => {
    setupMocks([{ id: "p1" }]);
    (supabase.functions.invoke as any) = vi.fn()
      .mockRejectedValue(new Error("network error"));

    const result = await autoGenerateSessions();
    expect(result).toEqual({ totalCreated: 0 });
  });
});
