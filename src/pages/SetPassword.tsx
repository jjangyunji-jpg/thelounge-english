import { useState, useEffect } from "react";
import { BookOpen, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function SetPassword() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase handles the invite token from the URL hash automatically
    // and fires onAuthStateChange with event = "PASSWORD_RECOVERY" or signs the user in
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") && session) {
        setSessionReady(true);
      }
    });

    // Also check if already has session (token already exchanged)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "비밀번호 불일치", description: "비밀번호가 일치하지 않습니다.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "비밀번호 너무 짧음", description: "비밀번호는 8자 이상이어야 합니다.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    } else {
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl gold-gradient flex items-center justify-center shadow-gold">
            <BookOpen className="w-6 h-6 text-accent-foreground" />
          </div>
          <div className="text-center">
            <p className="font-bold text-lg text-foreground">The Lounge English</p>
            <p className="text-sm text-muted-foreground">계정 설정</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="w-10 h-10 text-primary" />
              <p className="font-bold text-foreground">비밀번호가 설정되었습니다!</p>
              <p className="text-sm text-muted-foreground">잠시 후 대시보드로 이동합니다...</p>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-bold text-base text-foreground">비밀번호 설정</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sessionReady
                    ? "사용할 비밀번호를 입력해주세요."
                    : "초대 링크를 확인하는 중입니다..."}
                </p>
              </div>

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">새 비밀번호</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8자 이상 입력"
                    required
                    disabled={!sessionReady}
                    autoFocus
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
                  비밀번호 설정 완료
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
