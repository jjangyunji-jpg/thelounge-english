import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEq = vi.fn();
const mockInvoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: mockEq }) }),
    functions: { invoke: mockInvoke },
  },
}));

import { autoGenerateSessions } from "../autoGenerateSessions";

describe("autoGenerateSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when no active periods exist", async () => {
    mockEq.mockResolvedValue({ data: [], error: null });
    const result = await autoGenerateSessions();
    expect(result).toEqual({ totalCreated: 0 });
  });

  it("returns 0 when periods query returns null", async () => {
    mockEq.mockResolvedValue({ data: null, error: null });
    const result = await autoGenerateSessions();
    expect(result).toEqual({ totalCreated: 0 });
  });

  it("calls generate-sessions for each active period and sums created", async () => {
    mockEq.mockResolvedValue({ data: [{ id: "p1" }, { id: "p2" }], error: null });
    mockInvoke
      .mockResolvedValueOnce({ data: { created: 3 }, error: null })
      .mockResolvedValueOnce({ data: { created: 2 }, error: null });

    const result = await autoGenerateSessions();
    expect(result).toEqual({ totalCreated: 5 });
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it("passes effectiveDate and studentName when provided", async () => {
    mockEq.mockResolvedValue({ data: [{ id: "p1" }], error: null });
    mockInvoke.mockResolvedValue({ data: { created: 1 }, error: null });

    await autoGenerateSessions("2024-03-01", "황재민");
    expect(mockInvoke).toHaveBeenCalledWith("generate-sessions", {
      body: { period_id: "p1", effective_date: "2024-03-01", student_name: "황재민" },
    });
  });

  it("handles edge function errors gracefully", async () => {
    mockEq.mockResolvedValue({ data: [{ id: "p1" }], error: null });
    mockInvoke.mockRejectedValue(new Error("network error"));

    const result = await autoGenerateSessions();
    expect(result).toEqual({ totalCreated: 0 });
  });
});

  it("handles edge function errors gracefully", async () => {
    const mockEq = getMockEq();
    const mockInvoke = getMockInvoke();
    mockEq.mockResolvedValue({ data: [{ id: "p1" }], error: null });
    mockInvoke.mockRejectedValue(new Error("network error"));

    const result = await autoGenerateSessions();
    expect(result).toEqual({ totalCreated: 0 });
  });
});
