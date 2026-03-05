import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const INDIVIDUAL_RATE = 50000;
const GROUP_RATE = 70000;

interface Session {
  scheduled_at: string;
  student_name: string;
  topic: string | null;
  notes: string | null;
  level: string;
  ended_at: string | null;
  group_students: string[];
}

interface ReportInfo {
  companyName: string;
  instructorName: string;
  learningObjective: string;
}

interface PeriodInfo {
  label: string;
  start_date: string;
  end_date: string;
}

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

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

export async function exportCorporateReportPdf(
  sessions: Session[],
  info: ReportInfo,
  period: PeriodInfo,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await registerKoreanFont(doc);

  const start = new Date(period.start_date);
  const end = new Date(period.end_date);
  const now = new Date();

  // Filter completed sessions in period
  const completedSessions = sessions
    .filter((s) => {
      const d = new Date(s.scheduled_at);
      return d >= start && d <= end && d <= now && s.ended_at;
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  // Header
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 95);
  doc.text("수업 보고서", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`기업명: ${info.companyName}`, 14, 30);
  doc.text(`담당 강사: ${info.instructorName}`, 14, 36);
  doc.text(`보고 기간: ${period.label} (${period.start_date} ~ ${period.end_date})`, 14, 42);
  doc.text(`생성일: ${new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}`, 14, 48);

  if (info.learningObjective) {
    doc.text(`수업 목표: ${info.learningObjective}`, 14, 54);
  }

  const startY = info.learningObjective ? 62 : 56;

  if (completedSessions.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("해당 기간에 완료된 수업이 없습니다.", 14, startY + 6);
    doc.save(`수업보고서_${info.companyName}_${period.label}.pdf`);
    return;
  }

  // Session detail table
  const fmt = (n: number) => n.toLocaleString("en-US");

  const rows = completedSessions.map((s, idx) => {
    const isGroup = s.group_students && s.group_students.length > 0;
    const rate = isGroup ? GROUP_RATE : INDIVIDUAL_RATE;
    const d = new Date(s.scheduled_at);
    return [
      String(idx + 1),
      d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }),
      d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }),
      s.topic || "-",
      stripHtml(s.notes).slice(0, 60) || "-",
      isGroup ? "그룹" : "개인",
      `${fmt(rate)}원`,
    ];
  });

  const totalIndividual = completedSessions.filter(s => !s.group_students || s.group_students.length === 0).length;
  const totalGroup = completedSessions.filter(s => s.group_students && s.group_students.length > 0).length;
  const totalFee = totalIndividual * INDIVIDUAL_RATE + totalGroup * GROUP_RATE;

  autoTable(doc, {
    startY,
    head: [["No.", "날짜", "시간", "주제", "수업 내용 요약", "유형", "수업료"]],
    body: rows,
    foot: [[
      "합계",
      `총 ${completedSessions.length}회`,
      "",
      "",
      "",
      `개인 ${totalIndividual} / 그룹 ${totalGroup}`,
      `${fmt(totalFee)}원`,
    ]],
    styles: { fontSize: 7.5, cellPadding: 2, font: "SpoqaHanSansNeo" },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, font: "SpoqaHanSansNeo", fontStyle: "normal" },
    footStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], font: "SpoqaHanSansNeo", fontStyle: "normal" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 25 },
      2: { cellWidth: 18 },
      3: { cellWidth: 35 },
      4: { cellWidth: "auto" },
      5: { cellWidth: 15, halign: "center" },
      6: { cellWidth: 22, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // Summary section after table
  const finalY = (doc as any).lastAutoTable?.finalY || startY + 40;
  const summaryY = finalY + 10;

  doc.setFontSize(11);
  doc.setTextColor(30, 58, 95);
  doc.text("정산 요약", 14, summaryY);

  doc.setFontSize(9);
  doc.setTextColor(60);
  const lines = [
    `총 수업 횟수: ${completedSessions.length}회`,
    `개인 수업: ${totalIndividual}회 × ₩${fmt(INDIVIDUAL_RATE)} = ₩${fmt(totalIndividual * INDIVIDUAL_RATE)}`,
    `그룹 수업: ${totalGroup}회 × ₩${fmt(GROUP_RATE)} = ₩${fmt(totalGroup * GROUP_RATE)}`,
  ];
  lines.forEach((line, i) => {
    doc.text(line, 14, summaryY + 7 + i * 6);
  });

  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(`총 수업료: ₩${fmt(totalFee)}`, 14, summaryY + 7 + lines.length * 6 + 4);

  doc.save(`수업보고서_${info.companyName}_${period.label}.pdf`);
}
