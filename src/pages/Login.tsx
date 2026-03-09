import { useState } from "react";
import { BookOpen, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const userId = data.user.id;

      // Check role and approval (user may have multiple roles, pick highest priority)
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, approved")
        .eq("user_id", userId);

      // Instructor role takes priority for redirect (even if also admin)
      const priorityOrder = ["instructor", "admin", "student"];
      const roleData = (roles || []).sort(
        (a, b) => priorityOrder.indexOf(a.role) - priorityOrder.indexOf(b.role)
      )[0];

      if (!roleData) {
        await supabase.auth.signOut();
        toast({ title: "계정 정보를 찾을 수 없습니다.", variant: "destructive" });
        return;
      }

      if (!roleData.approved) {
        // Students go to waitlist page; instructors just see a message
        if (roleData.role === "student") {
          navigate("/waitlist");
          return;
        }
        await supabase.auth.signOut();
        toast({
          title: "승인 대기 중",
          description: "관리자 승인 후 로그인할 수 있습니다. 잠시 기다려주세요.",
          variant: "destructive",
        });
        return;
      }

      // Even if approved, check if student still has an active waitlist entry
      if (roleData.role === "student") {
        const { data: waitlistEntry } = await supabase
          .from("waitlist_entries")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "waiting")
          .maybeSingle();
        if (waitlistEntry) {
          navigate("/waitlist");
          return;
        }
      }

      // Redirect based on role
      switch (roleData.role) {
        case "admin":
          navigate("/admin");
          break;
        case "instructor":
          navigate("/t/dashboard");
          break;
        case "student":
          navigate("/my/dashboard");
          break;
        default:
          navigate("/");
      }
    } catch (e: unknown) {
      toast({
        title: "로그인 실패",
        description: e instanceof Error ? e.message : "이메일 또는 비밀번호를 확인해주세요.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center shadow-gold">
            <BookOpen className="w-7 h-7 text-accent-foreground" />
          </div>
          <div className="text-center">
            <p className="font-black text-xl text-foreground">The Lounge English</p>
            <p className="text-sm text-muted-foreground mt-0.5">로그인</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">이메일</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소 입력"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">비밀번호</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full gold-gradient text-accent-foreground font-bold gap-2 shadow-gold"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              로그인
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            <Link to="/forgot-password" className="text-gold-dark font-medium hover:underline">
              비밀번호를 잊으셨나요?
            </Link>
          </p>

          <p className="text-center text-xs text-muted-foreground">
            계정이 없으신가요?{" "}
            <Link to="/signup" className="text-gold-dark font-medium hover:underline">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
