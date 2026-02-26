import { useState, useEffect } from "react";
import { BookOpen, Loader2, CheckCircle, ArrowLeft, User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function MyProfile() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState("");
  const [studentName, setStudentName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      const { data: profile } = await supabase
        .from("student_profiles")
        .select("student_name, nickname")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profile) {
        setStudentName(profile.student_name);
        setNickname(profile.nickname || "");
      }
      setLoading(false);
    };
    loadProfile();
  }, [navigate]);

  const handleSaveNickname = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from("student_profiles")
      .update({ nickname: nickname.trim() || null })
      .eq("user_id", session.user.id);

    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "닉네임이 저장되었습니다 ✓" });
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast({ title: "비밀번호는 8자 이상이어야 합니다.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "비밀번호가 일치하지 않습니다.", variant: "destructive" });
      return;
    }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "변경 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "비밀번호가 변경되었습니다 ✓" });
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPw(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-border px-5 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span>돌아가기</span>
        </button>
        <div className="w-px h-5 bg-border" />
        <p className="font-bold text-foreground text-sm">마이페이지</p>
      </header>

      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        {/* Profile Info */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gold" />
            <h2 className="font-bold text-foreground text-sm">프로필 정보</h2>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">이름 (변경 불가)</Label>
            <Input value={studentName} disabled className="h-9 bg-muted/50" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">닉네임</Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
              className="h-9"
            />
          </div>

          <Button
            onClick={handleSaveNickname}
            disabled={saving}
            className="w-full gold-gradient text-accent-foreground font-bold gap-2 shadow-gold"
            size="sm"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            닉네임 저장
          </Button>
        </div>

        {/* Password Change */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-navy" />
            <h2 className="font-bold text-foreground text-sm">비밀번호 변경</h2>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">새 비밀번호</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="8자 이상 입력"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">새 비밀번호 확인</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호 재입력"
              className="h-9"
            />
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={changingPw || !newPassword}
            className="w-full bg-navy hover:bg-navy-light text-primary-foreground font-bold gap-2"
            size="sm"
          >
            {changingPw && <Loader2 className="w-4 h-4 animate-spin" />}
            비밀번호 변경
          </Button>
        </div>
      </div>
    </div>
  );
}
