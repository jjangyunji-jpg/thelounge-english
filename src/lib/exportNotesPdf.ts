import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

async function registerKoreanFont(doc: jsPDF) {
  const fontUrl = "/fonts/SpoqaHanSansNeo-Regular.ttf";
  const res = await fetch(fontUrl);
  const buf = await res.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );
  doc.addFileToVFS("SpoqaHanSansNeo.ttf", base64);
  doc.addFont("SpoqaHanSansNeo.ttf", "SpoqaHanSansNeo", "normal");
  doc.setFont("SpoqaHanSansNeo");
}

interface SessionNote {
  scheduled_at: string;
  topic: string | null;
  notes: string | null;
  remarks: string | null;
  student_name?: string;
  level?: string;
  lessonNumber?: number | string | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
}

function getText(el: Element): string {
  return (el.textContent || "").trim();
}

/** Render parsed HTML nodes into jsPDF with structure */
function renderHtmlToPdf(
  doc: jsPDF,
  html: string,
  startY: number,
  margin: number,
  maxWidth: number,
): number {
  let y = startY;
  const pageH = 280;

  const checkPage = (need: number) => {
    if (y + need > pageH) {
      doc.addPage();
      y = 14;
    }
  };

  const container = document.createElement("div");
  container.innerHTML = html;

  const children = Array.from(container.children);
  if (children.length === 0) {
    // Plain text fallback
    const text = (container.textContent || "").trim();
    if (text) {
      doc.setFontSize(9);
      doc.setTextColor(30);
      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        checkPage(5);
        doc.text(line, margin, y);
        y += 4.5;
      }
    }
    return y;
  }

  for (const node of children) {
    const tag = node.tagName?.toUpperCase() || "";
    const text = getText(node);

    // Skip empty elements
    if (!text && tag !== "TABLE" && tag !== "HR") continue;

    // ── Callout blocks (custom data-callout divs) ──
    if (node.getAttribute?.("data-callout") !== null && node.getAttribute?.("data-callout") !== undefined && tag === "DIV") {
      const calloutTitle = getText(node.querySelector("h1, h2, h3") || node);
      if (calloutTitle) {
        checkPage(10);
        // Draw callout bar
        doc.setFillColor(30, 58, 95);
        doc.rect(margin, y - 3.5, 1.5, 5, "F");
        doc.setFontSize(10);
        doc.setTextColor(30, 58, 95);
        doc.text(calloutTitle, margin + 4, y);
        y += 7;
      }
      // Render callout body children (skip the heading)
      const bodyNodes = Array.from(node.children).filter(c => !["H1", "H2", "H3"].includes(c.tagName));
      if (bodyNodes.length > 0) {
        const tempDiv = document.createElement("div");
        bodyNodes.forEach(b => tempDiv.appendChild(b.cloneNode(true)));
        y = renderHtmlToPdf(doc, tempDiv.innerHTML, y, margin, maxWidth);
      }
      continue;
    }

    // ── Headings ──
    if (["H1", "H2", "H3"].includes(tag)) {
      const sizes: Record<string, number> = { H1: 12, H2: 11, H3: 10 };
      checkPage(10);
      y += 2;
      doc.setFontSize(sizes[tag] || 10);
      doc.setTextColor(30, 45, 80);
      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        checkPage(6);
        doc.text(line, margin, y);
        y += 5.5;
      }
      if (tag === "H1") {
        doc.setDrawColor(200);
        doc.line(margin, y - 2, margin + maxWidth, y - 2);
      }
      y += 1;
      continue;
    }

    // ── Horizontal Rule ──
    if (tag === "HR") {
      checkPage(4);
      doc.setDrawColor(210);
      doc.line(margin, y, margin + maxWidth, y);
      y += 4;
      continue;
    }

    // ── Tables ──
    if (tag === "TABLE") {
      checkPage(15);
      const rows = Array.from(node.querySelectorAll("tr"));
      if (rows.length === 0) continue;

      const tableData: string[][] = [];
      let headData: string[][] = [];

      rows.forEach((row, ri) => {
        const cells = Array.from(row.querySelectorAll("th, td")).map(c => getText(c));
        if (ri === 0 && row.querySelector("th")) {
          headData = [cells];
        } else {
          tableData.push(cells);
        }
      });

      autoTable(doc, {
        startY: y,
        head: headData.length > 0 ? headData : undefined,
        body: tableData,
        styles: { fontSize: 7.5, cellPadding: 1.5, font: "SpoqaHanSansNeo", overflow: "linebreak" },
        headStyles: { fillColor: [30, 58, 95], textColor: 255, font: "SpoqaHanSansNeo", fontStyle: "normal" },
        margin: { left: margin, right: margin },
        tableWidth: maxWidth,
      });
      y = (doc as any).lastAutoTable?.finalY + 4 || y + 20;
      continue;
    }

    // ── Lists (UL/OL) ──
    if (tag === "UL" || tag === "OL") {
      const items = Array.from(node.querySelectorAll(":scope > li"));
      doc.setFontSize(9);
      doc.setTextColor(30);
      items.forEach((li, idx) => {
        const bullet = tag === "OL" ? `${idx + 1}. ` : "• ";
        const itemText = getText(li);
        const lines = doc.splitTextToSize(`${bullet}${itemText}`, maxWidth - 4);
        for (const line of lines) {
          checkPage(5);
          doc.text(line, margin + 2, y);
          y += 4.5;
        }
      });
      y += 1;
      continue;
    }

    // ── Blockquote ──
    if (tag === "BLOCKQUOTE") {
      checkPage(8);
      doc.setFillColor(245, 245, 245);
      doc.setTextColor(80);
      doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(text, maxWidth - 8);
      const blockH = lines.length * 4.5 + 3;
      checkPage(blockH);
      doc.rect(margin, y - 3, maxWidth, blockH, "F");
      doc.setFillColor(180, 180, 180);
      doc.rect(margin, y - 3, 1.2, blockH, "F");
      for (const line of lines) {
        doc.text(line, margin + 4, y);
        y += 4.5;
      }
      y += 3;
      doc.setTextColor(30);
      continue;
    }

    // ── Default: paragraph ──
    doc.setFontSize(9);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      checkPage(5);
      doc.text(line, margin, y);
      y += 4.5;
    }
    y += 1;
  }

  return y;
}

