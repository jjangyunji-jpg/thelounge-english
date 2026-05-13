---
name: Corporate Roles Model
description: 기업 수강생을 corporate_role로 매니저/학생 분리, corporate_account로 회사 그룹 식별
type: feature
---
`instructor_students` 테이블에 두 컬럼 추가됨:
- `corporate_role`: `'learner'` (수업 받음, 기본값) | `'manager'` (신청·결제만, 수업 X) | `'learner_manager'` (본인이 매니저 겸 학생)
- `corporate_account`: 회사·매니저 그룹 식별자 (예: `'전현지팀'`, `'황재민팀'`)

## 청구 로직 (CashReceiptManagement)
- `corporate_role='manager'` 행은 결제확인에서 완전히 제외 (청구 X, 카운트 X)
- 그룹의 경우 멤버 중 알파벳 순 첫 학생만 1행으로 표시되어 70k × 회수로 청구
  - 예: 도은+지아나 → 도은 행만 표시 ("도은 + 지아나"), 지아나 행 숨김
- 개인 corp 학생은 50k × 회수
- learner_manager는 일반 learner와 동일하게 처리

## 세션 생성 (generate-sessions)
- `.neq("corporate_role", "manager")`로 매니저 행은 자동 세션 생성에서 제외

## SessionCountReport
- 매니저 행 제외, 학생별 카운트는 그대로 유지

## 마이그레이션 결과 (2026-05)
- 전현지팀: 전현지(manager) + 도은↔지아나, 선혜↔연정, 한지은(개인)
- 황재민팀: 김동욱(manager) + 황재민(개인, 50k 자동 적용)
- 여환웅, 오의식: learner_manager (본인 등록)

## TODO (follow-up)
- StudentManagement: 매니저 뱃지 표시, 등록폼에 role/account 필드
- MakeupRequestModal: 매니저 로그인 시 학생 선택 단계 추가
- StudentDashboard: 매니저 로그인 시 관리 학생 전환 UI
