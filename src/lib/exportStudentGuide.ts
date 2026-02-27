import jsPDF from "jspdf";

const FONT_URL = "/fonts/SpoqaHanSansNeo-Regular.ttf";

async function loadFont(doc: jsPDF) {
  const res = await fetch(FONT_URL);
  const buf = await res.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), "")
  );
  doc.addFileToVFS("SpoqaHanSansNeo.ttf", base64);
  doc.addFont("SpoqaHanSansNeo.ttf", "Spoqa", "normal");
  doc.setFont("Spoqa");
}

function drawHeader(doc: jsPDF, y: number, text: string): number {
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 95); // navy
  doc.text(text, 20, y);
  doc.setDrawColor(212, 175, 55); // gold
  doc.setLineWidth(0.8);
  doc.line(20, y + 2, 190, y + 2);
  return y + 12;
}

function drawSubHeader(doc: jsPDF, y: number, text: string): number {
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.text(text, 20, y);
  return y + 8;
}

function drawBody(doc: jsPDF, y: number, lines: string[]): number {
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  for (const line of lines) {
    if (y > 270) {
      doc.addPage();
      y = 25;
    }
    doc.text(line, 24, y);
    y += 6;
  }
  return y + 4;
}

function drawNumberedSteps(doc: jsPDF, y: number, steps: string[]): number {
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  for (let i = 0; i < steps.length; i++) {
    if (y > 270) {
      doc.addPage();
      y = 25;
    }
    // Number circle
    doc.setFillColor(30, 58, 95);
    doc.circle(27, y - 1.5, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(`${i + 1}`, 25.8, y);
    // Step text
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(steps[i], 155);
    for (const wl of wrapped) {
      doc.text(wl, 33, y);
      y += 6;
    }
    y += 2;
  }
  return y + 2;
}

function drawTip(doc: jsPDF, y: number, tip: string): number {
  if (y > 260) {
    doc.addPage();
    y = 25;
  }
  doc.setFillColor(255, 248, 225); // light gold bg
  doc.roundedRect(20, y - 4, 170, 14, 3, 3, "F");
  doc.setFontSize(9);
  doc.setTextColor(140, 110, 30);
  doc.text(`💡 TIP: ${tip}`, 24, y + 3);
  return y + 18;
}

export async function exportStudentGuidePdf() {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await loadFont(doc);

  // ═══════════════════════════════════════════════════════════════
  // COVER PAGE
  // ═══════════════════════════════════════════════════════════════
  doc.setFillColor(30, 58, 95); // navy
  doc.rect(0, 0, 210, 297, "F");

  // Gold accent bar
  doc.setFillColor(212, 175, 55);
  doc.rect(0, 120, 210, 3, "F");

  doc.setFont("Spoqa");
  doc.setFontSize(36);
  doc.setTextColor(255, 255, 255);
  doc.text("The Lounge English", 105, 90, { align: "center" });

  doc.setFontSize(18);
  doc.setTextColor(212, 175, 55);
  doc.text("학생 이용 가이드북", 105, 140, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(180, 190, 210);
  doc.text("온라인 영어 수업 플랫폼 사용 안내서", 105, 155, { align: "center" });

  const today = new Date();
  doc.setFontSize(10);
  doc.setTextColor(140, 150, 170);
  doc.text(
    `${today.getFullYear()}년 ${today.getMonth() + 1}월`,
    105,
    250,
    { align: "center" }
  );

  // ═══════════════════════════════════════════════════════════════
  // TABLE OF CONTENTS
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  let y = 30;
  doc.setFontSize(20);
  doc.setTextColor(30, 58, 95);
  doc.text("목차", 20, y);
  y += 15;

  const toc = [
    "1. 처음 시작하기 (계정 설정)",
    "2. 로그인하기",
    "3. 학생 대시보드 살펴보기",
    "4. 수업 참여하기",
    "5. 수업 노트 확인하기",
    "6. 숙제 제출하기",
    "7. 숙제 피드백 확인하기",
    "8. 단어장 활용하기",
    "9. 단어 시험 보기",
    "10. 내 프로필 관리",
    "11. 비밀번호 재설정",
    "12. 자주 묻는 질문 (FAQ)",
  ];

  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  for (const item of toc) {
    doc.text(item, 24, y);
    y += 8;
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. GETTING STARTED
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  y = 25;
  y = drawHeader(doc, y, "1. 처음 시작하기 (계정 설정)");
  y = drawBody(doc, y, [
    "강사가 회원가입 초대 링크를 보내드립니다.",
    "초대 링크를 클릭하면 계정 설정 페이지로 이동합니다.",
  ]);
  y = drawSubHeader(doc, y, "계정 설정 단계");
  y = drawNumberedSteps(doc, y, [
    "강사로부터 받은 초대 링크를 클릭합니다.",
    "닉네임을 입력합니다. (대시보드에 표시되는 이름입니다)",
    "비밀번호를 설정합니다. (6자 이상)",
    "비밀번호를 한 번 더 입력하여 확인합니다.",
    "'설정 완료' 버튼을 클릭합니다.",
    "설정이 완료되면 자동으로 대시보드로 이동합니다.",
  ]);
  y = drawTip(doc, y, "비밀번호는 나중에 '내 프로필'에서 변경할 수 있습니다.");

  // ═══════════════════════════════════════════════════════════════
  // 2. LOGIN
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  y = 25;
  y = drawHeader(doc, y, "2. 로그인하기");
  y = drawBody(doc, y, [
    "웹사이트에 접속하면 로그인 화면이 나타납니다.",
  ]);
  y = drawNumberedSteps(doc, y, [
    "이메일 주소를 입력합니다. (강사가 등록한 이메일)",
    "비밀번호를 입력합니다.",
    "'로그인' 버튼을 클릭합니다.",
    "로그인에 성공하면 학생 대시보드로 이동합니다.",
  ]);
  y = drawTip(doc, y, "비밀번호를 잊었다면 '비밀번호를 잊었나요?' 링크를 클릭하세요.");
  y += 4;
  y = drawBody(doc, y, [
    "⚠ 로그인 실패 시 아래를 확인해주세요:",
    "   • 이메일 주소가 정확한지 확인",
    "   • 대/소문자 구분에 주의",
    "   • 계정 승인이 완료되었는지 확인 (승인 대기 중이면 로그인 불가)",
  ]);

  // ═══════════════════════════════════════════════════════════════
  // 3. DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  y = 25;
  y = drawHeader(doc, y, "3. 학생 대시보드 살펴보기");
  y = drawBody(doc, y, [
    "로그인하면 학생 대시보드가 나타납니다.",
    "대시보드에서 수업, 숙제, 단어 등 모든 정보를 한눈에 볼 수 있습니다.",
  ]);

  y = drawSubHeader(doc, y, "대시보드 구성 요소");
  y = drawNumberedSteps(doc, y, [
    "다음 수업 카드: 예정된 수업 일시와 남은 시간이 표시됩니다. Google Meet 링크를 클릭하면 바로 수업에 참여할 수 있습니다.",
    "캘린더: 이번 기간의 수업 일정이 달력으로 표시됩니다. 금색 점이 수업이 있는 날입니다.",
    "최근 수업 과제 섹션: 이번 주에 할당된 숙제 목록입니다. 여기서 바로 숙제를 제출할 수 있습니다.",
    "이번 주 단어: 이번 주에 학습할 단어가 표시됩니다. 스피커 아이콘을 누르면 발음을 들을 수 있습니다.",
    "수업 기록: 지금까지 완료한 수업 수를 확인할 수 있습니다.",
    "단어 시험 기록: 그동안 본 단어 시험의 점수를 확인할 수 있습니다.",
  ]);
  y = drawTip(doc, y, "대시보드 상단 오른쪽에서 기간을 변경하면 다른 기간의 정보를 볼 수 있습니다.");

  // ═══════════════════════════════════════════════════════════════
  // 4. JOINING CLASS
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  y = 25;
  y = drawHeader(doc, y, "4. 수업 참여하기");
  y = drawNumberedSteps(doc, y, [
    "대시보드의 '다음 수업' 카드에서 Google Meet 링크를 확인합니다.",
    "수업 시간이 되면 'Google Meet 참여' 버튼을 클릭합니다.",
    "Google Meet 창이 열리면 카메라/마이크를 켜고 수업에 참여합니다.",
    "수업 중 강사가 공유하는 수업 노트를 실시간으로 확인할 수 있습니다.",
  ]);
  y = drawTip(doc, y, "수업 10분 전에는 대시보드에 접속해서 준비하는 것이 좋습니다.");

  // ═══════════════════════════════════════════════════════════════
  // 5. CLASS NOTES
  // ═══════════════════════════════════════════════════════════════
  y += 8;
  y = drawHeader(doc, y, "5. 수업 노트 확인하기");
  y = drawBody(doc, y, [
    "수업 중/후에 강사가 작성한 수업 노트를 확인할 수 있습니다.",
  ]);
  y = drawNumberedSteps(doc, y, [
    "대시보드 하단 내비게이션에서 '수업노트'를 클릭합니다.",
    "왼쪽 사이드바에서 수업 날짜를 선택합니다.",
    "선택한 수업의 노트, 숙제, 단어를 탭으로 전환하며 볼 수 있습니다.",
    "노트 탭: 수업 중 강사가 작성한 내용을 확인합니다.",
    "숙제 탭: 해당 수업에 할당된 숙제를 확인하고 제출합니다.",
    "단어 탭: 수업 중 배운 단어를 확인하고 발음을 들을 수 있습니다.",
  ]);

  // ═══════════════════════════════════════════════════════════════
  // 6. SUBMITTING HOMEWORK
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  y = 25;
  y = drawHeader(doc, y, "6. 숙제 제출하기");
  y = drawBody(doc, y, [
    "숙제는 대시보드의 '최근 수업 과제' 섹션에서 제출할 수 있습니다.",
    "숙제 유형에 따라 제출 방식이 다릅니다.",
  ]);

  y = drawSubHeader(doc, y, "쓰기 숙제");
  y = drawNumberedSteps(doc, y, [
    "숙제 옆의 '제출' 버튼을 클릭합니다.",
    "팝업 창에서 영어로 글을 작성합니다.",
    "'제출하기' 버튼을 클릭하여 제출합니다.",
  ]);

  y = drawSubHeader(doc, y, "말하기 숙제");
  y = drawNumberedSteps(doc, y, [
    "숙제 옆의 '제출' 버튼을 클릭합니다.",
    "마이크 버튼을 클릭하여 녹음을 시작합니다.",
    "말하기가 끝나면 정지 버튼을 클릭합니다.",
    "녹음 내용을 확인한 뒤 '제출하기' 버튼을 클릭합니다.",
  ]);

  y = drawSubHeader(doc, y, "읽기 / 외우기 숙제");
  y = drawBody(doc, y, [
    "읽기와 외우기 숙제는 '완료' 버튼을 눌러 완료 처리합니다.",
    "별도의 내용을 제출할 필요가 없습니다.",
  ]);

  y = drawSubHeader(doc, y, "파일 제출 숙제");
  y = drawNumberedSteps(doc, y, [
    "숙제 옆의 '제출' 버튼을 클릭합니다.",
    "파일 선택 영역을 클릭하여 파일을 선택합니다.",
    "'제출하기' 버튼을 클릭하여 제출합니다.",
  ]);

  y = drawTip(doc, y, "제출 후에는 '제출됨' 표시가 나타나며, 강사의 검토를 기다립니다.");

  // ═══════════════════════════════════════════════════════════════
  // 7. HOMEWORK FEEDBACK
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  y = 25;
  y = drawHeader(doc, y, "7. 숙제 피드백 확인하기");
  y = drawBody(doc, y, [
    "강사가 숙제를 검토하면 '검토됨' 표시로 바뀝니다.",
  ]);
  y = drawNumberedSteps(doc, y, [
    "'검토됨 →' 버튼을 클릭합니다.",
    "피드백 팝업 창이 열립니다.",
    "쓰기 숙제의 경우 AI 교정 결과를 확인할 수 있습니다:",
    "   • 빨간 줄긋기: 수정이 필요한 부분 (원문)",
    "   • 파란 글씨: 교정된 표현",
    "   • 마우스를 올리면 교정 설명이 나타납니다.",
    "'교정 보기 / 원문 / 교정문' 탭을 전환하여 비교할 수 있습니다.",
    "강사 피드백 메시지도 하단에서 확인할 수 있습니다.",
  ]);
  y = drawTip(doc, y, "자연스러움 점수(10점 만점)로 영어 표현의 자연스러움을 확인하세요.");

  // ═══════════════════════════════════════════════════════════════
  // 8. VOCABULARY
  // ═══════════════════════════════════════════════════════════════
  y += 8;
  y = drawHeader(doc, y, "8. 단어장 활용하기");
  y = drawBody(doc, y, [
    "대시보드 하단 내비게이션에서 '단어장'을 클릭합니다.",
  ]);
  y = drawNumberedSteps(doc, y, [
    "주차별로 정리된 단어 목록을 확인합니다.",
    "각 단어의 영어, 한국어 뜻, 품사, 예문을 볼 수 있습니다.",
    "스피커 아이콘 🔊 을 클릭하면 원어민 발음을 들을 수 있습니다.",
    "상단의 'PDF 다운로드' 버튼으로 단어 목록을 PDF로 저장합니다.",
    "'시험 보기' 버튼으로 단어 시험에 도전합니다.",
  ]);

  // ═══════════════════════════════════════════════════════════════
  // 9. VOCAB TEST
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  y = 25;
  y = drawHeader(doc, y, "9. 단어 시험 보기");
  y = drawNumberedSteps(doc, y, [
    "단어장 페이지에서 '시험 보기' 버튼을 클릭합니다.",
    "시험 유형을 선택합니다: '영→한' 또는 '한→영'",
    "출제할 주차를 선택합니다.",
    "시험이 시작되면 제시된 단어의 뜻을 입력합니다.",
    "모든 문제를 풀면 결과가 표시됩니다.",
    "점수와 오답을 확인할 수 있습니다.",
  ]);
  y = drawTip(doc, y, "시험 기록은 대시보드에서 언제든 확인할 수 있습니다.");

  // ═══════════════════════════════════════════════════════════════
  // 10. PROFILE
  // ═══════════════════════════════════════════════════════════════
  y += 8;
  y = drawHeader(doc, y, "10. 내 프로필 관리");
  y = drawNumberedSteps(doc, y, [
    "대시보드 상단 프로필 아이콘을 클릭합니다.",
    "'내 프로필' 페이지로 이동합니다.",
    "닉네임을 수정하고 '저장' 버튼을 클릭합니다.",
    "비밀번호를 변경하려면 새 비밀번호를 두 번 입력하고 '변경' 버튼을 클릭합니다.",
  ]);

  // ═══════════════════════════════════════════════════════════════
  // 11. PASSWORD RESET
  // ═══════════════════════════════════════════════════════════════
  y += 8;
  y = drawHeader(doc, y, "11. 비밀번호 재설정");
  y = drawBody(doc, y, [
    "비밀번호를 잊었을 경우 아래 단계를 따라주세요.",
  ]);
  y = drawNumberedSteps(doc, y, [
    "로그인 화면에서 '비밀번호를 잊었나요?' 를 클릭합니다.",
    "등록된 이메일 주소를 입력합니다.",
    "'재설정 링크 보내기' 버튼을 클릭합니다.",
    "이메일로 받은 재설정 링크를 클릭합니다.",
    "새 비밀번호를 입력하고 저장합니다.",
  ]);

  // ═══════════════════════════════════════════════════════════════
  // 12. FAQ
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  y = 25;
  y = drawHeader(doc, y, "12. 자주 묻는 질문 (FAQ)");

  const faqs = [
    { q: "Q. 수업 링크는 어디서 확인하나요?", a: "대시보드의 '다음 수업' 카드에서 Google Meet 링크를 확인할 수 있습니다." },
    { q: "Q. 숙제를 수정할 수 있나요?", a: "제출 전에는 내용을 자유롭게 수정할 수 있습니다. 제출 후에는 강사에게 문의해주세요." },
    { q: "Q. 단어 발음이 재생되지 않아요.", a: "인터넷 연결을 확인하고, 브라우저의 소리가 켜져 있는지 확인해주세요." },
    { q: "Q. 로그인이 안 돼요.", a: "이메일과 비밀번호가 정확한지 확인해주세요. 계정 승인이 되지 않았을 수 있으니 강사에게 문의하세요." },
    { q: "Q. 다른 기기에서도 사용할 수 있나요?", a: "네! 웹 브라우저가 있는 모든 기기(PC, 태블릿, 스마트폰)에서 사용 가능합니다." },
    { q: "Q. 화요일에는 왜 수업이 없나요?", a: "화요일은 정기 휴무일입니다. 캘린더에 회색으로 표시됩니다." },
  ];

  for (const faq of faqs) {
    if (y > 260) { doc.addPage(); y = 25; }
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95);
    doc.text(faq.q, 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const wrapped = doc.splitTextToSize(faq.a, 165);
    for (const wl of wrapped) {
      doc.text(wl, 24, y);
      y += 6;
    }
    y += 4;
  }

  // ═══════════════════════════════════════════════════════════════
  // FOOTER on each page
  // ═══════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text("The Lounge English · 학생 이용 가이드북", 105, 290, { align: "center" });
    doc.text(`${i} / ${totalPages}`, 190, 290, { align: "right" });
  }

  doc.save("The_Lounge_English_학생_가이드북.pdf");
}
