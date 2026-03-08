import { useState, useEffect } from "react";
import { FileText, ChevronLeft, ChevronRight, Loader2, Eye, EyeOff, Edit2, Check, X, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SchedulePeriod {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
}

interface ReportRecord {
  id: string;
  instructor_name: string;
  student_name: string;
  period_id: string | null;
  period_label: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export default function StudentReportManagement() {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [periodIdx, setPeriodIdx] = useState(0);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [instructors, setInstructors] = useState<string[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    if (periods.length > 0) loadReports();
  }, [periodIdx, periods]);

  const loadPeriods = async () => {
    const { data } = await supabase
      .from("schedule_periods")
      .select("id,label,start_date,end_date")
      .order("start_date", { ascending: true });
    const list = data || [];
    setPeriods(list);
    setPeriodIdx(Math.max(0, list.length - 1));
  };

  const loadReports = async () => {
    setLoading(true);
    const period = periods[periodIdx];
    if (!period) { setLoading(false); return; }

    const { data } = await supabase
      .from("student_reports" as any)
      .select("*")
      .eq("period_id", period.id)
      .order("created_at", { ascending: false });

    const list = (data || []) as unknown as ReportRecord[];
    setReports(list);

    const instrSet = new Set(list.map((r) => r.instructor_name));
    setInstructors([...instrSet].sort());
    setLoading(false);
  };

  const currentPeriod = periods[periodIdx];
  const periodLabel = currentPeriod
    ? (() => {
        const m = currentPeriod.label.match(/(\d{4})-(\d{2})/);
        return m ? `${m[1]}년 ${parseInt(m[2])}월` : currentPeriod.label;
      })()
    : "";

  const filtered = selectedInstructor
    ? reports.filter((r) => r.instructor_name === selectedInstructor)
    : reports;

  const readCount = filtered.filter((r) => r.is_read).length;
  const unreadCount = filtered.filter((r) => !r.is_read).length;

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("student_reports" as any)
      .update({ content: editContent.trim() } as any)
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "리포트 수정됨 ✓" });
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, content: editContent.trim() } : r)));
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5 text-gold" />
          학생 리포트 관리
        </h2>
        <p className="text-sm text-muted-foreground mt-1">강사가 작성한 월간 학습 리포트를 조회하고 수정합니다</p>
      </div>

      {/* Period Navigation */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={periodIdx <= 0}
          onClick={() => setPeriodIdx((i) => i - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground min-w-[100px] text-center">
          {periodLabel}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={periodIdx >= periods.length - 1}
          onClick={() => setPeriodIdx((i) => i + 1)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Instructor Filter */}
      {instructors.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedInstructor(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              !selectedInstructor
                ? "bg-navy text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            전체
          </button>
          {instructors.map((name) => (
            <button
              key={name}
              onClick={() => setSelectedInstructor(name === selectedInstructor ? null : name)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                selectedInstructor === name
                  ? "bg-navy text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">총 리포트</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{readCount}</p>
            <p className="text-xs text-muted-foreground">읽음</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{unreadCount}</p>
            <p className="text-xs text-muted-foreground">미읽음</p>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            해당 기간에 생성된 리포트가 없습니다
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((report) => {
            const isExpanded = expandedId === report.id;
            const isEditing = editingId === report.id;

            return (
              <Card key={report.id} className="overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-navy" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{report.student_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      강사: {report.instructor_name} · {new Date(report.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <Badge
                    variant={report.is_read ? "secondary" : "destructive"}
                    className="text-[10px] flex-shrink-0 gap-1"
                  >
                    {report.is_read ? (
                      <><Eye className="w-3 h-3" /> 읽음</>
                    ) : (
                      <><EyeOff className="w-3 h-3" /> 미읽음</>
                    )}
                  </Badge>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    {isEditing ? (
                      <>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full h-48 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingId(null)}
                            className="gap-1"
                          >
                            <X className="w-3 h-3" /> 취소
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(report.id)}
                            disabled={saving}
                            className="bg-navy hover:bg-navy-light text-primary-foreground gap-1"
                          >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            저장
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3 border border-border">
                          {report.content}
                        </div>
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingId(report.id);
                              setEditContent(report.content);
                            }}
                            className="gap-1 text-xs"
                          >
                            <Edit2 className="w-3 h-3" /> 수정
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
