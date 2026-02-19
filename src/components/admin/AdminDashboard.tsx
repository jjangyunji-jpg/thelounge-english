import { useEffect, useState } from "react";
import { Users, GraduationCap, BookOpen, TrendingUp, Clock, AlertCircle, Video, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface TodaySession {
  id: string;
  student_name: string;
  instructor_name: string;
  level: string;
  scheduled_at: string;
  meet_link: string | null;
  topic: string | null;
}

interface DashboardStats {
  activeInstructors: number;
  activeStudents: number;
  monthSessions: number;
  pendingSubmissions: number;
  monthRevenue: number;
  hwSubmitRate: number;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      instructorsRes,
      studentsRes,
      monthSessionsRes,
      pendingSubsRes,
      allSubsRes,
      todaySessionsRes,
      lessonRateRes,
    ] = await Promise.all([
      supabase.from("instructors").select("id", { count: "exact" }).eq("active", true),
      supabase.from("instructor_students").select("student_name", { count: "exact" }),
      supabase.from("class_sessions").select("id", { count: "exact" })
        .gte("scheduled_at", monthStart).lt("scheduled_at", todayEnd),
      supabase.from("homework_submissions").select("id", { count: "exact" }).eq("status", "submitted"),
      supabase.from("homework_submissions").select("id", { count: "exact" }),
      supabase.from("class_sessions")
        .select("id,student_name,instructor_name,level,scheduled_at,meet_link,topic")
        .gte("scheduled_at", todayStart).lt("scheduled_at", todayEnd)
        .order("scheduled_at", { ascending: true }),
      supabase.from("instructors").select("lesson_rate").eq("active", true),
    ]);

    const monthSessions = monthSessionsRes.count ?? 0;
    const avgRate = lessonRateRes.data?.length
      ? lessonRateRes.data.reduce((s, r) => s + r.lesson_rate, 0) / lessonRateRes.data.length
      : 30000;
    const allSubs = allSubsRes.count ?? 0;
    const pendingSubs = pendingSubsRes.count ?? 0;
    const reviewedSubs = allSubs - pendingSubs;
    const hwRate = allSubs > 0 ? Math.round((reviewedSubs / allSubs) * 100) : 0;

    // Unique students this month
    const uniqueStudents = new Set(
      (studentsRes.data || []).map((s) => s.student_name)
    ).size;

    setStats({
      activeInstructors: instructorsRes.count ?? 0,
      activeStudents: uniqueStudents,
      monthSessions,
      pendingSubmissions: pendingSubs,
      monthRevenue: monthSessions * avgRate,
      hwSubmitRate: hwRate,
    });
    setTodaySessions(todaySessionsRes.data || []);
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const statCards = stats ? [
    {
      label: "활성 강사",
      value: `${stats.activeInstructors}명`,
      icon: Users,
      color: "text-navy",
      bg: "bg-navy/8",
    },
    {
      label: "등록 수강생",
      value: `${stats.activeStudents}명`,
      icon: GraduationCap,
      color: "text-gold-dark",
      bg: "bg-gold/8",
    },
    {
      label: "이번달 수업",
      value: `${stats.monthSessions}회`,
      icon: BookOpen,
      color: "text-success",
      bg: "bg-success/8",
    },
    {
      label: "미검토 제출",
      value: `${stats.pendingSubmissions}건`,
      icon: AlertCircle,
      color: stats.pendingSubmissions > 0 ? "text-destructive" : "text-success",
      bg: stats.pendingSubmissions > 0 ? "bg-destructive/8" : "bg-success/8",
    },
  ] : [];

  return (
    <div className="space-y-6">
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
          <span className="hidden sm:inline">{lastUpdated.toLocaleTimeString("ko-KR")} 기준</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="shadow-card border-border">
                <CardContent className="p-5 space-y-2 animate-pulse">
                  <div className="w-10 h-10 rounded-lg bg-muted" />
                  <div className="w-16 h-7 rounded bg-muted" />
                  <div className="w-20 h-3 rounded bg-muted" />
                </CardContent>
              </Card>
            ))
          : statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="shadow-card border-border">
                  <CardContent className="p-5">
                    <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{stat.label}</p>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Today's Schedule */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-gold" />
            오늘의 수업 일정
            {todaySessions.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium ml-auto">
                {todaySessions.length}건
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : todaySessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">오늘 예정된 수업이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {todaySessions.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                  <span className="text-sm font-semibold text-navy w-12 flex-shrink-0">
                    {formatTime(item.scheduled_at)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.student_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.instructor_name}{item.topic ? ` · ${item.topic}` : ""}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium flex-shrink-0">
                    {item.level}
                  </span>
                  <a href={`/classroom?sessionId=${item.id}`}>
                    <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs text-navy hover:bg-navy/8">
                      <Video className="w-3 h-3" />
                      입장
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly summary */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gold" />
            이번달 요약
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-navy/5">
                <p className="text-xl font-bold text-navy">{stats.monthSessions}</p>
                <p className="text-xs text-muted-foreground mt-1">총 수업 횟수</p>
              </div>
              <div className="p-4 rounded-lg bg-gold/8">
                <p className="text-xl font-bold text-gold-dark">
                  ₩{stats.monthRevenue.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">강사 지급 예정액</p>
              </div>
              <div className="p-4 rounded-lg bg-success/8">
                <p className="text-xl font-bold text-success">{stats.hwSubmitRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">숙제 제출률</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
