import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import { Callout } from "./CalloutExtension";
import { useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Bold, Heading1, Heading2, Heading3, Minus, Table2, Loader2, MessageSquareQuote,
} from "lucide-react";

interface NotesEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoCorrectEnabled: boolean;
  onAutoCorrectToggle: () => void;
  isAutoCorrecting: boolean;
  className?: string;
}

export default function NotesEditor({
  content,
  onChange,
  editable,
  disabled = false,
  placeholder = "수업 내용을 자유롭게 타이핑하세요...",
  autoCorrectEnabled,
  onAutoCorrectToggle,
  isAutoCorrecting,
  className,
}: NotesEditorProps) {
  const isUpdatingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        horizontalRule: {},
        bold: {},
        italic: {},
        bulletList: {},
        orderedList: {},
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Callout,
      Placeholder.configure({ placeholder }),
    ],
    content: content || "",
    editable: editable && !disabled,
    onUpdate: ({ editor }) => {
      if (isUpdatingRef.current) return;
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[380px] px-4 py-4 text-sm leading-relaxed",
      },
    },
  });

  // Sync editable state
  useEffect(() => {
    if (editor) editor.setEditable(editable && !disabled);
  }, [editor, editable, disabled]);

  // Sync external content changes (e.g. from auto-correct)
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    if (content !== currentHtml) {
      isUpdatingRef.current = true;
      const { from, to } = editor.state.selection;
      editor.commands.setContent(content || "");
      try {
        const maxPos = editor.state.doc.content.size;
        editor.commands.setTextSelection({
          from: Math.min(from, maxPos),
          to: Math.min(to, maxPos),
        });
      } catch { /* ignore */ }
      isUpdatingRef.current = false;
    }
  }, [content, editor]);

  const applyFormat = useCallback((type: string) => {
    if (!editor) return;
    switch (type) {
      case "bold": editor.chain().focus().toggleBold().run(); break;
      case "h1": editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
      case "h2": editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
      case "h3": editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
      case "hr": editor.chain().focus().setHorizontalRule().run(); break;
      case "table":
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case "callout":
        (editor.chain().focus() as any).toggleCallout({ type: "info" }).run();
        break;
    }
  }, [editor]);

  const toolbarItems = [
    { type: "bold", icon: Bold, label: "굵게 (Ctrl+B)", isActive: editor?.isActive("bold") },
    { type: "h1", icon: Heading1, label: "제목 1", isActive: editor?.isActive("heading", { level: 1 }) },
    { type: "h2", icon: Heading2, label: "제목 2", isActive: editor?.isActive("heading", { level: 2 }) },
    { type: "h3", icon: Heading3, label: "제목 3", isActive: editor?.isActive("heading", { level: 3 }) },
    { type: "hr", icon: Minus, label: "구분선" },
    { type: "table", icon: Table2, label: "표 삽입" },
    { type: "callout", icon: MessageSquareQuote, label: "콜아웃", isActive: editor?.isActive("callout") },
  ];

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Toolbar */}
      {editable && !disabled && (
        <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border bg-muted/20 flex-wrap">
          {toolbarItems.map(({ type, icon: Icon, label, isActive }) => (
            <button
              key={type}
              title={label}
              onMouseDown={(e) => { e.preventDefault(); applyFormat(type); }}
              className={cn(
                "p-1.5 rounded hover:bg-muted transition-colors",
                isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground/50 hidden sm:inline">Ctrl+B 굵게</span>
          <button
            onClick={onAutoCorrectToggle}
            className={cn("ml-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all border",
              autoCorrectEnabled
                ? "border-success/40 bg-success/10 text-success"
                : "border-muted-foreground/20 text-muted-foreground hover:bg-muted"
            )}
          >
            {isAutoCorrecting && <Loader2 className="w-3 h-3 animate-spin" />}
            {autoCorrectEnabled ? "자동교정 ON" : "자동교정 OFF"}
          </button>
        </div>
      )}

      {/* Editor */}
      <div className={cn(
        "h-[420px] overflow-y-auto",
        !editable && "cursor-default opacity-70"
      )}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
