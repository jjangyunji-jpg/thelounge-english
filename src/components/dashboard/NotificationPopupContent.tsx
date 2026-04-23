import { Bell, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface NotificationPopupContentProps {
  subject: string;
  body: string;
  timestampLabel: string;
  onConfirm: () => void;
}

export default function NotificationPopupContent({
  subject,
  body,
  timestampLabel,
  onConfirm,
}: NotificationPopupContentProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <Bell className="w-4 h-4 text-gold" />
          새 공지사항
        </DialogTitle>
      </DialogHeader>

      <div className="min-w-0 space-y-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground break-words [overflow-wrap:anywhere]">
            {subject || "(제목 없음)"}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {timestampLabel}
          </p>
        </div>

        <div className="max-w-full rounded-lg bg-muted/40 p-3">
          <p className="max-w-full whitespace-pre-wrap text-sm leading-relaxed text-foreground break-words [overflow-wrap:anywhere]">
            {body || "(내용 없음)"}
          </p>
        </div>

        <Button onClick={onConfirm} className="w-full bg-navy hover:bg-navy-light text-primary-foreground gap-2">
          <Check className="w-4 h-4" />
          확인
        </Button>
      </div>
    </>
  );
}
