import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Users, AlertCircle, Video, Plus, LogOut,
  Calendar, Clock, ChevronRight, Check, X, Loader2,
  TrendingUp, Banknote, Coffee, FileText, ChevronLeft,
  GraduationCap, ClipboardCheck, Settings2, CalendarDays,
  PenLine, Mic, Brain, Edit2, Trash2, RefreshCw, ArrowRight,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Instructor {
  id: string;
  name: string;
  email: string;
  lesson_rate: number;
  meeting_rate: number;
  meet_link: string | null;
  position: string;
  active: boolean;
}

interface StudentFull {
  id: string;
  student_name: string;
  level: string | null;
  schedules: string | null;
  meet_link: string | null;
  phone: string | null;
  status: string | null;
  lesson_goal: string | null;
  lesson_goal_count: number | null;
  extra_lessons: number | null;
  start_date: string | null;
  instructor_id: string;
  instructor_name: string | null;
}

interface ClassSession {
  id: string;
  scheduled_at: string;
  topic: string | null;
  level: string;
  student_name: string;
  instructor_name: string;
  meet_link: string | null;
  started_at: string | null;
  ended_at: string | null;
}

interface HomeworkAssignment {
  id: string;
  title: string;
  student_name: string;
}

interface HomeworkSubmission {
  id: string;
  assignment_id: string | null;
  status: string;
  student_name: string;
  submitted_at: string;
}

interface BusinessMeeting {
  id: string;
  instructor_id: string;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
}

interface VocabTest {
  id: string;
  student_name: string;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  total: number | null;
}

interface SchedulePeriod {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const DAYS_OF_WEEK = ["월", "화", "수", "목", "금", "토", "일"];
const HOURS = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6;
  return `${h.toString().padStart(2, "0")}:00`;
});

type HwType = "writing" | "reading" | "speaking" | "memorizing";
const HW_TYPE_META: Record<HwType, { label: string; icon: React.ElementType; color: string }> = {
  writing:    { label: "쓰기",   icon: PenLine,  color: "text-[hsl(var(--navy))]" },
  reading:    { label: "읽기",   icon: BookOpen, color: "text-[hsl(var(--gold-dark))]" },
  speaking:   { label: "말하기", icon: Mic,      color: "text-[hsl(var(--success))]" },
  memorizing: { label: "외우기", icon: Brain,    color: "text-purple-500" },
};

interface ScheduleSlot { day: string; time: string; }
interface PresetHw { id: string; type: HwType; title: string; description: string; }

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
}
function msUntil(iso: string) { return new Date(iso).getTime() - Date.now(); }
function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function fmtSchedules(raw: string | null): string {
  if (!raw) return "";
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return "";
    return arr.map((s: { day: string; time: string }) => `${s.day} ${s.time}`).join(", ");
  } catch { return raw; }
}

function fmtGoals(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [raw];
  } catch { return raw ? [raw] : []; }
}

// ── Donut Chart Component ─────────────────────────────────────────────────────
function DonutStat({
  value,
  total,
  label,
  unit,
  color,
  trackColor,
  isCount = false,
}: {
  value: number;
  total: number;
  label: string;
  unit: string;
  color: string;
  trackColor: string;
  isCount?: boolean;
}) {
  const size = 52;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = isCount ? (value > 0 ? 1 : 0) : total > 0 ? Math.min(value / total, 1) : 0;
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="text-center -mt-[38px] mb-2">
        <p className="text-[11px] font-bold text-foreground leading-none">
          {isCount ? `${value}${unit}` : `${value}/${total}`}
        </p>
      </div>
      <p className="text-[9px] text-muted-foreground leading-none">{label}</p>
    </div>
  );
}

// ── helpers: generate virtual schedule entries from recurring student schedules
const DAY_MAP: Record<string, number> = { "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6 };

interface VirtualSchedule {
  student_name: string;
  time: string;
  meet_link: string | null;
  level: string | null;
}

function buildHolidaySet(holidays: { date_start: string; date_end: string }[]): Set<string> {
  const set = new Set<string>();
  for (const h of holidays) {
    const start = new Date(h.date_start + "T00:00:00");
    const end = new Date(h.date_end + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      set.add(d.toISOString().slice(0, 10));
    }
  }
  return set;
}

function buildVirtualSchedules(students: StudentFull[], year: number, month: number, holidaySet: Set<string>): Map<string, VirtualSchedule[]> {
  const map = new Map<string, VirtualSchedule[]>();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  students.forEach((st) => {
    if (st.status !== "active" || !st.schedules) return;
    let slots: ScheduleSlot[] = [];
    try { slots = JSON.parse(st.schedules); } catch { return; }
    if (!Array.isArray(slots)) return;
    slots.forEach((slot) => {
      const targetDay = DAY_MAP[slot.day];
      if (targetDay === undefined) return;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        if (date.getDay() !== targetDay) continue;
        // Skip Tuesdays (정기 휴일)
        if (date.getDay() === 2) continue;
        // Skip holidays
        const dateStr2 = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (holidaySet.has(dateStr2)) continue;

        const key = date.toDateString();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ student_name: st.student_name, time: slot.time, meet_link: st.meet_link, level: st.level });
      }
    });
  });
  return map;
}

