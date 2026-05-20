import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { resetLocalAuthSession } from "@/lib/authStorage";

const withTimeout = async <T,>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} 응답이 지연되고 있습니다.`)), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export default function InstructorLogin() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetLocalAuthSession();
      const { error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }), 12000, "로그인");
      if (error) {
        toast({ title: "로그인 실패", description: error.message, variant: "destructive" });
      } else {
        navigate("/t/dashboard");
      }
    } catch (error) {
      toast({ title: "로그인 실패", description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
            <p className="text-sm text-muted-foreground">강사 포털</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
          <div>
            <h1 className="font-bold text-base text-foreground">로그인</h1>
            <p className="text-xs text-muted-foreground mt-0.5">강사 계정으로 로그인하세요</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">이메일</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@loungeenglish.com"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">비밀번호</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-navy hover:bg-navy-light text-primary-foreground font-semibold gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              로그인
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
