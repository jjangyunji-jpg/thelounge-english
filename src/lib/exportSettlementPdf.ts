import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BASE_PAY = 11000;
const LEVEL_RATES: Record<string, number> = {
  A1: 14000, A2: 14000,
  B1: 19000, B2: 19000,
  C1: 24000, C2: 24000,
};

const getLevelCategory = (level: string) => {
  if (["A1", "A2"].includes(level)) return "초급";
  if (["B1", "B2"].includes(level)) return "중급";
  if (["C1", "C2"].includes(level)) return "고급";
  return "중급";
};

interface Session {
  scheduled_at: string;
  student_name: string;
  level: string;
}

interface Meeting {
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
}

interface InstructorInfo {
  name: string;
  email: string;
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

function buildSettlementRows(sessions: Session[], meetings: Meeting[], periodStart: string, periodEnd: string, meetingRate: number = 20000, flatRate?: number) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const now = new Date();

  const rows: { date: Date; type: string; description: string; durationHours: number; pay: number }[] = [];

  sessions.forEach((s) => {
    const d = new Date(s.scheduled_at);
    if (d >= start && d <= end && d <= now) {
      const levelRate = LEVEL_RATES[s.level] || 19000;
      const pay = flatRate ? flatRate : (BASE_PAY + levelRate);
      rows.push({
        date: d,
        type: "수업",
        description: `${s.student_name} (${getLevelCategory(s.level)})`,
        durationHours: 1,
        pay,
      });
    }
  });

  // 대표는 미팅 정산 제외
  if (!flatRate) {
    meetings.forEach((m) => {
      const d = new Date(m.scheduled_at);
      if (d >= start && d <= end && d <= now) {
        const durationHours = m.duration_minutes / 60;
        const meetingPay = Math.round(durationHours * BASE_PAY);
        rows.push({
          date: d,
          type: "미팅",
          description: m.notes || "업무 미팅",
          durationHours,
          pay: meetingPay,
        });
      }
    });
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  let cumulative = 0;
  return rows.map((r) => {
    cumulative += r.pay;
    return { ...r, cumulative };
  });
}

export async function exportAllSettlementsPdf(
  instructors: { info: InstructorInfo; sessions: Session[]; meetings: Meeting[]; meetingRate?: number; position?: string; lessonRate?: number }[],
  period: PeriodInfo,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await registerKoreanFont(doc);

  for (let i = 0; i < instructors.length; i++) {
    const { info, sessions, meetings, meetingRate, position, lessonRate } = instructors[i];
    if (i > 0) doc.addPage();

    const flatRate = position === '대표' ? (lessonRate ?? 50000) : undefined;
    const rows = buildSettlementRows(sessions, meetings, period.start_date, period.end_date, meetingRate, flatRate);
    const totalPay = rows.length > 0 ? rows[rows.length - 1].cumulative : 0;

    // Header
    doc.setFontSize(14);
    doc.setTextColor(30, 58, 95);
    doc.text(`정산 내역서 — ${info.name}`, 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`기간: ${period.label} (${period.start_date} ~ ${period.end_date})`, 14, 25);
    doc.text(`이메일: ${info.email}`, 14, 30);
    doc.text(`생성일: ${new Date().toLocaleDateString("ko-KR")}`, 14, 35);

    if (rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text("해당 기간에 완료된 업무가 없습니다.", 14, 48);
      continue;
    }

    const fmt = (n: number) => n.toLocaleString("en-US");

    autoTable(doc, {
      startY: 42,
      head: [["일자", "구분", "업무내용", "시간", "급여", "누적 금액"]],
      body: rows.map((r) => [
        r.date.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" }),
        r.type,
        r.description,
        `${r.durationHours}시간`,
        `${fmt(r.pay)}원`,
        `${fmt(r.cumulative)}원`,
      ]),
      foot: [["합계", "", "", "", `${fmt(totalPay)}원`, ""]],
      styles: { fontSize: 8, cellPadding: 2, font: "SpoqaHanSansNeo" },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, font: "SpoqaHanSansNeo", fontStyle: "normal" },
      footStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], font: "SpoqaHanSansNeo", fontStyle: "normal" },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 15 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 18 },
        4: { cellWidth: 25, halign: "right" },
        5: { cellWidth: 28, halign: "right" },
      },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save(`정산내역_${period.label}.pdf`);
}
