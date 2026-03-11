import { useEffect, useState } from "react";
import { Users, GraduationCap, DollarSign, UserPlus, Calendar, Star, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn, todayKSTString } from "@/lib/utils";

const BASE_SALARY = 11000;
const LEVEL_RATES: Record<string, number> = {
  A1: 14000, A2: 14000,
  B1: 19000, B2: 19000,
  C1: 24000, C2: 24000,
};

interface InstructorCard {
  id: string;
  name: string;
  position: string;
  active: boolean;
  lesson_rate: number;
  studentCount: number;
  estimatedPay: number;
  feedbackAvg: number | null;
  scheduleSlot: string;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  // Top stats
  const [activeInstructors, setActiveInstructors] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [newStudentsThisMonth, setNewStudentsThisMonth] = useState(0);
  const [totalEstimatedPay, setTotalEstimatedPay] = useState(0);
  // Period & holidays
  const [period, setPeriod] = useState<{ label: string; start_date: string; end_date: string } | null>(null);
  const [holidays, setHolidays] = useState<{ title: string; date_start: string; date_end: string }[]>([]);
  // Instructor cards
  const [instructorCards, setInstructorCards] = useState<InstructorCard[]>([]);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const todayStr = todayKSTString();
    const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const monthStart = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEnd = new Date(kstNow.getFullYear(), kstNow.getMonth() + 1, 0);
    const monthEndStr = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;

    const [
      insRes, studRes, periodRes, holidayRes, sessRes, feedbackRes, meetRes,
    ] = await Promise.all([
      supabase.from("instructors").select("id,name,position,active,lesson_rate,meeting_rate").eq("active", true),
      supabase.from("instructor_students").select("id,instructor_id,student_name,schedules,created_at,status,instructor_name"),
      supabase.from("schedule_periods").select("*").eq("is_active", true).order("start_date", { ascending: true }),
      supabase.from("holiday_notices").select("title,date_start,date_end").gte("date_end", todayStr).order("date_start", { ascending: true }),
      supabase.from("class_sessions").select("id,instructor_name,level,scheduled_at,student_name,ended_at"),
      supabase.from("class_feedback").select("instructor_name,satisfaction,teaching_quality,communication,lesson_preparation,ratings"),
      supabase.from("business_meetings").select("id,instructor_id,scheduled_at,duration_minutes,notes"),
    ]);

    const instructors = insRes.data || [];
    const students = studRes.data || [];
    const allSessions = sessRes.data || [];
    const allFeedback = feedbackRes.data || [];

    // Current period
    const periods = periodRes.data || [];
    const currentPeriod = periods.find(p => p.start_date <= todayStr && p.end_date >= todayStr) || periods[0] || null;
    setPeriod(currentPeriod);
    setHolidays(holidayRes.data || []);

    // Top stats
    setActiveInstructors(instructors.length);
    const activeStudents = students.filter(s => s.status === "active" || !s.status);
    setTotalStudents(activeStudents.length);

    // New students this month
    const newThisMonth = students.filter(s => s.created_at && s.created_at.slice(0, 10) >= monthStart).length;
    setNewStudentsThisMonth(newThisMonth);

    // Per-instructor cards
    const cards: InstructorCard[] = instructors.map(ins => {
      const insStudents = students.filter(s => s.instructor_id === ins.id && (s.status === "active" || !s.status));
      const studentCount = insStudents.length;

      // Schedule slot detection from students' schedules
      const scheduleSlot = detectScheduleSlot(insStudents.map(s => s.schedules).filter(Boolean) as string[]);

      // Collect all instructor name variants (ins.name + instructor_name from students)
      const nameSet = new Set<string>([ins.name]);
      insStudents.forEach(s => { if (s.instructor_name) nameSet.add(s.instructor_name); });

      // Estimated pay for current period
      let estimatedPay = 0;
      if (currentPeriod) {
        const periodSessions = allSessions.filter(s => {
          const d = s.scheduled_at.slice(0, 10);
          return nameSet.has(s.instructor_name) && d >= currentPeriod.start_date && d <= todayStr;
        });
        if (ins.position === "대표") {
          estimatedPay = periodSessions.length * ins.lesson_rate;
        } else {
          periodSessions.forEach(s => {
            const levelRate = LEVEL_RATES[s.level] || 19000;
            estimatedPay += BASE_SALARY + levelRate;
          });
        }
      }

      // Feedback average
      const insFeedback = allFeedback.filter(f => nameSet.has(f.instructor_name));
      let feedbackAvg: number | null = null;
      if (insFeedback.length > 0) {
        const avg = insFeedback.reduce((sum, fb) => {
          const cats = [fb.satisfaction, fb.teaching_quality, fb.communication, fb.lesson_preparation];
          return sum + cats.reduce((a, b) => a + b, 0) / cats.length;
        }, 0) / insFeedback.length;
        feedbackAvg = Math.round(avg * 10) / 10;
      }

      return {
        id: ins.id,
        name: ins.name,
        position: ins.position,
        active: true,
        lesson_rate: ins.lesson_rate,
        studentCount,
        estimatedPay,
        feedbackAvg,
        scheduleSlot,
      };
    });

