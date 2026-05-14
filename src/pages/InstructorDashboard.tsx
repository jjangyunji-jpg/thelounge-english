import { useState, useEffect, useCallback } from "react";
import { formatStudentName } from "@/lib/formatStudentName";
import {
  BookOpen, Users, AlertCircle, Video, Plus, LogOut,
  Calendar, Clock, ChevronRight, Check, X, Loader2,
  TrendingUp, Banknote, Coffee, FileText, ChevronLeft,
  GraduationCap, ClipboardCheck, Settings2, CalendarDays,
  PenLine, Mic, Brain, Edit2, Trash2, RefreshCw, ArrowRight,
  Shield, Paperclip, CheckCircle, ChevronDown, User, Lock, Monitor, Target,
  Star, MessageSquare, Download, Bug, RotateCcw,
} from "lucide-react";
import BugReportModal from "@/components/dashboard/BugReportModal";
import InstructorFeedbackTab from "@/components/dashboard/InstructorFeedbackTab";
import NotificationInbox from "@/components/dashboard/NotificationInbox";
import StudentFeedbackModal from "@/components/dashboard/StudentFeedbackModal";
import { exportNotesPdf } from "@/lib/exportNotesPdf";
import InstructorGuide from "@/components/dashboard/InstructorGuide";
import HomeworkReviewModal from "@/components/dashboard/HomeworkReviewModal";
import HomeworkFeedbackModal from "@/components/dashboard/HomeworkFeedbackModal";
import AddSessionModal from "@/components/dashboard/AddSessionModal";
import PreClassChecklistModal from "@/components/dashboard/PreClassChecklistModal";
import InstructorMakeupTab from "@/components/dashboard/InstructorMakeupTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BASE_PAY, LEVEL_RATES, getLevelCategory, calcSessionPay } from "@/lib/instructorPay";
import { getMovedAwayKeys, isEffectivelyInactive, kstDateKey as kstDateKeyShared } from "@/lib/sessionVisibility";
import { MakeupBadges } from "@/components/MakeupBadges";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
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

interface PauseRecord {
  id: string;
  pause_start: string;
  pause_end: string | null;
  student_id: string;
}

interface StudentFull {
  id: string;
  student_name: string;
  english_name: string | null;
  level: string | null;
  schedules: string | null;
  meet_link: string | null;
  phone: string | null;
  status: string | null;
  lesson_goal: string | null;
  learning_objective: string | null;
  extra_lessons: number | null;
  start_date: string | null;
  end_date: string | null;
  student_type: string | null;
  group_students?: string[];
  instructor_id: string;
  instructor_name: string | null;
  google_sheet_url: string | null;
  pauses: PauseRecord[];
}

import SessionCancellationModal from "@/components/dashboard/SessionCancellationModal";
import type { CancellationType, CancellationResolution } from "@/components/dashboard/SessionCancellationModal";

const CANCELLATION_META: Record<CancellationType, { label: string; color: string; bgColor: string }> = {
  student_cancel: { label: "학생취소", color: "text-destructive", bgColor: "bg-destructive/10" },
  no_show: { label: "노쇼", color: "text-[hsl(var(--gold-dark))]", bgColor: "bg-[hsl(var(--gold)/0.12)]" },
  sick: { label: "강사취소(병결)", color: "text-blue-600", bgColor: "bg-blue-50" },
  instructor_cancel: { label: "강사취소", color: "text-purple-600", bgColor: "bg-purple-50" },
  advance_cancel: { label: "사전취소", color: "text-emerald-600", bgColor: "bg-emerald-50" },
  late_cancel: { label: "학생취소", color: "text-destructive", bgColor: "bg-destructive/10" },
};

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
  notes: string | null;
  reschedule_origin_dates?: string[];
  is_urgent_makeup?: boolean | null;
  cancellation_type?: CancellationType | null;
  cancellation_resolution?: CancellationResolution | null;
  is_carryover?: boolean;
  carryover_direction?: "next" | "prev" | null;
  carryover_reason?: string | null;
  gcal_event_id?: string | null;
}

interface HomeworkAssignment {
  id: string;
  title: string;
  type: string;
  description: string | null;
  student_name: string;
  session_id: string | null;
  is_preset: boolean;
  preset_origin_id: string | null;
}

interface HomeworkSubmission {
  id: string;
  assignment_id: string | null;
  status: string;
  student_name: string;
  submitted_at: string;
  text_content: string | null;
  audio_url: string | null;
  file_url: string | null;
  instructor_note: string | null;
  reviewed_at: string | null;
  ai_correction: any | null;
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

type HwType = "writing" | "reading" | "speaking" | "memorizing" | "file" | "watching";
const HW_TYPE_META: Record<HwType, { label: string; icon: React.ElementType; color: string }> = {
  writing:    { label: "쓰기",       icon: PenLine,    color: "text-[hsl(var(--navy))]" },
  reading:    { label: "읽기",       icon: BookOpen,   color: "text-[hsl(var(--gold-dark))]" },
  speaking:   { label: "말하기",     icon: Mic,        color: "text-[hsl(var(--success))]" },
  memorizing: { label: "외우기",     icon: Brain,      color: "text-purple-500" },
  file:       { label: "파일올리기", icon: Paperclip,  color: "text-blue-500" },
  watching:   { label: "시청하기",   icon: Monitor,    color: "text-rose-500" },
};

interface ScheduleSlot { day: string; time: string; }
interface PresetHw { id: string; type: HwType; title: string; description: string; }

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
}
function msUntil(iso: string) { return new Date(iso).getTime() - Date.now(); }
function isToday(iso: string) {
  const d = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  return formatter.format(d) === formatter.format(new Date());
}

function fmtSchedules(raw: string | null): string {
  if (!raw) return "";
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return "";
    return arr.map((s: { day: string; time: string }) => `${s.day} ${s.time}`).join(", ");
  } catch { return raw; }
}


