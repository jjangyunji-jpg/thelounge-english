import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface SessionCountRow {
  student_name: string;
  is_corporate: boolean;
  is_group: boolean;
  instructor_name?: string;
  completed: number;        // ended_at 있고 cancellation_type 없음
  no_show: number;          // no_show
  same_day_cancel: number;  // student_cancel
  sick: number;             // sick
  instructor_cancel: number;// instructor_cancel
  advance_cancel: number;   // advance_cancel
  makeup_completed: number; // 보강으로 처리되어 완료된 수업
  scheduled: number;        // 미진행
  carryover: number;        // 이번 달 이월 표시된 수업 수
  prev_carryover_in: number;// 전월 이월(이월플래그+강사취소) → 당월 결제 차감
  actual_lessons: number;   // 실제 진행 = 완료 + 보강완료 + 노쇼
  billable: number;         // 결제대상 = 4(기본) - prev_carryover_in
  total: number;            // 전체 (완료+취소+보강+예정)
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

export async function exportSessionCountPdf(
  rows: SessionCountRow[],
  periodLabel: string,
  periodRange: { start: string; end: string },
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await registerKoreanFont(doc);

  const regulars = rows.filter(r => !r.is_corporate);
  const corporates = rows.filter(r => r.is_corporate);

  // Header
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 95);
  doc.text(`월별 수업 카운트 — ${periodLabel}`, 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`기간: ${periodRange.start} ~ ${periodRange.end}`, 14, 20);
  doc.text(`생성일: ${new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}`, 14, 25);
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`결제대상 = (완료 + 보강완료 + 노쇼) - 전월 이월 횟수`, 14, 30);

  const buildHead = () => [[
    "학생명",
    "완료",
    "보강",
    "노쇼",
    "당일",
    "병결",
    "강사취소",
    "사전",
    "이월\n(당월)",
    "이월\n(전월)",
    "예정",
    "전체",
    "결제\n대상",
  ]];

  const buildBody = (list: SessionCountRow[]) => list.map(r => [
    r.student_name + (r.is_group ? " (그룹)" : ""),
    String(r.completed),
    String(r.makeup_completed),
    String(r.no_show),
    String(r.same_day_cancel),
    String(r.sick),
    String(r.instructor_cancel),
    String(r.advance_cancel),
    String(r.carryover),
    r.prev_carryover_in ? `-${r.prev_carryover_in}` : "0",
    String(r.scheduled),
    String(r.total),
    String(r.billable),
  ]);

  const buildFoot = (list: SessionCountRow[]) => {
    const sum = (k: keyof SessionCountRow) => list.reduce((s, r) => s + ((r[k] as number) || 0), 0);
    return [[
      "합계",
      String(sum("completed")),
      String(sum("makeup_completed")),
      String(sum("no_show")),
      String(sum("same_day_cancel")),
      String(sum("sick")),
      String(sum("instructor_cancel")),
      String(sum("advance_cancel")),
      String(sum("carryover")),
      `-${sum("prev_carryover_in")}`,
      String(sum("scheduled")),
      String(sum("total")),
      String(sum("billable")),
    ]];
  };

  const commonOpts = {
    styles: { fontSize: 7.5, cellPadding: 1.4, font: "SpoqaHanSansNeo" },
    headStyles: { fillColor: [30, 58, 95] as [number, number, number], textColor: 255, font: "SpoqaHanSansNeo", fontStyle: "normal" as const, halign: "center" as const, fontSize: 7 },
    footStyles: { fillColor: [240, 240, 240] as [number, number, number], textColor: [30, 30, 30] as [number, number, number], font: "SpoqaHanSansNeo", fontStyle: "normal" as const, halign: "center" as const },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { halign: "center" as const },
      2: { halign: "center" as const },
      3: { halign: "center" as const },
      4: { halign: "center" as const },
      5: { halign: "center" as const },
      6: { halign: "center" as const },
      7: { halign: "center" as const },
      8: { halign: "center" as const, fillColor: [255, 248, 220] as [number, number, number] },
      9: { halign: "center" as const, fillColor: [255, 248, 220] as [number, number, number] },
      10: { halign: "center" as const },
      11: { halign: "center" as const },
      12: { halign: "center" as const, fillColor: [220, 235, 255] as [number, number, number], fontStyle: "normal" as const },
    },
    margin: { left: 14, right: 14 },
  };

  let cursorY = 36;

  const renderSegment = (segmentTitle: string, segmentRows: SessionCountRow[]) => {
    if (segmentRows.length === 0) return;
    if (cursorY > 170) { doc.addPage(); cursorY = 14; }

    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(`${segmentTitle} (${segmentRows.length}명)`, 14, cursorY);
    cursorY += 5;

    // Group by instructor
    const byInstructor = new Map<string, SessionCountRow[]>();
    segmentRows.forEach(r => {
      const key = r.instructor_name || "(미배정)";
      const arr = byInstructor.get(key) || [];
      arr.push(r);
      byInstructor.set(key, arr);
    });
    const groups = Array.from(byInstructor.entries()).sort(([a], [b]) => a.localeCompare(b, "ko"));

    groups.forEach(([instructorName, list]) => {
      if (cursorY > 180) { doc.addPage(); cursorY = 14; }
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 120);
      doc.text(`▸ ${instructorName} (${list.length}명)`, 16, cursorY);

      autoTable(doc, {
        startY: cursorY + 2,
        head: buildHead(),
        body: buildBody(list),
        foot: buildFoot(list),
        ...commonOpts,
      });
      // @ts-ignore
      cursorY = (doc as any).lastAutoTable.finalY + 6;
    });

    cursorY += 4;
  };

  renderSegment("정규 수강생", regulars);
  renderSegment("기업 수강생", corporates);

  doc.save(`수업카운트_${periodLabel}.pdf`);
}
