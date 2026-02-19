import { useState, useEffect } from "react";
import { Calendar, Plus, Trash2, Save, Info, BanIcon, Bell, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PeriodSetting {
  id: number;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

interface HolidayNotice {
  id: string;
  title: string;
  date_start: string;
  date_end: string;
  reason: string | null;
  notify_students: boolean;
  created_at: string;
}

const mockPeriods: PeriodSetting[] = [
  { id: 1, year: 2026, month: 1, startDate: "2026-01-02", endDate: "2026-02-05" },
  { id: 2, year: 2026, month: 2, startDate: "2026-02-06", endDate: "2026-03-06" },
  { id: 3, year: 2026, month: 3, startDate: "2026-03-07", endDate: "2026-04-08" },
];

const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateKo(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS_KO[d.getDay()]})`;
}

export default function SystemSettings() {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<PeriodSetting[]>(mockPeriods);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editVals, setEditVals] = useState({ startDate: "", endDate: "" });
  const [saved, setSaved] = useState(false);

  // Holiday notices
  const [notices, setNotices] = useState<HolidayNotice[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(true);
  const [addingNotice, setAddingNotice] = useState(false);
  const [newNotice, setNewNotice] = useState({
    title: "",
    date_start: "",
    date_end: "",
    reason: "",
    notify_students: true,
  });
  const [savingNotice, setSavingNotice] = useState(false);

  useEffect(() => {
    loadNotices();
  }, []);

  const loadNotices = async () => {
    setLoadingNotices(true);
    const { data } = await supabase
      .from("holiday_notices")
      .select("*")
      .order("date_start", { ascending: true });
    setNotices(data || []);
    setLoadingNotices(false);
  };

  const saveNotice = async () => {
    if (!newNotice.title || !newNotice.date_start || !newNotice.date_end) return;
    setSavingNotice(true);
    const { error } = await supabase.from("holiday_notices").insert({
      title: newNotice.title.trim(),
      date_start: newNotice.date_start,
      date_end: newNotice.date_end,
      reason: newNotice.reason.trim() || null,
      notify_students: newNotice.notify_students,
    });
    if (!error) {
      toast({ title: "휴강 공지가 등록되었습니다 ✓" });
      setNewNotice({ title: "", date_start: "", date_end: "", reason: "", notify_students: true });
      setAddingNotice(false);
      await loadNotices();
    } else {
      toast({ title: "등록 실패", description: error.message, variant: "destructive" });
    }
    setSavingNotice(false);
  };

  const deleteNotice = async (id: string) => {
    const { error } = await supabase.from("holiday_notices").delete().eq("id", id);
    if (!error) {
      setNotices((prev) => prev.filter((n) => n.id !== id));
      toast({ title: "삭제되었습니다" });
    }
  };

  const toggleNotify = async (notice: HolidayNotice) => {
    const { error } = await supabase
      .from("holiday_notices")
      .update({ notify_students: !notice.notify_students })
      .eq("id", notice.id);
    if (!error) {
      setNotices((prev) =>
        prev.map((n) => n.id === notice.id ? { ...n, notify_students: !n.notify_students } : n)
      );
    }
  };

  // Period editing
  const startEdit = (p: PeriodSetting) => {
    setEditingId(p.id);
    setEditVals({ startDate: p.startDate, endDate: p.endDate });
  };

  const savePeriod = (id: number) => {
    setPeriods((prev) => prev.map((p) => (p.id === id ? { ...p, ...editVals } : p)));
    setEditingId(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const deletePeriod = (id: number) => {
    setPeriods((prev) => prev.filter((p) => p.id !== id));
  };

  const addPeriod = () => {
    const last = periods[periods.length - 1];
    const nextMonth = last ? (last.month === 12 ? 1 : last.month + 1) : new Date().getMonth() + 1;
    const nextYear = last && last.month === 12 ? last.year + 1 : (last?.year || new Date().getFullYear());
    const newId = Date.now();
    setPeriods((prev) => [
      ...prev,
      { id: newId, year: nextYear, month: nextMonth, startDate: "", endDate: "" },
    ]);
    setEditingId(newId);
    setEditVals({ startDate: "", endDate: "" });
  };

  // Upcoming vs past notices
  const today = new Date().toISOString().slice(0, 10);
  const upcomingNotices = notices.filter((n) => n.date_end >= today);
  const pastNotices = notices.filter((n) => n.date_end < today);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">기본 설정</h1>
        <p className="text-muted-foreground text-sm mt-1">수업 기간 및 시스템 설정 관리</p>
      </div>

      {/* Period settings */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gold" />
              수업 기간 설정
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={addPeriod}>
              <Plus className="w-3 h-3" />
              기간 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-navy/5 border border-navy/10">
            <Info className="w-4 h-4 text-navy flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-navy">가변적 수업 기간이란?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                매월 수업 기간이 다를 수 있습니다. 예를 들어 2026년 2월 수업 기간은 2/6 ~ 3/6으로 설정할 수 있습니다.
                이 기간을 기준으로 수업 횟수 집계 및 정산이 이루어집니다.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {periods.map((period) => (
              <div key={period.id} className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-navy text-primary-foreground flex items-center justify-center">
                      <span className="text-xs font-bold">{monthNames[period.month - 1].replace("월", "")}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {period.year}년 {monthNames[period.month - 1]} 수업 기간
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {editingId !== period.id && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => startEdit(period)}>
                        수정
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deletePeriod(period.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {editingId === period.id ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">시작일</Label>
                      <Input type="date" value={editVals.startDate} onChange={(e) => setEditVals((v) => ({ ...v, startDate: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">종료일</Label>
                      <Input type="date" value={editVals.endDate} onChange={(e) => setEditVals((v) => ({ ...v, endDate: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="col-span-2 flex gap-2">
                      <Button size="sm" className="h-7 text-xs bg-navy hover:bg-navy-light text-primary-foreground gap-1.5" onClick={() => savePeriod(period.id)}>
                        <Save className="w-3 h-3" />저장
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>취소</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground text-xs">시작</span>
                      <span className="font-medium text-foreground text-sm">{period.startDate || "미설정"}</span>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground text-xs">종료</span>
                      <span className="font-medium text-foreground text-sm">{period.endDate || "미설정"}</span>
                    </div>
                    {period.startDate && period.endDate && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {Math.ceil((new Date(period.endDate).getTime() - new Date(period.startDate).getTime()) / (1000 * 60 * 60 * 24))}일
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {saved && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20">
              <p className="text-xs text-success font-medium">✓ 저장되었습니다.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Holiday / Closure Settings */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BanIcon className="w-4 h-4 text-destructive" />
              휴일 및 휴강 관리
            </CardTitle>
            {!addingNotice && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/5"
                onClick={() => setAddingNotice(true)}
              >
                <Plus className="w-3 h-3" />
                휴강 추가
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* 정기휴일 안내 */}
          <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <BanIcon className="w-4 h-4 text-destructive" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">매주 화요일 — 정기 휴일</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">고정</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">매주 화요일은 수업이 없는 정기 휴일입니다. 수업 스케줄에 자동으로 반영됩니다.</p>
            </div>
          </div>

          {/* 새 휴강 추가 폼 */}
          {addingNotice && (
            <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5 space-y-3">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                새 휴강 / 연휴 등록
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">제목</Label>
                <Input
                  placeholder="예: 설 연휴 휴강, 강사 개인 사정 휴강"
                  className="h-8 text-sm"
                  value={newNotice.title}
                  onChange={(e) => setNewNotice((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">시작일</Label>
                  <Input
                    type="date"
                    className="h-8 text-sm"
                    value={newNotice.date_start}
                    onChange={(e) => setNewNotice((p) => ({ ...p, date_start: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">종료일</Label>
                  <Input
                    type="date"
                    className="h-8 text-sm"
                    value={newNotice.date_end}
                    onChange={(e) => setNewNotice((p) => ({ ...p, date_end: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">사유 (선택)</Label>
                <Input
                  placeholder="예: 설날 연휴"
                  className="h-8 text-sm"
                  value={newNotice.reason}
                  onChange={(e) => setNewNotice((p) => ({ ...p, reason: e.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-navy" />
                  <div>
                    <p className="text-xs font-medium text-foreground">수강생 팝업 공지 발송</p>
                    <p className="text-[10px] text-muted-foreground">수강생 대시보드 접속 시 팝업으로 공지됩니다</p>
                  </div>
                </div>
                <Switch
                  checked={newNotice.notify_students}
                  onCheckedChange={(v) => setNewNotice((p) => ({ ...p, notify_students: v }))}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-8 text-xs bg-navy hover:bg-navy-light text-primary-foreground gap-1.5"
                  disabled={!newNotice.title || !newNotice.date_start || !newNotice.date_end || savingNotice}
                  onClick={saveNotice}
                >
                  <Save className="w-3 h-3" />
                  {savingNotice ? "저장 중..." : "등록하기"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => { setAddingNotice(false); setNewNotice({ title: "", date_start: "", date_end: "", reason: "", notify_students: true }); }}
                >
                  취소
                </Button>
              </div>
            </div>
          )}

          {/* 예정된 / 활성 휴강 목록 */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">예정 및 진행중</p>
            {loadingNotices ? (
              <p className="text-xs text-muted-foreground py-2">불러오는 중...</p>
            ) : upcomingNotices.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <BanIcon className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p className="text-xs">예정된 휴강이 없습니다</p>
              </div>
            ) : (
              upcomingNotices.map((notice) => (
                <NoticeRow key={notice.id} notice={notice} onDelete={deleteNotice} onToggleNotify={toggleNotify} formatDateKo={formatDateKo} />
              ))
            )}
          </div>

          {/* 지난 휴강 */}
          {pastNotices.length > 0 && (
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
                지난 휴강 {pastNotices.length}건 보기
              </summary>
              <div className="mt-2 space-y-2">
                {pastNotices.map((notice) => (
                  <NoticeRow key={notice.id} notice={notice} onDelete={deleteNotice} onToggleNotify={toggleNotify} formatDateKo={formatDateKo} past />
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {/* More settings */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">추가 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">비즈니스 이름</Label>
              <Input defaultValue="The Lounge English" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">관리자 이메일</Label>
              <Input defaultValue="admin@loungeenglish.com" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">퇴원 후 자료 비공개 기간 (일)</Label>
              <Input type="number" defaultValue={3} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">숙제 리마인더 발송 시간 (시간)</Label>
              <Input type="number" defaultValue={48} className="h-9" />
            </div>
          </div>
          <Button className="mt-4 bg-navy hover:bg-navy-light text-primary-foreground gap-2">
            <Save className="w-4 h-4" />
            설정 저장
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NoticeRow({
  notice,
  onDelete,
  onToggleNotify,
  formatDateKo,
  past = false,
}: {
  notice: HolidayNotice;
  onDelete: (id: string) => void;
  onToggleNotify: (notice: HolidayNotice) => void;
  formatDateKo: (d: string) => string;
  past?: boolean;
}) {
  const isSingleDay = notice.date_start === notice.date_end;
  return (
    <div className={`p-3 rounded-lg border flex items-start gap-3 ${past ? "border-border bg-muted/20 opacity-60" : "border-destructive/20 bg-destructive/5"}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${past ? "bg-muted" : "bg-destructive/10"}`}>
        <BanIcon className={`w-4 h-4 ${past ? "text-muted-foreground" : "text-destructive"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{notice.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isSingleDay ? formatDateKo(notice.date_start) : `${formatDateKo(notice.date_start)} ~ ${formatDateKo(notice.date_end)}`}
        </p>
        {notice.reason && <p className="text-xs text-muted-foreground">{notice.reason}</p>}
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => onToggleNotify(notice)}
            className="flex items-center gap-1.5 text-[10px] font-medium"
          >
            {notice.notify_students ? (
              <><Bell className="w-3 h-3 text-navy" /><span className="text-navy">수강생 공지 ON</span></>
            ) : (
              <><Bell className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">수강생 공지 OFF</span></>
            )}
          </button>
        </div>
      </div>
      <button
        onClick={() => onDelete(notice.id)}
        className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
