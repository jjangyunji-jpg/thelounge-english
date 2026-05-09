---
name: Student Dashboard Notes Homework Cycle
description: 학생 대시보드 수업 노트에서 각 수업의 숙제 카드는 "직전 사이클"(이전 수업에서 부여 → 이번 수업까지 제출) 기준으로 표시
type: feature
---
StudentHomeworkPanel은 `showPreviousCycle` prop으로 모드를 분기한다.
- ClassNote(학생 대시보드 수업 노트): `showPreviousCycle` true. 선택한 수업의 직전 수업 session_id로 assignment를 조회해 표시. 즉 "이번 수업 전까지 제출되어야 했던 숙제"의 카드/완료 상태가 보인다.
- Classroom(수업 중 강사 화면): false (기본). 현재 sessionId의 카드 그대로 사용.
이전 수업이 없으면 현재 sessionId로 폴백.
