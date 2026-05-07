import { supabase } from "@/integrations/supabase/client";

export const STORE_FEE_RATE = 0.0495;

export const AI_PROGRAM_TYPES = [
  { key: "challenge_21", label: "21일 일기 챌린지", price: 100000, recurring: false },
  { key: "diary_lounge", label: "다이어리 라운지", price: 50000, recurring: true },
  { key: "diary_lounge_pt", label: "다이어리 라운지 + 영어 PT", price: 80000, recurring: true },
  { key: "english_pt", label: "영어 PT", price: 30000, recurring: true },
] as const;

export type AiProgramType = typeof AI_PROGRAM_TYPES[number]["key"];

export interface AiSubscriber {
  id: string;
  customer_name: string;
  program_type: AiProgramType;
  start_month: string;
  end_month: string | null;
}

export interface AiPaymentRow {
  id: string;
  subscriber_id: string;
  month: string;
  paid: boolean;
  amount_override: number | null;
}

export interface AiTotals {
  count: number;
  gross: number;
  net: number;
  fee: number;
}

/**
 * Compute AI program totals for a given month (YYYY-MM).
 * Mirrors the logic in AiProgramBudget so the parent budget summary
 * stays in sync.
 */
export async function fetchAiProgramTotals(monthKey: string): Promise<AiTotals> {
  if (!monthKey) return { count: 0, gross: 0, net: 0, fee: 0 };
  const [sRes, pRes] = await Promise.all([
    supabase.from("ai_program_subscribers" as any).select("id, customer_name, program_type, start_month, end_month"),
    supabase.from("ai_program_payments" as any).select("id, subscriber_id, month, paid, amount_override").eq("month", monthKey),
  ]);
  const subs = ((sRes.data as any) || []) as AiSubscriber[];
  const pays = ((pRes.data as any) || []) as AiPaymentRow[];
  const payMap = new Map<string, AiPaymentRow>();
  pays.forEach(p => payMap.set(p.subscriber_id, p));

  const priceOf = (key: AiProgramType) =>
    AI_PROGRAM_TYPES.find(p => p.key === key)?.price || 0;

  const active = subs.filter(s => {
    const info = AI_PROGRAM_TYPES.find(p => p.key === s.program_type);
    if (!info) return false;
    if (!info.recurring) return s.start_month === monthKey;
    return s.start_month <= monthKey && (!s.end_month || s.end_month >= monthKey);
  });

  // Default: paid unless explicitly marked as unpaid
  const paidActive = active.filter(s => {
    const rec = payMap.get(s.id);
    return rec ? rec.paid : true;
  });

  const gross = paidActive.reduce((sum, s) => {
    const rec = payMap.get(s.id);
    return sum + (rec?.amount_override ?? priceOf(s.program_type));
  }, 0);
  const net = Math.round(gross * (1 - STORE_FEE_RATE));
  return { count: paidActive.length, gross, net, fee: gross - net };
}
