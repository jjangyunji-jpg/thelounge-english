import { useState, useEffect } from "react";
import { Check, X, Loader2, UserCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PendingUser {
  id: string;
  user_id: string;
  role: string;
  display_name: string | null;
  approved: boolean;
}

export default function UserApproval() {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [approved, setApproved] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_roles")
      .select("id, user_id, role, display_name, approved")
      .in("role", ["student", "instructor"])
      .order("id", { ascending: false });

    const all = (data || []) as PendingUser[];
    setPending(all.filter(u => !u.approved));
    setApproved(all.filter(u => u.approved));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (user: PendingUser) => {
    setActing(user.id);
    const { error } = await supabase
      .from("user_roles")
      .update({ approved: true })
      .eq("id", user.id);

    if (error) {
      toast({ title: "승인 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${user.display_name || "사용자"} 승인 완료 ✓` });
      load();
    }
    setActing(null);
  };

  const handleReject = async (user: PendingUser) => {
    setActing(user.id);
    // Delete role record + auth user via edge function
    const { error } = await supabase.functions.invoke("delete-user", {
      body: { userId: user.user_id },
    });
    if (error) {
      toast({ title: "거절 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${user.display_name || "사용자"} 거절 완료` });
      load();
    }
    setActing(null);
  };

  const roleLabel = (r: string) => r === "student" ? "학생" : r === "instructor" ? "강사" : r;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">가입 승인 관리</h1>
        <p className="text-muted-foreground text-sm mt-1">회원가입 요청을 승인하거나 거절합니다</p>
      </div>

      {/* Pending */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-gold" />
            승인 대기 ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">대기 중인 요청이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {pending.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm text-foreground">{u.display_name || "이름 없음"}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {roleLabel(u.role)}
                    </Badge>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs gap-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                      onClick={() => handleReject(u)}
                      disabled={acting === u.id}
                    >
                      {acting === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      거절
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.9)] text-primary-foreground"
                      onClick={() => handleApprove(u)}
                      disabled={acting === u.id}
                    >
                      {acting === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      승인
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[hsl(var(--success))]" />
            승인 완료 ({approved.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {approved.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">승인된 사용자가 없습니다</p>
          ) : (
            <div className="space-y-1.5">
              {approved.map(u => (
                <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-sm text-foreground">{u.display_name || "이름 없음"}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {roleLabel(u.role)}
                    </Badge>
                  </div>
                  <Badge className="bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] text-[10px]">승인됨</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
