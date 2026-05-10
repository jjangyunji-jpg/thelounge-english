---
name: Renewal Decision Flow
description: 학생이 클래스룸 진입 시 수강기간 마지막 주에 다음 달 연장/종료 여부를 응답하는 모달 + 자동 퇴원 처리 + 결제 연동
type: feature
---

매 수강기간 마지막 주에 학생이 클래스룸에 진입하면 "다음 달 수업을 연장하시겠습니까?" 모달이 자동으로 뜬다.

### 노출 조건 (모두 충족)
- `role=student` (URL 파라미터)
- 현재 KST 일자가 활성 `schedule_periods.end_date` D-10 이내
- 해당 학생의 현재 period 내 잔여(미시작·미취소) 수업 ≤ 2
- `renewal_confirmations`에 (student_name, period_id) 기록이 없음

### 결정 처리
- "예 (연장)" → `renewal_confirmations.decision='extend'` 기록
- "아니오" → `decision='withdraw'` + 어드민 인박스 즉시 알림(연장 거부 통보)

### 자동 퇴원 (cron)
- `process-renewal-withdrawals` 엣지 함수가 매일 KST 9시 실행
- `decision='withdraw' AND processed_at IS NULL AND period.end_date < KST 오늘`인 행 처리
- `instructor_students.status='inactive'` + `end_date=period.end_date` + `withdrawal_reason='연장 거부 (수강기간 종료 후 자동 처리)'`
- `end_date` 이후 미시작 세션 일괄 삭제, 처리 완료 후 `processed_at` 마킹, 어드민 인박스 알림

### 퇴원 취소
- 어드민 학생관리 탭 "재등록" 버튼이 `instructor_students` 복구와 함께 `renewal_confirmations` 행을 삭제하여 재처리 방지

### 모달 컴포넌트
`src/components/classroom/RenewalDecisionModal.tsx` — Classroom.tsx에서 학생 역할 진입 시 마운트