    setInstructorCards(cards);
    setTotalEstimatedPay(cards.reduce((s, c) => s + c.estimatedPay, 0));
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">대시보드</h1>
          <p className="text-muted-foreground text-sm mt-1">The Lounge English 운영 현황</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          <span className="hidden sm:inline">{lastUpdated.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul" })} 기준</span>
        </button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-card border-border">
              <CardContent className="p-5 space-y-2 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="w-16 h-7 rounded bg-muted" />
                <div className="w-20 h-3 rounded bg-muted" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard icon={Users} label="활성 강사" value={`${activeInstructors}명`} color="text-navy" bg="bg-navy/8" />
            <StatCard icon={GraduationCap} label="등록 수강생" value={`${totalStudents}명`} color="text-gold-dark" bg="bg-gold/8" />
            <StatCard icon={UserPlus} label="이번달 신규 수강생" value={`${newStudentsThisMonth}명`} color="text-success" bg="bg-success/8" />
            <StatCard icon={DollarSign} label="강사 지급 예정액" value={`₩${totalEstimatedPay.toLocaleString()}`} color="text-navy" bg="bg-navy/8" />
          </>
        )}
      </div>

      {/* Period & Holidays */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-navy" />
                <h3 className="text-sm font-semibold text-foreground">현재 수업 기간</h3>
              </div>
              {period ? (
                <div className="space-y-1">
                  <p className="text-lg font-bold text-navy">{period.label}</p>
                  <p className="text-xs text-muted-foreground">{period.start_date} ~ {period.end_date}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">설정된 활성 기간이 없습니다</p>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-destructive" />
                <h3 className="text-sm font-semibold text-foreground">휴강 일정</h3>
              </div>
              {holidays.length === 0 ? (
                <p className="text-sm text-muted-foreground">예정된 휴강 일정이 없습니다</p>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {holidays.map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{h.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {h.date_start === h.date_end ? h.date_start : `${h.date_start} ~ ${h.date_end}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Instructor Cards */}
      {!loading && (
        <div>
          <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-navy" />
            강사별 현황
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {instructorCards.map(card => (
              <Card key={card.id} className="shadow-card border-border hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3">
                  {/* Name & position */}
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-navy font-bold text-sm">{card.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">{card.name}</p>
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        card.position === "대표" ? "border-gold/30 text-gold-dark" :
                        card.position === "매니저" ? "border-navy/30 text-navy" : ""
                      )}>
                        {card.position}
                      </Badge>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-muted/40 text-center">
                      <p className="text-[10px] text-muted-foreground">근무 일정</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5">{card.scheduleSlot}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/40 text-center">
                      <p className="text-[10px] text-muted-foreground">담당 수강생</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5">{card.studentCount}명</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/40 text-center">
                      <p className="text-[10px] text-muted-foreground">지급 예정액</p>
                      <p className="text-xs font-semibold text-navy mt-0.5">₩{card.estimatedPay.toLocaleString()}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/40 text-center">
                      <p className="text-[10px] text-muted-foreground">피드백 점수</p>
                      <div className="flex items-center justify-center gap-0.5 mt-0.5">
                        {card.feedbackAvg !== null ? (
                          <>
                            <Star className={cn("w-3 h-3", card.feedbackAvg >= 4 ? "text-gold fill-gold" : card.feedbackAvg >= 3 ? "text-amber-400 fill-amber-400" : "text-muted-foreground")} />
                            <span className="text-xs font-semibold text-foreground">{card.feedbackAvg}</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <Card className="shadow-card border-border">
      <CardContent className="p-5">
        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-muted-foreground text-xs mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

/** Detect the most common schedule slot from students' schedule strings */
function detectScheduleSlot(schedules: string[]): string {
  if (schedules.length === 0) return "미정";

  let weekdayAM = 0, weekdayPM = 0, weekendAM = 0, weekendPM = 0;

  for (const sched of schedules) {
    const lower = sched.toLowerCase();
    const isWeekend = /토|일|sat|sun/.test(lower);
    // Try to extract hour
    const hourMatch = lower.match(/(\d{1,2})시|(\d{1,2}):/);
    const hour = hourMatch ? parseInt(hourMatch[1] || hourMatch[2]) : null;
    const isPM = hour !== null ? hour >= 13 : /오후|pm/.test(lower);

    if (isWeekend) {
      if (isPM) weekendPM++; else weekendAM++;
    } else {
      if (isPM) weekdayPM++; else weekdayAM++;
    }
  }

  const slots = [
    { label: "평일 오전", count: weekdayAM },
    { label: "평일 오후", count: weekdayPM },
    { label: "주말 오전", count: weekendAM },
    { label: "주말 오후", count: weekendPM },
  ];

  const max = slots.reduce((a, b) => b.count > a.count ? b : a);
  if (max.count === 0) return "평일";
  return max.label;
}
