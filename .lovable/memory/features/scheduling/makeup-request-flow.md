---
name: Makeup Request Modal — 4-Step Flow
description: 보강 신청 모달의 4단계 플로우 (유형→수업/긴급사유→캘린더→확인) 및 거절 코드/긴급 사유 월 1회 제한
type: feature
---
**STEP 1 — 유형 선택**: 취소된 수업 보강(있을 때 상단 강조) / 일정 변경 / 추가 보강.

**STEP 2 — 일정 변경 분기**:
- 수업 선택 → 자동으로 `scheduled_at - now() < 48h` 계산.
- 48h 이상: 바로 캘린더(STEP 3).
- 48h 미만: 긴급 사유 화면 — 빨강 박스(불가 사유: 깜빡/늦잠/약속/기분), 노랑 박스(잦은 변경 안내), 라디오 3개(meeting/health/family) 중 1개 선택.
- **월 1회 제한**: 동일 schedule_period 내에 `urgent_reason`이 있고 status가 cancelled/changed/rejected가 아닌 신청이 있으면 모든 라디오 비활성 + 안내.

**STEP 3 — 캘린더**: 기존 시각화 유지(매진/잔여 카운트, booked 슬롯 비활성). visibleSlots=0 또는 가용 슬롯 0이면 "가능한 일정이 없어요" 버튼 노출 → no_slots 화면.

**no_slots 화면**: 골드 안내 박스 + 두 버튼.
- "기존 수업 유지하기"(reschedule 한정): confirm 후 모달 닫기.
- "나중에 다시 확인할게요": 그냥 닫기.

**STEP 4 — 확인**: 기존/변경 일시, 긴급 사유, 그룹 멤버 표시 후 제출.

**DB 컬럼** (`makeup_requests`):
- `urgent_reason text` — 'meeting' | 'health' | 'family'
- `rejection_code text` — 'within_48h' | 'not_urgent' | 'no_slots' | 'repeated_change'
  학생 이전 신청 내역에서 코드가 있으면 표준 라벨로 자동 표시, 없으면 강사가 입력한 자유 `reject_reason` 그대로 노출.

**DB 저장 규칙**:
- reschedule 신청 시 항상 `original_scheduled_at` 저장(기간 카운트용).
- 48h 미만 신청은 `urgent_reason` 필수.
