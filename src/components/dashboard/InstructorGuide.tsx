import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, ChevronDown, ChevronRight, Loader2, ExternalLink, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface GuideDocument {
  id: string;
  category: string;
  title: string;
  file_url: string;
  sort_order: number;
}

interface GuideFaq {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
}

export default function InstructorGuide() {
  const [documents, setDocuments] = useState<GuideDocument[]>([]);
  const [faqs, setFaqs] = useState<GuideFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<GuideDocument | null>(null);
  const [activeDocCategory, setActiveDocCategory] = useState<string | null>(null);
  const [activeFaqCategory, setActiveFaqCategory] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: docs }, { data: faqData }] = await Promise.all([
        supabase
          .from("guide_documents")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("guide_faqs")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);
      const docsList = (docs || []) as GuideDocument[];
      const faqsList = (faqData || []) as GuideFaq[];
      setDocuments(docsList);
      setFaqs(faqsList);

      // Set default active categories
      if (docsList.length > 0) {
        const firstCat = docsList[0].category;
        setActiveDocCategory(firstCat);
        setSelectedDoc(docsList[0]);
      }
      if (faqsList.length > 0) {
        setActiveFaqCategory(faqsList[0].category);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group documents by category
  const docCategories = Array.from(new Set(documents.map((d) => d.category)));
  const faqCategories = Array.from(new Set(faqs.map((f) => f.category)));

  const filteredDocs = activeDocCategory
    ? documents.filter((d) => d.category === activeDocCategory)
    : documents;

  const filteredFaqs = activeFaqCategory
    ? faqs.filter((f) => f.category === activeFaqCategory)
    : faqs;

  return (
    <div className="space-y-8">
      {/* ── PDF 가이드 섹션 ─────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-navy" />
          <h2 className="text-base font-bold text-foreground">이용 가이드</h2>
        </div>

        {documents.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">등록된 가이드 문서가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Category tabs */}
            {docCategories.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {docCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveDocCategory(cat);
                      const first = documents.find((d) => d.category === cat);
                      if (first) setSelectedDoc(first);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                      activeDocCategory === cat
                        ? "bg-navy text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Document list */}
              <div className="lg:col-span-1 space-y-1">
                {filteredDocs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors",
                      selectedDoc?.id === doc.id
                        ? "bg-navy/10 text-navy font-medium border border-navy/20"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{doc.title}</span>
                  </button>
                ))}
              </div>

              {/* PDF Preview */}
              <div className="lg:col-span-3">
                {selectedDoc ? (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
                      <span className="text-sm font-medium text-foreground truncate">
                        {selectedDoc.title}
                      </span>
                      <a
                        href={selectedDoc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-navy hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        새 탭에서 열기
                      </a>
                    </div>
                    <iframe
                      src={selectedDoc.file_url}
                      className="w-full h-[600px] border-0"
                      title={selectedDoc.title}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-12 text-center">
                    <p className="text-sm text-muted-foreground">문서를 선택하세요</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── FAQ 섹션 ─────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-4 h-4 text-gold-dark" />
          <h2 className="text-base font-bold text-foreground">자주 묻는 질문 (FAQ)</h2>
        </div>

        {faqs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <HelpCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">등록된 FAQ가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Category tabs */}
            {faqCategories.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {faqCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveFaqCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                      activeFaqCategory === cat
                        ? "bg-gold-dark text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Accordion type="single" collapsible className="w-full">
                {filteredFaqs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id} className="border-b border-border last:border-0">
                    <AccordionTrigger className="px-4 py-3 text-sm font-medium text-foreground hover:no-underline hover:bg-muted/30">
                      <span className="text-left">{faq.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
