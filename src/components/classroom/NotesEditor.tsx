import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";

import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";

import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import { Callout } from "./CalloutExtension";
import { Suggestion, SuggestionDelete } from "./SuggestionExtension";


import { useEffect, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Bold, Underline as UnderlineIcon, Heading1, Heading2, Heading3, Minus, Table2, Loader2,
  MessageSquareQuote, PenLine, Sparkles, Image as ImageIcon, MessageCircle,
} from "lucide-react";
import DialogueGeneratorModal from "./DialogueGeneratorModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NotesEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoCorrectEnabled?: boolean;
  onAutoCorrectToggle?: () => void;
  isAutoCorrecting?: boolean;
  className?: string;
  onScrollRatio?: (ratio: number) => void;
  editorRef?: React.MutableRefObject<any>;
}

interface SlashMenuItem {
  label: string;
  icon: React.ReactNode;
  action: () => void;
}

export default function NotesEditor({
  content,
  onChange,
  editable,
  disabled = false,
  placeholder = "수업 내용을 자유롭게 타이핑하세요...",
  autoCorrectEnabled = false,
  onAutoCorrectToggle,
  isAutoCorrecting = false,
  className,
  onScrollRatio,
  editorRef,
}: NotesEditorProps) {
  const { toast } = useToast();
  const isUpdatingRef = useRef(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [slashFilter, setSlashFilter] = useState("");
  const slashRangeRef = useRef<{ from: number; to: number } | null>(null);
  const slashMenuOpenRef = useRef(false);
  const slashFilterRef = useRef("");
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const internalEditorRef = useRef<any>(null);
  const [aiCorrecting, setAiCorrecting] = useState(false);

  // Keep refs in sync with state so handleKeyDown (stale closure) can read latest values
  useEffect(() => { slashMenuOpenRef.current = slashMenuOpen; }, [slashMenuOpen]);
  useEffect(() => { slashFilterRef.current = slashFilter; }, [slashFilter]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        horizontalRule: {},
        bold: {},
        italic: {},
        bulletList: {},
        orderedList: {},
        blockquote: {},
      }),
      Underline,
      Table.configure({ resizable: true, allowTableNodeSelection: true }),
      TableRow,
      TableCell,
      TableHeader,
      Callout,
      Suggestion,
      SuggestionDelete,
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: "rounded-lg my-3 max-w-full h-auto",
        },
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      Youtube.configure({
        inline: false,
        width: 640,
        height: 360,
        HTMLAttributes: {
          class: "rounded-lg my-3",
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: content || "",
    editable: editable && !disabled,
    onUpdate: ({ editor: e }) => {
      if (!isUpdatingRef.current) {
        onChange(e.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[500px] px-4 py-4 text-sm leading-relaxed",
        spellcheck: "true",
        lang: "en",
      },
      transformPastedHTML(html) {
        // Notion pastes tables as nested divs or splits each row into
        // its own <table>. Merge them into a single standard HTML table.
        const doc = new DOMParser().parseFromString(html, "text/html");

        const tables = doc.querySelectorAll("table");
        if (tables.length > 1) {
          const merged = doc.createElement("table");
          const tbody = doc.createElement("tbody");
          tables.forEach((t, i) => {
            const rows = t.querySelectorAll("tr");
            rows.forEach((row, ri) => {
              const newRow = row.cloneNode(true) as HTMLTableRowElement;
              if (i === 0 && ri === 0) {
                newRow.querySelectorAll("td").forEach((td) => {
                  const th = doc.createElement("th");
                  th.innerHTML = td.innerHTML;
                  td.replaceWith(th);
                });
              }
              tbody.appendChild(newRow);
            });
            t.remove();
          });
          merged.appendChild(tbody);
          doc.body.prepend(merged);
        }

        return doc.body.innerHTML;
      },
      handlePaste: (view, event) => {
        // Handle image paste
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file && editor) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const base64 = e.target?.result as string;
                  editor.chain().focus().setImage({ src: base64 }).run();
                };
                reader.readAsDataURL(file);
              }
              return true;
            }
          }
        }
        // Handle YouTube paste
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const ytMatch = text.match(
          /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]+)/
        );
        if (ytMatch && editor) {
          event.preventDefault();
          editor.commands.setYoutubeVideo({ src: text.trim() });
          return true;
        }
        return false;
      },
      handleTextInput: (view, from, to, text) => {
        if (text === "/") {
          if (slashMenuOpenRef.current) {
            // Second "/" typed while menu is open → update filter synchronously
            const newFilter = slashFilterRef.current + "/";
            slashFilterRef.current = newFilter;
            setSlashFilter(newFilter);
            if (slashRangeRef.current) {
              slashRangeRef.current = { ...slashRangeRef.current, to: slashRangeRef.current.to + 1 };
            }
            return false;
          }
          // First "/" → open slash menu
          const coords = view.coordsAtPos(from);
          const containerRect = editorContainerRef.current?.getBoundingClientRect();
          if (containerRect) {
            const scrollTop = editorContainerRef.current?.scrollTop || 0;
            setSlashMenuPos({
              top: coords.bottom - containerRect.top + scrollTop + 4,
              left: coords.left - containerRect.left,
            });
          }
          slashRangeRef.current = { from, to: to + 1 };
          slashFilterRef.current = "";
          setSlashFilter("");
          slashMenuOpenRef.current = true;
          setSlashMenuOpen(true);
          return false;
        }
        if (slashMenuOpenRef.current) {
          if (text.length === 1 && /[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣/]/.test(text)) {
            // Update filter and extend range — sync ref immediately so handleKeyDown can read it
            const newFilter = slashFilterRef.current + text;
            slashFilterRef.current = newFilter;
            setSlashFilter(newFilter);
            if (slashRangeRef.current) {
              slashRangeRef.current = { ...slashRangeRef.current, to: slashRangeRef.current.to + 1 };
            }
          } else {
            // Non-filter character: close menu
            setSlashMenuOpen(false);
            slashRangeRef.current = null;
          }
        }
        return false;
      },
      handleKeyDown: (view, event) => {
        if (slashMenuOpenRef.current && event.key === "Escape") {
          setSlashMenuOpen(false);
          return true;
        }

        if (slashMenuOpenRef.current && event.key === "Backspace") {
          const filter = slashFilterRef.current;
          if (filter.length > 0) {
            setSlashFilter(filter.slice(0, -1));
            if (slashRangeRef.current) {
              slashRangeRef.current = { ...slashRangeRef.current, to: slashRangeRef.current.to - 1 };
            }
          } else {
            // Backspace on "/" itself: close menu
            setSlashMenuOpen(false);
            slashRangeRef.current = null;
          }
          return false;
        }

        // "//" + space → auto-insert callout with h1
        // Method 1: slash menu is open with "/" filter (normal flow)
        if (slashMenuOpenRef.current && event.key === " " && slashFilterRef.current === "/") {
          event.preventDefault();
          if (slashRangeRef.current) {
            const { from, to } = slashRangeRef.current;
            view.dispatch(view.state.tr.delete(from, to));
            setSlashMenuOpen(false);
            slashMenuOpenRef.current = false;
            slashRangeRef.current = null;
            setTimeout(() => {
              const ed = internalEditorRef.current;
              if (ed) {
                ed.chain().focus().toggleCallout({ type: "info" }).run();
                setTimeout(() => {
                  ed.chain().focus().toggleHeading({ level: 1 }).run();
                }, 20);
              }
            }, 10);
          }
          return true;
        }

        // Method 2: Fallback — detect "//" before cursor directly (handles Korean IME bypass)
        if (event.key === " " && !slashMenuOpenRef.current) {
          const pos = view.state.selection.from;
          if (pos >= 2) {
            try {
              const textBefore = view.state.doc.textBetween(pos - 2, pos, "");
              if (textBefore === "//") {
                event.preventDefault();
                view.dispatch(view.state.tr.delete(pos - 2, pos));
                setTimeout(() => {
                  const ed = internalEditorRef.current;
                  if (ed) {
                    ed.chain().focus().toggleCallout({ type: "info" }).run();
                    setTimeout(() => {
                      ed.chain().focus().toggleHeading({ level: 1 }).run();
                    }, 20);
                  }
                }, 10);
                return true;
              }
            } catch { /* ignore position errors */ }
          }
        }

        // Arrow replacements: -> → , <-> ↔
        if (event.key === ">") {
          setTimeout(() => {
            if (!editor) return;
            const pos = editor.state.selection.from;
            if (pos >= 3) {
              const t3 = editor.state.doc.textBetween(pos - 3, pos, "");
              if (t3 === "<->") {
                editor.chain().focus().deleteRange({ from: pos - 3, to: pos }).insertContent("↔").run();
                return;
              }
            }
            if (pos >= 2) {
              const t2 = editor.state.doc.textBetween(pos - 2, pos, "");
              if (t2 === "->") {
                editor.chain().focus().deleteRange({ from: pos - 2, to: pos }).insertContent("→").run();
                return;
              }
            }
          }, 0);
          return false;
        }

        // <- + space → ←
        if (event.key === " ") {
          setTimeout(() => {
            if (!editor) return;
            const pos = editor.state.selection.from;
            if (pos >= 3) {
              const t3 = editor.state.doc.textBetween(pos - 3, pos, "");
              if (t3 === "<- ") {
                editor.chain().focus().deleteRange({ from: pos - 3, to: pos }).insertContent("← ").run();
              }
            }
          }, 0);
          return false;
        }

        // -- → — (em dash)
        if (event.key === "-") {
          setTimeout(() => {
            if (!editor) return;
            const pos = editor.state.selection.from;
            if (pos >= 2) {
              const t2 = editor.state.doc.textBetween(pos - 2, pos, "");
              if (t2 === "--") {
                editor.chain().focus().deleteRange({ from: pos - 2, to: pos }).insertContent("—").run();
              }
            }
          }, 0);
          return false;
        }

        return false;
      },
    },
  });

  // Keep internal editor ref in sync
  useEffect(() => {
    if (editor) internalEditorRef.current = editor;
  }, [editor]);

  const executeSlashCommand = useCallback((action: () => void) => {
    if (!editor || !slashRangeRef.current) return;
    const { from, to } = slashRangeRef.current;
    editor.chain().focus().deleteRange({ from, to }).run();
    setSlashMenuOpen(false);
    slashRangeRef.current = null;
    // Small delay to let deletion complete
    setTimeout(() => action(), 10);
  }, [editor]);

  const slashItems: SlashMenuItem[] = [
    {
      label: "콜아웃",
      icon: <MessageSquareQuote className="w-4 h-4 text-primary" />,
      action: () => executeSlashCommand(() => {
        editor?.chain().focus().toggleCallout({ type: "info" }).run();
        // Insert h3 heading inside the callout
        setTimeout(() => {
          editor?.chain().focus().toggleHeading({ level: 3 }).run();
        }, 20);
      }),
    },
    {
      label: "제목 1",
      icon: <Heading1 className="w-4 h-4" />,
      action: () => executeSlashCommand(() => editor?.chain().focus().toggleHeading({ level: 1 }).run()),
    },
    {
      label: "제목 2",
      icon: <Heading2 className="w-4 h-4" />,
      action: () => executeSlashCommand(() => editor?.chain().focus().toggleHeading({ level: 2 }).run()),
    },
    {
      label: "제목 3",
      icon: <Heading3 className="w-4 h-4" />,
      action: () => executeSlashCommand(() => editor?.chain().focus().toggleHeading({ level: 3 }).run()),
    },
    {
      label: "구분선",
      icon: <Minus className="w-4 h-4" />,
      action: () => executeSlashCommand(() => editor?.chain().focus().setHorizontalRule().run()),
    },
    {
      label: "표",
      icon: <Table2 className="w-4 h-4" />,
      action: () => executeSlashCommand(() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()),
    },
  ];

  const filteredSlashItems = slashItems.filter((item) =>
    slashFilter === "" || item.label.toLowerCase().includes(slashFilter)
  );

  // Expose editor instance via ref
  useEffect(() => {
    if (editorRef && editor) editorRef.current = editor;
  }, [editor, editorRef]);

  // Sync editable state
  useEffect(() => {
    if (editor) editor.setEditable(editable && !disabled);
  }, [editor, editable, disabled]);

  // Sync external content changes
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
      case "underline": editor.chain().focus().toggleUnderline().run(); break;
      case "h1": editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
      case "h2": editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
      case "h3": editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
      case "hr": editor.chain().focus().setHorizontalRule().run(); break;
      case "table":
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case "callout":
        editor.chain().focus().toggleCallout({ type: "info" }).run();
        break;
      case "suggestion": {
        const isActive = editor.isActive("suggestion");
        if (isActive) {
          // Turn off suggestion mode
          editor.commands.unsetSuggestion();
        } else {
          const { from, to } = editor.state.selection;
          if (from !== to) {
            // Step 1: Apply red strikethrough to selected text
            editor.chain().focus().setSuggestionDelete().run();
            // Step 2: Move cursor to end of selection
            editor.commands.setTextSelection(to);
            // Step 3: Set storedMarks to only have suggestion (blue), NOT suggestionDelete
            const suggestionMarkType = editor.schema.marks.suggestion;
            editor.view.dispatch(
              editor.state.tr.setStoredMarks([suggestionMarkType.create()])
            );
          } else {
            // No selection → just toggle blue mode
            const suggestionMarkType = editor.schema.marks.suggestion;
            const hasSuggestionStored = editor.state.storedMarks?.some(
              (m) => m.type === suggestionMarkType
            );
            if (hasSuggestionStored) {
              editor.view.dispatch(editor.state.tr.setStoredMarks([]));
            } else {
              editor.view.dispatch(
                editor.state.tr.setStoredMarks([suggestionMarkType.create()])
              );
            }
          }
        }
        break;
      }
    }
  }, [editor]);

  const runAiCorrection = useCallback(async () => {
    if (!editor || aiCorrecting) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      toast({ title: "교정할 텍스트를 드래그로 선택하세요", variant: "destructive" });
      return;
    }
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;

    setAiCorrecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-correct", {
        body: { text: selectedText, mode: "notes_correct" },
      });
      if (error) throw error;
      const errors: { original: string; corrected: string }[] = data?.errors || [];
      if (errors.length === 0) {
        toast({ title: "교정할 내용이 없습니다 ✓" });
        return;
      }

      // Apply inline corrections using suggestion marks
      // Work backwards through selection to preserve positions
      const fullText = editor.state.doc.textBetween(from, to, "\0");
      let offset = from;
      let remaining = fullText;

      const tr = editor.state.tr;
      const deleteMarkType = editor.schema.marks.suggestionDelete;
      const suggestMarkType = editor.schema.marks.suggestion;

      // Sort errors by position (first occurrence)
      const sortedErrors = [...errors].sort((a, b) => {
        const posA = remaining.toLowerCase().indexOf(a.original.toLowerCase());
        const posB = remaining.toLowerCase().indexOf(b.original.toLowerCase());
        return posA - posB;
      });

      let drift = 0; // track inserted characters shifting positions
      let tempRemaining = fullText;
      let tempOffset = from;

      for (const err of sortedErrors) {
        const idx = tempRemaining.toLowerCase().indexOf(err.original.toLowerCase());
        if (idx === -1) continue;

        const errFrom = tempOffset + idx + drift;
        const errTo = errFrom + err.original.length;

        // Add strikethrough mark on original
        tr.addMark(errFrom, errTo, deleteMarkType.create());

        // Insert corrected text after the original with suggestion mark (skip if empty/null = deletion)
        const correctedStr = (err.corrected ?? "").toString();
        if (correctedStr.trim()) {
          const correctedText = editor.schema.text(correctedStr, [suggestMarkType.create()]);
          tr.insert(errTo, correctedText);
        }

        drift += correctedStr.length;
        tempRemaining = tempRemaining.slice(idx + err.original.length);
        tempOffset = tempOffset + idx + err.original.length;
      }

      editor.view.dispatch(tr);
      onChange(editor.getHTML());
      toast({ title: "AI 교정 완료 ✓" });
    } catch (e: any) {
      toast({ title: "AI 교정 실패", description: e.message, variant: "destructive" });
    } finally {
      setAiCorrecting(false);
    }
  }, [editor, aiCorrecting, onChange, toast]);

  const toolbarItems = [
    { type: "bold", icon: Bold, label: "굵게 (Ctrl+B)", isActive: editor?.isActive("bold") },
    { type: "underline", icon: UnderlineIcon, label: "밑줄 (Ctrl+U)", isActive: editor?.isActive("underline") },
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
        <>
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

            {/* AI Correction button */}
            <button
              title="AI 교정 (텍스트 선택 후 클릭)"
              onMouseDown={(e) => { e.preventDefault(); runAiCorrection(); }}
              disabled={aiCorrecting}
              className={cn(
                "p-1.5 rounded transition-colors",
                aiCorrecting
                  ? "text-[hsl(var(--navy))] animate-pulse"
                  : "text-muted-foreground hover:text-[hsl(var(--navy))] hover:bg-muted"
              )}
            >
              {aiCorrecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            </button>

            <span className="ml-auto text-[10px] text-muted-foreground/50 hidden sm:inline">/ 슬래시 명령</span>
            {onAutoCorrectToggle && (
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
            )}
          </div>

        </>
      )}

      {/* Editor with slash menu */}
      <div
        ref={editorContainerRef}
        className={cn(
          "h-[546px] overflow-y-auto relative",
          !editable && "cursor-default opacity-70"
        )}
        onScroll={(e) => {
          if (onScrollRatio) {
            const el = e.currentTarget;
            const maxScroll = el.scrollHeight - el.clientHeight;
            if (maxScroll > 0) onScrollRatio(el.scrollTop / maxScroll);
          }
        }}
      >
        <EditorContent editor={editor} />


        {/* Slash command menu */}
        {slashMenuOpen && slashMenuPos && filteredSlashItems.length > 0 && (
          <div
            className="absolute z-50 bg-popover border border-border rounded-lg shadow-lg py-1 w-48 max-h-56 overflow-y-auto"
            style={{ top: slashMenuPos.top, left: slashMenuPos.left }}
          >
            {filteredSlashItems.map((item, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
                onMouseDown={(e) => {
                  e.preventDefault();
                  item.action();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
