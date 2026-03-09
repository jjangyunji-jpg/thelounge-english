import { useEffect, useRef, useState, useCallback } from "react";
import { Editor } from "@tiptap/react";

interface TableHoverControlsProps {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement>;
}

interface ButtonInfo {
  type: "col" | "row";
  index: number;
  x: number;
  y: number;
}

export default function TableHoverControls({ editor, containerRef }: TableHoverControlsProps) {
  const [buttons, setButtons] = useState<ButtonInfo[]>([]);
  const [hoveredTable, setHoveredTable] = useState<HTMLTableElement | null>(null);
  const rafRef = useRef<number>(0);

  const computeButtons = useCallback((table: HTMLTableElement) => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const newButtons: ButtonInfo[] = [];

    // Column add buttons (along bottom of each column)
    const firstRow = table.querySelector("tr");
    if (firstRow) {
      const cells = firstRow.querySelectorAll("th, td");
      cells.forEach((cell, i) => {
        const cellRect = cell.getBoundingClientRect();
        // Button at right edge of each cell, at bottom of table
        newButtons.push({
          type: "col",
          index: i,
          x: cellRect.right - containerRect.left,
          y: tableRect.bottom - containerRect.top + 4,
        });
      });
    }

    // Row add buttons (along right side of each row)
    const rows = table.querySelectorAll("tr");
    rows.forEach((row, i) => {
      const rowRect = row.getBoundingClientRect();
      newButtons.push({
        type: "row",
        index: i,
        x: tableRect.right + 4,
        y: rowRect.bottom - containerRect.top,
      });
    });

    setButtons(newButtons);
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !editor) return;

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const table = target.closest("table") as HTMLTableElement | null;
      
      if (table && container.contains(table)) {
        if (hoveredTable !== table) {
          setHoveredTable(table);
        }
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => computeButtons(table));
      } else {
        // Check if mouse is near the table buttons area
        const tableRect = hoveredTable?.getBoundingClientRect();
        if (tableRect) {
          const margin = 30;
          if (
            e.clientX >= tableRect.left - margin &&
            e.clientX <= tableRect.right + margin &&
            e.clientY >= tableRect.top - margin &&
            e.clientY <= tableRect.bottom + margin
          ) {
            return; // Stay visible near table
          }
        }
        setHoveredTable(null);
        setButtons([]);
      }
    };

    container.addEventListener("mousemove", handleMouseMove);
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [editor, containerRef, hoveredTable, computeButtons]);

  const handleAddColumn = useCallback((index: number) => {
    if (!editor || !hoveredTable) return;
    // Click into the table first to set focus
    const firstRow = hoveredTable.querySelector("tr");
    const cells = firstRow?.querySelectorAll("th, td");
    if (cells && cells[index]) {
      const cell = cells[index] as HTMLElement;
      // Find the prosemirror position for this cell
      const pos = editor.view.posAtDOM(cell, 0);
      editor.chain().focus().setTextSelection(pos).addColumnAfter().run();
    }
  }, [editor, hoveredTable]);

  const handleAddRow = useCallback((index: number) => {
    if (!editor || !hoveredTable) return;
    const rows = hoveredTable.querySelectorAll("tr");
    if (rows[index]) {
      const cell = rows[index].querySelector("th, td") as HTMLElement;
      if (cell) {
        const pos = editor.view.posAtDOM(cell, 0);
        editor.chain().focus().setTextSelection(pos).addRowAfter().run();
      }
    }
  }, [editor, hoveredTable]);

  if (!hoveredTable || buttons.length === 0) return null;

  return (
    <div className="table-hover-controls">
      {buttons.map((btn, i) => (
        <button
          key={`${btn.type}-${btn.index}-${i}`}
          className="table-add-btn"
          style={{
            left: btn.type === "col" ? btn.x - 9 : btn.x,
            top: btn.type === "row" ? btn.y - 9 : btn.y,
          }}
          title={btn.type === "col" ? "열 추가" : "행 추가"}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (btn.type === "col") {
              handleAddColumn(btn.index);
            } else {
              handleAddRow(btn.index);
            }
          }}
        >
          +
        </button>
      ))}
    </div>
  );
}
