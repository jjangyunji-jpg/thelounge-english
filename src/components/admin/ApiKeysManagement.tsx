import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Copy, KeyRound, Trash2 } from "lucide-react";

interface ApiKeyRow {
  id: string;
  student_name: string;
  label: string;
  key_prefix: string;
  active: boolean;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

interface StudentRow {
  student_name: string;
}

export default function ApiKeysManagement() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [label, setLabel] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: keyRows }, { data: studentRows }] = await Promise.all([
      supabase
        .from("api_keys")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("instructor_students")
        .select("student_name")
        .order("student_name"),
    ]);
    setKeys((keyRows as ApiKeyRow[]) || []);
    const unique = Array.from(
      new Set((studentRows || []).map((s: any) => s.student_name).filter(Boolean))
    ).map((n) => ({ student_name: n }));
    setStudents(unique);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const issue = async () => {
    if (!studentName.trim()) {
      toast({ title: "학생 이름을 선택하세요.", variant: "destructive" });
      return;
    }
    setIssuing(true);
    setNewKey(null);
    const { data, error } = await supabase.functions.invoke("issue-api-key", {
      body: { student_name: studentName.trim(), label: label.trim() },
    });
    setIssuing(false);
    if (error || !data?.api_key) {
      toast({
        title: "발급 실패",
        description: error?.message || data?.error || "알 수 없는 오류",
        variant: "destructive",
      });
      return;
    }
    setNewKey(data.api_key);
    setLabel("");
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("이 API 키를 폐기하시겠어요? 외부 앱에서 즉시 접근이 차단됩니다.")) return;
    const { error } = await supabase
      .from("api_keys")
      .update({ active: false, revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "폐기 실패", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "폐기됨" });
    load();
  };

  const copyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    toast({ title: "키가 클립보드에 복사되었습니다." });
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const apiBaseUrl = `https://${projectId}.supabase.co/functions/v1/public-api`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif text-foreground mb-1">외부 API 키</h1>
        <p className="text-xs text-muted-foreground">
          학생별로 발급되는 API 키로 외부 앱에서 본인 데이터만 읽을 수 있어요.
        </p>
      </div>

      {/* Endpoint 안내 */}
      <Card className="p-4 bg-muted/30">
        <div className="text-xs font-semibold mb-2 text-foreground">Endpoint</div>
        <code className="text-[11px] block break-all text-muted-foreground">
          GET {apiBaseUrl}/me<br />
          GET {apiBaseUrl}/sessions
        </code>
        <div className="text-[11px] mt-2 text-muted-foreground">
          헤더에 <code className="px-1 bg-background rounded">x-api-key: tle_...</code> 추가
        </div>
      </Card>

      {/* 발급 폼 */}
      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-gold" /> 새 키 발급
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">학생</Label>
            <select
              className="w-full h-9 mt-1 px-2 text-xs border border-border rounded bg-background text-foreground"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            >
              <option value="">선택하세요</option>
              {students.map((s) => (
                <option key={s.student_name} value={s.student_name}>
                  {s.student_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">라벨 (선택)</Label>
            <Input
              className="mt-1 h-9 text-xs"
              placeholder="예: 모바일 앱"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>
        <Button onClick={issue} disabled={issuing} size="sm" className="bg-gold text-background hover:bg-gold/90">
          {issuing && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}발급
        </Button>

        {newKey && (
          <div className="mt-3 p-3 border border-gold/40 rounded bg-gold/10 space-y-2">
            <div className="text-xs font-semibold text-gold">
              ⚠️ 이 키는 다시 표시되지 않습니다. 지금 복사하세요.
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] break-all p-2 bg-background rounded">
                {newKey}
              </code>
              <Button onClick={copyKey} size="sm" variant="outline">
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 키 목록 */}
      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">발급된 키 ({keys.length})</div>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">
            발급된 키가 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between gap-2 p-2 border border-border rounded text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {k.student_name}
                    {k.label && <span className="text-muted-foreground"> · {k.label}</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    <code>{k.key_prefix}…</code> · 발급 {new Date(k.created_at).toLocaleDateString("ko-KR")}
                    {k.last_used_at && ` · 최근 사용 ${new Date(k.last_used_at).toLocaleDateString("ko-KR")}`}
                  </div>
                </div>
                {k.active && !k.revoked_at ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revoke(k.id)}
                    className="text-destructive h-7"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded">
                    폐기됨
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
