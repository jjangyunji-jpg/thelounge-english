---
name: Makeup Cancellation Approval Flow
description: 학생이 승인된 보강을 취소 요청 → 강사 승인 후 실제 취소 (원본 복원, 노트 되돌리기, 캘린더 정리)
type: feature
---

## 플로우 (2-step approval)
1. 학생이 학생 대시보드 → 보강 신청 모달의 "이전 신청 내역"에서 `approved` 보강에 대해 "취소 요청하기" 클릭
   - 보강 일정 48시간 전부터는 비활성 (버튼 라벨 "취소 불가 (48시간 이내)")
   - `makeup_requests.status` → `'cancel_requested'` (RLS: 학생이 본인 approved → cancel_requested 변경 허용)
2. 강사가 InstructorMakeupTab "신청 관리" 탭 → "취소 요청" 영역에서 확인
   - 빨강 카드로 표시: 취소할 보강(취소선) + 복원할 원래 일정(reschedule만)
   - "취소 승인" → `handle-makeup-request action='cancel'` → 기존 cancel 로직 그대로 (원본 sick 마커 해제, 노트/주제/비고 원본으로 되돌림, 보강 세션 삭제, GCal 이벤트 삭제 + 원본 시간 GCal 이벤트 재생성)
   - "취소 거절" → `action='reject_cancel'` → status=approved로 복원, 일정 그대로 유지

## DB
- `makeup_requests.status`에 새 값 `'cancel_requested'` (text 컬럼이라 스키마 변경 불필요)
- RLS 정책 "Student can request cancel of own approved request": approved → cancel_requested 전환만 허용

## Edge function (`handle-makeup-request`)
- `action='cancel'`: 이제 status가 `approved` 또는 `cancel_requested` 둘 다 허용
- `action='reject_cancel'`: cancel_requested → approved로 되돌림 (resolved_at=null)

## UI
- 학생 모달 (MakeupRequestModal): 이전 신청 카드에서 status='cancel_requested'면 "취소 승인 대기" 뱃지 + 안내 문구
- 강사 탭 (InstructorMakeupTab): pendingRequests + cancelRequests를 합산한 totalAwaiting 카운트로 배지/탭 카운트 표시
