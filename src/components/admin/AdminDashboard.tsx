import { Users, GraduationCap, BookOpen, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  { label: "활성 강사", value: "4명", icon: Users, color: "text-navy", bg: "bg-navy/8" },
  { label: "현재 수강생", value: "23명", icon: GraduationCap, color: "text-gold-dark", bg: "bg-gold/8" },
  { label: "이번달 수업", value: "87회", icon: BookOpen, color: "text-success", bg: "bg-success/8" },
  { label: "미확인 숙제", value: "5건", icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/8" },
];

const todaySchedule = [
  { time: "10:00", student: "김민준", instructor: "Sarah Kim", level: "Intermediate" },
  { time: "11:30", student: "이지은", instructor: "James Park", level: "Advanced" },
  { time: "14:00", student: "박서연", instructor: "Sarah Kim", level: "Beginner" },
  { time: "15:30", student: "최현우", instructor: "Emily Lee", level: "Intermediate" },
  { time: "17:00", student: "정다은", instructor: "James Park", level: "Advanced" },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">대시보드</h1>
        <p className="text-muted-foreground text-sm mt-1">The Lounge English 운영 현황</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
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
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {todaySchedule.map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                <span className="text-sm font-semibold text-navy w-12 flex-shrink-0">{item.time}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{item.student}</p>
                  <p className="text-xs text-muted-foreground">{item.instructor}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
                  {item.level}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gold" />
            이번달 요약
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-navy/5">
              <p className="text-xl font-bold text-navy">87</p>
              <p className="text-xs text-muted-foreground mt-1">총 수업 횟수</p>
            </div>
            <div className="p-4 rounded-lg bg-gold/8">
              <p className="text-xl font-bold text-gold-dark">₩2,610,000</p>
              <p className="text-xs text-muted-foreground mt-1">강사 지급 예정액</p>
            </div>
            <div className="p-4 rounded-lg bg-success/8">
              <p className="text-xl font-bold text-success">94%</p>
              <p className="text-xs text-muted-foreground mt-1">숙제 제출률</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
