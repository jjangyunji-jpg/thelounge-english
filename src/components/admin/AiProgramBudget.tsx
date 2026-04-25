import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Plus, Pencil, Trash2, X, Check, Loader2, Store, TrendingDown, Receipt, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const STORE_FEE_RATE = 0.0495;

const PROGRAM_TYPES = [
  { key: "challenge_21", label: "21일 일기 챌린지", price: 100000, recurring: false },
  { key: "diary_lounge", label: "다이어리 라운지", price: 50000, recurring: true },
  { key: "english_pt", label: "영어 PT", price: 30000, recurring: true },
] as const;

type ProgramType = typeof PROGRAM_TYPES[number]["key"];

interface Subscriber {
  id: string;
  customer_name: string;
  program_type: ProgramType;
  start_month: string; // YYYY-MM
  end_month: string | null;
  note: string | null;
}

interface PaymentRow {
  id: string;
  subscriber_id: string;
  month: string;
  paid: boolean;
  amount_override: number | null;
  note: string | null;
}

interface Props {
  /** Period month in YYYY-MM (same as payment confirmations period) */
  monthKey: string;
  monthLabel: string;
  /** Called whenever subscriber/payment data changes so parent totals can refresh */
  onChange?: () => void;
}

export default function AiProgramBudget({ monthKey, monthLabel, onChange }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [editing, setEditing] = useState<Partial<Subscriber> | null>(null);
  const [showManager, setShowManager] = useState(false);

  const programInfo = useMemo(() => {
    const map = new Map<ProgramType, typeof PROGRAM_TYPES[number]>();
    PROGRAM_TYPES.forEach(p => map.set(p.key, p));
    return map;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sRes, pRes] = await Promise.all([
      supabase.from("ai_program_subscribers" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("ai_program_payments" as any).select("*").eq("month", monthKey),
    ]);
    setSubscribers((sRes.data as any) || []);
    setPayments((pRes.data as any) || []);
    setLoading(false);
  }, [monthKey]);

  useEffect(() => { loadData(); }, [loadData]);

  // Active subscribers for the current month
  // - challenge_21 (one-time): include only if start_month === monthKey
  // - recurring (diary_lounge, english_pt): include if start_month <= monthKey AND (end_month is null OR end_month >= monthKey)
  const activeForMonth = useMemo(() => {
    return subscribers.filter(s => {
      const info = programInfo.get(s.program_type);
      if (!info) return false;
      if (!info.recurring) {
        return s.start_month === monthKey;
      }
      const startsOk = s.start_month <= monthKey;
      const endsOk = !s.end_month || s.end_month >= monthKey;
      return startsOk && endsOk;
    });
  }, [subscribers, monthKey, programInfo]);

  // Build payment lookup
  const payMap = useMemo(() => {
    const m = new Map<string, PaymentRow>();
    payments.forEach(p => m.set(p.subscriber_id, p));
    return m;
  }, [payments]);

  // Toggle paid status (default: true = paid, since most are paid)
  const togglePaid = async (sub: Subscriber) => {
    const existing = payMap.get(sub.id);
    if (existing) {
      const { error } = await supabase
        .from("ai_program_payments" as any)
        .update({ paid: !existing.paid })
        .eq("id", existing.id);
      if (error) {
        toast({ title: "변경 실패", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      // Default: when no record exists, treat as paid; first toggle marks as unpaid
      const { error } = await supabase
        .from("ai_program_payments" as any)
        .insert({ subscriber_id: sub.id, month: monthKey, paid: false });
      if (error) {
        toast({ title: "변경 실패", description: error.message, variant: "destructive" });
        return;
      }
    }
    loadData();
  };

  const isPaid = (sub: Subscriber): boolean => {
    const rec = payMap.get(sub.id);
    return rec ? rec.paid : true; // default paid
  };

  const getAmount = (sub: Subscriber): number => {
    const rec = payMap.get(sub.id);
    if (rec?.amount_override) return rec.amount_override;
    return programInfo.get(sub.program_type)?.price || 0;
  };

  // === Aggregations ===
  const paidSubs = activeForMonth.filter(s => isPaid(s));
  const grossTotal = paidSubs.reduce((sum, s) => sum + getAmount(s), 0);
  const netTotal = Math.round(grossTotal * (1 - STORE_FEE_RATE));
  const feeTotal = grossTotal - netTotal;

  const byProgram = PROGRAM_TYPES.map(info => {
    const subs = paidSubs.filter(s => s.program_type === info.key);
    const gross = subs.reduce((sum, s) => sum + getAmount(s), 0);
    return { ...info, count: subs.length, gross, net: Math.round(gross * (1 - STORE_FEE_RATE)) };
  });

  // === Subscriber CRUD ===
  const startNew = () => setEditing({ program_type: "challenge_21", start_month: monthKey, customer_name: "" });
  const startEdit = (s: Subscriber) => setEditing({ ...s });

  const saveSubscriber = async () => {
    if (!editing?.customer_name?.trim() || !editing.program_type || !editing.start_month) {
      toast({ title: "입력 확인", description: "이름, 프로그램, 시작월은 필수입니다.", variant: "destructive" });
      return;
    }
    const payload = {
      customer_name: editing.customer_name.trim(),
      program_type: editing.program_type,
      start_month: editing.start_month,
      end_month: editing.end_month || null,
      note: editing.note || null,
    };
    const { error } = editing.id
      ? await supabase.from("ai_program_subscribers" as any).update(payload).eq("id", editing.id)
      : await supabase.from("ai_program_subscribers" as any).insert(payload);
    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing.id ? "수정되었습니다." : "등록되었습니다." });
    setEditing(null);
    loadData();
  };

  const deleteSubscriber = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까? 결제 기록도 함께 삭제됩니다.")) return;
    const { error } = await supabase.from("ai_program_subscribers" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
      return;
    }
    loadData();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="pt-4 mt-2 border-t border-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">AI 프로그램 — {monthLabel}</h3>
          <span className="text-[10px] text-muted-foreground">스마트스토어 결제 (수수료 4.95%)</span>
        </div>
        <button
          onClick={() => setShowManager(v => !v)}
          className="text-[11px] px-2 py-1 rounded-md border border-border bg-card hover:bg-muted text-foreground transition-colors flex items-center gap-1"
        >
          <Pencil className="w-3 h-3" />
          {showManager ? "닫기" : "구독자 관리"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Receipt className="w-3 h-3" /> 총 결제액
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">₩{grossTotal.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{paidSubs.length}명 결제 완료</p>
        </div>
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Store className="w-3 h-3 text-blue-600" /> 스토어 결제
          </p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">₩{grossTotal.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">수수료 4.95% 차감 전</p>
        </div>
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-rose-600" /> 수수료 (4.95%)
          </p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">-₩{feeTotal.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">스토어 차감액</p>
        </div>
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-success" /> 실수령 합계
          </p>
          <p className="text-2xl font-bold text-success mt-1">₩{netTotal.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">수수료 차감 후</p>
        </div>
      </div>

      {/* Program-level breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {byProgram.map(p => (
          <div key={p.key} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">{p.label}</p>
              <span className="text-[10px] text-muted-foreground">₩{p.price.toLocaleString()}/회</span>
            </div>
            <p className="text-lg font-bold text-foreground mt-1">{p.count}명 · ₩{p.gross.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">실수령 ₩{p.net.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Active subscribers list (this month) */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
          <Calendar className="w-3 h-3" /> {monthLabel} 결제 대상 — {activeForMonth.length}명
        </p>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-foreground text-xs">구매자</th>
                <th className="text-left px-3 py-2 font-semibold text-foreground text-xs">프로그램</th>
                <th className="text-right px-3 py-2 font-semibold text-foreground text-xs">금액</th>
                <th className="text-right px-3 py-2 font-semibold text-foreground text-xs">실수령</th>
                <th className="text-center px-3 py-2 font-semibold text-foreground text-xs w-24">결제</th>
              </tr>
            </thead>
            <tbody>
              {activeForMonth.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">이번 달 결제 대상이 없습니다. "구독자 관리"에서 추가하세요.</td></tr>
              ) : activeForMonth.map(s => {
                const paid = isPaid(s);
                const amount = getAmount(s);
                const net = Math.round(amount * (1 - STORE_FEE_RATE));
                const info = programInfo.get(s.program_type);
                return (
                  <tr key={s.id} className={cn("border-b border-border last:border-0 hover:bg-muted/30", !paid && "opacity-60")}>
                    <td className="px-3 py-2 text-foreground">{s.customer_name}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {info?.label}
                      {info?.recurring && <span className="ml-1 text-[9px] opacity-70">(구독)</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground text-xs">{paid ? `₩${amount.toLocaleString()}` : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground">{paid ? `₩${net.toLocaleString()}` : "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => togglePaid(s)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors",
                          paid
                            ? "bg-success/15 text-success border-success/30 hover:bg-success/25"
                            : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                        )}
                      >
                        {paid ? <><Check className="w-3 h-3" />결제완료</> : "미결제"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscriber Manager Panel */}
      {showManager && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">전체 구독자 — {subscribers.length}명</p>
            <button
              onClick={startNew}
              className="text-[11px] px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> 추가
            </button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-foreground text-xs">구매자</th>
                  <th className="text-left px-3 py-2 font-semibold text-foreground text-xs">프로그램</th>
                  <th className="text-left px-3 py-2 font-semibold text-foreground text-xs">시작월</th>
                  <th className="text-left px-3 py-2 font-semibold text-foreground text-xs">종료월</th>
                  <th className="text-left px-3 py-2 font-semibold text-foreground text-xs">메모</th>
                  <th className="text-center px-3 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {subscribers.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">등록된 구독자가 없습니다.</td></tr>
                ) : subscribers.map(s => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 group/row">
                    <td className="px-3 py-2 text-foreground">{s.customer_name}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{programInfo.get(s.program_type)?.label}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{s.start_month}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{s.end_month || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{s.note || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(s)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-3 h-3" /></button>
                        <button onClick={() => deleteSubscriber(s.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground">
            💡 21일 일기 챌린지는 일회성이라 시작월에만 표시됩니다. 다이어리 라운지·영어 PT는 구독으로 시작월부터 종료월까지 매월 자동 표시됩니다. 종료월이 비어있으면 무기한 구독으로 처리됩니다.
          </p>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-xl shadow-xl border border-border w-[380px] mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">{editing.id ? "구독자 수정" : "구독자 추가"}</h3>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">구매자 이름</label>
                <input
                  type="text"
                  value={editing.customer_name || ""}
                  onChange={e => setEditing(prev => ({ ...prev!, customer_name: e.target.value }))}
                  placeholder="예: 허송이"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">프로그램</label>
                <select
                  value={editing.program_type || "challenge_21"}
                  onChange={e => setEditing(prev => ({ ...prev!, program_type: e.target.value as ProgramType }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {PROGRAM_TYPES.map(p => (
                    <option key={p.key} value={p.key}>
                      {p.label} (₩{p.price.toLocaleString()}{p.recurring ? "/월" : ""})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">시작월</label>
                  <input
                    type="month"
                    value={editing.start_month || monthKey}
                    onChange={e => setEditing(prev => ({ ...prev!, start_month: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">종료월 (선택)</label>
                  <input
                    type="month"
                    value={editing.end_month || ""}
                    onChange={e => setEditing(prev => ({ ...prev!, end_month: e.target.value || null }))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">메모 (선택)</label>
                <input
                  type="text"
                  value={editing.note || ""}
                  onChange={e => setEditing(prev => ({ ...prev!, note: e.target.value }))}
                  placeholder="예: 6월 PT 연계"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditing(null)} className="flex-1 py-2.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">취소</button>
                <button onClick={saveSubscriber} className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">{editing.id ? "수정" : "등록"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
