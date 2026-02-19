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

interface Instructor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  active: boolean;
  lesson_rate: number;
  meeting_rate: number;
  user_id: string | null;
}

interface NewInstructorForm {
  name: string;
  email: string;
  password: string;
  phone: string;
  lessonRate: number;
  meetingRate: number;
}

export default function InstructorManagement() {
  const { toast } = useToast();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRates, setEditRates] = useState({ lesson_rate: 0, meeting_rate: 0 });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewInstructorForm>({
    name: "",
    email: "",
    password: "",
    phone: "",
    lessonRate: 30000,
    meetingRate: 20000,
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
    setEditRates({ lesson_rate: ins.lesson_rate, meeting_rate: ins.meeting_rate });
  };

  const saveEdit = async (id: string) => {
    setSavingId(id);
    const { error } = await supabase
      .from("instructors")
      .update({ lesson_rate: editRates.lesson_rate, meeting_rate: editRates.meeting_rate })
      .eq("id", id);

    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    } else {
      setInstructors((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...editRates } : i))
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
          lessonRate: form.lessonRate,
          meetingRate: form.meetingRate,
        }),
      }
    );

    const result = await res.json();
    if (!res.ok || result.error) {
      toast({ title: "강사 생성 실패", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "강사 계정 생성 완료", description: `${form.name} 강사가 추가되었습니다.` });
      setShowAddModal(false);
      setForm({ name: "", email: "", password: "", phone: "", lessonRate: 30000, meetingRate: 20000 });
      fetchInstructors();
    }
    setCreating(false);
  };

  const activeCount = instructors.filter((i) => i.active).length;

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
          >
            <Download className="w-4 h-4" />
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

              <div className="hidden md:flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="font-semibold text-foreground">₩{ins.lesson_rate.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">수업 시급</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">₩{ins.meeting_rate.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">미팅 시급</p>
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
                  {/* Rate settings */}
                  <div className="p-4 rounded-lg bg-card border border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-3">💰 시급 설정</h4>
                    {editingId === ins.id ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">수업 시급 (원/시간)</Label>
                          <Input
                            type="number"
                            value={editRates.lesson_rate}
                            onChange={(e) =>
                              setEditRates((r) => ({ ...r, lesson_rate: Number(e.target.value) }))
                            }
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">미팅 시급 (원/시간)</Label>
                          <Input
                            type="number"
                            value={editRates.meeting_rate}
                            onChange={(e) =>
                              setEditRates((r) => ({ ...r, meeting_rate: Number(e.target.value) }))
                            }
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(ins.id)}
                            disabled={savingId === ins.id}
                            className="bg-navy text-primary-foreground hover:bg-navy-light h-7 text-xs"
                          >
                            {savingId === ins.id && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                            저장
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-7 text-xs">
                            취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">수업 시급</span>
                          <span className="text-sm font-semibold text-foreground">₩{ins.lesson_rate.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">미팅 시급</span>
                          <span className="text-sm font-semibold text-foreground">₩{ins.meeting_rate.toLocaleString()}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2 h-7 text-xs gap-1.5"
                          onClick={() => startEdit(ins)}
                        >
                          <Edit2 className="w-3 h-3" /> 수정
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Contact info */}
                  <div className="p-4 rounded-lg bg-card border border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-3">📋 연락처 정보</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">이메일</span>
                        <span className="text-xs font-medium">{ins.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">전화번호</span>
                        <span className="text-xs font-medium">{ins.phone || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">로그인 계정</span>
                        <span className={`text-xs font-medium ${ins.user_id ? "text-success" : "text-muted-foreground"}`}>
                          {ins.user_id ? "연결됨" : "미연결"}
                        </span>
                      </div>
                    </div>
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
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">수업 시급 (원)</Label>
                <Input
                  type="number"
                  value={form.lessonRate}
                  onChange={(e) => setForm((f) => ({ ...f, lessonRate: Number(e.target.value) }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">미팅 시급 (원)</Label>
                <Input
                  type="number"
                  value={form.meetingRate}
                  onChange={(e) => setForm((f) => ({ ...f, meetingRate: Number(e.target.value) }))}
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
