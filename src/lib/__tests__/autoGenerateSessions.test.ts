import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const mockEq = vi.fn();
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  const mockInvoke = vi.fn();
  return {
    supabase: {
      from: mockFrom,
      functions: { invoke: mockInvoke },
    },
    __mockEq: mockEq,
    __mockInvoke: mockInvoke,
  };
});

import { autoGenerateSessions } from "../autoGenerateSessions";
import { supabase } from "@/integrations/supabase/client";

// Access mocks via the module
const getMockEq = () => (supabase.from("") as any).select().eq as ReturnType<typeof vi.fn>;
const getMockInvoke = () => supabase.functions.invoke as ReturnType<typeof vi.fn>;

describe("autoGenerateSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when no active periods exist", async () => {
    const mockEq = getMockEq();
    mockEq.mockResolvedValue({ data: [], error: null });

    const result = await autoGenerateSessions();
    expect(result).toEqual({ totalCreated: 0 });
  });

  it("returns 0 when periods query returns null", async () => {
    const mockEq = getMockEq();
    mockEq.mockResolvedValue({ data: null, error: null });

    const result = await autoGenerateSessions();
    expect(result).toEqual({ totalCreated: 0 });
  });

  it("calls generate-sessions for each active period and sums created", async () => {
    const mockEq = getMockEq();
    const mockInvoke = getMockInvoke();
    mockEq.mockResolvedValue({
      data: [{ id: "p1" }, { id: "p2" }],
      error: null,
    });
    mockInvoke
      .mockResolvedValueOnce({ data: { created: 3 }, error: null })
      .mockResolvedValueOnce({ data: { created: 2 }, error: null });

    const result = await autoGenerateSessions();
    expect(result).toEqual({ totalCreated: 5 });
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it("passes effectiveDate and studentName when provided", async () => {
    const mockEq = getMockEq();
    const mockInvoke = getMockInvoke();
    mockEq.mockResolvedValue({ data: [{ id: "p1" }], error: null });
    mockInvoke.mockResolvedValue({ data: { created: 1 }, error: null });

    await autoGenerateSessions("2024-03-01", "황재민");
    expect(mockInvoke).toHaveBeenCalledWith("generate-sessions", {
      body: { period_id: "p1", effective_date: "2024-03-01", student_name: "황재민" },
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
