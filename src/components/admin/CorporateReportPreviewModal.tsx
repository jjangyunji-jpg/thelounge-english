import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Loader2, Download, Sparkles } from "lucide-react";
import type { ReportPreviewData } from "@/lib/exportCorporateReportPdf";

interface Props {
  data: ReportPreviewData;
  onClose: () => void;
  onDownload: (data: ReportPreviewData) => void;
}

export default function CorporateReportPreviewModal({ data, onClose, onDownload }: Props) {
  const [summaries, setSummaries] = useState<string[]>(data.summaries);
  const [remarks, setRemarks] = useState(data.remarks);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      onDownload({ ...data, summaries, remarks });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] bg-card rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            <span className="text-sm font-bold text-foreground">수업 보고서 미리보기</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Student info summary */}
          <div className="text-xs space-y-1 text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/50">
            <p><span className="font-semibold text-foreground">학생명:</span> {data.info.groupStudents?.length > 0 ? data.info.groupStudents.join(", ") : data.info.studentName}</p>
            <p><span className="font-semibold text-foreground">수업 기간:</span> {data.period.label} ({data.period.start_date} ~ {data.period.end_date})</p>
            <p><span className="font-semibold text-foreground">총 수업:</span> {data.sessions.length}회</p>
          </div>

          {/* Summaries */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              수업 내용 요약
              <span className="text-[10px] font-normal text-muted-foreground">(AI 생성 — 수정 가능)</span>
            </h3>
            {data.sessions.map((s, idx) => {
              const d = new Date(s.scheduled_at);
              const dateLabel = d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" });
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-muted-foreground w-6 text-center">{idx + 1}</span>
                    <span className="text-[10px] text-muted-foreground">{dateLabel}</span>
                    {s.topic && <span className="text-[10px] font-medium text-foreground">· {s.topic}</span>}
                  </div>
                  <Textarea
                    value={summaries[idx] || ""}
                    onChange={e => {
                      const next = [...summaries];
                      next[idx] = e.target.value;
                      setSummaries(next);
                    }}
                    className="text-xs min-h-[52px] resize-none ml-6"
                    placeholder="수업 내용 요약을 입력하세요..."
                  />
                </div>
              );
            })}
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              Notes from The Lounge English
              <span className="text-[10px] font-normal text-muted-foreground">(AI 생성 — 수정 가능)</span>
            </h3>
            <Textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="text-xs min-h-[120px] resize-none"
              placeholder="비고 내용을 입력하세요..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            취소
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            className="h-8 text-xs gap-1.5 bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF 다운로드
          </Button>
        </div>
      </div>
    </div>
  );
}