export async function exportNotesPdf(sessions: SessionNote[], titleLabel: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await registerKoreanFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;

  // Title page header
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 95);
  doc.text(`수업 노트 — ${titleLabel}`, margin, 18);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`내보내기: ${new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}  |  총 ${sessions.length}회`, margin, 25);
  doc.setTextColor(0);

  let y = 34;

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const dateLabel = formatDate(s.scheduled_at);
    const studentLabel = s.student_name || "";
    const lessonLabel = s.lessonNumber ? `${s.lessonNumber}회차` : "";
    const topicLabel = s.topic || "";

    // Session header - check for new page
    if (y > 250) { doc.addPage(); y = 14; }

    // Session separator (except first)
    if (i > 0) {
      doc.setDrawColor(220);
      doc.line(margin, y, margin + maxWidth, y);
      y += 6;
    }

    // Build header: "학생명 / 4회차" or "날짜 - 토픽"
    let headerParts: string[] = [];
    if (studentLabel) headerParts.push(studentLabel);
    if (lessonLabel) headerParts.push(lessonLabel);
    const headerMain = headerParts.length > 0 ? headerParts.join(" / ") : dateLabel;
    
    // Header badge
    doc.setFillColor(30, 58, 95);
    const headerW = doc.getTextWidth(headerMain) * 1.15 + 8;
    doc.roundedRect(margin, y - 4.5, Math.max(headerW, 30), 7, 1.5, 1.5, "F");
    doc.setFontSize(10);
    doc.setTextColor(255);
    doc.text(headerMain, margin + 4, y);
    y += 6;

    // Sub-info line
    const subParts: string[] = [];
    if (studentLabel && headerParts.length > 0) subParts.push(dateLabel);
    if (topicLabel) subParts.push(topicLabel);
    if (subParts.length > 0) {
      doc.setFontSize(8.5);
      doc.setTextColor(120);
      doc.text(subParts.join("  |  "), margin, y);
      y += 5;
    }

    y += 1;

    // Notes content with rich formatting
    if (s.notes && s.notes.trim()) {
      y = renderHtmlToPdf(doc, s.notes, y, margin, maxWidth);
    } else {
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text("(노트 없음)", margin, y);
      y += 6;
    }

    // Remarks
    if (s.remarks) {
      if (y > 270) { doc.addPage(); y = 14; }
      doc.setTextColor(100);
      doc.setFontSize(8);
      const remarkLines = doc.splitTextToSize(`비고: ${s.remarks}`, maxWidth);
      for (const rl of remarkLines) {
        if (y > 275) { doc.addPage(); y = 14; }
        doc.text(rl, margin, y);
        y += 4;
      }
      doc.setTextColor(0);
    }

    y += 4;
  }

  doc.save(`수업노트_${titleLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
