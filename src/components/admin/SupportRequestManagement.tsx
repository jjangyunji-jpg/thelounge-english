import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bug, Lightbulb, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type SupportRequest = {
  id: string;
  user_name: string;
  role: string;
  category: string;
  title: string;
  description: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: "접수", color: "bg-gold/10 text-gold-dark border-gold/25", icon: Clock },
  in_progress: { label: "처리중", color: "bg-navy/10 text-navy border-navy/20", icon: AlertCircle },
  resolved: { label: "완료", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
};

const categoryIcon = { bug: Bug, improvement: Lightbulb } as const;
const categoryLabel = { bug: "버그", improvement: "개선" } as const;

export default function SupportRequestManagement() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    const { data } = await supabase
      .from("support_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRequests((data || []) as SupportRequest[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const updates: Record<string, unknown> = {};
    if (adminNote.trim()) updates.admin_note = adminNote.trim();
    if (newStatus && newStatus !== selected.status) {
      updates.status = newStatus;
      if (newStatus === "resolved") updates.resolved_at = new Date().toISOString();
    }
    if (Object.keys(updates).length === 0) { setSaving(false); return; }

    const { error } = await supabase
      .from("support_requests")
      .update(updates)
      .eq("id", selected.id);
    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "저장 완료" });
      setSelected(null);
      load();
    }
    setSaving(false);
  };

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const openCount = requests.filter((r) => r.status === "open").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">버그 신고 / 개선 제안</h1>
          <p className="text-sm text-muted-foreground mt-1">
            사용자가 제출한 버그 신고 및 개선 제안을 관리합니다
            {openCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{openCount}건 미처리</Badge>
            )}
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="open">접수</SelectItem>
            <SelectItem value="in_progress">처리중</SelectItem>
            <SelectItem value="resolved">완료</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="shadow-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            제출된 내용이 없습니다
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">유형</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead className="w-24">작성자</TableHead>
                  <TableHead className="w-20">역할</TableHead>
                  <TableHead className="w-24">상태</TableHead>
                  <TableHead className="w-28">접수일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((req) => {
                  const cat = req.category as keyof typeof categoryIcon;
                  const CatIcon = categoryIcon[cat] || Bug;
                  const catLbl = categoryLabel[cat] || req.category;
                  const st = statusConfig[req.status] || statusConfig.open;
                  return (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelected(req);
                        setAdminNote(req.admin_note || "");
                        setNewStatus(req.status);
                      }}
                    >
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CatIcon className="w-3.5 h-3.5" />
                          {catLbl}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{req.title}</TableCell>
                      <TableCell className="text-sm">{req.user_name}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {req.role === "instructor" ? "강사" : req.role === "student" ? "학생" : req.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px]", st.color)}>
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(req.created_at), "MM/dd HH:mm", { locale: ko })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              {selected && (() => {
                const cat = selected.category as keyof typeof categoryIcon;
                const CatIcon = categoryIcon[cat] || Bug;
                return <CatIcon className="w-4 h-4 text-muted-foreground" />;
              })()}
              {selected?.title}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{selected.user_name}</span>
                <span>·</span>
                <span>{selected.role === "instructor" ? "강사" : selected.role === "student" ? "학생" : selected.role}</span>
                <span>·</span>
                <span>{format(new Date(selected.created_at), "yyyy.MM.dd HH:mm", { locale: ko })}</span>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {selected.description}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">상태 변경</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">접수</SelectItem>
                    <SelectItem value="in_progress">처리중</SelectItem>
                    <SelectItem value="resolved">완료</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">관리자 메모</label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="처리 내용이나 메모를 남겨주세요"
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                저장
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
