import { useState } from "react";
import { format } from "date-fns";
import { Send, Bell, FileText, Users, GraduationCap, Plus, Trash2, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Template {
  id: number;
  name: string;
  content: string;
  type: "homework" | "note" | "general";
}

const mockTemplates: Template[] = [
  {
    id: 1,
    name: "숙제 미제출 리마인더",
    type: "homework",
    content:
      "안녕하세요, {{student_name}}님! 아직 숙제를 제출하지 않으셨습니다. 마감일은 {{deadline}}입니다. 빠른 시일 내에 제출 부탁드립니다 😊",
  },
  {
    id: 2,
    name: "수업 노트 업데이트 알림",
    type: "note",
    content:
      "안녕하세요, {{student_name}}님! {{date}} 수업 노트와 단어장이 업데이트되었습니다. 앱에서 확인해 보세요 📚",
  },
  {
    id: 3,
    name: "일반 공지",
    type: "general",
    content:
      "The Lounge English 회원 여러분께 공지사항을 안내드립니다. {{message}}",
  },
];

const typeLabel: Record<string, string> = {
  homework: "숙제",
  note: "노트",
  general: "일반",
};

const typeBadge: Record<string, string> = {
  homework: "bg-destructive/10 text-destructive",
  note: "bg-navy/10 text-navy",
  general: "bg-muted text-muted-foreground",
};

export default function MessageCenter() {
  const [templates, setTemplates] = useState<Template[]>(mockTemplates);
  const [autoNote, setAutoNote] = useState(true);
  const [autoHomework, setAutoHomework] = useState(true);
  const [broadcastTarget, setBroadcastTarget] = useState<"all" | "instructors" | "students">("all");
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastDate, setBroadcastDate] = useState<Date | undefined>(undefined);
  const [useSchedule, setUseSchedule] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">메시지 관리</h1>
        <p className="text-muted-foreground text-sm mt-1">자동 알림 설정 및 공지사항 발송</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Automation settings */}
        <Card className="shadow-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-gold" />
              자동 알림 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <div>
                <p className="text-sm font-medium text-foreground">수업 노트 업데이트 시 알림</p>
                <p className="text-xs text-muted-foreground mt-0.5">강사가 노트 저장 후 학생에게 자동 발송</p>
              </div>
              <Switch checked={autoNote} onCheckedChange={setAutoNote} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <div>
                <p className="text-sm font-medium text-foreground">숙제 미제출 리마인더</p>
                <p className="text-xs text-muted-foreground mt-0.5">수업 후 48시간 미제출 시 자동 발송</p>
              </div>
              <Switch checked={autoHomework} onCheckedChange={setAutoHomework} />
            </div>
            {autoNote && (
              <div className="p-3 rounded-lg bg-success/8 border border-success/20">
                <p className="text-xs text-success font-medium">✓ 노트 알림이 활성화되어 있습니다.</p>
              </div>
            )}
            {autoHomework && (
              <div className="p-3 rounded-lg bg-success/8 border border-success/20">
                <p className="text-xs text-success font-medium">✓ 숙제 리마인더가 활성화되어 있습니다.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Broadcast */}
        <Card className="shadow-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-gold" />
              공지사항 발송
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Target */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">발송 대상</Label>
              <div className="flex gap-2">
                {[
                  { value: "all", label: "전체", icon: Users },
                  { value: "instructors", label: "강사만", icon: Users },
                  { value: "students", label: "학생만", icon: GraduationCap },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setBroadcastTarget(value as typeof broadcastTarget)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      broadcastTarget === value
                        ? "border-navy bg-navy text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-navy/40"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">제목</Label>
              <Input
                placeholder="공지 제목을 입력하세요"
                value={broadcastSubject}
                onChange={(e) => setBroadcastSubject(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">내용</Label>
              <Textarea
                placeholder="공지 내용을 입력하세요..."
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                className="resize-none h-24 text-sm"
              />
            </div>
            {/* Schedule */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">발송 예약</Label>
                <Switch checked={useSchedule} onCheckedChange={setUseSchedule} />
              </div>
              {useSchedule && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-9",
                        !broadcastDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {broadcastDate ? format(broadcastDate, "yyyy년 MM월 dd일") : "발송 날짜 선택"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={broadcastDate}
                      onSelect={setBroadcastDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <Button
              className="w-full bg-navy hover:bg-navy-light text-primary-foreground gap-2"
              disabled={!broadcastSubject || !broadcastBody || (useSchedule && !broadcastDate)}
            >
              <Send className="w-4 h-4" />
              {useSchedule && broadcastDate
                ? `${format(broadcastDate, "MM/dd")} 예약 발송`
                : "즉시 발송하기"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Message Templates */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-gold" />
              메시지 템플릿 관리
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
              <Plus className="w-3 h-3" />
              템플릿 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadge[tmpl.type]}`}>
                    {typeLabel[tmpl.type]}
                  </span>
                  <p className="text-sm font-semibold text-foreground">{tmpl.name}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setEditingTemplate(tmpl)}
                  >
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    onClick={() => setTemplates((prev) => prev.filter((t) => t.id !== tmpl.id))}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{tmpl.content}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
