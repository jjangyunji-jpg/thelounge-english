import { useState } from "react";
import { Calendar, Plus, Trash2, Save, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface PeriodSetting {
  id: number;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

const mockPeriods: PeriodSetting[] = [
  { id: 1, year: 2026, month: 1, startDate: "2026-01-02", endDate: "2026-02-05" },
  { id: 2, year: 2026, month: 2, startDate: "2026-02-06", endDate: "2026-03-06" },
  { id: 3, year: 2026, month: 3, startDate: "2026-03-07", endDate: "2026-04-08" },
];

const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

export default function SystemSettings() {
  const [periods, setPeriods] = useState<PeriodSetting[]>(mockPeriods);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editVals, setEditVals] = useState({ startDate: "", endDate: "" });
  const [saved, setSaved] = useState(false);

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
    setPeriods((prev) => [
      ...prev,
      {
        id: Date.now(),
        year: nextYear,
        month: nextMonth,
        startDate: "",
        endDate: "",
      },
    ]);
    setEditingId(Date.now());
    setEditVals({ startDate: "", endDate: "" });
  };

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
          {/* Info banner */}
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

          {/* Period list */}
          <div className="space-y-3">
            {periods.map((period) => (
              <div key={period.id} className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-navy text-primary-foreground flex items-center justify-center">
                      <span className="text-xs font-bold">{monthNames[period.month - 1].replace("월", "")}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {period.year}년 {monthNames[period.month - 1]} 수업 기간
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {editingId !== period.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => startEdit(period)}
                      >
                        수정
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => deletePeriod(period.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {editingId === period.id ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">시작일</Label>
                      <Input
                        type="date"
                        value={editVals.startDate}
                        onChange={(e) => setEditVals((v) => ({ ...v, startDate: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">종료일</Label>
                      <Input
                        type="date"
                        value={editVals.endDate}
                        onChange={(e) => setEditVals((v) => ({ ...v, endDate: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-2 flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-navy hover:bg-navy-light text-primary-foreground gap-1.5"
                        onClick={() => savePeriod(period.id)}
                      >
                        <Save className="w-3 h-3" />
                        저장
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setEditingId(null)}
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground text-xs">시작</span>
                      <span className="font-medium text-foreground text-sm">
                        {period.startDate || "미설정"}
                      </span>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground text-xs">종료</span>
                      <span className="font-medium text-foreground text-sm">
                        {period.endDate || "미설정"}
                      </span>
                    </div>
                    {period.startDate && period.endDate && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {Math.ceil(
                          (new Date(period.endDate).getTime() - new Date(period.startDate).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )}일
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

      {/* More settings placeholder */}
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
