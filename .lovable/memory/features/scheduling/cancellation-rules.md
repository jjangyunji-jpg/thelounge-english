---
name: 수업 취소 5종 분류 및 정산/결제 영향
description: 노쇼/당일취소/병결/강사취소/사전취소 각 카테고리의 정산·결제대상·후속조치 규칙
type: feature
---

수업 취소 처리 모달(SessionCancellationModal)은 5가지 카테고리를 제공하며, 각각 강사 정산과 학생 결제대상에 다른 영향을 줍니다.

- **노쇼(no_show)**: 정산 반영(기본급 + 레벨할증). 학생 결제대상 카운트 포함. 보강 없음. 노트 사이드바에 "노쇼" 배지.
- **당일 취소(student_cancel)**: 강사에게 기본급여 11,000원만 지급. 학생 결제대상 카운트 포함(현행 유지). 보강 없음. 노트 사이드바에 "당일 취소" 배지. 정산 PDF 설명란에 "[당일 취소]" 표기.
- **병결(sick)**: 정산 미반영. 후속조치(보강/이월/환불) 선택 필수. 노트 사이드바에 "병결" + 후속조치 배지(보강/이월/환불). 보강 진행 시에만 강사 수당 지급.
- **강사 취소(instructor_cancel)**: 정산 미반영. 후속조치(보강/이월/환불) 선택 필수. 자동으로 다음달 결제대상에서 -1 차감. 보강 진행 시에만 강사 수당 지급.
- **사전 취소(advance_cancel)**: 48시간 전 취소. 후속조치 3가지(보강/이월/취소). "취소" 선택 시 당월 결제대상에서 -1 차감.

이월(carry_over) 처리 정책: 세션 레코드는 DB에 유지하고 cancellation_resolution='carry_over'만 저장. 결제확인(SessionCountReport)에서 다음달 prev_carryover_in으로 -1 차감하여 다음달 결제대상에 자동 반영. 세션 삭제는 하지 않아 가상 세션/캘린더 정합성 보존.

배지 표시: SessionSidebar(강사 클래스룸 + 학생 /my/classnote)에서 cancellation_type 배지와 cancellation_resolution 배지를 함께 표시. 색상 구분(노쇼=warning, 당일취소·취소=destructive, 보강=gold, 그 외=muted).
