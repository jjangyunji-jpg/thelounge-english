import { useEffect, useState } from "react";
import { BookOpen, Loader2, LogOut, Clock, Hash, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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

  useEffect(() => {
    loadWaitlistData();

    // Realtime subscription for queue updates
    const channel = supabase
      .channel("waitlist-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waitlist_entries" },
        () => {
          loadWaitlistData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadWaitlistData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }

    // Get my entry
    const { data: myEntry } = await supabase
      .from("waitlist_entries")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("status", "waiting")
      .maybeSingle();

    if (!myEntry) {
      // No waitlist entry — check if approved
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, approved")
        .eq("user_id", session.user.id);

      const studentRole = roles?.find((r) => r.role === "student");
      if (studentRole?.approved) {
        navigate("/my/dashboard");
      }
      setLoading(false);
      return;
    }

    setEntry(myEntry as WaitlistEntry);

    // Get all waiting entries to calculate position
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
          <div>
            <p className="text-lg font-bold text-foreground">
              {entry?.student_name}님, 대기 중입니다
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              승인이 완료되면 수업을 시작할 수 있습니다
            </p>
          </div>

          {position !== null && (
            <div className="bg-muted/50 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Hash className="w-5 h-5 text-gold" />
                <span className="text-3xl font-black text-foreground">{position}</span>
                <span className="text-sm text-muted-foreground">/ {totalWaiting}명</span>
              </div>
              <p className="text-xs text-muted-foreground">현재 대기 순번</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            대기번호: #{entry?.queue_number}
          </p>
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
