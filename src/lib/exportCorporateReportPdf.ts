import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

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

async function fetchAiSummaries(sessions: { date: string; topic: string | null; notes: string | null }[]): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke("summarize-report", {
      body: { sessions, type: "summaries" },
    });
    if (error || !data?.summaries) return sessions.map(() => "-");
    return data.summaries;
  } catch {
    return sessions.map(() => "-");
  }
}

async function fetchAiRemarks(
  sessions: { date: string; topic: string | null; notes: string | null }[],
  learningObjective: string
): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke("summarize-report", {
      body: { sessions, learningObjective, type: "remarks" },
    });
    if (error || !data?.remarks) return "";
    return data.remarks;
  } catch {
    return "";
  }
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

  // Filter sessions in period that have notes OR are completed
  const completedSessions = sessions
    .filter((s) => {
      const d = new Date(s.scheduled_at);
      return d >= start && d <= end && d <= now && (s.ended_at || (s.notes && s.notes.trim() !== ""));
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  // Header
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 95);
  doc.text("수업 보고서", 14, 20);

  // Student name display
  const isGroup = info.groupStudents && info.groupStudents.length > 0;
  const studentLabel = isGroup
    ? `학생명: ${info.groupStudents.join("  ")}`
    : `학생명: ${info.studentName}`;

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(studentLabel, 14, 30);
  doc.text(`담당 강사: ${info.instructorName}`, 14, 36);
  doc.text(`수업 기간: ${period.label} (${period.start_date} ~ ${period.end_date})`, 14, 42);

  let nextY = 48;
  if (info.learningObjective) {
    doc.text(`수업 목표: ${info.learningObjective}`, 14, nextY);
    nextY += 6;
  }

  const startY = nextY + 4;

  if (completedSessions.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("해당 기간에 완료된 수업이 없습니다.", 14, startY + 6);
    doc.save(`수업보고서_${info.studentName}_${period.label}.pdf`);
    return;
  }

  // Fetch AI summaries for notes
  const sessionDataForAi = completedSessions.map((s) => {
    const d = new Date(s.scheduled_at);
    return {
      date: d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" }),
      topic: s.topic,
      notes: stripHtml(s.notes),
    };
  });

  const [aiSummaries, aiRemarks] = await Promise.all([
    fetchAiSummaries(sessionDataForAi),
    fetchAiRemarks(sessionDataForAi, info.learningObjective),
  ]);

  // Session detail table
  const fmt = (n: number) => n.toLocaleString("en-US");

  const rows = completedSessions.map((s, idx) => {
    const sessionIsGroup = s.group_students && s.group_students.length > 0;
    const rate = sessionIsGroup ? GROUP_RATE : INDIVIDUAL_RATE;
    const d = new Date(s.scheduled_at);
    return [
      String(idx + 1),
      d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }),
      d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }),
      s.topic || "-",
      aiSummaries[idx] || stripHtml(s.notes).slice(0, 60) || "-",
      sessionIsGroup ? "그룹" : "개인",
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

  // Remarks section (AI-generated)
  if (aiRemarks) {
    const remarksY = summaryY + 7 + lines.length * 6 + 14;

    // Check if we need a new page
    const pageHeight = doc.internal.pageSize.getHeight();
    const needsNewPage = remarksY + 30 > pageHeight - 20;

    let actualRemarksY = remarksY;
    if (needsNewPage) {
      doc.addPage();
      actualRemarksY = 20;
    }

    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95);
    doc.text("비고", 14, actualRemarksY);

    doc.setFontSize(9);
    doc.setTextColor(60);
    const remarkLines = doc.splitTextToSize(aiRemarks, 180);
    doc.text(remarkLines, 14, actualRemarksY + 7);
  }

  doc.save(`수업보고서_${info.studentName}_${period.label}.pdf`);
}
