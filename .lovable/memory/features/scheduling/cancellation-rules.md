---
name: 수업 취소 5종 분류 및 정산/결제 영향
description: 노쇼/당일취소/병결/강사취소/사전취소 각 카테고리의 정산·결제대상·후속조치 규칙 + 이월 처리 미러 세션 모델
type: feature
---

수업 취소 처리 모달(SessionCancellationModal)은 5가지 카테고리를 제공하며, 각각 강사 정산과 학생 결제대상에 다른 영향을 줍니다.

- **노쇼(no_show)**: 정산 반영(기본급 + 레벨할증). 학생 결제대상 카운트 포함. 보강 없음. 노트 사이드바에 "노쇼" 배지.
- **당일 취소(student_cancel)**: 강사에게 기본급여 11,000원만 지급. 학생 결제대상 카운트 포함(현행 유지). 보강 없음. 노트 사이드바에 "당일 취소" 배지. 정산 PDF 설명란에 "[당일 취소]" 표기.
- **병결(sick)**: 정산 미반영. 후속조치(보강/이월/환불) 선택 필수. 노트 사이드바에 "병결" + 후속조치 배지(보강/이월/환불). 보강 진행 시에만 강사 수당 지급.
- **강사 취소(instructor_cancel)**: 정산 미반영. 후속조치(보강/이월/환불) 선택 필수. 자동으로 다음달 결제대상에서 -1 차감. 보강 진행 시에만 강사 수당 지급.
- **사전 취소(advance_cancel)**: 48시간 전 취소. 후속조치 3가지(보강/이월/취소). "취소" 선택 시 당월 결제대상에서 -1 차감.

## 이월(carry_over) 처리 정책 — 미러 세션 모델

`InstructorDashboard.tsx`의 `SessionCancellationModal` `onConfirm` 핸들러에서 처리:

1. **원본 세션(당월)**: `cancellation_type` + `cancellation_resolution='carry_over'` 유지. 추가로 `is_carryover=true, carryover_direction='next', carryover_reason=<type>` 마크.
2. **미러 세션(다음달)**: `INSERT` 신규 행. 같은 학생/강사/레벨/그룹, 다음달 같은 요일·시간 빈 슬롯(주 단위로 advance, 충돌 회피). `is_carryover=true, carryover_direction='prev', carryover_reason=<type>`. `cancellation_type=null`.

이 모델로 어드민 결제확인 `SessionCountReport`가 다음과 같이 자동 집계:
- 당월 **이월(당월)** +1 (`direction='next'`)
- 다음달 **이월(전월)** +1 (`direction='prev'`) → 다음달 결제대상에서 자연스럽게 카운트

원본을 삭제하지 않으므로 가상 세션/캘린더 정합성 보존. Google Calendar 이벤트는 `delete-calendar-event-by-search`로 best-effort 삭제.

## 취소 복원(Undo Cancellation)

강사 대시보드의 취소된 세션 카드에 **복원 버튼**(RotateCcw 아이콘)이 항상 노출됩니다(시간 제약 없음). `handleRestoreCancellation` 헬퍼가 단일 진입점:

1. 원본 세션의 `cancellation_type`, `cancellation_resolution`, `is_carryover`, `carryover_direction`, `carryover_reason` 모두 null/false 처리.
2. 원본이 `is_carryover=true, carryover_direction='next'`였다면(이월 처리), 같은 학생의 미래 `carryover_direction='prev'` 미러 세션을 자동 탐색하여 **시작 안 했고 노트가 없는 경우에만** DB와 캘린더에서 함께 삭제. 미러가 손상되면 자동 삭제 안 됨(수동 처리).
3. `sync-calendar-event` 함수의 `create` 액션으로 원본 캘린더 이벤트 best-effort 복원.

## 배지 표시
SessionSidebar(강사 클래스룸 + 학생 /my/classnote)에서 `cancellation_type` 배지와 `cancellation_resolution` 배지를 함께 표시. 색상 구분(노쇼=warning, 당일취소·취소=destructive, 보강=gold, 그 외=muted).