function parseLearningObjective(raw: string | null): string[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((s: string) => s && s.trim());
    return [raw.trim()];
  } catch { return raw.trim() ? [raw.trim()] : []; }
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
      set.add(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d));
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
        const dateStr2 = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        // Skip holidays
        if (holidaySet.has(dateStr2)) continue;
        // Skip dates before student's start_date
        if (st.start_date && dateStr2 < st.start_date) continue;
        // Skip dates on/after student's end_date (transfer/종료 시점 이후 숨김)
        if (st.end_date && dateStr2 >= st.end_date) continue;
        // Skip dates during any pause period
        if (st.pauses && st.pauses.some(p => dateStr2 >= p.pause_start && (!p.pause_end || dateStr2 <= p.pause_end))) continue;

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
  period,
  allPeriods,
  onPeriodChange,
}: {
  sessions: ClassSession[];
  meetings: BusinessMeeting[];
  students: StudentFull[];
  holidays: { date_start: string; date_end: string }[];
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
  period: SchedulePeriod | null;
  allPeriods: SchedulePeriod[];
  onPeriodChange: (p: SchedulePeriod) => void;
}) {
  // Period-based calendar: show only the weeks the period spans
  const baseStart = period ? new Date(period.start_date + "T00:00:00") : new Date();
  const baseEnd = period ? new Date(period.end_date + "T00:00:00") : new Date(baseStart.getFullYear(), baseStart.getMonth() + 1, 0);

  // Grid: Sunday of start week → Saturday of end week
  const gridStart = new Date(baseStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(baseEnd);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const primaryMonth = baseStart.getMonth();
  const primaryYear = baseStart.getFullYear();

  // Group sessions by date — only within period range
  const periodEndOfDay = new Date(baseEnd);
  periodEndOfDay.setHours(23, 59, 59, 999);
  const sessionsByDate = new Map<string, ClassSession[]>();
  sessions.forEach((s) => {
    const d = new Date(s.scheduled_at);
    if (d < baseStart || d > periodEndOfDay) return; // period 범위 밖은 제외
    const key = d.toDateString();
    if (!sessionsByDate.has(key)) sessionsByDate.set(key, []);
    sessionsByDate.get(key)!.push(s);
  });
  // Sort each day's sessions by time ascending (morning first)
  sessionsByDate.forEach((list, key) => {
    list.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  });
  const meetingsByDate = new Map<string, BusinessMeeting[]>();
  meetings.forEach((m) => {
    const d = new Date(m.scheduled_at);
    if (d < baseStart || d > periodEndOfDay) return; // period 범위 밖은 제외
    const key = d.toDateString();
    if (!meetingsByDate.has(key)) meetingsByDate.set(key, []);
    meetingsByDate.get(key)!.push(m);
  });

  // Virtual (recurring) schedules - build for all months in range, but only within period
  const holidaySet = buildHolidaySet(holidays);
  const virtualByDate = new Map<string, { student_name: string; time: string }[]>();
  {
    const seenMonths = new Set<string>();
    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!seenMonths.has(key)) {
        seenMonths.add(key);
        const mv = buildVirtualSchedules(students, d.getFullYear(), d.getMonth(), holidaySet);
        mv.forEach((v, k) => {
          // Only include virtual schedules within period range
          const vDate = new Date(k);
          if (vDate < baseStart || vDate > periodEndOfDay) return;
          if (!virtualByDate.has(k)) virtualByDate.set(k, v);
        });
      }
    }
  }

  // Build cells
  const cells: ({ day: number; month: number; year: number } | null)[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    cells.push({ day: d.getDate(), month: d.getMonth(), year: d.getFullYear() });
  }

  // Header
  const pEndMonth = baseEnd.getMonth();
  const pEndYear = baseEnd.getFullYear();
  const headerLabel = period?.label || (primaryMonth === pEndMonth && primaryYear === pEndYear
    ? `${primaryYear}년 ${primaryMonth + 1}월`
    : `${primaryYear}년 ${primaryMonth + 1}월 ~ ${pEndYear}년 ${pEndMonth + 1}월`);

  const periodIdx = allPeriods.findIndex(p => p.id === period?.id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => periodIdx > 0 && onPeriodChange(allPeriods[periodIdx - 1])}
            disabled={periodIdx <= 0}
            className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-base font-bold text-foreground min-w-[100px] text-center">{headerLabel}</span>
          <button
            onClick={() => periodIdx < allPeriods.length - 1 && onPeriodChange(allPeriods[periodIdx + 1])}
            disabled={periodIdx >= allPeriods.length - 1}
            className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {period && (
          <span className="text-xs text-muted-foreground">{period.start_date} ~ {period.end_date}</span>
        )}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <div key={d} className={cn("text-xs font-semibold py-2", i === 0 ? "text-destructive/70" : i === 6 ? "text-blue-400" : "text-muted-foreground")}>{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (cell === null) return <div key={idx} className="aspect-square" />;
          const date = new Date(cell.year, cell.month, cell.day);
          const isNextMonth = cell.month !== primaryMonth || cell.year !== primaryYear;
          const dateStr = date.toDateString();
          const daySessions = sessionsByDate.get(dateStr) || [];
          const dayMeetings = meetingsByDate.get(dateStr) || [];
          const dayVirtual = virtualByDate.get(dateStr) || [];
          const todayFlag = dateStr === new Date().toDateString();
          const isSelected = selectedDate && dateStr === selectedDate.toDateString();
          const dayOfWeek = date.getDay();
          const isHolidayDay = holidaySet.has(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`);

          // Merge: show actual sessions, then virtual ones not covered by actual sessions
          // Hide virtual schedules when:
          // 1. Past dates with no actual session (rescheduled/cancelled)
          // 2. Future dates where the student already has a session on a different day in the same week (rescheduled)
          const actualStudents = new Set(daySessions.map(s => s.student_name));
          const isPast = date < new Date(new Date().toDateString());

          // Build set of students who have actual sessions in the same week (Mon-Sun) but on a different date
          const weekStart = new Date(date);
          weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6); // Sunday

          const rescheduledStudents = new Set<string>();
          sessions.forEach(s => {
            const sDate = new Date(s.scheduled_at);
            if (sDate >= weekStart && sDate <= weekEnd && sDate.toDateString() !== dateStr) {
              rescheduledStudents.add(s.student_name);
            }
          });

          const unmatched = dayVirtual.filter(v =>
            !actualStudents.has(v.student_name) &&
            !isPast &&
            !rescheduledStudents.has(v.student_name)
          );

          // Combined entries for display (max 2)
          const now = new Date();
          const displayItems: { label: string; type: "actual" | "completed" | "virtual" | "meeting" | "cancelled" }[] = [];
          daySessions.slice(0, 2).forEach(s => {
            const isCancelled = !!s.cancellation_type;
            const isCompleted = !!s.ended_at;
            const cancelLabel = s.cancellation_type ? CANCELLATION_META[s.cancellation_type as CancellationType]?.label : '';
            displayItems.push({
              label: `${new Date(s.scheduled_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })} ${s.student_name}${isCancelled ? ` [${cancelLabel}]` : ''}`,
              type: isCancelled ? "cancelled" : isCompleted ? "completed" : "actual",
            });
          });
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
                isHolidayDay && "bg-destructive/25 hover:bg-destructive/35 border border-destructive/40",
                todayFlag && "ring-2 ring-navy/50",
                isSelected && "bg-navy/10 ring-2 ring-navy",
              )}
            >
              <span className={cn(
                "text-[11px] font-medium mb-0.5",
                isNextMonth && "text-muted-foreground",
                !isNextMonth && (todayFlag ? "text-navy font-bold" : dayOfWeek === 0 ? "text-destructive/70" : dayOfWeek === 6 ? "text-blue-400" : "text-foreground"),
              )}>
                {isNextMonth ? `${cell.month + 1}/${cell.day}` : cell.day}
              </span>
              <div className="w-full space-y-0.5 overflow-hidden">
                {displayItems.map((item, i) => (
                  <div key={i} className={cn(
                    "w-full truncate text-[9px] leading-tight px-1 py-0.5 rounded font-medium",
                    item.type === "cancelled" ? "bg-muted text-muted-foreground/60 border border-muted-foreground/20 line-through" :
                    item.type === "completed" ? "bg-navy text-primary-foreground border border-navy shadow-sm" :
                    item.type === "actual" ? "bg-navy/10 text-navy border border-navy/25" :
                    "bg-navy/5 text-navy/60 border border-dashed border-navy/20",
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
          <div className="w-2 h-2 rounded-full bg-navy" /> 완료 수업
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-navy/40 border border-navy/50" /> 예정 수업
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-navy/20 border border-dashed border-navy/40" /> 가상 일정
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-gold" /> 업무미팅
        </div>
      </div>
    </div>
  );
}

// ── Collapsible Sessions List ─────────────────────────────────────────────────
function CollapsibleSessions({ sessions, onReschedule, onTopicChange }: { sessions: ClassSession[]; onReschedule: (s: ClassSession) => void; onTopicChange?: (sessionId: string, topic: string) => void }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors w-full text-left"
      >
        <ChevronRight className={cn("w-3 h-3 transition-transform", open && "rotate-90")} />
        수업 일정 ({sessions.length}회)
      </button>
      {open && sessions.map((s) => (
        <div key={s.id} className="px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border ml-4 space-y-1">
          {(() => {
            const isCancelled = !!s.cancellation_type;
            const isPast = new Date(s.scheduled_at) <= new Date();
            const cancelMeta = s.cancellation_type ? CANCELLATION_META[s.cancellation_type as CancellationType] : null;
            return (
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className={cn(
                  "text-[11px] flex-1",
                  isCancelled ? "text-muted-foreground line-through" : "text-foreground"
                )}>
                  {fmtDateTime(s.scheduled_at)}
                  {s.reschedule_origin_dates && s.reschedule_origin_dates.length > 0 && (
                    <RefreshCw className="w-2.5 h-2.5 text-gold-dark inline ml-1 -mt-0.5" />
                  )}
                </span>
                {cancelMeta ? (
                  <span className={cn("text-[10px] font-medium", cancelMeta.color)}>{cancelMeta.label}</span>
                ) : isPast ? (
                  <span className="text-[10px] text-success font-medium">완료</span>
                ) : (
                  <button
                    onClick={() => onReschedule(s)}
                    className="text-[10px] text-navy hover:underline font-medium"
                  >
                    변경
                  </button>
                )}
              </div>
            );
          })()}
          {s.reschedule_origin_dates && s.reschedule_origin_dates.length > 0 && (
            <p className="ml-5 text-[9px] text-gold-dark flex items-center gap-1 flex-wrap">
              <RefreshCw className="w-2.5 h-2.5" />
              <MakeupBadges isMakeup isUrgent={s.is_urgent_makeup} />
              <span>{s.reschedule_origin_dates.map(d => new Date(d + "T00:00:00").toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" })).join(", ")}에서 변경</span>
            </p>
          )}
          {/* Inline topic editing */}
          {editingId === s.id ? (
            <div className="flex items-center gap-1 ml-5">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="수업 목표 입력 (예: 과거형, 시간 전치사)"
                className="h-6 text-[10px] flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onTopicChange?.(s.id, editValue);
                    setEditingId(null);
                  } else if (e.key === "Escape") {
                    setEditingId(null);
                  }
                }}
              />
              <button
                onClick={() => { onTopicChange?.(s.id, editValue); setEditingId(null); }}
                className="text-success hover:text-success/80"
              >
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingId(s.id); setEditValue(s.topic || ""); }}
              className="ml-5 text-[10px] text-muted-foreground hover:text-foreground transition-colors truncate block max-w-full text-left"
            >
              {s.topic ? (
                <span className="text-foreground/80">{s.topic}</span>
              ) : (
                <span className="italic">+ 수업 목표 추가</span>
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Add Meeting Modal ──────────────────────────────────────────────────────────
function AddMeetingModal({
  instructorId,
  position,
  meetLink,
  allInstructors,
  onClose,
  onAdded,
}: {
  instructorId: string;
  position: string;
  meetLink: string | null;
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
      meet_link: meetLink,
    } as any).select().single();
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

// ── Edit Meeting Modal ──────────────────────────────────────────────────────────
function EditMeetingModal({
  meeting,
  onClose,
  onSaved,
}: {
  meeting: BusinessMeeting;
  onClose: () => void;
  onSaved: (updated: BusinessMeeting) => void;
}) {
  const { toast } = useToast();
  const initDate = new Date(meeting.scheduled_at);
  const [date, setDate] = useState(initDate.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }));
  const [time, setTime] = useState(initDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }));
  const [duration, setDuration] = useState(meeting.duration_minutes);
  const [notes, setNotes] = useState(meeting.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!date || !time) return;
    setSaving(true);
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    const { data, error } = await supabase.from("business_meetings").update({
      scheduled_at: scheduledAt,
      duration_minutes: duration,
      notes: notes.trim() || null,
    }).eq("id", meeting.id).select().single();
    if (error || !data) {
      toast({ title: "수정 실패", description: error?.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    toast({ title: "미팅 수정 완료 ✓" });
    onSaved(data as BusinessMeeting);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-foreground">업무 미팅 수정</h2>
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
            <Label className="text-xs text-muted-foreground">메모</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="미팅 내용..." className="h-9 text-sm" />
          </div>
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
  const [googleSheetUrl, setGoogleSheetUrl] = useState(student.google_sheet_url || "");
  
  const [status, setStatus] = useState(student.status || "active");
  const [saving, setSaving] = useState(false);

  // Learning objective (long-term goals)
  const [objectives, setObjectives] = useState<string[]>(() => {
    if (!student.learning_objective) return [];
    try {
      const parsed = JSON.parse(student.learning_objective);
      if (Array.isArray(parsed)) return parsed.filter((s: string) => s && s.trim());
      return student.learning_objective.trim() ? [student.learning_objective.trim()] : [];
    } catch { return student.learning_objective.trim() ? [student.learning_objective.trim()] : []; }
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
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editPresetType, setEditPresetType] = useState<HwType>("writing");
  const [editPresetTitle, setEditPresetTitle] = useState("");
  const [editPresetDesc, setEditPresetDesc] = useState("");

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

  const startEditPreset = (hw: PresetHw) => {
    setEditingPresetId(hw.id); setEditPresetType(hw.type); setEditPresetTitle(hw.title); setEditPresetDesc(hw.description); setAddingPreset(false);
  };

  const saveEditPreset = async () => {
    if (!editPresetTitle.trim() || !editingPresetId) return;
    setSavingPreset(true);
    const { error } = await supabase.from("homework_assignments")
      .update({ type: editPresetType, title: editPresetTitle.trim(), description: editPresetDesc.trim() || null })
      .eq("id", editingPresetId);
    if (!error) {
      setPresets((p) => p.map((h) => h.id === editingPresetId ? { ...h, type: editPresetType, title: editPresetTitle.trim(), description: editPresetDesc.trim() } : h));
      toast({ title: "정기 숙제 수정 완료 ✓" });
    }
    setEditingPresetId(null); setSavingPreset(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("instructor_students").update({
      level, schedules: slots.length > 0 ? JSON.stringify(slots) : null,
      meet_link: meetLink.trim() || null,
      google_sheet_url: googleSheetUrl.trim() || null,
      phone: null, status,
      learning_objective: objectives.length > 0 ? JSON.stringify(objectives) : null,
    } as any).eq("id", student.id);
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
            <Input value={meetLink} onChange={(e) => setMeetLink(e.target.value)} placeholder="https://meet.google.com/..." className="h-9 text-sm"
              onFocus={(e) => { if (!e.target.value) setMeetLink("https://"); }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">학생일지 (Google Sheet 링크)</Label>
            <Input value={googleSheetUrl} onChange={(e) => setGoogleSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/..." className="h-9 text-sm"
              onFocus={(e) => { if (!e.target.value) setGoogleSheetUrl("https://"); }}
            />
          </div>
          {/* Learning Goals */}
          <div className="space-y-2 pt-1 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" /> 등록 계기 / 최종 목표
              </Label>
            </div>
            <div className="space-y-1.5">
              {objectives.map((g, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-muted/20 group">
                  <span className="text-xs font-medium text-foreground flex-1">{g}</span>
                  <button onClick={() => setObjectives((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            {addingGoal ? (
              <div className="flex gap-1.5">
                <Input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="예: 외국인과의 스몰톡하기" className="h-8 text-xs flex-1" autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && newGoal.trim()) { setObjectives((p) => [...p, newGoal.trim()]); setNewGoal(""); setAddingGoal(false); } }}
                />
                <Button size="sm" className="h-8 text-xs bg-navy hover:bg-navy-light text-primary-foreground"
                  disabled={!newGoal.trim()}
                  onClick={() => { setObjectives((p) => [...p, newGoal.trim()]); setNewGoal(""); setAddingGoal(false); }}
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
                  const isEditing = editingPresetId === hw.id;

                  if (isEditing) {
                    return (
                      <div key={hw.id} className="border border-[hsl(var(--gold)/0.5)] rounded-lg p-3 space-y-2 bg-[hsl(var(--gold)/0.04)]">
                        <div className="grid grid-cols-2 gap-1.5">
                          {(Object.keys(HW_TYPE_META) as HwType[]).map((t) => {
                            const m = HW_TYPE_META[t]; const TIcon = m.icon;
                            return (
                              <button key={t} onClick={() => setEditPresetType(t)}
                                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                  editPresetType === t
                                    ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.10)] text-foreground"
                                    : "border-border bg-card text-muted-foreground hover:border-[hsl(var(--gold)/0.4)]"
                                }`}
                              >
                                <TIcon className={`w-3.5 h-3.5 ${editPresetType === t ? m.color : ""}`} />
                                {m.label}
                              </button>
                            );
                          })}
                        </div>
                        <Input value={editPresetTitle} onChange={(e) => setEditPresetTitle(e.target.value)} placeholder="숙제 제목 (필수)" className="h-8 text-xs" autoFocus />
                        <Input value={editPresetDesc} onChange={(e) => setEditPresetDesc(e.target.value)} placeholder="상세 설명 (선택)" className="h-8 text-xs" />
                        <div className="flex gap-1.5">
                          <Button size="sm" disabled={!editPresetTitle.trim() || savingPreset}
                            className="flex-1 h-7 text-xs bg-navy hover:bg-navy-light text-primary-foreground"
                            onClick={saveEditPreset}
                          >
                            {savingPreset ? "저장 중..." : "저장"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingPresetId(null)}>취소</Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={hw.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-muted/20 group">
                      {Icon && <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${meta.color}`} />}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-foreground">{hw.title}</span>
                        <span className={`text-[10px] ml-1.5 ${meta.color}`}>{meta.label}</span>
                        {hw.description && <p className="text-[10px] text-muted-foreground truncate">{hw.description}</p>}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditPreset(hw)} className="text-muted-foreground hover:text-foreground">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => removePreset(hw.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
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
  const [date, setDate] = useState(orig.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }));
  const [time, setTime] = useState(orig.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const newScheduled = new Date(`${date}T${time}:00+09:00`).toISOString();

    // Check for duplicate: same student, same date (KST), different session
    const dayStart = new Date(`${date}T00:00:00+09:00`).toISOString();
    const dayEnd = new Date(`${date}T23:59:59+09:00`).toISOString();
    const { data: existing } = await supabase
      .from("class_sessions")
      .select("id")
      .eq("student_name", session.student_name)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd)
      .neq("id", session.id);

    if (existing && existing.length > 0) {
      toast({ title: "변경 실패", description: `${session.student_name}의 ${date} 수업이 이미 존재합니다.`, variant: "destructive" });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("class_sessions").update({ scheduled_at: newScheduled }).eq("id", session.id);
    if (error) {
      toast({ title: "변경 실패", description: error.message, variant: "destructive" });
    } else {
      // Sync instructor_available_slots: release old slot, book new slot
      const origDate = orig.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
      const origTime = orig.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Seoul" });
      const newSlotTime = `${time}:00`;

      // Release old slot back to open (if it exists)
      await supabase
        .from("instructor_available_slots")
        .update({ status: "open" })
        .eq("slot_date", origDate)
        .eq("slot_time", origTime)
        .eq("status", "booked");

      // Book new slot (if matching open slot exists)
      await supabase
        .from("instructor_available_slots")
        .update({ status: "booked" })
        .eq("slot_date", date)
        .eq("slot_time", newSlotTime)
        .eq("status", "open");

      // Best-effort: move the calendar event to the new time
      try {
        await supabase.functions.invoke("sync-calendar-event", {
          body: {
            action: "move",
            session_id: session.id,
            instructor_name: session.instructor_name,
            student_name: session.student_name,
            old_scheduled_at: session.scheduled_at,
            new_scheduled_at: newScheduled,
            gcal_event_id: session.gcal_event_id,
          },
        });
      } catch (e) { console.warn("[gcal move] skipped", e); }

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
  const [searchParams] = useSearchParams();
  const viewingInstructorId = searchParams.get("instructor_id");
  const [isViewingAsAdmin, setIsViewingAsAdmin] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [authUserId, setAuthUserId] = useState<string>("");
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
  const [pendingMakeupCount, setPendingMakeupCount] = useState(0);
  const [approvedMakeups, setApprovedMakeups] = useState<{ student_name: string; original_scheduled_at: string | null; urgent_reason: string | null; created_at: string }[]>([]);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "students" | "settlement" | "feedback" | "makeup" | "profile" | "guide">("dashboard");
  const [profileName, setProfileName] = useState("");
  const [profileNickname, setProfileNickname] = useState("");
  const [profileNewPw, setProfileNewPw] = useState("");
  const [profileConfirmPw, setProfileConfirmPw] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profilePwSaving, setProfilePwSaving] = useState(false);
  const [durationOverrides, setDurationOverrides] = useState<Record<string, number>>({});
  // Settlement: month-based (급여 정산은 월 기준)
  const nowForSettlement = new Date();
  const [settlementYear, setSettlementYear] = useState(nowForSettlement.getFullYear());
  const [settlementMonth, setSettlementMonth] = useState(nowForSettlement.getMonth()); // 0-indexed
  const [studentTabPeriodIdx, setStudentTabPeriodIdx] = useState(-1);
  const [studentTypeFilter, setStudentTypeFilter] = useState<"regular" | "paused" | "corporate">("regular");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [editStudent, setEditStudent] = useState<StudentFull | null>(null);
  const [rescheduleSession, setRescheduleSession] = useState<ClassSession | null>(null);
  const [editMeeting, setEditMeeting] = useState<BusinessMeeting | null>(null);
  const [showAddSession, setShowAddSession] = useState(false);
  const [addSessionDefaultDate, setAddSessionDefaultDate] = useState("");
  const [showBulkGoalModal, setShowBulkGoalModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reviewHw, setReviewHw] = useState<{ assignment: HomeworkAssignment; submission: HomeworkSubmission } | null>(null);
  const [viewCheckedHw, setViewCheckedHw] = useState<{ assignment: HomeworkAssignment; submission: HomeworkSubmission } | null>(null);
  const [expandedHwStudent, setExpandedHwStudent] = useState<string | null>(null);
  const [expandedTodayHwSession, setExpandedTodayHwSession] = useState<string | null>(null);
  const [studentFeedbackModal, setStudentFeedbackModal] = useState<{ students: { student_name: string; level: string | null; learning_objective: string | null }[]; periodId: string; periodLabel: string; periodStartDate: string; periodEndDate: string } | null>(null);
  const [cancellationModal, setCancellationModal] = useState<{ session: ClassSession } | null>(null);
  const [preClassChecklist, setPreClassChecklist] = useState<ClassSession | null>(null);

  const handleRestoreCancellation = async (s: ClassSession) => {
    const wasCarryOverNext = s.is_carryover && s.carryover_direction === "next";

    const { error } = await supabase.from("class_sessions").update({
      cancellation_type: null,
      cancellation_resolution: null,
      is_carryover: false,
      carryover_direction: null,
      carryover_reason: null,
    } as any).eq("id", s.id);

    if (error) {
      toast({ title: "복원 실패", description: error.message, variant: "destructive" });
      return;
    }

    // Auto-delete mirror session in next month (only if untouched)
    let mirrorDeletedNote = "";
    if (wasCarryOverNext) {
      const { data: mirrors } = await supabase
        .from("class_sessions")
        .select("id, scheduled_at, started_at, ended_at, notes, gcal_event_id")
        .eq("student_name", s.student_name)
        .eq("carryover_direction", "prev")
        .gt("scheduled_at", s.scheduled_at)
        .order("scheduled_at", { ascending: true })
        .limit(1);
      const mirror = mirrors?.[0] as { id: string; scheduled_at: string; started_at: string | null; ended_at: string | null; notes: string | null; gcal_event_id: string | null } | undefined;
      if (mirror && !mirror.started_at && !mirror.ended_at && (!mirror.notes || mirror.notes.replace(/<[^>]*>/g, "").trim() === "")) {
        await supabase.from("class_sessions").delete().eq("id", mirror.id);
        // Best-effort: delete mirror calendar event too
        try {
          await supabase.functions.invoke("sync-calendar-event", {
            body: {
              action: "delete",
              session_id: mirror.id,
              instructor_name: s.instructor_name,
              student_name: s.student_name,
              scheduled_at: mirror.scheduled_at,
              gcal_event_id: mirror.gcal_event_id,
            },
          });
        } catch (e) { console.warn("[gcal mirror delete] skipped", e); }
        setSessions(prev => prev.filter(sess => sess.id !== mirror.id));
        mirrorDeletedNote = " · 다음달 이월 세션도 삭제됨";
      }
    }

    toast({ title: `취소 상태가 복원되었습니다${mirrorDeletedNote}` });
    setSessions(prev => prev.map(sess => sess.id === s.id ? { ...sess, cancellation_type: null, cancellation_resolution: null, is_carryover: false, carryover_direction: null, carryover_reason: null } : sess));

    // Best-effort: re-create the calendar event that was removed on cancel
    try {
      await supabase.functions.invoke("sync-calendar-event", {
        body: {
          action: "create",
          session_id: s.id,
          instructor_name: s.instructor_name,
          student_name: s.student_name,
          scheduled_at: s.scheduled_at,
          meet_link: s.meet_link,
          gcal_event_id: s.gcal_event_id,
        },
      });
    } catch (e) { console.warn("[gcal restore] skipped", e); }
  };

  useEffect(() => { init(); }, [viewingInstructorId]);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setUser({ email: user.email ?? "" });
    setAuthUserId(user.id);

    // Check admin/manager/staff role
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const adminRoles = (adminRole || []).map(r => r.role);
    // Admin page is strictly restricted to the owner account
    const OWNER_EMAIL = "reinainbiz@gmail.com";
    const hasAdminAccess = (adminRoles.includes("admin") || adminRoles.includes("manager") || adminRoles.includes("staff"))
      && user.email === OWNER_EMAIL;
    if (hasAdminAccess) setIsAdmin(true);

    // If admin is viewing a specific instructor via query param
    if (viewingInstructorId && hasAdminAccess) {
      const { data: ins } = await supabase
        .from("instructors").select("*").eq("id", viewingInstructorId).maybeSingle();
      if (!ins) {
        toast({ title: "강사를 찾을 수 없습니다", variant: "destructive" });
        setLoading(false);
        return;
      }
      setInstructor(ins);
      setProfileName(ins.name);
      setIsViewingAsAdmin(true);
      setProfileNickname("");
      await loadData(ins);
      return;
    }

    // Try user_id first, fallback to email
    let { data: ins } = await supabase
      .from("instructors").select("*").eq("user_id", user.id).maybeSingle();
    if (!ins) {
      const res = await supabase
        .from("instructors").select("*").eq("email", user.email!).maybeSingle();
      ins = res.data;
    }

    if (!ins) {
      toast({ title: "강사 계정을 찾을 수 없습니다", variant: "destructive" });
      setLoading(false);
      return;
    }
    setInstructor(ins);
    setProfileName(ins.name);
    // Load display_name from user_roles
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("display_name")
      .eq("user_id", user.id)
      .eq("role", "instructor")
      .maybeSingle();
    setProfileNickname(roleData?.display_name || "");
    await loadData(ins);
  };

  const loadData = useCallback(async (ins: Instructor) => {
    setLoading(true);

    // First fetch students to collect all instructor_name variants
    const studRes = await supabase.from("instructor_students").select("*").eq("instructor_id", ins.id);
    const loadedStudents = studRes.data || [];

    // Collect unique instructor names (ins.name + any instructor_name from students)
    const nameSet = new Set<string>([ins.name]);
    loadedStudents.forEach(s => { if (s.instructor_name) nameSet.add(s.instructor_name); });
    const instructorNames = Array.from(nameSet);

    // Load pauses for students
    const studentIds = loadedStudents.map((s: any) => s.id);
    const pauseRes = studentIds.length > 0
      ? await supabase.from("student_pauses").select("id,student_id,pause_start,pause_end").in("student_id", studentIds).order("pause_start")
      : { data: [] };
    const pauseMap: Record<string, PauseRecord[]> = {};
    (pauseRes.data || []).forEach((p: any) => {
      if (!pauseMap[p.student_id]) pauseMap[p.student_id] = [];
      pauseMap[p.student_id].push(p);
    });
    const studentsWithPauses: StudentFull[] = loadedStudents.map((s: any) => ({
      ...s,
      pauses: pauseMap[s.id] || [],
    }));

    // Also collect student names to catch sessions that might have a stale instructor_name
    const studentNames = loadedStudents.map((s: any) => s.student_name).filter(Boolean);

    const [sessRes, sessRes2, hwRes, subRes, meetRes, periodRes, vocabRes, holRes, allInsRes, attendedRes] = await Promise.all([
      supabase.from("class_sessions").select("*").in("instructor_name", instructorNames).order("scheduled_at", { ascending: false }),
      studentNames.length > 0
        ? supabase.from("class_sessions").select("*").in("student_name", studentNames).order("scheduled_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase.from("homework_assignments").select("id,title,type,description,student_name,session_id,is_preset,preset_origin_id"),
      supabase.from("homework_submissions").select("id,assignment_id,status,student_name,submitted_at,text_content,audio_url,file_url,instructor_note,reviewed_at,ai_correction"),
      supabase.from("business_meetings").select("*").eq("instructor_id", ins.id).order("scheduled_at", { ascending: false }),
      supabase.from("schedule_periods").select("*").eq("is_active", true).order("start_date", { ascending: true }),
      supabase.from("vocabulary_tests").select("id,student_name,started_at,completed_at,score,total"),
      supabase.from("holiday_notices").select("date_start,date_end"),
      supabase.from("instructors").select("id,name").eq("active", true),
      supabase.from("business_meeting_attendees").select("meeting_id,instructor_id").eq("instructor_id", ins.id) as any,
    ]);

    const studentsByName = new Map<string, StudentFull[]>();
    studentsWithPauses.forEach((s) => {
      const key = s.student_name;
      if (!studentsByName.has(key)) studentsByName.set(key, []);
      studentsByName.get(key)!.push(s);
    });

    const getKSTDateString = (dateValue: string) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(dateValue));

    const isWithinStudentWindow = (student: StudentFull, dateStr: string) => {
      if (student.start_date && dateStr < student.start_date) return false;
      // end_date는 이관일(새 강사 시작일)이므로 당일부터는 제외
      if (student.end_date && dateStr >= student.end_date) return false;
      return true;
    };

    const sessionBelongsToThisInstructor = (session: { student_name: string; scheduled_at: string }) => {
      const candidates = studentsByName.get(session.student_name) || [];
      if (candidates.length === 0) return false;
      const dateStr = getKSTDateString(session.scheduled_at);
      return candidates.some((st) => isWithinStudentWindow(st, dateStr));
    };

    const shouldHideSession = (session: { student_name: string; scheduled_at: string }) => {
      const candidates = studentsByName.get(session.student_name) || [];
      const dateStr = getKSTDateString(session.scheduled_at);
      const matchingStudents = candidates.filter((st) => isWithinStudentWindow(st, dateStr));
      if (matchingStudents.length === 0) return true;
      return matchingStudents.some(
        (st) => st.pauses?.some((p) => dateStr >= p.pause_start && (!p.pause_end || dateStr <= p.pause_end)) ?? false,
      );
    };

    const getEffectiveMeetLink = (session: ClassSession) => {
      const dateStr = getKSTDateString(session.scheduled_at);
      const matched = (studentsByName.get(session.student_name) || [])
        .filter((st) => isWithinStudentWindow(st, dateStr))
        .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""))[0];
      return matched?.meet_link || session.meet_link;
    };

    // Merge and deduplicate sessions from both queries
    const sessMap = new Map<string, any>();
    for (const s of (sessRes.data || [])) sessMap.set(s.id, s);
    for (const s of (sessRes2.data || [])) sessMap.set(s.id, s);
    const filteredSessions = Array.from(sessMap.values())
      .filter((s) => sessionBelongsToThisInstructor(s) && !shouldHideSession(s))
      .map((s) => ({ ...s, meet_link: getEffectiveMeetLink(s as ClassSession) }));

    setStudents(studentsWithPauses);
    setSessions(filteredSessions);
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
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
    const periods = periodRes.data || [];
    setAllPeriods(periods);
    const currentIdx = periods.findIndex(p => p.start_date <= todayStr && p.end_date >= todayStr);
    // If today is not in any period (휴강 기간 등), pick the next upcoming period; fallback to most recent past
    const upcomingPeriod = periods.find(p => p.start_date > todayStr);
    const lastPastPeriod = [...periods].reverse().find(p => p.end_date < todayStr);
    const currentPeriod = currentIdx >= 0 ? periods[currentIdx] : (upcomingPeriod || lastPastPeriod || periods[0] || null);
    setPeriod(currentPeriod);
    if (studentTabPeriodIdx < 0) setStudentTabPeriodIdx(periods.length > 0 ? periods.length - 1 : 0);
    // settlementPeriodIdx removed — settlement uses month-based navigation
    setHolidays(holRes.data || []);

    // Fetch pending makeup request count + approved makeups (for badges)
    const { count: makeupCount } = await supabase
      .from("makeup_requests")
      .select("*", { count: "exact", head: true })
      .eq("instructor_name", ins.name)
      .eq("status", "pending");
    setPendingMakeupCount(makeupCount || 0);

    const { data: approvedMk } = await supabase
      .from("makeup_requests")
      .select("student_name,original_scheduled_at,urgent_reason,created_at,status,request_type")
      .eq("instructor_name", ins.name)
      .in("status", ["approved", "cancel_requested"])
      .eq("request_type", "reschedule");
    setApprovedMakeups((approvedMk || []) as any);

    setLoading(false);

    // ── Check for past periods with completed sessions but missing feedback ──
    const pastPeriods = periods.filter(p => p.end_date < todayStr);
    if (pastPeriods.length > 0 && ins) {
      // Check the most recent past period first
      const sortedPast = [...pastPeriods].sort((a, b) => b.end_date.localeCompare(a.end_date));
      for (const pp of sortedPast) {
        // Find students who had completed sessions in this period
        const periodSessions = filteredSessions.filter(s =>
          s.ended_at &&
          s.scheduled_at >= pp.start_date &&
          s.scheduled_at <= pp.end_date + "T23:59:59"
        );
        const completedStudentNames = [...new Set(periodSessions.map(s => s.student_name))];
        if (completedStudentNames.length === 0) continue;

        // Check which students already have feedback for this period
        const { data: existingFb } = await supabase
          .from("instructor_student_feedback" as any)
          .select("student_name")
          .eq("instructor_name", ins.name)
          .eq("period_id", pp.id);
        const alreadyDone = new Set((existingFb || []).map((f: any) => f.student_name));
        const needFeedback = completedStudentNames.filter(sn => !alreadyDone.has(sn));

        if (needFeedback.length > 0) {
          const feedbackStudents = needFeedback.map(sn => {
            const st = studentsWithPauses.find(s2 => s2.student_name === sn);
            return { student_name: sn, level: st?.level || null, learning_objective: st?.learning_objective || null };
          });
          setStudentFeedbackModal({ students: feedbackStudents, periodId: pp.id, periodLabel: pp.label, periodStartDate: pp.start_date, periodEndDate: pp.end_date });
          break; // Only show one period at a time
        }
      }
    }
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
  const englishNameMap = new Map(students.map(s => [s.student_name, s.english_name]));
  const fmtName = (name: string) => formatStudentName(name, englishNameMap.get(name));
  const myStudentNames = new Set(students.map((s) => s.student_name));
  // Active students for "current" responsibilities (homework queue, upcoming sessions)
  // Excludes students whose assignment to this instructor has ended (transferred out)
  const todayKST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const activeStudentNames = new Set(
    students
      .filter((s) => !s.end_date || s.end_date >= todayKST)
      .map((s) => s.student_name)
  );
  const todaySessions = sessions.filter((s) => isToday(s.scheduled_at))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const upcomingSessions = sessions.filter((s) => msUntil(s.scheduled_at) > 0)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  // Next class day sessions (first future date that has sessions, excluding today)
  // Hides both cancelled rows and rows whose KST date has been rescheduled to another session.
  // See src/lib/sessionVisibility.ts for the shared rule used by SessionSidebar/StudentDashboard too.
  const nextClassDaySessions = (() => {
    const todayStr = new Date().toDateString();
    const movedAwayKeys = getMovedAwayKeys(sessions);
    const futureSessions = sessions
      .filter((s) => {
        const d = new Date(s.scheduled_at);
        if (d.toDateString() === todayStr || d.getTime() <= Date.now()) return false;
        if (isEffectivelyInactive(s, movedAwayKeys)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    if (futureSessions.length === 0) return [];
    const nextDateStr = new Date(futureSessions[0].scheduled_at).toDateString();
    return futureSessions.filter((s) => new Date(s.scheduled_at).toDateString() === nextDateStr);
  })();

  const myAssignments = assignments.filter((a) => activeStudentNames.has(a.student_name));

  // Find next upcoming session per student (for unchecked homework)
  const nowDate = new Date();
  const nextSessionByStudent = new Map<string, ClassSession>();
  sessions
    .filter(s => new Date(s.scheduled_at) > nowDate && activeStudentNames.has(s.student_name))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .forEach(s => {
      if (!nextSessionByStudent.has(s.student_name)) {
        nextSessionByStudent.set(s.student_name, s);
      }
    });

  // Find most recent past session per student (for 과제 제출 현황)
  const latestSessionByStudent = new Map<string, string>();
  sessions
    .filter(s => new Date(s.scheduled_at) <= nowDate && activeStudentNames.has(s.student_name))
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
    .forEach(s => {
      if (!latestSessionByStudent.has(s.student_name)) {
        latestSessionByStudent.set(s.student_name, s.id);
      }
    });

  // Build submission-based unchecked homework entries
  // Each entry is { assignment, submission } so preset assignments with multiple submissions each get their own row
  type HwEntry = { assignment: HomeworkAssignment; submission: HomeworkSubmission };

  const instructorNameSet = new Set<string>([instructor?.name || ""].concat(
    students.filter(s => (!s.end_date || s.end_date >= todayKST) && s.instructor_name).map(s => s.instructor_name as string)
  ));
  const sessionById = new Map(sessions.map(s => [s.id, s]));

  const uncheckedHwAllEntries: HwEntry[] = (() => {
    const entries: HwEntry[] = [];
    for (const a of myAssignments) {
      if (a.is_preset) {
        // For presets: find ALL submitted submissions
        const subs = submissions.filter(s => s.assignment_id === a.id && s.status === "submitted");
        for (const sub of subs) {
          entries.push({ assignment: a, submission: sub });
        }
      } else {
        // For session-specific: gate by session belonging to this instructor (post-transfer safety)
        const sess = a.session_id ? sessionById.get(a.session_id) : null;
        if (sess && !instructorNameSet.has(sess.instructor_name)) continue;
        const sub = submissions.find(s => s.assignment_id === a.id && s.status === "submitted");
        if (sub) entries.push({ assignment: a, submission: sub });
      }
    }
    // Sort by submitted_at descending
    entries.sort((a, b) => new Date(b.submission.submitted_at).getTime() - new Date(a.submission.submitted_at).getTime());
    return entries;
  })();

  // Keep ALL submitted-but-unreviewed entries in the main 미확인 list, regardless of how
  // many sessions have passed since the assignment. Submitted homework should never be
  // hidden in a collapsed "older" section just because the next class already happened.
  const uncheckedHwEntries = uncheckedHwAllEntries;

  const uncheckedSubIds = new Set(uncheckedHwEntries.map(e => e.submission.id));
  const olderUncheckedHwEntries = uncheckedHwAllEntries.filter(e => !uncheckedSubIds.has(e.submission.id));

  // Legacy aliases for stats
  const uncheckedHw = uncheckedHwEntries;
  const olderUncheckedHw = olderUncheckedHwEntries;

  // Reviewed homework entries: show until next session for that student starts
  const checkedHwEntries: HwEntry[] = (() => {
    const entries: HwEntry[] = [];
    for (const a of myAssignments) {
      const reviewedSubs = a.is_preset
        ? submissions.filter(s => s.assignment_id === a.id && s.status === "reviewed")
        : [submissions.find(s => s.assignment_id === a.id && s.status === "reviewed")].filter(Boolean) as HomeworkSubmission[];
      for (const sub of reviewedSubs) {
        // For session-specific: check if next session started
        const assignmentSession = a.session_id ? sessions.find(s => s.id === a.session_id) : null;
        if (!a.is_preset && !assignmentSession) continue;
        if (a.is_preset) {
          // For presets: show reviewed submissions from current period only (reviewed within last 2 weeks)
          const twoWeeksAgo = new Date(nowDate.getTime() - 14 * 86400000);
          if (sub.reviewed_at && new Date(sub.reviewed_at) < twoWeeksAgo) continue;
          entries.push({ assignment: a, submission: sub });
        } else {
          const nextSession = sessions
            .filter(s => s.student_name === a.student_name && new Date(s.scheduled_at) > new Date(assignmentSession!.scheduled_at))
            .sort((x, y) => new Date(x.scheduled_at).getTime() - new Date(y.scheduled_at).getTime())[0];
          if (nextSession && new Date(nextSession.scheduled_at) <= new Date()) continue;
          entries.push({ assignment: a, submission: sub });
        }
      }
    }
    entries.sort((a, b) => new Date(b.submission.reviewed_at || b.submission.submitted_at).getTime() - new Date(a.submission.reviewed_at || a.submission.submitted_at).getTime());
    return entries;
  })();
  const checkedHw = checkedHwEntries;

  // Period stats — 신규 정산 규정 (이번 달부터 적용)
  // BASE_PAY/LEVEL_RATES/getLevelCategory/calcSessionPay imported from '@/lib/instructorPay'
  const start = period ? new Date(period.start_date) : null;
  const end = period ? new Date(period.end_date) : null;
  const now = new Date();
  // Helper: check if session should be hidden by student's start date or pause periods
  const isSessionHidden = (session: { student_name: string; scheduled_at: string }) => {
    const st = students.find(s => s.student_name === session.student_name);
    if (!st) return false;
    const d = session.scheduled_at.slice(0, 10);
    if (st.student_type !== "corporate" && st.start_date && d < st.start_date) return true;
    return st.pauses?.some(p => d >= p.pause_start && (!p.pause_end || d <= p.pause_end)) ?? false;
  };

  // Classify a session's makeup badge
  const getMakeupBadge = (s: ClassSession): "carryover_prev" | "urgent_makeup" | "makeup_48h" | null => {
    if (s.is_carryover && s.carryover_direction === "prev") return "carryover_prev";
    if (!s.reschedule_origin_dates || s.reschedule_origin_dates.length === 0) return null;
    const originDates = new Set(s.reschedule_origin_dates);
    const match = approvedMakeups.find((r) => {
      if (r.student_name !== s.student_name || !r.original_scheduled_at) return false;
      const od = new Date(r.original_scheduled_at).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
      return originDates.has(od);
    });
    if (!match) return "makeup_48h";
    if (match.urgent_reason) return "urgent_makeup";
    if (match.original_scheduled_at) {
      const hoursBefore = (new Date(match.original_scheduled_at).getTime() - new Date(match.created_at).getTime()) / 3600_000;
      if (hoursBefore < 48) return "urgent_makeup";
    }
    return "makeup_48h";
  };
  const MAKEUP_BADGE_META: Record<string, { label: string; className: string }> = {
    carryover_prev: { label: "전월 이월", className: "bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]" },
    urgent_makeup: { label: "예외 보강", className: "bg-destructive/10 text-destructive" },
    makeup_48h: { label: "48h 보강", className: "bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]" },
  };

  const periodSessions = sessions.filter((s) => {
    if (!start || !end) return false;
    const d = new Date(s.scheduled_at);
    return d >= start && d <= end && !isSessionHidden(s);
  });
  const completedPeriodSessions = periodSessions.filter((s) => new Date(s.scheduled_at) <= now);
  const periodMeetings = meetings.filter((m) => {
    if (!start || !end) return false;
    const d = new Date(m.scheduled_at);
    return d >= start && d <= end;
  });
  const completedPeriodMeetings = periodMeetings.filter((m) => new Date(m.scheduled_at) <= now);
  const lessonHours = periodSessions.length;

  // Monthly completed lesson count for dashboard summary card (완료 버튼 기준)
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const currentMonthNum = now.getMonth() + 1;
  const monthlyLessonCount = sessions.filter((s) => {
    const d = new Date(s.scheduled_at);
    return d >= currentMonthStart && d <= currentMonthEnd && !isSessionHidden(s) && !!s.ended_at;
  }).length;

  // Settlement: month-based filtering (급여 정산은 월 기준)
  const sStart = new Date(settlementYear, settlementMonth, 1);
  const sEnd = new Date(settlementYear, settlementMonth + 1, 0, 23, 59, 59);
  const settlementLabel = `${settlementYear}-${String(settlementMonth + 1).padStart(2, "0")}`;
  const settlementDateRange = `${settlementYear}-${String(settlementMonth + 1).padStart(2, "0")}-01 ~ ${settlementYear}-${String(settlementMonth + 1).padStart(2, "0")}-${String(sEnd.getDate()).padStart(2, "0")}`;

  const settlementSessions = sessions.filter((s) => {
    const d = new Date(s.scheduled_at);
    return d >= sStart && d <= sEnd && !isSessionHidden(s);
  });
  const isOwner = instructor?.position === '대표';
  // Settlement: 신규 규정 적용 (이번 달부터). calcSessionPay가 included 판정.
  const completedSettlementSessions = settlementSessions.filter((s) => {
    const r = calcSessionPay(s as any, { isOwner, ownerFlatRate: instructor?.lesson_rate ?? 50000 });
    return r.included;
  });
  const settlementMeetings = meetings.filter((m) => {
    const d = new Date(m.scheduled_at);
    return d >= sStart && d <= sEnd;
  });
  const completedSettlementMeetings = settlementMeetings.filter((m) => new Date(m.scheduled_at) <= now);

  // Settlement items for the table
  type SettlementRow = { key: string; date: Date; type: 'lesson' | 'meeting'; description: string; durationHours: number; payPerHour: number; };
  const settlementRows: SettlementRow[] = [];
  completedSettlementSessions.forEach((s) => {
    const r = calcSessionPay(s as any, { isOwner, ownerFlatRate: instructor?.lesson_rate ?? 50000 });
    const key = `lesson-${s.id}`;
    const durationHours = durationOverrides[key] ?? 1;
    settlementRows.push({
      key,
      date: new Date(s.scheduled_at),
      type: 'lesson',
      description: `${fmtName(s.student_name)} 수업 (${getLevelCategory(s.level)})${r.noteSuffix}`,
      durationHours,
      payPerHour: r.payPerHour,
    });
  });
  // 대표는 미팅 정산 제외
  if (!isOwner) {
    completedSettlementMeetings.forEach((m) => {
      const key = `meeting-${m.id}`;
      const durationHours = durationOverrides[key] ?? (m.duration_minutes / 60);
      settlementRows.push({
        key,
        date: new Date(m.scheduled_at),
        type: 'meeting',
        description: m.notes || '업무 미팅',
        durationHours,
        payPerHour: BASE_PAY,
      });
    });
  }
  settlementRows.sort((a, b) => a.date.getTime() - b.date.getTime());

  let cumulative = 0;
  const settlementWithCumulative = settlementRows.map((row) => {
    const pay = Math.round(row.durationHours * row.payPerHour);
    cumulative += pay;
    return { ...row, pay, cumulative };
  });

  const totalAmount = cumulative;

  // Current month total for dashboard card (완료 기준 + 신규 정산 규정)
  const currentMonthTotal = (() => {
    let total = 0;
    sessions.filter(s => {
      const d = new Date(s.scheduled_at);
      return d >= currentMonthStart && d <= currentMonthEnd && !isSessionHidden(s);
    }).forEach(s => {
      const r = calcSessionPay(s as any, { isOwner, ownerFlatRate: instructor?.lesson_rate ?? 50000 });
      if (!r.included) return;
      const key = `lesson-${s.id}`;
      const dur = durationOverrides[key] ?? 1;
      total += Math.round(dur * r.payPerHour);
    });
    if (!isOwner) {
      meetings.filter(m => {
        const d = new Date(m.scheduled_at);
        return d >= currentMonthStart && d <= currentMonthEnd && d <= now;
      }).forEach(m => {
        const key = `meeting-${m.id}`;
        const dur = durationOverrides[key] ?? (m.duration_minutes / 60);
        total += Math.round(dur * BASE_PAY);
      });
    }
    return total;
  })();



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
      if (st.start_date && selDateStr < st.start_date) return;
      if (st.end_date && selDateStr >= st.end_date) return;
      if (st.pauses?.some((p) => selDateStr >= p.pause_start && (!p.pause_end || selDateStr <= p.pause_end))) return;

      let slots: ScheduleSlot[] = [];
      try {
        slots = JSON.parse(st.schedules);
      } catch {
        return;
      }
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

    // Weekly homework: count submissions made AFTER the most recent past session
    const sAssignments = assignments.filter((a) => a.student_name === studentName);
    const sSubmissions = submissions.filter((s) => s.student_name === studentName);

    // Find most recent past session for this student
    const latestPastSession = sSessions
      .filter(s => new Date(s.scheduled_at) <= now)
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];
    const latestSessionTime = latestPastSession ? new Date(latestPastSession.scheduled_at).getTime() : 0;

    // For preset assignments: count submissions after latest session
    // For session-specific assignments: count submissions for latest session's assignments
    let weekSubmittedCount = 0;
    const latestSessionId = latestPastSession?.id;
    for (const a of sAssignments) {
      if (a.is_preset && a.type === "memorizing") continue; // vocab test handles this
      const sub = sSubmissions.find(s => s.assignment_id === a.id);
      if (!sub || (sub.status !== "submitted" && sub.status !== "reviewed")) continue;
      if (a.is_preset) {
        if (latestPastSession && sub.submitted_at && new Date(sub.submitted_at).getTime() >= latestSessionTime) {
          weekSubmittedCount++;
        }
      } else if (a.session_id === latestSessionId) {
        weekSubmittedCount++;
      }
    }

    // Weekly vocab tests: count tests after latest past session
    const weekVocabTests = vocabTests.filter((v) => {
      if (v.student_name !== studentName) return false;
      if (!latestPastSession) return false;
      const d = new Date(v.started_at);
      return d.getTime() >= latestSessionTime;
    });

    return {
      completedMonthSessions,
      monthTotal,
      weekSubmittedHw: weekSubmittedCount,
      totalHw: sAssignments.filter(a => !(a.is_preset && a.type === "memorizing")).filter(a => a.is_preset || a.session_id === latestSessionId).length,
      weekVocabCount: weekVocabTests.length,
    };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Admin viewing banner */}
      {isViewingAsAdmin && (
        <div className="bg-navy text-primary-foreground px-4 py-2 flex items-center justify-between text-sm">
          <span className="font-medium">👀 {instructor.name} 강사의 대시보드를 보고 있습니다</span>
          <Button size="sm" variant="secondary" onClick={() => navigate("/admin")} className="h-7 text-xs">
            어드민으로 돌아가기
          </Button>
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-border px-3 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center shadow-gold">
              <BookOpen className="w-4 h-4 text-accent-foreground" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">The Lounge English</p>
              <p className="text-[10px] text-muted-foreground">{profileNickname || instructor.name} · {instructor.position || '강사'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => navigate("/admin")} className="h-8 text-xs gap-1 sm:gap-1.5 text-muted-foreground px-2 sm:px-3">
                <Shield className="w-3 h-3" /> <span className="hidden sm:inline">관리자</span>
              </Button>
            )}
            <Button size="sm" onClick={() => setShowMeetingModal(true)}
              className="h-8 text-xs gap-1 sm:gap-1.5 bg-navy hover:bg-navy-light text-primary-foreground px-2 sm:px-3"
            >
              <Plus className="w-3 h-3" /> <span className="hidden sm:inline">업무 미팅</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowBugReport(true)} className="h-8 text-xs gap-1 text-muted-foreground px-2 sm:px-3" title="버그 신고 / 개선 제안">
              <Bug className="w-3 h-3" /> <span className="hidden sm:inline">제안/신고</span>
            </Button>
            {authUserId && <NotificationInbox userId={authUserId} role="instructor" />}
            <Button size="sm" variant="outline" onClick={handleLogout} className="h-8 text-xs gap-1 text-muted-foreground px-2">
              <LogOut className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </header>

      <BugReportModal
        open={showBugReport}
        onClose={() => setShowBugReport(false)}
        userName={instructor.name}
        role="instructor"
      />



      <div className="border-b border-border bg-card px-2 sm:px-5 overflow-x-auto scrollbar-none">
        <div className="flex gap-0 max-w-5xl mx-auto min-w-max">
          {[
            { id: "dashboard" as const, label: "대시보드", icon: CalendarDays },
            { id: "students" as const, label: "학생 관리", icon: Users },
            { id: "feedback" as const, label: "피드백", icon: MessageSquare },
            { id: "makeup" as const, label: "보강", icon: RotateCcw, badge: pendingMakeupCount },
            { id: "settlement" as const, label: "정산", icon: Banknote },
            { id: "guide" as const, label: "가이드", icon: BookOpen },
            { id: "profile" as const, label: "MY", icon: User },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn("flex items-center gap-1.5 px-3 sm:px-4 py-3 text-[13px] sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap relative",
                activeTab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label}</span>
              {"badge" in t && (t as any).badge > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold">
                  {(t as any).badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ═══ DASHBOARD TAB ═══════════════════════════════════════════════ */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "dashboard" && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {[
                { label: "담당 학생", value: `${students.filter(s => s.status === "active" && (!s.start_date || !period || s.start_date <= period.end_date) && (!s.end_date || s.end_date > new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()))).length}명`, icon: Users, color: "text-navy", bg: "bg-navy/10" },
                { label: `${currentMonthNum}월 수업`, value: `${monthlyLessonCount}회`, icon: BookOpen, color: "text-gold-dark", bg: "bg-gold/10" },
                { label: "미확인 숙제", value: `${uncheckedHw.length}건`, icon: ClipboardCheck, color: uncheckedHw.length > 0 ? "text-destructive" : "text-success", bg: uncheckedHw.length > 0 ? "bg-destructive/10" : "bg-success/10" },
                { label: `${currentMonthNum}월 정산 예정`, value: `₩${currentMonthTotal.toLocaleString()}`, icon: Banknote, color: "text-success", bg: "bg-success/10" },
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
                    period={period}
                    allPeriods={allPeriods}
                    onPeriodChange={setPeriod}
                  />
                </div>

                {/* Selected date detail */}
                {selectedDate && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      {selectedDate.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" })} 일정
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{selectedDaySessions.length + selectedDayVirtual.length + selectedDayMeetings.length}건</span>
                      {(() => {
                        const withNotes = selectedDaySessions.filter(s => s.notes && s.notes.replace(/<[^>]*>/g, "").trim().length > 0);
                        if (withNotes.length === 0) return null;
                        return (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                            onClick={async () => {
                              const dateLabel = selectedDate.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
                              await exportNotesPdf(
                                withNotes.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()).map(s => {
                                  const studentSessions = sessions
                                    .filter(ss => ss.student_name === s.student_name && new Date(ss.scheduled_at) <= new Date(s.scheduled_at))
                                    .sort((a2, b2) => new Date(a2.scheduled_at).getTime() - new Date(b2.scheduled_at).getTime());
                                  const lessonNumber = studentSessions.findIndex(ss => ss.id === s.id) + 1;
                                  return { ...s, remarks: null, student_name: s.student_name, level: s.level, lessonNumber: lessonNumber || null };
                                }),
                                `${instructor?.name || "강사"}_${dateLabel}`
                              );
                              toast({ title: `${withNotes.length}명의 수업노트를 PDF로 내보냈습니다` });
                            }}
                          >
                            <Download className="w-3 h-3" />노트 PDF
                          </Button>
                        );
                      })()}
                    </h3>
                    {selectedDaySessions.length === 0 && selectedDayVirtual.length === 0 && selectedDayMeetings.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">예정된 일정이 없습니다</p>
                    ) : (
                      <div className="space-y-2">
                        {/* Actual sessions */}
                        {selectedDaySessions.map((s) => {
                          const isCancelled = !!s.cancellation_type;
                          const isCompleted = !!s.ended_at;
                          const cancelMeta = s.cancellation_type ? CANCELLATION_META[s.cancellation_type as CancellationType] : null;
                          return (
                          <div key={s.id} className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
                            isCancelled ? "border-muted-foreground/20 bg-muted/30 opacity-70" :
                            isCompleted ? "border-success/30 bg-success/5 hover:bg-success/10" :
                            "border-border bg-muted/20 hover:bg-muted/40"
                          )}>
                            <div className="text-center w-12 flex-shrink-0">
                              <p className="text-xs font-bold text-navy">{fmtTime(s.scheduled_at)}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={cn("text-sm font-medium", isCancelled ? "line-through text-muted-foreground" : "text-foreground")}>{fmtName(s.student_name)}</p>
                                {isCancelled && cancelMeta && (
                                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0", cancelMeta.bgColor, cancelMeta.color)}>
                                    {cancelMeta.label}
                                    {s.cancellation_resolution === 'makeup' && ' · 보강'}
                                    {s.cancellation_resolution === 'carry_over' && ' · 이월'}
                                    {s.cancellation_resolution === 'refund' && ' · 환불'}
                                  </span>
                                )}
                                {isCompleted && !isCancelled && <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                              </div>
                              <p className="text-[11px] text-muted-foreground">{s.topic || s.level}</p>
                              {s.reschedule_origin_dates && s.reschedule_origin_dates.length > 0 && (
                                <p className="text-[10px] text-gold-dark flex items-center gap-1 mt-0.5 flex-wrap">
                                  <RefreshCw className="w-2.5 h-2.5" />
                                  <MakeupBadges isMakeup isUrgent={s.is_urgent_makeup} />
                                  <span>{s.reschedule_origin_dates.map(d => new Date(d + "T00:00:00").toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" })).join(", ")}에서 변경됨</span>
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {!isCancelled && !isCompleted && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] gap-0.5 border-destructive/30 text-destructive px-1.5"
                                  onClick={() => setCancellationModal({ session: s })}
                                >
                                  <X className="w-3 h-3" /> 취소
                                </Button>
                              )}
                              {isCancelled && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] gap-0.5 border-muted-foreground/30 text-muted-foreground px-1.5"
                                  onClick={() => handleRestoreCancellation(s)}
                                >
                                  <RotateCcw className="w-3 h-3" /> 복원
                                </Button>
                              )}
                              <button
                                onClick={() => setRescheduleSession(s)}
                                className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-muted"
                                title="일정 변경"
                              >
                                <CalendarDays className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  const hasNotes = s.notes && s.notes.replace(/<[^>]*>/g, "").trim().length > 0;
                                  const hasStarted = !!s.started_at || !!s.ended_at;
                                  const hasTopic = !!s.topic;
                                  const warnings: string[] = [];
                                  if (hasNotes) warnings.push("📝 수업 노트가 작성되어 있습니다");
                                  if (hasTopic) warnings.push(`📋 주제: ${s.topic}`);
                                  if (hasStarted) warnings.push("⏱ 수업이 진행된 기록이 있습니다");
                                  const msg = warnings.length > 0
                                    ? `⚠️ ${s.student_name} 수업을 삭제하시겠습니까?\n\n${warnings.join("\n")}\n\n삭제하면 복구할 수 없습니다!`
                                    : `${s.student_name} 수업을 삭제하시겠습니까?`;
                                  if (!confirm(msg)) return;
                                  if (warnings.length > 0 && !confirm("정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
                                  const { error } = await supabase.from("class_sessions").delete().eq("id", s.id);
                                  if (error) { toast({ title: "삭제 실패", description: error.message, variant: "destructive" }); return; }
                                  setSessions(prev => prev.filter(x => x.id !== s.id));
                                  // Best-effort: remove the linked Google Calendar event
                                  try {
                                    await supabase.functions.invoke("sync-calendar-event", {
                                      body: {
                                        action: "delete",
                                        instructor_name: s.instructor_name,
                                        student_name: s.student_name,
                                        scheduled_at: s.scheduled_at,
                                        gcal_event_id: s.gcal_event_id,
                                      },
                                    });
                                  } catch (e) { console.warn("[gcal cleanup] skipped", e); }
                                  toast({ title: "수업 삭제 완료" });
                                }}
                                className="text-[10px] text-muted-foreground hover:text-destructive px-1.5 py-1 rounded hover:bg-destructive/10"
                                title="수업 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {!isCancelled && (
                              <a href={`/t/classroom?sessionId=${s.id}`}>
                                <Button size="sm" className="h-6 text-[10px] gap-1 bg-navy hover:bg-navy-light text-primary-foreground px-2">
                                  <FileText className="w-3 h-3" /> 수업노트
                                </Button>
                              </a>
                              )}
                            </div>
                          </div>
                          );
                        })}
                        {/* Virtual (planned) sessions */}
                        {selectedDayVirtual.map((v, i) => (
                          <div key={`v${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-navy/20 bg-navy/5 hover:bg-navy/10 transition-colors">
                            <div className="text-center w-12 flex-shrink-0">
                              <p className="text-xs font-bold text-navy/60">{v.time}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground/70">{fmtName(v.student_name)}</p>
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
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setEditMeeting(m)}
                                className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-muted"
                                title="미팅 수정"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm("이 미팅을 삭제하시겠습니까?")) return;
                                  await supabase.from("business_meeting_attendees").delete().eq("meeting_id", m.id);
                                  const { error } = await supabase.from("business_meetings").delete().eq("id", m.id);
                                  if (error) { toast({ title: "삭제 실패", description: error.message, variant: "destructive" }); return; }
                                  setMeetings(prev => prev.filter(x => x.id !== m.id));
                                  toast({ title: "미팅 삭제 완료" });
                                }}
                                className="text-[10px] text-muted-foreground hover:text-destructive px-1.5 py-1 rounded hover:bg-destructive/10"
                                title="미팅 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {instructor?.meet_link && (
                                <a href={instructor.meet_link} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" className="h-6 text-[10px] gap-1 bg-gold hover:bg-gold-dark text-accent-foreground px-2">
                                    <Video className="w-3 h-3" /> 미팅 시작
                                  </Button>
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add session button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs gap-1.5 border-dashed mt-2"
                      onClick={() => {
                        const d = selectedDate!;
                        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                        setAddSessionDefaultDate(dateStr);
                        setShowAddSession(true);
                      }}
                    >
                      <Plus className="w-3 h-3" /> 수업 추가
                    </Button>
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
                        {new Date(nextClassDaySessions[0].scheduled_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" })}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{nextClassDaySessions.length}건</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform [[open]>&]:rotate-90" />
                    </summary>
                    <div className="px-4 pb-4 space-y-2">
                      {nextClassDaySessions.map((s) => (
                        <a
                          key={s.id}
                          href={`/t/classroom?sessionId=${s.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-navy/15 bg-card hover:bg-navy/10 transition-colors group"
                        >
                          <p className="text-xs font-bold text-navy w-12 text-center flex-shrink-0">{fmtTime(s.scheduled_at)}</p>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{fmtName(s.student_name)}</p>
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
                        {(() => {
                          const completedWithNotes = todaySessions.filter(s => (s.ended_at || new Date(s.scheduled_at) <= new Date()) && s.notes && s.notes.trim());
                          if (completedWithNotes.length === 0) return null;
                          return (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                              onClick={async () => {
                                const today = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
                                await exportNotesPdf(
                                  completedWithNotes.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()).map(s => {
                                    // Calculate lesson number for this student
                                    const studentSessions = sessions
                                      .filter(ss => ss.student_name === s.student_name && new Date(ss.scheduled_at) <= new Date(s.scheduled_at))
                                      .sort((a2, b2) => new Date(a2.scheduled_at).getTime() - new Date(b2.scheduled_at).getTime());
                                    const lessonNumber = studentSessions.findIndex(ss => ss.id === s.id) + 1;
                                    return { ...s, remarks: null, student_name: s.student_name, level: s.level, lessonNumber: lessonNumber || null };
                                  }),
                                  `${instructor?.name || "강사"}_${today}`
                                );
                                toast({ title: `${completedWithNotes.length}명의 오늘 수업노트를 PDF로 내보냈습니다` });
                              }}
                            >
                              <Download className="w-3 h-3" />오늘 노트 PDF
                            </Button>
                          );
                        })()}
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

                            const isCompleted = !!s.ended_at;
                            const isCancelled = !!s.cancellation_type;
                            const cancelMeta = s.cancellation_type ? CANCELLATION_META[s.cancellation_type] : null;
                            return (
                              <div key={s.id} className={cn(
                                "rounded-lg border px-3 py-2.5",
                                isCancelled ? "border-muted-foreground/20 bg-muted/30 opacity-70" :
                                isCompleted ? "border-success/30 bg-success/5" : "border-border bg-muted/20"
                              )}>
                                {(() => {
                                  const nowTs = new Date();
                                  const sSessions = sessions.filter(ss => ss.student_name === s.student_name);
                                  const pastSess = sSessions.filter(ss => new Date(ss.scheduled_at) <= nowTs).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
                                  const latestPast = pastSess[0] || null;
                                   const studentAssignments = assignments.filter(a => {
                                     if (a.student_name !== s.student_name) return false;
                                     if (a.is_preset) {
                                       // Only show preset template if no session copy exists for the latest past session
                                       if (!latestPast) return true;
                                       const hasCopy = assignments.some(c => c.preset_origin_id === a.id && c.session_id === latestPast.id);
                                       return !hasCopy;
                                     }
                                     return latestPast && a.session_id === latestPast.id;
                                   });
                                   // Time-scope vocab tests: between previous non-cancelled session and this session
                                   const prevNonCancelled = sSessions
                                     .filter(ss => !ss.cancellation_type && new Date(ss.scheduled_at) < new Date(s.scheduled_at))
                                     .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];
                                   const prevTime = prevNonCancelled ? new Date(prevNonCancelled.scheduled_at).getTime() : 0;
                                   const thisTime = new Date(s.scheduled_at).getTime();
                                   const stVocabAll = vocabTests.filter(v => v.student_name === s.student_name);
                                   const stVocabScoped = stVocabAll.filter(v => {
                                     const t = new Date(v.started_at).getTime();
                                     return t >= prevTime && t < thisTime;
                                   });
                                   const hasVocab = stVocabAll.length > 0;
                                   const vocabDone = stVocabScoped.some(v => v.completed_at);
                                  const totalHw = studentAssignments.length + (hasVocab ? 1 : 0);
                                  const submittedCount = studentAssignments.filter(a => {
                                    const sub = submissions.find(sb => sb.assignment_id === a.id);
                                    return sub && (sub.status === "submitted" || sub.status === "reviewed");
                                  }).length + (vocabDone ? 1 : 0);
                                  const allDone = totalHw > 0 && submittedCount === totalHw;
                                  const noneSubmitted = submittedCount === 0 && totalHw > 0;
                                  const isTodayExpanded = expandedTodayHwSession === s.id;

                                  return (
                                    <>
                                      <div className="flex items-start gap-3">
                                        <p className="text-xs font-bold text-primary w-12 text-center flex-shrink-0 pt-0.5">{fmtTime(s.scheduled_at)}</p>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <p className={cn("text-sm font-medium truncate", isCancelled ? "line-through text-muted-foreground" : "text-foreground")}>{fmtName(s.student_name)}</p>
                                            {isCancelled && cancelMeta && (
                                              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0", cancelMeta.bgColor, cancelMeta.color)}>
                                                {cancelMeta.label}
                                                {s.cancellation_resolution === 'makeup' && ' · 보강'}
                                                {s.cancellation_resolution === 'carry_over' && ' · 이월'}
                                                {s.cancellation_resolution === 'refund' && ' · 환불'}
                                              </span>
                                            )}
                                            {!isCancelled && (() => {
                                              const mb = getMakeupBadge(s);
                                              if (!mb) return null;
                                              const meta = MAKEUP_BADGE_META[mb];
                                              return (
                                                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0", meta.className)}>
                                                  {meta.label}
                                                </span>
                                              );
                                            })()}
                                            {isCompleted && !isCancelled && <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                                            {totalHw > 0 && (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); setExpandedTodayHwSession(isTodayExpanded ? null : s.id); }}
                                                className={cn(
                                                  "text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 transition-colors",
                                                  allDone ? "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]" :
                                                  noneSubmitted ? "bg-destructive/10 text-destructive" :
                                                  "bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]"
                                                )}
                                              >
                                                <ClipboardCheck className="w-2.5 h-2.5" />
                                                {submittedCount}/{totalHw}
                                              </button>
                                            )}
                                          </div>
                                          <p className="text-[11px] text-muted-foreground truncate">{s.topic || s.level}</p>
                                          {s.reschedule_origin_dates && s.reschedule_origin_dates.length > 0 && (
                                            <p className="text-[10px] text-gold-dark flex items-center gap-1 mt-0.5 flex-wrap">
                                              <RefreshCw className="w-2.5 h-2.5" />
                                              <MakeupBadges isMakeup isUrgent={s.is_urgent_makeup} />
                                              <span>{s.reschedule_origin_dates.map(d => new Date(d + "T00:00:00").toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" })).join(", ")}에서 변경됨</span>
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {!isCancelled && !isCompleted && (
                                          <Button
                                            size="sm"
                                            className="h-7 text-[10px] gap-1 bg-primary hover:bg-primary/90 text-primary-foreground px-2"
                                            onClick={() => setPreClassChecklist(s)}
                                          >
                                            <ClipboardCheck className="w-3 h-3" /> 이번 수업
                                          </Button>
                                        )}
                                        {!isCancelled && isCompleted && (
                                        <a href={`/t/classroom?sessionId=${s.id}`} target="_blank" rel="noopener noreferrer">
                                          <Button size="sm" className="h-7 text-[10px] gap-1 bg-primary hover:bg-primary/90 text-primary-foreground px-2">
                                            <FileText className="w-3 h-3" /> 수업 노트
                                          </Button>
                                        </a>
                                        )}
                                        {(() => {
                                          if (isCancelled) {
                                            return (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-[10px] gap-1 border-muted-foreground/30 text-muted-foreground px-2"
                                                onClick={() => handleRestoreCancellation(s)}
                                              >
                                                <RotateCcw className="w-3 h-3" /> 복원
                                              </Button>
                                            );
                                          }

                                          const scheduledKst = new Date(s.scheduled_at);
                                          const nowMs = Date.now();
                                          const diffMs = nowMs - scheduledKst.getTime();
                                          const after30min = diffMs >= 30 * 60 * 1000;
                                          const within12h = diffMs >= 0 && diffMs <= 12 * 60 * 60 * 1000;
                                          if (!isCompleted && after30min && within12h) return (
                                            <>
                                            <Button
                                              size="sm"
                                              className="h-7 text-[10px] gap-1 bg-success hover:bg-success/90 text-success-foreground px-2"
                                              onClick={async () => {
                                                const endedAt = new Date().toISOString();
                                                const { error } = await supabase.from("class_sessions").update({
                                                  ended_at: endedAt,
                                                  started_at: s.started_at || s.scheduled_at,
                                                }).eq("id", s.id);
                                                if (error) {
                                                  toast({ title: "수업 완료 실패", description: error.message, variant: "destructive" });
                                                } else {
                                                  toast({ title: "수업 완료 처리됨 ✓" });
                                                  const updatedSessions = sessions.map(sess => sess.id === s.id ? { ...sess, ended_at: endedAt, started_at: s.started_at || s.scheduled_at } : sess);
                                                  setSessions(updatedSessions);

                                                  // Check if last week of the month → trigger student feedback
                                                  if (period) {
                                                    const today = new Date();
                                                    const kstDate = new Date(today.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
                                                    const lastDayOfMonth = new Date(kstDate.getFullYear(), kstDate.getMonth() + 1, 0).getDate();
                                                    const dayOfMonth = kstDate.getDate();
                                                    const isLastWeek = dayOfMonth > lastDayOfMonth - 7;

                                                    if (isLastWeek) {
                                                      const todayCompletedStudents = updatedSessions
                                                        .filter(sess => isToday(sess.scheduled_at) && sess.ended_at && sess.instructor_name === instructor?.name)
                                                        .map(sess => sess.student_name);
                                                      const uniqueStudents = [...new Set(todayCompletedStudents)];

                                                      const { data: existingFeedback } = await supabase
                                                        .from("instructor_student_feedback" as any)
                                                        .select("student_name")
                                                        .eq("instructor_name", instructor?.name || "")
                                                        .eq("period_id", period.id);
                                                      const alreadyDone = new Set((existingFeedback || []).map((f: any) => f.student_name));
                                                      const needFeedback = uniqueStudents.filter(sn => !alreadyDone.has(sn));

                                                      const todayAllCompleted = updatedSessions
                                                        .filter(sess => isToday(sess.scheduled_at) && sess.instructor_name === instructor?.name)
                                                        .every(sess => !!sess.ended_at);

                                                      if (todayAllCompleted && needFeedback.length > 0) {
                                                        const feedbackStudents = needFeedback.map(sn => {
                                                          const st = students.find(st2 => st2.student_name === sn);
                                                          return { student_name: sn, level: st?.level || null, learning_objective: st?.learning_objective || null };
                                                        });
                                                        setStudentFeedbackModal({ students: feedbackStudents, periodId: period.id, periodLabel: period.label, periodStartDate: period.start_date, periodEndDate: period.end_date });
                                                      }
                                                    }
                                                  }
                                                }
                                              }}
                                            >
                                              <Check className="w-3 h-3" /> 수업 완료
                                            </Button>
                                           {/* Cancellation button → modal */}
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-[10px] gap-0.5 border-destructive/30 text-destructive px-1.5"
                                              onClick={() => setCancellationModal({ session: s })}
                                            >
                                              <X className="w-3 h-3" /> 취소
                                            </Button>
                                            </>
                                          );
                                          // Allow cancellation even before 30min mark (without complete button)
                                          if (!isCompleted && !after30min) return (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-[10px] gap-0.5 border-destructive/30 text-destructive px-1.5"
                                              onClick={() => setCancellationModal({ session: s })}
                                            >
                                              <X className="w-3 h-3" /> 취소
                                            </Button>
                                          );
                                          if (isCompleted && within12h) return (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-[10px] gap-1 border-muted-foreground/30 text-muted-foreground px-2"
                                              onClick={async () => {
                                                const { error } = await supabase.from("class_sessions").update({
                                                  ended_at: null,
                                                }).eq("id", s.id);
                                                if (error) {
                                                  toast({ title: "취소 실패", description: error.message, variant: "destructive" });
                                                } else {
                                                  toast({ title: "수업 완료 취소됨" });
                                                  setSessions(prev => prev.map(sess => sess.id === s.id ? { ...sess, ended_at: null } : sess));
                                                }
                                              }}
                                            >
                                              <X className="w-3 h-3" /> 완료 취소
                                            </Button>
                                          );
                                          return null;
                                        })()}
                                        </div>
                                      </div>
                                      {/* Expanded homework details */}
                                      {isTodayExpanded && totalHw > 0 && (
                                        <div className="mt-1.5 ml-[60px] space-y-1">
                                          {studentAssignments.map(a => {
                                            const sub = submissions.find(sb => sb.assignment_id === a.id);
                                            const hwType = a.type as HwType;
                                            const meta = HW_TYPE_META[hwType];
                                            const Icon = meta?.icon || FileText;
                                            const isSubmitted = sub && (sub.status === "submitted" || sub.status === "reviewed");
                                            const isReviewed = sub && sub.status === "reviewed";
                                            const isQuickCheck = hwType === "reading" || hwType === "memorizing" || hwType === "watching";
                                            return (
                                              <div
                                                key={a.id}
                                                onClick={() => {
                                                  if (!isQuickCheck && sub && sub.status === "submitted") {
                                                    setReviewHw({ assignment: a, submission: sub });
                                                  } else if (sub && sub.status === "reviewed") {
                                                    setViewCheckedHw({ assignment: a, submission: sub });
                                                  }
                                                }}
                                                className={cn(
                                                  "flex items-center gap-2 px-2 py-1 rounded-md border text-left",
                                                  isSubmitted ? "border-border bg-card" : "border-dashed border-muted-foreground/20 bg-muted/10",
                                                  ((!isQuickCheck && sub?.status === "submitted") || sub?.status === "reviewed") && "cursor-pointer hover:bg-muted/40 transition-colors",
                                                )}
                                              >
                                                <Icon className={cn("w-3 h-3 flex-shrink-0", meta?.color || "text-muted-foreground")} />
                                                <span className="text-[10px] flex-1 truncate">{a.title}</span>
                                                {isReviewed ? (
                                                  <CheckCircle className="w-3 h-3 text-[hsl(var(--success))] flex-shrink-0" />
                                                ) : isSubmitted ? (
                                                  isQuickCheck ? (
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className="h-5 text-[9px] gap-0.5 border-[hsl(var(--success)/0.4)] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.1)] px-1.5"
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        await supabase.from("homework_submissions").update({
                                                          status: "reviewed",
                                                          reviewed_at: new Date().toISOString(),
                                                        }).eq("id", sub.id);
                                                        toast({ title: "확인 완료 ✓" });
                                                        setSubmissions(prev => prev.map(sb => sb.id === sub.id ? { ...sb, status: "reviewed", reviewed_at: new Date().toISOString() } : sb));
                                                      }}
                                                    >
                                                      <Check className="w-2.5 h-2.5" /> 확인
                                                    </Button>
                                                  ) : (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--gold)/0.12)] text-[hsl(var(--gold-dark))] font-medium flex-shrink-0">제출됨</span>
                                                  )
                                                ) : (
                                                  <span className="text-[9px] text-muted-foreground/60 flex-shrink-0">미제출</span>
                                                )}
                                              </div>
                                            );
                                          })}
                                          {/* Vocab test */}
                                          {(() => {
                                            const stVocab = stVocabScoped.filter(v => v.completed_at);
                                            if (stVocab.length === 0 && !hasVocab) return null;
                                            if (stVocab.length === 0) return (
                                              <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-dashed border-muted-foreground/20 bg-muted/10">
                                                <GraduationCap className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                                <span className="text-[10px] flex-1">단어 테스트</span>
                                                <span className="text-[9px] text-muted-foreground/60 flex-shrink-0">미완료</span>
                                              </div>
                                            );
                                            const sorted = [...stVocab].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
                                            const latest = sorted[0];
                                            return (
                                              <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-border bg-[hsl(var(--success)/0.04)]">
                                                <GraduationCap className="w-3 h-3 text-[hsl(var(--success))] flex-shrink-0" />
                                                <span className="text-[10px] flex-1">단어 테스트</span>
                                                {latest.score !== null && latest.total !== null && (
                                                  <span className={cn(
                                                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                                    latest.score / latest.total >= 0.8 ? "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]" :
                                                    latest.score / latest.total >= 0.5 ? "bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]" :
                                                    "bg-destructive/10 text-destructive"
                                                  )}>
                                                    최근 {latest.score}/{latest.total}
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
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

                {/* Unchecked homework — moved above 과제 제출 현황 */}
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                    <h3 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      미확인 숙제
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">{uncheckedHw.length}</span>
                    </h3>
                    {uncheckedHw.length > 0 ? (
                    <div className="space-y-1.5">
                      {uncheckedHw.map((entry) => {
                        const a = entry.assignment;
                        const sub = entry.submission;
                        const hwType = a.type as HwType;
                        const meta = HW_TYPE_META[hwType];
                        const Icon = meta?.icon || FileText;
                        const isQuickCheck = hwType === "reading" || hwType === "memorizing";
                        const nextSess = nextSessionByStudent.get(a.student_name);

                        return (
                          <div
                            key={sub.id}
                            onClick={() => {
                              if (!isQuickCheck && sub) {
                                setReviewHw({ assignment: a, submission: sub });
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border",
                              !isQuickCheck && "cursor-pointer hover:bg-muted/40 transition-colors"
                            )}
                          >
                            <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", meta?.color || "text-muted-foreground")} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground">{a.title}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {fmtName(a.student_name)} · {meta?.label || a.type}
                                {sub.submitted_at && (
                                  <span className="ml-1.5">· {fmt(sub.submitted_at)} 제출</span>
                                )}
                                {nextSess && (
                                  <span className="ml-1.5 text-[hsl(var(--gold-dark))]">
                                    · 다음 수업 {fmt(nextSess.scheduled_at)}
                                  </span>
                                )}
                              </p>
                            </div>
                            {isQuickCheck ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] gap-1 border-[hsl(var(--success)/0.4)] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.1)]"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await supabase.from("homework_submissions").update({
                                    status: "reviewed",
                                    reviewed_at: new Date().toISOString(),
                                  }).eq("id", sub.id);
                                  toast({ title: "확인 완료 ✓" });
                                  setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: "reviewed", reviewed_at: new Date().toISOString() } : s));
                                }}
                              >
                                <Check className="w-3 h-3" /> 확인
                              </Button>
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">미확인 숙제가 없습니다 ✓</p>
                    )}
                  </div>

                {/* Older unchecked homework */}
                {olderUncheckedHw.length > 0 && (
                  <details className="rounded-xl border border-amber-500/20 bg-amber-500/5 group">
                    <summary className="px-4 py-3 cursor-pointer list-none flex items-center gap-2 text-sm font-semibold text-amber-600">
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                      <Clock className="w-4 h-4" />
                      지난 수업 미확인 숙제
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">{olderUncheckedHw.length}</span>
                    </summary>
                    <div className="px-4 pb-3 space-y-1.5">
                      {olderUncheckedHw.map((entry) => {
                        const a = entry.assignment;
                        const sub = entry.submission;
                        const hwType = a.type as HwType;
                        const meta = HW_TYPE_META[hwType];
                        const Icon = meta?.icon || FileText;
                        const isQuickCheck = hwType === "reading" || hwType === "memorizing";
                        const assignmentSession = a.session_id ? sessions.find(s => s.id === a.session_id) : null;

                        return (
                          <div
                            key={sub.id}
                            onClick={() => {
                              if (!isQuickCheck && sub) {
                                setReviewHw({ assignment: a, submission: sub });
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border",
                              !isQuickCheck && "cursor-pointer hover:bg-muted/40 transition-colors"
                            )}
                          >
                            <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", meta?.color || "text-muted-foreground")} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground">{a.title}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {fmtName(a.student_name)} · {meta?.label || a.type}
                                {sub.submitted_at && (
                                  <span className="ml-1.5">· {fmt(sub.submitted_at)} 제출</span>
                                )}
                                {assignmentSession && (
                                  <span className="ml-1.5 text-amber-600">
                                    · {fmt(assignmentSession.scheduled_at)} 수업
                                  </span>
                                )}
                              </p>
                            </div>
                            {isQuickCheck ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] gap-1 border-[hsl(var(--success)/0.4)] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.1)]"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await supabase.from("homework_submissions").update({
                                    status: "reviewed",
                                    reviewed_at: new Date().toISOString(),
                                  }).eq("id", sub.id);
                                  toast({ title: "확인 완료 ✓" });
                                  setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: "reviewed", reviewed_at: new Date().toISOString() } : s));
                                }}
                              >
                                <Check className="w-3 h-3" /> 확인
                              </Button>
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}

                {/* Checked homework */}
                {checkedHw.length > 0 && (
                  <details className="rounded-xl border border-[hsl(var(--success)/0.2)] bg-[hsl(var(--success)/0.03)] group">
                    <summary className="px-4 py-3 cursor-pointer list-none flex items-center gap-2 text-sm font-semibold text-[hsl(var(--success))]">
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                      <CheckCircle className="w-4 h-4" />
                      확인된 숙제
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] font-medium">{checkedHw.length}</span>
                    </summary>
                    <div className="px-4 pb-4 space-y-1.5">
                      {checkedHw.map((entry) => {
                        const a = entry.assignment;
                        const sub = entry.submission;
                        const hwType = a.type as HwType;
                        const meta = HW_TYPE_META[hwType];
                        const Icon = meta?.icon || FileText;
                        return (
                          <div
                            key={sub.id}
                            onClick={() => setViewCheckedHw({ assignment: a, submission: sub })}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border cursor-pointer hover:bg-muted/40 transition-colors"
                          >
                            <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", meta?.color || "text-muted-foreground")} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground">{a.title}</p>
                              <p className="text-[10px] text-muted-foreground">{fmtName(a.student_name)} · {meta?.label || a.type}</p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setReviewHw({ assignment: a, submission: sub }); }}
                              className="text-[10px] px-2 py-1 rounded-md border border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors flex-shrink-0"
                            >
                              재검토
                            </button>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] font-semibold flex-shrink-0">
                              검토됨
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}

                {/* Homework submission status per student */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-navy" />
                    과제 제출 현황
                  </h3>
                  <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
                    {(() => {
                      const nowTs = new Date();
                      const activeStudents = students.filter(s => s.status === "active" && s.student_type !== "corporate");
                      const studentHwData = activeStudents.map(st => {
                        const sSessions = sessions.filter(s => s.student_name === st.student_name);
                        const pastSessions = sSessions.filter(s => new Date(s.scheduled_at) <= nowTs).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
                        const latestPast = pastSessions[0] || null;
                        const futureSessions = sSessions.filter(s => new Date(s.scheduled_at) > nowTs).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
                        const nextSession = futureSessions[0] || null;
                         const sessionAssignments = assignments.filter(a => {
                           if (a.student_name !== st.student_name) return false;
                           if (a.is_preset) {
                             // Only show preset template if no session copy exists for the latest past session
                             if (!latestPast) return true;
                             const hasCopy = assignments.some(c => c.preset_origin_id === a.id && c.session_id === latestPast.id);
                             return !hasCopy;
                           }
                           return latestPast && a.session_id === latestPast.id;
                         });
                         const stVocabAll = vocabTests.filter(v => v.student_name === st.student_name);
                         // Time-scope: between previous non-cancelled session and next session
                         const prevNonCancelled = sSessions
                           .filter(ss => !ss.cancellation_type && new Date(ss.scheduled_at) <= nowTs)
                           .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
                         const secondLatest = prevNonCancelled[1] || null;
                         const latestPastForVocab = prevNonCancelled[0] || null;
                         const vocabStart = secondLatest ? new Date(secondLatest.scheduled_at).getTime() : 0;
                         const vocabEnd = nextSession ? new Date(nextSession.scheduled_at).getTime() : Date.now();
                         const stVocabScoped = stVocabAll.filter(v => {
                           const t = new Date(v.started_at).getTime();
                           return t >= vocabStart && t < vocabEnd;
                         });
                         const hasVocab = stVocabAll.length > 0;
                         const vocabDone = stVocabScoped.some(v => v.completed_at);
                        const totalHw = sessionAssignments.length + (hasVocab ? 1 : 0);
                        const submittedCount = sessionAssignments.filter(a => {
                          const sub = submissions.find(s => s.assignment_id === a.id);
                          return sub && (sub.status === "submitted" || sub.status === "reviewed");
                        }).length + (vocabDone ? 1 : 0);
                        const reviewedCount = sessionAssignments.filter(a => {
                          const sub = submissions.find(s => s.assignment_id === a.id);
                          return sub && sub.status === "reviewed";
                        }).length;
                        return { student: st, latestPast, nextSession, sessionAssignments, totalHw, submittedCount, reviewedCount, hasVocab, vocabDone };
                      }).filter(d => d.totalHw > 0 || d.latestPast).sort((a, b) => {
                        const aTime = a.nextSession ? new Date(a.nextSession.scheduled_at).getTime() : Infinity;
                        const bTime = b.nextSession ? new Date(b.nextSession.scheduled_at).getTime() : Infinity;
                        return aTime - bTime;
                      });

                      if (studentHwData.length === 0) {
                        return <p className="text-xs text-muted-foreground py-2">과제 데이터가 없습니다</p>;
                      }

                      return studentHwData.map(({ student: st, latestPast, nextSession, sessionAssignments, totalHw, submittedCount, reviewedCount, hasVocab, vocabDone }) => {
                        const allDone = totalHw > 0 && submittedCount === totalHw;
                        const noneSubmitted = submittedCount === 0 && totalHw > 0;
                        const isExpanded = expandedHwStudent === st.id;
                        return (
                          <div key={st.id}>
                            <button
                              onClick={() => setExpandedHwStudent(isExpanded ? null : st.id)}
                              className={cn(
                                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors text-left",
                                isExpanded ? "border-navy/30 bg-navy/5" : "border-border hover:bg-muted/40",
                              )}
                            >
                              <div className="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-navy font-bold text-[9px]">{st.student_name.charAt(0)}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground leading-tight truncate">{fmtName(st.student_name)}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight">
                                  {nextSession ? `다음 수업 ${fmt(nextSession.scheduled_at)} ${fmtTime(nextSession.scheduled_at)}` : fmtSchedules(st.schedules) || "미정"}
                                </p>
                              </div>
                              {totalHw > 0 ? (
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <div className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                    allDone ? "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]" :
                                    noneSubmitted ? "bg-destructive/10 text-destructive" :
                                    "bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]"
                                  )}>
                                    {submittedCount}/{totalHw}
                                  </div>
                                  <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground flex-shrink-0">과제 없음</span>
                              )}
                            </button>
                            {isExpanded && (
                              <div className="ml-8 mt-1.5 space-y-1 mb-1">
                                {sessionAssignments.length > 0 ? sessionAssignments.map(a => {
                                  const sub = submissions.find(s => s.assignment_id === a.id);
                                  const hwType = a.type as HwType;
                                  const meta = HW_TYPE_META[hwType];
                                  const Icon = meta?.icon || FileText;
                                  const isSubmitted = sub && (sub.status === "submitted" || sub.status === "reviewed");
                                  const isReviewed = sub && sub.status === "reviewed";
                                  const isQuickCheck = hwType === "reading" || hwType === "memorizing" || hwType === "watching";
                                  return (
                                    <div
                                      key={a.id}
                                      onClick={() => {
                                        if (!isQuickCheck && sub && sub.status === "submitted") {
                                          setReviewHw({ assignment: a, submission: sub });
                                        } else if (sub && sub.status === "reviewed") {
                                          setViewCheckedHw({ assignment: a, submission: sub });
                                        }
                                      }}
                                      className={cn(
                                        "flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-left",
                                        isSubmitted ? "border-border bg-card" : "border-dashed border-muted-foreground/20 bg-muted/10",
                                        ((!isQuickCheck && sub?.status === "submitted") || sub?.status === "reviewed") && "cursor-pointer hover:bg-muted/40 transition-colors",
                                      )}
                                    >
                                      <Icon className={cn("w-3 h-3 flex-shrink-0", meta?.color || "text-muted-foreground")} />
                                      <span className="text-[11px] flex-1 truncate">{a.title}</span>
                                      {isReviewed ? (
                                        <CheckCircle className="w-3 h-3 text-[hsl(var(--success))] flex-shrink-0" />
                                      ) : isSubmitted ? (
                                        isQuickCheck ? (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-5 text-[9px] gap-0.5 border-[hsl(var(--success)/0.4)] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.1)] px-1.5"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              await supabase.from("homework_submissions").update({
                                                status: "reviewed",
                                                reviewed_at: new Date().toISOString(),
                                              }).eq("id", sub.id);
                                              toast({ title: "확인 완료 ✓" });
                                              setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: "reviewed", reviewed_at: new Date().toISOString() } : s));
                                            }}
                                          >
                                            <Check className="w-2.5 h-2.5" /> 확인
                                          </Button>
                                        ) : (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--gold)/0.12)] text-[hsl(var(--gold-dark))] font-medium flex-shrink-0">제출됨</span>
                                        )
                                      ) : (
                                        <span className="text-[9px] text-muted-foreground/60 flex-shrink-0">미제출</span>
                                      )}
                                    </div>
                                  );
                                }) : (
                                  <p className="text-[10px] text-muted-foreground py-1">직전 수업에 할당된 과제가 없습니다</p>
                                )}
                                {/* Vocab test stats */}
                                {(() => {
                                   // Show recent vocab test (most recent completed, not all-time)
                                   const stVocab = vocabTests.filter(v => v.student_name === st.student_name && v.completed_at);
                                  if (stVocab.length === 0) return null;
                                  const sorted = [...stVocab].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
                                  const latest = sorted[0];
                                  return (
                                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-[hsl(var(--success)/0.04)]">
                                      <GraduationCap className="w-3 h-3 text-[hsl(var(--success))] flex-shrink-0" />
                                      <span className="text-[11px] flex-1">단어 테스트</span>
                                      <span className="text-[10px] font-medium text-muted-foreground">{stVocab.length}회</span>
                                      {latest.score !== null && latest.total !== null && (
                                        <span className={cn(
                                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                          latest.score / latest.total >= 0.8 ? "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]" :
                                          latest.score / latest.total >= 0.5 ? "bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]" :
                                          "bg-destructive/10 text-destructive"
                                        )}>
                                          최근 {latest.score}/{latest.total}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                                {latestPast && (
                                  <a href={`/t/classroom?sessionId=${latestPast.id}`} className="inline-flex items-center gap-1 text-[10px] text-navy hover:underline mt-1">
                                    <FileText className="w-3 h-3" /> 수업노트 보기
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2 flex-wrap">
                <Users className="w-4 h-4 text-primary" />
                담당 학생 관리
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {(() => {
                    const sp = allPeriods[studentTabPeriodIdx] || period;
                    const todayStrCount = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
                    return students.filter(s => {
                      if (s.status === "inactive") return false;
                      if (s.start_date && sp && s.start_date > sp.end_date) return false;
                      const isCorp = s.student_type === "corporate";
                      const onPause = s.pauses?.some(p => p.pause_start <= todayStrCount && (!p.pause_end || p.pause_end >= todayStrCount)) ?? false;
                      const isPaused = onPause && s.status === "active";
                      if (studentTypeFilter === "corporate") return isCorp;
                      if (studentTypeFilter === "paused") return isPaused && !isCorp;
                      // regular tab: non-corp, non-paused
                      if (isCorp) return false;
                      if (isPaused) return false;
                      return true;
                    }).length;
                  })()}명
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-gold/40 text-gold-dark hover:bg-gold/8"
                  onClick={() => setShowBulkGoalModal(true)}
                >
                  <Target className="w-3 h-3" />
                  목표 일괄 설정
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/8"
                  onClick={async () => {
                    const sp = allPeriods[studentTabPeriodIdx] || period;
                    if (!sp || !instructor) return;
                    // Find students who had completed sessions in this period
                    const periodSessions = sessions.filter(s =>
                      s.ended_at &&
                      s.instructor_name === instructor.name &&
                      s.scheduled_at >= sp.start_date &&
                      s.scheduled_at <= sp.end_date + "T23:59:59"
                    );
                    const completedStudentNames = [...new Set(periodSessions.map(s => s.student_name))];
                    if (completedStudentNames.length === 0) {
                      toast({ title: "이 기간에 완료된 수업이 없습니다." });
                      return;
                    }
                    const { data: existingFb } = await supabase
                      .from("instructor_student_feedback" as any)
                      .select("student_name")
                      .eq("instructor_name", instructor.name)
                      .eq("period_id", sp.id);
                    const alreadyDone = new Set((existingFb || []).map((f: any) => f.student_name));
                    const needFeedback = completedStudentNames.filter(sn => !alreadyDone.has(sn));
                    if (needFeedback.length === 0) {
                      toast({ title: "모든 학생의 피드백이 이미 완료되었습니다 ✅" });
                      return;
                    }
                    const feedbackStudents = needFeedback.map(sn => {
                      const st = students.find(s2 => s2.student_name === sn);
                      return { student_name: sn, level: st?.level || null, learning_objective: st?.learning_objective || null };
                    });
                    setStudentFeedbackModal({ students: feedbackStudents, periodId: sp.id, periodLabel: sp.label, periodStartDate: sp.start_date, periodEndDate: sp.end_date });
                  }}
                >
                  <ClipboardCheck className="w-3 h-3" />
                  학생 피드백
                </Button>
              </h2>
              {allPeriods.length > 0 && (
                <div className="flex items-center gap-2 shrink-0">
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

            {/* Student type filter tabs */}
            <div className="flex items-center gap-1 border-b border-border">
              {([
                { key: "regular" as const, label: "정규 수강생" },
                { key: "paused" as const, label: "휴강생" },
                { key: "corporate" as const, label: "기업 수강생" },
              ]).map((tab) => {
                const isActive = studentTypeFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStudentTypeFilter(tab.key)}
                    className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {students.filter((st) => {
                if (st.status === "inactive") return false;
                const selectedPeriod = allPeriods[studentTabPeriodIdx] || period;
                if (st.start_date && selectedPeriod && st.start_date > selectedPeriod.end_date) return false;
                // Hide students who have been transferred away (end_date reached)
                const todayStrTransfer = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
                if (st.end_date && st.end_date <= todayStrTransfer) return false;
                const isCorp = st.student_type === "corporate";
                const todayStrFilter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
                const onPause = st.pauses?.some(p => p.pause_start <= todayStrFilter && (!p.pause_end || p.pause_end >= todayStrFilter)) ?? false;
                const isPaused = onPause && st.status === "active";
                if (studentTypeFilter === "corporate") return isCorp;
                if (studentTypeFilter === "paused") return isPaused && !isCorp;
                // regular: non-corp and non-paused
                if (isCorp) return false;
                if (isPaused) return false;
                return true;
              }).sort((a, b) => a.student_name.localeCompare(b.student_name, "ko")).map((st) => {
                const selectedPeriod = allPeriods[studentTabPeriodIdx] || period;
                const stats = getStudentStats(st.student_name, st.schedules, selectedPeriod);
                // goals variable removed - lesson goals are now per-session topics
                const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
                const currentlyOnPause = st.pauses?.some(p => p.pause_start <= todayStr && (!p.pause_end || p.pause_end >= todayStr)) ?? false;
                const effectiveStatus = currentlyOnPause && st.status === "active" ? "paused" : st.status;
                const statusLabel = effectiveStatus === "active" ? "수강 중" : effectiveStatus === "paused" ? "휴강 중" : "수료";
                const statusColor = effectiveStatus === "active" ? "bg-success/10 text-success" : effectiveStatus === "paused" ? "bg-gold/10 text-gold-dark" : "bg-muted text-muted-foreground";

                // Sessions within selected period for this student
                const pStart = selectedPeriod ? new Date(selectedPeriod.start_date + "T00:00:00") : null;
                const pEnd = selectedPeriod ? new Date(selectedPeriod.end_date + "T23:59:59") : null;
                const studentPeriodSessions = sessions
                  .filter((s) => {
                    if (s.student_name !== st.student_name) return false;
                    if (!pStart || !pEnd) return false;
                    const d = new Date(s.scheduled_at);
                    return d >= pStart && d <= pEnd && !isSessionHidden(s);
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
                          <p className="font-semibold text-sm text-foreground">{formatStudentName(st.student_name, st.english_name)}</p>
                          <p className="text-[10px] text-muted-foreground">{st.level} · {fmtSchedules(st.schedules) || "일정 미정"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusColor)}>{statusLabel}</span>
                        {st.google_sheet_url ? (
                          <a
                            href={st.google_sheet_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-muted text-gold-dark hover:text-gold transition-colors"
                            title="학생일지 열기"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span
                            className="p-1.5 rounded-lg text-muted-foreground/40 cursor-not-allowed"
                            title="학생일지 미등록"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <button
                          onClick={() => navigate(`/t/student-dashboard?student_name=${encodeURIComponent(st.student_name)}`)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="학생 대시보드 보기"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
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
                      {/* Learning Objective (long-term) */}
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-muted-foreground">등록 계기 / 최종 목표</p>
                        {(() => {
                          const objectives = parseLearningObjective(st.learning_objective);
                          return objectives.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {objectives.map((obj, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-navy/8 text-navy font-medium">{obj}</span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">미설정</p>
                          );
                        })()}
                      </div>

                      {/* Donut charts */}
                      <div className="grid grid-cols-3 gap-2">
                        <DonutStat value={stats.completedMonthSessions} total={stats.monthTotal} label="수업횟수" unit="회" color="hsl(var(--navy))" trackColor="hsl(var(--navy) / 0.15)" />
                        <DonutStat value={stats.weekSubmittedHw} total={stats.totalHw} label="숙제 제출" unit="건" color="hsl(var(--gold-dark))" trackColor="hsl(var(--gold) / 0.2)" />
                        <DonutStat value={stats.weekVocabCount} total={0} label="단어 테스트" unit="회" color="hsl(var(--success))" trackColor="hsl(var(--success) / 0.15)" isCount />
                      </div>

                      {/* Period sessions - collapsible */}
                      {studentPeriodSessions.length > 0 && (
                        <CollapsibleSessions
                          sessions={studentPeriodSessions}
                          onReschedule={(s) => setRescheduleSession(s)}
                          onTopicChange={async (sessionId, topic) => {
                            await supabase.from("class_sessions").update({ topic }).eq("id", sessionId);
                            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, topic } : s));
                          }}
                        />
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Banknote className="w-4 h-4 text-success" />
                정산 관리
              </h2>
              <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      if (settlementMonth === 0) { setSettlementYear(y => y - 1); setSettlementMonth(11); }
                      else setSettlementMonth(m => m - 1);
                    }}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-semibold text-foreground min-w-[100px] text-center">
                    {settlementLabel}
                    <span className="block text-[10px] text-muted-foreground font-normal">
                      {settlementDateRange}
                    </span>
                  </span>
                  <button
                    onClick={() => {
                      if (settlementMonth === 11) { setSettlementYear(y => y + 1); setSettlementMonth(0); }
                      else setSettlementMonth(m => m + 1);
                    }}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                <p className="text-[10px] text-muted-foreground">완료 수업</p>
                <p className="text-lg font-bold text-navy">{completedSettlementSessions.length}회</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                <p className="text-[10px] text-muted-foreground">업무 미팅</p>
                <p className="text-lg font-bold text-gold-dark">{completedSettlementMeetings.length}건</p>
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
                      <th className="text-left px-2 sm:px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">일자</th>
                      <th className="text-left px-2 sm:px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">구분</th>
                      <th className="text-left px-2 sm:px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">업무내용</th>
                      <th className="text-left px-2 sm:px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">시간</th>
                      <th className="text-right px-2 sm:px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">급여</th>
                      <th className="text-right px-2 sm:px-4 py-2.5 text-[11px] font-semibold text-muted-foreground hidden sm:table-cell">누적</th>
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
                          <td className="px-2 sm:px-4 py-2.5 text-xs text-foreground whitespace-nowrap">
                            {row.date.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" })}
                          </td>
                          <td className="px-2 sm:px-4 py-2.5">
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                              row.type === 'lesson' ? "bg-primary/10 text-primary" : "bg-gold/10 text-gold-dark"
                            )}>
                              {row.type === 'lesson' ? '수업' : '미팅'}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-2.5 text-xs text-foreground max-w-[120px] sm:max-w-none truncate">{row.description}</td>
                          <td className="px-2 sm:px-4 py-2.5">
                            <select
                              className="text-xs bg-transparent border border-border rounded px-1 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              value={row.durationHours}
                              onChange={(e) => setDurationOverrides(prev => ({ ...prev, [row.key]: parseFloat(e.target.value) }))}
                            >
                              {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map(h => (
                                <option key={h} value={h}>{h}시간</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 sm:px-4 py-2.5 text-xs text-right font-medium text-foreground whitespace-nowrap">₩{row.pay.toLocaleString()}</td>
                          <td className="px-2 sm:px-4 py-2.5 text-xs text-right font-bold text-success hidden sm:table-cell">₩{row.cumulative.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {settlementWithCumulative.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/30 border-t border-border">
                        <td colSpan={4} className="px-2 sm:px-4 py-3 text-xs font-bold text-foreground">합계</td>
                        <td className="px-2 sm:px-4 py-3 text-xs text-right font-bold text-foreground">₩{totalAmount.toLocaleString()}</td>
                        <td className="px-2 sm:px-4 py-3 hidden sm:table-cell"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ═══ FEEDBACK TAB ════════════════════════════════════════════════ */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "feedback" && instructor && (
          <InstructorFeedbackTab
            instructorName={instructor.name}
            allPeriods={allPeriods}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ═══ MAKEUP TAB ═════════════════════════════════════════════════ */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "makeup" && instructor && (
          <InstructorMakeupTab instructorId={instructor.id} instructorName={instructor.name} onSessionChanged={() => loadData(instructor)} />
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ═══ GUIDE TAB ══════════════════════════════════════════════════ */}
        {activeTab === "guide" && <InstructorGuide />}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ═══ PROFILE TAB ═════════════════════════════════════════════════ */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "profile" && instructor && (
          <div className="max-w-md space-y-6">
            {/* Name & Nickname */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-navy" />
                기본 정보
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">이름</Label>
                  <Input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="이름을 입력하세요"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">닉네임 (표시 이름)</Label>
                  <Input
                    value={profileNickname}
                    onChange={(e) => setProfileNickname(e.target.value)}
                    placeholder="닉네임을 입력하세요"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <Button
                size="sm"
                disabled={profileSaving}
                className="h-8 text-xs bg-navy hover:bg-navy-light"
                onClick={async () => {
                  if (!profileName.trim()) {
                    toast({ title: "이름을 입력해주세요", variant: "destructive" });
                    return;
                  }
                  setProfileSaving(true);
                  try {
                    const oldName = instructor.name;
                    const newName = profileName.trim();
                    const { error: insErr } = await supabase
                      .from("instructors")
                      .update({ name: newName })
                      .eq("id", instructor.id);
                    if (insErr) throw insErr;

                    // Sync instructor_students.instructor_name
                    await supabase
                      .from("instructor_students")
                      .update({ instructor_name: newName })
                      .eq("instructor_id", instructor.id);

                    // Sync unstarted class_sessions
                    await supabase
                      .from("class_sessions")
                      .update({ instructor_name: newName })
                      .eq("instructor_name", oldName)
                      .is("started_at", null);

                    const { data: { user: currentUser } } = await supabase.auth.getUser();
                    if (currentUser) {
                      await supabase
                        .from("user_roles")
                        .update({ display_name: profileNickname.trim() || null })
                        .eq("user_id", currentUser.id)
                        .eq("role", "instructor");
                    }

                    setInstructor({ ...instructor, name: profileName.trim() });
                    toast({ title: "정보가 저장되었습니다 ✓" });
                  } catch (e: any) {
                    toast({ title: "저장 실패", description: e.message, variant: "destructive" });
                  } finally {
                    setProfileSaving(false);
                  }
                }}
              >
                {profileSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "저장"}
              </Button>
            </div>

            {/* Password Change */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-navy" />
                비밀번호 변경
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">새 비밀번호</Label>
                  <Input
                    type="password"
                    value={profileNewPw}
                    onChange={(e) => setProfileNewPw(e.target.value)}
                    placeholder="6자 이상"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">비밀번호 확인</Label>
                  <Input
                    type="password"
                    value={profileConfirmPw}
                    onChange={(e) => setProfileConfirmPw(e.target.value)}
                    placeholder="비밀번호를 다시 입력하세요"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <Button
                size="sm"
                disabled={profilePwSaving}
                className="h-8 text-xs bg-navy hover:bg-navy-light"
                onClick={async () => {
                  if (profileNewPw.length < 6) {
                    toast({ title: "비밀번호는 6자 이상이어야 합니다", variant: "destructive" });
                    return;
                  }
                  if (profileNewPw !== profileConfirmPw) {
                    toast({ title: "비밀번호가 일치하지 않습니다", variant: "destructive" });
                    return;
                  }
                  setProfilePwSaving(true);
                  try {
                    const { error } = await supabase.auth.updateUser({ password: profileNewPw });
                    if (error) throw error;
                    setProfileNewPw("");
                    setProfileConfirmPw("");
                    toast({ title: "비밀번호가 변경되었습니다 ✓" });
                  } catch (e: any) {
                    toast({ title: "변경 실패", description: e.message, variant: "destructive" });
                  } finally {
                    setProfilePwSaving(false);
                  }
                }}
              >
                {profilePwSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "비밀번호 변경"}
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showMeetingModal && instructor && (
        <AddMeetingModal
          instructorId={instructor.id}
          position={instructor.position}
          meetLink={instructor.meet_link}
          allInstructors={allInstructors}
          onClose={() => setShowMeetingModal(false)}
          onAdded={() => loadData(instructor)}
        />
      )}
      {editMeeting && (
        <EditMeetingModal
          meeting={editMeeting}
          onClose={() => setEditMeeting(null)}
          onSaved={(updated) => {
            setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m));
            setEditMeeting(null);
          }}
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
      {reviewHw && (
        <HomeworkReviewModal
          assignmentTitle={reviewHw.assignment.title}
          assignmentType={reviewHw.assignment.type as "writing" | "speaking"}
          studentName={reviewHw.assignment.student_name}
          submissionId={reviewHw.submission.id}
          textContent={reviewHw.submission.text_content}
          audioUrl={reviewHw.submission.audio_url}
          fileUrl={reviewHw.submission.file_url}
          onClose={() => setReviewHw(null)}
          onReviewed={async () => {
            // Refetch the submission to get updated ai_correction and instructor_note
            const { data: updatedSub } = await supabase
              .from("homework_submissions")
              .select("id,assignment_id,status,student_name,submitted_at,text_content,audio_url,file_url,instructor_note,reviewed_at,ai_correction")
              .eq("id", reviewHw?.submission.id)
              .maybeSingle();
            if (updatedSub) {
              setSubmissions(prev => prev.map(s => s.id === updatedSub.id ? updatedSub : s));
            }
          }}
        />
      )}
      {viewCheckedHw && (() => {
        const sub = viewCheckedHw.submission;
        return (
          <HomeworkFeedbackModal
            assignmentTitle={viewCheckedHw.assignment.title}
            assignmentType={viewCheckedHw.assignment.type}
            assignmentDescription={viewCheckedHw.assignment.description}
            textContent={sub.text_content}
            audioUrl={sub.audio_url}
            fileUrl={sub.file_url}
            instructorNote={sub.instructor_note}
            reviewedAt={sub.reviewed_at}
            aiCorrection={sub.ai_correction}
            onClose={() => setViewCheckedHw(null)}
            onUnreview={async () => {
              const { error } = await supabase
                .from("homework_submissions")
                .update({ status: "submitted", reviewed_at: null, instructor_note: null, ai_correction: null })
                .eq("id", sub.id);
              if (error) throw error;
              setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: "submitted", reviewed_at: null, instructor_note: null, ai_correction: null } : s));
              setViewCheckedHw(null);
            }}
          />
        );
      })()}
      {showBulkGoalModal && (
        <BulkGoalModal
          students={students.filter(s => s.status === "active" && s.student_type !== "corporate")}
          onClose={() => setShowBulkGoalModal(false)}
          onSaved={() => { setShowBulkGoalModal(false); if (instructor) loadData(instructor); }}
        />
      )}
      {showAddSession && instructor && (
        <AddSessionModal
          students={students.filter(s => s.status === "active" && s.student_type !== "corporate").map(s => ({
            student_name: s.student_name,
            level: s.level,
            meet_link: s.meet_link,
            instructor_name: s.instructor_name,
            group_students: s.group_students || [],
          }))}
          instructorName={instructor.name}
          onClose={() => setShowAddSession(false)}
          onAdded={() => { setShowAddSession(false); loadData(instructor); }}
        />
      )}
      {cancellationModal && (
        <SessionCancellationModal
          sessionId={cancellationModal.session.id}
          studentName={cancellationModal.session.student_name}
          scheduledAt={cancellationModal.session.scheduled_at}
          open={!!cancellationModal}
          onClose={() => setCancellationModal(null)}
          onConfirm={async (type, resolution, remark) => {
            const sess = cancellationModal.session;
            const updates: any = { cancellation_type: type, cancellation_resolution: resolution };
            if (remark) updates.remarks = remark;

            // Carry-over (이월): mark the original session in the current month
            // as "next" (당월→다음달 이월) AND create a mirror session in the
            // next month marked as "prev" so the count report shows:
            //   • current month "이월(당월)" +1
            //   • next month "이월(전월)" +1
            if (resolution === "carry_over") {
              updates.is_carryover = true;
              updates.carryover_direction = "next";
              updates.carryover_reason = type;
            }

            const { error } = await supabase
              .from("class_sessions")
              .update(updates)
              .eq("id", sess.id);
            if (error) {
              toast({ title: "취소 처리 실패", description: error.message, variant: "destructive" });
              setCancellationModal(null);
              return;
            }

            // Create mirror session in next month for carry-over
            if (resolution === "carry_over") {
              const orig = new Date(sess.scheduled_at);
              const next = new Date(orig.getTime());
              const origMonthKey = orig.getUTCFullYear() * 12 + orig.getUTCMonth();
              const collidesWith = (iso: string) =>
                sessions.some(
                  (x) =>
                    x.student_name === sess.student_name &&
                    x.scheduled_at === iso,
                );
              while (true) {
                next.setUTCDate(next.getUTCDate() + 7);
                const isLaterMonth =
                  next.getUTCFullYear() * 12 + next.getUTCMonth() > origMonthKey;
                if (isLaterMonth && !collidesWith(next.toISOString())) break;
                if (next.getTime() - orig.getTime() > 70 * 24 * 60 * 60 * 1000) break;
              }
              const { error: mirrorErr } = await supabase
                .from("class_sessions")
                .insert({
                  student_name: sess.student_name,
                  instructor_name: sess.instructor_name,
                  scheduled_at: next.toISOString(),
                  level: (sess as any).level || "B1",
                  group_students: (sess as any).group_students || [],
                  is_carryover: true,
                  carryover_direction: "prev",
                  carryover_reason: type,
                });
              if (mirrorErr) {
                console.error("[carry-over mirror] failed", mirrorErr);
                toast({
                  title: "이월 미러 세션 생성 실패",
                  description: mirrorErr.message,
                  variant: "destructive",
                });
              }
            }

            // No-show: send a notification to the student's dashboard inbox
            if (type === "no_show") {
              try {
                const dateLabel = new Date(sess.scheduled_at).toLocaleDateString("ko-KR", {
                  month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul",
                });
                await supabase.from("admin_notifications").insert({
                  target: `student:${sess.student_name}`,
                  subject: "수업이 노쇼로 처리되었습니다",
                  body: `${dateLabel} 수업은 30분 대기 후 노쇼로 처리되었습니다. 이에 수업료가 차감되며 보강은 진행되지 않습니다. 관련 문의는 개별적으로 연락 주시기 바랍니다.`,
                  sent_at: new Date().toISOString(),
                } as any);
              } catch (e) {
                console.warn("[no-show notify] failed", e);
              }
            }

            toast({
              title: resolution === "carry_over"
                ? "다음달로 이월 처리되었습니다"
                : "수업이 취소 처리되었습니다",
            });
            // Calendar sync per cancellation type:
            //  • no_show: keep the event as-is (badge only on note)
            //  • student_cancel (당일 취소): rename event to "(취) 강사_학생"
            //  • sick / instructor_cancel / advance_cancel: delete event
            //    (보강 승인 시 별도로 새 슬롯이 캘린더에 생성됨)
            try {
              if (type === "student_cancel") {
                await supabase.functions.invoke("sync-calendar-event", {
                  body: {
                    action: "rename",
                    session_id: sess.id,
                    gcal_event_id: (sess as any).gcal_event_id ?? null,
                    instructor_name: sess.instructor_name,
                    student_name: sess.student_name,
                    scheduled_at: sess.scheduled_at,
                  },
                });
              } else if (type === "sick" || type === "instructor_cancel" || type === "advance_cancel") {
                await supabase.functions.invoke("sync-calendar-event", {
                  body: {
                    action: "delete",
                    session_id: sess.id,
                    gcal_event_id: (sess as any).gcal_event_id ?? null,
                    instructor_name: sess.instructor_name,
                    student_name: sess.student_name,
                    scheduled_at: sess.scheduled_at,
                  },
                });
              }
              // no_show: do nothing — event stays on calendar
            } catch (e) {
              console.warn("[gcal cancel sync] skipped", e);
            }
            if (instructor) loadData(instructor);
            setCancellationModal(null);
          }}
        />
      )}
      {preClassChecklist && (
        <PreClassChecklistModal
          session={preClassChecklist}
          allSessions={sessions}
          assignments={assignments}
          submissions={submissions}
          vocabTests={vocabTests}
          onClose={() => setPreClassChecklist(null)}
          onReviewHw={(a, sub) => { setPreClassChecklist(null); setReviewHw({ assignment: a, submission: sub }); }}
          onViewCheckedHw={(a, sub) => { setPreClassChecklist(null); setViewCheckedHw({ assignment: a, submission: sub }); }}
          onQuickReview={async (submissionId) => {
            await supabase.from("homework_submissions").update({
              status: "reviewed",
              reviewed_at: new Date().toISOString(),
            }).eq("id", submissionId);
            toast({ title: "확인 완료 ✓" });
            setSubmissions(prev => prev.map(sb => sb.id === submissionId ? { ...sb, status: "reviewed", reviewed_at: new Date().toISOString() } : sb));
          }}
        />
      )}
      {studentFeedbackModal && instructor && (
        <StudentFeedbackModal
          instructorName={instructor.name}
          students={studentFeedbackModal.students}
          periodId={studentFeedbackModal.periodId}
          periodLabel={studentFeedbackModal.periodLabel}
          periodStartDate={studentFeedbackModal.periodStartDate}
          periodEndDate={studentFeedbackModal.periodEndDate}
          onComplete={() => { setStudentFeedbackModal(null); if (instructor) loadData(instructor); }}
          onClose={() => setStudentFeedbackModal(null)}
        />
      )}
    </div>
  );
}

/* ── Bulk Goal Setting Modal ─────────────────────────────────────────── */
function BulkGoalModal({
  students,
  onClose,
  onSaved,
}: {
  students: StudentFull[];
  onClose: () => void;
  onSaved: () => void;
}) {
  type SG = { id: string; scheduled_at: string; topic: string };
  const [studentSessions, setStudentSessions] = useState<Record<string, { prev: SG[]; curr: SG[] }>>({});
  const [topics, setTopics] = useState<Record<string, string>>({}); // sessionId -> topic
  const [origTopics, setOrigTopics] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [loading, setLoading] = useState(true);
  const [currPeriodLabel, setCurrPeriodLabel] = useState("");
  const [prevPeriodLabel, setPrevPeriodLabel] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      // Fetch schedule periods to determine current and previous period
      const { data: periods } = await supabase
        .from("schedule_periods")
        .select("id, label, start_date, end_date, is_active")
        .order("start_date", { ascending: false });

      if (!periods || periods.length === 0) {
        setLoading(false);
        return;
      }

      // Find current (latest active or latest) and previous period
      const activePeriods = periods.filter(p => p.is_active);
      const currPeriod = activePeriods.length > 0 ? activePeriods[0] : periods[0];
      const currIdx = periods.findIndex(p => p.id === currPeriod.id);
      const prevPeriod = currIdx < periods.length - 1 ? periods[currIdx + 1] : null;

      setCurrPeriodLabel(currPeriod.label);
      setPrevPeriodLabel(prevPeriod?.label || "");

      const currStart = currPeriod.start_date + "T00:00:00+09:00";
      const currEnd = currPeriod.end_date + "T23:59:59+09:00";
      const prevStart = prevPeriod ? prevPeriod.start_date + "T00:00:00+09:00" : currStart;
      const prevEnd = prevPeriod ? prevPeriod.end_date + "T23:59:59+09:00" : currStart;

      const studentNames = students.map(s => s.student_name);
      const { data: allSessions } = await supabase
        .from("class_sessions")
        .select("id, student_name, scheduled_at, topic")
        .in("student_name", studentNames)
        .gte("scheduled_at", prevStart)
        .lte("scheduled_at", currEnd)
        .order("scheduled_at", { ascending: true });

      const sessMap: Record<string, { prev: SG[]; curr: SG[] }> = {};
      const initTopics: Record<string, string> = {};
      
      students.forEach(s => {
        sessMap[s.student_name] = { prev: [], curr: [] };
      });

      const currStartDate = new Date(currStart);
      const currEndDate = new Date(currEnd);
      const prevStartDate = prevPeriod ? new Date(prevStart) : null;
      const prevEndDate = prevPeriod ? new Date(prevEnd) : null;

      (allSessions || []).forEach(sess => {
        const d = new Date(sess.scheduled_at);
        const entry: SG = { id: sess.id, scheduled_at: sess.scheduled_at, topic: sess.topic || "" };
        if (sessMap[sess.student_name]) {
          if (prevStartDate && prevEndDate && d >= prevStartDate && d <= prevEndDate) {
            sessMap[sess.student_name].prev.push(entry);
          } else if (d >= currStartDate && d <= currEndDate) {
            sessMap[sess.student_name].curr.push(entry);
            initTopics[sess.id] = sess.topic || "";
          }
        }
      });

      setStudentSessions(sessMap);
      setTopics(initTopics);
      setOrigTopics({ ...initTopics });
      setLoading(false);
    })();
  }, [students]);

  const changedIds = Object.keys(topics).filter(id => (topics[id] || "").trim() !== (origTopics[id] || "").trim());

  const handleSave = async () => {
    setSaving(true);
    // 1. Save all changed session topics
    for (const id of changedIds) {
      await supabase.from("class_sessions").update({ topic: topics[id].trim() }).eq("id", id);
    }
    // 2. Sync lesson_goal on instructor_students for each student
    for (const s of students) {
      const data = studentSessions[s.student_name];
      if (!data) continue;
      const sessionTopics = data.curr
        .map((sess, i) => {
          const val = (topics[sess.id] || "").trim();
          return val ? `${i + 1}회: ${val}` : null;
        })
        .filter(Boolean);
      if (sessionTopics.length > 0) {
        await supabase
          .from("instructor_students")
          .update({ lesson_goal: sessionTopics.join(" / ") })
          .eq("id", s.id);
      }
    }
    setOrigTopics({ ...topics });
    toast({ title: `${changedIds.length}개 세션의 수업 목표가 저장되었습니다 ✓` });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-card rounded-2xl shadow-xl border border-border w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-gold-dark" />
            수업 목표 일괄 설정
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Column headers */}
        <div className="px-5 pt-3 pb-1 grid grid-cols-2 gap-4">
          <p className="text-[10px] font-semibold text-muted-foreground text-center">{prevPeriodLabel || "이전"} (지난 기간)</p>
          <p className="text-[10px] font-semibold text-navy text-center">{currPeriodLabel || "현재"} (이번 기간)</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : students.map(s => {
            const data = studentSessions[s.student_name] || { prev: [], curr: [] };
            const hasChange = data.curr.some(sess => (topics[sess.id] || "").trim() !== (origTopics[sess.id] || "").trim());
            
            return (
              <div key={s.id} className={cn("p-3 rounded-lg border space-y-2", hasChange ? "border-gold bg-gold/5" : "border-border bg-muted/20")}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    {formatStudentName(s.student_name, s.english_name)}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {s.level}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Previous month - read only */}
                  <div className="space-y-1.5">
                    {data.prev.length > 0 ? data.prev.map((sess, i) => (
                      <div key={sess.id} className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground w-4 flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 h-7 px-2 text-xs rounded border border-border bg-muted/40 text-muted-foreground flex items-center truncate">
                          {sess.topic || <span className="text-muted-foreground/40">—</span>}
                        </div>
                      </div>
                    )) : (
                      <div className="h-7 flex items-center text-xs text-muted-foreground/40 italic px-2">세션 없음</div>
                    )}
                  </div>
                  {/* This month - editable */}
                  <div className="space-y-1.5">
                    {data.curr.length > 0 ? data.curr.map((sess, i) => (
                      <div key={sess.id} className="flex items-center gap-1.5">
                        <span className="text-[10px] text-navy font-medium w-4 flex-shrink-0">{i + 1}</span>
                        <input
                          type="text"
                          value={topics[sess.id] || ""}
                          onChange={(e) => {
                            setTopics(prev => ({ ...prev, [sess.id]: e.target.value }));
                          }}
                          onBlur={async () => {
                            const val = (topics[sess.id] || "").trim();
                            const orig = (origTopics[sess.id] || "").trim();
                            if (val !== orig) {
                              setAutoSaveStatus("saving");
                              await supabase.from("class_sessions").update({ topic: val }).eq("id", sess.id);
                              setOrigTopics(prev => ({ ...prev, [sess.id]: val }));
                              setAutoSaveStatus("saved");
                              setTimeout(() => setAutoSaveStatus(s => s === "saved" ? "idle" : s), 2000);
                            }
                          }}
                          placeholder={data.prev[i]?.topic || `${i + 1}회차 목표`}
                          className="flex-1 h-7 px-2 text-xs rounded border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    )) : (
                      <div className="h-7 flex items-center text-xs text-muted-foreground/40 italic px-2">세션 없음</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            {autoSaveStatus === "saving" && <><Loader2 className="w-3 h-3 animate-spin" /> 저장 중...</>}
            {autoSaveStatus === "saved" && <><Check className="w-3 h-3 text-green-600" /> 자동 저장됨</>}
            {autoSaveStatus === "idle" && `${changedIds.length}개 변경됨`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">닫기</Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-navy hover:bg-navy-light text-primary-foreground"
              onClick={handleSave}
              disabled={saving || changedIds.length === 0}
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
              저장하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
