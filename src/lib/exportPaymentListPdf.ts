import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PaymentListRow {
  student_name: string;
  fee: number;
  session_count: number;
}

interface ExportOptions {
  periodLabel: string;
  rows: PaymentListRow[];
}

async function registerKoreanFont(doc: jsPDF) {
  const fontUrl = "/fonts/SpoqaHanSansNeo-Regular.ttf";
  const res = await fetch(fontUrl);
  const buf = await res.arrayBuffer();
  const base64 = btoa(new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), ""));
  doc.addFileToVFS("SpoqaHanSansNeo.ttf", base64);
  doc.addFont("SpoqaHanSansNeo.ttf", "SpoqaHanSansNeo", "normal");
  doc.setFont("SpoqaHanSansNeo");
}

export async function exportPaymentListPdf({ periodLabel, rows }: ExportOptions) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerKoreanFont(doc);

  // Title
  doc.setFontSize(16);
  doc.text(`${periodLabel} 수강생 리스트`, 14, 18);

  // Subheader
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text(`총 ${rows.length}명 · 합계 ₩${rows.reduce((s, r) => s + r.fee, 0).toLocaleString()}`, 14, 25);
  doc.setTextColor(0, 0, 0);

  // Table
  const totalFee = rows.reduce((s, r) => s + r.fee, 0);
  const body = rows.map((r, i) => [
    String(i + 1),
    r.student_name,
    `${r.session_count}회`,
    `₩${r.fee.toLocaleString()}`,
  ]);
  body.push(["", "합계", "", `₩${totalFee.toLocaleString()}`]);

  autoTable(doc, {
    startY: 32,
    head: [["번호", "이름", "결제대상", "수강료"]],
    body,
    styles: { font: "SpoqaHanSansNeo", fontStyle: "normal", fontSize: 10, cellPadding: 2.5 },
    headStyles: {
      font: "SpoqaHanSansNeo",
      fontStyle: "normal",
      fillColor: [40, 30, 24],
      textColor: 255,
      halign: "center",
    },
    bodyStyles: { font: "SpoqaHanSansNeo", fontStyle: "normal" },
    footStyles: { font: "SpoqaHanSansNeo", fontStyle: "normal" },
    columnStyles: {
      0: { halign: "center", cellWidth: 18 },
      1: { halign: "left" },
      2: { halign: "center", cellWidth: 28 },
      3: { halign: "right", cellWidth: 38 },
    },
    didParseCell: (data) => {
      // Force Korean font on every cell (head/body/foot) to prevent glyph fallback
      data.cell.styles.font = "SpoqaHanSansNeo";
      data.cell.styles.fontStyle = "normal";
      // Bold the totals row visually with background
      if (data.row.index === body.length - 1) {
        data.cell.styles.fillColor = [245, 240, 230];
      }
    },
  });

  doc.save(`${periodLabel}_수강생리스트.pdf`);
}
