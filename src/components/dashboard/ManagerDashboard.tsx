import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, Users, User as UserIcon, Plus, LogOut, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import MakeupRequestModal from "./MakeupRequestModal";
import { useNavigate } from "react-router-dom";

interface Schedule { day: string; time: string; }

interface ManagedSchedule {
  id: string;
  primaryName: string;
  groupStudents: string[];
  displayName: string;        // "도은 + 지아나" 또는 "한지은"
  isGroup: boolean;
  instructorName: string;
  schedules: Schedule[];
  nextSessionAt: string | null;
  monthCount: number;
}

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

interface UpcomingSession {
  id: string;
  scheduled_at: string;
  label: string;
}

function fmtNext(iso: string) {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" });
  const timeStr = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
  return `${dateStr} ${timeStr}`;
}

interface Props {
  managerName: string;
  corporateAccount: string;
  onLogout: () => void;
}

export default function ManagerDashboard({ managerName, corporateAccount, onLogout }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ManagedSchedule[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingSession[]>([]);
  const [bookingFor, setBookingFor] = useState<ManagedSchedule | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  // Build current KST month cells (with leading/trailing pad)
  const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const monthYear = kstNow.getFullYear();
  const monthIdx = kstNow.getMonth();
  const firstDow = new Date(monthYear, monthIdx, 1).getDay();
  const daysInMonth = new Date(monthYear, monthIdx + 1, 0).getDate();
  const cells: { year: number; month: number; day: number; outside: boolean }[] = [];
  // leading
  const prevDays = new Date(monthYear, monthIdx, 0).getDate();
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push({ year: monthYear, month: monthIdx - 1, day: prevDays - i, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ year: monthYear, month: monthIdx, day: d, outside: false });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const next = new Date(last.year, last.month, last.day + 1);
    cells.push({ year: next.getFullYear(), month: next.getMonth(), day: next.getDate(), outside: true });
  }

  // Group upcoming sessions by date key (KST)
  const sessionsByDate = new Map<string, UpcomingSession[]>();
  upcoming.forEach((u) => {
    const d = new Date(new Date(u.scheduled_at).toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString();
    const arr = sessionsByDate.get(key) || [];
    arr.push(u);
    sessionsByDate.set(key, arr);
  });

  const todayKey = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate()).toDateString();
  const selectedSessions = selectedDateKey ? (sessionsByDate.get(selectedDateKey) || []) : [];
  const selectedDateObj = selectedDateKey ? new Date(selectedDateKey) : null;


  const load = async () => {
    setLoading(true);

    // KST month range
    const now = new Date();
    const kstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const monthStart = new Date(kstNow.getFullYear(), kstNow.getMonth(), 1);
    const monthEnd = new Date(kstNow.getFullYear(), kstNow.getMonth() + 1, 1);

    const { data: rows } = await supabase
      .from("instructor_students")
      .select("id, student_name, group_students, instructor_name, schedules, status")
      .eq("corporate_account", corporateAccount)
      .neq("corporate_role", "manager")
      .eq("status", "active");

    const learners = (rows || []) as any[];
    const allNames = new Set<string>();
    learners.forEach((l) => {
      allNames.add(l.student_name);
      (l.group_students || []).forEach((g: string) => allNames.add(g));
    });

    // Fetch sessions for all related students in this month + future (for next session)
    const { data: sessions } = await supabase
      .from("class_sessions")
      .select("id, scheduled_at, student_name, group_students, cancellation_type, ended_at")
      .or(
        Array.from(allNames)
          .map((n) => `student_name.eq.${n}`)
          .join(",")
      )
      .gte("scheduled_at", monthStart.toISOString())
      .order("scheduled_at", { ascending: true });

    // Dedupe group classes: only keep row whose student_name is alphabetically first in the group
    const dedupedLearners = learners.filter((l) => {
      const members = [l.student_name, ...((l.group_students as string[]) || [])];
      const first = [...members].sort()[0];
      return l.student_name === first;
    });

    const built: ManagedSchedule[] = dedupedLearners.map((l) => {
      const isGroup = (l.group_students || []).length > 0;
      const display = isGroup
        ? [l.student_name, ...(l.group_students as string[])].sort().join(" + ")
        : l.student_name;

      const matched = (sessions || []).filter(
        (s: any) => s.student_name === l.student_name
      );

      // count this month (exclude cancelled)
      const monthCount = matched.filter((s: any) => {
        const t = new Date(s.scheduled_at).getTime();
        return (
          t >= monthStart.getTime() &&
          t < monthEnd.getTime() &&
          !s.cancellation_type
        );
      }).length;

      // next session = first future, not cancelled
      const nowMs = Date.now();
      const next = matched.find(
        (s: any) => new Date(s.scheduled_at).getTime() >= nowMs && !s.cancellation_type
      );

      return {
        id: l.id,
        primaryName: l.student_name,
        groupStudents: l.group_students || [],
        displayName: display,
        isGroup,
        instructorName: l.instructor_name || "—",
        schedules: Array.isArray(l.schedules) ? l.schedules : [],
        nextSessionAt: next?.scheduled_at || null,
        monthCount,
      };
    });

    // Sort: group first then individual, then alphabetically
    built.sort((a, b) => {
      if (a.isGroup !== b.isGroup) return a.isGroup ? -1 : 1;
      return a.displayName.localeCompare(b.displayName, "ko");
    });

    setItems(built);

    // Build unified upcoming session list (this month, future, not cancelled)
    const nowMs = Date.now();
    const labelByName = new Map<string, string>();
    built.forEach((b) => labelByName.set(b.primaryName, b.displayName));
    const up: UpcomingSession[] = (sessions || [])
      .filter(
        (s: any) =>
          labelByName.has(s.student_name) &&
          !s.cancellation_type &&
          new Date(s.scheduled_at).getTime() >= nowMs
      )
      .map((s: any) => ({
        id: s.id,
        scheduled_at: s.scheduled_at,
        label: labelByName.get(s.student_name) || s.student_name,
      }));
    setUpcoming(up);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [corporateAccount]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-foreground text-sm leading-none truncate">더라운지영어</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {managerName} 매니저 · {corporateAccount}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-muted"
          >
            <LogOut className="w-3.5 h-3.5" /> 로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="font-serif text-xl text-foreground">관리 수업</h1>
          <p className="text-xs text-muted-foreground mt-1">
            각 수업별로 보강·추가 신청을 진행할 수 있습니다.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 items-start">
        {/* Unified upcoming schedule */}
        <section className="border border-border rounded-xl bg-card p-4 lg:sticky lg:top-20">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-gold" />
            <h2 className="font-semibold text-foreground text-sm">
              {monthIdx + 1}월 수업 캘린더
            </h2>
            <span className="text-[11px] text-muted-foreground">({upcoming.length}건)</span>
          </div>

          <div className="grid grid-cols-7 text-center mb-1">
            {DAYS_KO.map((d, i) => (
              <div
                key={d}
                className={cn(
                  "text-[10px] font-semibold pb-1",
                  i === 0 ? "text-destructive/70" : "text-muted-foreground"
                )}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {cells.map((cell, idx) => {
              const date = new Date(cell.year, cell.month, cell.day);
              const dateKey = date.toDateString();
              const hasSession = sessionsByDate.has(dateKey);
              const isToday = dateKey === todayKey;
              const isSelected = selectedDateKey === dateKey;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setSelectedDateKey((prev) => (prev === dateKey ? null : dateKey))
                  }
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center rounded-md text-[11px] font-medium transition-all cursor-pointer",
                    isSelected ? "ring-2 ring-gold ring-offset-1 ring-offset-card" : "",
                    isToday
                      ? "bg-navy text-primary-foreground font-bold shadow-sm"
                      : hasSession
                      ? "bg-gold/15 text-gold-dark font-semibold hover:bg-gold/25"
                      : cell.outside
                      ? "text-muted-foreground/40 hover:bg-muted/30"
                      : "text-foreground hover:bg-muted/50"
                  )}
                >
                  {cell.outside ? `${cell.month + 1}/${cell.day}` : cell.day}
                  {hasSession && !isToday && (
                    <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-gold" />
                  )}
                </button>
              );
            })}
          </div>

          {selectedDateObj && (
            <div className="mt-3 rounded-md border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-foreground">
                  {selectedDateObj.getMonth() + 1}월 {selectedDateObj.getDate()}일 (
                  {DAYS_KO[selectedDateObj.getDay()]})
                </p>
                <button
                  onClick={() => setSelectedDateKey(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="닫기"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {selectedSessions.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">예정된 수업이 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedSessions
                    .sort(
                      (a, b) =>
                        new Date(a.scheduled_at).getTime() -
                        new Date(b.scheduled_at).getTime()
                    )
                    .map((s) => (
                      <div
                        key={s.id}
                        className="flex items-start gap-2 rounded-md bg-card border border-border px-2 py-1.5"
                      >
                        <Clock className="w-3 h-3 text-gold flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-foreground">
                            {new Date(s.scheduled_at).toLocaleTimeString("ko-KR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Seoul",
                              hour12: false,
                            })}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {s.label}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-3 text-[10px] text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gold" />
              수업일
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-navy" />
              오늘
            </div>
          </div>
        </section>

        <div>
        {items.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            관리 중인 수업이 없습니다.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="border border-border rounded-xl p-4 bg-card flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                      {it.isGroup ? (
                        <>
                          <Users className="w-3 h-3" /> 그룹 수업
                        </>
                      ) : (
                        <>
                          <UserIcon className="w-3 h-3" /> 개인 수업
                        </>
                      )}
                    </div>
                    <h2 className="font-semibold text-foreground text-sm truncate">
                      {it.displayName}
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      강사: {it.instructorName}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-foreground/80 space-y-1">
                  {it.schedules.length > 0 && (
                    <div className="flex items-start gap-1.5">
                      <Calendar className="w-3 h-3 mt-0.5 flex-shrink-0 text-gold" />
                      <span>
                        정기:{" "}
                        {it.schedules.map((s) => `${s.day} ${s.time}`).join(", ")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">다음 수업:</span>
                    <span>{it.nextSessionAt ? fmtNext(it.nextSessionAt) : "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">이번 달 누적:</span>
                    <span className="font-semibold text-gold">{it.monthCount}회</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1 border-gold/40 text-gold hover:bg-gold/10"
                  onClick={() => setBookingFor(it)}
                >
                  <Plus className="w-3.5 h-3.5" /> 수업 신청 / 변경
                </Button>
              </div>
            ))}
          </div>
        )}
        </div>
        </div>
      </main>

      {bookingFor && (
        <MakeupRequestModal
          studentName={bookingFor.primaryName}
          instructorName={bookingFor.instructorName}
          groupStudents={bookingFor.groupStudents}
          onClose={() => {
            setBookingFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}
