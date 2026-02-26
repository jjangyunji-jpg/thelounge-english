import { useState } from "react";
import { BookOpen, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      toast({
        title: "오류",
        description: err instanceof Error ? err.message : "요청 처리 중 오류가 발생했습니다.",
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
          <div className="w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center shadow-gold">
            <BookOpen className="w-7 h-7 text-accent-foreground" />
          </div>
          <div className="text-center">
            <p className="font-black text-xl text-foreground">The Lounge English</p>
            <p className="text-sm text-muted-foreground mt-0.5">비밀번호 재설정</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="w-10 h-10 text-primary" />
              <p className="font-bold text-foreground">이메일이 전송되었습니다!</p>
              <p className="text-sm text-muted-foreground">
                {email}로 비밀번호 재설정 링크를 보내드렸습니다. 이메일을 확인해주세요.
              </p>
              <Link to="/login" className="text-sm text-gold-dark font-medium hover:underline mt-2">
                로그인으로 돌아가기
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-bold text-base text-foreground">비밀번호 찾기</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  가입한 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">이메일</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="가입한 이메일 주소 입력"
                    required
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full gold-gradient text-accent-foreground font-bold gap-2 shadow-gold"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  재설정 링크 보내기
                </Button>
              </form>
              <p className="text-center text-xs text-muted-foreground">
                <Link to="/login" className="text-gold-dark font-medium hover:underline">
                  로그인으로 돌아가기
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
