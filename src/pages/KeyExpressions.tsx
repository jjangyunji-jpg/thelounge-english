import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, BookMarked, Loader2, Sparkles, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ExpressionTestModal, { KeyExpressionItem } from "@/components/classroom/ExpressionTestModal";

interface KeyExpressionRow extends KeyExpressionItem {
  created_at: string;
  session_id: string | null;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul",
  });
}

function dateKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul",
  });
}

export default function KeyExpressions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentParam = searchParams.get("name") || "";
  const [studentName, setStudentName] = useState(studentParam);
  const [items, setItems] = useState<KeyExpressionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [testOpen, setTestOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      let name = studentParam;
      if (!name) {
        const { data: sessionRes } = await supabase.auth.getSession();
        const userId = sessionRes?.session?.user?.id;
        if (userId) {
          const { data: profile } = await supabase
            .from("student_profiles").select("student_name").eq("user_id", userId).maybeSingle();
          name = profile?.student_name || "";
        }
      }
      setStudentName(name);
      if (!name) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("key_expressions")
        .select("id,situation_label,english,korean,created_at,session_id")
        .eq("student_name", name)
        .order("created_at", { ascending: false });
      if (!error && data) {
        setItems(data as KeyExpressionRow[]);
      }
      setLoading(false);
    };
    init();
  }, [studentParam]);

  // Group by date (KST)
  const grouped: { dateKey: string; dateLabel: string; rows: KeyExpressionRow[] }[] = (() => {
    const map = new Map<string, { dateLabel: string; rows: KeyExpressionRow[] }>();
    for (const it of items) {
      const k = dateKey(it.created_at);
      if (!map.has(k)) {
        map.set(k, { dateLabel: fmtDate(it.created_at), rows: [] });
      }
      map.get(k)!.rows.push(it);
    }
    return Array.from(map.entries()).map(([dateKey, v]) => ({
      dateKey, dateLabel: v.dateLabel, rows: v.rows,
    }));
  })();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />뒤로
          </button>
          <div className="flex items-center gap-1.5">
            <BookMarked className="w-4 h-4 text-purple-500" />
            <h1 className="text-sm font-bold">나의 표현장</h1>
          </div>
          <div className="w-8" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <BookMarked className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              아직 발행된 표현이 없습니다.
            </p>
            <p className="text-xs text-muted-foreground/70">
              수업이 끝난 후 강사님이 핵심 표현을 추출해서 보내드려요.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg bg-purple-50 border border-purple-200 px-4 py-3">
              <div>
                <p className="text-xs text-purple-700 font-semibold">전체 표현</p>
                <p className="text-lg font-bold text-purple-900">{items.length}개</p>
              </div>
              <Button
                onClick={() => setTestOpen(true)}
                className="bg-purple-500 hover:bg-purple-600 text-white gap-2"
                disabled={items.length === 0}
              >
                <Sparkles className="w-4 h-4" />테스트 시작
              </Button>
            </div>

            {grouped.map(group => (
              <div key={group.dateKey} className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground px-1">
                  <Calendar className="w-3 h-3" />{group.dateLabel}
                  <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px]">{group.rows.length}개</span>
                </div>
                <div className="space-y-1.5">
                  {group.rows.map(row => (
                    <div key={row.id} className="rounded-lg border border-border bg-card p-3 space-y-1">
                      {row.situation_label && (
                        <span className="inline-block px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-semibold">
                          {row.situation_label}
                        </span>
                      )}
                      <p className="text-sm font-medium text-foreground">{row.english}</p>
                      <p className="text-xs text-muted-foreground">{row.korean}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </main>

      <ExpressionTestModal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        expressions={items.map(r => ({
          id: r.id, situation_label: r.situation_label, english: r.english, korean: r.korean,
        }))}
        studentName={studentName}
      />
    </div>
  );
}
