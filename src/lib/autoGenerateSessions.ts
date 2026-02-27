import { supabase } from "@/integrations/supabase/client";

/**
 * Calls the generate-sessions edge function for all active schedule periods.
 * Used after registering a new student to auto-create their class sessions.
 */
export async function autoGenerateSessions(): Promise<{ totalCreated: number }> {
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
      const { data, error } = await supabase.functions.invoke("generate-sessions", {
        body: { period_id: period.id },
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
