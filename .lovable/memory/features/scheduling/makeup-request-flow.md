---
name: Makeup Request Flow
description: 보강 신청 24h 컷오프, 24h 미만은 sick(예외 사유) 단일 카테고리 체크, 월 1회 통합
type: feature
---
# 보강 신청 플로우 (신규 규정)

**컷오프**: 수업 시작 24시간 전 (이전: 48h).
**24h 미만 신청**: 단일 예외 카테고리(sick) 체크박스로만 진행 가능.
- 사유 = "본인 병가 · 갑작스러운 회의·야근 · 직계가족 긴급 상황" 통합 1개 옵션
- DB: `makeup_requests.urgent_reason = 'sick'` 저장 (이전 meeting/health/family 라디오 폐지)

**월 1회 통합 제한**: active period 기준 urgent_reason 사용 횟수 ≥ 1이면 차단 (`urgentLimitReached`).

**관련 파일**: `src/components/dashboard/MakeupRequestModal.tsx`
- `isWithin24h(iso)` 헬퍼
- "예외 사유 확인" step (이전 "긴급 보강 사유 선택")
- 보강 일정 취소 요청도 24h 컷오프로 통일
