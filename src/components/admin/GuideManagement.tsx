import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, HelpCircle, Plus, Trash2, Loader2, Upload, GripVertical, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GuideDoc {
  id: string;
  category: string;
  title: string;
  file_url: string;
  sort_order: number;
  is_active: boolean;
}

interface GuideFaq {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
}

export default function GuideManagement() {
  const [tab, setTab] = useState<"docs" | "faqs">("docs");
  const [docs, setDocs] = useState<GuideDoc[]>([]);
  const [faqs, setFaqs] = useState<GuideFaq[]>([]);
  const [loading, setLoading] = useState(true);

  // Doc form
  const [showDocForm, setShowDocForm] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("일반");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // FAQ form
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqCategory, setFaqCategory] = useState("일반");
  const [editingFaq, setEditingFaq] = useState<GuideFaq | null>(null);

  const fetchAll = async () => {
    const [{ data: d }, { data: f }] = await Promise.all([
      supabase.from("guide_documents").select("*").order("sort_order"),
      supabase.from("guide_faqs").select("*").order("sort_order"),
    ]);
    setDocs((d || []) as GuideDoc[]);
    setFaqs((f || []) as GuideFaq[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Document upload ──
  const handleDocUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !docTitle.trim()) {
      toast.error("제목과 파일을 모두 입력하세요");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("guide-files")
      .upload(path, file, { contentType: file.type });
    if (uploadErr) {
      toast.error("파일 업로드 실패: " + uploadErr.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("guide-files").getPublicUrl(path);
    const { error } = await supabase.from("guide_documents").insert({
      title: docTitle.trim(),
      category: docCategory.trim() || "일반",
      file_url: urlData.publicUrl,
      sort_order: docs.length,
    });
    if (error) {
      toast.error("문서 등록 실패");
    } else {
      toast.success("문서가 등록되었습니다");
      setDocTitle("");
      setDocCategory("일반");
      setShowDocForm(false);
      if (fileRef.current) fileRef.current.value = "";
      fetchAll();
    }
    setUploading(false);
  };

  const handleDeleteDoc = async (doc: GuideDoc) => {
    if (!confirm(`"${doc.title}" 문서를 삭제하시겠습니까?`)) return;
    // Delete from storage
    const urlPath = doc.file_url.split("/guide-files/")[1];
    if (urlPath) await supabase.storage.from("guide-files").remove([urlPath]);
    await supabase.from("guide_documents").delete().eq("id", doc.id);
    toast.success("삭제되었습니다");
    fetchAll();
  };

  // ── FAQ CRUD ──
  const handleSaveFaq = async () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      toast.error("질문과 답변을 모두 입력하세요");
      return;
    }
    if (editingFaq) {
      const { error } = await supabase.from("guide_faqs").update({
        question: faqQuestion.trim(),
        answer: faqAnswer.trim(),
        category: faqCategory.trim() || "일반",
      }).eq("id", editingFaq.id);
      if (error) toast.error("수정 실패");
      else toast.success("수정되었습니다");
    } else {
      const { error } = await supabase.from("guide_faqs").insert({
        question: faqQuestion.trim(),
        answer: faqAnswer.trim(),
        category: faqCategory.trim() || "일반",
        sort_order: faqs.length,
      });
      if (error) toast.error("등록 실패");
      else toast.success("FAQ가 등록되었습니다");
    }
    setFaqQuestion("");
    setFaqAnswer("");
    setFaqCategory("일반");
    setEditingFaq(null);
    setShowFaqForm(false);
    fetchAll();
  };

  const handleDeleteFaq = async (faq: GuideFaq) => {
    if (!confirm(`"${faq.question}" FAQ를 삭제하시겠습니까?`)) return;
    await supabase.from("guide_faqs").delete().eq("id", faq.id);
    toast.success("삭제되었습니다");
    fetchAll();
  };

  const openEditFaq = (faq: GuideFaq) => {
    setEditingFaq(faq);
    setFaqQuestion(faq.question);
    setFaqAnswer(faq.answer);
    setFaqCategory(faq.category);
    setShowFaqForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">이용가이드 관리</h1>
        <p className="text-sm text-muted-foreground">강사용 이용가이드 문서와 FAQ를 관리합니다.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("docs")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            tab === "docs" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          <FileText className="w-3.5 h-3.5 inline mr-1.5" />
          가이드 문서 ({docs.length})
        </button>
        <button
          onClick={() => setTab("faqs")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            tab === "faqs" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          <HelpCircle className="w-3.5 h-3.5 inline mr-1.5" />
          자주 묻는 질문 ({faqs.length})
        </button>
      </div>

      {/* ── Documents Tab ── */}
      {tab === "docs" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowDocForm(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> 문서 추가
            </Button>
          </div>

          <Dialog open={showDocForm} onOpenChange={setShowDocForm}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>가이드 문서 추가</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">카테고리</label>
                  <Input value={docCategory} onChange={(e) => setDocCategory(e.target.value)} placeholder="일반" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">제목</label>
                  <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="가이드 문서 제목" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">PDF 파일</label>
                  <input ref={fileRef} type="file" accept=".pdf" className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer" />
                </div>
                <Button onClick={handleDocUpload} disabled={uploading} className="w-full">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                  업로드
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {docs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">등록된 문서가 없습니다.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.category}</p>
                  </div>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex-shrink-0">
                    미리보기
                  </a>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteDoc(doc)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FAQ Tab ── */}
      {tab === "faqs" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditingFaq(null); setFaqQuestion(""); setFaqAnswer(""); setFaqCategory("일반"); setShowFaqForm(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" /> FAQ 추가
            </Button>
          </div>

          <Dialog open={showFaqForm} onOpenChange={(open) => { setShowFaqForm(open); if (!open) setEditingFaq(null); }}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingFaq ? "FAQ 수정" : "FAQ 추가"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">카테고리</label>
                  <Input value={faqCategory} onChange={(e) => setFaqCategory(e.target.value)} placeholder="일반" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">질문</label>
                  <Input value={faqQuestion} onChange={(e) => setFaqQuestion(e.target.value)} placeholder="자주 묻는 질문" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">답변</label>
                  <Textarea value={faqAnswer} onChange={(e) => setFaqAnswer(e.target.value)} placeholder="답변 내용" rows={4} />
                </div>
                <Button onClick={handleSaveFaq} className="w-full">
                  {editingFaq ? "수정" : "등록"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {faqs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <HelpCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">등록된 FAQ가 없습니다.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {faqs.map((faq) => (
                <div key={faq.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{faq.question}</p>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-2">{faq.answer}</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">{faq.category}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditFaq(faq)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteFaq(faq)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
