---
name: Session Visibility Helper
description: src/lib/sessionVisibility.ts 공통 헬퍼로 보강/취소 세션 필터링을 통일 — InstructorDashboard, SessionSidebar, (StudentDashboard) 모두 동일 규칙
type: feature
---

`src/lib/sessionVisibility.ts`의 `getMovedAwayKeys` / `isMovedAway` / `isEffectivelyInactive`를 사용해서 "다음 수업 / 예정된 수업" 목록을 만들 때:
- `cancellation_type` 마킹된 세션 제외
- 다른 세션의 `reschedule_origin_dates`에 포함된 (학생, KST 날짜) 행도 제외 (보강 처리가 origin 마킹 없이 일어난 경우 대비)

규칙 변경 시 헬퍼 한 곳만 수정. 테스트: `src/lib/__tests__/sessionVisibility.test.ts`.

스코프:
- 다중 학생 컨텍스트 (InstructorDashboard) → `scoped=true` (기본)
- 단일 학생 컨텍스트 (Classroom SessionSidebar) → `scoped: false`

원인이 된 버그:
- 황재민 5/15 케이스: 원본에 cancellation 없이 5/17 세션의 `reschedule_origin_dates`만 갱신 → 종전 코드는 cancellation_type만 봐서 5/15가 "다음 수업 준비"에 잔존
