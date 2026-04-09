import { useState, useEffect } from "react";
import { Download, Plus, ChevronDown, ChevronUp, Edit2, ToggleLeft, ToggleRight, Loader2, X, Star, MessageSquare, Filter, ExternalLink, UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportAllSettlementsPdf } from "@/lib/exportSettlementPdf";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";

interface FeedbackCategory {
  id: string;
  key: string;
  label: string;
  sort_order: number;
}

interface FeedbackRecord {
  id: string;
  student_name: string;
  period_label: string;
  satisfaction: number;
  teaching_quality: number;
  communication: number;
  lesson_preparation: number;
  ratings: Record<string, number> | null;
  comment: string | null;
  created_at: string;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  active: boolean;
  lesson_rate: number;
  meeting_rate: number;
  position: string;
  user_id: string | null;
  join_date: string | null;
  gender: string | null;
  age: number | null;
  education: string | null;
  bio_notes: string | null;
  meet_link: string | null;
}

// 급여 체계: 기본급 11,000 + 레벨별 수당
const BASE_SALARY = 11000;
const LEVEL_BONUS: Record<string, number> = {
  "초급": 14000,  // A1, A2
  "중급": 19000,  // B1, B2
  "고급": 24000,  // C1, C2
};

const getLevelCategory = (level: string): string => {
  if (["A1", "A2"].includes(level)) return "초급";
  if (["B1", "B2"].includes(level)) return "중급";
  if (["C1", "C2"].includes(level)) return "고급";
  return "중급";
};

interface NewInstructorForm {
  name: string;
  englishName: string;
  joinDate: string;
}

