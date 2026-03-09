import { useEffect, useState } from "react";
import { BookOpen, Loader2, LogOut, Clock, Hash, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import StudentSurvey from "@/components/waitlist/StudentSurvey";

interface WaitlistEntry {
  id: string;
  queue_number: number;
  status: string;
  created_at: string;
  student_name: string;
}

// Placeholder videos — admin can configure these later
const WAITLIST_VIDEOS = [
  {
    title: "The Lounge English 소개",
    description: "더 라운지 잉글리시에서의 수업 방식을 알아보세요.",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
  {
    title: "영어 학습 팁",
    description: "효과적인 영어 학습 방법을 소개합니다.",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
];

export default function Waitlist() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<WaitlistEntry | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [totalWaiting, setTotalWaiting] = useState(0);
  const [surveyCompleted, setSurveyCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    loadWaitlistData();

    const channel = supabase
      .channel("waitlist-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waitlist_entries" },
        () => { loadWaitlistData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadWaitlistData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }

    // Fetch waitlist entry + survey status in parallel
    const [entryRes, surveyRes, rolesRes] = await Promise.all([
      supabase
        .from("waitlist_entries")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("status", "waiting")
        .maybeSingle(),
      supabase
        .from("student_surveys")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role, approved")
        .eq("user_id", session.user.id),
    ]);

    setSurveyCompleted(!!surveyRes.data);

    const myEntry = entryRes.data;
    if (!myEntry) {
      const studentRole = rolesRes.data?.find((r) => r.role === "student");
      if (studentRole?.approved) {
        navigate("/my/dashboard");
      }
      setLoading(false);
      return;
    }

    setEntry(myEntry as WaitlistEntry);

    const { data: allWaiting } = await supabase
      .from("waitlist_entries")
      .select("queue_number")
      .eq("status", "waiting")
      .order("queue_number", { ascending: true });

    if (allWaiting) {
      setTotalWaiting(allWaiting.length);
      const pos = allWaiting.findIndex((w) => w.queue_number === myEntry.queue_number) + 1;
      setPosition(pos > 0 ? pos : null);
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show survey if not completed
  if (surveyCompleted === false && entry) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl gold-gradient flex items-center justify-center shadow-gold">
                <BookOpen className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">The Lounge English</p>
                <p className="text-xs text-muted-foreground">학습 성향 설문</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground text-xs gap-1.5">
              <LogOut className="w-3.5 h-3.5" />
              로그아웃
            </Button>
          </div>
        </header>
        <main className="px-4 py-8">
          <StudentSurvey
            studentName={entry.student_name}
            onComplete={() => setSurveyCompleted(true)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gold-gradient flex items-center justify-center shadow-gold">
              <BookOpen className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">The Lounge English</p>
              <p className="text-xs text-muted-foreground">대기 현황</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground text-xs gap-1.5">
            <LogOut className="w-3.5 h-3.5" />
            로그아웃
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Queue Status Card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center shadow-gold mx-auto">
            <Clock className="w-8 h-8 text-accent-foreground" />
          </div>
          {position !== null && (() => {
            const now = new Date();
            const monthsToWait = Math.ceil(position / 10);
            const estimatedDate = new Date(now.getFullYear(), now.getMonth() + monthsToWait, 1);
            const estimatedMonth = estimatedDate.getMonth() + 1;
            return (
              <div className="space-y-4">
                <p className="text-lg font-bold text-foreground">
                  {entry?.student_name}님은 현재 <span className="text-gold">{position}</span>번째 대기중입니다.
                </p>
                <div className="bg-muted/50 rounded-xl p-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
                  <p>매달 말, 다음달 등록을 위해 순차적으로 연락을 드리고 있습니다.</p>
                  <p>
                    예상 등록 시기는 <span className="font-bold text-foreground">{estimatedMonth}월</span>이며, 보다 빨라지거나 늦어질 수 있습니다.
                  </p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Videos Section */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Play className="w-4 h-4 text-gold" />
            대기 중 영상 자료
          </h2>
          <div className="grid gap-4">
            {WAITLIST_VIDEOS.map((video, idx) => (
              <div key={idx} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="aspect-video">
                  <iframe
                    src={video.embedUrl}
                    title={video.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="p-4">
                  <p className="font-semibold text-sm text-foreground">{video.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{video.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
