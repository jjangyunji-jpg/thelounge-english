import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, Loader2, ChevronLeft, ChevronRight, Check, Phone, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const LESSON_PRICE = 50000;

interface StudentRecord {
  student_name: string;
  student_type: string;
  status: string | null;
  group_students: string[];
}

interface CashReceipt {
  student_name: string;
  receipt_type: string;
  receipt_number: string;
}

interface PaymentConfirmation {
  id: string;
  student_name: string;
  month: string;
  confirmed: boolean;
}

export default function CashReceiptManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [receipts, setReceipts] = useState<CashReceipt[]>([]);
  const [confirmations, setConfirmations] = useState<PaymentConfirmation[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Map<string, number>>(new Map());

  // Month navigation
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // Month date range in KST
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01T00:00:00+09:00`;
  const nextM = month === 12 ? 1 : month + 1;
  const nextY = month === 12 ? year + 1 : year;
  const monthEnd = `${nextY}-${String(nextM).padStart(2, "0")}-01T00:00:00+09:00`;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [studRes, receiptRes, confRes, sessRes] = await Promise.all([
      supabase.from("instructor_students").select("student_name, student_type, status, group_students").eq("status", "active"),
      supabase.from("cash_receipts" as any).select("student_name, receipt_type, receipt_number"),
      supabase.from("payment_confirmations" as any).select("*").eq("month", monthKey),
      supabase.from("class_sessions").select("student_name, scheduled_at").gte("scheduled_at", monthStart).lt("scheduled_at", monthEnd),
    ]);
    setStudents((studRes.data || []) as StudentRecord[]);
    setReceipts((receiptRes.data as any as CashReceipt[]) || []);
    setConfirmations((confRes.data as any as PaymentConfirmation[]) || []);

    // Count sessions per student
    const counts = new Map<string, number>();
    (sessRes.data || []).forEach((s: any) => {
      counts.set(s.student_name, (counts.get(s.student_name) || 0) + 1);
    });
    setSessionCounts(counts);
    setLoading(false);
  }, [monthKey, monthStart, monthEnd]);

  useEffect(() => { loadData(); }, [loadData]);

  const receiptMap = new Map(receipts.map(r => [r.student_name, r]));
  const confMap = new Map(confirmations.map(c => [c.student_name, c]));

  // Sort students by name (가나다순), exclude corporate
  const regularStudents = students
    .filter(s => s.student_type !== "corporate")
    .sort((a, b) => a.student_name.localeCompare(b.student_name, "ko"));

  const corporateStudents = students
    .filter(s => s.student_type === "corporate")
    .sort((a, b) => a.student_name.localeCompare(b.student_name, "ko"));

  const toggleConfirm = async (studentName: string) => {
    const existing = confMap.get(studentName);
    if (existing) {
      const newVal = !existing.confirmed;
      await supabase.from("payment_confirmations" as any).update({
        confirmed: newVal,
        confirmed_at: newVal ? new Date().toISOString() : null,
      } as any).eq("id", existing.id);
    } else {
      await supabase.from("payment_confirmations" as any).insert({
        student_name: studentName,
        month: monthKey,
        confirmed: true,
        confirmed_at: new Date().toISOString(),
      } as any);
    }
    loadData();
  };

  const getFee = (s: StudentRecord) => {
    const count = sessionCounts.get(s.student_name) || 0;
    return count * LESSON_PRICE;
  };

  const confirmedCount = regularStudents.filter(s => confMap.get(s.student_name)?.confirmed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderStudentRow = (s: StudentRecord, isCorporate = false) => {
    const conf = confMap.get(s.student_name);
    const isConfirmed = conf?.confirmed || false;
    const receipt = receiptMap.get(s.student_name);
    const fee = isCorporate ? null : getFee(s);
    const count = sessionCounts.get(s.student_name) || 0;

    return (
      <tr key={s.student_name} className={cn("border-b border-border last:border-0 transition-colors", isConfirmed ? "bg-primary/5" : "hover:bg-muted/30")}>
        <td className="px-4 py-3 text-center">
          <button
            onClick={() => toggleConfirm(s.student_name)}
            className={cn(
              "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
              isConfirmed
                ? "bg-primary border-primary text-primary-foreground"
                : "border-muted-foreground/30 hover:border-primary/50"
            )}
          >
            {isConfirmed && <Check className="w-3.5 h-3.5" />}
          </button>
        </td>
        <td className="px-4 py-3">
          <span className={cn("font-medium", isConfirmed ? "text-muted-foreground line-through" : "text-foreground")}>
            {s.student_name}
          </span>
          {s.group_students && s.group_students.length > 0 && (
            <span className="ml-1.5 text-[10px] text-muted-foreground">(그룹 {s.group_students.length + 1}인)</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {isCorporate ? (
            <span className="text-xs text-muted-foreground">회당 정산</span>
          ) : (
            <div>
              <span className={cn("font-semibold", isConfirmed ? "text-muted-foreground" : "text-foreground")}>
                ₩{fee!.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground ml-1">
                ({count}회)
              </span>
            </div>
          )}
        </td>
      </tr>
    );
  };

  const totalFee = regularStudents.reduce((sum, s) => sum + getFee(s), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">결제확인</h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground min-w-[100px] text-center">
            {year}년 {month}월
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-4">
        <div className="rounded-lg border border-border bg-card p-4 flex-1">
          <p className="text-xs text-muted-foreground">정규 수강생</p>
          <p className="text-xl font-bold text-foreground mt-1">{regularStudents.length}명</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            확인 완료 <span className="text-primary font-semibold">{confirmedCount}</span> / {regularStudents.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 flex-1">
          <p className="text-xs text-muted-foreground">예상 수강료 합계</p>
          <p className="text-xl font-bold text-foreground mt-1">₩{totalFee.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">기업 수강생 별도</p>
        </div>
      </div>

      {/* Regular Students Table */}
      {regularStudents.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">정규 수강생</p>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="w-12 px-4 py-3"></th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">학생명</th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground">수강료</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">현금영수증</th>
                </tr>
              </thead>
              <tbody>
                {regularStudents.map(s => renderStudentRow(s))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Corporate Students Table */}
      {corporateStudents.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">기업 수강생</p>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="w-12 px-4 py-3"></th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">학생명</th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground">수강료</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">현금영수증</th>
                </tr>
              </thead>
              <tbody>
                {corporateStudents.map(s => renderStudentRow(s, true))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
