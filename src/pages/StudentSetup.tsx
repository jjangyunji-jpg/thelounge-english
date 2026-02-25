import { useState, useEffect } from "react";
import { BookOpen, Loader2, CheckCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function StudentSetup() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "PASSWORD_RECOVERY" || event === "INITIAL_SESSION") && session) {
        setSessionReady(true);
        const name = session.user.user_metadata?.student_name || "";
        setStudentName(name);
        setNickname(name); // 기본값으로 학생명 채워두기
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
        const name = data.session.user.user_metadata?.student_name || "";
        setStudentName(name);
        setNickname(name);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      toast({ title: "닉네임을 입력해주세요.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "비밀번호 불일치", description: "비밀번호가 일치하지 않습니다.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "비밀번호 너무 짧음", description: "8자 이상 입력해주세요.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // 1. 비밀번호 설정
      const { data: { user }, error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw pwError;
      if (!user) throw new Error("세션 오류");

      // 2. student_profiles 생성
      const { error: profileError } = await supabase.from("student_profiles").upsert({
        user_id: user.id,
        student_name: studentName,
        nickname: nickname.trim(),
      }, { onConflict: "user_id" });
      if (profileError) throw profileError;

      setDone(true);
      setTimeout(() => navigate("/dashboard-student"), 2000);
    } catch (e: unknown) {
      toast({
        title: "오류 발생",
        description: e instanceof Error ? e.message : "다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl gold-gradient flex items-center justify-center shadow-gold">
            <BookOpen className="w-6 h-6 text-accent-foreground" />
          </div>
          <div className="text-center">
            <p className="font-bold text-lg text-foreground">The Lounge English</p>
            <p className="text-sm text-muted-foreground">학생 계정 설정</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="w-10 h-10 text-[hsl(var(--success))]" />
              <p className="font-bold text-foreground">계정 설정 완료!</p>
              <p className="text-sm text-muted-foreground">대시보드로 이동합니다...</p>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-bold text-base text-foreground">계정 설정</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sessionReady
                    ? studentName
                      ? `${studentName} 님, 닉네임과 비밀번호를 설정해주세요.`
                      : "닉네임과 비밀번호를 설정해주세요."
                    : "초대 링크를 확인하는 중입니다..."}
                </p>
              </div>

              <form onSubmit={handleSetup} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">닉네임</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="표시될 이름"
                      required
                      disabled={!sessionReady}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">대시보드에 표시될 이름입니다</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">새 비밀번호</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8자 이상 입력"
                    required
                    disabled={!sessionReady}
                    autoFocus={sessionReady}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">비밀번호 확인</Label>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="비밀번호 재입력"
                    required
                    disabled={!sessionReady}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || !sessionReady}
                  className="w-full bg-navy hover:bg-navy-light text-primary-foreground font-semibold gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  설정 완료
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
