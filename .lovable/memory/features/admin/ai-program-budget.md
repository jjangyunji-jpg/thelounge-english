---
name: AI Program Budget
description: 어드민 결제확인 → 예산관리 탭 하단의 AI 프로그램(챌린지·다이어리 라운지·영어 PT) 소득 집계
type: feature
---

# AI 프로그램 예산 섹션

## 위치
- 어드민 → 결제확인 → 예산 관리 탭 → 기업 결제 섹션 하단
- 컴포넌트: `src/components/admin/AiProgramBudget.tsx`

## 프로그램 종류 (`PROGRAM_TYPES` 상수)
| key | 이름 | 가격 | 형태 |
|---|---|---|---|
| `challenge_21` | 21일 일기 챌린지 | ₩100,000 | 일회성 |
| `diary_lounge` | 다이어리 라운지 | ₩50,000 | 매월 구독 |
| `english_pt` | 영어 PT | ₩30,000 | 매월 구독 |

모두 스마트스토어 결제 → 4.95% 수수료 차감

## 데이터 모델
- **`ai_program_subscribers`**: 구매자 명단 (customer_name, program_type, start_month, end_month, note)
  - 구독자: end_month까지(또는 무기한) 매월 자동 노출
  - 일회성(챌린지): start_month에만 노출
- **`ai_program_payments`**: 월별 결제 확인 (subscriber_id, month, paid, amount_override, note)
  - **기본값 paid=true** (대부분 결제됨) → 토글 시 미결제 레코드 생성
  - amount_override로 개별 금액 조정 가능

## 기간 기준
- 결제확인 period(YYYY-MM)와 동일 → `aiMonthKey = currentPeriod.start_date.slice(0, 7)`

## UI 구성
1. 4개 요약 카드: 총 결제액 / 스토어 결제 / 수수료(4.95%) / 실수령 합계
2. 프로그램별 카드 3개: 인원 + 발생액 + 실수령
3. 이번 달 결제 대상 테이블: 결제완료/미결제 토글 버튼
4. "구독자 관리" 패널: 전체 구독자 CRUD (이름·프로그램·시작월·종료월·메모)

## 산출 로직
- 활성 구독자 = `activeForMonth`
  - 일회성: `start_month === monthKey`
  - 구독: `start_month <= monthKey && (end_month is null || end_month >= monthKey)`
- 결제 완료 = `payMap`에 레코드 없거나 `paid=true`
- 실수령 = `Math.round(gross × (1 - 0.0495))`
