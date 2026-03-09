import { useEffect, useRef, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Editor } from "@tiptap/react";

interface TableHoverControlsProps {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement>;
}

interface ButtonInfo {
  type: "row" | "col";
  x: number;
  y: number;
  index: number;
}

export default function TableHoverControls({ editor, containerRef }: TableHoverControlsProps) {
  const [buttons, setButtons] = useState<ButtonInfo[]>([]);
  const [hoveredTable, setHoveredTable] = useState<HTMLTableElement | null>(null);
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<{
    row: HTMLTableRowElement;
    startY: number;
    startHeight: number;
  } | null>(null);

  const updateButtons = useCallback((table: HTMLTableElement) => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const newButtons: ButtonInfo[] = [];

    // Column + buttons (at the top of each column boundary)
    const firstRow = table.querySelector("tr");
    if (firstRow) {
      const cells = firstRow.querySelectorAll("th, td");
      cells.forEach((cell, i) => {
        const cellRect = cell.getBoundingClientRect();
        // + button after each column (at right edge)
        newButtons.push({
          type: "col",
          x: cellRect.right - containerRect.left - 8,
          y: tableRect.top - containerRect.top - 16,
          index: i,
        });
      });
    }

    // Row + buttons (at the left of each row boundary)
    const rows = table.querySelectorAll("tr");
    rows.forEach((row, i) => {
      const rowRect = row.getBoundingClientRect();
      newButtons.push({
        type: "row",
        x: tableRect.left - containerRect.left - 16,
        y: rowRect.bottom - containerRect.top - 8,
        index: i,
      });
    });

    setButtons(newButtons);
  }, [containerRef]);

  // Track mouse to find hovered table
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizing) return;

      const target = e.target as HTMLElement;
      const table = target.closest("table") as HTMLTableElement | null;

      // Also check if mouse is near a table (within 20px for the + buttons area)
      if (!table) {
        const tables = container.querySelectorAll("table");
        let nearTable: HTMLTableElement | null = null;
        for (const t of Array.from(tables)) {
          const rect = t.getBoundingClientRect();
          const margin = 24;
          if (
            e.clientX >= rect.left - margin &&
            e.clientX <= rect.right + margin &&
            e.clientY >= rect.top - margin &&
            e.clientY <= rect.bottom + margin
          ) {
            nearTable = t as HTMLTableElement;
            break;
          }
        }
        if (nearTable) {
          setHoveredTable(nearTable);
          updateButtons(nearTable);
        } else {
          setHoveredTable(null);
          setButtons([]);
        }
        return;
      }

      setHoveredTable(table);
      updateButtons(table);
    };

    const handleMouseLeave = () => {
      if (!resizing) {
        setHoveredTable(null);
        setButtons([]);
      }
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [containerRef, updateButtons, resizing]);

  // Row resize via bottom border dragging
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const cell = target.closest("td, th") as HTMLTableCellElement | null;
      if (!cell) return;

      const row = cell.closest("tr") as HTMLTableRowElement | null;
      if (!row) return;

      const cellRect = cell.getBoundingClientRect();
      const bottomEdge = cellRect.bottom;
      const threshold = 4;

      if (Math.abs(e.clientY - bottomEdge) <= threshold) {
        e.preventDefault();
        e.stopPropagation();
        setResizing(true);
        resizeRef.current = {
          row,
          startY: e.clientY,
          startHeight: row.getBoundingClientRect().height,
        };
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";
      }
    };

    const handleMouseMoveResize = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { row, startY, startHeight } = resizeRef.current;
      const delta = e.clientY - startY;
      const newHeight = Math.max(28, startHeight + delta);
      row.style.height = `${newHeight}px`;
      // Set height on cells too
      const cells = row.querySelectorAll("td, th");
      cells.forEach((cell) => {
        (cell as HTMLElement).style.height = `${newHeight}px`;
      });
    };

    const handleMouseUp = () => {
      if (resizeRef.current) {
        resizeRef.current = null;
        setResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    // Show resize cursor when near bottom edge of cells
    const handleCursorHint = (e: MouseEvent) => {
      if (resizeRef.current) return;
      const target = e.target as HTMLElement;
      const cell = target.closest("td, th") as HTMLTableCellElement | null;
      if (!cell) return;
      const cellRect = cell.getBoundingClientRect();
      if (Math.abs(e.clientY - cellRect.bottom) <= 4) {
        cell.style.cursor = "row-resize";
      } else {
        cell.style.cursor = "";
      }
    };

    container.addEventListener("mousedown", handleMouseDown, true);
    container.addEventListener("mousemove", handleCursorHint);
    document.addEventListener("mousemove", handleMouseMoveResize);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown, true);
      container.removeEventListener("mousemove", handleCursorHint);
      document.removeEventListener("mousemove", handleMouseMoveResize);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [containerRef]);

  const handleAddRow = useCallback((index: number) => {
    if (!editor || !hoveredTable) return;
    // Focus into a cell in the target row, then add row after
    const rows = hoveredTable.querySelectorAll("tr");
    const targetRow = rows[index];
    if (!targetRow) return;
    const firstCell = targetRow.querySelector("td, th");
    if (!firstCell) return;

    // Get the ProseMirror position for this DOM element
    const pos = editor.view.posAtDOM(firstCell, 0);
    editor.chain().focus().setTextSelection(pos).addRowAfter().run();
  }, [editor, hoveredTable]);

  const handleAddCol = useCallback((index: number) => {
    if (!editor || !hoveredTable) return;
    const firstRow = hoveredTable.querySelector("tr");
    if (!firstRow) return;
    const cells = firstRow.querySelectorAll("th, td");
    const targetCell = cells[index];
    if (!targetCell) return;

    const pos = editor.view.posAtDOM(targetCell, 0);
    editor.chain().focus().setTextSelection(pos).addColumnAfter().run();
  }, [editor, hoveredTable]);

  if (!hoveredTable || buttons.length === 0) return null;

  return (
    <>
      {buttons.map((btn, i) => (
        <button
          key={`${btn.type}-${btn.index}-${i}`}
          className="absolute z-30 flex items-center justify-center w-4 h-4 rounded-full bg-primary/80 text-primary-foreground opacity-0 hover:opacity-100 transition-opacity hover:scale-110 shadow-sm"
          style={{
            left: btn.x,
            top: btn.y,
            opacity: 0.5,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "0.5";
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (btn.type === "row") handleAddRow(btn.index);
            else handleAddCol(btn.index);
          }}
          title={btn.type === "row" ? "행 추가" : "열 추가"}
        >
          <Plus className="w-2.5 h-2.5" />
        </button>
      ))}
    </>
  );
}
