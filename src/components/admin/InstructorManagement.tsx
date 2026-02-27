import { useState, useEffect } from "react";
import { Download, Plus, ChevronDown, ChevronUp, Edit2, ToggleLeft, ToggleRight, Loader2, X, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportAllSettlementsPdf } from "@/lib/exportSettlementPdf";

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
  email: string;
  password: string;
  phone: string;
}

export default function InstructorManagement() {
  const { toast } = useToast();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ phone: "", join_date: "", gender: "", age: "", education: "", bio_notes: "", meet_link: "", position: "강사", lesson_rate: "30000" });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [form, setForm] = useState<NewInstructorForm>({
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  useEffect(() => {
    fetchInstructors();
  }, []);

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
    if (!form.name || !form.email || !form.password) {
      toast({ title: "이름, 이메일, 비밀번호는 필수입니다.", variant: "destructive" });
      return;
    }
    setCreating(true);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-instructor`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
        }),
      }
    );

    const result = await res.json();
    if (!res.ok || result.error) {
      toast({ title: "강사 생성 실패", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "강사 계정 생성 완료", description: `${form.name} 강사가 추가되었습니다.` });
      setShowAddModal(false);
      setForm({ name: "", email: "", password: "", phone: "" });
      fetchInstructors();
    }
    setCreating(false);
  };

  const activeCount = instructors.filter((i) => i.active).length;

  const handleDownloadSettlement = async () => {
    setDownloadingPdf(true);
    try {
      // Get current period
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data: periods } = await supabase
        .from("schedule_periods").select("*").eq("is_active", true).order("start_date", { ascending: true });
      const period = (periods || []).find(p => p.start_date <= todayStr && p.end_date >= todayStr) || (periods || [])[0];
      if (!period) {
        toast({ title: "활성 기간이 없습니다", variant: "destructive" });
        setDownloadingPdf(false);
        return;
      }

      // Fetch sessions & meetings for all active instructors
      const activeInstructors = instructors.filter(i => i.active);
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
        label: period.label,
        start_date: period.start_date,
        end_date: period.end_date,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">강사 관리</h1>
          <p className="text-muted-foreground text-sm mt-1">담당 강사 프로필 및 정산 설정</p>
        </div>
        <div className="flex gap-2">
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

      {/* Instructor List */}
      <div className="space-y-3">
        {instructors.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            등록된 강사가 없습니다. 강사 추가 버튼을 눌러 첫 번째 강사를 등록하세요.
          </div>
        )}
        {instructors.map((ins) => (
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

              <div className="hidden md:flex items-center gap-4 text-sm">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Salary info */}
                  <div className="p-4 rounded-lg bg-card border border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-3">💰 급여 체계</h4>
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

                  {/* Personal info */}
                  <div className="p-4 rounded-lg bg-card border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-foreground">📋 강사 정보</h4>
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
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs border-gold text-gold-dark hover:bg-gold/8"
                  >
                    <Download className="w-3 h-3" />
                    개인 정산서
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Add Instructor Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">강사 계정 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">이름 *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="홍길동"
                  className="h-9"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">이메일 (로그인 ID) *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="instructor@example.com"
                  className="h-9"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">초기 비밀번호 *</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="최소 6자"
                    className="h-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">전화번호</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="h-9"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">
                강사 계정이 생성되면 해당 이메일과 비밀번호로 <strong>강사 포털</strong>에 로그인할 수 있습니다.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-navy hover:bg-navy-light text-primary-foreground gap-2"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                계정 생성
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
    </div>
  );
}