// ── Big Calendar ──────────────────────────────────────────────────────────────
function BigCalendar({
  sessions,
  meetings,
  students,
  holidays,
  selectedDate,
  onSelectDate,
}: {
  sessions: ClassSession[];
  meetings: BusinessMeeting[];
  students: StudentFull[];
  holidays: { date_start: string; date_end: string }[];
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
}) {
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Group sessions by date
  const sessionsByDate = new Map<string, ClassSession[]>();
  sessions.forEach((s) => {
    const key = new Date(s.scheduled_at).toDateString();
    if (!sessionsByDate.has(key)) sessionsByDate.set(key, []);
    sessionsByDate.get(key)!.push(s);
  });
  const meetingsByDate = new Map<string, BusinessMeeting[]>();
  meetings.forEach((m) => {
    const key = new Date(m.scheduled_at).toDateString();
    if (!meetingsByDate.has(key)) meetingsByDate.set(key, []);
    meetingsByDate.get(key)!.push(m);
  });

  // Virtual (recurring) schedules
  const holidaySet = buildHolidaySet(holidays);
  const virtualByDate = buildVirtualSchedules(students, year, month, holidaySet);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-base font-bold text-foreground min-w-[120px] text-center">{year}년 {month + 1}월</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <button onClick={() => setViewDate(new Date())} className="text-xs text-navy hover:underline font-medium">오늘</button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <div key={d} className={cn("text-xs font-semibold py-2", i === 0 ? "text-destructive/70" : i === 6 ? "text-blue-400" : "text-muted-foreground")}>{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} className="aspect-square" />;
          const date = new Date(year, month, day);
          const dateStr = date.toDateString();
          const daySessions = sessionsByDate.get(dateStr) || [];
          const dayMeetings = meetingsByDate.get(dateStr) || [];
          const dayVirtual = virtualByDate.get(dateStr) || [];
          const todayFlag = dateStr === new Date().toDateString();
          const isSelected = selectedDate && dateStr === selectedDate.toDateString();
          const dayOfWeek = date.getDay();

          // Merge: show actual sessions, then virtual ones not covered by actual sessions
          // Hide past virtual schedules with no actual session (rescheduled/cancelled)
          const actualStudents = new Set(daySessions.map(s => s.student_name));
          const isPast = date < new Date(new Date().toDateString());
          const unmatched = dayVirtual.filter(v => !actualStudents.has(v.student_name) && !isPast);

          // Combined entries for display (max 2)
          const displayItems: { label: string; type: "actual" | "virtual" | "meeting" }[] = [];
          daySessions.slice(0, 2).forEach(s => displayItems.push({
            label: `${new Date(s.scheduled_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} ${s.student_name}`,
            type: "actual",
          }));
          if (displayItems.length < 2) {
            unmatched.slice(0, 2 - displayItems.length).forEach(v => displayItems.push({
              label: `${v.time} ${v.student_name}`,
              type: "virtual",
            }));
          }
          const remaining = (daySessions.length + unmatched.length) - displayItems.filter(d => d.type !== "meeting").length;

          return (
            <button
              key={idx}
              onClick={() => onSelectDate(date)}
              className={cn(
                "min-h-[72px] flex flex-col items-start rounded-lg p-1 transition-all text-xs relative hover:bg-muted/50",
                todayFlag && "ring-2 ring-navy/50",
                isSelected && "bg-navy/10 ring-2 ring-navy",
              )}
            >
              <span className={cn(
                "text-[11px] font-medium mb-0.5",
                todayFlag ? "text-navy font-bold" : dayOfWeek === 0 ? "text-destructive/70" : dayOfWeek === 6 ? "text-blue-400" : "text-foreground",
              )}>
                {day}
              </span>
              <div className="w-full space-y-0.5 overflow-hidden">
                {displayItems.map((item, i) => (
                  <div key={i} className={cn(
                    "w-full truncate text-[9px] leading-tight px-1 py-0.5 rounded font-medium",
                    item.type === "actual" ? "bg-navy/10 text-navy" : "bg-navy/5 text-navy/60 border border-dashed border-navy/20",
                  )}>
                    {item.label}
                  </div>
                ))}
                {remaining > 0 && (
                  <span className="text-[8px] text-navy font-bold px-1">+{remaining}건</span>
                )}
                {dayMeetings.slice(0, 1).map((m, i) => (
                  <div key={`m${i}`} className="w-full truncate text-[9px] leading-tight px-1 py-0.5 rounded bg-gold/15 text-gold-dark font-medium">
                    {m.notes ? m.notes : "업무미팅"}
                  </div>
                ))}
                {dayMeetings.length > 1 && (
                  <span className="text-[8px] text-gold-dark font-bold px-1">+{dayMeetings.length - 1}건</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-navy" /> 수업 (완료/진행)
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-navy/30 border border-dashed border-navy/50" /> 예정 수업
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-gold" /> 업무미팅
        </div>
      </div>
    </div>
  );
}

// ── Add Meeting Modal ──────────────────────────────────────────────────────────
function AddMeetingModal({
  instructorId,
  position,
  allInstructors,
  onClose,
  onAdded,
}: {
  instructorId: string;
  position: string;
  allInstructors: { id: string; name: string }[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const canInvite = position === "대표" || position === "매니저";
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  const toggleInvite = (id: string) => {
    setInvitedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!date || !time) return;
    setSaving(true);
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    const { data: meeting, error } = await supabase.from("business_meetings").insert({
      instructor_id: instructorId,
      scheduled_at: scheduledAt,
      duration_minutes: duration,
      notes: notes.trim() || null,
    }).select().single();
    if (error || !meeting) {
      toast({ title: "저장 실패", description: error?.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    // Insert attendees
    if (invitedIds.size > 0) {
      const attendees = Array.from(invitedIds).map(iid => ({
        meeting_id: meeting.id,
        instructor_id: iid,
      }));
      await supabase.from("business_meeting_attendees").insert(attendees as any);
    }
    toast({ title: "업무 미팅 추가됨 ✓" });
    onAdded();
    onClose();
    setSaving(false);
  };

  const otherInstructors = allInstructors.filter(i => i.id !== instructorId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-foreground">업무 미팅 추가</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">날짜</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">시간</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">소요 시간 (분)</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={15} step={15} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">메모 (선택)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="미팅 내용..." className="h-9 text-sm" />
          </div>

          {/* Invite instructors - only for 대표/매니저 */}
          {canInvite && otherInstructors.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> 강사 초대 (선택)
              </Label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {otherInstructors.map(ins => (
                  <button
                    key={ins.id}
                    type="button"
                    onClick={() => toggleInvite(ins.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left",
                      invitedIds.has(ins.id)
                        ? "bg-navy/10 text-navy border border-navy/20"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                      invitedIds.has(ins.id) ? "bg-navy border-navy" : "border-muted-foreground/30"
                    )}>
                      {invitedIds.has(ins.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    {ins.name}
                  </button>
                ))}
              </div>
              {invitedIds.size > 0 && (
                <p className="text-[10px] text-muted-foreground">{invitedIds.size}명 초대됨</p>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm">취소</Button>
          <Button onClick={handleSave} disabled={saving || !date} className="flex-1 h-9 text-sm bg-navy hover:bg-navy-light text-primary-foreground gap-1.5">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} 저장
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Student Edit Modal ─────────────────────────────────────────────────────────
function StudentEditModal({
  student,
  onClose,
  onSaved,
}: {
  student: StudentFull;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [level, setLevel] = useState(student.level || "B1");
  const [meetLink, setMeetLink] = useState(student.meet_link || "");
  const [phone, setPhone] = useState(student.phone || "");
  const [status, setStatus] = useState(student.status || "active");
  const [saving, setSaving] = useState(false);

  // Lesson goals as list
  const [goals, setGoals] = useState<string[]>(() => {
    try {
      const parsed = student.lesson_goal ? JSON.parse(student.lesson_goal) : [];
      return Array.isArray(parsed) ? parsed : student.lesson_goal ? [student.lesson_goal] : [];
    } catch { return student.lesson_goal ? [student.lesson_goal] : []; }
  });
  const [newGoal, setNewGoal] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);

  // Schedule slots
  const [slots, setSlots] = useState<ScheduleSlot[]>(() => {
    try {
      const parsed = student.schedules ? JSON.parse(student.schedules) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  // Preset homework
  const [presets, setPresets] = useState<PresetHw[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [addingPreset, setAddingPreset] = useState(false);
  const [newPresetType, setNewPresetType] = useState<HwType>("writing");
  const [newPresetTitle, setNewPresetTitle] = useState("");
  const [newPresetDesc, setNewPresetDesc] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("homework_assignments")
        .select("*")
        .eq("student_name", student.student_name)
        .eq("is_preset", true)
        .order("created_at", { ascending: true });
      setPresets((data || []).map((d) => ({ id: d.id, type: d.type as HwType, title: d.title, description: d.description || "" })));
      setLoadingPresets(false);
    })();
  }, [student.student_name]);

  const addPreset = async () => {
    if (!newPresetTitle.trim()) return;
    setSavingPreset(true);
    const { data, error } = await supabase.from("homework_assignments").insert({
      student_name: student.student_name, title: newPresetTitle.trim(),
      description: newPresetDesc.trim() || null, type: newPresetType, is_preset: true,
    }).select().single();
    if (!error && data) {
      setPresets((p) => [...p, { id: data.id, type: newPresetType, title: newPresetTitle.trim(), description: newPresetDesc.trim() }]);
      toast({ title: "정기 숙제 추가 완료 ✓" });
    }
    setNewPresetTitle(""); setNewPresetDesc(""); setNewPresetType("writing");
    setAddingPreset(false); setSavingPreset(false);
  };

  const removePreset = async (hwId: string) => {
    await supabase.from("homework_assignments").delete().eq("id", hwId);
    setPresets((p) => p.filter((h) => h.id !== hwId));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("instructor_students").update({
      level, schedules: slots.length > 0 ? JSON.stringify(slots) : null,
      meet_link: meetLink.trim() || null,
      phone: phone.trim() || null, status,
      lesson_goal: goals.length > 0 ? JSON.stringify(goals) : null,
    }).eq("id", student.id);
    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "학생 정보 수정 완료 ✓" });
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-foreground">{student.student_name} — 학생 정보 수정</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">레벨</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">상태</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">수강 중</SelectItem>
                  <SelectItem value="paused">휴강</SelectItem>
                  <SelectItem value="graduated">수료</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Schedule slots with dropdowns */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> 수업 일정
              </Label>
              <button
                type="button"
                className="text-xs text-navy hover:underline flex items-center gap-1"
                onClick={() => setSlots((p) => [...p, { day: "월", time: "10:00" }])}
              >
                <Plus className="w-3 h-3" /> 추가
              </button>
            </div>
            {slots.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">수업 일정을 추가하세요</p>
            ) : (
              <div className="space-y-2">
                {slots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select value={slot.day} onValueChange={(v) => setSlots((p) => p.map((s, i) => i === idx ? { ...s, day: v } : s))}>
                      <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((d) => <SelectItem key={d} value={d}>{d}요일</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={slot.time} onValueChange={(v) => setSlots((p) => p.map((s, i) => i === idx ? { ...s, time: v } : s))}>
                      <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HOURS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => setSlots((p) => p.filter((_, i) => i !== idx))}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Google Meet 링크</Label>
            <Input value={meetLink} onChange={(e) => setMeetLink(e.target.value)} placeholder="https://meet.google.com/..." className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">연락처</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className="h-9 text-sm" />
          </div>
          {/* Learning Goals */}
          <div className="space-y-2 pt-1 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" /> 학습 목표
              </Label>
            </div>
            <div className="space-y-1.5">
              {goals.map((g, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-muted/20 group">
                  <span className="text-xs font-medium text-foreground flex-1">{g}</span>
                  <button onClick={() => setGoals((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            {addingGoal ? (
              <div className="flex gap-1.5">
                <Input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="예: 시제 마스터하기" className="h-8 text-xs flex-1" autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && newGoal.trim()) { setGoals((p) => [...p, newGoal.trim()]); setNewGoal(""); setAddingGoal(false); } }}
                />
                <Button size="sm" className="h-8 text-xs bg-navy hover:bg-navy-light text-primary-foreground"
                  disabled={!newGoal.trim()}
                  onClick={() => { setGoals((p) => [...p, newGoal.trim()]); setNewGoal(""); setAddingGoal(false); }}
                >추가</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setAddingGoal(false); setNewGoal(""); }}>취소</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-dashed w-full" onClick={() => setAddingGoal(true)}>
                <Plus className="w-3 h-3" /> 학습 목표 추가
              </Button>
            )}
          </div>

          {/* Preset Homework */}
          <div className="space-y-2 pt-1 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> 정기 숙제
              </Label>
            </div>
            {loadingPresets ? (
              <p className="text-xs text-muted-foreground">불러오는 중...</p>
            ) : (
              <div className="space-y-1.5">
                {presets.map((hw) => {
                  const meta = HW_TYPE_META[hw.type];
                  const Icon = meta?.icon;
                  return (
                    <div key={hw.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-muted/20 group">
                      {Icon && <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${meta.color}`} />}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-foreground">{hw.title}</span>
                        <span className={`text-[10px] ml-1.5 ${meta.color}`}>{meta.label}</span>
                      </div>
                      <button onClick={() => removePreset(hw.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {addingPreset ? (
              <div className="border border-[hsl(var(--gold)/0.4)] rounded-lg p-3 space-y-2 bg-[hsl(var(--gold)/0.04)]">
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(HW_TYPE_META) as HwType[]).map((t) => {
                    const m = HW_TYPE_META[t];
                    const TIcon = m.icon;
                    return (
                      <button key={t} onClick={() => setNewPresetType(t)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          newPresetType === t
                            ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.10)] text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-[hsl(var(--gold)/0.4)]"
                        }`}
                      >
                        <TIcon className={`w-3.5 h-3.5 ${newPresetType === t ? m.color : ""}`} />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                <Input value={newPresetTitle} onChange={(e) => setNewPresetTitle(e.target.value)} placeholder="숙제 제목 (필수)" className="h-8 text-xs" autoFocus />
                <Input value={newPresetDesc} onChange={(e) => setNewPresetDesc(e.target.value)} placeholder="상세 설명 (선택)" className="h-8 text-xs" />
                <div className="flex gap-1.5">
                  <Button size="sm" disabled={!newPresetTitle.trim() || savingPreset}
                    className="flex-1 h-7 text-xs bg-navy hover:bg-navy-light text-primary-foreground"
                    onClick={addPreset}
                  >
                    {savingPreset ? "저장 중..." : "추가"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAddingPreset(false); setNewPresetTitle(""); setNewPresetDesc(""); }}>취소</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-dashed w-full"
                onClick={() => { setAddingPreset(true); setNewPresetType("writing"); }}
              >
                <Plus className="w-3 h-3" /> 정기 숙제 추가
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm">취소</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 h-9 text-sm bg-navy hover:bg-navy-light text-primary-foreground gap-1.5">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} 저장
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Session Reschedule Modal ──────────────────────────────────────────────────
function RescheduleModal({
  session,
  onClose,
  onSaved,
}: {
  session: ClassSession;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const orig = new Date(session.scheduled_at);
  const [date, setDate] = useState(orig.toISOString().slice(0, 10));
  const [time, setTime] = useState(orig.toTimeString().slice(0, 5));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const newScheduled = new Date(`${date}T${time}:00`).toISOString();
    const { error } = await supabase.from("class_sessions").update({ scheduled_at: newScheduled }).eq("id", session.id);
    if (error) {
      toast({ title: "변경 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "수업 일정이 변경되었습니다 ✓" });
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-foreground">수업 일정 변경</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{session.student_name} · {fmtDateTime(session.scheduled_at)}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">날짜</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">시간</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm">취소</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 h-9 text-sm bg-navy hover:bg-navy-light text-primary-foreground gap-1.5">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} 변경
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function InstructorDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [students, setStudents] = useState<StudentFull[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [meetings, setMeetings] = useState<BusinessMeeting[]>([]);
  const [allInstructors, setAllInstructors] = useState<{ id: string; name: string }[]>([]);
  const [vocabTests, setVocabTests] = useState<VocabTest[]>([]);
  const [period, setPeriod] = useState<SchedulePeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<SchedulePeriod[]>([]);
  const [holidays, setHolidays] = useState<{ date_start: string; date_end: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "students" | "settlement">("dashboard");
  const [durationOverrides, setDurationOverrides] = useState<Record<string, number>>({});
  const [studentTabPeriodIdx, setStudentTabPeriodIdx] = useState(-1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [editStudent, setEditStudent] = useState<StudentFull | null>(null);
  const [rescheduleSession, setRescheduleSession] = useState<ClassSession | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setUser({ email: user.email ?? "" });

    // Check admin role
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");
    if (adminRole && adminRole.length > 0) setIsAdmin(true);

    const { data: ins } = await supabase
      .from("instructors").select("*").eq("email", user.email).maybeSingle();

    if (!ins) {
      toast({ title: "강사 계정을 찾을 수 없습니다", variant: "destructive" });
      setLoading(false);
      return;
    }
    setInstructor(ins);
    await loadData(ins);
  };

  const loadData = useCallback(async (ins: Instructor) => {
    setLoading(true);
    const [studRes, sessRes, hwRes, subRes, meetRes, periodRes, vocabRes, holRes, allInsRes, attendedRes] = await Promise.all([
      supabase.from("instructor_students").select("*").eq("instructor_id", ins.id),
      supabase.from("class_sessions").select("*").eq("instructor_name", ins.name).order("scheduled_at", { ascending: false }),
      supabase.from("homework_assignments").select("id,title,student_name"),
      supabase.from("homework_submissions").select("id,assignment_id,status,student_name,submitted_at"),
      supabase.from("business_meetings").select("*").eq("instructor_id", ins.id).order("scheduled_at", { ascending: false }),
      supabase.from("schedule_periods").select("*").eq("is_active", true).order("start_date", { ascending: true }),
      supabase.from("vocabulary_tests").select("id,student_name,started_at,completed_at,score,total"),
      supabase.from("holiday_notices").select("date_start,date_end"),
      supabase.from("instructors").select("id,name").eq("active", true),
      supabase.from("business_meeting_attendees").select("meeting_id,instructor_id").eq("instructor_id", ins.id) as any,
    ]);

    setStudents(studRes.data || []);
    setSessions(sessRes.data || []);
    setAssignments(hwRes.data || []);
    setSubmissions((subRes.data || []) as HomeworkSubmission[]);
    setAllInstructors((allInsRes.data || []) as { id: string; name: string }[]);

    // Merge own meetings + attended meetings (avoid duplicates)
    const ownMeetings = meetRes.data || [];
    const attendedMeetingIds = new Set((attendedRes.data || []).map((a: any) => a.meeting_id));
    const ownMeetingIds = new Set(ownMeetings.map(m => m.id));
    const missingIds = Array.from(attendedMeetingIds).filter(id => !ownMeetingIds.has(id as string));
    let allMeetings = [...ownMeetings];
    if (missingIds.length > 0) {
      const { data: extraMeetings } = await supabase
        .from("business_meetings")
        .select("*")
        .in("id", missingIds as string[]);
      if (extraMeetings) allMeetings = [...allMeetings, ...extraMeetings];
    }
    setMeetings(allMeetings);
    setVocabTests(vocabRes.data || []);
    // Pick the period that contains today
    const todayStr = new Date().toISOString().slice(0, 10);
    const periods = periodRes.data || [];
    setAllPeriods(periods);
    const currentIdx = periods.findIndex(p => p.start_date <= todayStr && p.end_date >= todayStr);
    const currentPeriod = currentIdx >= 0 ? periods[currentIdx] : periods[0] || null;
    setPeriod(currentPeriod);
    if (studentTabPeriodIdx < 0) setStudentTabPeriodIdx(currentIdx >= 0 ? currentIdx : 0);
    setHolidays(holRes.data || []);
    setLoading(false);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <p className="font-semibold text-foreground">강사 계정을 찾을 수 없습니다</p>
          <p className="text-sm text-muted-foreground">{user?.email} — 관리자에게 문의하세요</p>
          <Button variant="outline" onClick={handleLogout}>로그아웃</Button>
        </div>
      </div>
    );
  }

  // ── Derived stats ──
  const myStudentNames = new Set(students.map((s) => s.student_name));
  const todaySessions = sessions.filter((s) => isToday(s.scheduled_at));
  const upcomingSessions = sessions.filter((s) => msUntil(s.scheduled_at) > 0)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  // Next class day sessions (first future date that has sessions, excluding today)
  const nextClassDaySessions = (() => {
    const todayStr = new Date().toDateString();
    const futureSessions = sessions
      .filter((s) => {
        const d = new Date(s.scheduled_at);
        return d.toDateString() !== todayStr && d.getTime() > Date.now();
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    if (futureSessions.length === 0) return [];
    const nextDateStr = new Date(futureSessions[0].scheduled_at).toDateString();
    return futureSessions.filter((s) => new Date(s.scheduled_at).toDateString() === nextDateStr);
  })();

  const myAssignments = assignments.filter((a) => myStudentNames.has(a.student_name));
  const uncheckedHw = myAssignments.filter((a) => {
    const sub = submissions.find((s) => s.assignment_id === a.id);
    return sub && sub.status === "submitted";
  });

  // Period stats
  const BASE_PAY = 11000;
  const LEVEL_RATES: Record<string, number> = {
    'A1': 14000, 'A2': 14000,
    'B1': 19000, 'B2': 19000,
    'C1': 24000, 'C2': 24000,
  };
  const getLevelCategory = (level: string) => {
    if (['A1', 'A2'].includes(level)) return '초급';
    if (['B1', 'B2'].includes(level)) return '중급';
    if (['C1', 'C2'].includes(level)) return '고급';
    return '중급';
  };
  const start = period ? new Date(period.start_date) : null;
  const end = period ? new Date(period.end_date) : null;
  const now = new Date();
  const periodSessions = sessions.filter((s) => {
    if (!start || !end) return false;
    const d = new Date(s.scheduled_at);
    return d >= start && d <= end;
  });
  const completedPeriodSessions = periodSessions.filter((s) => new Date(s.scheduled_at) <= now);
  const periodMeetings = meetings.filter((m) => {
    if (!start || !end) return false;
    const d = new Date(m.scheduled_at);
    return d >= start && d <= end;
  });
  const completedPeriodMeetings = periodMeetings.filter((m) => new Date(m.scheduled_at) <= now);
  const lessonHours = periodSessions.length;

  // Settlement items for the table
  type SettlementRow = { key: string; date: Date; type: 'lesson' | 'meeting'; description: string; durationHours: number; payPerHour: number; };
  const settlementRows: SettlementRow[] = [];
  const isOwner = instructor?.position === '대표';
  completedPeriodSessions.forEach((s) => {
    const levelRate = LEVEL_RATES[s.level] || 19000;
    const key = `lesson-${s.id}`;
    const durationHours = durationOverrides[key] ?? 1;
    settlementRows.push({
      key,
      date: new Date(s.scheduled_at),
      type: 'lesson',
      description: `${s.student_name} 수업 (${getLevelCategory(s.level)})`,
      durationHours,
      payPerHour: isOwner ? (instructor?.lesson_rate ?? 50000) : (BASE_PAY + levelRate),
    });
  });
  completedPeriodMeetings.forEach((m) => {
    const key = `meeting-${m.id}`;
    const durationHours = durationOverrides[key] ?? (m.duration_minutes / 60);
    settlementRows.push({
      key,
      date: new Date(m.scheduled_at),
      type: 'meeting',
      description: m.notes || '업무 미팅',
      durationHours,
      payPerHour: isOwner ? (instructor?.lesson_rate ?? 50000) : BASE_PAY,
    });
  });
  settlementRows.sort((a, b) => a.date.getTime() - b.date.getTime());

  let cumulative = 0;
  const settlementWithCumulative = settlementRows.map((row) => {
    const pay = Math.round(row.durationHours * row.payPerHour);
    cumulative += pay;
    return { ...row, pay, cumulative };
  });

  const totalAmount = cumulative;

   // Selected date sessions + meetings + virtual schedules
    const selectedDateStr = selectedDate?.toDateString();
    const selectedDaySessions = selectedDateStr
      ? sessions.filter((s) => new Date(s.scheduled_at).toDateString() === selectedDateStr)
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      : [];
    const selectedDayMeetings = selectedDateStr
      ? meetings.filter((m) => new Date(m.scheduled_at).toDateString() === selectedDateStr)
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      : [];

  // Virtual schedules for selected date
  const selectedDayVirtual = (() => {
    if (!selectedDate) return [];
    // Hide past virtual schedules (rescheduled/cancelled)
    const isPastDate = selectedDate < new Date(new Date().toDateString());
    if (isPastDate) return [];
    // Skip Tuesdays
    if (selectedDate.getDay() === 2) return [];
    // Skip holidays
    const selDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    const hSet = buildHolidaySet(holidays);
    if (hSet.has(selDateStr)) return [];

    const dayName = ["일", "월", "화", "수", "목", "금", "토"][selectedDate.getDay()];
    const actualStudents = new Set(selectedDaySessions.map(s => s.student_name));
    const result: VirtualSchedule[] = [];
    students.forEach((st) => {
      if (st.status !== "active" || !st.schedules) return;
      if (actualStudents.has(st.student_name)) return;
      let slots: ScheduleSlot[] = [];
      try { slots = JSON.parse(st.schedules); } catch { return; }
      if (!Array.isArray(slots)) return;
      slots.forEach((slot) => {
        if (slot.day === dayName) {
          result.push({ student_name: st.student_name, time: slot.time, meet_link: st.meet_link, level: st.level });
        }
      });
    });
    return result.sort((a, b) => a.time.localeCompare(b.time));
  })();

  // Per-student stats with monthly & weekly breakdowns
  const getStudentStats = (studentName: string, studentSchedules: string | null, overridePeriod?: SchedulePeriod | null) => {
    const now = new Date();
    const usePeriod = overridePeriod !== undefined ? overridePeriod : period;

    // Period-based sessions: use active schedule_periods instead of calendar month
    const periodStart = usePeriod ? new Date(usePeriod.start_date + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = usePeriod ? new Date(usePeriod.end_date + "T23:59:59") : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const sSessions = sessions.filter((s) => s.student_name === studentName);
    const periodSess = sSessions.filter((s) => {
      const d = new Date(s.scheduled_at);
      return d >= periodStart && d <= periodEnd;
    });
    const completedMonthSessions = periodSess.filter((s) => new Date(s.scheduled_at) < now).length;

    // Total scheduled in period from recurring schedules
    let totalMonthScheduled = 0;
    const hSet = buildHolidaySet(holidays);
    try {
      const slots: ScheduleSlot[] = studentSchedules ? JSON.parse(studentSchedules) : [];
      if (Array.isArray(slots)) {
        for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
          if (d.getDay() === 2) continue; // 화요일 제외
          const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          if (hSet.has(dStr)) continue; // 공휴일 제외
          const dayName = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
          if (slots.some((sl) => sl.day === dayName)) totalMonthScheduled++;
        }
      }
    } catch { /* ignore */ }
    // Use max of actual or scheduled
    const monthTotal = Math.max(totalMonthScheduled, periodSess.length);

    // Weekly homework: this week Mon-Sun
    const weekDay = now.getDay();
    const mondayOffset = weekDay === 0 ? -6 : 1 - weekDay;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const sAssignments = assignments.filter((a) => a.student_name === studentName);
    const sSubmissions = submissions.filter((s) => s.student_name === studentName);
    const weekSubmissions = sSubmissions.filter((s) => {
      const d = new Date(s.submitted_at);
      return d >= weekStart && d < weekEnd;
    });
    const weekSubmittedCount = weekSubmissions.length;

    // Weekly vocab tests
    const weekVocabTests = vocabTests.filter((v) => {
      if (v.student_name !== studentName) return false;
      const d = new Date(v.started_at);
      return d >= weekStart && d < weekEnd;
    });

    return {
      completedMonthSessions,
      monthTotal,
      weekSubmittedHw: weekSubmittedCount,
      totalHw: sAssignments.length,
      weekVocabCount: weekVocabTests.length,
    };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center shadow-gold">
            <BookOpen className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">The Lounge English</p>
            <p className="text-[10px] text-muted-foreground">{instructor.name} · {instructor.position || '강사'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => navigate("/admin")} className="h-8 text-xs gap-1.5 text-muted-foreground">
              <Shield className="w-3 h-3" /> 관리자
            </Button>
          )}
          <Button size="sm" onClick={() => setShowMeetingModal(true)}
            className="h-8 text-xs gap-1.5 bg-navy hover:bg-navy-light text-primary-foreground"
          >
            <Plus className="w-3 h-3" /> 업무 미팅
          </Button>
          <Button size="sm" variant="outline" onClick={handleLogout} className="h-8 text-xs gap-1.5 text-muted-foreground">
            <LogOut className="w-3 h-3" />
          </Button>
        </div>
      </header>

      {/* Tab Nav */}
      <div className="border-b border-border bg-card px-5">
        <div className="flex gap-0 max-w-5xl mx-auto">
          {[
            { id: "dashboard" as const, label: "대시보드", icon: CalendarDays },
            { id: "students" as const, label: "학생 관리", icon: Users },
            { id: "settlement" as const, label: "정산 관리", icon: Banknote },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn("flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === t.id
                  ? "border-navy text-navy"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ═══ DASHBOARD TAB ═══════════════════════════════════════════════ */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "dashboard" && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: "담당 학생", value: `${students.filter(s => s.status === "active").length}명`, icon: Users, color: "text-navy", bg: "bg-navy/10" },
                { label: "이번 기간 수업", value: `${lessonHours}회`, icon: BookOpen, color: "text-gold-dark", bg: "bg-gold/10" },
                { label: "미확인 숙제", value: `${uncheckedHw.length}건`, icon: ClipboardCheck, color: uncheckedHw.length > 0 ? "text-destructive" : "text-success", bg: uncheckedHw.length > 0 ? "bg-destructive/10" : "bg-success/10" },
                { label: "정산 예정", value: `₩${totalAmount.toLocaleString()}`, icon: Banknote, color: "text-success", bg: "bg-success/10" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-3.5 space-y-1.5">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", bg)}>
                    <Icon className={cn("w-3.5 h-3.5", color)} />
                  </div>
                  <p className={cn("text-base font-bold leading-tight", color)}>{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {/* Two columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: Calendar */}
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-5">
                  <BigCalendar
                    sessions={sessions}
                    meetings={meetings}
                    students={students}
                    holidays={holidays}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                </div>

                {/* Selected date detail */}
                {selectedDate && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      {selectedDate.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })} 일정
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{selectedDaySessions.length + selectedDayVirtual.length + selectedDayMeetings.length}건</span>
                    </h3>
                    {selectedDaySessions.length === 0 && selectedDayVirtual.length === 0 && selectedDayMeetings.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">예정된 일정이 없습니다</p>
                    ) : (
                      <div className="space-y-2">
                        {/* Actual sessions */}
                        {selectedDaySessions.map((s) => (
                          <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                            <div className="text-center w-12 flex-shrink-0">
                              <p className="text-xs font-bold text-navy">{fmtTime(s.scheduled_at)}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{s.student_name}</p>
                              <p className="text-[11px] text-muted-foreground">{s.topic || s.level}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setRescheduleSession(s)}
                                className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-muted"
                                title="일정 변경"
                              >
                                <CalendarDays className="w-3.5 h-3.5" />
                              </button>
                              <a href={`/t/classroom?sessionId=${s.id}`}>
                                <Button size="sm" className="h-6 text-[10px] gap-1 bg-navy hover:bg-navy-light text-primary-foreground px-2">
                                  <FileText className="w-3 h-3" /> 수업노트
                                </Button>
                              </a>
                            </div>
                          </div>
                        ))}
                        {/* Virtual (planned) sessions */}
                        {selectedDayVirtual.map((v, i) => (
                          <div key={`v${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-navy/20 bg-navy/5 hover:bg-navy/10 transition-colors">
                            <div className="text-center w-12 flex-shrink-0">
                              <p className="text-xs font-bold text-navy/60">{v.time}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground/70">{v.student_name}</p>
                              <p className="text-[11px] text-muted-foreground">{v.level || "—"} · 예정</p>
                            </div>
                            <a href={`/t/classroom?student=${encodeURIComponent(v.student_name)}`}>
                              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2">
                                <FileText className="w-3 h-3" /> 수업노트
                              </Button>
                            </a>
                          </div>
                        ))}
                        {/* Business meetings */}
                        {selectedDayMeetings.map((m) => (
                          <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gold/30 bg-gold/5 hover:bg-gold/10 transition-colors">
                            <div className="text-center w-12 flex-shrink-0">
                              <p className="text-xs font-bold text-gold-dark">{fmtTime(m.scheduled_at)}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{m.notes || "업무 미팅"}</p>
                              <p className="text-[11px] text-muted-foreground">{m.duration_minutes}분</p>
                            </div>
                            {instructor?.meet_link && (
                              <a href={instructor.meet_link} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" className="h-6 text-[10px] gap-1 bg-gold hover:bg-gold-dark text-accent-foreground px-2">
                                  <Video className="w-3 h-3" /> 미팅 시작
                                </Button>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT: Next Class Prep + Today + Progress + Homework */}
              <div className="space-y-4">
                {/* Next class day prep */}
                {nextClassDaySessions.length > 0 && (
                  <details className="rounded-xl border border-navy/20 bg-navy/5 overflow-hidden">
                    <summary className="px-4 py-3 flex items-center gap-2 cursor-pointer list-none select-none hover:bg-navy/10 transition-colors">
                      <CalendarDays className="w-4 h-4 text-navy" />
                      <span className="text-sm font-semibold text-foreground">다음 수업 준비</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy/10 text-navy">
                        {new Date(nextClassDaySessions[0].scheduled_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{nextClassDaySessions.length}건</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform [[open]>&]:rotate-90" />
                    </summary>
                    <div className="px-4 pb-4 space-y-2">
                      {nextClassDaySessions.map((s) => (
                        <a
                          key={s.id}
                          href={`/t/classroom?sessionId=${s.id}`}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-navy/15 bg-card hover:bg-navy/10 transition-colors group"
                        >
                          <p className="text-xs font-bold text-navy w-12 text-center flex-shrink-0">{fmtTime(s.scheduled_at)}</p>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{s.student_name}</p>
                            <p className="text-[11px] text-muted-foreground">{s.level} · 수업노트 준비</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-navy/40 group-hover:text-navy transition-colors" />
                        </a>
                      ))}
                    </div>
                  </details>
                )}

                {/* Today's schedule */}
                {(() => {
                  const todayMeetings = meetings.filter((m) => isToday(m.scheduled_at))
                    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
                  const totalToday = todaySessions.length + todayMeetings.length;
                  return (
                    <div className="rounded-xl border border-border bg-card p-4">
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gold" />
                        오늘의 일정
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{totalToday}건</span>
                      </h3>
                      {totalToday === 0 ? (
                        <p className="text-xs text-muted-foreground py-1">오늘 예정된 일정이 없습니다</p>
                      ) : (
                        <div className="space-y-2">
                          {todaySessions.map((s) => {
                            // Find previous session for this student (before today's session)
                            const prevSession = sessions
                              .filter((ps) => ps.student_name === s.student_name && new Date(ps.scheduled_at) < new Date(s.scheduled_at))
                              .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];

                            return (
                              <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/20">
                                <p className="text-xs font-bold text-navy w-12 text-center flex-shrink-0">{fmtTime(s.scheduled_at)}</p>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground">{s.student_name}</p>
                                  <p className="text-[11px] text-muted-foreground">{s.topic || s.level}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {prevSession && (
                                    <a href={`/t/classroom?sessionId=${prevSession.id}`}>
                                      <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2">
                                        <ChevronLeft className="w-3 h-3" /> 지난 수업
                                      </Button>
                                    </a>
                                  )}
                                  <a href={`/t/classroom?sessionId=${s.id}`}>
                                    <Button size="sm" className="h-7 text-[10px] gap-1 bg-navy hover:bg-navy-light text-primary-foreground px-2">
                                      <FileText className="w-3 h-3" /> 이번 수업
                                    </Button>
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                          {todayMeetings.map((m) => (
                            <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gold/30 bg-gold/5">
                              <p className="text-xs font-bold text-gold-dark w-12 text-center flex-shrink-0">{fmtTime(m.scheduled_at)}</p>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">업무 미팅</p>
                                <p className="text-[11px] text-muted-foreground">{m.duration_minutes}분{m.notes ? ` · ${m.notes}` : ""}</p>
                              </div>
                              {instructor?.meet_link ? (
                                <a href={instructor.meet_link} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" className="h-7 text-[10px] gap-1 bg-gold hover:bg-gold-dark text-accent-foreground px-2">
                                    <Video className="w-3 h-3" /> 미팅 시작
                                  </Button>
                                </a>
                              ) : (
                                <Coffee className="w-4 h-4 text-gold" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Student progress with donut charts */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-navy" />
                    학생별 학습 현황
                  </h3>
                  <div className="space-y-2">
                    {students.filter(s => s.status === "active").map((st) => {
                      const stats = getStudentStats(st.student_name, st.schedules);
                      const goals = fmtGoals(st.lesson_goal);

                      return (
                        <div key={st.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/20">
                          {/* Left: student info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <div className="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-navy font-bold text-[9px]">{st.student_name.charAt(0)}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground leading-tight">{st.student_name}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight">{st.level} · {fmtSchedules(st.schedules) || "미정"}</p>
                              </div>
                            </div>
                            {goals.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 ml-8">
                                {goals.map((g, i) => (
                                  <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-navy/8 text-navy">{g}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Right: donut charts inline */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <DonutStat value={stats.completedMonthSessions} total={stats.monthTotal} label="수업" unit="회" color="hsl(var(--navy))" trackColor="hsl(var(--navy) / 0.15)" />
                            <DonutStat value={stats.weekSubmittedHw} total={stats.totalHw} label="숙제" unit="건" color="hsl(var(--gold-dark))" trackColor="hsl(var(--gold) / 0.2)" />
                            <DonutStat value={stats.weekVocabCount} total={0} label="단어" unit="회" color="hsl(var(--success))" trackColor="hsl(var(--success) / 0.15)" isCount />
                          </div>
                        </div>
                      );
                    })}
                    {students.filter(s => s.status === "active").length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">담당 학생이 없습니다</p>
                    )}
                  </div>
                </div>

                {/* Unchecked homework */}
                {uncheckedHw.length > 0 && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                    <h3 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      미확인 숙제
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">{uncheckedHw.length}</span>
                    </h3>
                    <div className="space-y-1.5">
                      {uncheckedHw.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">{a.title}</p>
                            <p className="text-[10px] text-muted-foreground">{a.student_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ═══ STUDENTS TAB ════════════════════════════════════════════════ */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "students" && (
          <div className="space-y-4">
            {/* Period navigator */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-navy" />
                담당 학생 관리
                <span className="text-xs px-2 py-0.5 rounded-full bg-navy/10 text-navy font-medium">{students.length}명</span>
              </h2>
              {allPeriods.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStudentTabPeriodIdx(Math.max(0, studentTabPeriodIdx - 1))}
                    disabled={studentTabPeriodIdx <= 0}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-semibold text-foreground min-w-[100px] text-center">
                    {allPeriods[studentTabPeriodIdx]?.label || "—"}
                    <span className="block text-[10px] text-muted-foreground font-normal">
                      {allPeriods[studentTabPeriodIdx]?.start_date} ~ {allPeriods[studentTabPeriodIdx]?.end_date}
                    </span>
                  </span>
                  <button
                    onClick={() => setStudentTabPeriodIdx(Math.min(allPeriods.length - 1, studentTabPeriodIdx + 1))}
                    disabled={studentTabPeriodIdx >= allPeriods.length - 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {students.map((st) => {
                const selectedPeriod = allPeriods[studentTabPeriodIdx] || period;
                const stats = getStudentStats(st.student_name, st.schedules, selectedPeriod);
                const goals = fmtGoals(st.lesson_goal);
                const statusLabel = st.status === "active" ? "수강 중" : st.status === "paused" ? "휴강" : "수료";
                const statusColor = st.status === "active" ? "bg-success/10 text-success" : st.status === "paused" ? "bg-gold/10 text-gold-dark" : "bg-muted text-muted-foreground";

                // Sessions within selected period for this student
                const pStart = selectedPeriod ? new Date(selectedPeriod.start_date + "T00:00:00") : null;
                const pEnd = selectedPeriod ? new Date(selectedPeriod.end_date + "T23:59:59") : null;
                const studentPeriodSessions = sessions
                  .filter((s) => {
                    if (s.student_name !== st.student_name) return false;
                    if (!pStart || !pEnd) return false;
                    const d = new Date(s.scheduled_at);
                    return d >= pStart && d <= pEnd;
                  })
                  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

                return (
                  <div key={st.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    {/* Card header */}
                    <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center">
                          <span className="text-navy font-bold text-sm">{st.student_name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{st.student_name}</p>
                          <p className="text-[10px] text-muted-foreground">{st.level} · {fmtSchedules(st.schedules) || "일정 미정"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusColor)}>{statusLabel}</span>
                        <button
                          onClick={() => setEditStudent(st)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="학생 정보 수정"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Goals */}
                      {goals.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground">학습 목표</p>
                          <div className="flex flex-wrap gap-1">
                            {goals.map((g, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-navy/8 text-navy font-medium">{g}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Donut charts */}
                      <div className="grid grid-cols-3 gap-2">
                        <DonutStat value={stats.completedMonthSessions} total={stats.monthTotal} label="수업횟수" unit="회" color="hsl(var(--navy))" trackColor="hsl(var(--navy) / 0.15)" />
                        <DonutStat value={stats.weekSubmittedHw} total={stats.totalHw} label="숙제 제출" unit="건" color="hsl(var(--gold-dark))" trackColor="hsl(var(--gold) / 0.2)" />
                        <DonutStat value={stats.weekVocabCount} total={0} label="단어 테스트" unit="회" color="hsl(var(--success))" trackColor="hsl(var(--success) / 0.15)" isCount />
                      </div>

                      {/* Period sessions */}
                      {studentPeriodSessions.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">수업 일정 ({studentPeriodSessions.length}회)</p>
                          {studentPeriodSessions.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border">
                              <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-[11px] text-foreground flex-1">{fmtDateTime(s.scheduled_at)}</span>
                              {new Date(s.scheduled_at) <= new Date() ? (
                                <span className="text-[10px] text-success font-medium">완료</span>
                              ) : (
                                <button
                                  onClick={() => setRescheduleSession(s)}
                                  className="text-[10px] text-navy hover:underline font-medium"
                                >
                                  변경
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {students.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">담당 학생이 없습니다</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ═══ SETTLEMENT TAB ══════════════════════════════════════════════ */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "settlement" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Banknote className="w-4 h-4 text-success" />
                정산 관리
                {period && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">
                    {period.label} ({period.start_date} ~ {period.end_date})
                  </span>
                )}
              </h2>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                <p className="text-[10px] text-muted-foreground">완료 수업</p>
                <p className="text-lg font-bold text-navy">{completedPeriodSessions.length}회</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                <p className="text-[10px] text-muted-foreground">업무 미팅</p>
                <p className="text-lg font-bold text-gold-dark">{completedPeriodMeetings.length}건</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                <p className="text-[10px] text-muted-foreground">정산 예정</p>
                <p className="text-lg font-bold text-success">₩{totalAmount.toLocaleString()}</p>
              </div>
            </div>

            {/* Pay rate info */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">💰 급여 기준</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="text-center p-2 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground">기본급</p>
                  <p className="text-xs font-bold text-foreground">₩{BASE_PAY.toLocaleString()}</p>
                </div>
                {Object.entries(LEVEL_RATES).filter(([k]) => ['A2', 'B1', 'C1'].includes(k)).map(([level, rate]) => (
                  <div key={level} className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">{getLevelCategory(level)}반 합계</p>
                    <p className="text-xs font-bold text-foreground">₩{(BASE_PAY + rate).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Settlement table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">일자</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">구분</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">업무내용</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">시간</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">급여</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">누적 금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementWithCumulative.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                          이번 기간에 완료된 업무가 없습니다
                        </td>
                      </tr>
                    ) : (
                      settlementWithCumulative.map((row, idx) => (
                        <tr key={row.key} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-foreground">
                            {row.date.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" })}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-medium",
                              row.type === 'lesson' ? "bg-navy/10 text-navy" : "bg-gold/10 text-gold-dark"
                            )}>
                              {row.type === 'lesson' ? '수업' : '미팅'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-foreground">{row.description}</td>
                          <td className="px-4 py-2.5">
                            <select
                              className="text-xs bg-transparent border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              value={row.durationHours}
                              onChange={(e) => setDurationOverrides(prev => ({ ...prev, [row.key]: parseFloat(e.target.value) }))}
                            >
                              {[0.5, 1, 1.5, 2, 2.5, 3].map(h => (
                                <option key={h} value={h}>{h}시간</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-right font-medium text-foreground">₩{row.pay.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-xs text-right font-bold text-success">₩{row.cumulative.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {settlementWithCumulative.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/30 border-t border-border">
                        <td colSpan={4} className="px-4 py-3 text-xs font-bold text-foreground">합계</td>
                        <td className="px-4 py-3 text-xs text-right font-bold text-foreground">₩{totalAmount.toLocaleString()}</td>
                        <td className="px-4 py-3"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showMeetingModal && instructor && (
        <AddMeetingModal
          instructorId={instructor.id}
          position={instructor.position}
          allInstructors={allInstructors}
          onClose={() => setShowMeetingModal(false)}
          onAdded={() => loadData(instructor)}
        />
      )}
      {editStudent && (
        <StudentEditModal
          student={editStudent}
          onClose={() => setEditStudent(null)}
          onSaved={() => loadData(instructor)}
        />
      )}
      {rescheduleSession && (
        <RescheduleModal
          session={rescheduleSession}
          onClose={() => setRescheduleSession(null)}
          onSaved={() => loadData(instructor)}
        />
      )}
    </div>
  );
}
