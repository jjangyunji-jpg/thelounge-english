import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, Loader2, Phone, Building2 } from "lucide-react";

interface CashReceipt {
  id: string;
  student_name: string;
  receipt_type: string;
  receipt_number: string;
  created_at: string;
  updated_at: string;
}

export default function CashReceiptManagement() {
  const [receipts, setReceipts] = useState<CashReceipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("cash_receipts" as any)
        .select("*")
        .order("updated_at", { ascending: false });
      setReceipts((data as any as CashReceipt[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">현금영수증 정보</h2>
        <span className="text-sm text-muted-foreground">({receipts.length}건)</span>
      </div>

      {receipts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          등록된 현금영수증 정보가 없습니다
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">학생명</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">유형</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">번호</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">등록일</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{r.student_name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs font-medium">
                      {r.receipt_type === "phone" ? (
                        <><Phone className="w-3 h-3 text-primary" /> 휴대폰</>
                      ) : (
                        <><Building2 className="w-3 h-3 text-amber-500" /> 사업자</>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{r.receipt_number}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(r.updated_at).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
