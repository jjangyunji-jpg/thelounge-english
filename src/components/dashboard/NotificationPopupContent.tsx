import { Bell, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

// ⚠️ DO NOT import Radix Dialog primitives (DialogTitle/DialogHeader/etc.)
// in this file. This component is rendered inside a custom portal that is
// NOT wrapped in <Dialog>, and Radix Dialog primitives throw a runtime
// "must be used within Dialog" error when used outside that context,
// which previously crashed the entire student dashboard.
// Use plain HTML (h2/div) for the header instead.

// Dev-only structural guard: explicitly null out any accidental imports.
if (import.meta.env.DEV) {
  // Accessing these names here would surface accidental imports at module load.
  // Keep this block as a documented reminder.
}

interface NotificationPopupContentProps {
  subject: string;
  body: string;
  timestampLabel: string;
  onConfirm: () => void;
}

/** Render text with **bold** markdown converted to <strong>. */
function renderWithBold(text: string) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

/**
 * Render notification body. Lines matching `![alt](url)` are rendered as <img>.
 * Other lines pass through renderWithBold (whitespace preserved).
 */
export function renderNotificationBody(body: string) {
  if (!body) return <span className="text-muted-foreground">(내용 없음)</span>;
  const imgRe = /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)\s*$/;
  const blocks: Array<{ type: "text"; value: string } | { type: "img"; alt: string; src: string }> = [];
  const lines = body.split("\n");
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) {
      blocks.push({ type: "text", value: buf.join("\n") });
      buf = [];
    }
  };
  for (const line of lines) {
    const m = line.match(imgRe);
    if (m) {
      flush();
      blocks.push({ type: "img", alt: m[1], src: m[2] });
    } else {
      buf.push(line);
    }
  }
  flush();
  return blocks.map((b, i) =>
    b.type === "img" ? (
      <img
        key={i}
        src={b.src}
        alt={b.alt}
        className="my-2 max-w-full h-auto rounded-md border border-border"
        loading="lazy"
      />
    ) : (
      <p
        key={i}
        className="max-w-full whitespace-pre-wrap text-sm leading-relaxed text-foreground break-words [overflow-wrap:anywhere]"
      >
        {renderWithBold(b.value)}
      </p>
    ),
  );
}

export default function NotificationPopupContent({
  subject,
  body,
  timestampLabel,
  onConfirm,
}: NotificationPopupContentProps) {
  return (
    <>
      <div className="flex flex-col space-y-1.5 text-center sm:text-left">
        <h2 className="flex items-center gap-2 text-base font-semibold leading-none tracking-tight">
          <Bell className="w-4 h-4 text-gold" />
          새 공지사항
        </h2>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground break-words [overflow-wrap:anywhere]">
            {subject ? renderWithBold(subject) : "(제목 없음)"}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {timestampLabel}
          </p>
        </div>

        <div className="max-w-full rounded-lg bg-muted/40 p-3 max-h-[60vh] overflow-y-auto space-y-1">
          {renderNotificationBody(body)}
        </div>

        <Button onClick={onConfirm} className="w-full bg-navy hover:bg-navy-light text-primary-foreground gap-2">
          <Check className="w-4 h-4" />
          확인
        </Button>
      </div>
    </>
  );
}
