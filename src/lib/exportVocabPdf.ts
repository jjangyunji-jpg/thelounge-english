import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface VocabWord {
  english_word: string;
  korean_meaning: string;
  part_of_speech: string | null;
  example_sentence: string | null;
  week_label: string;
}

function fmtWeek(label: string) {
  return label.replace(/(\d{4})-W(\d{2})/, (_, y, w) => `${y} Week ${parseInt(w)}`);
}

async function registerKoreanFont(doc: jsPDF) {
  const fontUrl =
    "https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans/Subset/SpoqaHanSansNeo/SpoqaHanSansNeo-Regular.ttf";
  const res = await fetch(fontUrl);
  const buf = await res.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );
  doc.addFileToVFS("SpoqaHanSansNeo.ttf", base64);
  doc.addFont("SpoqaHanSansNeo.ttf", "SpoqaHanSansNeo", "normal");
  doc.setFont("SpoqaHanSansNeo");
}

export async function exportWordsPdf(words: VocabWord[], studentName: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  await registerKoreanFont(doc);

  // Title
  doc.setFontSize(16);
  doc.text(`Vocabulary List - ${studentName}`, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleDateString("ko-KR")}`, 14, 25);

  // Group by week
  const byWeek: Record<string, VocabWord[]> = {};
  for (const w of words) {
    if (!byWeek[w.week_label]) byWeek[w.week_label] = [];
    byWeek[w.week_label].push(w);
  }
  const weeks = Object.keys(byWeek).sort((a, b) => b.localeCompare(a));

  let startY = 32;

  for (const wk of weeks) {
    const wkWords = byWeek[wk];

    doc.setTextColor(40);
    doc.setFontSize(12);
    doc.text(fmtWeek(wk), 14, startY);
    startY += 2;

    autoTable(doc, {
      startY,
      head: [["#", "English", "Korean", "Part of Speech", "Example"]],
      body: wkWords.map((w, i) => [
        String(i + 1),
        w.english_word,
        w.korean_meaning,
        w.part_of_speech ?? "",
        w.example_sentence ?? "",
      ]),
      styles: { fontSize: 9, cellPadding: 2, font: "SpoqaHanSansNeo" },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold", font: "SpoqaHanSansNeo" },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 30 },
        2: { cellWidth: 35 },
        3: { cellWidth: 22 },
        4: { cellWidth: "auto" },
      },
      margin: { left: 14, right: 14 },
    });

    startY = (doc as any).lastAutoTable.finalY + 10;
  }

  doc.save(`vocabulary_${studentName}.pdf`);
}
