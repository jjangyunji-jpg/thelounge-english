import { supabase } from "@/integrations/supabase/client";

/**
 * Calls the generate-sessions edge function for all active schedule periods.
 * 
 * @param effectiveDate - Optional YYYY-MM-DD. When provided, only generates sessions from this date onward.
 * @param studentName - Optional. When provided, only generates sessions for this specific student.
 */
export async function autoGenerateSessions(
  effectiveDate?: string,
  studentName?: string
): Promise<{ totalCreated: number }> {
  // 1. Get all active periods
  const { data: periods } = await supabase
    .from("schedule_periods")
    .select("id")
    .eq("is_active", true);

  if (!periods || periods.length === 0) return { totalCreated: 0 };

  let totalCreated = 0;

  // 2. Call generate-sessions for each active period
  for (const period of periods) {
    try {
      const body: Record<string, any> = { period_id: period.id };
      if (effectiveDate) body.effective_date = effectiveDate;
      if (studentName) body.student_name = studentName;

      const { data, error } = await supabase.functions.invoke("generate-sessions", {
        body,
      });
      if (!error && data?.created) {
        totalCreated += data.created;
      }
    } catch (e) {
      console.error("Auto generate-sessions error for period", period.id, e);
    }
  }

  return { totalCreated };
}
