import { useState } from "react";
import { BookOpen, Loader2, Eye, EyeOff, GraduationCap, Users, UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type Role = "student" | "instructor";
type StudentType = null | "existing" | "new";

export default function Signup() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [role, setRole] = useState<Role>("student");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Student sub-type
  const [studentType, setStudentType] = useState<StudentType>(null);

  // Waitlist fields (new student only)
  const [phone, setPhone] = useState("");
  const [desiredLevel, setDesiredLevel] = useState("");
  const [preferredSchedule, setPreferredSchedule] = useState<string[]>([]);
  const [referralSource, setReferralSource] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const isNewStudent = role === "student" && studentType === "new";
  const isExistingStudent = role === "student" && studentType === "existing";

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "비밀번호는 8자 이상이어야 합니다.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "비밀번호가 일치하지 않습니다.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, string> = {
        email: email.trim(),
        password,
        name: name.trim(),
        role,
      };
      // Only send waitlist info for new students
      if (isNewStudent) {
        body.studentType = "new";
        body.phone = phone.trim();
        body.desiredLevel = desiredLevel;
        body.preferredSchedule = preferredSchedule.join(", ");
        body.referralSource = referralSource.join(", ");
        body.note = note.trim();
      } else if (isExistingStudent) {
        body.studentType = "existing";
      }

      const { data, error } = await supabase.functions.invoke("register", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setDone(true);
    } catch (e: unknown) {
      toast({
        title: "회원가입 실패",
        description: e instanceof Error ? e.message : "다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const doneMessage = () => {
    if (role === "instructor") {
      return {
        title: "가입 신청 완료!",
        desc: (
          <>관리자 승인 후 로그인할 수 있습니다.<br />승인이 완료되면 로그인해주세요.</>
        ),
      };
    }
    if (isExistingStudent) {
      return {
        title: "가입 완료!",
        desc: (
          <>관리자 승인 후 로그인할 수 있습니다.<br />승인이 완료되면 로그인해주세요.</>
        ),
      };
    }
    return {
      title: "대기자 등록 완료!",
      desc: (
        <>대기자 등록이 완료되었습니다.<br />로그인 후 대기 현황을 확인할 수 있습니다.</>
      ),
    };
  };

  const submitLabel = () => {
    if (role === "instructor") return "회원가입";
    if (isExistingStudent) return "회원가입";
    return "대기자 등록";
  };

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
            <p className="text-sm text-muted-foreground mt-0.5">회원가입</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[hsl(var(--success)/0.1)] flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-[hsl(var(--success))]" />
              </div>
              <p className="font-bold text-foreground">{doneMessage().title}</p>
              <p className="text-sm text-muted-foreground">{doneMessage().desc}</p>
              <Button
                onClick={() => navigate("/login")}
                className="w-full mt-2 gold-gradient text-accent-foreground font-bold shadow-gold"
              >
                로그인 페이지로
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              {/* Role selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">역할 선택</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setRole("student"); setStudentType(null); }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
                      role === "student"
                        ? "border-gold bg-gold/10 text-gold-dark shadow-sm"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <GraduationCap className="w-4 h-4" />
                    학생
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRole("instructor"); setStudentType(null); }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
                      role === "instructor"
                        ? "border-navy bg-navy/10 text-navy shadow-sm"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <Users className="w-4 h-4" />
                    강사
                  </button>
                </div>
              </div>

              {/* Student type selector */}
              {role === "student" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">가입 유형</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStudentType("existing")}
                      className={cn(
                        "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-sm transition-all",
                        studentType === "existing"
                          ? "border-gold bg-gold/10 text-gold-dark shadow-sm font-medium"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <UserCheck className="w-4 h-4" />
                      <span className="text-xs font-medium">수강생 등록 (상담완료)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentType("new")}
                      className={cn(
                        "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-sm transition-all",
                        studentType === "new"
                          ? "border-gold bg-gold/10 text-gold-dark shadow-sm font-medium"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span className="text-xs font-medium">대기자 등록</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Show remaining fields only when student type is selected (or instructor) */}
              {(role === "instructor" || studentType !== null) && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">이름</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="이름을 입력하세요"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">이메일</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="이메일 주소 입력"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">비밀번호 설정</Label>
                    <div className="relative">
                      <Input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="8자 이상 입력"
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
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">비밀번호 확인</Label>
                    <div className="relative">
                      <Input
                        type={showConfirmPw ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="비밀번호 다시 입력"
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New student waitlist fields */}
                  {isNewStudent && (
                    <>
                      <div className="border-t border-border pt-4 mt-4">
                        <p className="text-xs font-semibold text-foreground mb-3">📋 수업 희망 정보</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">연락처</Label>
                        <Input
                          value={phone}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 11);
                            if (v.length <= 3) setPhone(v);
                            else if (v.length <= 7) setPhone(`${v.slice(0, 3)}-${v.slice(3)}`);
                            else setPhone(`${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7)}`);
                          }}
                          placeholder="010-0000-0000"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">희망 레벨</Label>
                        <Select value={desiredLevel} onValueChange={setDesiredLevel}>
                          <SelectTrigger>
                            <SelectValue placeholder="레벨을 선택하세요" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="beginner">초급 (Beginner)</SelectItem>
                            <SelectItem value="elementary">초중급 (Elementary)</SelectItem>
                            <SelectItem value="intermediate">중급 (Intermediate)</SelectItem>
                            <SelectItem value="upper-intermediate">중상급 (Upper-Intermediate)</SelectItem>
                            <SelectItem value="advanced">고급 (Advanced)</SelectItem>
                            <SelectItem value="unsure">잘 모르겠어요</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">희망 수업 시간대 (복수 선택 가능)</Label>
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { value: "평일 오전 10시~2시", label: "평일 오전 10시~2시" },
                            { value: "평일 오후 6시~10시", label: "평일 오후 6시~10시" },
                            { value: "주말 오전 10시~2시", label: "주말 오전 10시~2시" },
                            { value: "주말 오후 6시~10시", label: "주말 오후 6시~10시" },
                          ].map((opt) => (
                            <label
                              key={opt.value}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm cursor-pointer transition-all",
                                preferredSchedule.includes(opt.value)
                                  ? "border-gold bg-gold/10 text-foreground font-medium"
                                  : "border-border text-muted-foreground hover:bg-muted/50"
                              )}
                            >
                              <Checkbox
                                checked={preferredSchedule.includes(opt.value)}
                                onCheckedChange={(checked) => {
                                  setPreferredSchedule((prev) =>
                                    checked
                                      ? [...prev, opt.value]
                                      : prev.filter((v) => v !== opt.value)
                                  );
                                }}
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">가입 경로 (복수 선택 가능)</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            "지인 추천",
                            "인스타그램",
                            "블로그/카페",
                            "검색(네이버/구글)",
                            "유튜브",
                            "기타",
                          ].map((src) => (
                            <label
                              key={src}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm cursor-pointer transition-all",
                                referralSource.includes(src)
                                  ? "border-gold bg-gold/10 text-foreground font-medium"
                                  : "border-border text-muted-foreground hover:bg-muted/50"
                              )}
                            >
                              <Checkbox
                                checked={referralSource.includes(src)}
                                onCheckedChange={(checked) => {
                                  setReferralSource((prev) =>
                                    checked
                                      ? [...prev, src]
                                      : prev.filter((v) => v !== src)
                                  );
                                }}
                              />
                              {src}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">기타 메모</Label>
                        <Textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="추가로 전달하고 싶은 내용이 있으면 적어주세요"
                          rows={2}
                        />
                      </div>
                    </>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full gold-gradient text-accent-foreground font-bold gap-2 shadow-gold"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitLabel()}
                  </Button>
                </>
              )}
            </form>
          )}

          {!done && (
            <p className="text-center text-xs text-muted-foreground">
              이미 계정이 있으신가요?{" "}
              <Link to="/login" className="text-gold-dark font-medium hover:underline">
                로그인
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
