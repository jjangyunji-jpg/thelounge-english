---
name: Makeup Request Flow
description: 보강 신청 48h 컷오프, 48h 미만은 sick(예외 사유) 단일 카테고리 체크 + 월 1회 제한, 일반 신청은 월 횟수 무제한
type: feature
---
# 보강 신청 플로우

**컷오프**: 수업 시작 48시간 전.
- 48h 이상: 일반 신청 (월 횟수 제한 없음)
- 4h~48h: 단일 예외 카테고리(sick) 체크박스 필수
  - 사유 = "본인 병가 · 갑작스러운 회의·야근 · 직계가족 긴급 상황" 통합 1개 옵션
  - DB: `makeup_requests.urgent_reason = 'sick'`
  - **active period 기준 월 1회 제한** (`urgentLimitReached`)
- **4h 미만: 어떤 사유로도 신청 불가** (`isWithin4h` 가드, 수업 선택/proceed/submit 3단계 차단)

**보강 일정 취소 요청**: 보강 시작 48h 전까지 가능.

**관련 파일**: `src/components/dashboard/MakeupRequestModal.tsx`
- `isWithin48h(iso)`, `isWithin4h(iso)` 헬퍼
- "예외 사유 확인" step
