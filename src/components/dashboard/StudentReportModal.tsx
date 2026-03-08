import { FileText, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  periodLabel: string;
  content: string;
  onClose: () => void;
  onMarkRead: () => void;
}

export default function StudentReportModal({ periodLabel, content, onClose, onMarkRead }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy to-navy-light p-5 relative">
          <button onClick={onClose} className="absolute top-3 right-3 text-primary-foreground/50 hover:text-primary-foreground">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-gold" />
            <span className="text-[10px] font-bold text-gold uppercase tracking-widest">Monthly Report</span>
          </div>
          <p className="text-primary-foreground font-bold text-lg">{periodLabel} 학습 리포트</p>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            닫기
          </Button>
          <Button
            onClick={() => { onMarkRead(); onClose(); }}
            className="flex-1 bg-navy hover:bg-navy-light text-primary-foreground gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            확인 완료
          </Button>
        </div>
      </div>
    </div>
  );
}
