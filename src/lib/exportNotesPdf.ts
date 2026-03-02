import jsPDF from "jspdf";

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
}

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
}

export async function exportNotesPdf(sessions: SessionNote[], studentName: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await registerKoreanFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;

  // Title
  doc.setFontSize(16);
  doc.text(`수업 노트 - ${studentName}`, margin, 18);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`내보내기: ${new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}  |  총 ${sessions.length}회`, margin, 25);
  doc.setTextColor(0);

  let y = 32;

  for (const s of sessions) {
    const dateLabel = formatDate(s.scheduled_at);
    const studentLabel = s.student_name ? ` [${s.student_name}]` : "";
    const topicLabel = s.topic ? ` - ${s.topic}` : "";
    const notesText = s.notes ? stripHtml(s.notes) : "(노트 없음)";
    const remarksText = s.remarks ? `비고: ${s.remarks}` : "";

    // Check if we need a new page
    const estimatedHeight = 15 + Math.ceil(notesText.length / 80) * 5;
    if (y + estimatedHeight > 270) {
      doc.addPage();
      y = 14;
    }

    // Date header
    doc.setFontSize(11);
    doc.setTextColor(40, 60, 100);
    doc.text(`${dateLabel}${studentLabel}${topicLabel}`, margin, y);
    y += 2;
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    // Notes content
    doc.setFontSize(9);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(notesText, maxWidth);
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = 14; }
      doc.text(line, margin, y);
      y += 4.5;
    }

    // Remarks
    if (remarksText) {
      if (y > 270) { doc.addPage(); y = 14; }
      doc.setTextColor(100);
      doc.setFontSize(8);
      const remarkLines = doc.splitTextToSize(remarksText, maxWidth);
      for (const rl of remarkLines) {
        if (y > 275) { doc.addPage(); y = 14; }
        doc.text(rl, margin, y);
        y += 4;
      }
      doc.setTextColor(0);
    }

    y += 6;
  }

  doc.save(`수업노트_${studentName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