export default function InstructorManagement() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [deactivateTarget, setDeactivateTarget] = useState<Instructor | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deactivating, setDeactivating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ phone: "", join_date: "", gender: "", age: "", education: "", bio_notes: "", meet_link: "", position: "강사", lesson_rate: "30000" });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [form, setForm] = useState<NewInstructorForm>({
    name: "",
    englishName: "",
    joinDate: "",
  });
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackRecord[]>>({});
  const [feedbackCategories, setFeedbackCategories] = useState<FeedbackCategory[]>([]);
  const [periodLabels, setPeriodLabels] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [staffUserIds, setStaffUserIds] = useState<Set<string>>(new Set());
  const [instrTab, setInstrTab] = useState<"active" | "inactive">("active");
  const [togglingStaff, setTogglingStaff] = useState<string | null>(null);

  useEffect(() => {
    fetchInstructors();
    fetchAllFeedback();
    fetchFeedbackCategories();
    fetchStaffRoles();
  }, []);

  const fetchStaffRoles = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "staff");
    if (data) {
      setStaffUserIds(new Set(data.map(r => r.user_id)));
    }
  };

  const toggleStaffRole = async (ins: Instructor) => {
    if (!ins.user_id) return;
    setTogglingStaff(ins.id);
    const isStaff = staffUserIds.has(ins.user_id);

    if (isStaff) {
      // Remove staff role
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", ins.user_id)
        .eq("role", "staff");
      if (error) {
        toast({ title: "권한 제거 실패", description: error.message, variant: "destructive" });
      } else {
        setStaffUserIds(prev => { const n = new Set(prev); n.delete(ins.user_id!); return n; });
        toast({ title: "Staff 권한이 제거되었습니다" });
      }
    } else {
      // Add staff role
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: ins.user_id, role: "staff" as any, approved: true });
      if (error) {
        toast({ title: "권한 부여 실패", description: error.message, variant: "destructive" });
      } else {
        setStaffUserIds(prev => new Set(prev).add(ins.user_id!));
        toast({ title: "Staff 권한이 부여되었습니다" });
      }
    }
    setTogglingStaff(null);
  };

  const fetchInstructors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("instructors")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "불러오기 실패", description: error.message, variant: "destructive" });
    } else {
      setInstructors(data || []);
    }
    setLoading(false);
  };

  const fetchAllFeedback = async () => {
    const { data } = await supabase
      .from("class_feedback")
      .select("id,student_name,instructor_name,period_label,satisfaction,teaching_quality,communication,lesson_preparation,ratings,comment,created_at")
      .order("created_at", { ascending: false });
    if (data) {
      const map: Record<string, FeedbackRecord[]> = {};
      const labels = new Set<string>();
      for (const fb of data as any[]) {
        const key = fb.instructor_name;
        if (!map[key]) map[key] = [];
        map[key].push(fb as FeedbackRecord);
        labels.add(fb.period_label);
      }
      setFeedbackMap(map);
      const sortedLabels = Array.from(labels).sort().reverse();
      setPeriodLabels(sortedLabels);
      if (sortedLabels.length > 0) setSelectedPeriod(sortedLabels[0]);
    }
  };

  const fetchFeedbackCategories = async () => {
    const { data } = await supabase
      .from("feedback_categories")
      .select("id,key,label,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    setFeedbackCategories(data || []);
  };

  const toggleActive = async (ins: Instructor) => {
    const { error } = await supabase
      .from("instructors")
      .update({ active: !ins.active })
      .eq("id", ins.id);

    if (error) {
      toast({ title: "업데이트 실패", description: error.message, variant: "destructive" });
    } else {
      setInstructors((prev) =>
        prev.map((i) => (i.id === ins.id ? { ...i, active: !ins.active } : i))
      );
    }
  };

  const startEdit = (ins: Instructor) => {
    setEditingId(ins.id);
    setEditFields({
      phone: ins.phone || "",
      join_date: ins.join_date || "",
      gender: ins.gender || "",
      age: ins.age ? String(ins.age) : "",
      education: ins.education || "",
      bio_notes: ins.bio_notes || "",
      meet_link: ins.meet_link || "",
      position: ins.position || "강사",
      lesson_rate: ins.lesson_rate?.toString() || "30000",
    });
  };

  const saveEdit = async (id: string) => {
    setSavingId(id);
    const { error } = await supabase
      .from("instructors")
      .update({
        phone: editFields.phone || null,
        join_date: editFields.join_date || null,
        gender: editFields.gender || null,
        age: editFields.age ? parseInt(editFields.age) : null,
        education: editFields.education || null,
        bio_notes: editFields.bio_notes || null,
        meet_link: editFields.meet_link || null,
        position: editFields.position || "강사",
        lesson_rate: editFields.lesson_rate ? parseInt(editFields.lesson_rate) : 30000,
      })
      .eq("id", id);

    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    } else {
      setInstructors((prev) =>
        prev.map((i) => (i.id === id ? {
          ...i,
          phone: editFields.phone || null,
          join_date: editFields.join_date || null,
          gender: editFields.gender || null,
          age: editFields.age ? parseInt(editFields.age) : null,
          education: editFields.education || null,
          bio_notes: editFields.bio_notes || null,
          meet_link: editFields.meet_link || null,
          position: editFields.position || "강사",
          lesson_rate: editFields.lesson_rate ? parseInt(editFields.lesson_rate) : 30000,
        } : i))
      );
      setEditingId(null);
      toast({ title: "저장 완료" });
    }
    setSavingId(null);
  };

  const handleCreate = async () => {
    if (!form.name || !form.englishName) {
      toast({ title: "이름과 영어이름은 필수입니다.", variant: "destructive" });
      return;
    }
    setCreating(true);

    const { error } = await supabase.from("instructors").insert({
      name: form.name,
      join_date: form.joinDate || null,
      active: true,
      bio_notes: form.englishName ? `영어이름: ${form.englishName}` : null,
    });

    if (error) {
      toast({ title: "강사 추가 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "강사 추가 완료", description: `${form.name} (${form.englishName}) 강사가 추가되었습니다.` });
      setShowAddModal(false);
      setForm({ name: "", englishName: "", joinDate: "" });
      fetchInstructors();
    }
    setCreating(false);
  };

  const activeCount = instructors.filter((i) => i.active).length;

  const handleDownloadSettlement = async () => {
    setDownloadingPdf(true);
    try {
      // 정산은 월 기준 (급여용)
      // 정산은 월 기준 (급여용)
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      // Fetch sessions & meetings for all active instructors
      const activeInstructors = instructors.filter(i => i.active && i.position !== '대표');
      const allData = await Promise.all(
        activeInstructors.map(async (ins) => {
          const [sessRes, meetRes] = await Promise.all([
            supabase.from("class_sessions").select("scheduled_at,student_name,level").eq("instructor_name", ins.name),
            supabase.from("business_meetings").select("scheduled_at,duration_minutes,notes").eq("instructor_id", ins.id),
          ]);
          return {
            info: { name: ins.name, email: ins.email },
            sessions: sessRes.data || [],
            meetings: meetRes.data || [],
            meetingRate: ins.meeting_rate,
            position: ins.position,
            lessonRate: ins.lesson_rate,
          };
        })
      );

      await exportAllSettlementsPdf(allData, {
        label: monthLabel,
        start_date: monthStart,
        end_date: monthEnd,
      });
      toast({ title: "정산 자료 PDF 다운로드 완료" });
    } catch (err: unknown) {
      toast({ title: "다운로드 실패", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
    setDownloadingPdf(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">강사 관리</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">담당 강사 프로필 및 정산 설정</p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.open("/t/dashboard", "_blank")}
          >
            <ExternalLink className="w-4 h-4" />
            강사 대시보드
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-gold text-gold-dark hover:bg-gold/8"
            onClick={handleDownloadSettlement}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            노무사 전달자료 다운받기
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-navy hover:bg-navy-light text-primary-foreground"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4" />
            강사 추가
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-navy">{activeCount}명</p>
            <p className="text-xs text-muted-foreground mt-1">활성 강사</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{instructors.length}명</p>
            <p className="text-xs text-muted-foreground mt-1">전체 강사</p>
          </CardContent>
        </Card>
      </div>

      {/* Instructor List by Position */}
      {instructors.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          등록된 강사가 없습니다. 강사 추가 버튼을 눌러 첫 번째 강사를 등록하세요.
        </div>
      )}
      {(['대표', '매니저', '강사'] as const).map((positionGroup) => {
        const group = instructors.filter(ins => (ins.position || '강사') === positionGroup).sort((a, b) => a.name.localeCompare(b.name, "ko"));
        if (group.length === 0) return null;
        return (
          <div key={positionGroup} className="space-y-3">
            <div className="flex items-center gap-2 pt-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                positionGroup === '대표' ? 'bg-gold/20 text-gold-dark' :
                positionGroup === '매니저' ? 'bg-navy/10 text-navy' :
                'bg-muted text-muted-foreground'
              }`}>
                {positionGroup}
              </span>
              <span className="text-xs text-muted-foreground">{group.length}명</span>
            </div>
            {group.map((ins) => (
          <Card key={ins.id} className="shadow-card border-border overflow-hidden">
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedId(expandedId === ins.id ? null : ins.id)}
            >
              <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                <span className="text-navy font-bold text-sm">
                  {ins.name.charAt(0)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{ins.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ins.position === '대표' ? 'bg-gold/20 text-gold-dark' :
                    ins.position === '매니저' ? 'bg-navy/10 text-navy' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {ins.position || '강사'}
                  </span>
                  <span className={ins.active ? "status-active" : "status-inactive"}>
                    {ins.active ? "활성" : "비활성"}
                  </span>
                  {ins.user_id && (
                    <span className="text-xs bg-navy/10 text-navy px-2 py-0.5 rounded-full">
                      계정 연결됨
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{ins.email}</p>
              </div>

              <div className="hidden md:flex items-center gap-3 text-sm">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={(e) => { e.stopPropagation(); navigate(`/t/dashboard?instructor_id=${ins.id}`); }}
                >
                  <ExternalLink className="w-3 h-3" />
                  대시보드
                </Button>
                <div className="text-center">
                  <p className="font-semibold text-foreground">
                    {ins.position === '대표' ? `₩${ins.lesson_rate.toLocaleString()}` : `₩${BASE_SALARY.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{ins.position === '대표' ? '시급' : '기본급'}</p>
                </div>
              </div>

              {expandedId === ins.id ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>

            {expandedId === ins.id && (
              <div className="border-t border-border bg-muted/20 p-4 space-y-4">

                {/* Feedback Results — moved above salary & info */}
                <div className="p-4 rounded-lg bg-card border border-border">
                  <Collapsible defaultOpen={false}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-gold" />
                        수업 피드백
                        {(feedbackMap[ins.name] || []).length > 0 && (
                          <Badge variant="outline" className="text-[10px] ml-1">{(feedbackMap[ins.name] || []).length}건</Badge>
                        )}
                      </h4>
                      <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {/* Period filter */}
                      {(feedbackMap[ins.name] || []).length > 0 && (
                        <div className="flex items-center gap-2 pt-3 pb-1">
                          <Filter className="w-3 h-3 text-muted-foreground" />
                          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                            <SelectTrigger className="h-7 text-xs w-[160px]">
                              <SelectValue placeholder="기간 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">전체 기간</SelectItem>
                              {periodLabels.map(label => (
                                <SelectItem key={label} value={label}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {(() => {
                        const allFeedbacks = feedbackMap[ins.name] || [];
                        const feedbacks = selectedPeriod === "all"
                          ? allFeedbacks
                          : allFeedbacks.filter(fb => fb.period_label === selectedPeriod);
                        if (allFeedbacks.length === 0) {
                          return <p className="text-xs text-muted-foreground py-3 text-center">아직 피드백이 없습니다</p>;
                        }
                        if (feedbacks.length === 0) {
                          return <p className="text-xs text-muted-foreground py-3 text-center">해당 기간의 피드백이 없습니다</p>;
                        }

                        const cats = feedbackCategories.length > 0
                          ? feedbackCategories
                          : [
                              { key: "satisfaction", label: "만족도", sort_order: 0 },
                              { key: "teaching_quality", label: "퀄리티", sort_order: 1 },
                              { key: "communication", label: "소통", sort_order: 2 },
                              { key: "lesson_preparation", label: "준비도", sort_order: 3 },
                            ];

                        const getRating = (fb: FeedbackRecord, key: string): number => {
                          if (fb.ratings && typeof fb.ratings === "object" && key in fb.ratings) {
                            return fb.ratings[key] || 0;
                          }
                          if (key === "satisfaction") return fb.satisfaction;
                          if (key === "teaching_quality") return fb.teaching_quality;
                          if (key === "communication") return fb.communication;
                          if (key === "lesson_preparation") return fb.lesson_preparation;
                          return 0;
                        };

                        const catAvgs = cats.map(cat => {
                          const avg = Math.round(feedbacks.reduce((a, f) => a + getRating(f, cat.key), 0) / feedbacks.length * 10) / 10;
                          return { label: cat.label, value: avg };
                        });
                        const overallAvg = Math.round(catAvgs.reduce((a, c) => a + c.value, 0) / catAvgs.length * 10) / 10;

                        return (
                          <div className="space-y-3 pt-3">
                            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(cats.length + 1, 6)}, 1fr)` }}>
                              <div className="text-center p-2 rounded-lg bg-muted/50">
                                <div className="flex items-center justify-center gap-0.5">
                                  <Star className={`w-3 h-3 ${overallAvg >= 4 ? "text-gold fill-gold" : overallAvg >= 3 ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
                                  <span className="text-sm font-bold text-foreground">{overallAvg}</span>
                                </div>
                                <p className="text-[9px] text-muted-foreground mt-0.5">종합</p>
                              </div>
                              {catAvgs.map(item => (
                                <div key={item.label} className="text-center p-2 rounded-lg bg-muted/50">
                                  <div className="flex items-center justify-center gap-0.5">
                                    <Star className={`w-3 h-3 ${item.value >= 4 ? "text-gold fill-gold" : item.value >= 3 ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
                                    <span className="text-sm font-bold text-foreground">{item.value}</span>
                                  </div>
                                  <p className="text-[9px] text-muted-foreground mt-0.5">{item.label}</p>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {[...feedbacks].sort((a, b) => {
                                const hasComment = (fb: FeedbackRecord) => fb.comment?.trim() ? 1 : 0;
                                const commentDiff = hasComment(b) - hasComment(a);
                                if (commentDiff !== 0) return commentDiff;
                                const avgScore = (fb: FeedbackRecord) => {
                                  const r = fb.ratings as Record<string, number> | null;
                                  if (!r) return 0;
                                  const vals = Object.values(r).filter(v => typeof v === "number" && v > 0);
                                  return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
                                };
                                return avgScore(a) - avgScore(b);
                              }).map(fb => (
                                <div key={fb.id} className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-foreground">{fb.student_name}</span>
                                    <span className="text-[10px] text-muted-foreground">{fb.period_label}</span>
                                  </div>
                                  <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
                                    {cats.map(cat => (
                                      <span key={cat.key}>{cat.label} {getRating(fb, cat.key)}★</span>
                                    ))}
                                  </div>
                                  {fb.comment && (
                                    <p className="text-xs text-foreground/80 italic">"{fb.comment}"</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                {/* Salary & Info — collapsible toggles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Salary info */}
                  <div className="p-4 rounded-lg bg-card border border-border">
                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <h4 className="text-sm font-semibold text-foreground">💰 급여 체계</h4>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="pt-3">
                          {ins.position === '대표' ? (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">시급 (모든 업무 동일)</span>
                                <span className="text-sm font-semibold text-navy">₩{ins.lesson_rate.toLocaleString()}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">기본급</span>
                                <span className="text-sm font-semibold text-foreground">₩{BASE_SALARY.toLocaleString()}</span>
                              </div>
                              {Object.entries(LEVEL_BONUS).map(([level, bonus]) => (
                                <div key={level} className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">{level}반 수업 수당</span>
                                  <span className="text-sm font-medium text-foreground">+₩{bonus.toLocaleString()}</span>
                                </div>
                              ))}
                              <div className="border-t border-border pt-2 mt-2">
                                {Object.entries(LEVEL_BONUS).map(([level, bonus]) => (
                                  <div key={level} className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">{level}반 합계</span>
                                    <span className="font-semibold text-navy">₩{(BASE_SALARY + bonus).toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  {/* Personal info */}
                  <div className="p-4 rounded-lg bg-card border border-border">
                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <h4 className="text-sm font-semibold text-foreground">📋 강사 정보</h4>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="pt-3">
                          <div className="flex items-center justify-end mb-2">
                            {editingId !== ins.id && (
                              <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => startEdit(ins)}>
                                <Edit2 className="w-3 h-3" /> 수정
                              </Button>
                            )}
                          </div>
                          {editingId === ins.id ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">직책</Label>
                                  <select className="w-full h-7 text-xs mt-0.5 rounded-md border border-input bg-background px-2" value={editFields.position} onChange={(e) => setEditFields(f => ({ ...f, position: e.target.value }))}>
                                    <option value="대표">대표</option>
                                    <option value="매니저">매니저</option>
                                    <option value="강사">강사</option>
                                  </select>
                                </div>
                                {editFields.position === '대표' && (
                                  <div>
                                    <Label className="text-[10px] text-muted-foreground">시급 (원)</Label>
                                    <Input type="number" className="h-7 text-xs mt-0.5" value={editFields.lesson_rate} onChange={(e) => setEditFields(f => ({ ...f, lesson_rate: e.target.value }))} />
                                  </div>
                                )}
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">연락처</Label>
                                  <Input className="h-7 text-xs mt-0.5" value={editFields.phone} onChange={(e) => setEditFields(f => ({ ...f, phone: e.target.value }))} />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">입사일</Label>
                                  <Input type="date" className="h-7 text-xs mt-0.5" value={editFields.join_date} onChange={(e) => setEditFields(f => ({ ...f, join_date: e.target.value }))} />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">성별</Label>
                                  <Input className="h-7 text-xs mt-0.5" placeholder="남/여" value={editFields.gender} onChange={(e) => setEditFields(f => ({ ...f, gender: e.target.value }))} />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">나이</Label>
                                  <Input type="number" className="h-7 text-xs mt-0.5" value={editFields.age} onChange={(e) => setEditFields(f => ({ ...f, age: e.target.value }))} />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">최종학력</Label>
                                  <Input className="h-7 text-xs mt-0.5" value={editFields.education} onChange={(e) => setEditFields(f => ({ ...f, education: e.target.value }))} />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">비고</Label>
                                  <Input className="h-7 text-xs mt-0.5" value={editFields.bio_notes} onChange={(e) => setEditFields(f => ({ ...f, bio_notes: e.target.value }))} />
                                </div>
                                <div className="col-span-2">
                                  <Label className="text-[10px] text-muted-foreground">구글 미트 링크 (업무 미팅용)</Label>
                                  <Input className="h-7 text-xs mt-0.5" placeholder="https://meet.google.com/xxx-xxxx-xxx" value={editFields.meet_link} onChange={(e) => setEditFields(f => ({ ...f, meet_link: e.target.value }))} />
                                </div>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" onClick={() => saveEdit(ins.id)} disabled={savingId === ins.id} className="bg-navy text-primary-foreground hover:bg-navy-light h-7 text-xs">
                                  {savingId === ins.id && <Loader2 className="w-3 h-3 animate-spin mr-1" />}저장
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-7 text-xs">취소</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between"><span className="text-xs text-muted-foreground">직책</span><span className="text-xs font-medium">{ins.position || '강사'}</span></div>
                              <div className="flex justify-between"><span className="text-xs text-muted-foreground">이메일</span><span className="text-xs font-medium">{ins.email}</span></div>
                              <div className="flex justify-between"><span className="text-xs text-muted-foreground">연락처</span><span className="text-xs font-medium">{ins.phone || "—"}</span></div>
                              <div className="flex justify-between"><span className="text-xs text-muted-foreground">입사일</span><span className="text-xs font-medium">{ins.join_date || "—"}</span></div>
                              <div className="flex justify-between"><span className="text-xs text-muted-foreground">성별</span><span className="text-xs font-medium">{ins.gender || "—"}</span></div>
                              <div className="flex justify-between"><span className="text-xs text-muted-foreground">나이</span><span className="text-xs font-medium">{ins.age || "—"}</span></div>
                              <div className="flex justify-between"><span className="text-xs text-muted-foreground">최종학력</span><span className="text-xs font-medium">{ins.education || "—"}</span></div>
                              <div className="flex justify-between"><span className="text-xs text-muted-foreground">비고</span><span className="text-xs font-medium">{ins.bio_notes || "—"}</span></div>
                              <div className="flex justify-between"><span className="text-xs text-muted-foreground">미팅 링크</span><span className="text-xs font-medium truncate max-w-[180px]">{ins.meet_link ? <a href={ins.meet_link} target="_blank" rel="noopener noreferrer" className="text-navy underline">{ins.meet_link}</a> : "—"}</span></div>
                              <div className="flex justify-between"><span className="text-xs text-muted-foreground">계정</span><span className={`text-xs font-medium ${ins.user_id ? "text-success" : "text-muted-foreground"}`}>{ins.user_id ? "연결됨" : "미연결"}</span></div>
                              {ins.user_id && (
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Staff 권한</span>
                                  <button
                                    onClick={() => toggleStaffRole(ins)}
                                    disabled={togglingStaff === ins.id}
                                    className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                                  >
                                    {togglingStaff === ins.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : staffUserIds.has(ins.user_id!) ? (
                                      <><ToggleRight className="w-5 h-5 text-success" /><span className="text-success">부여됨</span></>
                                    ) : (
                                      <><ToggleLeft className="w-5 h-5 text-muted-foreground" /><span className="text-muted-foreground">미부여</span></>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleActive(ins)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {ins.active ? (
                        <ToggleRight className="w-5 h-5 text-success" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                      )}
                      {ins.active ? "활성 상태 (비활성으로 전환)" : "비활성 상태 (활성으로 전환)"}
                    </button>
                    {ins.active && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-7 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
                        onClick={() => { setDeactivateTarget(ins); setDeactivateReason(""); }}
                      >
                        <UserX className="w-3 h-3" />
                        퇴사 처리
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))}
          </div>
        );
      })}

      {/* Add Instructor Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">강사 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">이름 *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="장리원"
                  className="h-9"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">영어이름 *</Label>
                <Input
                  value={form.englishName}
                  onChange={(e) => setForm((f) => ({ ...f, englishName: e.target.value }))}
                  placeholder="Reina"
                  className="h-9"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">입사일</Label>
                <Input
                  type="date"
                  value={form.joinDate}
                  onChange={(e) => setForm((f) => ({ ...f, joinDate: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">
                강사 정보를 먼저 등록한 후, 강사가 <strong>회원가입</strong>하면 가입 승인 탭에서 계정을 연결할 수 있습니다.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-navy hover:bg-navy-light text-primary-foreground gap-2"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                강사 추가
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                disabled={creating}
              >
                취소
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivation reason dialog */}
      <Dialog open={!!deactivateTarget} onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-destructive" />
              퇴사 처리
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{deactivateTarget?.name}</span> 강사를 퇴사 처리합니다.
          </p>
          <div className="space-y-2">
            <Label className="text-xs">퇴사 사유 (선택)</Label>
            <Textarea
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              placeholder="퇴사 사유를 입력하세요..."
              className="h-20 text-sm resize-none"
              maxLength={500}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeactivateTarget(null)}>취소</Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={deactivating}
              className="gap-1.5"
              onClick={async () => {
                if (!deactivateTarget) return;
                setDeactivating(true);
                const { error } = await supabase.from("instructors").update({
                  active: false,
                  deactivation_reason: deactivateReason.trim() || null,
                }).eq("id", deactivateTarget.id);
                if (error) {
                  toast({ title: "퇴사 처리 실패", description: error.message, variant: "destructive" });
                } else {
                  setInstructors(prev => prev.map(i => i.id === deactivateTarget.id ? { ...i, active: false } : i));
                  toast({ title: `${deactivateTarget.name} 강사 퇴사 처리 완료` });
                }
                setDeactivating(false);
                setDeactivateTarget(null);
                setDeactivateReason("");
              }}
            >
              {deactivating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              퇴사 처리
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
