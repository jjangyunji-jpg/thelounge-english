import { useEffect, useState } from "react";
import { BookOpen, Loader2, LogOut, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface WaitlistInfo {
  student_name: string;
  queue_number: number;
  status: string;
  desired_level: string | null;
  created_at: string;
}

export default function Waitlist() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<WaitlistInfo | null>(null);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      setEmail(session.user.email ?? "");

      const { data } = await supabase
        .from("waitlist_entries")
        .select("student_name, queue_number, status, desired_level, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setInfo(data);
      setLoading(false);
    };
    load();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "로그아웃되었습니다." });
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
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center shadow-gold">
            <BookOpen className="w-7 h-7 text-accent-foreground" />
          </div>
          <div className="text-center">
            <p className="font-black text-xl text-foreground">The Lounge English</p>
            <p className="text-sm text-muted-foreground mt-0.5">대기자 안내</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-gold-dark" />
            </div>
            <p className="font-bold text-foreground">관리자 승인 대기 중</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              가입 신청이 정상적으로 접수되었습니다.<br />
              담당자가 검토 후 순차적으로 승인하고 있으니<br />
              조금만 기다려주세요.
            </p>
          </div>

          {info && (
            <div className="bg-muted/40 rounded-xl p-4 space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">이름</span>
                <span className="font-medium text-foreground">{info.student_name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">이메일</span>
                <span className="font-medium text-foreground">{email}</span>
              </div>
              {info.desired_level && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">희망 레벨</span>
                  <span className="font-medium text-foreground">{info.desired_level}</span>
                </div>
              )}
              <div className="flex justify-between text-xs items-center">
                <span className="text-muted-foreground">대기 순번</span>
                <span className="font-bold text-gold-dark text-base">#{info.queue_number}</span>
              </div>
            </div>
          )}

          <p className="text-center text-[11px] text-muted-foreground">
            승인 완료 시 별도 안내 후 로그인이 가능합니다.<br />
            문의: <span className="text-gold-dark">담당 매니저</span>
          </p>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full gap-2"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </Button>
        </div>
      </div>
    </div>
  );
}
