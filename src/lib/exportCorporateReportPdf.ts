import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

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
  studentName: string;
  instructorName: string;
  learningObjective: string;
  groupStudents: string[];
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

export interface ReportPreviewData {
  summaries: string[];
  remarks: string;
  sessions: Session[];
  info: ReportInfo;
  period: PeriodInfo;
  totalFee?: number;
}

export async function prepareReportData(
  sessions: Session[],
  info: ReportInfo,
  period: PeriodInfo,
): Promise<ReportPreviewData> {
  const start = new Date(period.start_date);
  const end = new Date(period.end_date);
  const now = new Date();

  const completedSessions = sessions
    .filter((s) => {
      const d = new Date(s.scheduled_at);
      return d >= start && d <= end && d <= now && (s.ended_at || (s.notes && s.notes.trim() !== ""));
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const sessionDataForAi = completedSessions.map((s) => {
    const d = new Date(s.scheduled_at);
    return {
      date: d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" }),
      topic: s.topic,
      notes: stripHtml(s.notes),
    };
  });

  let summaries: string[] = [];
  let remarks = "";

  if (completedSessions.length > 0) {
    try {
      const [sumRes, remRes] = await Promise.all([
        supabase.functions.invoke("summarize-report", {
          body: { sessions: sessionDataForAi, type: "summaries" },
        }),
        supabase.functions.invoke("summarize-report", {
          body: { sessions: sessionDataForAi, learningObjective: info.learningObjective, type: "remarks" },
        }),
      ]);
      summaries = sumRes.data?.summaries || sessionDataForAi.map(() => "-");
      remarks = remRes.data?.remarks || "";
    } catch {
      summaries = sessionDataForAi.map(() => "-");
    }
  }

  return { summaries, remarks, sessions: completedSessions, info, period };
}

export async function exportCorporateReportPdf(data: ReportPreviewData) {
  const { summaries, remarks, sessions: completedSessions, info, period } = data;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await registerKoreanFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();

  // Title - centered
  doc.setFontSize(18);
  doc.setTextColor(30, 58, 95);
  doc.text("수업 보고서", pageWidth / 2, 22, { align: "center" });

  // Divider line
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.line(14, 26, pageWidth - 14, 26);

  // Student info section
  const isGroup = info.groupStudents && info.groupStudents.length > 0;
  const studentLabel = isGroup
    ? info.groupStudents.join("  ")
    : info.studentName;

  doc.setFontSize(9.5);
  doc.setTextColor(60);
  
  const infoStartY = 34;
  const labelX = 14;
  const valueX = 42;
  
  doc.setTextColor(100);
  doc.text("학생명", labelX, infoStartY);
  doc.setTextColor(30, 30, 30);
  doc.text(studentLabel, valueX, infoStartY);

  doc.setTextColor(100);
  doc.text("담당 강사", labelX, infoStartY + 6);
  doc.setTextColor(30, 30, 30);
  doc.text(info.instructorName, valueX, infoStartY + 6);

  doc.setTextColor(100);
  doc.text("수업 기간", labelX, infoStartY + 12);
  doc.setTextColor(30, 30, 30);
  doc.text(`${period.label} (${period.start_date} ~ ${period.end_date})`, valueX, infoStartY + 12);

  let nextInfoY = infoStartY + 18;
  if (info.learningObjective) {
    doc.setTextColor(100);
    doc.text("수업 목표", labelX, nextInfoY);
    doc.setTextColor(30, 30, 30);
    const objLines = doc.splitTextToSize(info.learningObjective, pageWidth - valueX - 14);
    doc.text(objLines, valueX, nextInfoY);
    nextInfoY += objLines.length * 5 + 4;
  }

  const startY = nextInfoY + 4;

  if (completedSessions.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("해당 기간에 완료된 수업이 없습니다.", pageWidth / 2, startY + 10, { align: "center" });
    doc.save(`수업보고서_${info.studentName}_${period.label}.pdf`);
    return;
  }

  // Table: No., 날짜, 주제, 수업 내용 요약
  const rows = completedSessions.map((s, idx) => {
    const d = new Date(s.scheduled_at);
    return [
      String(idx + 1),
      d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }),
      s.topic || "-",
      summaries[idx] || stripHtml(s.notes).slice(0, 120) || "-",
    ];
  });

  autoTable(doc, {
    startY,
    head: [["No.", "날짜", "주제", "수업 내용 요약"]],
    body: rows,
    foot: [[
      "",
      `총 ${completedSessions.length}회 수업`,
      "",
      data.totalFee != null ? `₩${data.totalFee.toLocaleString()}` : "",
    ]],
    styles: { fontSize: 8, cellPadding: 3, font: "SpoqaHanSansNeo" },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, font: "SpoqaHanSansNeo", fontStyle: "normal" },
    footStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], font: "SpoqaHanSansNeo", fontStyle: "normal" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 28 },
      2: { cellWidth: 35 },
      3: { cellWidth: "auto" },
    },
    margin: { left: 14, right: 14 },
  });

  // Remarks section
  const finalY = (doc as any).lastAutoTable?.finalY || startY + 40;

  if (remarks) {
    let remarksY = finalY + 12;
    const pageHeight = doc.internal.pageSize.getHeight();
    if (remarksY + 30 > pageHeight - 20) {
      doc.addPage();
      remarksY = 20;
    }

    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95);
    doc.text("Notes from The Lounge English", 14, remarksY);

    // Subtle line under title
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(14, remarksY + 2, pageWidth - 14, remarksY + 2);

    doc.setFontSize(9);
    doc.setTextColor(50);
    const remarkLines = doc.splitTextToSize(remarks, pageWidth - 28);
    doc.text(remarkLines, 14, remarksY + 8);
  }

  doc.save(`수업보고서_${info.studentName}_${period.label}.pdf`);
}
